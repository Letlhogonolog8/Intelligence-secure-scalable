import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PersonalDashboard from "@/components/survivor/PersonalDashboard";

const mockUseAuth = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseUserProfile = vi.fn();
const mockUseAlertsFeed = vi.fn();
const mockSetActiveModule = vi.fn();
const mockRefetchAlerts = vi.fn();

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
    mockRefetchAlerts.mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({ user: { id: "survivor-user-1" } });
    mockUseAppStore.mockReturnValue({ setActiveModule: mockSetActiveModule });
    mockUseUserProfile.mockReturnValue({
      data: { fullName: "Amina" },
      isLoading: false,
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
    expect(screen.getByText("Appointment reminder")).toBeInTheDocument();
    expect(screen.getAllByText("Plan updated")).toHaveLength(1);
  });

  it("routes support-related buttons to survivor support", async () => {
    const user = userEvent.setup();
    render(<PersonalDashboard />);

    await user.click(screen.getByRole("button", { name: "Update Plan" }));
    await user.click(screen.getByRole("button", { name: "New Support Request" }));
    await user.click(screen.getByRole("button", { name: "Review Plan" }));
    await user.click(screen.getByRole("button", { name: "View Contacts" }));
    await user.click(screen.getByRole("button", { name: "Message" }));

    expect(mockSetActiveModule).toHaveBeenCalledTimes(5);
    expect(mockSetActiveModule).toHaveBeenCalledWith("survivor_support");
  });

  it("refreshes recent updates and restores button state", async () => {
    const user = userEvent.setup();
    render(<PersonalDashboard />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(mockRefetchAlerts).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
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
    await user.click(screen.getByRole("button", { name: "Call" }));

    expect(window.location.href).toBe("tel:+2710111");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
