import { supabase } from "@/lib/supabase";

/**
 * Multi-agency coordination — cross-org case handoffs.
 *
 * Listing is the existing realtime useOrganizationCoordination hook
 * (organization_coordination is in the realtime publication). These helpers add
 * the write side: a responder refers a case from their org to another, and
 * either party advances the status. RLS (migration 20260614173000) enforces
 * that the actor belongs to a party organisation.
 */

export type HandoffStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "declined";

export const HANDOFF_REFERRAL_TYPES = [
  "shelter",
  "legal",
  "medical",
  "counseling",
  "police",
  "financial",
  "safety_planning",
  "other",
] as const;

export interface CreateHandoffInput {
  fromOrganizationId: string;
  toOrganizationId: string;
  caseId: string;
  referralType: string;
  notes?: string | null;
}

export async function createHandoff(input: CreateHandoffInput): Promise<void> {
  const { error } = await supabase.from("organization_coordination").insert({
    from_organization_id: input.fromOrganizationId,
    to_organization_id: input.toOrganizationId,
    case_id: input.caseId.trim(),
    referral_type: input.referralType,
    notes: input.notes?.trim() || null,
    status: "pending",
  });
  if (error) throw error;
}

export async function updateHandoffStatus(
  id: string,
  status: HandoffStatus,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "completed") {
    patch.completed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("organization_coordination")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/** Next status a party can advance a handoff to, or null if it's terminal. */
export function nextHandoffStatus(status: string): HandoffStatus | null {
  switch (status) {
    case "pending":
      return "acknowledged";
    case "acknowledged":
      return "in_progress";
    case "in_progress":
      return "completed";
    default:
      return null;
  }
}

export const HANDOFF_STATUS_TONE: Record<
  string,
  "slate" | "amber" | "sky" | "emerald" | "rose"
> = {
  pending: "amber",
  acknowledged: "sky",
  in_progress: "sky",
  completed: "emerald",
  declined: "rose",
};
