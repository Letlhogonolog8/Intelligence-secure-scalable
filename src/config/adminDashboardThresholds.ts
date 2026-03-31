export const ADMIN_DASHBOARD_THRESHOLDS = {
  pendingApprovalsWarning: 5,
  unresolvedEscalationsWarning: 3,
  pendingDeletionRequestsWarning: 3,
  securityPostureMinimum: 70,
} as const;

export const ADMIN_DASHBOARD_REFRESH_INTERVALS = {
  metricsMs: 30000,
  alertsMs: 15000,
  auditMs: 30000,
} as const;

export type AdminDashboardThresholds = typeof ADMIN_DASHBOARD_THRESHOLDS;
export type AdminDashboardRefreshIntervals = typeof ADMIN_DASHBOARD_REFRESH_INTERVALS;
