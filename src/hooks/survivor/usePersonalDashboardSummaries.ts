import { useCallback, useEffect, useMemo, useState } from "react";
import { useAlertsFeed, useUserProfile } from "@/data/aegisData";

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

export const useSafetyPlanSummary = (userId?: string) => {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 30000,
    limit: 10,
  });

  const summary = useMemo<SafetyPlanSummary>(() => {
    const typedProfile = (profile as ProfileLike | null) ?? null;
    const hasSafetyPlan = Boolean(
      typedProfile?.safetyPlanExists ??
        typedProfile?.safety_plan_exists ??
        alertsFeed.some((entry) => entry.message.toLowerCase().includes("plan"))
    );
    const hasEmergencyContact = Boolean(typedProfile?.emergencyContact);
    const completionPercent = hasSafetyPlan ? (hasEmergencyContact ? 100 : 75) : 35;

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
      lastUpdatedLabel: typedProfile?.lastContact ? `Last contact ${typedProfile.lastContact}` : "No recent safety-plan activity",
    };
  }, [alertsFeed, profile]);

  return {
    data: summary,
    isLoading: isLoading || alertsLoading,
  };
};

export const useUpcomingAppointmentSummary = (userId?: string) => {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 30000,
    limit: 10,
  });

  const summary = useMemo<AppointmentSummary>(() => {
    const typedProfile = (profile as ProfileLike | null) ?? null;
    const appointmentAlert = alertsFeed.find((entry) => entry.message.toLowerCase().includes("appointment"));
    const hasUpcoming = Boolean(appointmentAlert);

    return {
      headline: hasUpcoming ? "1 Upcoming" : "None Scheduled",
      meta: hasUpcoming
        ? appointmentAlert?.message ?? "Upcoming support appointment detected"
        : typedProfile?.supportStatus
          ? `Support status: ${typedProfile.supportStatus}`
          : "Check back later or request a follow-up session",
      actionLabel: "View Schedule",
      hasUpcoming,
    };
  }, [alertsFeed, profile]);

  return {
    data: summary,
    isLoading: isLoading || alertsLoading,
  };
};

export const useTrustedContactsSummary = (userId?: string) => {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 30000,
    limit: 10,
  });

  const summary = useMemo<TrustedContactsSummary>(() => {
    const typedProfile = (profile as ProfileLike | null) ?? null;
    const emergencyContactCount = typedProfile?.emergencyContact ? 1 : 0;
    const contactSignals = alertsFeed.filter(
      (entry) =>
        entry.message.toLowerCase().includes("contact") ||
        entry.message.toLowerCase().includes("trusted")
    ).length;
    const total = Math.max(emergencyContactCount, contactSignals > 0 ? 1 : 0);

    return {
      headline: total > 0 ? `${total} Saved` : "No Contacts",
      meta: total > 0
        ? "Trusted contact data is available for quick outreach"
        : "Add a trusted contact for faster outreach during emergencies",
      actionLabel: "Manage Contacts",
      total,
    };
  }, [alertsFeed, profile]);

  return {
    data: summary,
    isLoading: isLoading || alertsLoading,
  };
};

export const useDocumentVaultSummary = (userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 30000,
    limit: 10,
  });

  const summary = useMemo<DocumentVaultSummary>(() => {
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
  }, [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

export const useSupportRequestsSummary = (userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 15000,
    limit: 12,
  });

  const summary = useMemo<SupportRequestsSummary>(() => {
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
  }, [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

export const useSecureMessagesSummary = (userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 15000,
    limit: 12,
  });

  const summary = useMemo<SecureMessagesSummary>(() => {
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
  }, [alertsFeed]);

  return {
    data: summary,
    isLoading,
  };
};

export const useLiveActivitySummary = (userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 15000,
    limit: 12,
  });

  const summary = useMemo<LiveActivitySummary>(() => {
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
  }, [alertsFeed]);

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

export const useModulePulseSummary = (module: string, userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 15000,
    limit: 12,
  });

  const summary = useMemo<ModulePulseSummary>(() => {
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
  }, [alertsFeed, module]);

  return {
    data: summary,
    isLoading,
  };
};

const toAlertKey = (entry: { module?: string; type?: string; message?: string; time?: string }) =>
  `${entry.module ?? "general"}|${entry.type ?? "info"}|${entry.message ?? ""}|${entry.time ?? ""}`;

const getPresenceStorageKey = (userId?: string) => `aegis-personal-dashboard-seen:${userId ?? "anonymous"}`;

export const useActivityPresenceSummary = (userId?: string) => {
  const { data: alertsFeed = [], isLoading } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 15000,
    limit: 12,
  });
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
    isLoading,
  };
};
