import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
const mockUseQueryClient = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => mockUseQueryClient(),
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/store/appStore", () => ({
  useAppStore: () => mockUseAppStore(),
}));

vi.mock("@/hooks/useDocumentVisibility", () => ({
  useDocumentVisibility: () => true,
}));

vi.mock("@/data/liveDashboardData", () => ({
  useLiveUserProfiles: (...args: unknown[]) => mockUseLiveUserProfiles(...args),
}));

vi.mock("@/data/aegisData", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
  useSystemMetrics: (...args: unknown[]) => mockUseSystemMetrics(...args),
  useIncidentTimeSeries: (...args: unknown[]) =>
    mockUseIncidentTimeSeries(...args),
  useAlertsFeed: (...args: unknown[]) => mockUseAlertsFeed(...args),
  useAuditLogs: (...args: unknown[]) => mockUseAuditLogs(...args),
  useAdminDashboardConfig: (...args: unknown[]) =>
    mockUseAdminDashboardConfig(...args),
  useEscalationReviews: (...args: unknown[]) =>
    mockUseEscalationReviews(...args),
  useDeletionRequests: (...args: unknown[]) => mockUseDeletionRequests(...args),
}));

vi.mock("@/components/dashboard/CaseStatusLookup", () => ({
  CaseStatusLookup: () => <div>mock-case-lookup</div>,
}));

vi.mock("@/components/admin/MFAEnforcementPanel", () => ({
  MFAEnforcementPanel: () => <div>mock-mfa-panel</div>,
}));

vi.mock("@/components/voice/VoiceEvidenceArchive", () => ({
  default: () => <div>mock-voice-archive</div>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  AreaChart: () => <div />,
  Area: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("AdminDashboard", () => {
  beforeEach(() => {
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    });
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" } });
    mockUseAppStore.mockReturnValue({ setActiveModule: vi.fn() });
    mockUseUserProfile.mockReturnValue({
      data: { role: "admin" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseLiveUserProfiles.mockReturnValue({ ...idle, data: [] });
    mockUseSystemMetrics.mockReturnValue({
      ...idle,
      data: {
        systemUptime: 99,
        encryptionStatus: "active",
        apiRequestsToday: 1234,
        dataPointsProcessed: "50k",
        activeAlerts: 0,
      },
    });
    mockUseIncidentTimeSeries.mockReturnValue({
      ...idle,
      data: [
        { date: "2026-03-20", value: 4 },
        { date: "2026-03-21", value: 5 },
      ],
    });
    mockUseAlertsFeed.mockReturnValue({ ...idle, data: [] });
    mockUseAuditLogs.mockReturnValue({ ...idle, data: [] });
    mockUseAdminDashboardConfig.mockReturnValue({ ...idle, data: undefined });
    mockUseEscalationReviews.mockReturnValue({ ...idle, data: [] });
    mockUseDeletionRequests.mockReturnValue({ ...idle, data: [] });
  });

  it("shows a loading skeleton while the administrator profile is loading", () => {
    mockUseUserProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<AdminDashboard />);

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(
      screen.getByLabelText("Loading admin dashboard"),
    ).toBeInTheDocument();
  });

  it("shows profile error state when the administrator profile fails to load", () => {
    mockUseUserProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network"),
      refetch: vi.fn(),
    });

    render(<AdminDashboard />);

    expect(
      screen.getByText("Unable to load administrator profile"),
    ).toBeInTheDocument();
  });

  it("blocks non-admin users from the oversight console", () => {
    mockUseUserProfile.mockReturnValue({
      data: { role: "survivor" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AdminDashboard />);

    expect(
      screen.getByText("Administrative access required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account does not have the required privileges to view the oversight console.",
      ),
    ).toBeInTheDocument();
  });

  it("shows live-data guidance when admin sources are empty", () => {
    mockUseIncidentTimeSeries.mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AdminDashboard />);

    expect(screen.getByText("Administrative oversight")).toBeInTheDocument();
    // Overview tab (default): governance telemetry + identity mix.
    expect(screen.getByText("No governance telemetry yet")).toBeInTheDocument();
    expect(screen.getByText("No profiles available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Approve and activate role access so live identity coverage can populate this view.",
      ),
    ).toBeInTheDocument();

    // Queues & audit tab: live alert feed.
    fireEvent.click(screen.getByRole("tab", { name: "Queues & audit" }));
    expect(screen.getByText("No system alerts")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Platform, security, and governance notices will appear here when the system detects something that needs review.",
      ),
    ).toBeInTheDocument();
  });

  it("renders admin metrics from live user and alert data", () => {
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseLiveUserProfiles.mockReturnValue({
      ...idle,
      data: [
        {
          id: "1",
          role: "admin",
          isActive: true,
          approvalStatus: "approved",
          mfaEnabled: true,
        },
        {
          id: "2",
          role: "analyst",
          isActive: true,
          approvalStatus: "pending",
          mfaEnabled: false,
        },
        {
          id: "3",
          role: "police",
          isActive: false,
          approvalStatus: "approved",
          mfaEnabled: true,
        },
      ],
    });
    mockUseAlertsFeed.mockReturnValue({
      ...idle,
      data: [
        {
          id: "a1",
          type: "critical",
          message: "Data drift detected",
          module: "governance",
          time: "now",
        },
      ],
    });
    mockUseAuditLogs.mockReturnValue({
      ...idle,
      data: [
        {
          time: "2026-03-20T10:00:00Z",
          action: "Role updated",
          module: "identity",
          user: "Admin",
          severity: "warning",
        },
      ],
    });

    render(<AdminDashboard />);

    // Metric strip + hero badge are always visible.
    expect(screen.getByText("3 profiles tracked")).toBeInTheDocument();
    expect(screen.getByText("1 pending approvals")).toBeInTheDocument();

    // Queues & audit tab: alerts, audit trail, recommended actions, thresholds.
    fireEvent.click(screen.getByRole("tab", { name: "Queues & audit" }));
    expect(screen.getByText("Data drift detected")).toBeInTheDocument();
    expect(screen.getByText("Role updated")).toBeInTheDocument();
    expect(screen.getByText("Recommended actions")).toBeInTheDocument();
    expect(screen.getByText("Investigate critical alerts")).toBeInTheDocument();
    expect(screen.getByText("Threshold notifications")).toBeInTheDocument();
    expect(
      screen.getByText("Critical monitoring signals detected"),
    ).toBeInTheDocument();
  });

  it("shows MFA coverage badge when privileged users are present", () => {
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseLiveUserProfiles.mockReturnValue({
      ...idle,
      data: [
        {
          id: "1",
          role: "analyst",
          isActive: true,
          approvalStatus: "approved",
          mfaEnabled: true,
        },
        {
          id: "2",
          role: "counselor",
          isActive: true,
          approvalStatus: "approved",
          mfaEnabled: true,
        },
        {
          id: "3",
          role: "police",
          isActive: true,
          approvalStatus: "approved",
          mfaEnabled: false,
        },
        {
          id: "4",
          role: "survivor",
          isActive: true,
          approvalStatus: "approved",
          mfaEnabled: false,
        },
      ],
    });

    render(<AdminDashboard />);

    expect(screen.getByText("67% MFA coverage")).toBeInTheDocument();
  });

  it("omits MFA coverage badge when no privileged users exist", () => {
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseLiveUserProfiles.mockReturnValue({
      ...idle,
      data: [
        {
          id: "1",
          role: "survivor",
          isActive: true,
          approvalStatus: "approved",
          mfaEnabled: false,
        },
      ],
    });

    render(<AdminDashboard />);

    expect(screen.queryByText(/MFA coverage/)).not.toBeInTheDocument();
  });

  it("normalizes decimal systemUptime (0–1 range) into percent for security posture", () => {
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseSystemMetrics.mockReturnValue({
      ...idle,
      data: {
        systemUptime: 0.995,
        encryptionStatus: "active",
        apiRequestsToday: 0,
        dataPointsProcessed: "0",
        activeAlerts: 0,
      },
    });

    render(<AdminDashboard />);

    const postureBadges = screen.getAllByText(/security posture/i);
    const heroBadge = postureBadges.find((el) => el.tagName === "SPAN");
    const pct = parseInt(heroBadge?.textContent ?? "0");
    expect(pct).toBeGreaterThan(90);
  });

  it("normalizes audit and alert inputs before rendering admin operational widgets", () => {
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseAlertsFeed.mockReturnValue({
      ...idle,
      data: [
        {
          id: "a1",
          type: "CRITICAL",
          message: "Policy drift",
          module: null,
          time: null,
        },
      ],
    });
    mockUseAuditLogs.mockReturnValue({
      ...idle,
      data: [
        {
          time: "2026-03-20T10:00:00Z",
          action: "Permission reviewed",
          module: null,
          user: null,
          severity: "ERROR",
        },
      ],
    });

    render(<AdminDashboard />);

    // Audit trail + alert watch live in the Queues & audit tab.
    fireEvent.click(screen.getByRole("tab", { name: "Queues & audit" }));
    expect(screen.getByText("Policy drift")).toBeInTheDocument();
    expect(screen.getByText("Permission reviewed")).toBeInTheDocument();
    expect(screen.getByText(/system • core •/i)).toBeInTheDocument();
  });

  it("applies backend-provided thresholds and refresh intervals", () => {
    const idle = {
      isPending: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mockUseAdminDashboardConfig.mockReturnValue({
      ...idle,
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
    });
    mockUseLiveUserProfiles.mockReturnValue({
      ...idle,
      data: [
        { id: "1", role: "analyst", isActive: true, approvalStatus: "pending" },
      ],
    });
    mockUseSystemMetrics.mockReturnValue({
      ...idle,
      data: {
        systemUptime: 70,
        encryptionStatus: "inactive",
        apiRequestsToday: 1234,
        dataPointsProcessed: "50k",
        activeAlerts: 1,
      },
    });
    mockUseAlertsFeed.mockReturnValue({
      ...idle,
      data: [
        {
          id: "a1",
          type: "critical",
          message: "Backlog pressure",
          module: "governance",
          time: "now",
        },
      ],
    });
    mockUseDeletionRequests.mockReturnValue({
      ...idle,
      data: [{ id: "d1", status: "pending" }],
    });

    render(<AdminDashboard />);

    // Overview tab (default): priority board refresh-cadence pill.
    expect(screen.getByText("Alerts 9s • Metrics 45s")).toBeInTheDocument();

    // Queues & audit tab: threshold notifications + efficiency notes.
    fireEvent.click(screen.getByRole("tab", { name: "Queues & audit" }));
    expect(
      screen.getByText(
        /Approval 1, escalations 2, privacy 1, posture minimum 95%./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Approval queue threshold breached"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Privacy processing queue is elevated"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Security posture is below target"),
    ).toBeInTheDocument();
  });
});
