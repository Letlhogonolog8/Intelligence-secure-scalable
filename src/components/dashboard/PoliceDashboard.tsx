import { useMemo, useState } from "react";
import { useAlertsFeed, useIncidentTimeSeries, useJusticeCases, useUserProfile, usePoliceOfficers, JusticeCase, useOrganizationCoordination } from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import CaseDispatchDialog from "@/components/justice/CaseDispatchDialog";
import FileIncidentDialog from "@/components/justice/FileIncidentDialog";
import { useQueryClient } from "@tanstack/react-query";

const PoliceDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile(user?.id);
  const { data: justiceCases = [], isLoading: casesLoading } = useJusticeCases({ staleTime: 60000, refetchInterval: 45000, limit: 160 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 6 });
  const { data: incidentTimeSeries = [], isLoading: trendLoading } = useIncidentTimeSeries({ staleTime: 15000, refetchInterval: 30000 });
  const { data: officers = [], isLoading: officersLoading } = usePoliceOfficers();
  const { data: referrals = [], isLoading: referralsLoading } = useOrganizationCoordination();
  
  const { setActiveModule } = useAppStore();
  const [caseLookupId, setCaseLookupId] = useState("");
  const [caseLookupResult, setCaseLookupResult] = useState<{
    id: string;
    status: string;
    risk_level: string;
    priority: string;
    updated_at: string | null;
    created_at: string | null;
  } | null>(null);
  const [caseLookupLoading, setCaseLookupLoading] = useState(false);
  const [caseLookupError, setCaseLookupError] = useState<string | null>(null);
  const [dispatchCase, setDispatchCase] = useState<JusticeCase | null>(null);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [isFileIncidentDialogOpen, setIsFileIncidentDialogOpen] = useState(false);

  const resolvedRole = (profile?.role ?? "police") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];
  const isLoadingData = casesLoading || alertsLoading || trendLoading || officersLoading || referralsLoading;

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alerts_feed")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id,
        })
        .eq("id", alertId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["aegis", "alertsFeed"] });
    } catch (error) {
      console.error("Alert acknowledgment failed:", error);
    }
  };

  const urgentCount = useMemo(
    () => justiceCases.filter((caseItem) => caseItem.priority === "critical").length,
    [justiceCases]
  );
  const highCount = useMemo(
    () => justiceCases.filter((caseItem) => caseItem.priority === "high").length,
    [justiceCases]
  );
  const activeCount = useMemo(
    () => justiceCases.filter((caseItem) => caseItem.status !== "resolved").length,
    [justiceCases]
  );
  const resolvedCount = useMemo(
    () => justiceCases.filter((caseItem) => caseItem.status === "resolved" || caseItem.stage === "sentencing" || caseItem.stage === "mediation").length,
    [justiceCases]
  );
  const priorityQueue = useMemo(() => justiceCases.slice(0, 4), [justiceCases]);
  const pendingAlerts = useMemo(() => alertsFeed.filter(a => a.status === "pending").slice(0, 3), [alertsFeed]);

  const trendSignal = useMemo(() => {
    if (incidentTimeSeries.length === 0) {
      return { latest: 0, delta: 0, direction: "stable" as "up" | "down" | "stable" };
    }
    const latestPoint = incidentTimeSeries[incidentTimeSeries.length - 1];
    const prevPoint = incidentTimeSeries[incidentTimeSeries.length - 2];
    const delta = prevPoint ? latestPoint.value - prevPoint.value : 0;
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "stable";
    return { latest: latestPoint.value, delta, direction };
  }, [incidentTimeSeries]);
  const responseScore = useMemo(() => {
    if (activeCount === 0) return 100;
    const risk = urgentCount + highCount;
    return Math.max(60, 100 - Math.min(40, risk * 2));
  }, [activeCount, urgentCount, highCount]);
  const sessionExpiry = useMemo(() => {
    if (!session?.expires_at) return "Session inactive";
    return new Date(session.expires_at * 1000).toLocaleTimeString();
  }, [session?.expires_at]);

  const handleCaseLookup = async () => {
    const trimmed = caseLookupId.trim();
    if (!trimmed) {
      setCaseLookupError("Enter a case ID to check status.");
      setCaseLookupResult(null);
      return;
    }
    setCaseLookupLoading(true);
    setCaseLookupError(null);
    const { data, error } = await supabase
      .from("case_reports")
      .select("id,status,risk_level,priority,updated_at,created_at")
      .eq("id", trimmed)
      .maybeSingle();
    if (error || !data) {
      setCaseLookupResult(null);
      setCaseLookupError("Case not found. Please verify the ID.");
      setCaseLookupLoading(false);
      return;
    }
    setCaseLookupResult(data);
    setCaseLookupLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100 px-6 py-8 [background:radial-gradient(1200px_circle_at_20%_0%,rgba(225,29,72,0.2),transparent_45%),radial-gradient(900px_circle_at_85%_10%,rgba(30,64,175,0.2),transparent_40%)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-2xl border border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)] p-6 shadow-rose-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Response Command</p>
              <h1 className="text-3xl font-semibold">Police Emergency Response</h1>
              <p className="text-sm text-slate-400">Live case management and dispatch prioritization.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setIsFileIncidentDialogOpen(true)} disabled={!permissions.canViewOrgData}>File Incident</Button>
              <Button size="sm" onClick={() => setActiveModule("command_center")} disabled={!permissions.canViewOrgData}>Create Dispatch</Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-rose-900/50 bg-rose-950/40">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-rose-200">Urgent 0-24h</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2">{urgentCount}</p>
                  <p className="text-xs text-rose-200 mt-2">Immediate response required</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 shadow-[0_18px_45px_rgba(2,6,23,0.55)]">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">High Priority</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2">{highCount}</p>
                  <p className="text-xs text-slate-500 mt-2">Active investigations</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 shadow-[0_18px_45px_rgba(2,6,23,0.55)]">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active Cases</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2">{activeCount}</p>
                  <p className="text-xs text-slate-500 mt-2">Open assignments</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 shadow-[0_18px_45px_rgba(2,6,23,0.55)]">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Officers Available</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2">{officers.length}</p>
                  <p className="text-xs text-emerald-300 mt-2">Ready to deploy</p>
                </>
              )}
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)]">
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Case Status Lookup</h2>
              <p className="text-sm text-slate-400">Verify survivor case reports across channels.</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Input
                value={caseLookupId}
                onChange={(event) => setCaseLookupId(event.target.value)}
                placeholder="Enter case ID"
                className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
              />
              <Button onClick={handleCaseLookup} disabled={caseLookupLoading}>
                {caseLookupLoading ? "Checking..." : "Check Status"}
              </Button>
            </div>
            {caseLookupError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                {caseLookupError}
              </div>
            )}
            {caseLookupResult && (
              <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-4 text-sm text-slate-200">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</span>
                  <span className="text-sm text-emerald-300">{caseLookupResult.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                  <div>Risk level: {caseLookupResult.risk_level}</div>
                  <div>Priority: {caseLookupResult.priority}</div>
                  <div>Opened: {caseLookupResult.created_at ? new Date(caseLookupResult.created_at).toLocaleString() : "--"}</div>
                  <div>Last update: {caseLookupResult.updated_at ? new Date(caseLookupResult.updated_at).toLocaleString() : "--"}</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)]">
            <div className="p-6">
              <h2 className="text-lg font-semibold">AI Dispatch Intelligence</h2>
              <p className="text-sm text-slate-400">Decision support for field operations.</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Response readiness</span>
                  <span className="font-semibold text-emerald-300">{responseScore}%</span>
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

          <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)]">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Realtime Alerts</h2>
              <p className="text-sm text-slate-400">Automated dispatch and threat advisories.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
                    <Skeleton className="h-4 w-2/3 bg-slate-800/60" />
                  </>
                ) : (
                  <>
                    {pendingAlerts.length === 0 ? (
                      <p className="text-sm text-slate-400">No priority alerts in queue.</p>
                    ) : (
                      pendingAlerts.map((alert) => (
                        <div key={alert.id} className="flex flex-col gap-2 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-sm">
                          <div className="flex items-start justify-between">
                            <span className="text-slate-200">{alert.message}</span>
                            <span className="text-xs text-slate-500">{alert.time}</span>
                          </div>
                          <div className="flex justify-end mt-1">
                            <Button size="sm" variant="secondary" onClick={() => handleAcknowledgeAlert(alert.id)}>Respond</Button>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)]">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Security & Session</h2>
              <p className="text-sm text-slate-400">Credential enforcement and session control.</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Session expiry</span>
                  <span className="text-slate-200">{sessionExpiry}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <span>Jurisdiction scope</span>
                  <span className="text-slate-200">{permissions.jurisdictionScoped ? "Scoped" : "Standard"}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("command_center")} disabled={!permissions.canViewOrgData}>Open Dispatch Console</Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)]">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Case Statistics</h2>
                <p className="text-sm text-slate-400">Breakdown by investigation stage.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveModule("justice")} disabled={!permissions.canAccessAnalytics}>View Analytics</Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Cases Filed</p>
                {isLoadingData ? (
                  <Skeleton className="mt-2 h-6 w-16 bg-slate-800/60" />
                ) : (
                  <p className="text-2xl font-semibold mt-2">{justiceCases.length}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Investigation</p>
                {isLoadingData ? (
                  <Skeleton className="mt-2 h-6 w-16 bg-slate-800/60" />
                ) : (
                  <p className="text-2xl font-semibold mt-2">{justiceCases.filter((caseItem) => caseItem.stage === "investigation").length}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Prosecution Ready</p>
                {isLoadingData ? (
                  <Skeleton className="mt-2 h-6 w-16 bg-slate-800/60" />
                ) : (
                  <p className="text-2xl font-semibold mt-2">{justiceCases.filter((caseItem) => caseItem.stage === "prosecution").length}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Resolved</p>
                {isLoadingData ? (
                  <Skeleton className="mt-2 h-6 w-16 bg-slate-800/60" />
                ) : (
                  <p className="text-2xl font-semibold mt-2">{resolvedCount}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)] lg:col-span-2">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Priority Dispatch Queue</h2>
                  <p className="text-sm text-slate-400">Cases requiring immediate coordination.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveModule("command_center")} disabled={!permissions.canViewOrgData}>View All</Button>
              </div>
              <div className="mt-5 space-y-4">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
                    <Skeleton className="h-4 w-2/3 bg-slate-800/60" />
                    <Skeleton className="h-4 w-4/5 bg-slate-800/60" />
                  </>
                ) : (
                  <>
                    {priorityQueue.length === 0 ? (
                      <p className="text-sm text-slate-400">No urgent dispatch items right now.</p>
                    ) : (
                      priorityQueue.map((caseItem) => (
                        <div key={caseItem.id} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
                          <div>
                            <p className="text-sm text-slate-200">Case #{caseItem.caseNumber}</p>
                            <p className="text-xs text-slate-500 mt-1">{caseItem.stage} · {caseItem.priority} priority</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setDispatchCase(caseItem);
                              setIsDispatchDialogOpen(true);
                            }} 
                            disabled={!permissions.canViewOrgData}
                          >
                            Dispatch
                          </Button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/75 shadow-[0_20px_50px_rgba(2,6,23,0.55)]">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Referrals to NGO</h2>
              <p className="text-sm text-slate-400 mt-1">Monthly handoffs to partner organizations.</p>
              {isLoadingData ? (
                <>
                  <Skeleton className="mt-4 h-10 w-16 bg-slate-800/60" />
                  <Skeleton className="mt-3 h-3 w-40 bg-slate-800/60" />
                </>
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-4">{referrals.length}</p>
                  <p className="text-xs text-slate-500 mt-2">Survivors referred this month</p>
                  <Button className="mt-5" size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>View Referrals</Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
      
      <CaseDispatchDialog 
        caseItem={dispatchCase}
        isOpen={isDispatchDialogOpen}
        onClose={() => setIsDispatchDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["aegis", "justiceCases"] });
        }}
      />
      <FileIncidentDialog 
        isOpen={isFileIncidentDialogOpen}
        onClose={() => setIsFileIncidentDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["aegis", "alertsFeed"] });
          queryClient.invalidateQueries({ queryKey: ["aegis", "incidentTimeSeries"] });
        }}
      />
    </div>
  );
};

export default PoliceDashboard;
