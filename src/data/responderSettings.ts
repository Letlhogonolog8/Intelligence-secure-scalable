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

/* ---------------------- Free-form portal preferences ---------------------- */
/**
 * Per-user JSONB preference blob (responder_settings.preferences) for portals
 * whose settings don't map onto the fixed notification columns above (e.g.
 * the counselor portal's toggle set). Namespaced by portal key.
 */

export type PortalPreferences = Record<string, boolean | string | number>;

export const portalPreferencesKey = (userId: string, portal: string) =>
  ["aegis", "portalPreferences", userId, portal] as const;

export async function fetchPortalPreferences(
  userId: string,
  portal: string,
): Promise<PortalPreferences> {
  if (!hasSupabase || !userId) return {};
  const { data, error } = await supabase
    .from("responder_settings")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
  const scoped = prefs[portal];
  return scoped && typeof scoped === "object"
    ? (scoped as PortalPreferences)
    : {};
}

export async function savePortalPreferences(
  userId: string,
  portal: string,
  values: PortalPreferences,
): Promise<void> {
  if (!userId) throw new Error("Not signed in");
  const { data, error: readError } = await supabase
    .from("responder_settings")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  const current = (data?.preferences ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("responder_settings").upsert(
    {
      user_id: userId,
      preferences: { ...current, [portal]: values },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export const usePortalPreferences = (
  userId: string | null | undefined,
  portal: string,
) =>
  useQuery({
    queryKey: portalPreferencesKey(userId ?? "none", portal),
    queryFn: () =>
      userId
        ? fetchPortalPreferences(userId, portal)
        : Promise.resolve({} as PortalPreferences),
    enabled: hasSupabase && Boolean(userId),
    staleTime: 30000,
  });
