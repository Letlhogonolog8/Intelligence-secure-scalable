import { useMemo } from "react";
import type { UserProfile } from "@/data/aegisData";
import type { LiveJusticeCase } from "@/data/liveDashboardData";
import { StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { calculateOfficerWorkloads } from "@/lib/policeDashboardEnhanced";

export const OfficerWorkloadGrid = ({
  officers,
  cases,
}: {
  officers: Array<Pick<UserProfile, "id" | "isActive">>;
  cases: LiveJusticeCase[];
}) => {
  const workloads = useMemo(() => calculateOfficerWorkloads(officers, cases), [cases, officers]);

  if (workloads.length === 0) {
    return <p className="text-sm text-slate-400">No active officers available for workload analysis.</p>;
  }

  return (
    <div className="space-y-3">
      {workloads.map((workload) => (
        <div key={workload.officerId} className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-semibold text-white">Officer {workload.officerId.slice(0, 8)}</span>
            <StatusPill tone={workload.capacity === "overloaded" ? "rose" : workload.capacity === "full" ? "amber" : workload.capacity === "moderate" ? "sky" : "emerald"}>
              {workload.capacity}
            </StatusPill>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400">Assigned:</span>
              <span className="ml-1 text-white">{workload.assignedCases}</span>
            </div>
            <div>
              <span className="text-slate-400">Critical:</span>
              <span className="ml-1 text-white">{workload.criticalCases}</span>
            </div>
            <div>
              <span className="text-slate-400">Avg Age:</span>
              <span className="ml-1 text-white">{workload.avgCaseAge}d</span>
            </div>
          </div>
          {workload.recommendedAssignments > 0 ? (
            <p className="mt-2 text-xs text-emerald-400">Can handle {workload.recommendedAssignments} more case(s)</p>
          ) : null}
        </div>
      ))}
    </div>
  );
};
