import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Responder portal preferences (notification toggles + availability),
 * persisted per user in public.responder_settings and RLS-scoped to self.
 * See migration 20260701160000_responder_settings.sql.
 */

export interface ResponderSettings {
  criticalPush: boolean;
  caseAssignmentPush: boolean;
  auditVisibility: boolean;
  available: boolean;
}

export const DEFAULT_RESPONDER_SETTINGS: ResponderSettings = {
  criticalPush: true,
  caseAssignmentPush: true,
  auditVisibility: true,
  available: true,
};

export const responderSettingsKey = (userId: string) =>
  ["aegis", "responderSettings", userId] as const;

export async function fetchResponderSettings(
  userId: string,
): Promise<ResponderSettings> {
  if (!hasSupabase || !userId) return DEFAULT_RESPONDER_SETTINGS;
  const { data, error } = await supabase
    .from("responder_settings")
    .select("critical_push,case_assignment_push,audit_visibility,available")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_RESPONDER_SETTINGS;
  return {
    criticalPush: data.critical_push,
    caseAssignmentPush: data.case_assignment_push,
    auditVisibility: data.audit_visibility,
    available: data.available,
  };
}

export async function saveResponderSettings(
  userId: string,
  settings: ResponderSettings,
): Promise<void> {
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase.from("responder_settings").upsert(
    {
      user_id: userId,
      critical_push: settings.criticalPush,
      case_assignment_push: settings.caseAssignmentPush,
      audit_visibility: settings.auditVisibility,
      available: settings.available,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export const useResponderSettings = (userId?: string | null) =>
  useQuery({
    queryKey: responderSettingsKey(userId ?? "none"),
    queryFn: () =>
      userId
        ? fetchResponderSettings(userId)
        : Promise.resolve(DEFAULT_RESPONDER_SETTINGS),
    enabled: hasSupabase && Boolean(userId),
    staleTime: 30000,
  });
