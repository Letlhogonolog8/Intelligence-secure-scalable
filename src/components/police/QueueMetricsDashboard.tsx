import { useMemo } from "react";
import { MetricCard } from "@/components/dashboard/DashboardPrimitives";
import type { LiveJusticeCase } from "@/data/liveDashboardData";
import { calculateQueueMetrics } from "@/lib/policeDashboardEnhanced";

export const QueueMetricsDashboard = ({ cases }: { cases: LiveJusticeCase[] }) => {
  const metrics = useMemo(() => calculateQueueMetrics(cases), [cases]);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <MetricCard label="Critical Cases" value={metrics.criticalCases} helper={`${metrics.highPriorityCases} high priority`} accent="rose" />
      <MetricCard label="Unassigned" value={metrics.unassignedCases} helper={`${metrics.staleCases} stale cases`} accent="amber" />
      <MetricCard label="Avg Days Open" value={metrics.avgDaysOpen} helper={`Median: ${metrics.medianDaysOpen}d`} accent="sky" />
      <MetricCard label="Total Queue" value={metrics.totalCases} helper="Open cases" accent="indigo" />
    </div>
  );
};
