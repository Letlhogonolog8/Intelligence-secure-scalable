import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import CounselorDashboard from "@/components/dashboard/CounselorDashboard";

const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUseAlertsFeed = vi.fn();
const mockUseEscalationReviews = vi.fn();
const mockUseOrganizationCoordination = vi.fn();
const mockUseLiveJusticeCases = vi.fn();
const mockUseLiveSafetyPlans = vi.fn();
const mockUseLiveSurvivorChatSessions = vi.fn();
const mockUseLiveSurvivors = vi.fn();

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
  useLiveJusticeCases: (...args: unknown[]) => mockUseLiveJusticeCases(...args),
  useLiveSafetyPlans: (...args: unknown[]) => mockUseLiveSafetyPlans(...args),
  useLiveSurvivorChatSessions: (...args: unknown[]) =>
    mockUseLiveSurvivorChatSessions(...args),
  useLiveSurvivors: (...args: unknown[]) => mockUseLiveSurvivors(...args),
}));

vi.mock("@/components/evidence/SharedEvidencePanel", () => ({
  default: () => <div>mock-shared-evidence</div>,
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

describe("CounselorDashboard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "counselor-1" },
      session: { expires_at: 1767225600 },
    });
    mockUseAppStore.mockReturnValue({ setActiveModule: vi.fn() });
    mockUseUserProfile.mockReturnValue({ data: { role: "counselor" } });
    mockUseLiveJusticeCases.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveSurvivorChatSessions.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUseLiveSurvivors.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveSafetyPlans.mockReturnValue({ data: [], isLoading: false });
    mockUseEscalationReviews.mockReturnValue({ data: [], isLoading: false });
    mockUseAlertsFeed.mockReturnValue({ data: [], isLoading: false });
    mockUseOrganizationCoordination.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("blocks non-counselor users from the dashboard", () => {
    mockUseUserProfile.mockReturnValue({ data: { role: "admin" } });

    render(<CounselorDashboard />);

    expect(screen.getByText("Counselor access required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account does not have the required privileges to view the counselor operations board.",
      ),
    ).toBeInTheDocument();
  });

  it("shows empty-state guidance when no live counselor data is available", () => {
    render(<CounselorDashboard />);

    expect(screen.getByText("Counselor operations board")).toBeInTheDocument();
    expect(screen.getByText("No new alerts")).toBeInTheDocument();
    expect(screen.getByText("No active queue items")).toBeInTheDocument();
    expect(screen.getByText("No session flow yet")).toBeInTheDocument();
  });

  it("gates counselor queries until the counselor profile context is available", () => {
    mockUseUserProfile.mockReturnValue({ data: undefined });

    render(<CounselorDashboard />);

    expect(mockUseLiveJusticeCases).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, assignedTo: "counselor-1" }),
    );
    expect(mockUseLiveSurvivorChatSessions).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, counselorId: "counselor-1" }),
    );
    expect(mockUseLiveSurvivors).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
