import { supabase } from "@/lib/supabase";

export type CaseReportPayload = Record<string, unknown> & {
  report_method?: string | null;
  reporter_relationship?: string | null;
  public_reference?: string | null;
  risk_level?: string | null;
  priority?: string | null;
  category?: string | null;
  location?: unknown;
};

// Same alphabet/format the web server uses (server/routes/communityRoutes.ts)
// so community references are consistent across web and mobile: CR-XXXXXXXX,
// no ambiguous 0/O/1/I characters.
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly, unguessable community-report tracking reference. */
export function generatePublicReference(): string {
  let ref = "";
  for (let i = 0; i < 8; i += 1) {
    ref +=
      REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return `CR-${ref}`;
}

const severityFor = (payload: CaseReportPayload) => {
  const raw = String(
    payload.risk_level ?? payload.priority ?? "medium",
  ).toLowerCase();
  if (["critical", "high", "medium", "low"].includes(raw)) return raw;
  return "medium";
};

const escalationTypeFor = (payload: CaseReportPayload) =>
  payload.report_method === "community_mobile"
    ? "community_mobile_report"
    : "mobile_incident_report";

export async function submitCaseReportWithEscalation(
  payload: CaseReportPayload,
) {
  const { data, error } = await supabase
    .from("case_reports")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  const caseId = (data as { id?: string } | null)?.id;
  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult.user?.id;

  // Anonymous reports rely on the database trigger for escalation so the app
  // does not attach the reporter's user id to the escalation row.
  if (caseId && userId && payload.reported_by) {
    const { data: existingEscalation } = await supabase
      .from("escalation_events")
      .select("id")
      .eq("case_id", caseId)
      .maybeSingle();

    if (existingEscalation) return { id: caseId };

    await supabase.from("escalation_events").insert({
      case_id: caseId,
      user_id: userId,
      escalation_type: escalationTypeFor(payload),
      severity: severityFor(payload),
      reason: `Mobile report submitted${
        payload.reporter_relationship
          ? ` (${payload.reporter_relationship})`
          : ""
      }`,
      location: payload.location ?? null,
      status: "triggered",
      triggered_at: new Date().toISOString(),
      metadata: {
        report_method: payload.report_method ?? "in_app",
        reporter_relationship: payload.reporter_relationship ?? null,
        category: payload.category ?? null,
        priority: payload.priority ?? null,
      },
    });
  }

  return { id: caseId };
}
