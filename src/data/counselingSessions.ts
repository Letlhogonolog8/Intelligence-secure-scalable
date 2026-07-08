import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Counseling-session data layer for the Counselor portal (and the NGO
 * Counseling section). RLS: responders read; counselors/ngo/admin create and
 * update their own rows. Realtime-published — see migration
 * 20260708120000_counseling_sessions.sql.
 */

export type SessionType =
  | "individual"
  | "group"
  | "family"
  | "crisis"
  | "follow_up";
export type SessionMode = "virtual" | "in_person" | "phone";
export type SessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface CounselingSession {
  id: string;
  counselorId: string | null;
  caseReference: string | null;
  survivorAlias: string | null;
  sessionType: SessionType;
  mode: SessionMode;
  status: SessionStatus;
  scheduledAt: string;
  durationMinutes: number;
  notes: string | null;
  createdAt: string;
}

export const COUNSELING_SESSIONS_KEY = ["aegis", "counselingSessions"] as const;

type SessionRow = {
  id: string;
  counselor_id: string | null;
  case_reference: string | null;
  survivor_alias: string | null;
  session_type: SessionType;
  mode: SessionMode;
  status: SessionStatus;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
};

const mapSession = (r: SessionRow): CounselingSession => ({
  id: r.id,
  counselorId: r.counselor_id,
  caseReference: r.case_reference,
  survivorAlias: r.survivor_alias,
  sessionType: r.session_type,
  mode: r.mode,
  status: r.status,
  scheduledAt: r.scheduled_at,
  durationMinutes: r.duration_minutes,
  notes: r.notes,
  createdAt: r.created_at,
});

export async function fetchCounselingSessions(
  limit = 200,
): Promise<CounselingSession[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("counseling_sessions")
    .select(
      "id,counselor_id,case_reference,survivor_alias,session_type,mode,status,scheduled_at,duration_minutes,notes,created_at",
    )
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as SessionRow[]).map(mapSession);
}

export async function scheduleSession(input: {
  counselorId: string;
  scheduledAt: string;
  caseReference?: string | null;
  survivorAlias?: string | null;
  sessionType?: SessionType;
  mode?: SessionMode;
  durationMinutes?: number;
  notes?: string | null;
}): Promise<void> {
  if (!input.counselorId) throw new Error("Not signed in");
  const { error } = await supabase.from("counseling_sessions").insert({
    counselor_id: input.counselorId,
    scheduled_at: input.scheduledAt,
    case_reference: input.caseReference?.trim() || null,
    survivor_alias: input.survivorAlias?.trim() || null,
    session_type: input.sessionType ?? "individual",
    mode: input.mode ?? "virtual",
    duration_minutes: input.durationMinutes ?? 60,
    notes: input.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
): Promise<void> {
  const { error } = await supabase
    .from("counseling_sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export const useCounselingSessions = (options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const enabled = hasSupabase && (options?.enabled ?? true);
  const query = useQuery({
    queryKey: COUNSELING_SESSIONS_KEY,
    queryFn: () => fetchCounselingSessions(),
    enabled,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("aegis:counselingSessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "counseling_sessions" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: COUNSELING_SESSIONS_KEY,
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
