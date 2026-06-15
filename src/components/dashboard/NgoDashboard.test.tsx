import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import NgoDashboard from "@/components/dashboard/NgoDashboard";

const mockUseOrganizationContext = vi.fn();
const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUseAlertsFeed = vi.fn();
const mockUseEscalationReviews = vi.fn();
const mockUseOrganizationCoordination = vi.fn();
const mockUseLiveNgoPrograms = vi.fn();
const mockUseLiveOrganization = vi.fn();
const mockUseLiveResources = vi.fn();
const mockUseLiveSurvivors = vi.fn();
const mockUseLiveUserProfiles = vi.fn();

vi.mock("@/contexts/organizationContext", () => ({
  useOrganizationContext: () => mockUseOrganizationContext(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/store/appStore", () => ({
  useAppStore: () => mockUseAppStore(),
}));

vi.mock("@/data/aegisData", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
  useAlertsFeed: (...args: unknown[]) => mockUseAlertsFeed(...args),
  useEscalationReviews: (...args: unknown[]) =>
    mockUseEscalationReviews(...args),
  useOrganizationCoordination: (...args: unknown[]) =>
    mockUseOrganizationCoordination(...args),
}));

vi.mock("@/data/liveDashboardData", () => ({
  useLiveNgoPrograms: (...args: unknown[]) => mockUseLiveNgoPrograms(...args),
  useLiveOrganization: (...args: unknown[]) => mockUseLiveOrganization(...args),
  useLiveResources: (...args: unknown[]) => mockUseLiveResources(...args),
  useLiveSurvivors: (...args: unknown[]) => mockUseLiveSurvivors(...args),
  useLiveUserProfiles: (...args: unknown[]) => mockUseLiveUserProfiles(...args),
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

vi.mock("@/components/coordination/CoordinationBoard", () => ({
  default: () => <div>mock-coordination-board</div>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  BarChart: () => <div />,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("NgoDashboard", () => {
  beforeEach(() => {
    mockUseOrganizationContext.mockReturnValue({
      organizationId: "org-1",
      organizationName: "Safe Network",
    });
    mockUseAuth.mockReturnValue({
      user: { id: "ngo-1" },
      session: { expires_at: 1767225600 },
    });
    mockUseAppStore.mockReturnValue({ setActiveModule: vi.fn() });
    mockUseUserProfile.mockReturnValue({
      data: { role: "ngo", organizationId: "org-1" },
    });
    mockUseLiveOrganization.mockReturnValue({
      data: {
        id: "org-1",
        name: "Safe Network",
        region: "Gauteng",
        isVerified: true,
        subscriptionLevel: "standard",
      },
    });
    mockUseLiveUserProfiles.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveSurvivors.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveNgoPrograms.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveResources.mockReturnValue({ data: [], isLoading: false });
    mockUseOrganizationCoordination.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUseAlertsFeed.mockReturnValue({ data: [], isLoading: false });
    mockUseEscalationReviews.mockReturnValue({ data: [], isLoading: false });
  });

  it("blocks non-ngo users from the dashboard", () => {
    mockUseUserProfile.mockReturnValue({
      data: { role: "police", organizationId: "org-1" },
    });

    render(<NgoDashboard />);

    expect(screen.getByText("NGO access required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account does not have the required privileges to view the NGO operations hub.",
      ),
    ).toBeInTheDocument();
  });

  it("shows empty-state guidance when no live ngo data is available", () => {
    render(<NgoDashboard />);

    expect(screen.getByText("Safe Network hub")).toBeInTheDocument();
    // Operations tab (default): referral pipeline + realtime alerts.
    expect(screen.getByText("No referral activity yet")).toBeInTheDocument();
    expect(screen.getByText("No active alerts")).toBeInTheDocument();

    // Programs & trends tab: flow trend + program registry + escalation watch.
    fireEvent.click(screen.getByRole("tab", { name: "Programs & trends" }));
    expect(screen.getByText("No referral flow yet")).toBeInTheDocument();
    expect(
      screen.getByText("No active programs configured"),
    ).toBeInTheDocument();
    expect(screen.getByText("No urgent escalation items")).toBeInTheDocument();
  });

  it("gates ngo queries until the ngo profile context is available", () => {
    mockUseUserProfile.mockReturnValue({ data: undefined });

    render(<NgoDashboard />);

    expect(mockUseLiveOrganization).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ enabled: false }),
    );
    expect(mockUseLiveUserProfiles).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, organizationId: "org-1" }),
    );
    expect(mockUseLiveNgoPrograms).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, organizationId: "org-1" }),
    );
  });
});
