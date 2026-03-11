/**
 * AEGIS Synthetic Risk Scoring Engine
 * server/intelligence/riskScoring.ts
 *
 * AI-powered risk assessment combining:
 * - HuggingFace Inference API (real ML model) for NLP severity
 * - Location risk scoring
 * - Temporal patterns
 * - Repeat offender detection
 * - Survivor vulnerability assessment
 */

import { SupabaseClient } from '@supabase/supabase-js';

const HF_API_URL = 'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest';
const HF_EMOTION_URL = 'https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base';

interface EdgeInferenceResult {
  sentimentScore: number;
  emotionBoost: number;
  source: 'xenova' | 'heuristic';
}

let xenovaSentimentPipeline: EdgeSentimentPipeline | null = null;
let xenovaPipelineInitError = false;

interface HFSentimentResult {
  label: string;
  score: number;
}

interface HFEmotionResult {
  label: string;
  score: number;
}

interface EdgeModelOutput {
  label?: string;
  score?: number;
}

type EdgeSentimentPipeline = (text: string) => Promise<EdgeModelOutput | EdgeModelOutput[]>;

interface TransformerEnvironment {
  allowLocalModels?: boolean;
  useBrowserCache?: boolean;
  backends?: {
    onnx?: {
      wasm?: {
        numThreads?: number;
      };
    };
  };
}

interface TransformersModule {
  env?: TransformerEnvironment;
  pipeline: (task: string, model: string) => Promise<EdgeSentimentPipeline>;
}

interface SurvivorRiskProfile {
  age_under_18?: boolean;
  pregnant?: boolean;
  disabled?: boolean;
  economic_hardship?: boolean;
  undocumented?: boolean;
  previous_abuse?: boolean;
  race?: string;
  ethnicity?: string;
}

export interface RiskCaseData {
  description?: string;
  region?: string;
  lat?: number;
  lng?: number;
  offenderId?: string;
  survivorData?: SurvivorRiskProfile;
  reportedAt?: Date | string;
}

async function queryHuggingFace(
  url: string,
  text: string,
): Promise<HFSentimentResult[] | null> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && Array.isArray(data[0])) return data[0] as HFSentimentResult[];
    if (Array.isArray(data)) return data as HFSentimentResult[];
    return null;
  } catch {
    return null;
  }
}

function mapHFSentimentToScore(results: HFSentimentResult[] | null): number {
  if (!results) return 0;
  const negativeLabels = ['negative', 'neg', 'LABEL_0', 'fear', 'anger', 'sadness', 'disgust'];
  const highNegative = results.find(
    (r) => negativeLabels.some((l) => r.label.toLowerCase().includes(l.toLowerCase())) && r.score > 0.6,
  );
  if (highNegative) return Math.round(highNegative.score * 90);
  const anyNeg = results.find((r) =>
    negativeLabels.some((l) => r.label.toLowerCase().includes(l.toLowerCase())),
  );
  if (anyNeg) return Math.round(anyNeg.score * 60);
  return 15;
}

function mapHFEmotionToBoost(results: HFEmotionResult[] | null): number {
  if (!results) return 0;
  const crisisEmotions: Record<string, number> = { fear: 20, anger: 15, disgust: 10, sadness: 12 };
  let boost = 0;
  for (const r of results) {
    const key = r.label.toLowerCase();
    if (crisisEmotions[key] && r.score > 0.4) {
      boost = Math.max(boost, Math.round(crisisEmotions[key] * r.score));
    }
  }
  return boost;
}

function heuristicEdgeInference(text: string): EdgeInferenceResult {
  const lower = text.toLowerCase();
  const severePatterns: Array<[RegExp, number]> = [
    [/death threat|kill|murder|weapon|gun|firearm|knife|strangle|rape/gi, 22],
    [/beating|assault|forced|choked|hospital|blood|injured/gi, 16],
    [/stalk|harass|threat|afraid|fear|panic|unsafe/gi, 10],
  ];

  let score = 18;
  let emotionBoost = 0;

  for (const [pattern, weight] of severePatterns) {
    const matches = lower.match(pattern)?.length ?? 0;
    if (matches > 0) {
      score += Math.min(35, matches * weight);
      emotionBoost += Math.min(16, matches * 3);
    }
  }

  const normalized = Math.max(0, Math.min(100, score));
  return {
    sentimentScore: normalized,
    emotionBoost: Math.min(22, emotionBoost),
    source: 'heuristic',
  };
}

async function getXenovaSentimentPipeline(): Promise<EdgeSentimentPipeline | null> {
  if (xenovaPipelineInitError) return null;
  if (xenovaSentimentPipeline) return xenovaSentimentPipeline;

  try {
    const transformers = (await import('@xenova/transformers')) as unknown as TransformersModule;
    const env = transformers.env;
    if (env) {
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      env.backends = env.backends || {};
      env.backends.onnx = env.backends.onnx || {};
      env.backends.onnx.wasm = env.backends.onnx.wasm || {};
      env.backends.onnx.wasm.numThreads = 1;
    }

    const pipeline = transformers.pipeline;
    xenovaSentimentPipeline = await pipeline(
      'sentiment-analysis',
      process.env.XENOVA_SENTIMENT_MODEL || 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    );

    return xenovaSentimentPipeline;
  } catch {
    xenovaPipelineInitError = true;
    return null;
  }
}

async function inferWithEdgeModel(text: string): Promise<EdgeInferenceResult> {
  const pipeline = await getXenovaSentimentPipeline();
  if (!pipeline) {
    return heuristicEdgeInference(text);
  }

  try {
    const result = await pipeline(text.slice(0, 512));
    const first = Array.isArray(result) ? result[0] : result;
    const label = String(first?.label || '').toLowerCase();
    const confidence = Number(first?.score || 0.5);

    const negative = label.includes('negative') || label.includes('label_0');
    const sentimentScore = negative
      ? Math.round(Math.max(35, confidence * 92))
      : Math.round(Math.max(15, (1 - confidence) * 55));

    return {
      sentimentScore: Math.max(0, Math.min(100, sentimentScore)),
      emotionBoost: negative ? Math.round(Math.min(18, confidence * 18)) : 0,
      source: 'xenova',
    };
  } catch {
    return heuristicEdgeInference(text);
  }
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  confidence: number;
  factors: RiskFactor[];
  recommendation: string;
  biasDetected: boolean;
  biasFlag?: string;
  explainability: string;
  explainabilityDetails: {
    topContributors: Array<{ factor: string; contribution: number; percent: number }>;
    modelPath: string;
    summary: string;
  };
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number;
  flag?: string;
}

export class RiskScoringEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Comprehensive risk assessment for a case
   */
  public async assessCaseRisk(_caseId: string, caseData: RiskCaseData): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    const factorWeights: Record<string, number> = {
      severity: 0.35,
      location: 0.25,
      repeat: 0.20,
      survivor: 0.15,
      temporal: 0.05,
    };

    // 1. Severity Assessment (NLP-based)
    const severityFactor = await this.assessSeverity(caseData.description || '');
    factors.push(severityFactor);

    // 2. Location Risk
    const locationFactor = await this.assessLocationRisk(
      caseData.region || '',
      caseData.lat,
      caseData.lng
    );
    factors.push(locationFactor);

    // 3. Repeat Offender Pattern
    const repeatFactor = await this.detectRepeatOffender(caseData.offenderId);
    factors.push(repeatFactor);

    // 4. Survivor Vulnerability
    const survivorFactor = await this.assessSurvivorVulnerability(caseData.survivorData || {});
    factors.push(survivorFactor);

    // 5. Temporal Patterns
    const temporalFactor = this.assessTemporalPattern(
      caseData.reportedAt instanceof Date ? caseData.reportedAt : new Date(caseData.reportedAt || new Date())
    );
    factors.push(temporalFactor);

    // Calculate weighted score
    const weightedScore = factors.reduce((sum, factor) => {
      const weight = factorWeights[factor.name.toLowerCase().split('_')[0]] || 0;
      return sum + factor.contribution * weight;
    }, 0);

    // Normalize to 0-100
    const riskScore = Math.round(Math.min(100, Math.max(0, weightedScore)));

    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore);

    // Check for bias
    const biasCheck = this.checkForBias(factors, caseData);

    const explainability = this.generateExplanation(factors, riskScore);
    const explainabilityDetails = this.generateExplainabilityDetails(factors, riskScore);

    return {
      riskLevel,
      riskScore,
      confidence: this.calculateConfidence(factors),
      factors,
      recommendation: this.generateRecommendation(riskLevel, factors),
      biasDetected: biasCheck.detected,
      biasFlag: biasCheck.flag,
      explainability,
      explainabilityDetails,
    };
  }

  /**
   * Assess severity using HuggingFace ML models (real AI) with keyword fallback.
   * Primary: cardiffnlp/twitter-roberta-base-sentiment-latest
   * Secondary: j-hartmann/emotion-english-distilroberta-base (emotion boost)
   * Fallback: keyword matching (used when HF API is unavailable)
   */
  private async assessSeverity(description: string): Promise<RiskFactor> {
    const criticalKeywords = ['death threat', 'kill', 'murder', 'severe injury', 'weapon', 'firearm', 'knife', 'poison'];
    const highKeywords = ['assault', 'attack', 'rape', 'sexual abuse', 'serious injury', 'hospitalized', 'emergency room'];
    const mediumKeywords = ['violence', 'hit', 'punch', 'injury', 'threat', 'harassment'];

    const lowerDesc = description.toLowerCase();

    let keywordScore = 20;
    criticalKeywords.forEach((kw) => { if (lowerDesc.includes(kw)) keywordScore = Math.max(keywordScore, 95); });
    if (keywordScore < 95) highKeywords.forEach((kw) => { if (lowerDesc.includes(kw)) keywordScore = Math.max(keywordScore, 70); });
    if (keywordScore < 70) mediumKeywords.forEach((kw) => { if (lowerDesc.includes(kw)) keywordScore = Math.max(keywordScore, 40); });

    if (!description || description.length < 10) {
      return { name: 'severity_assessment', weight: 0.35, value: keywordScore, contribution: keywordScore };
    }

    const hasHuggingFaceToken = Boolean(process.env.HUGGINGFACE_API_TOKEN);

    if (!hasHuggingFaceToken) {
      const edgeResult = await inferWithEdgeModel(description);
      const blendedEdgeScore = Math.round(edgeResult.sentimentScore * 0.75 + keywordScore * 0.25 + edgeResult.emotionBoost * 0.1);
      const finalEdgeScore = Math.min(100, Math.max(0, blendedEdgeScore));
      return {
        name: 'severity_assessment',
        weight: 0.35,
        value: finalEdgeScore,
        contribution: finalEdgeScore,
        flag: edgeResult.source === 'xenova' ? 'EDGE_MODEL_USED' : 'HEURISTIC_EDGE_FALLBACK',
      };
    }

    const [sentimentResults, emotionResults] = await Promise.all([
      queryHuggingFace(HF_API_URL, description),
      queryHuggingFace(HF_EMOTION_URL, description),
    ]);

    const aiAvailable = sentimentResults !== null;

    if (!aiAvailable) {
      const edgeResult = await inferWithEdgeModel(description);
      const blendedEdgeScore = Math.round(edgeResult.sentimentScore * 0.65 + keywordScore * 0.35 + edgeResult.emotionBoost * 0.1);
      const finalEdgeScore = Math.min(100, Math.max(0, blendedEdgeScore));
      return {
        name: 'severity_assessment',
        weight: 0.35,
        value: finalEdgeScore,
        contribution: finalEdgeScore,
        flag: edgeResult.source === 'xenova' ? 'EDGE_FALLBACK_USED' : 'HEURISTIC_EDGE_FALLBACK',
      };
    }

    const aiSentimentScore = mapHFSentimentToScore(sentimentResults as HFSentimentResult[] | null);
    const emotionBoost = mapHFEmotionToBoost(emotionResults as HFEmotionResult[] | null);
    const blendedScore = Math.round(aiSentimentScore * 0.55 + keywordScore * 0.30 + emotionBoost * 0.15);
    const finalScore = Math.min(100, Math.max(0, blendedScore));

    return {
      name: 'severity_assessment',
      weight: 0.35,
      value: finalScore,
      contribution: finalScore,
      flag: 'ML_MODEL_USED',
    };
  }

  /**
   * Assess risk based on location crime patterns
   */
  private async assessLocationRisk(region: string, _lat?: number, _lng?: number): Promise<RiskFactor> {
    try {
      // Fetch regional crime statistics (would be from database in production)
      const { data: regionData } = await this.supabase
        .from('regions')
        .select('crime_rate, gbv_incidents_per_1000')
        .eq('name', region)
        .single();

      let riskScore = 30; // Default baseline

      if (regionData) {
        // Scale 0-100 based on regional statistics
        const crimeRate = regionData.crime_rate || 0;
        const gbvRate = regionData.gbv_incidents_per_1000 || 0;

        riskScore = Math.round((crimeRate * 0.6 + gbvRate * 0.4) / 10); // Normalized
        riskScore = Math.min(100, Math.max(20, riskScore)); // Floor at 20
      }

      return {
        name: 'location_risk',
        weight: 0.25,
        value: riskScore,
        contribution: riskScore,
      };
    } catch (error) {
      console.error('Location risk assessment failed:', error);
      return {
        name: 'location_risk',
        weight: 0.25,
        value: 30,
        contribution: 30,
      };
    }
  }

  /**
   * Detect repeat offender patterns
   */
  private async detectRepeatOffender(offenderId?: string): Promise<RiskFactor> {
    if (!offenderId) {
      return {
        name: 'repeat_offender',
        weight: 0.20,
        value: 0,
        contribution: 0,
      };
    }

    try {
      const { data: offenses } = await this.supabase
        .from('case_reports')
        .select('id')
        .eq('offender_id', offenderId)
        .neq('status', 'dismissed');

      const offenseCount = offenses?.length || 0;

      // Risk score increases with repeat offenses
      let riskScore = 0;
      if (offenseCount === 1) riskScore = 20;
      else if (offenseCount === 2) riskScore = 50;
      else if (offenseCount >= 3) riskScore = 85;

      return {
        name: 'repeat_offender',
        weight: 0.20,
        value: riskScore,
        contribution: riskScore,
        flag: offenseCount >= 3 ? 'SERIAL_OFFENDER' : undefined,
      };
    } catch (error) {
      console.error('Repeat offender detection failed:', error);
      return {
        name: 'repeat_offender',
        weight: 0.20,
        value: 0,
        contribution: 0,
      };
    }
  }

  /**
   * Assess survivor vulnerability
   */
  private async assessSurvivorVulnerability(survivorData: SurvivorRiskProfile): Promise<RiskFactor> {
    let vulnerabilityScore = 20; // Baseline

    const vulnerabilityFactors = {
      age_under_18: { flag: 'CHILD_VICTIM', weight: 25 },
      pregnant: { flag: 'PREGNANT_VICTIM', weight: 20 },
      disabled: { flag: 'DISABLED_VICTIM', weight: 15 },
      economic_hardship: { flag: 'ECONOMIC_HARDSHIP', weight: 10 },
      undocumented: { flag: 'UNDOCUMENTED_IMMIGRANT', weight: 15 },
      previous_abuse: { flag: 'REPEAT_SURVIVOR', weight: 20 },
    };

    let totalWeight = 0;
    Object.entries(vulnerabilityFactors).forEach(([factor, { weight }]) => {
      if (survivorData[factor]) {
        vulnerabilityScore += weight;
        totalWeight += weight;
      }
    });

    vulnerabilityScore = Math.min(100, vulnerabilityScore);

    return {
      name: 'survivor_vulnerability',
      weight: 0.15,
      value: vulnerabilityScore,
      contribution: vulnerabilityScore,
      flag: totalWeight > 0 ? 'HIGH_VULNERABILITY' : undefined,
    };
  }

  /**
   * Assess temporal patterns
   */
  private assessTemporalPattern(reportedAt: Date): RiskFactor {
    const now = new Date();
    const hoursSinceIncident = (now.getTime() - new Date(reportedAt).getTime()) / (1000 * 60 * 60);
    const dayOfWeek = new Date(reportedAt).getDay();
    const hour = new Date(reportedAt).getHours();

    let score = 30; // Baseline

    // Recent incidents are higher risk
    if (hoursSinceIncident < 1) score = 80;
    else if (hoursSinceIncident < 6) score = 60;
    else if (hoursSinceIncident < 24) score = 40;

    // Night time increases risk
    if (hour >= 20 || hour <= 6) score = Math.max(score, 50);

    // Weekend incidents slightly higher risk
    if ([5, 6].includes(dayOfWeek)) score = Math.max(score, 45);

    return {
      name: 'temporal_pattern',
      weight: 0.05,
      value: score,
      contribution: score,
    };
  }

  /**
   * Check for algorithmic bias
   */
  private checkForBias(
    factors: RiskFactor[],
    caseData: RiskCaseData
  ): { detected: boolean; flag?: string } {
    // Bias check 1: Ensure location risk isn't unfairly penalizing certain regions
    const locationFactor = factors.find((f) => f.name === 'location_risk');
    if (locationFactor && locationFactor.contribution > 80 && !factors.some((f) => f.contribution > 60)) {
      return {
        detected: true,
        flag: 'LOCATION_BIAS: Risk inflated by region alone',
      };
    }

    // Bias check 2: Ensure repeat offender logic isn't over-weighted
    const repeatFactor = factors.find((f) => f.name === 'repeat_offender');
    if (repeatFactor && repeatFactor.contribution > 80 && !factors.some((f) => f.contribution > 70)) {
      return {
        detected: true,
        flag: 'REPEAT_OFFENDER_BIAS: Overweighting prior history',
      };
    }

    // Bias check 3: Ensure demographic characteristics aren't driving risk
    if (caseData.survivorData?.race || caseData.survivorData?.ethnicity) {
      return {
        detected: true,
        flag: 'DEMOGRAPHIC_DATA_PRESENT: Ensure not used in scoring',
      };
    }

    return { detected: false };
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private calculateConfidence(factors: RiskFactor[]): number {
    // Confidence based on number of contributing factors
    const contributingFactors = factors.filter((f) => f.contribution > 0).length;
    const baseConfidence = (contributingFactors / factors.length) * 100;

    // Increase confidence if multiple strong factors
    const strongFactors = factors.filter((f) => f.contribution > 60).length;
    return Math.round(baseConfidence + strongFactors * 5);
  }

  private generateRecommendation(
    riskLevel: string,
    _factors: RiskFactor[]
  ): string {
    switch (riskLevel) {
      case 'critical':
        return 'IMMEDIATE emergency escalation required. Contact police immediately.';
      case 'high':
        return 'Escalate to police and emergency services. Priority counselor assignment.';
      case 'medium':
        return 'Standard case processing. Schedule counselor assessment within 24 hours.';
      case 'low':
      default:
        return 'Standard case processing. Schedule assessment within 48-72 hours.';
    }
  }

  private generateExplainabilityDetails(factors: RiskFactor[], score: number) {
    const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);
    const topContributors = sorted.slice(0, 3).map((factor) => ({
      factor: factor.name,
      contribution: factor.contribution,
      percent: Math.round((factor.contribution / Math.max(1, score)) * 100),
    }));

    const severityFlag = factors.find((f) => f.name === 'severity_assessment')?.flag || '';
    const modelPath = severityFlag.includes('EDGE')
      ? 'Edge Inference (Xenova/heuristic fallback)'
      : severityFlag.includes('ML_MODEL')
        ? 'HuggingFace API + keyword fusion'
        : 'Keyword-only fallback';

    const summary = topContributors
      .map((c, idx) => `${idx + 1}. ${c.factor.replace(/_/g, ' ')} (${c.contribution}/100)`)
      .join(' | ');

    return {
      topContributors,
      modelPath,
      summary,
    };
  }

  private generateExplanation(factors: RiskFactor[], score: number): string {
    const details = this.generateExplainabilityDetails(factors, score);

    const explanation = `
Risk Score: ${score}/100

Model Path:
- ${details.modelPath}

Top contributing factors:
${details.topContributors.map((f) => `- ${f.factor}: ${f.contribution}/100`).join('\n')}

This assessment is based on:
1. Incident severity (keywords and violence indicators)
2. Geographic crime patterns and regional risk
3. Repeat offender history
4. Survivor vulnerability factors
5. Temporal incident patterns

Confidence: ${this.calculateConfidence(factors)}%
    `.trim();

    return explanation;
  }
}

export default RiskScoringEngine;
