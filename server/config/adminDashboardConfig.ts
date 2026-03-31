export interface AdminDashboardConfig {
  thresholds: {
    pendingApprovalsWarning: number;
    unresolvedEscalationsWarning: number;
    pendingDeletionRequestsWarning: number;
    securityPostureMinimum: number;
  };
  refresh: {
    metricsMs: number;
    alertsMs: number;
    auditMs: number;
  };
}

const toPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const ADMIN_DASHBOARD_CONFIG: AdminDashboardConfig = {
  thresholds: {
    pendingApprovalsWarning: toPositiveInteger(process.env.ADMIN_PENDING_APPROVALS_WARNING, 5),
    unresolvedEscalationsWarning: toPositiveInteger(process.env.ADMIN_UNRESOLVED_ESCALATIONS_WARNING, 3),
    pendingDeletionRequestsWarning: toPositiveInteger(process.env.ADMIN_PENDING_DELETION_REQUESTS_WARNING, 3),
    securityPostureMinimum: toPositiveInteger(process.env.ADMIN_SECURITY_POSTURE_MINIMUM, 70),
  },
  refresh: {
    metricsMs: toPositiveInteger(process.env.ADMIN_METRICS_REFRESH_MS, 30000),
    alertsMs: toPositiveInteger(process.env.ADMIN_ALERTS_REFRESH_MS, 15000),
    auditMs: toPositiveInteger(process.env.ADMIN_AUDIT_REFRESH_MS, 30000),
  },
};
