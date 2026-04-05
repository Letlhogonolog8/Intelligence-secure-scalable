import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PersonalDashboard from "@/components/survivor/PersonalDashboard";

const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUseAlertsFeed = vi.fn();
const mockSetActiveModule = vi.fn();
const mockRefetchAlerts = vi.fn();
const mockRefetchProfile = vi.fn();

const { mockRefetchSource } = vi.hoisted(() => ({
  mockRefetchSource: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/survivor/useSurvivorPersonalSourceData", () => ({
  useSurvivorPersonalSourceData: () => ({
    payload: {
      survivor: null,
      safetyPlans: [],
      caseReports: [],
      chatSessions: [],
    },
    isLoading: false,
    refetchSource: mockRefetchSource,
  }),
}));

vi.mock("@/hooks/survivor/usePrefetchSurvivorNavigation", () => ({
  usePrefetchSurvivorPersonalData: () => vi.fn(),
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
}));

describe("PersonalDashboard", () => {
  beforeEach(() => {
    mockSetActiveModule.mockReset();
    mockRefetchAlerts.mockReset();
    mockRefetchProfile.mockReset();
    mockRefetchSource.mockReset();
    mockRefetchAlerts.mockResolvedValue(undefined);
    mockRefetchProfile.mockResolvedValue(undefined);
    mockRefetchSource.mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({ user: { id: "survivor-user-1" } });
    mockUseAppStore.mockReturnValue({ setActiveModule: mockSetActiveModule });
    mockUseUserProfile.mockReturnValue({
      data: { fullName: "Amina" },
      isLoading: false,
      refetch: mockRefetchProfile,
    });
    mockUseAlertsFeed.mockReturnValue({
      data: [
        { id: "1", module: "support", type: "notice", message: "Plan updated", time: "now" },
        { id: "2", module: "support", type: "notice", message: "Plan updated", time: "later" },
        { id: "3", module: "support", type: "info", message: "Appointment reminder", time: "today" },
      ],
      isLoading: false,
      refetch: mockRefetchAlerts,
    });
  });

  it("renders survivor content and deduplicated recent updates", () => {
    render(<PersonalDashboard />);

    expect(screen.getByText("Personal Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Amina")).toBeInTheDocument();
    expect(screen.getByText("Plan updated")).toBeInTheDocument();
    expect(screen.getAllByText("Appointment reminder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plan updated")).toHaveLength(1);
  });

  it("routes dashboard actions to distinct survivor workflows", async () => {
    const user = userEvent.setup();
    render(<PersonalDashboard />);

    await user.click(screen.getByRole("button", { name: /Update Plan|Open safety plan workspace/ }));
    await user.click(screen.getByRole("button", { name: /New Support Request|Open support requests workspace/ }));
    await user.click(screen.getByRole("button", { name: /Review Plan|Complete Plan/ }));
    await user.click(screen.getByRole("button", { name: /View Contacts|Open trusted contacts workspace/ }));
    await user.click(screen.getByRole("button", { name: /Message|Open secure messaging workspace/ }));
    await user.click(screen.getByRole("button", { name: "View Schedule" }));
    await user.click(screen.getByRole("button", { name: "Manage Contacts" }));
    await user.click(screen.getByRole("button", { name: "Open Vault" }));

    expect(mockSetActiveModule).toHaveBeenCalledTimes(8);
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(1, "safety_plan");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(2, "support_requests");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(3, "safety_plan");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(4, "trusted_contacts");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(5, "secure_messages");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(6, "appointments");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(7, "trusted_contacts");
    expect(mockSetActiveModule).toHaveBeenNthCalledWith(8, "document_vault");
  });

  it("refreshes recent updates and restores button state", async () => {
    const user = userEvent.setup();
    render(<PersonalDashboard />);

    await user.click(screen.getByRole("button", { name: /Refresh|Refresh recent updates/ }));

    expect(mockRefetchAlerts).toHaveBeenCalledTimes(1);
    expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
    expect(mockRefetchSource).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Refresh|Refresh recent updates/ })).toBeEnabled();
    });
  });

  it("opens the emergency hotline via tel link", async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/" },
    });

    render(<PersonalDashboard />);
    await user.click(screen.getByRole("button", { name: /Call|GBV|crisis/ }));

    expect(window.location.href).toBe("tel:0800428428");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
