import { render, screen } from "@testing-library/react";
import SurvivorDashboard from "@/components/dashboard/SurvivorDashboard";

const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseTranslation = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUseAlertsFeed = vi.fn();
const mockUseLiveSurvivors = vi.fn();
const mockUseLiveSafetyPlans = vi.fn();
const mockUseLiveCaseReports = vi.fn();
const mockUseLiveSurvivorChatSessions = vi.fn();
const mockGetOfflineQueueCount = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/store/appStore", () => ({
  useAppStore: () => mockUseAppStore(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => mockUseTranslation(),
}));

vi.mock("@/data/aegisData", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
  useAlertsFeed: (...args: unknown[]) => mockUseAlertsFeed(...args),
}));

vi.mock("@/data/liveDashboardData", () => ({
  useLiveSurvivors: (...args: unknown[]) => mockUseLiveSurvivors(...args),
  useLiveSafetyPlans: (...args: unknown[]) => mockUseLiveSafetyPlans(...args),
  useLiveCaseReports: (...args: unknown[]) => mockUseLiveCaseReports(...args),
  useLiveSurvivorChatSessions: (...args: unknown[]) => mockUseLiveSurvivorChatSessions(...args),
}));

vi.mock("@/components/dashboard/CaseStatusLookup", () => ({
  CaseStatusLookup: () => <div>mock-case-lookup</div>,
}));

vi.mock("@/components/survivor/PeerSupportNetwork", () => ({
  default: () => <div>peer-support-network</div>,
}));

vi.mock("@/components/survivor/SurvivorJourneyVisualizer", () => ({
  default: ({ currentStage }: { currentStage: string }) => <div>journey:{currentStage}</div>,
}));

vi.mock("@/components/survivor/LegalRightsAssistant", () => ({
  default: () => <div>legal-rights-assistant</div>,
}));

vi.mock("@/lib/offlineCaseQueue", () => ({
  getOfflineQueueCount: () => mockGetOfflineQueueCount(),
}));

describe("SurvivorDashboard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "survivor-user-1" } });
    mockUseAppStore.mockReturnValue({ setActiveModule: vi.fn() });
    mockUseTranslation.mockReturnValue({
      t: (key: string, fallback?: string, options?: Record<string, string | number>) => {
        const template = typeof fallback === "string" ? fallback : key;
        return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options?.[token] ?? ""));
      },
    });
    mockUseUserProfile.mockReturnValue({ data: { fullName: "Amina" }, isLoading: false });
    mockUseAlertsFeed.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveSurvivors.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveSafetyPlans.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveCaseReports.mockReturnValue({ data: [], isLoading: false });
    mockUseLiveSurvivorChatSessions.mockReturnValue({ data: [], isLoading: false });
    mockGetOfflineQueueCount.mockReturnValue(2);
  });

  it("shows setup guidance when survivor profile and safety plan are missing", () => {
    render(<SurvivorDashboard />);

    expect(screen.getByText("Profile setup is incomplete")).toBeInTheDocument();
    expect(screen.getByText("Finish profile setup so this account is linked to a survivor record.")).toBeInTheDocument();
    expect(screen.getByText("No safety plan on file")).toBeInTheDocument();
    expect(screen.getByText("Create your first safety plan to unlock trusted contacts, safe places, and coping steps.")).toBeInTheDocument();
  });

  it("renders live survivor metrics when profile data exists", () => {
    mockUseLiveSurvivors.mockReturnValue({
      data: [{ id: "sur-1", fullName: "Amina", currentRiskLevel: "low", supportStatus: "active", location: "Gaborone" }],
      isLoading: false,
    });
    mockUseLiveSafetyPlans.mockReturnValue({
      data: [{
        id: "plan-1",
        survivorId: "sur-1",
        trustedContacts: ["Nora"],
        safeLocations: ["Shelter A"],
        emergencyResources: ["Hotline"],
        identifiedTriggers: ["Night travel"],
        copingStrategies: ["Breathing"],
        createdAt: "2026-03-20T10:00:00Z",
        updatedAt: "2026-03-21T10:00:00Z",
      }],
      isLoading: false,
    });
    mockUseLiveCaseReports.mockReturnValue({
      data: [{
        id: "case-1",
        status: "in_review",
        priority: "high",
        riskScore: 20,
        updatedAt: "2026-03-21T10:00:00Z",
      }],
      isLoading: false,
    });
    mockUseLiveSurvivorChatSessions.mockReturnValue({
      data: [{ id: "session-1", createdAt: "2026-03-21T10:00:00Z", escalatedToCounselor: false }],
      isLoading: false,
    });
    mockUseAlertsFeed.mockReturnValue({
      data: [{ id: "alert-1", type: "critical", message: "Safe corridor updated", module: "community", time: "now" }],
      isLoading: false,
    });

    render(<SurvivorDashboard />);

    expect(screen.getByText("Welcome back, Amina")).toBeInTheDocument();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
    expect(screen.getByText("Safe corridor updated")).toBeInTheDocument();
    expect(screen.queryByText("Profile setup is incomplete")).not.toBeInTheDocument();
    expect(screen.queryByText("No safety plan on file")).not.toBeInTheDocument();
  });
});
