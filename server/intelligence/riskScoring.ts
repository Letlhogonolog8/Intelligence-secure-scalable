/**
 * AEGIS Synthetic Risk Scoring Engine
 * server/intelligence/riskScoring.ts
 * 
 * AI-powered risk assessment combining:
 * - NLP severity analysis
 * - Location risk scoring
 * - Temporal patterns
 * - Repeat offender detection
 * - Survivor vulnerability assessment
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  confidence: number; // 0-100
  factors: RiskFactor[];
  recommendation: string;
  biasDetected: boolean;
  biasFlag?: string;
  explainability: string;
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
  public async assessCaseRisk(caseId: string, caseData: any): Promise<RiskAssessment> {
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
    const temporalFactor = this.assessTemporalPattern(caseData.reportedAt || new Date());
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

    // Generate explanation
    const explainability = this.generateExplanation(factors, riskScore);

    return {
      riskLevel,
      riskScore,
      confidence: this.calculateConfidence(factors),
      factors,
      recommendation: this.generateRecommendation(riskLevel, factors),
      biasDetected: biasCheck.detected,
      biasFlag: biasCheck.flag,
      explainability,
    };
  }

  /**
   * Assess severity using NLP keyword matching and sentiment analysis
   */
  private async assessSeverity(description: string): Promise<RiskFactor> {
    const criticalKeywords = [
      'death threat',
      'kill',
      'murder',
      'severe injury',
      'weapon',
      'firearm',
      'knife',
      'poison',
    ];

    const highKeywords = [
      'assault',
      'attack',
      'rape',
      'sexual abuse',
      'serious injury',
      'hospitalized',
      'emergency room',
    ];

    const mediumKeywords = ['violence', 'hit', 'punch', 'injury', 'threat', 'harassment'];

    let severityScore = 0;
    const lowerDesc = description.toLowerCase();

    criticalKeywords.forEach((keyword) => {
      if (lowerDesc.includes(keyword)) severityScore = Math.max(severityScore, 95);
    });

    if (severityScore === 0) {
      highKeywords.forEach((keyword) => {
        if (lowerDesc.includes(keyword)) severityScore = Math.max(severityScore, 70);
      });
    }

    if (severityScore === 0) {
      mediumKeywords.forEach((keyword) => {
        if (lowerDesc.includes(keyword)) severityScore = Math.max(severityScore, 40);
      });
    }

    if (severityScore === 0) {
      severityScore = 20; // Default low severity
    }

    return {
      name: 'severity_assessment',
      weight: 0.35,
      value: severityScore,
      contribution: severityScore,
    };
  }

  /**
   * Assess risk based on location crime patterns
   */
  private async assessLocationRisk(region: string, lat?: number, lng?: number): Promise<RiskFactor> {
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
  private async assessSurvivorVulnerability(survivorData: any): Promise<RiskFactor> {
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
    caseData: any
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
    factors: RiskFactor[]
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

  private generateExplanation(factors: RiskFactor[], score: number): string {
    const topFactors = factors.sort((a, b) => b.contribution - a.contribution).slice(0, 3);

    const explanation = `
Risk Score: ${score}/100

Top contributing factors:
${topFactors.map((f) => `- ${f.name}: ${f.contribution}/100`).join('\n')}

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
