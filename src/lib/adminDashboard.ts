import { ADMIN_DASHBOARD_THRESHOLDS, type AdminDashboardThresholds } from "@/config/adminDashboardThresholds";

export interface AdminIncidentPoint {
  date?: string | null;
  value?: number | null;
}

export interface AdminAuditEntry {
  time?: string | null;
  action?: string | null;
  severity?: string | null;
  module?: string | null;
  user?: string | null;
  description?: string | null;
}

export interface AdminAlertEntry {
  id: string;
  message?: string | null;
  type?: string | null;
  module?: string | null;
  time?: string | null;
}

export interface AdminFeedHealthItem {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
}

export interface AdminActionItem {
  title: string;
  description: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
  actionLabel: string;
  actionModule: string;
}

export interface AdminThresholdNotification {
  title: string;
  description: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
}

export const normalizeAdminIncidentSeries = (items: AdminIncidentPoint[]) =>
  items
    .filter((entry) => entry.date && typeof entry.value === "number")
    .map((entry) => ({
      date: entry.date as string,
      value: typeof entry.value === "number" ? entry.value : 0,
    }));

export const normalizeAdminAuditLogs = (items: AdminAuditEntry[]) =>
  items
    .filter((entry) => entry.time && entry.action)
    .map((entry) => ({
      ...entry,
      time: entry.time as string,
      action: entry.action as string,
      severity: (entry.severity ?? "info").toLowerCase(),
      module: entry.module || "core",
      user: entry.user || "system",
    }));

export const normalizeAdminAlerts = (items: AdminAlertEntry[]) =>
  items
    .filter((entry) => entry.message)
    .map((entry) => ({
      ...entry,
      message: entry.message as string,
      type: (entry.type ?? "warning").toLowerCase(),
      module: entry.module || "core",
      time: entry.time || "--",
    }));

export const buildAdminFeedHealth = ({
  userCount,
  incidentPointCount,
  auditEntryCount,
}: {
  userCount: number;
  incidentPointCount: number;
  auditEntryCount: number;
}): AdminFeedHealthItem[] => [
  {
    label: "Identity sync",
    value: userCount > 0 ? "Live" : "Pending",
    tone: userCount > 0 ? "emerald" : "amber",
  },
  {
    label: "Telemetry feed",
    value: incidentPointCount > 0 ? "Streaming" : "Awaiting data",
    tone: incidentPointCount > 0 ? "emerald" : "amber",
  },
  {
    label: "Audit ledger",
    value: auditEntryCount > 0 ? "Healthy" : "Quiet",
    tone: auditEntryCount > 0 ? "sky" : "slate",
  },
];

export const buildAdminRecommendedActions = ({
  pendingApprovals,
  criticalAlerts,
  unresolvedEscalations,
  pendingDeletionRequests,
}: {
  pendingApprovals: number;
  criticalAlerts: number;
  unresolvedEscalations: number;
  pendingDeletionRequests: number;
}): AdminActionItem[] =>
  [
    pendingApprovals > 0
      ? {
          title: "Clear privileged approval backlog",
          description: `${pendingApprovals} privileged accounts are waiting for admin action.`,
          tone: "amber" as const,
          actionLabel: "Open approvals",
          actionModule: "admin_console",
        }
      : null,
    criticalAlerts > 0
      ? {
          title: "Investigate critical alerts",
          description: `${criticalAlerts} critical monitoring signals are affecting security posture.`,
          tone: "rose" as const,
          actionLabel: "Inspect alerts",
          actionModule: "governance",
        }
      : null,
    unresolvedEscalations > 0
      ? {
          title: "Reduce unresolved escalations",
          description: `${unresolvedEscalations} escalations still need oversight follow-up.`,
          tone: "rose" as const,
          actionLabel: "Open justice queue",
          actionModule: "justice",
        }
      : null,
    pendingDeletionRequests > 0
      ? {
          title: "Close privacy request backlog",
          description: `${pendingDeletionRequests} deletion requests remain open.`,
          tone: "indigo" as const,
          actionLabel: "Process requests",
          actionModule: "admin_console",
        }
      : {
          title: "Admin posture is stable",
          description: "Core queues are clear. Use this window to review audit history and export governance reporting.",
          tone: "emerald" as const,
          actionLabel: "Open reporting",
          actionModule: "reporting",
        },
  ].filter((entry): entry is AdminActionItem => Boolean(entry)).slice(0, 3);

export const buildThresholdNotifications = ({
  pendingApprovals,
  criticalAlerts,
  unresolvedEscalations,
  pendingDeletionRequests,
  securityPosture,
  thresholds = ADMIN_DASHBOARD_THRESHOLDS,
}: {
  pendingApprovals: number;
  criticalAlerts: number;
  unresolvedEscalations: number;
  pendingDeletionRequests: number;
  securityPosture: number;
  thresholds?: AdminDashboardThresholds;
}): AdminThresholdNotification[] =>
  [
    pendingApprovals >= thresholds.pendingApprovalsWarning
      ? {
          title: "Approval queue threshold breached",
          description: `${pendingApprovals} privileged approvals are waiting. Consider reallocating admin time or adding approval automation.`,
          tone: "amber" as const,
        }
      : null,
    criticalAlerts > 0
      ? {
          title: "Critical monitoring signals detected",
          description: `${criticalAlerts} critical alerts are active. Governance review should be prioritized ahead of routine reporting.`,
          tone: "rose" as const,
        }
      : null,
    unresolvedEscalations >= thresholds.unresolvedEscalationsWarning
      ? {
          title: "Escalation backlog is building",
          description: `${unresolvedEscalations} escalations remain unresolved. This creates operational drag for the oversight team.`,
          tone: "rose" as const,
        }
      : null,
    pendingDeletionRequests >= thresholds.pendingDeletionRequestsWarning
      ? {
          title: "Privacy processing queue is elevated",
          description: `${pendingDeletionRequests} deletion requests are still open. Review SLA risk for privacy operations.`,
          tone: "indigo" as const,
        }
      : null,
    securityPosture < thresholds.securityPostureMinimum
      ? {
          title: "Security posture is below target",
          description: `Composite posture is ${securityPosture}%. Treat this as an active reliability and governance issue.`,
          tone: "rose" as const,
        }
      : null,
  ].filter((entry): entry is AdminThresholdNotification => Boolean(entry));
