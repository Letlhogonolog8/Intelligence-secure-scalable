import { supabase } from "@/lib/supabase";

/**
 * Responder actions on escalation events (Emergency Queue + Survivor Safety).
 * These persist to `escalation_events` so a dispatch/escalate/acknowledge by
 * one officer streams to every responder via the table's realtime publication
 * and survives a refresh — the difference between "looks live" and "is live".
 *
 * RLS `responders_update_escalations` (migration 20260608120000) allows
 * police/counselor/ngo/chw/admin to update these rows.
 */

export const ESCALATION_EVENTS_KEY = ["aegis", "escalationEvents"] as const;

export async function updateEscalationEvent(
  id: string,
  patch: {
    status?: string;
    acknowledgedBy?: string | null;
    acknowledgedAt?: string | null;
    resolvedAt?: string | null;
  },
): Promise<void> {
  const row: {
    status?: string;
    acknowledged_by?: string | null;
    acknowledged_at?: string | null;
    resolved_at?: string | null;
  } = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.acknowledgedBy !== undefined)
    row.acknowledged_by = patch.acknowledgedBy;
  if (patch.acknowledgedAt !== undefined)
    row.acknowledged_at = patch.acknowledgedAt;
  if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;

  const { error } = await supabase
    .from("escalation_events")
    .update(row)
    .eq("id", id);
  if (error) throw error;
}

/** Acknowledge a survivor-safety escalation (stamps who/when). */
export const acknowledgeEscalation = (id: string, userId: string) =>
  updateEscalationEvent(id, {
    status: "acknowledged",
    acknowledgedBy: userId,
    acknowledgedAt: new Date().toISOString(),
  });

/** Dispatch a unit to a queued incident (the acting officer becomes owner). */
export const dispatchEscalation = (id: string, userId: string) =>
  updateEscalationEvent(id, { status: "dispatched", acknowledgedBy: userId });

/** Escalate a queued incident for senior review. */
export const escalateEscalation = (id: string) =>
  updateEscalationEvent(id, { status: "escalated" });

/** Delete a single escalation (police/admin only, per RLS). */
export async function deleteEscalation(id: string): Promise<void> {
  const { error } = await supabase
    .from("escalation_events")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Clear old queue data: delete every escalation the caller is permitted to
 * remove, plus the SOS/alerts history. Used by the "Clear queue" cleanup.
 */
export async function clearQueueData(): Promise<void> {
  const escalations = await supabase
    .from("escalation_events")
    .delete()
    .not("id", "is", null);
  if (escalations.error) throw escalations.error;
  // Alerts feed is best-effort — don't fail cleanup if it's already empty.
  await supabase.from("alerts_feed").delete().not("id", "is", null);
}
