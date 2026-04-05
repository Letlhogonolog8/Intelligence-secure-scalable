import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchAlertsFeed, fetchSurvivorProfile, fetchUserProfile } from "@/data/aegisData";
import {
  fetchLiveCaseReports,
  fetchLiveSafetyPlans,
  fetchLiveSurvivorChatSessions,
} from "@/data/liveDashboardData";
import { useAuth } from "@/hooks/use-auth";
import { PERSONAL_DASHBOARD_ALERTS_OPTIONS } from "@/hooks/survivor/usePersonalDashboardSummaries";

const LIVE_SLICE = { limit: 25, offset: 0 } as const;

/**
 * Warms TanStack Query caches for profile, alerts, survivor row, and live slices before navigating to survivor modules.
 */
export function usePrefetchSurvivorPersonalData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;

    const alertOpts = PERSONAL_DASHBOARD_ALERTS_OPTIONS;

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["aegis", "userProfile", uid],
        queryFn: () => fetchUserProfile(uid),
      }),
      queryClient.prefetchQuery({
        queryKey: ["aegis", "survivorProfile", uid],
        queryFn: () => fetchSurvivorProfile(uid),
      }),
      queryClient.prefetchQuery({
        queryKey: ["aegis", "alertsFeed", alertOpts.limit, alertOpts.offset],
        queryFn: () => fetchAlertsFeed(alertOpts),
      }),
    ]);

    const survivor = queryClient.getQueryData<{ id?: string } | null>(["aegis", "survivorProfile", uid]);
    const survivorId = survivor?.id ?? null;
    if (!survivorId) return;

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["live-dashboard", "safetyPlans", survivorId, LIVE_SLICE.limit, LIVE_SLICE.offset],
        queryFn: () => fetchLiveSafetyPlans({ survivorId, ...LIVE_SLICE }),
      }),
      queryClient.prefetchQuery({
        queryKey: ["live-dashboard", "caseReports", survivorId, "all", LIVE_SLICE.limit, LIVE_SLICE.offset],
        queryFn: () => fetchLiveCaseReports({ survivorId, ...LIVE_SLICE }),
      }),
      queryClient.prefetchQuery({
        queryKey: ["live-dashboard", "survivorChatSessions", survivorId, "all", LIVE_SLICE.limit, LIVE_SLICE.offset],
        queryFn: () => fetchLiveSurvivorChatSessions({ survivorId, ...LIVE_SLICE }),
      }),
    ]);
  }, [queryClient, user?.id]);
}
