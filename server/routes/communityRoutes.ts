/**
 * AEGIS Community Reporting Routes
 * server/routes/communityRoutes.ts
 *
 * Public, account-free reporting for community members and witnesses:
 *   POST /api/community/report      — file a report on behalf of a victim, a
 *                                     witness statement, or a safety concern
 *   GET  /api/community/report/:ref — track a submitted report by reference
 *
 * Both are unauthenticated and rate-limited (anti-spam) and use the service-
 * role Supabase client. Reports land in case_reports with
 * report_method = 'community_web' and are always anonymous to the platform
 * (reported_by NULL); responders see them via the responders_read_community_
 * reports RLS policy (migration 20260614150000).
 */

import express, { Router, Request, Response, NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { fanOut } from "../notifications/fanout";

const RELATIONSHIP_LABEL: Record<string, string> = {
  on_behalf: "Report on behalf of someone",
  witness: "Witness statement",
  concern: "Community safety concern",
};

type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

const RELATIONSHIPS = new Set(["on_behalf", "witness", "concern"]);
const MAX_DESCRIPTION = 5000;

/** Human-friendly, unguessable reference, e.g. CR-7Q2K9F4M. */
function generateReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  const bytes = crypto.randomBytes(8);
  let ref = "";
  for (let i = 0; i < 8; i += 1) ref += alphabet[bytes[i] % alphabet.length];
  return `CR-${ref}`;
}

export function createCommunityRoutes(
  supabase: SupabaseClient,
  submitLimiter: Middleware,
  statusLimiter: Middleware,
): Router {
  const router = Router();
  const jsonParser = express.json({ limit: "64kb" });

  router.post(
    "/report",
    submitLimiter,
    jsonParser,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const description = String(body.description ?? "").trim();
        const relationship = String(body.relationship ?? "").trim();
        const category = body.category
          ? String(body.category).slice(0, 80)
          : null;
        const language = body.language
          ? String(body.language).slice(0, 8)
          : null;
        const locationText = body.location
          ? String(body.location).slice(0, 300)
          : null;

        if (description.length < 10 || description.length > MAX_DESCRIPTION) {
          res.status(400).json({ error: "invalid_description" });
          return;
        }
        if (!RELATIONSHIPS.has(relationship)) {
          res.status(400).json({ error: "invalid_relationship" });
          return;
        }

        // Concerns are informational; on-behalf/witness reports are treated as
        // real incidents needing triage.
        const priority = relationship === "concern" ? "low" : "medium";

        // Retry on the (rare) reference collision against the unique index.
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const reference = generateReference();
          const { error } = await supabase.from("case_reports").insert({
            description,
            report_method: "community_web",
            reporter_relationship: relationship,
            category,
            language,
            is_anonymous: true,
            reported_by: null,
            location: locationText ? { address: locationText } : null,
            status: "submitted",
            risk_level: "medium",
            priority,
            public_reference: reference,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (!error) {
            // Unified fan-out: always surface in-app; push to responders for
            // real incidents (on_behalf/witness), in-app only for concerns.
            const label =
              RELATIONSHIP_LABEL[relationship] ?? "Community report";
            await fanOut(supabase, {
              eventType: "community_report",
              title: "New community report",
              message: `${label} (${reference})${locationText ? ` · ${locationText}` : ""}: ${description.slice(0, 160)}`,
              severity: relationship === "concern" ? "low" : "medium",
              module: "police",
              caseId: reference,
              channels: {
                inApp: true,
                pushResponders: relationship !== "concern",
              },
            }).catch(() => undefined);

            res.status(201).json({ reference });
            return;
          }
          // 23505 = unique_violation on public_reference; regenerate and retry.
          if ((error as { code?: string }).code !== "23505") {
            lastError = error;
            break;
          }
          lastError = error;
        }

        console.error("Community report insert failed:", lastError);
        res.status(500).json({ error: "report_failed" });
      } catch (error) {
        console.error("Community report error:", error);
        res.status(500).json({ error: "report_failed" });
      }
    },
  );

  router.get(
    "/report/:reference",
    statusLimiter,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const reference = String(req.params.reference ?? "")
          .toUpperCase()
          .slice(0, 16);
        if (!/^CR-[A-Z0-9]{8}$/.test(reference)) {
          res.status(400).json({ error: "invalid_reference" });
          return;
        }

        const { data, error } = await supabase
          .from("case_reports")
          .select("public_reference,status,category,created_at,updated_at")
          .eq("public_reference", reference)
          .eq("report_method", "community_web")
          .maybeSingle();

        if (error || !data) {
          res.status(404).json({ error: "not_found" });
          return;
        }

        res.json({
          reference: data.public_reference,
          status: data.status,
          category: data.category,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } catch (error) {
        console.error("Community report lookup error:", error);
        res.status(500).json({ error: "lookup_failed" });
      }
    },
  );

  return router;
}

export default createCommunityRoutes;
