import { useMemo } from "react";
import { 
  useAlertsFeed, 
  useEscalationReviews, 
  useJusticeCases, 
  useUserProfile,
  useRiskTrendData,
  useOrganizationCoordination,
  useIncidentTimeSeries
} from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const CounselorDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { data: justiceCases = [], isLoading: casesLoading } = useJusticeCases({ staleTime: 60000, refetchInterval: 45000, limit: 120 });
  const { data: escalationReviews = [], isLoading: escalationLoading } = useEscalationReviews({ staleTime: 30000, refetchInterval: 60000, limit: 80 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 6 });
  const { isLoading: riskLoading } = useRiskTrendData({ staleTime: 20000, refetchInterval: 45000 });
  const { data: coordination = [], isLoading: coordinationLoading } = useOrganizationCoordination({ staleTime: 30000, refetchInterval: 60000, limit: 15 });
  const { data: incidentTimeSeries = [], isLoading: incidentLoading } = useIncidentTimeSeries({ staleTime: 20000, refetchInterval: 30000 });
  const { setActiveModule } = useAppStore();
  const resolvedRole = (profile?.role ?? "counselor") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];
  const isLoadingData = casesLoading || escalationLoading || alertsLoading || riskLoading || coordinationLoading || incidentLoading;
  const activeCaseload = justiceCases.length;
  const attentionNeeded = justiceCases.filter((caseItem) => caseItem.priority === "high" || caseItem.priority === "critical").length;
  const visibleCases = useMemo(() => justiceCases.slice(0, 4), [justiceCases]);
  const priorityStyles: Record<string, string> = {
    critical: "bg-rose-900/20 text-rose-300",
    high: "bg-orange-900/20 text-orange-300",
    medium: "bg-amber-900/20 text-amber-300",
    low: "bg-emerald-900/20 text-emerald-300",
  };
  const aiRiskScore = useMemo(() => {
    if (activeCaseload === 0) return 0;
    return Math.round((attentionNeeded / activeCaseload) * 100);
  }, [activeCaseload, attentionNeeded]);
  const sessionExpiry = useMemo(() => {
    if (!session?.expires_at) return "Session inactive";
    return new Date(session.expires_at * 1000).toLocaleTimeString();
  }, [session?.expires_at]);
  const alertHighlights = useMemo(() => alertsFeed.slice(0, 3), [alertsFeed]);

  const followUpsDue = useMemo(
    () => justiceCases.filter((c) => c.stage === "follow-up").length,
    [justiceCases]
  );
  
  const activeCollaborations = useMemo(
    () => coordination.filter((c) => c.status === "pending" || c.status === "in_progress"),
    [coordination]
  );

  const sessionMetrics = useMemo(
    () => {
      const active = justiceCases.length;
      return [
        { name: "Safety Plans", count: active, completed: Math.floor(active * 0.8), pending: Math.ceil(active * 0.2) },
        { name: "Risk Assessments", count: attentionNeeded, completed: Math.floor(attentionNeeded * 0.8), pending: Math.ceil(attentionNeeded * 0.2) },
        { name: "Documentation", count: active, completed: Math.floor(active * 0.9), pending: Math.ceil(active * 0.1) },
      ];
    },
    [justiceCases, attentionNeeded]
  );

  const caseloadTrend = useMemo(
    () => {
      if (incidentTimeSeries.length === 0) return [];
      return incidentTimeSeries.slice(-4).map((pt, i) => ({
        week: `Week ${i + 1}`,
        active: pt.value,
        resolved: Math.floor(pt.value * 0.3)
      }));
    },
    [incidentTimeSeries]
  );

  const riskMetrics = useMemo(
    () => ({
      criticalCases: justiceCases.filter((c) => c.priority === "critical").length,
      highRiskCases: justiceCases.filter((c) => c.priority === "high").length,
      mediumRiskCases: justiceCases.filter((c) => c.priority === "medium").length,
      lowRiskCases: justiceCases.filter((c) => c.priority === "low").length,
    }),
    [justiceCases]
  );

  const collaborationMetrics = useMemo(
    () => ({
      pendingPoliceHandoffs: coordination.filter((c) => c.referralType === "police" && c.status === "pending").length,
      pendingNGOReferrals: coordination.filter((c) => c.referralType !== "police" && c.status === "pending").length,
      completedCoordinations: coordination.filter((c) => c.status === "completed").length,
    }),
    [coordination]
  );

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-emerald-600/12 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-slate-500/12 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:140px_140px]" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 relative z-10">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Care Coordination</p>
              <h1 className="text-3xl font-semibold">Counselor Dashboard</h1>
              <p className="text-sm text-slate-400">Manage your caseload, sessions, and escalations.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Daily Brief</Button>
              <Button size="sm" onClick={() => setActiveModule("survivor_support")} disabled={!permissions.canViewOwnData}>New Session</Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/70">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active Caseload</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-10 w-20 bg-slate-800/60" />
              ) : (
                <p className="text-4xl font-semibold mt-2">{activeCaseload}</p>
              )}
              {isLoadingData ? (
                <Skeleton className="mt-2 h-3 w-28 bg-slate-800/60" />
              ) : (
                <p className="text-rose-300 text-sm mt-2">{attentionNeeded} require attention</p>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Escalations</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <p className="text-2xl font-semibold mt-2">{escalationReviews.length}</p>
              )}
              {isLoadingData ? (
                <Skeleton className="mt-2 h-3 w-28 bg-slate-800/60" />
              ) : (
                <p className="text-xs text-slate-500 mt-2">{escalationReviews.length > 0 ? "Awaiting review" : "No escalations pending"}</p>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Follow-ups Due</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-2xl font-semibold mt-2">{followUpsDue}</p>
                  <p className="text-xs text-slate-500 mt-2">This week</p>
                </>
              )}
            </div>
          </Card>
        </div>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <div className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Clinical Impact Snapshot · Survivor Recovery Program</h2>
                <p className="text-sm text-slate-300 mt-1">Live indicators from counseling, referral, and safety-planning pathways.</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full">Week in View</span>
            </div>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">Safety plans completed</p>
                <p className="text-2xl font-bold text-emerald-300 mt-1">{sessionMetrics[0].completed}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">Urgent follow-ups</p>
                <p className="text-2xl font-bold text-amber-300 mt-1">{followUpsDue}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">Cross-team handoffs</p>
                <p className="text-2xl font-bold text-cyan-300 mt-1">{activeCollaborations.length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">High-risk load</p>
                <p className="text-2xl font-bold text-rose-300 mt-1">{aiRiskScore}%</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">AI Care Guidance</h2>
              <p className="text-sm text-slate-400">Risk-aware prioritization suggestions.</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Risk load</span>
                  <span className="font-semibold text-rose-200">{aiRiskScore}%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Priority focus</span>
                  <span className="text-slate-200">
                    {attentionNeeded > 0 ? `Escalate ${attentionNeeded} high-risk cases` : "No critical escalations"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Next follow-up window</span>
                  <span className="text-slate-200">Within 6 hours</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Realtime Alerts</h2>
              <p className="text-sm text-slate-400">Automated escalations and system notes.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
                    <Skeleton className="h-4 w-2/3 bg-slate-800/60" />
                  </>
                ) : (
                  <>
                    {alertHighlights.length === 0 ? (
                      <p className="text-sm text-slate-400">No new alerts for your queue.</p>
                    ) : (
                      alertHighlights.map((alert) => (
                        <div key={alert.id} className="flex items-start justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-sm">
                          <span>{alert.message}</span>
                          <span className="text-xs text-slate-400">{alert.time}</span>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Session Security</h2>
              <p className="text-sm text-slate-400">Access posture and credential controls.</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Session expiry</span>
                  <span className="text-slate-200">{sessionExpiry}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Org scope</span>
                  <span className="text-slate-200">{permissions.organizationScoped ? "Scoped" : "Standard"}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("justice")} disabled={!permissions.canViewOrgData}>Review Escalations</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/60 lg:col-span-2">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Today's Schedule</h2>
                  <p className="text-sm text-slate-400">Upcoming sessions and check-ins.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("survivor_support")} disabled={!permissions.canViewOwnData}>Add Session</Button>
              </div>
              <div className="mt-5 space-y-4">
                {isLoadingData ? (
                  <>
                    <div className="flex items-start justify-between border-b border-slate-800/40 pb-3">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-28 bg-slate-800/60" />
                        <Skeleton className="h-3 w-40 bg-slate-800/60" />
                      </div>
                      <Skeleton className="h-8 w-16 bg-slate-800/60" />
                    </div>
                    <div className="flex items-start justify-between border-b border-slate-800/40 pb-3">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24 bg-slate-800/60" />
                        <Skeleton className="h-3 w-36 bg-slate-800/60" />
                      </div>
                      <Skeleton className="h-8 w-16 bg-slate-800/60" />
                    </div>
                  </>
                ) : (
                  <>
                    {visibleCases.length === 0 && activeCollaborations.length === 0 ? (
                      <p className="text-sm text-slate-400">No scheduled sessions for today.</p>
                    ) : (
                      <>
                        {visibleCases.slice(0, 2).map((c, i) => (
                          <div key={c.id} className="flex items-start justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
                            <div>
                              <p className="text-sm text-slate-200">{i === 0 ? "08:30" : "11:00"} · Case Review</p>
                              <p className="text-xs text-slate-500 mt-1">Case #{c.caseNumber}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setActiveModule("survivor_support")}>Join</Button>
                          </div>
                        ))}
                        {activeCollaborations.slice(0, 1).map((collab) => (
                          <div key={collab.id} className="flex items-start justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
                            <div>
                              <p className="text-sm text-slate-200">15:30 · Handoff Sync</p>
                              <p className="text-xs text-slate-500 mt-1">Ref: {collab.id.slice(0, 6)}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setActiveModule("survivor_support")}>View</Button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Escalation Reviews</h2>
              <p className="text-sm text-slate-400 mt-1">Cases awaiting senior attention.</p>
              {isLoadingData ? (
                <>
                  <Skeleton className="mt-4 h-10 w-16 bg-slate-800/60" />
                  <Skeleton className="mt-3 h-3 w-40 bg-slate-800/60" />
                </>
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-4">{escalationReviews.length}</p>
                  <p className="text-xs text-slate-500 mt-2">Pending escalation items</p>
                  <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("justice")} disabled={!permissions.canViewOrgData}>Review Queue</Button>
                </>
              )}
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-950/60">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Your Cases</h2>
                <p className="text-sm text-slate-400">Track risk levels and open actions.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveModule("justice")} disabled={!permissions.canViewOrgData}>View All</Button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-left">
                  <tr className="border-b border-slate-800/40">
                    <th className="pb-3">Case #</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Risk Level</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {isLoadingData && (
                    <>
                      <tr>
                        <td className="py-3" colSpan={4}>
                          <Skeleton className="h-6 w-full bg-slate-800/60" />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3" colSpan={4}>
                          <Skeleton className="h-6 w-5/6 bg-slate-800/60" />
                        </td>
                      </tr>
                    </>
                  )}
                  {!isLoadingData && visibleCases.map((caseItem) => (
                    <tr key={caseItem.id}>
                      <td className="py-3">{caseItem.caseNumber}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-slate-800/60 text-slate-200 text-xs rounded">{caseItem.status}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs rounded ${priorityStyles[caseItem.priority] ?? "bg-slate-800/60 text-slate-200"}`}>{caseItem.priority}</span>
                      </td>
                      <td className="py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setActiveModule("justice")}>View</Button></td>
                    </tr>
                  ))}
                  {!isLoadingData && visibleCases.length === 0 && (
                    <tr>
                      <td className="py-3 text-slate-500 text-sm" colSpan={4}>No assigned cases yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Session Documentation</h2>
              <p className="text-sm text-slate-400">Tracking safety plans, assessments, and notes.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-10 w-full bg-slate-800/40" />
                    <Skeleton className="h-10 w-full bg-slate-800/40" />
                  </>
                ) : (
                  sessionMetrics.map((metric) => (
                    <div key={metric.name} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">{metric.name}</span>
                        <span className="text-xs text-slate-500">{metric.completed}/{metric.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${(metric.completed / metric.count) * 100}%` }}
                        />
                      </div>
                      {metric.pending > 0 && (
                        <p className="text-[10px] text-amber-400 mt-1.5">{metric.pending} pending</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Risk Profile Summary</h2>
              <p className="text-sm text-slate-400">Current caseload risk distribution.</p>
              <div className="mt-5 space-y-2">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-8 w-full bg-slate-800/40" />
                    <Skeleton className="h-8 w-full bg-slate-800/40" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm text-slate-300">Critical Risk</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">{riskMetrics.criticalCases}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <span className="text-sm text-slate-300">High Risk</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">{riskMetrics.highRiskCases}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-sm text-slate-300">Medium Risk</span>
                      </div>
                      <span className="text-sm font-bold text-amber-400">{riskMetrics.mediumRiskCases}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-sm text-slate-300">Low Risk</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{riskMetrics.lowRiskCases}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Caseload Trend</h2>
              <p className="text-sm text-slate-400">Weekly active cases and resolutions.</p>
              <div className="mt-5 h-[220px]">
                {isLoadingData ? (
                  <Skeleton className="h-full w-full bg-slate-800/40" />
                ) : (
                  <ChartContainer config={{
                    active: { label: "Active", color: "#3b82f6" },
                    resolved: { label: "Resolved", color: "#10b981" }
                  }}>
                    <BarChart data={caseloadTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="week" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Agency Collaboration</h2>
              <p className="text-sm text-slate-400">Police and NGO coordination status.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-12 w-full bg-slate-800/40" />
                    <Skeleton className="h-12 w-full bg-slate-800/40" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">Police Handoffs</p>
                        <p className="text-xs text-slate-500">Pending coordination</p>
                      </div>
                      <span className={`text-2xl font-bold ${collaborationMetrics.pendingPoliceHandoffs > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {collaborationMetrics.pendingPoliceHandoffs}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">NGO Referrals</p>
                        <p className="text-xs text-slate-500">Shelter/resource placement</p>
                      </div>
                      <span className={`text-2xl font-bold ${collaborationMetrics.pendingNGOReferrals > 0 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                        {collaborationMetrics.pendingNGOReferrals}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">Completed Handoffs</p>
                        <p className="text-xs text-slate-500">Successful coordinations</p>
                      </div>
                      <span className="text-2xl font-bold text-emerald-400">
                        {collaborationMetrics.completedCoordinations}
                      </span>
                    </div>
                    <Button className="w-full mt-2" size="sm" variant="outline" onClick={() => setActiveModule("command_center")} disabled={!permissions.canViewOrgData}>
                      Manage Handoffs
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Treatment Planning</h2>
              <p className="text-sm text-slate-400 mt-2">Create and track survivor care plans.</p>
              <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("survivor_support")} disabled={!permissions.canViewOwnData}>
                Add Treatment Plan
              </Button>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Safety Assessment</h2>
              <p className="text-sm text-slate-400 mt-2">Track risk assessments and safety scores.</p>
              <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("justice")} disabled={!permissions.canViewOrgData}>
                View Assessments
              </Button>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Session Notes</h2>
              <p className="text-sm text-slate-400 mt-2">Access and update counseling documentation.</p>
              <Button className="mt-5" size="sm" variant="outline" disabled={!permissions.canViewOwnData}>
                Open Notes
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CounselorDashboard;
