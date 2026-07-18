/**
 * AEGIS Escalation Routes
 * server/routes/escalationRoutes.ts
 *
 * API endpoints for emergency escalation workflow:
 * - Trigger emergency escalation
 * - Track escalation status
 * - Acknowledge escalations
 * - Resolve escalations
 */

import { Router, Request, Response, NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { EscalationWorkflow } from "../workflows/escalationWorkflow";
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

// Roles allowed to view/work escalations (mirrors the escalation_events RLS).
const RESPONDER_ROLES = [
  "police",
  "counselor",
  "ngo",
  "chw",
  "admin",
  "analyst",
];

function getUserRole(req: Request): string | undefined {
  const user = (req as AuthenticatedRequest).user;
  return (user?.role ?? user?.profile?.role)?.toLowerCase();
}

export function createEscalationRoutes(
  supabase: SupabaseClient,
  escalationWorkflow: EscalationWorkflow,
  auditLog: AuditLogService,
  // Token-verifying middleware from the app (populates req.user). The local
  // stub this replaced only *checked* req.user, which nothing set on this
  // mount — every authenticated route answered 401.
  requireAuth: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
  hotlineLimiter: (req: Request, res: Response, next: NextFunction) => void,
): Router {
  const router = Router();

  // Middleware: restrict to responding roles. These endpoints use the
  // service-role Supabase client (bypasses RLS), so the role check must
  // happen here — otherwise any signed-in survivor could read any
  // escalation, including another survivor's live location.
  const requireResponder = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const role = getUserRole(req);
    if (!role || !RESPONDER_ROLES.includes(role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };

  // ============================================================================
  // EMERGENCY ESCALATION ENDPOINTS
  // ============================================================================

  /**
   * POST /api/escalation/trigger
   * Trigger emergency escalation for a case
   */
  router.post("/trigger", requireAuth, async (req: Request, res: Response) => {
    try {
      const { caseId, reason, lat, lng, survivorName, survivorPhone, type } =
        req.body;
      const userId = (req as AuthenticatedRequest).user!.id;

      if (!caseId) {
        return res.status(400).json({ error: "Missing caseId" });
      }

      // Fetch full case data
      const { data: caseData, error: fetchError } = await supabase
        .from("case_reports")
        .select("*")
        .eq("id", caseId)
        .single();

      if (fetchError || !caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Execute escalation workflow
      const result = await escalationWorkflow.processEscalation({
        caseId,
        caseData: {
          ...caseData,
          lat: lat || caseData.location_lat,
          lng: lng || caseData.location_lng,
          survivorName: survivorName || caseData.survivor_name,
          survivorPhone: survivorPhone || caseData.survivor_phone,
          type: type || caseData.case_type,
          location: caseData.region,
        },
        triggeredBy: userId,
        reason,
      });

      res.status(201).json({
        message: "Emergency escalation triggered",
        escalationId: result.escalationId,
        riskLevel: result.riskAssessment.riskLevel,
        riskScore: result.riskAssessment.riskScore,
        primaryAssignment: result.assignments?.primary || null,
        completionTime: result.completionTime,
      });
    } catch (error) {
      console.error("Escalation trigger failed:", error);
      res.status(500).json({
        error: "Failed to trigger escalation",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/escalation/:escalationId
   * Get escalation status
   */
  router.get(
    "/:escalationId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { escalationId } = req.params;

        const { data: escalation, error } = await supabase
          .from("escalation_events")
          .select("*")
          .eq("id", escalationId)
          .single();

        if (error || !escalation) {
          return res.status(404).json({ error: "Escalation not found" });
        }

        // Responders may view any escalation; a survivor only their own.
        const role = getUserRole(req);
        const userId = (req as AuthenticatedRequest).user!.id;
        const isResponder = Boolean(role && RESPONDER_ROLES.includes(role));
        if (!isResponder && escalation.user_id !== userId) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        res.json({
          escalationId: escalation.id,
          caseId: escalation.case_id,
          status: escalation.status,
          severity: escalation.severity,
          triggeredBy: escalation.triggered_by,
          triggeredAt: escalation.created_at,
          acknowledgedBy: escalation.acknowledged_by,
          acknowledgedAt: escalation.acknowledged_at,
          resolvedAt: escalation.resolved_at,
          metadata: escalation.metadata,
        });
      } catch (error) {
        console.error("Failed to get escalation status:", error);
        res.status(500).json({ error: "Failed to retrieve escalation" });
      }
    },
  );

  /**
   * POST /api/escalation/:escalationId/acknowledge
   * Acknowledge escalation
   */
  router.post(
    "/:escalationId/acknowledge",
    requireAuth,
    requireResponder,
    async (req: Request, res: Response) => {
      try {
        const { escalationId } = req.params;
        const userId = (req as AuthenticatedRequest).user!.id;

        const success = await escalationWorkflow.acknowledgeEscalation(
          escalationId,
          userId,
        );

        if (!success) {
          return res
            .status(400)
            .json({ error: "Failed to acknowledge escalation" });
        }

        // Log action
        await auditLog.log({
          userId,
          action: "escalation_acknowledged",
          module: "escalation",
          resourceId: escalationId,
          resourceType: "escalation_event",
          status: "success",
          ipAddress: req.ip || "",
          userAgent: req.headers["user-agent"] || "",
          timestamp: new Date().toISOString(),
        });

        res.json({ message: "Escalation acknowledged" });
      } catch (error) {
        console.error("Failed to acknowledge escalation:", error);
        res.status(500).json({ error: "Acknowledgment failed" });
      }
    },
  );

  /**
   * POST /api/escalation/:escalationId/resolve
   * Resolve escalation
   */
  router.post(
    "/:escalationId/resolve",
    requireAuth,
    requireResponder,
    async (req: Request, res: Response) => {
      try {
        const { escalationId } = req.params;
        const { resolution } = req.body;
        const userId = (req as AuthenticatedRequest).user!.id;

        if (!resolution) {
          return res.status(400).json({ error: "Resolution reason required" });
        }

        const success = await escalationWorkflow.resolveEscalation(
          escalationId,
          resolution,
          userId,
        );

        if (!success) {
          return res
            .status(400)
            .json({ error: "Failed to resolve escalation" });
        }

        // Log action
        await auditLog.log({
          userId,
          action: "escalation_resolved",
          module: "escalation",
          resourceId: escalationId,
          resourceType: "escalation_event",
          status: "success",
          ipAddress: req.ip || "",
          userAgent: req.headers["user-agent"] || "",
          metadata: { resolution },
          timestamp: new Date().toISOString(),
        });

        res.json({ message: "Escalation resolved" });
      } catch (error) {
        console.error("Failed to resolve escalation:", error);
        res.status(500).json({ error: "Resolution failed" });
      }
    },
  );

  /**
   * GET /api/escalation/case/:caseId
   * Get all escalations for a case
   */
  router.get(
    "/case/:caseId",
    requireAuth,
    requireResponder,
    async (req: Request, res: Response) => {
      try {
        const { caseId } = req.params;

        const { data: escalations, error } = await supabase
          .from("escalation_events")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false });

        if (error) {
          return res
            .status(500)
            .json({ error: "Failed to retrieve escalations" });
        }

        res.json(escalations || []);
      } catch (error) {
        console.error("Failed to get case escalations:", error);
        res.status(500).json({ error: "Failed to retrieve escalations" });
      }
    },
  );

  /**
   * GET /api/escalation/pending
   * Get all pending escalations (for admins/police)
   */
  router.get("/", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { status = "pending", limit = 50 } = req.query;
      const userRole = user?.role ?? user?.profile?.role;

      // Only admins and police can see all escalations
      if (!userRole || !["admin", "police"].includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      let query = supabase.from("escalation_events").select("*");

      if (status) {
        query = query.eq("status", status);
      }

      const { data: escalations, error } = await query
        .order("created_at", { ascending: false })
        .limit(parseInt(limit as string));

      if (error) {
        return res
          .status(500)
          .json({ error: "Failed to retrieve escalations" });
      }

      res.json(escalations || []);
    } catch (error) {
      console.error("Failed to get escalations:", error);
      res.status(500).json({ error: "Failed to retrieve escalations" });
    }
  });

  /**
   * POST /api/escalation/hotline
   * Emergency hotline endpoint (accessible without normal auth; tightly
   * rate-limited because it creates cases and triggers SMS fan-out)
   */
  router.post(
    "/hotline",
    hotlineLimiter,
    async (req: Request, res: Response) => {
      try {
        const { description, location, lat, lng, survivorPhone, threatLevel } =
          req.body;

        if (!description || !location) {
          return res
            .status(400)
            .json({ error: "Description and location required" });
        }

        // Create emergency case
        const { data: newCase, error: caseError } = await supabase
          .from("case_reports")
          .insert({
            description,
            region: location,
            location_lat: lat,
            location_lng: lng,
            survivor_phone: survivorPhone,
            threat_level: threatLevel || "unknown",
            status: "open",
            priority: threatLevel === "critical" ? "critical" : "high",
            created_at: new Date().toISOString(),
          })
          .select("id");

        if (caseError || !newCase) {
          return res.status(500).json({ error: "Failed to create case" });
        }

        const caseId = newCase[0].id;

        // Immediately escalate
        const result = await escalationWorkflow.processEscalation({
          caseId,
          caseData: {
            description,
            region: location,
            lat,
            lng,
            survivorPhone,
            location,
          },
          triggeredBy: "HOTLINE_SYSTEM",
          reason: "Emergency hotline call",
        });

        res.status(201).json({
          message: "Emergency case created and escalated",
          caseId,
          escalationId: result.escalationId,
          primaryResource: result.assignments?.primary.resourceName || null,
          estimatedResponseMinutes:
            result.assignments?.primary.estimatedResponseMinutes || null,
        });
      } catch (error) {
        console.error("Hotline escalation failed:", error);
        res.status(500).json({ error: "Emergency hotline processing failed" });
      }
    },
  );

  return router;
}

export default createEscalationRoutes;
