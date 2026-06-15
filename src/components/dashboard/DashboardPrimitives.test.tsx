import { fireEvent, render, screen } from "@testing-library/react";
import {
  ChartFrame,
  EmptyState,
  GlassPanel,
  MetricCard,
  NoticeBanner,
  StatTile,
  TabBar,
} from "@/components/dashboard/DashboardPrimitives";

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
      />,
    );

    expect(screen.getByText("No live data")).toBeInTheDocument();
    expect(screen.getByText("How to unblock live data")).toBeInTheDocument();
    expect(
      screen.getByText("Confirm the backing table contains rows."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Verify role-based access policies allow reads."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders loading and resolved metric states", () => {
    const { rerender } = render(
      <MetricCard
        label="Open cases"
        value={12}
        helper="Updated just now"
        accent="rose"
        loading
      />,
    );

    expect(screen.queryByText("12")).not.toBeInTheDocument();

    rerender(
      <MetricCard
        label="Open cases"
        value={12}
        helper="Updated just now"
        accent="rose"
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Updated just now")).toBeInTheDocument();
  });

  it("renders stat tiles with label, value, and helper text", () => {
    render(
      <StatTile
        label="Critical signals"
        value={7}
        sub="events"
        tone="rose"
        icon={<span data-testid="tile-icon" />}
      />,
    );

    expect(screen.getByText("Critical signals")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("events")).toBeInTheDocument();
    expect(screen.getByTestId("tile-icon")).toBeInTheDocument();
  });

  it("renders an accessible chart frame with custom height", () => {
    render(
      <ChartFrame label="Incident trend over time" height={220}>
        <span>chart-body</span>
      </ChartFrame>,
    );

    const frame = screen.getByRole("img", { name: "Incident trend over time" });
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveStyle({ height: "220px" });
    expect(screen.getByText("chart-body")).toBeInTheDocument();
  });

  it("renders glass panel header with title, subtitle, action, and content", () => {
    render(
      <GlassPanel
        title="Voice tools"
        subtitle="Responder utilities"
        action={<button>configure</button>}
      >
        <p>panel-content</p>
      </GlassPanel>,
    );

    expect(screen.getByText("Voice tools")).toBeInTheDocument();
    expect(screen.getByText("Responder utilities")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "configure" }),
    ).toBeInTheDocument();
    expect(screen.getByText("panel-content")).toBeInTheDocument();
  });

  it("marks the active tab and propagates tab changes", () => {
    const onChange = vi.fn();

    render(
      <TabBar
        tabs={[
          { id: "overview", label: "overview" },
          { id: "visits", label: "visits" },
        ]}
        active="overview"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("tab", { name: "overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "visits" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    fireEvent.click(screen.getByRole("tab", { name: "visits" }));
    expect(onChange).toHaveBeenCalledWith("visits");
  });

  it("exposes an accessible tablist and roving tabindex", () => {
    render(
      <TabBar
        tabs={[
          { id: "overview", label: "overview" },
          { id: "visits", label: "visits" },
        ]}
        active="overview"
        onChange={vi.fn()}
        ariaLabel="Field sections"
      />,
    );

    expect(
      screen.getByRole("tablist", { name: "Field sections" }),
    ).toBeInTheDocument();
    // Only the active tab is in the tab order; inactive tabs are reachable via arrows.
    expect(screen.getByRole("tab", { name: "overview" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "visits" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("moves between tabs with arrow, Home, and End keys", () => {
    const onChange = vi.fn();

    render(
      <TabBar
        tabs={[
          { id: "a", label: "alpha" },
          { id: "b", label: "bravo" },
          { id: "c", label: "charlie" },
        ]}
        active="a"
        onChange={onChange}
      />,
    );

    const tablist = screen.getByRole("tablist");

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("b");

    // Wraps from the first tab to the last on ArrowLeft.
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("c");

    fireEvent.keyDown(tablist, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("c");

    fireEvent.keyDown(tablist, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("renders notice banners with tone content", () => {
    render(
      <NoticeBanner tone="amber">Offline — 3 reports queued</NoticeBanner>,
    );

    expect(screen.getByText("Offline — 3 reports queued")).toBeInTheDocument();
  });
});
