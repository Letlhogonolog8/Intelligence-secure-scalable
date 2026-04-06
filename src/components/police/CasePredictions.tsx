import { useMemo } from "react";
import type { LiveJusticeCase } from "@/data/liveDashboardData";
import { StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { predictCaseOutcome } from "@/lib/policeDashboardEnhanced";

export const CasePredictions = ({ caseItem }: { caseItem: LiveJusticeCase }) => {
  const prediction = useMemo(() => predictCaseOutcome(caseItem), [caseItem]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-400">Predicted Resolution</span>
        <span className="font-semibold text-white">{prediction.predictedResolutionDays} days</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-400">Escalation Risk</span>
        <StatusPill tone={prediction.riskOfEscalation === "high" ? "rose" : prediction.riskOfEscalation === "medium" ? "amber" : "emerald"}>
          {prediction.riskOfEscalation}
        </StatusPill>
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
        <p className="text-xs text-slate-300">{prediction.recommendedAction}</p>
        <p className="mt-1 text-xs text-slate-500">Confidence: {Math.round(prediction.confidence * 100)}%</p>
      </div>
    </div>
  );
};
