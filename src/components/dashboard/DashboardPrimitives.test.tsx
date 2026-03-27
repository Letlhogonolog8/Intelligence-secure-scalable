import { fireEvent, render, screen } from "@testing-library/react";
import { EmptyState, MetricCard } from "@/components/dashboard/DashboardPrimitives";

describe("DashboardPrimitives", () => {
  it("renders empty-state guidance and action controls", () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        title="No live data"
        description="Waiting for realtime sync."
        guidance={[
          "Confirm the backing table contains rows.",
          "Verify role-based access policies allow reads.",
        ]}
        actionLabel="Retry"
        onAction={onAction}
      />
    );

    expect(screen.getByText("No live data")).toBeInTheDocument();
    expect(screen.getByText("How to unblock live data")).toBeInTheDocument();
    expect(screen.getByText("Confirm the backing table contains rows.")).toBeInTheDocument();
    expect(screen.getByText("Verify role-based access policies allow reads.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders loading and resolved metric states", () => {
    const { rerender } = render(
      <MetricCard label="Open cases" value={12} helper="Updated just now" accent="rose" loading />
    );

    expect(screen.queryByText("12")).not.toBeInTheDocument();

    rerender(<MetricCard label="Open cases" value={12} helper="Updated just now" accent="rose" />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Updated just now")).toBeInTheDocument();
  });
});
