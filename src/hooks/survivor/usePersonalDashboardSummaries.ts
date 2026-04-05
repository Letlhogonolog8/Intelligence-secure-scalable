import { useCallback, useEffect, useMemo, useState } from "react";
import type { AlertItem, SafetyPlan } from "@/data/aegisData";
import { useAlertsFeed, useUserProfile } from "@/data/aegisData";
import type { LiveCaseReport } from "@/data/liveDashboardData";
import {
  type SurvivorPersonalSourcePayload,
  useSurvivorPersonalSourceData,
} from "@/hooks/survivor/useSurvivorPersonalSourceData";

/** Single alerts subscription for all personal-dashboard summaries — avoids duplicate queries and mismatched limits. */
export const PERSONAL_DASHBOARD_ALERTS_OPTIONS = {
  staleTime: 15_000,
  refetchInterval: 30_000,
  limit: 12,
} as const;

type SafetyPlanSummary = {
  status: string;
  statusTone: string;
  meta: string;
  actionLabel: string;
  completionPercent: number;
  lastUpdatedLabel: string;
};

type AppointmentSummary = {
  headline: string;
  meta: string;
  actionLabel: string;
  hasUpcoming: boolean;
};

type TrustedContactsSummary = {
  headline: string;
  meta: string;
  actionLabel: string;
  total: number;
};

type DocumentVaultSummary = {
  headline: string;
  meta: string;
  actionLabel: string;
  totalFiles: number;
  vaultState: "ready" | "empty";
};

type SupportRequestsSummary = {
  headline: string;
  meta: string;
  actionLabel: string;
  openCount: number;
};

type SecureMessagesSummary = {
  headline: string;
  meta: string;
  actionLabel: string;
  unreadCount: number;
};

type LiveActivitySummary = {
  recentEventCount: number;
  latestUpdateLabel: string;
  activeModules: number;
  topModules: Array<{ module: string; count: number }>;
};

type ModulePulseSummary = {
  headline: string;
  meta: string;
  activityCount: number;
};

type ActivityPresenceSummary = {
  newCount: number;
  hasNew: boolean;
  lastSeenLabel: string;
  markAllSeen: () => void;
};

type ProfileLike = {
  safetyPlanExists?: boolean;
  safety_plan_exists?: boolean;
  emergencyContact?: string;
  lastContact?: string;
  supportStatus?: string;
};

const TERMINAL_CASE_STATUSES = new Set(["closed", "resolved", "dismissed", "cancelled", "complete", "completed"]);

function countOpenCaseReports(reports: LiveCaseReport[]): number {
  return reports.filter((r) => !TERMINAL_CASE_STATUSES.has(r.status.trim().toLowerCase())).length;
}

function completionFromSafetyPlan(plan: SafetyPlan): number {
  const sections = [
    plan.trustedContacts?.length ?? 0,
    plan.safeLocations?.length ?? 0,
    plan.emergencyResources?.length ?? 0,
    plan.identifiedTriggers?.length ?? 0,
    plan.copingStrategies?.length ?? 0,
  ];
  const filled = sections.filter((n) => n > 0).length;
  return Math.min(100, 28 + filled * 14);
}

export function computeSafetyPlanSummary(
  profile: unknown,
  alertsFeed: AlertItem[],
  source?: SurvivorPersonalSourcePayload | null
): SafetyPlanSummary {
  const typedProfile = (profile as ProfileLike | null) ?? null;
  const survivor = source?.survivor ?? null;
  const plan = source?.safetyPlans?.[0];

  const hasSafetyPlan = Boolean(
    survivor?.safetyPlanExists ||
      plan ||
      typedProfile?.safetyPlanExists ||
      typedProfile?.safety_plan_exists ||
      alertsFeed.some((entry) => entry.message.toLowerCase().includes("plan"))
  );

  const hasEmergencyContact = Boolean(
    (survivor?.emergencyContact && survivor.emergencyContact.trim().length > 0) ||
      (plan?.trustedContacts && plan.trustedContacts.length > 0) ||
      typedProfile?.emergencyContact
  );

  const completionPercent = (() => {
    if (!hasSafetyPlan) return 35;
    if (plan) {
      const base = completionFromSafetyPlan(plan);
      return hasEmergencyContact ? Math.min(100, base + 8) : base;
    }
    return hasEmergencyContact ? 100 : 75;
  })();

  const lastUpdatedLabel = plan?.updatedAt
    ? `Plan updated ${plan.updatedAt}`
    : survivor?.lastContact
      ? `Last contact ${survivor.lastContact}`
      : typedProfile?.lastContact
        ? `Last contact ${typedProfile.lastContact}`
        : "No recent safety-plan activity";

  return {
    status: hasSafetyPlan ? "Active" : "Needs review",
    statusTone: hasSafetyPlan ? "text-emerald-400" : "text-amber-300",
    meta: hasSafetyPlan
      ? hasEmergencyContact
        ? "Safety plan is active with a trusted contact available"
        : "Safety plan exists but still needs a trusted contact"
      : "Complete your safety plan to improve readiness",
    actionLabel: hasSafetyPlan ? "Review Plan" : "Complete Plan",
    completionPercent,
    lastUpdatedLabel,
  };
}

export function computeAppointmentSummary(
  profile: unknown,
  alertsFeed: AlertItem[],
  source?: SurvivorPersonalSourcePayload | null
): AppointmentSummary {
  const typedProfile = (profile as ProfileLike | null) ?? null;
  const appointmentAlert = alertsFeed.find((entry) => entry.message.toLowerCase().includes("appointment"));
  const activeSessions = source?.chatSessions?.filter((s) => !s.endedAt) ?? [];
  const hasUpcoming = Boolean(appointmentAlert || activeSessions.length > 0);

  let headline = "None Scheduled";
  if (activeSessions.length > 0) headline = `${activeSessions.length} Active session(s)`;
  else if (appointmentAlert) headline = "1 Upcoming";

  const meta = (() => {
    if (activeSessions.length > 0) {
      return "Counseling or support sessions are active or awaiting follow-up.";
    }
    if (appointmentAlert) {
      return appointmentAlert.message ?? "Upcoming support appointment detected";
    }
    if (typedProfile?.supportStatus) {
      return `Support status: ${typedProfile.supportStatus}`;
    }
    return "Check back later or request a follow-up session";
  })();

  return {
    headline,
    meta,
    actionLabel: "View Schedule",
    hasUpcoming,
  };
}

export function computeTrustedContactsSummary(
  profile: unknown,
  alertsFeed: AlertItem[],
  source?: SurvivorPersonalSourcePayload | null
): TrustedContactsSummary {
  const typedProfile = (profile as ProfileLike | null) ?? null;
  const plan = source?.safetyPlans?.[0];
  const planContactCount = plan?.trustedContacts?.length ?? 0;
  const emergencyCount = source?.survivor?.emergencyContact?.trim() ? 1 : 0;
  const structuredTotal = Math.max(planContactCount, emergencyCount);

  const contactSignals = alertsFeed.filter(
    (entry) =>
      entry.message.toLowerCase().includes("contact") || entry.message.toLowerCase().includes("trusted")
  ).length;

  const legacyEmergency = typedProfile?.emergencyContact ? 1 : 0;
  const total = Math.max(structuredTotal, contactSignals > 0 ? 1 : 0, legacyEmergency);

  return {
    headline: total > 0 ? `${total} Saved` : "No Contacts",
    meta:
      total > 0
        ? "Trusted contact data is available for quick outreach"
        : "Add a trusted contact for faster outreach during emergencies",
    actionLabel: "Manage Contacts",
    total,
  };
}

export function computeDocumentVaultSummary(
  alertsFeed: AlertItem[],
  source?: SurvivorPersonalSourcePayload | null
): DocumentVaultSummary {
  const caseCount = source?.caseReports?.length ?? 0;
  if (caseCount > 0) {
    return {
      headline: `${caseCount} Record(s) on file`,
      meta: "Case and support records are linked to your secure profile.",
      actionLabel: "Open Vault",
      totalFiles: caseCount,
      vaultState: "ready",
    };
  }

  const documentSignals = alertsFeed.filter(
    (entry) =>
      entry.message.toLowerCase().includes("document") ||
      entry.message.toLowerCase().includes("file") ||
      entry.message.toLowerCase().includes("vault")
  ).length;

  return {
    headline: documentSignals > 0 ? `${documentSignals} Files` : "0 Files",
    meta:
      documentSignals > 0
        ? "Encrypted vault activity detected from your recent updates"
        : "Encrypted vault ready for secure uploads",
    actionLabel: "Open Vault",
    totalFiles: documentSignals,
    vaultState: documentSignals > 0 ? "ready" : "empty",
  };
}

export function computeSupportRequestsSummary(
  alertsFeed: AlertItem[],
  source?: SurvivorPersonalSourcePayload | null
): SupportRequestsSummary {
  const openCases = source?.caseReports ? countOpenCaseReports(source.caseReports) : 0;
  if (openCases > 0) {
    return {
      headline: `${openCases} Active`,
      meta: "Open case reports need attention or follow-up.",
      actionLabel: "Open Requests",
      openCount: openCases,
    };
  }

  const requestSignals = alertsFeed.filter(
    (entry) =>
      entry.message.toLowerCase().includes("support") ||
      entry.message.toLowerCase().includes("request") ||
      entry.module?.toLowerCase().includes("support")
  ).length;

  return {
    headline: requestSignals > 0 ? `${requestSignals} Active` : "No Active Requests",
    meta:
      requestSignals > 0
        ? "Recent support-related activity is available for review"
        : "No active support requests detected in your recent activity",
    actionLabel: "Open Requests",
    openCount: requestSignals,
  };
}

export function computeSecureMessagesSummary(
  alertsFeed: AlertItem[],
  source?: SurvivorPersonalSourcePayload | null
): SecureMessagesSummary {
  const openChats = source?.chatSessions?.filter((s) => !s.endedAt) ?? [];
  if (openChats.length > 0) {
    return {
      headline: `${openChats.length} Open`,
      meta: "Active secure chat sessions — respond when you are ready.",
      actionLabel: "Open Inbox",
      unreadCount: openChats.length,
    };
  }

  const threadCount = source?.chatSessions?.length ?? 0;
  if (threadCount > 0) {
    return {
      headline: `${threadCount} Thread(s)`,
      meta: "Secure communication history is available in your inbox.",
      actionLabel: "Open Inbox",
      unreadCount: threadCount,
    };
  }

  const messageSignals = alertsFeed.filter(
    (entry) =>
      entry.message.toLowerCase().includes("message") ||
      entry.message.toLowerCase().includes("chat") ||
      entry.message.toLowerCase().includes("reply")
  ).length;

  return {
    headline: messageSignals > 0 ? `${messageSignals} Unread` : "Inbox Clear",
    meta:
      messageSignals > 0
        ? "New communication activity is available in your secure inbox"
        : "No unread secure messages detected in your recent activity",
    actionLabel: "Open Inbox",
    unreadCount: messageSignals,
  };
}

export function computeLiveActivitySummary(alertsFeed: AlertItem[]): LiveActivitySummary {
  const moduleCounts = alertsFeed.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.module || "general";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topModules = Object.entries(moduleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([module, count]) => ({ module, count }));

  return {
    recentEventCount: alertsFeed.length,
    latestUpdateLabel: alertsFeed[0]?.time ? `Latest update ${alertsFeed[0].time}` : "No recent live updates",
    activeModules: Object.keys(moduleCounts).length,
    topModules,
  };
}

export const useSafetyPlanSummary = (userId?: string) => {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeSafetyPlanSummary(profile, alertsFeed), [alertsFeed, profile]);

  return {
    data: summary,
    isLoading: isLoading || alertsLoading,
  };
};

export const useUpcomingAppointmentSummary = (userId?: string) => {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeAppointmentSummary(profile, alertsFeed), [alertsFeed, profile]);

  return {
    data: summary,
    isLoading: isLoading || alertsLoading,
  };
};

export const useTrustedContactsSummary = (userId?: string) => {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeTrustedContactsSummary(profile, alertsFeed), [alertsFeed, profile]);

  return {
    data: summary,
    isLoading: isLoading || alertsLoading,
  };
};

export const useDocumentVaultSummary = (_userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeDocumentVaultSummary(alertsFeed), [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

export const useSupportRequestsSummary = (_userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeSupportRequestsSummary(alertsFeed), [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

export const useSecureMessagesSummary = (_userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeSecureMessagesSummary(alertsFeed), [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

export const useLiveActivitySummary = (_userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo(() => computeLiveActivitySummary(alertsFeed), [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

const moduleKeywords: Record<string, string[]> = {
  safety_plan: ["plan", "safety"],
  appointments: ["appointment", "session", "schedule"],
  trusted_contacts: ["contact", "trusted"],
  document_vault: ["document", "file", "vault"],
  support_requests: ["support", "request"],
  secure_messages: ["message", "chat", "reply"],
};

export function computeModulePulseSummary(module: string, alertsFeed: AlertItem[]): ModulePulseSummary {
  const keywords = moduleKeywords[module] ?? [];
  const matchingEntries = alertsFeed.filter((entry) => {
    const haystack = `${entry.module} ${entry.message} ${entry.type}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });

  return {
    headline: matchingEntries.length > 0 ? `${matchingEntries.length} live signals` : "No live signals",
    meta:
      matchingEntries[0]?.message ??
      "No recent activity detected for this workflow in the current live feed",
    activityCount: matchingEntries.length,
  };
}

export const useModulePulseSummary = (module: string, _userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const summary = useMemo<ModulePulseSummary>(() => computeModulePulseSummary(module, alertsFeed), [alertsFeed, module]);

  return {
    data: summary,
    isLoading,
  };
};

const toAlertKey = (entry: { module?: string; type?: string; message?: string; time?: string }) =>
  `${entry.module ?? "general"}|${entry.type ?? "info"}|${entry.message ?? ""}|${entry.time ?? ""}`;

const getPresenceStorageKey = (userId?: string) => `aegis-personal-dashboard-seen:${userId ?? "anonymous"}`;

/**
 * Presence state keyed off a shared alerts feed (no extra `useAlertsFeed` subscription).
 */
export const useActivityPresenceFromFeed = (
  userId: string | undefined,
  alertsFeed: AlertItem[],
  feedLoading: boolean
) => {
  const storageKey = getPresenceStorageKey(userId);
  const [seenKeys, setSeenKeys] = useState<string[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { seenKeys?: string[]; lastSeenAt?: string | null };
      setSeenKeys(parsed.seenKeys ?? []);
      setLastSeenAt(parsed.lastSeenAt ?? null);
    } catch {
      setSeenKeys([]);
      setLastSeenAt(null);
    }
  }, [storageKey]);

  const currentKeys = useMemo(() => alertsFeed.map(toAlertKey), [alertsFeed]);

  const markAllSeen = useCallback(() => {
    const payload = {
      seenKeys: currentKeys,
      lastSeenAt: new Date().toISOString(),
    };
    setSeenKeys(payload.seenKeys);
    setLastSeenAt(payload.lastSeenAt);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }
  }, [currentKeys, storageKey]);

  const summary = useMemo<ActivityPresenceSummary>(() => {
    const newCount = currentKeys.filter((key) => !seenKeys.includes(key)).length;
    return {
      newCount,
      hasNew: newCount > 0,
      lastSeenLabel: lastSeenAt ? `Last seen ${new Date(lastSeenAt).toLocaleString()}` : "Not yet marked seen",
      markAllSeen,
    };
  }, [currentKeys, lastSeenAt, markAllSeen, seenKeys]);

  return {
    data: summary,
    isLoading: feedLoading,
  };
};

export const useActivityPresenceSummary = (userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);
  return useActivityPresenceFromFeed(userId, alertsFeed, isLoading);
};

export type PersonalDashboardBundle = {
  profile: unknown;
  displayName: string;
  alertsFeed: AlertItem[];
  source: SurvivorPersonalSourcePayload;
  safetyPlanSummary: SafetyPlanSummary;
  appointmentSummary: AppointmentSummary;
  trustedContactsSummary: TrustedContactsSummary;
  documentVaultSummary: DocumentVaultSummary;
  supportRequestsSummary: SupportRequestsSummary;
  secureMessagesSummary: SecureMessagesSummary;
  liveActivitySummary: LiveActivitySummary;
  activityPresenceSummary: ActivityPresenceSummary;
  isProfileLoading: boolean;
  isAlertsLoading: boolean;
  isSourceLoading: boolean;
  profileError: unknown;
  alertsError: unknown;
  refetchAlerts: () => Promise<unknown>;
  refetchProfile: () => Promise<unknown>;
  refetchSource: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
};

/**
 * One profile query + one alerts feed for the entire Personal Dashboard (performance + consistent metrics).
 */
export function usePersonalDashboardBundle(userId?: string | null): PersonalDashboardBundle {
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useUserProfile(userId);
  const {
    data: alertsFeed = [],
    isLoading: isAlertsLoading,
    error: alertsError,
    refetch: refetchAlerts,
  } = useAlertsFeed(PERSONAL_DASHBOARD_ALERTS_OPTIONS);

  const { payload: source, isLoading: isSourceLoading, refetchSource } = useSurvivorPersonalSourceData(userId);

  const displayName = useMemo(() => {
    const p = profile as { full_name?: string; fullName?: string; name?: string } | null | undefined;
    return p?.full_name || p?.fullName || p?.name || "Survivor";
  }, [profile]);

  const safetyPlanSummary = useMemo(
    () => computeSafetyPlanSummary(profile, alertsFeed, source),
    [alertsFeed, profile, source]
  );
  const appointmentSummary = useMemo(
    () => computeAppointmentSummary(profile, alertsFeed, source),
    [alertsFeed, profile, source]
  );
  const trustedContactsSummary = useMemo(
    () => computeTrustedContactsSummary(profile, alertsFeed, source),
    [alertsFeed, profile, source]
  );
  const documentVaultSummary = useMemo(
    () => computeDocumentVaultSummary(alertsFeed, source),
    [alertsFeed, source]
  );
  const supportRequestsSummary = useMemo(
    () => computeSupportRequestsSummary(alertsFeed, source),
    [alertsFeed, source]
  );
  const secureMessagesSummary = useMemo(
    () => computeSecureMessagesSummary(alertsFeed, source),
    [alertsFeed, source]
  );
  const liveActivitySummary = useMemo(() => computeLiveActivitySummary(alertsFeed), [alertsFeed]);

  const { data: activityPresenceSummary } = useActivityPresenceFromFeed(
    userId ?? undefined,
    alertsFeed,
    isAlertsLoading
  );

  const refreshDashboard = useCallback(async () => {
    await Promise.all([refetchAlerts(), refetchProfile(), refetchSource()]);
  }, [refetchAlerts, refetchProfile, refetchSource]);

  return {
    profile,
    displayName,
    alertsFeed,
    source,
    safetyPlanSummary,
    appointmentSummary,
    trustedContactsSummary,
    documentVaultSummary,
    supportRequestsSummary,
    secureMessagesSummary,
    liveActivitySummary,
    activityPresenceSummary,
    isProfileLoading,
    isAlertsLoading,
    isSourceLoading,
    profileError,
    alertsError,
    refetchAlerts,
    refetchProfile,
    refetchSource,
    refreshDashboard,
  };
}

export type SurvivorWorkspaceBundle = PersonalDashboardBundle & {
  modulePulseSummary: ModulePulseSummary;
};

/** Single data bundle for survivor workspaces (avoids duplicate summary hooks + shared alerts feed). */
export function useSurvivorWorkspaceSummaries(module: string, userId?: string | null): SurvivorWorkspaceBundle {
  const bundle = usePersonalDashboardBundle(userId);
  const modulePulseSummary = useMemo(
    () => computeModulePulseSummary(module, bundle.alertsFeed),
    [module, bundle.alertsFeed]
  );
  return { ...bundle, modulePulseSummary };
}
