import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationContext } from "@/contexts/organizationContext";
import { useEscalationReviews, useJusticeCases, useSystemMetrics, useUserProfile } from "@/data/aegisData";
import { useAuth } from "@/hooks/use-auth";

const ReportingCenter: React.FC = () => {
  const { organizationName } = useOrganizationContext();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const [timeRange, setTimeRange] = useState("Last 30 Days");
  const { data: systemMetrics } = useSystemMetrics({ staleTime: 10000, refetchInterval: 30000 });
  const { data: justiceCases = [] } = useJusticeCases({ staleTime: 60000 });
  const { data: escalationReviews = [] } = useEscalationReviews({ staleTime: 60000 });

  // Wire the time-range chips to real filtering.
  const rangeDays = timeRange.includes("7") ? 7 : timeRange.includes("90") ? 90 : 30;
  const casesInRange = useMemo(
    () => justiceCases.filter((c) => (c.daysOpen ?? 0) <= rangeDays),
    [justiceCases, rangeDays]
  );
  const escalationsInRange = useMemo(
    () =>
      escalationReviews.filter((r) => {
        if (!r.createdAt) return true;
        const ageDays = (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000;
        return Number.isFinite(ageDays) ? ageDays <= rangeDays : true;
      }),
    [escalationReviews, rangeDays]
  );
  const hasData = Boolean(systemMetrics) || casesInRange.length > 0 || escalationsInRange.length > 0;

  const handleExportCsv = () => {
    if (!hasData) {
      return;
    }
    const rows = [
      {
        section: "system_metrics",
        key: "convictionRate",
        value: systemMetrics?.convictionRate ?? "",
      },
      {
        section: "system_metrics",
        key: "avgCaseDuration",
        value: systemMetrics?.avgCaseDuration ?? "",
      },
      {
        section: "system_metrics",
        key: "casesProcessed",
        value: systemMetrics?.casesProcessed ?? "",
      },
      ...casesInRange.map((caseItem) => ({
        section: "justice_cases",
        key: caseItem.caseNumber,
        value: `${caseItem.status} | ${caseItem.stage} | ${caseItem.priority}`,
      })),
      ...escalationsInRange.map((review) => ({
        section: "escalation_reviews",
        key: review.sessionId,
        value: `${review.status} | ${review.riskLevel ?? ""} | ${review.emotionDetected ?? ""}`,
      })),
    ];
    const headers = Object.keys(rows[0]);
    const escapeValue = (value: unknown) => {
      const stringValue = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
    };
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeValue(row[header as keyof typeof row])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporting-center.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const casesResolved = useMemo(
    () => casesInRange.filter((c) => c.stage === "sentencing" || c.stage === "mediation" || c.status === "resolved").length,
    [casesInRange]
  );
  const pendingEscalations = useMemo(
    () => escalationsInRange.filter((review) => review.status !== "resolved").length,
    [escalationsInRange]
  );

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reporting Center</h1>
            <p className="text-slate-400 mt-1">Scope: {organizationName || "Independent"}</p>
          </div>
          <div className="flex gap-3">
            {["Last 7 Days", "Last 30 Days", "Last 90 Days"].map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                aria-pressed={timeRange === range}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        <Card className="bg-slate-900/40 border-slate-800">
          <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-slate-400 text-sm">Active Reporting Window</p>
              <p className="text-2xl font-semibold mt-1">{timeRange}</p>
              <p className="text-xs text-slate-500 mt-1">Prepared for {profile?.fullName || "Analyst"}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePrint} disabled={!hasData}>Generate Report</Button>
              <Button variant="outline" onClick={handlePrint} disabled={!hasData}>Export PDF</Button>
              <Button variant="outline" onClick={handleExportCsv} disabled={!hasData}>Export CSV</Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-slate-900/40 border-slate-800">
            <div className="p-6">
              <p className="text-slate-400 text-sm">Impact Score</p>
              {systemMetrics?.convictionRate !== undefined && systemMetrics?.convictionRate !== null ? (
                <p className="text-2xl font-bold mt-2">{systemMetrics.convictionRate.toFixed(1)}%</p>
              ) : (
                <Skeleton className="mt-3 h-7 w-24 bg-slate-800/60" />
              )}
              <Skeleton className="mt-2 h-3 w-32 bg-slate-800/60" />
            </div>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800">
            <div className="p-6">
              <p className="text-slate-400 text-sm">Cases Resolved</p>
              {hasData ? (
                <p className="text-2xl font-bold mt-2">{casesResolved}</p>
              ) : (
                <Skeleton className="mt-3 h-7 w-20 bg-slate-800/60" />
              )}
              <Skeleton className="mt-2 h-3 w-32 bg-slate-800/60" />
            </div>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800">
            <div className="p-6">
              <p className="text-slate-400 text-sm">Risk Escalations</p>
              {hasData ? (
                <p className="text-2xl font-bold mt-2">{escalationsInRange.length}</p>
              ) : (
                <Skeleton className="mt-3 h-7 w-20 bg-slate-800/60" />
              )}
              {hasData ? (
                <p className="text-xs text-slate-400 mt-1">{pendingEscalations} pending reviews</p>
              ) : (
                <Skeleton className="mt-2 h-3 w-32 bg-slate-800/60" />
              )}
            </div>
          </Card>
        </div>

        <Card className="bg-slate-900/40 border-slate-800">
          <div className="p-6">
            <h2 className="font-semibold mb-4">Recent Reports <span className="text-slate-500 text-sm font-normal">· {timeRange}</span></h2>
            <div className="space-y-3">
              {!hasData ? (
                <>
                  <Skeleton className="h-12 w-full bg-slate-800/60" />
                  <Skeleton className="h-12 w-5/6 bg-slate-800/60" />
                  <Skeleton className="h-12 w-4/6 bg-slate-800/60" />
                </>
              ) : casesInRange.length === 0 ? (
                <p className="text-sm text-slate-400">No cases in {timeRange.toLowerCase()}.</p>
              ) : (
                casesInRange.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-950/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.caseNumber} <span className="text-slate-400 font-normal">· {c.type}</span></p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.region} · {c.stage} · open {c.daysOpen}d</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        c.priority === "critical" ? "bg-rose-500/15 text-rose-300" :
                        c.priority === "high" ? "bg-amber-500/15 text-amber-300" :
                        c.priority === "medium" ? "bg-sky-500/15 text-sky-300" : "bg-slate-500/15 text-slate-300"
                      }`}>{c.priority}</span>
                      <span className="text-xs text-slate-400">{c.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportingCenter;
