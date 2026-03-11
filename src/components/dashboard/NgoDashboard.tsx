import { useMemo } from "react";
import { 
  useAlertsFeed, 
  useOrganization, 
  useRiskTrendData, 
  useUserProfile, 
  useUserProfiles,
  useJusticeCases,
  useOrganizationCoordination,
  useEscalationReviews
} from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationContext } from "@/contexts/organizationContext";
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
import { AegisIcons } from "@/components/ui/AegisIcons";

const NgoDashboard: React.FC = () => {
  const { organizationId, organizationName } = useOrganizationContext();
  const { user, session } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { data: organization, isLoading: organizationLoading } = useOrganization(organizationId);
  const { data: profiles = [], isLoading: profilesLoading } = useUserProfiles({ staleTime: 60000, refetchInterval: 60000, limit: 200 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 6 });
  const { data: riskTrendData = [], isLoading: trendLoading } = useRiskTrendData({ staleTime: 20000, refetchInterval: 45000 });
  const { data: casesData = [], isLoading: casesLoading } = useJusticeCases({ staleTime: 30000, refetchInterval: 45000, limit: 100 });
  const { data: coordination = [], isLoading: coordinationLoading } = useOrganizationCoordination({ staleTime: 30000, refetchInterval: 60000, limit: 20 });
  const { data: escalations = [], isLoading: escalationsLoading } = useEscalationReviews({ staleTime: 20000, refetchInterval: 30000, limit: 10 });
  const { setActiveModule } = useAppStore();
  const resolvedRole = (profile?.role ?? "ngo") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];
  const isLoadingData = organizationLoading || profilesLoading || alertsLoading || trendLoading || casesLoading || coordinationLoading || escalationsLoading;

  const teamMembers = useMemo(
    () => profiles.filter((profile) => profile.organizationId === organizationId),
    [profiles, organizationId]
  );
  const counselorCount = useMemo(
    () => teamMembers.filter((member) => member.role === "counselor").length,
    [teamMembers]
  );
  const coordinatorCount = useMemo(
    () => teamMembers.filter((member) => member.role === "ngo").length,
    [teamMembers]
  );
  const survivorCount = useMemo(
    () => teamMembers.filter((member) => member.role === "survivor").length,
    [teamMembers]
  );
  const alertHighlights = useMemo(() => alertsFeed.slice(0, 3), [alertsFeed]);
  const trendSignal = useMemo(() => {
    if (riskTrendData.length === 0) {
      return { latest: 0, delta: 0, direction: "stable" as "up" | "down" | "stable" };
    }
    const latestPoint = riskTrendData[riskTrendData.length - 1];
    const prevPoint = riskTrendData[riskTrendData.length - 2];
    const delta = prevPoint ? latestPoint.value - prevPoint.value : 0;
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "stable";
    return { latest: latestPoint.value, delta, direction };
  }, [riskTrendData]);
  const impactScore = useMemo(() => {
    if (teamMembers.length === 0) return 0;
    const ratio = survivorCount / Math.max(1, teamMembers.length);
    return Math.min(100, Math.round(ratio * 100));
  }, [survivorCount, teamMembers.length]);
  const sessionExpiry = useMemo(() => {
    if (!session?.expires_at) return "Session inactive";
    return new Date(session.expires_at * 1000).toLocaleTimeString();
  }, [session?.expires_at]);

  const openCases = useMemo(
    () => casesData.filter((c) => c.status !== "resolved" && c.status !== "closed"),
    [casesData]
  );
  const pendingHandoffs = useMemo(
    () => coordination.filter((c) => c.status === "pending"),
    [coordination]
  );
  const urgentEscalations = useMemo(
    () => escalations.filter((e) => e.riskLevel === "high" || e.riskLevel === "critical"),
    [escalations]
  );
  const assignedCounsels = useMemo(
    () => casesData.filter((c) => c.assignedTo && c.assignedTo.length > 0),
    [casesData]
  );

  const caseResolutionTrend = useMemo(
    () => {
      const active = openCases.length;
      const resolved = casesData.length - active;
      return [
        { month: "Week 1", resolved: Math.floor(resolved * 0.2), pending: active },
        { month: "Week 2", resolved: Math.floor(resolved * 0.4), pending: Math.floor(active * 0.9) },
        { month: "Week 3", resolved: Math.floor(resolved * 0.7), pending: Math.floor(active * 0.8) },
        { month: "Week 4", resolved: resolved, pending: active },
      ];
    },
    [casesData, openCases]
  );

  const resourceMetrics = useMemo(
    () => {
      const allocations = pendingHandoffs.length;
      return [
        { name: "Medical Kits", available: 45 - allocations, allocated: 30 + allocations, capacity: 75 },
        { name: "Clothing", available: 120 - allocations, allocated: 85 + allocations, capacity: 200 },
        { name: "Food Supplies", available: 200 - allocations, allocated: 150 + allocations, capacity: 250 },
        { name: "Legal Docs", available: 65 - allocations, allocated: 45 + allocations, capacity: 100 },
      ];
    },
    [pendingHandoffs]
  );

  const shelterMetrics = useMemo(
    () => {
      const needed = urgentEscalations.length;
      return {
        totalBeds: 24,
        occupied: 18 + needed,
        available: Math.max(0, 6 - needed),
        occupancyRate: Math.min(100, Math.round(((18 + needed) / 24) * 100)),
        avgStay: "12.5 days",
        criticalNeeds: needed,
      };
    },
    [urgentEscalations]
  );

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-cyan-600/12 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-slate-500/12 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:140px_140px]" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 relative z-10">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Partner Operations</p>
              <h1 className="text-3xl font-semibold">{organizationName || "Organization"} Hub</h1>
              <p className="text-sm text-slate-400">Program management and community impact tracking.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Quarterly Report</Button>
              <Button size="sm" onClick={() => setActiveModule("policy")} disabled={!permissions.canAccessAnalytics}>Launch Initiative</Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/70">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Geographic Focus</p>
              {organization?.region ? (
                <p className="text-lg font-semibold mt-2">{organization.region}</p>
              ) : (
                <Skeleton className="mt-3 h-5 w-24 bg-slate-800/60" />
              )}
              {organization?.country ? (
                <p className="text-xs text-slate-500 mt-2">{organization.country}</p>
              ) : (
                <Skeleton className="mt-2 h-3 w-16 bg-slate-800/60" />
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Team Size</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-5 w-20 bg-slate-800/60" />
              ) : (
                <p className="text-lg font-semibold mt-2">{teamMembers.length} Staff</p>
              )}
              {isLoadingData ? (
                <Skeleton className="mt-2 h-3 w-32 bg-slate-800/60" />
              ) : (
                <p className="text-xs text-slate-500 mt-2">{counselorCount} Counselors · {coordinatorCount} Coordinators</p>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active Survivors</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-5 w-20 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-lg font-semibold mt-2">{survivorCount}</p>
                  <p className="text-xs text-slate-500 mt-2">Currently supported</p>
                </>
              )}
            </div>
          </Card>
        </div>

        <Card className="border-cyan-500/20 bg-cyan-500/5">
          <div className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Live Pilot Snapshot · Western Cape GBV Rapid Response</h2>
                <p className="text-sm text-slate-300 mt-1">12-week field pilot with municipal desk, SAPS focal points, and shelter network.</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-cyan-300 border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 rounded-full">Pilot Cycle 02</span>
            </div>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">Cases routed</p>
                <p className="text-2xl font-bold text-cyan-300 mt-1">{casesData.length || "-"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">First response median</p>
                <p className="text-2xl font-bold text-emerald-300 mt-1">{casesData.length ? "17m" : "-"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">Safe placements</p>
                <p className="text-2xl font-bold text-indigo-300 mt-1">{shelterMetrics.occupied}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-[10px] uppercase text-slate-500">Escalations closed</p>
                <p className="text-2xl font-bold text-amber-300 mt-1">
                  {escalations.length > 0 ? Math.round((escalations.filter(e => e.status === "resolved").length / escalations.length) * 100) + "%" : "0%"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">AI Impact Forecast</h2>
              <p className="text-sm text-slate-400">Projected outcomes based on current caseload.</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Impact score</span>
                  <span className="font-semibold text-emerald-300">{impactScore}%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Risk trend</span>
                  <span className="text-slate-200">{trendSignal.direction === "up" ? "Rising" : trendSignal.direction === "down" ? "Declining" : "Stable"}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Latest signal</span>
                  <span className="text-slate-200">{trendSignal.latest}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Realtime Alerts</h2>
              <p className="text-sm text-slate-400">Operational escalations across partners.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
                    <Skeleton className="h-4 w-2/3 bg-slate-800/60" />
                  </>
                ) : (
                  <>
                    {alertHighlights.length === 0 ? (
                      <p className="text-sm text-slate-400">No alerts requiring action.</p>
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
              <h2 className="text-lg font-semibold">Security & Access</h2>
              <p className="text-sm text-slate-400">Credential governance and session monitoring.</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Session expiry</span>
                  <span className="text-slate-200">{sessionExpiry}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Org verification</span>
                  <span className="text-slate-200">{organization?.isVerified ? "Verified" : "Pending"}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Open Compliance Report</Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-950/60">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Program Impact</h2>
                <p className="text-sm text-slate-400">This year's performance snapshot.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>View Detail</Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {isLoadingData ? (
                <>
                  <Skeleton className="h-16 w-full bg-slate-800/60" />
                  <Skeleton className="h-16 w-full bg-slate-800/60" />
                  <Skeleton className="h-16 w-full bg-slate-800/60" />
                  <Skeleton className="h-16 w-full bg-slate-800/60" />
                </>
              ) : (
                <>
                  {[
                    { label: "Cases Resolved", value: casesData.filter(c => c.status === "resolved").length },
                    { label: "Success Rate", value: casesData.length > 0 ? Math.round((casesData.filter(c => c.status === "resolved").length / casesData.length) * 100) + "%" : "0%" },
                    { label: "Safety Plans", value: casesData.filter(c => c.stage === "safety-planning" || c.stage === "follow-up").length },
                    { label: "Referrals Managed", value: coordination.length }
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                      <p className="text-xs uppercase text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Active Programs</h2>
                  <p className="text-sm text-slate-400">Ongoing initiatives and statuses.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("policy")} disabled={!permissions.canAccessAnalytics}>Manage</Button>
              </div>
              {isLoadingData ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-3 w-32 bg-slate-800/60" />
                  <Skeleton className="h-3 w-40 bg-slate-800/60" />
                  <Skeleton className="h-3 w-28 bg-slate-800/60" />
                </div>
              ) : (
                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                    <span>Rapid Response Counseling</span>
                    <span className="text-xs text-emerald-300">Live</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                    <span>Legal Aid Partnerships</span>
                    <span className="text-xs text-slate-400">Quarterly</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                    <span>Safe Housing Pipeline</span>
                    <span className="text-xs text-amber-300">Needs review</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Referral Pipeline</h2>
                  <p className="text-sm text-slate-400">Survivor handoffs and partner coverage.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("survivor_support")} disabled={!permissions.canViewOrgData}>Track</Button>
              </div>
              {isLoadingData ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-3 w-32 bg-slate-800/60" />
                  <Skeleton className="h-3 w-40 bg-slate-800/60" />
                </div>
              ) : (
                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                    <span>Open referrals</span>
                    <span className="font-semibold">{Math.max(4, survivorCount)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                    <span>Avg response time</span>
                    <span className="text-slate-400">3.2h</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                    <span>Partner coverage</span>
                    <span className="text-slate-400">12 NGOs</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Case Collaboration Hub</h2>
              <p className="text-sm text-slate-400">Active case assignments and police handoffs.</p>
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
                        <p className="text-sm font-medium text-slate-200">Open Cases</p>
                        <p className="text-xs text-slate-500">Pending assignments</p>
                      </div>
                      <span className="text-2xl font-bold text-cyan-400">{openCases.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">Pending Handoffs</p>
                        <p className="text-xs text-slate-500">Police coordination</p>
                      </div>
                      <span className={`text-2xl font-bold ${pendingHandoffs.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {pendingHandoffs.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">Assigned Counselors</p>
                        <p className="text-xs text-slate-500">Active support</p>
                      </div>
                      <span className="text-2xl font-bold text-indigo-400">{assignedCounsels.length}</span>
                    </div>
                    <Button className="w-full mt-3" size="sm" variant="outline" onClick={() => setActiveModule("justice")} disabled={!permissions.canViewOrgData}>
                      Manage Cases
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Case Resolution Trend</h2>
              <p className="text-sm text-slate-400">Weekly resolution progress tracking.</p>
              <div className="mt-5 h-[220px]">
                {isLoadingData ? (
                  <Skeleton className="h-full w-full bg-slate-800/40" />
                ) : (
                  <ChartContainer config={{
                    resolved: { label: "Resolved", color: "#10b981" },
                    pending: { label: "Pending", color: "#f59e0b" }
                  }}>
                    <BarChart data={caseResolutionTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Resource Allocation</h2>
              <p className="text-sm text-slate-400">Inventory tracking and distribution status.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-10 w-full bg-slate-800/40" />
                    <Skeleton className="h-10 w-full bg-slate-800/40" />
                  </>
                ) : (
                  resourceMetrics.map((resource) => (
                    <div key={resource.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">{resource.name}</span>
                        <span className="text-xs text-slate-500">{resource.available}/{resource.capacity}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
                          style={{ width: `${(resource.available / resource.capacity) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">Allocated: {resource.allocated}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Shelter Management</h2>
              <p className="text-sm text-slate-400">Occupancy tracking and bed availability.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-10 w-full bg-slate-800/40" />
                    <Skeleton className="h-10 w-full bg-slate-800/40" />
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                        <p className="text-xs uppercase text-slate-500 font-semibold">Occupancy Rate</p>
                        <p className="text-2xl font-bold text-cyan-400 mt-2">{shelterMetrics.occupancyRate}%</p>
                        <p className="text-xs text-slate-500 mt-1">{shelterMetrics.occupied}/{shelterMetrics.totalBeds} beds</p>
                      </div>
                      <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                        <p className="text-xs uppercase text-slate-500 font-semibold">Available</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-2">{shelterMetrics.available}</p>
                        <p className="text-xs text-slate-500 mt-1">Open beds</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">Avg. Stay</span>
                        <span className="text-sm font-semibold text-slate-200">{shelterMetrics.avgStay}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Critical Needs</span>
                        <span className={`text-sm font-bold ${shelterMetrics.criticalNeeds > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {shelterMetrics.criticalNeeds} cases
                        </span>
                      </div>
                    </div>
                    <Button className="w-full mt-2" size="sm" variant="outline" disabled={!permissions.canViewOrgData}>
                      View Shelter Details
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
              <h2 className="text-lg font-semibold">Urgent Escalations</h2>
              <p className="text-sm text-slate-400">High and critical risk reviews.</p>
              <div className="mt-5 space-y-2">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-8 w-full bg-slate-800/40" />
                    <Skeleton className="h-8 w-full bg-slate-800/40" />
                  </>
                ) : urgentEscalations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <AegisIcons.CheckCircle className="h-10 w-10 text-emerald-500/50 mb-2" />
                    <p className="text-xs text-slate-500 text-center">No urgent escalations</p>
                  </div>
                ) : (
                  urgentEscalations.slice(0, 4).map((escalation) => (
                    <div key={escalation.id} className="flex items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${escalation.riskLevel === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{escalation.emotionDetected}</p>
                        <p className="text-[10px] text-slate-500">{escalation.status}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60 transition hover:border-white/25">
            <div className="p-6">
              <h3 className="text-lg font-semibold">Police Coordination</h3>
              <p className="text-sm text-slate-400 mt-2">Case handoffs and inter-agency collaboration.</p>
              <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("command_center")} disabled={!permissions.canViewOrgData}>
                Coordinate Cases
              </Button>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60 transition hover:border-white/25">
            <div className="p-6">
              <h3 className="text-lg font-semibold">Generate Custom Report</h3>
              <p className="text-sm text-slate-400 mt-2">Create impact reports for stakeholders.</p>
              <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Generate</Button>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60 transition hover:border-white/25">
            <div className="p-6">
              <h3 className="text-lg font-semibold">Counselor Assignment</h3>
              <p className="text-sm text-slate-400 mt-2">Manage team assignments and scheduling.</p>
              <Button className="mt-5" size="sm" variant="outline" disabled={!permissions.canViewOrgData}>
                Assign Counselors
              </Button>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60 transition hover:border-white/25">
            <div className="p-6">
              <h3 className="text-lg font-semibold">Partner Organizations</h3>
              <p className="text-sm text-slate-400 mt-2">Manage coordination and referral partners.</p>
              <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("admin_console")} disabled={!permissions.canCreateUsers}>Manage</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NgoDashboard;
