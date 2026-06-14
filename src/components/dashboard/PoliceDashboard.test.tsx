import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import PoliceDashboard from "@/components/dashboard/PoliceDashboard";

const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseQueryClient = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUsePoliceAlertsFeed = vi.fn();
const mockUseOrganizationCoordination = vi.fn();
const mockUseLiveOrganization = vi.fn();
const mockUseLivePoliceDepartments = vi.fn();
const mockUseLiveUserProfiles = vi.fn();
const mockUseLiveJusticeCases = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/store/appStore", () => ({
  useAppStore: () => mockUseAppStore(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mockUseQueryClient(),
  };
});

vi.mock("@/data/aegisData", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
  usePoliceAlertsFeed: (...args: unknown[]) => mockUsePoliceAlertsFeed(...args),
  useOrganizationCoordination: (...args: unknown[]) =>
    mockUseOrganizationCoordination(...args),
  useEscalationRealtime: () => undefined,
  acknowledgePoliceAlert: vi.fn(),
  deleteAlert: vi.fn(),
  deleteAllAlerts: vi.fn(),
}));

vi.mock("@/data/liveDashboardData", () => ({
  useLiveOrganization: (...args: unknown[]) => mockUseLiveOrganization(...args),
  useLivePoliceDepartments: (...args: unknown[]) =>
    mockUseLivePoliceDepartments(...args),
  useLiveUserProfiles: (...args: unknown[]) => mockUseLiveUserProfiles(...args),
  useLiveJusticeCases: (...args: unknown[]) => mockUseLiveJusticeCases(...args),
}));

vi.mock("@/components/dashboard/CaseStatusLookup", () => ({
  CaseStatusLookup: () => <div>mock-case-lookup</div>,
}));

vi.mock("@/components/voice/VoiceNoteTranslator", () => ({
  default: () => <div>mock-voice-translator</div>,
}));

vi.mock("@/components/voice/VoiceEvidenceArchive", () => ({
  default: () => <div>mock-voice-archive</div>,
}));

vi.mock("@/components/evidence/SharedEvidencePanel", () => ({
  default: () => <div>mock-shared-evidence</div>,
}));

vi.mock("@/components/community/CommunityReportsPanel", () => ({
  default: () => <div>mock-community-reports</div>,
}));

vi.mock("@/components/police/AiCaseAssistantPanel", () => ({
  default: () => <div>mock-ai-case-assistant</div>,
}));

vi.mock("@/components/justice/CaseDispatchDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/justice/FileIncidentDialog", () => ({
  default: () => null,
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

describe("PoliceDashboard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "police-1" },
      session: { expires_at: 1767225600 },
    });
    mockUseAppStore.mockReturnValue({ setActiveModule: vi.fn() });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseUserProfile.mockReturnValue({
      data: { role: "police", organizationId: "org-1" },
    });
    mockUseLiveOrganization.mockReturnValue({
      data: { id: "org-1", name: "Metro Police", region: "Gauteng" },
    });
    mockUseLivePoliceDepartments.mockReturnValue({
      data: [
        {
          id: "dept-1",
          regionId: "region-1",
          departmentName: "Metro South",
          jurisdictionLevel: "regional",
          jurisdictionName: "Johannesburg South",
          isActive: true,
        },
      ],
      isLoading: false,
    });
    mockUseLiveUserProfiles.mockReturnValue({
      data: [
        { id: "u1", role: "police", isActive: true },
        { id: "u2", role: "police", isActive: true },
      ],
      isLoading: false,
    });
    mockUseLiveJusticeCases.mockReturnValue({ data: [], isLoading: false });
    mockUsePoliceAlertsFeed.mockReturnValue({ data: [], isLoading: false });
    mockUseOrganizationCoordination.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("blocks non-police users from the dashboard", () => {
    mockUseUserProfile.mockReturnValue({
      data: { role: "admin", organizationId: "org-1" },
    });

    render(<PoliceDashboard />);

    expect(screen.getByText("Police access required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account does not have the required privileges to view the police operations dashboard.",
      ),
    ).toBeInTheDocument();
  });

  it("shows empty-state guidance when no live police data is available", () => {
    render(<PoliceDashboard />);

    expect(screen.getByText("Police emergency response")).toBeInTheDocument();
    expect(screen.getByText("Queue is clear")).toBeInTheDocument();
    expect(screen.getByText("No unacknowledged alerts")).toBeInTheDocument();
    expect(screen.getByText("No coordination events")).toBeInTheDocument();
    expect(screen.getByText("No urgent follow-up")).toBeInTheDocument();
  });

  it("normalizes police queue, alert, and referral inputs before rendering", () => {
    mockUseLiveJusticeCases.mockReturnValue({
      data: [
        {
          id: "case-1",
          caseNumber: "A-102",
          stage: null,
          region: "",
          regionId: "region-1",
          priority: "CRITICAL",
          status: "OPEN",
          updatedAt: "2026-03-31T10:00:00Z",
          assignedTo: "",
          assignedPoliceDepartmentId: "dept-1",
        },
      ],
      isLoading: false,
    });
    mockUsePoliceAlertsFeed.mockReturnValue({
      data: [
        {
          id: "alert-1",
          type: "CRITICAL",
          message: "Officer assistance required",
          module: null,
          time: null,
          status: "PENDING",
        },
      ],
      isLoading: false,
    });
    mockUseOrganizationCoordination.mockReturnValue({
      data: [
        {
          id: "ref-1",
          caseId: "case-1-referral",
          referralType: null,
          status: "PENDING",
          createdAt: "2026-03-31T11:00:00Z",
        },
      ],
      isLoading: false,
    });

    render(<PoliceDashboard />);

    expect(screen.getAllByText("Case A-102")[0]).toBeInTheDocument();
    expect(
      screen.getByText(/intake.*Region pending.*updated/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Officer assistance required")).toBeInTheDocument();
    expect(screen.getByText(/core.*--.*response: 5min/i)).toBeInTheDocument();
    expect(screen.getByText(/Referral case-1-r/i)).toBeInTheDocument();
    expect(
      screen.getByText("Reduce unassigned investigations"),
    ).toBeInTheDocument();
  });

  it("gates jurisdiction queries until the police profile context is available", () => {
    mockUseUserProfile.mockReturnValue({ data: undefined });
    mockUseLivePoliceDepartments.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<PoliceDashboard />);

    expect(mockUseLiveOrganization).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ enabled: false }),
    );
    expect(mockUseLivePoliceDepartments).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, organizationId: null }),
    );
    expect(mockUseLiveJusticeCases).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, regionId: null }),
    );
  });
});
