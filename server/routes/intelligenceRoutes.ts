/**
 * AEGIS Intelligence Routes
 * server/routes/intelligenceRoutes.ts
 *
 * API endpoints for Synthetic Intelligence features:
 * - Risk assessment
 * - Geo-matching
 * - Threat prediction
 * - Explainable AI
 */

import { Router, Request, Response, NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { RiskScoringEngine } from "../intelligence/riskScoring";
import { GeoMatchingEngine } from "../intelligence/geoMatching";
import { AuditLogService } from "../security/auditLog";

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role?: string;
    profile?: {
      role?: string;
    };
  };
};

export function createIntelligenceRoutes(
  supabase: SupabaseClient,
  auditLog: AuditLogService,
  // Token-verifying middleware from the app (populates req.user). The local
  // stub this replaced only *checked* req.user, which nothing set on this
  // mount — every route answered 401.
  requireAuth: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): Router {
  const router = Router();
  const riskEngine = new RiskScoringEngine(supabase);
  const geoEngine = new GeoMatchingEngine(supabase);

  const deriveExplainabilityDetails = (
    factors:
      | Array<{ name?: string; contribution?: number; flag?: string }>
      | null
      | undefined,
    riskScore: number,
  ) => {
    const normalizedFactors = Array.isArray(factors) ? factors : [];
    const topContributors = normalizedFactors
      .map((factor) => ({
        factor: factor.name || "unknown_factor",
        contribution: Number(factor.contribution || 0),
      }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((factor) => ({
        ...factor,
        percent: Math.round(
          (factor.contribution / Math.max(1, riskScore)) * 100,
        ),
      }));

    const severityFlag =
      normalizedFactors.find((factor) => factor.name === "severity_assessment")
        ?.flag || "";
    const modelPath = String(severityFlag).includes("EDGE")
      ? "Edge Inference (Xenova/heuristic fallback)"
      : String(severityFlag).includes("ML_MODEL")
        ? "HuggingFace API + keyword fusion"
        : "Keyword fallback";

    return {
      topContributors,
      modelPath,
      summary: topContributors
        .map(
          (factor, index) =>
            `${index + 1}. ${factor.factor} (${factor.contribution}/100)`,
        )
        .join(" | "),
    };
  };

  // ============================================================================
  // RISK ASSESSMENT ENDPOINTS
  // ============================================================================

  /**
   * POST /api/intelligence/risk-score
   * Calculate risk assessment for a case
   */
  router.post(
    "/risk-score",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { caseId, caseData } = req.body;
        const userId = (req as AuthenticatedRequest).user!.id;

        if (!caseId || !caseData) {
          return res.status(400).json({ error: "Missing caseId or caseData" });
        }

        // Fetch full case data if only ID provided
        let fullCaseData = caseData;
        if (typeof caseData === "string") {
          const { data } = await supabase
            .from("case_reports")
            .select("*")
            .eq("id", caseData)
            .single();

          if (!data) {
            return res.status(404).json({ error: "Case not found" });
          }

          fullCaseData = data;
        }

        // Perform risk assessment
        const assessment = await riskEngine.assessCaseRisk(
          caseId,
          fullCaseData,
        );

        // Store assessment in database
        const { error: storeError } = await supabase
          .from("ai_risk_scores")
          .insert({
            case_id: caseId,
            risk_level: assessment.riskLevel,
            risk_score: assessment.riskScore,
            confidence: assessment.confidence,
            factors: assessment.factors,
            bias_detected: assessment.biasDetected,
            bias_flag: assessment.biasFlag,
            explainability: assessment.explainability,
            computed_by: "AI_ENGINE_V1",
          });

        if (storeError) {
          console.error("Failed to store risk score:", storeError);
        }

        // Log the assessment
        await auditLog.log({
          userId,
          action: "risk_assessed",
          module: "intelligence",
          resourceId: caseId,
          resourceType: "case",
          status: "success",
          ipAddress: req.ip || "",
          userAgent: req.headers["user-agent"] || "",
          metadata: {
            riskScore: assessment.riskScore,
            riskLevel: assessment.riskLevel,
            confidence: assessment.confidence,
          },
          timestamp: new Date().toISOString(),
        });

        res.json(assessment);
      } catch (error) {
        console.error("Risk assessment failed:", error);
        res.status(500).json({ error: "Risk assessment failed" });
      }
    },
  );

  /**
   * GET /api/intelligence/risk-score/:caseId
   * Retrieve risk assessment for a case
   */
  router.get(
    "/risk-score/:caseId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { caseId } = req.params;

        const { data: assessments } = await supabase
          .from("ai_risk_scores")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!assessments || assessments.length === 0) {
          return res.status(404).json({ error: "No risk assessment found" });
        }

        const latest = assessments[0];
        res.json({
          ...latest,
          explainability_details:
            latest.explainability_details ||
            deriveExplainabilityDetails(latest.factors, latest.risk_score),
        });
      } catch (error) {
        console.error("Risk score retrieval failed:", error);
        res.status(500).json({ error: "Failed to retrieve risk score" });
      }
    },
  );

  // ============================================================================
  // GEO-MATCHING ENDPOINTS
  // ============================================================================

  /**
   * POST /api/intelligence/geo-match
   * Find optimal resources for a case
   */
  router.post(
    "/geo-match",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { caseId, lat, lng, riskLevel, caseType } = req.body;
        const userId = (req as AuthenticatedRequest).user!.id;

        if (!caseId || lat === undefined || lng === undefined || !riskLevel) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Perform geo-matching
        const assignment = await geoEngine.assignResources(
          caseId,
          lat,
          lng,
          riskLevel,
          caseType,
        );

        // Log the assignment
        await auditLog.log({
          userId,
          action: "geo_match_assigned",
          module: "intelligence",
          resourceId: caseId,
          resourceType: "case",
          status: "success",
          ipAddress: req.ip || "",
          userAgent: req.headers["user-agent"] || "",
          metadata: {
            primaryResource: assignment.primary.resourceId,
            secondaryCount: assignment.secondary.length,
            riskLevel,
          },
          timestamp: new Date().toISOString(),
        });

        res.json(assignment);
      } catch (error) {
        console.error("Geo-matching failed:", error);
        res.status(500).json({ error: "Geo-matching failed" });
      }
    },
  );

  // ============================================================================
  // EXPLAINABILITY ENDPOINTS (XAI)
  // ============================================================================

  /**
   * GET /api/intelligence/explainability/:caseId
   * Get detailed explanation for a risk assessment
   */
  router.get(
    "/explainability/:caseId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { caseId } = req.params;

        const { data: assessment } = await supabase
          .from("ai_risk_scores")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!assessment) {
          return res.status(404).json({ error: "No assessment found" });
        }

        const explanation = {
          caseId,
          riskScore: assessment.risk_score,
          riskLevel: assessment.risk_level,
          confidence: assessment.confidence,
          factors: assessment.factors,
          biasDetected: assessment.bias_detected,
          biasFlag: assessment.bias_flag,
          humanReadableExplanation: assessment.explainability,
          explainabilityDetails: deriveExplainabilityDetails(
            assessment.factors,
            assessment.risk_score,
          ),
          computedAt: assessment.created_at,
          computedBy: assessment.computed_by,
        };

        res.json(explanation);
      } catch (error) {
        console.error("Explainability retrieval failed:", error);
        res.status(500).json({ error: "Failed to retrieve explainability" });
      }
    },
  );

  // ============================================================================
  // BIAS DETECTION ENDPOINTS
  // ============================================================================

  /**
   * GET /api/intelligence/bias-audit
   * Audit system for algorithmic bias
   */
  router.get(
    "/bias-audit",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Only admins can run bias audits
        const user = (req as AuthenticatedRequest).user;
        const userRole = user?.role ?? user?.profile?.role;
        if (userRole !== "admin") {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        const { data: assessments, error } = await supabase
          .from("ai_risk_scores")
          .select("case_id, risk_score, bias_detected, bias_flag")
          .eq("bias_detected", true)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const biasAudit = {
          totalAssessments: assessments?.length || 0,
          biasDetectedCount:
            assessments?.filter((a) => a.bias_detected).length || 0,
          biasPercentage: assessments?.length
            ? (assessments.filter((a) => a.bias_detected).length /
                assessments.length) *
              100
            : 0,
          typesOfBias: [...new Set(assessments?.map((a) => a.bias_flag))],
          samples: assessments?.slice(0, 10),
        };

        res.json(biasAudit);
      } catch (error) {
        console.error("Bias audit failed:", error);
        res.status(500).json({ error: "Bias audit failed" });
      }
    },
  );

  // ============================================================================
  // THREAT PREDICTION ENDPOINTS
  // ============================================================================

  /**
   * GET /api/intelligence/threat-predictions
   * Get threat predictions for a region
   */
  router.get(
    "/threat-predictions",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { region, threatType, limit = 10 } = req.query;

        let query = supabase.from("threat_predictions").select("*");

        if (region) query = query.eq("region_id", region);
        if (threatType) query = query.eq("threat_type", threatType);

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(parseInt(limit as string));

        if (error) throw error;

        res.json(data || []);
      } catch (error) {
        console.error("Threat prediction retrieval failed:", error);
        res
          .status(500)
          .json({ error: "Failed to retrieve threat predictions" });
      }
    },
  );

  // ============================================================================
  // INTELLIGENCE HEALTH CHECK
  // ============================================================================

  /**
   * GET /api/intelligence/health
   * Check intelligence engine status
   */
  router.get("/health", async (_req: Request, res: Response) => {
    res.json({
      status: "operational",
      engines: {
        riskScoring: "ready",
        geoMatching: "ready",
        threatPrediction: "ready",
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

export default createIntelligenceRoutes;
