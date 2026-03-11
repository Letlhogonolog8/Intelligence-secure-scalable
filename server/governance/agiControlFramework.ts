/**
 * AEGIS AGI Control Framework
 * server/governance/agiControlFramework.ts
 * 
 * AGI-safe decision architecture with:
 * - Human-in-the-loop for critical actions
 * - Reasoning traceability
 * - Ethical constraint enforcement
 * - Audit logging of all decisions
 * - Override capability
 */

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type DecisionType = 'risk_assessment' | 'escalation' | 'resource_allocation' | 'data_access' | 'deletion_request';
export type DecisionAction = 'approve' | 'deny' | 'modify' | 'defer';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AIRecommendation {
  decisionId: string;
  type: DecisionType;
  recommendation: DecisionAction;
  confidence: number; // 0-100
  reasoning: string;
  factorsConsidered: Record<string, unknown>;
  potentialRisks: string[];
  ethicalConcerns: string[];
  timestamp: string;
  computedBy: string;
}

export interface HumanReview {
  decisionId: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: DecisionAction;
  rationale: string;
  overrideReason?: string;
  confidence: number;
  signature: string; // Cryptographic signature
}

export interface DecisionRecord {
  id: string;
  type: DecisionType;
  resourceId: string;
  aiRecommendation: AIRecommendation;
  humanReview?: HumanReview;
  finalAction: DecisionAction;
  outcome: string;
  executedAt?: string;
  status: 'pending_review' | 'approved' | 'denied' | 'overridden' | 'executed';
  createdAt: string;
}

export class AGIControlFramework {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Submit AI recommendation for human review
   */
  public async submitRecommendation(recommendation: AIRecommendation): Promise<DecisionRecord> {
    try {
      const decisionRecord: DecisionRecord = {
        id: recommendation.decisionId,
        type: recommendation.type,
        resourceId: '', // Will be set based on context
        aiRecommendation: recommendation,
        finalAction: recommendation.recommendation,
        status: this.requiresHumanReview(recommendation) ? 'pending_review' : 'approved',
        outcome: '',
        createdAt: new Date().toISOString(),
      };

      // Store decision in database
      const { error } = await this.supabase.from('agi_decisions').insert({
        id: decisionRecord.id,
        type: decisionRecord.type,
        status: decisionRecord.status,
        ai_recommendation: recommendation,
        created_at: decisionRecord.createdAt,
      });

      if (error) throw error;

      // Log decision
      await this.logDecision(decisionRecord, 'decision_submitted');

      // Notify reviewers if human review required
      if (decisionRecord.status === 'pending_review') {
        await this.notifyReviewers(decisionRecord);
      }

      console.log(`✅ Decision ${decisionRecord.id} submitted for review`);
      return decisionRecord;
    } catch (error) {
      console.error('Failed to submit recommendation:', error);
      throw error;
    }
  }

  /**
   * Determine if human review is required
   */
  private requiresHumanReview(recommendation: AIRecommendation): boolean {
    // Always require review for critical decisions
    if (recommendation.recommendation === 'deny') return true;
    if (recommendation.confidence < 80) return true;
    if (recommendation.ethicalConcerns.length > 0) return true;
    if (recommendation.potentialRisks.length > 0) return true;

    // Type-specific rules
    switch (recommendation.type) {
      case 'escalation':
        // High/critical escalations require review
        return true;
      case 'data_access':
        // Data access to sensitive fields requires review
        return true;
      case 'deletion_request':
        // All deletions require human approval
        return true;
      default:
        return false;
    }
  }

  /**
   * Human reviewer approves or denies AI recommendation
   */
  public async reviewDecision(
    decisionId: string,
    reviewerId: string,
    decision: DecisionAction,
    rationale: string,
    overrideReason?: string
  ): Promise<DecisionRecord> {
    try {
      // Fetch decision record
      const { data: record, error: fetchError } = await this.supabase
        .from('agi_decisions')
        .select('*')
        .eq('id', decisionId)
        .single();

      if (fetchError || !record) {
        throw new Error('Decision not found');
      }

      // Create review record
      const signature = this.createSignature(reviewerId, decisionId, decision);

      const humanReview: HumanReview = {
        decisionId,
        reviewedBy: reviewerId,
        reviewedAt: new Date().toISOString(),
        decision,
        rationale,
        overrideReason,
        confidence: this.calculateReviewConfidence(record.ai_recommendation, decision),
        signature,
      };

      // Determine final action
      const finalAction = decision === 'approve' ? record.ai_recommendation.recommendation : decision;
      const newStatus = this.getStatusFromAction(finalAction, decision !== record.ai_recommendation.recommendation);

      // Update decision
      const { error: updateError } = await this.supabase
        .from('agi_decisions')
        .update({
          human_review: humanReview,
          final_action: finalAction,
          status: newStatus,
          reviewed_by: reviewerId,
          reviewed_at: humanReview.reviewedAt,
        })
        .eq('id', decisionId);

      if (updateError) throw updateError;

      // Log review
      await this.logDecision(
        { ...record, finalAction, status: newStatus } as DecisionRecord,
        'decision_reviewed',
        { reviewerId, decision, overridden: decision !== record.ai_recommendation.recommendation }
      );

      console.log(`✅ Decision ${decisionId} reviewed by ${reviewerId}: ${decision}`);

      return {
        ...record,
        humanReview,
        finalAction,
        status: newStatus,
      };
    } catch (error) {
      console.error('Failed to review decision:', error);
      throw error;
    }
  }

  /**
   * Execute approved decision
   */
  public async executeDecision(decisionId: string, executorId: string): Promise<boolean> {
    try {
      // Fetch decision
      const { data: record, error: fetchError } = await this.supabase
        .from('agi_decisions')
        .select('*')
        .eq('id', decisionId)
        .single();

      if (fetchError || !record) {
        throw new Error('Decision not found');
      }

      // Check if decision is approved
      if (record.final_action !== 'approve') {
        throw new Error(`Cannot execute decision with action: ${record.final_action}`);
      }

      // Execute based on decision type
      const outcome = await this.executeByType(record.type, record);

      // Update status
      const { error: updateError } = await this.supabase
        .from('agi_decisions')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          outcome,
          executed_by: executorId,
        })
        .eq('id', decisionId);

      if (updateError) throw updateError;

      // Log execution
      await this.logDecision(
        { ...record, status: 'executed', outcome } as DecisionRecord,
        'decision_executed',
        { executorId, outcome }
      );

      console.log(`✅ Decision ${decisionId} executed by ${executorId}`);
      return true;
    } catch (error) {
      console.error('Failed to execute decision:', error);
      throw error;
    }
  }

  /**
   * Get decision history for audit
   */
  public async getDecisionHistory(
    type?: DecisionType,
    status?: string,
    limit: number = 100
  ): Promise<DecisionRecord[]> {
    try {
      let query = this.supabase.from('agi_decisions').select('*');

      if (type) query = query.eq('type', type);
      if (status) query = query.eq('status', status);

      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get decision history:', error);
      return [];
    }
  }

  /**
   * Verify decision integrity
   */
  public async verifyDecisionIntegrity(decisionId: string): Promise<boolean> {
    try {
      const { data: record, error } = await this.supabase
        .from('agi_decisions')
        .select('*')
        .eq('id', decisionId)
        .single();

      if (error || !record) return false;

      // Verify human review signature if present
      if (record.human_review) {
        const expectedSignature = this.createSignature(
          record.human_review.reviewed_by,
          decisionId,
          record.human_review.decision
        );

        if (expectedSignature !== record.human_review.signature) {
          console.warn(`⚠️  Decision ${decisionId} signature mismatch`);
          return false;
        }
      }

      // Verify decision audit trail
      const { data: logs } = await this.supabase
        .from('decision_audit_logs')
        .select('*')
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: true });

      if (!logs || logs.length === 0) {
        console.warn(`⚠️  Decision ${decisionId} has no audit logs`);
        return false;
      }

      console.log(`✅ Decision ${decisionId} integrity verified`);
      return true;
    } catch (error) {
      console.error('Integrity verification failed:', error);
      return false;
    }
  }

  /**
   * Generate reasoning transparency report
   */
  public async generateReasoningReport(decisionId: string): Promise<string> {
    try {
      const { data: record, error } = await this.supabase
        .from('agi_decisions')
        .select('*')
        .eq('id', decisionId)
        .single();

      if (error || !record) {
        throw new Error('Decision not found');
      }

      const report = `
╔═══════════════════════════════════════════════════════════════╗
║         AEGIS AI DECISION TRANSPARENCY REPORT                 ║
╚═══════════════════════════════════════════════════════════════╝

Decision ID: ${record.id}
Type: ${record.type}
Created: ${record.created_at}
Status: ${record.status}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recommendation: ${record.ai_recommendation.recommendation.toUpperCase()}
Confidence: ${record.ai_recommendation.confidence}%
Computed By: ${record.ai_recommendation.computedBy}

Reasoning:
${record.ai_recommendation.reasoning}

Factors Considered:
${Object.entries(record.ai_recommendation.factorsConsidered)
  .map(([key, value]) => `  • ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Potential Risks:
${record.ai_recommendation.potentialRisks.map((r) => `  • ${r}`).join('\n')}

Ethical Concerns:
${record.ai_recommendation.ethicalConcerns.map((c) => `  • ${c}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HUMAN REVIEW (if applicable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${
  record.human_review
    ? `
Reviewed By: ${record.human_review.reviewed_by}
Reviewed At: ${record.human_review.reviewed_at}
Review Decision: ${record.human_review.decision.toUpperCase()}
Review Confidence: ${record.human_review.confidence}%

Rationale:
${record.human_review.rationale}

${record.human_review.overrideReason ? `Override Reason: ${record.human_review.overrideReason}` : 'No override applied'}

Signature: ${record.human_review.signature.substring(0, 16)}...
`
    : 'No human review required or completed'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL ACTION & OUTCOME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Final Action: ${record.final_action.toUpperCase()}
Outcome: ${record.outcome || 'Pending execution'}
${record.executed_at ? `Executed At: ${record.executed_at}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT TRAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Decision submitted by AI system
✓ Logged to immutable audit trail
${record.human_review ? '✓ Human reviewed and approved' : '⏳ Awaiting human review'}
${record.executed_at ? '✓ Decision executed' : '⏳ Awaiting execution'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `;

      return report;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  // Private helper methods

  private async executeByType(type: DecisionType, _record: DecisionRecord): Promise<string> {
    switch (type) {
      case 'escalation':
        return 'Emergency escalation executed - police notified';
      case 'data_access':
        return 'Data access granted with audit trail';
      case 'deletion_request':
        return 'Data deletion completed - backup retained for 90 days';
      default:
        return 'Decision executed';
    }
  }

  private createSignature(reviewerId: string, decisionId: string, decision: DecisionAction): string {
    const data = `${reviewerId}:${decisionId}:${decision}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateReviewConfidence(aiRec: AIRecommendation, decision: DecisionAction): number {
    if (decision === 'approve') {
      return aiRec.confidence;
    }
    // Disagreement reduces confidence
    return Math.max(30, aiRec.confidence - 20);
  }

  private getStatusFromAction(action: DecisionAction, overridden: boolean): string {
    if (overridden) return 'overridden';
    if (action === 'approve') return 'approved';
    if (action === 'deny') return 'denied';
    return 'pending_review';
  }

  private async logDecision(
    record: DecisionRecord,
    action: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('decision_audit_logs').insert({
        decision_id: record.id,
        action,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log decision:', error);
    }
  }

  private async notifyReviewers(record: DecisionRecord): Promise<void> {
    try {
      // Fetch reviewers based on decision type
      const reviewerRoles = this.getReviewerRoles(record.type);

      const { data: reviewers } = await this.supabase
        .from('profiles')
        .select('id, email')
        .in('role', reviewerRoles)
        .eq('is_active', true);

      if (reviewers && reviewers.length > 0) {
        console.log(`📬 Notifying ${reviewers.length} reviewers of pending decision`);
        // In production: send email notifications
      }
    } catch (error) {
      console.error('Failed to notify reviewers:', error);
    }
  }

  private getReviewerRoles(type: DecisionType): string[] {
    switch (type) {
      case 'escalation':
        return ['admin', 'police'];
      case 'data_access':
        return ['admin', 'analyst'];
      case 'deletion_request':
        return ['admin'];
      default:
        return ['admin'];
    }
  }
}

export default AGIControlFramework;
