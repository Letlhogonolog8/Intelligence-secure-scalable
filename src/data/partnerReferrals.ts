import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Partner referral data layer for the Partner Coordination board. Rows are
 * real referrals from responders to partner organizations (NGO, counselor,
 * shelter, hospital, legal). RLS lets responders read; police/ngo/counselor/
 * admin create and update. Realtime-published — see migration
 * 20260707150000_partner_referrals.sql.
 */

export type PartnerType =
  | "ngo"
  | "counselor"
  | "shelter"
  | "hospital"
  | "legal";

export type ReferralStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "declined";

export interface PartnerReferral {
  id: string;
  caseReference: string | null;
  partnerType: PartnerType;
  organizationName: string;
  contactName: string | null;
  contactPhone: string | null;
  serviceRequested: string;
  status: ReferralStatus;
  nextAction: string | null;
  dueAt: string | null;
  requestedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export const PARTNER_REFERRALS_KEY = ["aegis", "partnerReferrals"] as const;

const SELECT_COLUMNS =
  "id,case_reference,partner_type,organization_name,contact_name,contact_phone,service_requested,status,next_action,due_at,requested_by,responded_at,created_at";

type ReferralRow = {
  id: string;
  case_reference: string | null;
  partner_type: PartnerType;
  organization_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  service_requested: string;
  status: ReferralStatus;
  next_action: string | null;
  due_at: string | null;
  requested_by: string | null;
  responded_at: string | null;
  created_at: string;
};

const mapReferral = (r: ReferralRow): PartnerReferral => ({
  id: r.id,
  caseReference: r.case_reference,
  partnerType: r.partner_type,
  organizationName: r.organization_name,
  contactName: r.contact_name,
  contactPhone: r.contact_phone,
  serviceRequested: r.service_requested,
  status: r.status,
  nextAction: r.next_action,
  dueAt: r.due_at,
  requestedBy: r.requested_by,
  respondedAt: r.responded_at,
  createdAt: r.created_at,
});

export async function fetchPartnerReferrals(
  limit = 200,
): Promise<PartnerReferral[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("partner_referrals")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as ReferralRow[]).map(mapReferral);
}

export async function createPartnerReferral(input: {
  requestedBy: string;
  partnerType: PartnerType;
  organizationName: string;
  serviceRequested: string;
  caseReference?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  nextAction?: string | null;
  dueAt?: string | null;
}): Promise<void> {
  if (!input.requestedBy) throw new Error("Not signed in");
  const { error } = await supabase.from("partner_referrals").insert({
    requested_by: input.requestedBy,
    partner_type: input.partnerType,
    organization_name: input.organizationName.trim(),
    service_requested: input.serviceRequested.trim(),
    case_reference: input.caseReference?.trim() || null,
    contact_name: input.contactName?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    next_action: input.nextAction?.trim() || null,
    due_at: input.dueAt ?? null,
  });
  if (error) throw error;
}

export async function updateReferralStatus(
  id: string,
  status: ReferralStatus,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  // First partner response closes the "awaiting response" window.
  if (status !== "pending") {
    patch.responded_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("partner_referrals")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export const usePartnerReferrals = (options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const enabled = hasSupabase && (options?.enabled ?? true);
  const query = useQuery({
    queryKey: PARTNER_REFERRALS_KEY,
    queryFn: () => fetchPartnerReferrals(),
    enabled,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("aegis:partnerReferrals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partner_referrals" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: PARTNER_REFERRALS_KEY,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  return query;
};
