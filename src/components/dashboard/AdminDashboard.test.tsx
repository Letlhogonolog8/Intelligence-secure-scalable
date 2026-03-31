import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUseLiveUserProfiles = vi.fn();
const mockUseSystemMetrics = vi.fn();
const mockUseIncidentTimeSeries = vi.fn();
const mockUseAlertsFeed = vi.fn();
const mockUseAuditLogs = vi.fn();
const mockUseAdminDashboardConfig = vi.fn();
const mockUseEscalationReviews = vi.fn();
const mockUseDeletionRequests = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/store/appStore", () => ({
  useAppStore: () => mockUseAppStore(),
}));

vi.mock("@/data/liveDashboardData", () => ({
  useLiveUserProfiles: (...args: unknown[]) => mockUseLiveUserProfiles(...args),
}));

vi.mock("@/data/aegisData", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
  useSystemMetrics: (...args: unknown[]) => mockUseSystemMetrics(...args),
  useIncidentTimeSeries: (...args: unknown[]) => mockUseIncidentTimeSeries(...args),
  useAlertsFeed: (...args: unknown[]) => mockUseAlertsFeed(...args),
  useAuditLogs: (...args: unknown[]) => mockUseAuditLogs(...args),
  useAdminDashboardConfig: (...args: unknown[]) => mockUseAdminDashboardConfig(...args),
  useEscalationReviews: (...args: unknown[]) => mockUseEscalationReviews(...args),
  useDeletionRequests: (...args: unknown[]) => mockUseDeletionRequests(...args),
}));

vi.mock("@/components/dashboard/CaseStatusLookup", () => ({
  CaseStatusLookup: () => <div>mock-case-lookup</div>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
  AreaChart: () => <div />,
  Area: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("AdminDashboard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" } });
    mockUseAppStore.mockReturnValue({ setActiveModule: vi.fn() });
    mockUseUserProfile.mockReturnValue({ data: { role: "admin" } });
    mockUseLiveUserProfiles.mockReturnValue({ data: [], isLoading: false });
    mockUseSystemMetrics.mockReturnValue({
      data: { systemUptime: 99, encryptionStatus: "active", apiRequestsToday: 1234, dataPointsProcessed: "50k", activeAlerts: 0 },
      isLoading: false,
    });
    mockUseIncidentTimeSeries.mockReturnValue({ data: [{ date: "2026-03-20", value: 4 }, { date: "2026-03-21", value: 5 }], isLoading: false });
    mockUseAlertsFeed.mockReturnValue({ data: [], isLoading: false });
    mockUseAuditLogs.mockReturnValue({ data: [], isLoading: false });
    mockUseAdminDashboardConfig.mockReturnValue({ data: undefined, isLoading: false });
    mockUseEscalationReviews.mockReturnValue({ data: [], isLoading: false });
    mockUseDeletionRequests.mockReturnValue({ data: [], isLoading: false });
  });

  it("blocks non-admin users from the oversight console", () => {
    mockUseUserProfile.mockReturnValue({ data: { role: "survivor" } });

    render(<AdminDashboard />);

    expect(screen.getByText("Administrative access required")).toBeInTheDocument();
    expect(screen.getByText("Your account does not have the required privileges to view the oversight console.")).toBeInTheDocument();
  });

  it("shows live-data guidance when admin sources are empty", () => {
    mockUseIncidentTimeSeries.mockReturnValue({ data: [], isLoading: false });

    render(<AdminDashboard />);

    expect(screen.getByText("Administrative oversight")).toBeInTheDocument();
    expect(screen.getByText("No governance telemetry yet")).toBeInTheDocument();
    expect(screen.getByText("No profiles available")).toBeInTheDocument();
    expect(screen.getByText("Approve and activate role access so live identity coverage can populate this view.")).toBeInTheDocument();
    expect(screen.getByText("No system alerts")).toBeInTheDocument();
    expect(screen.getByText("Platform, security, and governance notices will appear here when the system detects something that needs review.")).toBeInTheDocument();
  });

  it("renders admin metrics from live user and alert data", () => {
    mockUseLiveUserProfiles.mockReturnValue({
      data: [
        { id: "1", role: "admin", isActive: true, approvalStatus: "approved" },
        { id: "2", role: "analyst", isActive: true, approvalStatus: "pending" },
        { id: "3", role: "police", isActive: false, approvalStatus: "approved" },
      ],
      isLoading: false,
    });
    mockUseAlertsFeed.mockReturnValue({
      data: [{ id: "a1", type: "critical", message: "Data drift detected", module: "governance", time: "now" }],
      isLoading: false,
    });
    mockUseAuditLogs.mockReturnValue({
      data: [{ time: "2026-03-20T10:00:00Z", action: "Role updated", module: "identity", user: "Admin", severity: "warning" }],
      isLoading: false,
    });

    render(<AdminDashboard />);

    expect(screen.getByText("3 profiles tracked")).toBeInTheDocument();
    expect(screen.getByText("1 pending approvals")).toBeInTheDocument();
    expect(screen.getByText("Data drift detected")).toBeInTheDocument();
    expect(screen.getByText("Role updated")).toBeInTheDocument();
    expect(screen.getByText("Recommended actions")).toBeInTheDocument();
    expect(screen.getByText("Investigate critical alerts")).toBeInTheDocument();
    expect(screen.getByText("Threshold notifications")).toBeInTheDocument();
    expect(screen.getByText("Critical monitoring signals detected")).toBeInTheDocument();
  });

  it("normalizes audit and alert inputs before rendering admin operational widgets", () => {
    mockUseAlertsFeed.mockReturnValue({
      data: [{ id: "a1", type: "CRITICAL", message: "Policy drift", module: null, time: null }],
      isLoading: false,
    });
    mockUseAuditLogs.mockReturnValue({
      data: [{ time: "2026-03-20T10:00:00Z", action: "Permission reviewed", module: null, user: null, severity: "ERROR" }],
      isLoading: false,
    });

    render(<AdminDashboard />);

    expect(screen.getByText("Policy drift")).toBeInTheDocument();
    expect(screen.getByText("Permission reviewed")).toBeInTheDocument();
    expect(screen.getByText(/system • core •/i)).toBeInTheDocument();
  });

  it("applies backend-provided thresholds and refresh intervals", () => {
    mockUseAdminDashboardConfig.mockReturnValue({
      data: {
        thresholds: {
          pendingApprovalsWarning: 1,
          unresolvedEscalationsWarning: 2,
          pendingDeletionRequestsWarning: 1,
          securityPostureMinimum: 95,
        },
        refresh: {
          metricsMs: 45000,
          alertsMs: 9000,
          auditMs: 60000,
        },
      },
      isLoading: false,
    });
    mockUseLiveUserProfiles.mockReturnValue({
      data: [{ id: "1", role: "analyst", isActive: true, approvalStatus: "pending" }],
      isLoading: false,
    });
    mockUseSystemMetrics.mockReturnValue({
      data: { systemUptime: 70, encryptionStatus: "inactive", apiRequestsToday: 1234, dataPointsProcessed: "50k", activeAlerts: 1 },
      isLoading: false,
    });
    mockUseAlertsFeed.mockReturnValue({
      data: [{ id: "a1", type: "critical", message: "Backlog pressure", module: "governance", time: "now" }],
      isLoading: false,
    });
    mockUseDeletionRequests.mockReturnValue({
      data: [{ id: "d1", status: "pending" }],
      isLoading: false,
    });

    render(<AdminDashboard />);

    expect(screen.getByText("Alerts 9s • Metrics 45s")).toBeInTheDocument();
    expect(screen.getByText(/Approval 1, escalations 2, privacy 1, posture minimum 95%./i)).toBeInTheDocument();
    expect(screen.getByText("Approval queue threshold breached")).toBeInTheDocument();
    expect(screen.getByText("Privacy processing queue is elevated")).toBeInTheDocument();
    expect(screen.getByText("Security posture is below target")).toBeInTheDocument();
  });
});
