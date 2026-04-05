import { useCallback, useMemo } from "react";
import { useSurvivorProfile } from "@/data/aegisData";
import type { SafetyPlan, SurvivorProfile } from "@/data/aegisData";
import {
  useLiveCaseReports,
  useLiveSafetyPlans,
  useLiveSurvivorChatSessions,
} from "@/data/liveDashboardData";
import type { LiveCaseReport, LiveSurvivorChatSession } from "@/data/liveDashboardData";

const LIVE_SRC_OPTS = { staleTime: 15_000, refetchInterval: 30_000, limit: 25 } as const;

/** Rows from Supabase used to ground dashboard summaries (alerts remain a secondary signal). */
export type SurvivorPersonalSourcePayload = {
  survivor: SurvivorProfile | null;
  safetyPlans: SafetyPlan[];
  caseReports: LiveCaseReport[];
  chatSessions: LiveSurvivorChatSession[];
};

export function useSurvivorPersonalSourceData(userId?: string | null) {
  const { data: survivor, isLoading: survivorLoading, refetch: refetchSurvivor } = useSurvivorProfile(userId);
  const survivorId = survivor?.id ?? null;
  const enabled = Boolean(userId) && Boolean(survivorId);

  const safetyPlans = useLiveSafetyPlans({ ...LIVE_SRC_OPTS, survivorId, enabled });
  const caseReports = useLiveCaseReports({ ...LIVE_SRC_OPTS, survivorId, enabled });
  const chatSessions = useLiveSurvivorChatSessions({ ...LIVE_SRC_OPTS, survivorId, enabled });

  const { refetch: refetchSafetyPlans } = safetyPlans;
  const { refetch: refetchCaseReports } = caseReports;
  const { refetch: refetchChatSessions } = chatSessions;

  const payload = useMemo<SurvivorPersonalSourcePayload>(
    () => ({
      survivor: survivor ?? null,
      safetyPlans: safetyPlans.data ?? [],
      caseReports: caseReports.data ?? [],
      chatSessions: chatSessions.data ?? [],
    }),
    [survivor, safetyPlans.data, caseReports.data, chatSessions.data]
  );

  const isLoading =
    survivorLoading ||
    (enabled && (safetyPlans.isLoading || caseReports.isLoading || chatSessions.isLoading));

  const refetchAll = useCallback(async () => {
    await refetchSurvivor();
    if (enabled) {
      await Promise.all([refetchSafetyPlans(), refetchCaseReports(), refetchChatSessions()]);
    }
  }, [enabled, refetchSurvivor, refetchSafetyPlans, refetchCaseReports, refetchChatSessions]);

  return { payload, isLoading, refetchSource: refetchAll };
}
