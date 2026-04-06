import type { AlertItem, OrganizationCoordination } from "@/data/aegisData";
import type { LiveJusticeCase } from "@/data/liveDashboardData";

export interface PoliceRecommendedAction {
  title: string;
  description: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
  actionLabel: string;
  actionModule: "command_center" | "justice" | "reporting";
}

export interface PoliceAvailabilitySummary {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
}

export interface PoliceStageAgingItem {
  stage: string;
  count: number;
  avgDaysOpen: number;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
}

export const normalizePoliceCases = (items: LiveJusticeCase[]) =>
  items
    .filter((entry) => entry.id && entry.caseNumber)
    .map((entry) => ({
      ...entry,
      status: (entry.status || "open").toLowerCase(),
      stage: (entry.stage || "intake").toLowerCase(),
      priority: (entry.priority || "medium").toLowerCase() as LiveJusticeCase["priority"],
      region: entry.region || "Region pending",
      updatedAt: entry.updatedAt || entry.createdAt || undefined,
      assignedTo: entry.assignedTo || "",
    }));

export const normalizePoliceAlerts = (items: AlertItem[]) =>
  items
    .filter((entry) => entry.id && entry.message)
    .map((entry) => ({
      ...entry,
      type: (entry.type || "warning").toLowerCase(),
      status: (entry.status || "pending").toLowerCase(),
      module: entry.module || "core",
      time: entry.time || "--",
      message: entry.message,
    }));

export const normalizePoliceReferrals = (items: OrganizationCoordination[]) =>
  items
    .filter((entry) => entry.id && entry.caseId)
    .map((entry) => ({
      ...entry,
      status: (entry.status || "pending").toLowerCase(),
      referralType: entry.referralType || "coordination",
      createdAt: entry.createdAt || entry.updatedAt || "",
    }));

export const buildPoliceRecommendedActions = ({
  urgentCases,
  unassignedOpenCases,
  pendingAlerts,
  pendingReferrals,
  responseLoad,
}: {
  urgentCases: number;
  unassignedOpenCases: number;
  pendingAlerts: number;
  pendingReferrals: number;
  responseLoad: number;
}): PoliceRecommendedAction[] => {
  const actions: PoliceRecommendedAction[] = [];

  if (urgentCases > 0) {
    actions.push({
      title: "Dispatch critical cases first",
      description: `${urgentCases} critical case${urgentCases === 1 ? "" : "s"} need immediate police action.`,
      tone: "rose",
      actionLabel: "Open dispatch",
      actionModule: "command_center",
    });
  }

  if (unassignedOpenCases > 0) {
    actions.push({
      title: "Reduce unassigned investigations",
      description: `${unassignedOpenCases} open case${unassignedOpenCases === 1 ? "" : "s"} still lack an assigned officer.`,
      tone: "amber",
      actionLabel: "Review justice queue",
      actionModule: "justice",
    });
  }

  if (pendingAlerts > 0) {
    actions.push({
      title: "Clear live alert backlog",
      description: `${pendingAlerts} field alert${pendingAlerts === 1 ? "" : "s"} are still waiting for acknowledgement.`,
      tone: "amber",
      actionLabel: "Open dispatch",
      actionModule: "command_center",
    });
  }

  if (pendingReferrals > 0) {
    actions.push({
      title: "Close partner handoffs",
      description: `${pendingReferrals} referral${pendingReferrals === 1 ? "" : "s"} still need partner follow-up.`,
      tone: "indigo",
      actionLabel: "Open reporting",
      actionModule: "reporting",
    });
  }

  if (responseLoad >= 80) {
    actions.push({
      title: "Response load is approaching saturation",
      description: `Current response pressure is ${responseLoad}%. Rebalance cases before new incidents arrive.`,
      tone: "rose",
      actionLabel: "Open dispatch",
      actionModule: "command_center",
    });
  }

  return actions.slice(0, 3);
};

export const buildPoliceAvailabilitySummary = ({
  activeOfficerIds,
  assignedOfficerIds,
}: {
  activeOfficerIds: string[];
  assignedOfficerIds: string[];
}): PoliceAvailabilitySummary[] => {
  const active = new Set(activeOfficerIds.filter(Boolean));
  const assigned = new Set(assignedOfficerIds.filter(Boolean));
  let engaged = 0;

  active.forEach((officerId) => {
    if (assigned.has(officerId)) {
      engaged += 1;
    }
  });

  const available = Math.max(active.size - engaged, 0);

  return [
    { label: "Available", value: available, tone: available > 0 ? "emerald" : "amber" },
    { label: "Engaged", value: engaged, tone: engaged > available ? "amber" : "sky" },
    { label: "Active", value: active.size, tone: "sky" },
  ];
};

export const buildPoliceStageAging = (cases: Array<{ stage?: string | null; daysOpen?: number | null; status?: string | null }>): PoliceStageAgingItem[] => {
  const grouped = new Map<string, { count: number; totalDays: number }>();

  cases
    .filter((entry) => !["closed", "resolved"].includes((entry.status || "").toLowerCase()))
    .forEach((entry) => {
      const stage = (entry.stage || "intake").toLowerCase();
      const daysOpen = Number.isFinite(entry.daysOpen) ? Number(entry.daysOpen) : 0;
      const current = grouped.get(stage) ?? { count: 0, totalDays: 0 };
      grouped.set(stage, {
        count: current.count + 1,
        totalDays: current.totalDays + daysOpen,
      });
    });

  return Array.from(grouped.entries())
    .map(([stage, stats]) => {
      const avgDaysOpen = stats.count > 0 ? Math.round(stats.totalDays / stats.count) : 0;
      return {
        stage,
        count: stats.count,
        avgDaysOpen,
        tone: avgDaysOpen >= 30 ? "rose" : avgDaysOpen >= 14 ? "amber" : "emerald",
      } satisfies PoliceStageAgingItem;
    })
    .sort((left, right) => right.avgDaysOpen - left.avgDaysOpen)
    .slice(0, 4);
};
