/**
 * AGI Governance API Routes
 * server/routes/agiGovernanceRoutes.ts
 * 
 * Endpoints for:
 * - AI decision submission and review
 * - Decision approval workflow
 * - Reasoning transparency
 * - Audit trails
 */

import { Router, Request, Response } from 'express';
import { AGIControlFramework, AIRecommendation, DecisionAction, DecisionType } from '../governance/agiControlFramework';

export function createAGIGovernanceRoutes(agiFramework: AGIControlFramework): Router {
  const router = Router();

  /**
   * POST /api/governance/submit-recommendation
   * Submit AI recommendation for human review
   */
  router.post('/submit-recommendation', async (req: Request, res: Response) => {
    try {
      const recommendation: AIRecommendation = req.body;

      const decision = await agiFramework.submitRecommendation(recommendation);

      res.json({
        success: true,
        decisionId: decision.id,
        status: decision.status,
        requiresReview: decision.status === 'pending_review',
      });
    } catch (error) {
      console.error('Error submitting recommendation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit recommendation',
      });
    }
  });

  /**
   * POST /api/governance/review-decision
   * Human reviewer approves or denies AI recommendation
   */
  router.post('/review-decision', async (req: Request, res: Response) => {
    try {
      const { decisionId, reviewerId, decision, rationale, overrideReason } = req.body;

      if (!decisionId || !reviewerId || !decision) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: decisionId, reviewerId, decision',
        });
      }

      const result = await agiFramework.reviewDecision(
        decisionId,
        reviewerId,
        decision as DecisionAction,
        rationale,
        overrideReason
      );

      res.json({
        success: true,
        decision: result,
      });
    } catch (error) {
      console.error('Error reviewing decision:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to review decision',
      });
    }
  });

  /**
   * POST /api/governance/execute-decision
   * Execute approved decision
   */
  router.post('/execute-decision', async (req: Request, res: Response) => {
    try {
      const { decisionId, executorId } = req.body;

      if (!decisionId || !executorId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: decisionId, executorId',
        });
      }

      const success = await agiFramework.executeDecision(decisionId, executorId);

      res.json({
        success,
        message: success ? 'Decision executed successfully' : 'Failed to execute decision',
      });
    } catch (error) {
      console.error('Error executing decision:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute decision',
      });
    }
  });

  /**
   * GET /api/governance/decision/:decisionId
   * Get decision details and reasoning
   */
  router.get('/decision/:decisionId', async (req: Request, res: Response) => {
    try {
      const { decisionId } = req.params;

      const history = await agiFramework.getDecisionHistory(undefined, undefined, 1);
      const decision = history.find((d) => d.id === decisionId);

      if (!decision) {
        return res.status(404).json({
          success: false,
          error: 'Decision not found',
        });
      }

      res.json({
        success: true,
        decision,
      });
    } catch (error) {
      console.error('Error fetching decision:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch decision',
      });
    }
  });

  /**
   * GET /api/governance/reasoning-report/:decisionId
   * Generate transparency report for decision
   */
  router.get('/reasoning-report/:decisionId', async (req: Request, res: Response) => {
    try {
      const { decisionId } = req.params;

      const report = await agiFramework.generateReasoningReport(decisionId);

      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
      });
    }
  });

  /**
   * GET /api/governance/decisions
   * Get decision history with filtering
   */
  router.get('/decisions', async (req: Request, res: Response) => {
    try {
      const { type, status, limit = 100 } = req.query;

      const decisionType = typeof type === 'string' ? (type as DecisionType) : undefined;
      const decisions = await agiFramework.getDecisionHistory(
        decisionType,
        status as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        count: decisions.length,
        decisions,
      });
    } catch (error) {
      console.error('Error fetching decisions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch decisions',
      });
    }
  });

  /**
   * POST /api/governance/verify-integrity/:decisionId
   * Verify decision integrity
   */
  router.post('/verify-integrity/:decisionId', async (req: Request, res: Response) => {
    try {
      const { decisionId } = req.params;

      const isValid = await agiFramework.verifyDecisionIntegrity(decisionId);

      res.json({
        success: true,
        valid: isValid,
        decision: decisionId,
      });
    } catch (error) {
      console.error('Error verifying integrity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify integrity',
      });
    }
  });

  /**
   * GET /api/governance/pending-reviews
   * Get pending decisions awaiting human review
   */
  router.get('/pending-reviews', async (req: Request, res: Response) => {
    try {
      const decisions = await agiFramework.getDecisionHistory(undefined, 'pending_review', 50);

      res.json({
        success: true,
        count: decisions.length,
        decisions,
      });
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending reviews',
      });
    }
  });

  /**
   * POST /api/governance/bulk-review
   * Admin bulk approve/deny multiple decisions
   */
  router.post('/bulk-review', async (req: Request, res: Response) => {
    try {
      const { decisions, reviewerId, action, rationale } = req.body;

      if (!Array.isArray(decisions) || !reviewerId || !action) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request format',
        });
      }

      const results: Array<{ decisionId: string; success: boolean; status?: string; error?: string }> = [];

      for (const decisionId of decisions) {
        try {
          const result = await agiFramework.reviewDecision(
            decisionId,
            reviewerId,
            action as DecisionAction,
            rationale
          );
          results.push({ decisionId, success: true, status: result.status });
        } catch (error) {
          results.push({ decisionId, success: false, error: String(error) });
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      res.json({
        success: failed === 0,
        summary: { total: results.length, successful, failed },
        results,
      });
    } catch (error) {
      console.error('Error in bulk review:', error);
      res.status(500).json({
        success: false,
        error: 'Bulk review failed',
      });
    }
  });

  return router;
}

export default createAGIGovernanceRoutes;
