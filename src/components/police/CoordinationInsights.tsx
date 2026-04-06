import { useMemo } from "react";
import type { OrganizationCoordination } from "@/data/aegisData";
import { MetricCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { analyzeCoordination } from "@/lib/policeDashboardEnhanced";

export const CoordinationInsights = ({ referrals }: { referrals: OrganizationCoordination[] }) => {
  const insights = useMemo(() => analyzeCoordination(referrals), [referrals]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Pending" value={insights.pendingReferrals} accent="amber" />
        <MetricCard label="Completed" value={insights.completedReferrals} accent="emerald" />
        <MetricCard label="Avg Time" value={`${insights.avgCompletionTime}h`} accent="sky" />
      </div>

      {insights.topPartners.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-white">Top Partners</h4>
          <div className="space-y-2">
            {insights.topPartners.map((partner) => (
              <div key={partner.partnerId} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{partner.partnerId ? partner.partnerId.slice(0, 8) : "unknown"}</span>
                <span className="font-semibold text-white">{partner.count} referrals</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {insights.bottlenecks.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-rose-400">Bottlenecks</h4>
          <div className="space-y-2">
            {insights.bottlenecks.map((bottleneck) => (
              <div key={bottleneck.type} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{bottleneck.type}</span>
                <StatusPill tone="rose">{bottleneck.count} pending</StatusPill>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
