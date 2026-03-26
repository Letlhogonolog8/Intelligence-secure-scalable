import { useMemo, useState } from "react";
import {
  useAlertsFeed,
  useAuditLogs,
  useIncidentTimeSeries,
  useSystemMetrics,
  useUserProfile,
  useUserProfiles,
  useEscalationReviews,
  useDeletionRequests,
} from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import { logError } from "@/lib/logger";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Shield,
  Activity,
  Users,
  AlertTriangle,
  Search,
  Database,
  Lock,
  Clock,
  LayoutDashboard,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Cpu,
  Globe,
  Zap,
  Fingerprint,
  ChevronRight,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const isAdmin = profile?.role === "admin";
  const { setActiveModule } = useAppStore();

  const { data: users = [], isLoading: usersLoading } = useUserProfiles({ enabled: isAdmin, staleTime: 60000, limit: 250 });
  const { data: systemMetrics, isLoading: metricsLoading } = useSystemMetrics({ enabled: isAdmin, staleTime: 10000, refetchInterval: 30000 });
  const { data: incidentTimeSeries = [], isLoading: incidentsLoading } = useIncidentTimeSeries({ enabled: isAdmin, staleTime: 15000, refetchInterval: 30000 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ enabled: isAdmin, staleTime: 5000, refetchInterval: 15000, limit: 12 });
  const { data: auditLogs = [], isLoading: auditLoading } = useAuditLogs({ enabled: isAdmin, staleTime: 15000, refetchInterval: 30000, limit: 10 });
  const { data: escalationReviews = [], isLoading: escalationsLoading } = useEscalationReviews({ enabled: isAdmin, limit: 5 });
  const { data: deletionRequests = [], isLoading: deletionsLoading } = useDeletionRequests({ enabled: isAdmin, limit: 5 });

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
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSeverity, setAuditSeverity] = useState<string | null>(null);

  const isLoadingData = usersLoading || metricsLoading || alertsLoading || incidentsLoading || auditLoading || escalationsLoading || deletionsLoading;

  const handleExportReport = () => setActiveModule("reporting");
  const handleReviewActivity = () => setActiveModule("admin_console");
  const handleReviewFeed = () => setActiveModule("command_center");
  const handleViewTasks = () => setActiveModule("admin_console");

  const activeUsersCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const criticalAlertsCount = useMemo(() => alertsFeed.filter((a) => a.type === "critical").length, [alertsFeed]);
  const pendingApprovalsCount = useMemo(
    () => users.filter((u) => ["analyst", "ngo", "police"].includes(u.role) && u.approvalStatus === "pending").length,
    [users]
  );
  const pendingDeletionRequestsCount = useMemo(
    () => deletionRequests.filter((request) => request.status !== "processed").length,
    [deletionRequests]
  );
  const unresolvedEscalationCount = useMemo(
    () => escalationReviews.filter((review) => !["resolved", "closed"].includes(review.status.toLowerCase())).length,
    [escalationReviews]
  );
  
  const filteredAuditLogs = useMemo(() => {
    let results = auditLogs;
    if (auditSearch) {
      const normalizedSearch = auditSearch.toLowerCase();
      results = results.filter((log) =>
        [log.action, log.user, log.module]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some((value) => value.toLowerCase().includes(normalizedSearch))
      );
    }
    if (auditSeverity) {
      results = results.filter((log) => log.severity === auditSeverity);
    }
    return results.slice(0, 5);
  }, [auditLogs, auditSearch, auditSeverity]);

  const incidentTrend = useMemo(() => {
    if (incidentTimeSeries.length === 0) return { latest: 0, direction: "stable" as const, delta: 0 };
    const latest = incidentTimeSeries[incidentTimeSeries.length - 1].value;
    const previous = incidentTimeSeries[incidentTimeSeries.length - 2]?.value ?? latest;
    const delta = latest - previous;
    return { latest, direction: delta > 0 ? "up" : delta < 0 ? "down" : "stable", delta };
  }, [incidentTimeSeries]);

  const securityPosture = useMemo(() => {
    const uptime = systemMetrics?.systemUptime ?? 99.9;
    const encryption = systemMetrics?.encryptionStatus === "active" ? 100 : 90;
    const alertsPenalty = criticalAlertsCount * 5;
    return Math.max(0, Math.min(100, (uptime + encryption) / 2 - alertsPenalty));
  }, [systemMetrics, criticalAlertsCount]);

  const handleCaseLookup = async () => {
    const trimmed = caseLookupId.trim();
    if (!trimmed) {
      setCaseLookupError("Enter a case ID to check status.");
      setCaseLookupResult(null);
      return;
    }
    setCaseLookupLoading(true);
    setCaseLookupError(null);
    try {
      const { data, error } = await supabase
        .from("case_reports")
        .select("id,status,risk_level,priority,updated_at,created_at")
        .eq("id", trimmed)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        setCaseLookupError("Case not found. Please verify the ID.");
        setCaseLookupResult(null);
      } else {
        setCaseLookupResult(data);
      }
    } catch (err) {
      setCaseLookupError("An error occurred during lookup.");
      logError(err, { source: "admin.dashboard.case_lookup", caseId: trimmed });
    } finally {
      setCaseLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050915] text-slate-50 px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-sky-500/15 blur-[110px]" />
        <div className="absolute -bottom-28 right-[6%] h-80 w-80 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-10" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:gap-8 relative z-10">
        <header className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-slate-900/65 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-transparent to-emerald-500/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">
                <Shield className="h-3.5 w-3.5" />
                Security & Governance Console
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl lg:text-5xl">Administrative Oversight</h1>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                Enterprise-wide command surface for incident posture, identity controls, and governance actions.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {Math.round(securityPosture)}% security posture
                </span>
                <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                  {pendingApprovalsCount} pending approvals
                </span>
                <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-300">
                  {criticalAlertsCount} critical alerts
                </span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button size="lg" variant="outline" className="h-12 border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={handleExportReport}>
                <LayoutDashboard className="mr-2 h-4 w-4 text-sky-300" />
                Global Report
              </Button>
              <Button size="lg" className="h-12 bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-900/30" onClick={handleReviewActivity}>
                <Activity className="mr-2 h-4 w-4" />
                Live Activity
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="group border-white/10 bg-slate-900/55 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-sky-400/35">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-3 transition-colors group-hover:bg-sky-500/20">
                <Users className="h-5 w-5 text-sky-300" />
              </div>
              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase text-sky-300">Active Now</span>
            </div>
            <h3 className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">User Base</h3>
            {isLoadingData ? <Skeleton className="mt-2 h-10 w-24 bg-white/5" /> : <p className="text-3xl font-black text-white md:text-4xl">{activeUsersCount}</p>}
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Verified identities in platform scope</p>
          </Card>

          <Card className="group border-white/10 bg-slate-900/55 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-emerald-400/35">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 transition-colors group-hover:bg-emerald-500/20">
                <Database className="h-5 w-5 text-emerald-300" />
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase text-emerald-300">System OK</span>
            </div>
            <h3 className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Infrastructure</h3>
            {isLoadingData ? <Skeleton className="mt-2 h-10 w-32 bg-white/5" /> : <p className="text-3xl font-black text-white md:text-4xl">{systemMetrics?.systemUptime ?? 0}%</p>}
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400">Uptime rolling baseline</p>
          </Card>

          <Card className="group border-white/10 bg-slate-900/55 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-amber-400/35">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 transition-colors group-hover:bg-amber-500/20">
                <Lock className="h-5 w-5 text-amber-300" />
              </div>
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase text-amber-300">Secure</span>
            </div>
            <h3 className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Security Score</h3>
            {isLoadingData ? <Skeleton className="mt-2 h-10 w-24 bg-white/5" /> : <p className="text-3xl font-black text-white md:text-4xl">{Math.round(securityPosture)}%</p>}
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400">Zero-trust policy enforcement</p>
          </Card>

          <Card className="group border-white/10 bg-slate-900/55 p-5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-rose-400/35">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 transition-colors group-hover:bg-rose-500/20">
                <AlertTriangle className="h-5 w-5 text-rose-300" />
              </div>
              <span className={`${criticalAlertsCount > 0 ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-slate-500/10 text-slate-400 border-white/10"} rounded-full border px-3 py-1 text-[10px] font-black uppercase`}>
                {criticalAlertsCount} Critical
              </span>
            </div>
            <h3 className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Response Queue</h3>
            {isLoadingData ? <Skeleton className="mt-2 h-10 w-16 bg-white/5" /> : <p className={`text-3xl font-black md:text-4xl ${criticalAlertsCount > 0 ? "text-rose-300" : "text-white"}`}>{alertsFeed.length}</p>}
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">System alerts requiring triage</p>
          </Card>
        </div>

        {/* Operational Intelligence & Incident Pulse */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-xl flex flex-col lg:col-span-2 overflow-hidden">
            <div className="p-8 border-b border-white/5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <Activity className="h-5 w-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">Continental Incident Pulse</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Cases</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${incidentTrend.direction === "up" ? "bg-rose-500" : "bg-emerald-500"}`} />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{incidentTrend.direction} Trend</span>
                </div>
              </div>
            </div>
            <div className="p-8 h-80 w-full">
              {incidentsLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-indigo-500/20 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={incidentTimeSeries}>
                    <defs>
                      <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#475569" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#f8fafc' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#6366f1" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorPulse)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden">
            <div className="p-8 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Cpu className="h-5 w-5 text-emerald-400" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">System Infrastructure</h2>
              </div>
            </div>
            <div className="p-8 space-y-8 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5 group hover:border-emerald-500/20 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Latency</p>
                  </div>
                  <p className="text-3xl font-black text-white">{systemMetrics?.avgResponseTime || "-"}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5 group hover:border-blue-500/20 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="h-3.5 w-3.5 text-blue-400" />
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Nodes</p>
                  </div>
                  <p className="text-3xl font-black text-white">{systemMetrics?.countriesActive || "-"}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                    <span className="text-slate-500">Processing Load</span>
                    <span className="text-emerald-400">Low Stress</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full" style={{ width: "24%" }} />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                    <span className="text-slate-500">Model Drifting</span>
                    <span className="text-indigo-400">Nominal</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-400 rounded-full" style={{ width: "6%" }} />
                  </div>
                </div>
              </div>

              <div className="mt-auto p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                  <Shield className="h-24 w-24 text-indigo-400" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Fingerprint className="h-4 w-4 text-indigo-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-indigo-100">Zero-Trust Active</p>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium relative z-10">
                  Real-time cryptographic logging of all administrative escalations is currently enforced by the governance core.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Enterprise Case Lookup */}
        <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <Search className="h-6 w-6 text-blue-400" />
              <h2 className="text-2xl font-black text-white tracking-tight">Enterprise Case Lookup</h2>
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <Input
                value={caseLookupId}
                onChange={(e) => setCaseLookupId(e.target.value)}
                placeholder="Enter Secure Case ID (e.g. CAS-9281-X)"
                className="h-14 bg-slate-950/40 border-slate-800 text-white pl-6 focus:border-blue-500/50 transition-all text-lg font-medium"
              />
              <Button onClick={handleCaseLookup} disabled={caseLookupLoading} size="lg" className="h-14 px-10 bg-blue-600 hover:bg-blue-500 font-black transition-all active:scale-95 shadow-lg shadow-blue-900/20">
                {caseLookupLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Verify Identity & Case"}
              </Button>
            </div>

            {caseLookupError && (
              <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-sm font-bold">
                <XCircle className="h-5 w-5" />
                {caseLookupError}
              </div>
            )}

            {caseLookupResult ? (
              <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-3 tracking-widest">Case Status</p>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-emerald-400 font-black text-xl">{caseLookupResult.status}</p>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-3 tracking-widest">Risk Factor</p>
                  <p className={`font-black text-xl ${caseLookupResult.risk_level === "critical" ? "text-rose-400" : "text-white"}`}>{caseLookupResult.risk_level}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-3 tracking-widest">SLA Priority</p>
                  <p className="text-blue-400 font-black text-xl">{caseLookupResult.priority}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-3 tracking-widest">Created Date</p>
                  <p className="text-slate-300 font-bold text-lg">{caseLookupResult.created_at ? new Date(caseLookupResult.created_at).toLocaleDateString() : "--"}</p>
                </div>
              </div>
            ) : (
              <div className="mt-10 p-12 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-40">
                <Database className="h-10 w-10 text-slate-500 mb-4" />
                <p className="text-sm text-slate-500 max-w-sm font-medium">Platform-wide case indexing active. Enter a case ID to retrieve real-time status, risk metrics, and institutional assignment.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Audit, Alerts, and System Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-white/15 bg-slate-950/60 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-400" />
                <h2 className="text-xl font-black text-white">Audit Snapshot</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={handleReviewActivity} className="text-blue-400 font-black text-[10px] uppercase p-0 h-auto tracking-widest hover:bg-transparent">Open Full Logs</Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-2 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                  <Input 
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter logs..." 
                    className="h-9 bg-slate-950/40 border-white/5 pl-9 text-xs focus:ring-0" 
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAuditSeverity(null)}
                    className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${!auditSeverity ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setAuditSeverity("critical")}
                    className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${auditSeverity === "critical" ? "bg-rose-500 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
                  >
                    Critical
                  </button>
                  <button 
                    onClick={() => setAuditSeverity("warning")}
                    className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${auditSeverity === "warning" ? "bg-amber-500 text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
                  >
                    Warning
                  </button>
                </div>
              </div>
              {filteredAuditLogs.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No matching logs</p>
                </div>
              ) : (
                filteredAuditLogs.map((log, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 group hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-sm text-slate-200 font-bold mb-1">{log.action}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-tight">{log.user || "system"} • {log.module || "core"}</p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${log.severity === "critical" ? "bg-rose-500/20 text-rose-400" : log.severity === "warning" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                        {log.severity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/60 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <h2 className="text-xl font-black text-white">System Alerts</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={handleReviewFeed} className="text-rose-400 font-black text-[10px] uppercase p-0 h-auto tracking-widest hover:bg-transparent">Review Feed</Button>
            </div>
            <div className="p-6 space-y-4">
              {alertsFeed.slice(0, 5).map((alert) => (
                <div key={alert.id} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 group hover:border-rose-500/20 transition-all flex items-start gap-4">
                  <div className={`p-2 rounded-lg mt-1 ${alert.type === "critical" ? "bg-rose-500/10" : "bg-slate-800/50"}`}>
                    <AlertTriangle className={`h-4 w-4 ${alert.type === "critical" ? "text-rose-400" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200 font-medium mb-1 leading-snug">{alert.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-black uppercase">{alert.module}</span>
                      <span className="text-[9px] text-slate-600 font-bold">{alert.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/60 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-black text-white">Operational Tasks</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={handleViewTasks} className="text-emerald-400 font-black text-[10px] uppercase p-0 h-auto tracking-widest hover:bg-transparent">View All</Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-4 transition-all hover:bg-slate-950/60">
                <div className="p-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <RefreshCw className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-200 font-bold">Privileged Approvals</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase">{pendingApprovalsCount} pending request{pendingApprovalsCount === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-4 transition-all hover:bg-slate-950/60">
                <div className="p-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Database className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-200 font-bold">Deletion Queue</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase">{pendingDeletionRequestsCount} pending deletion request{pendingDeletionRequestsCount === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-4 transition-all hover:bg-slate-950/60">
                <div className="p-2 rounded-full bg-rose-500/10 border border-rose-500/20">
                  <CheckCircle2 className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-200 font-bold">Escalation Reviews</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase">{unresolvedEscalationCount} unresolved case{unresolvedEscalationCount === 1 ? "" : "s"}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Global Security & AI Governance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <Card className="border-white/15 bg-slate-950/60 p-8 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setActiveModule("admin_console")}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="h-20 w-20 text-indigo-500" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <FileText className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Activity Stream</h3>
            </div>
            <p className="text-sm text-slate-400 font-light leading-relaxed mb-6">Real-time audit trails of all system interactions and administrative interventions across the platform.</p>
            <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
              Review full ledger <ChevronRight className="h-3 w-3" />
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/60 p-8 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all cursor-pointer" onClick={() => setActiveModule("governance")}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck className="h-20 w-20 text-emerald-500" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">AI Compliance</h3>
            </div>
            <p className="text-sm text-slate-400 font-light leading-relaxed mb-6">Validated certification records for all participating NGOs, government agencies, and AI model fairness metrics.</p>
            <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest">
              Verify compliance <ChevronRight className="h-3 w-3" />
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/60 p-8 backdrop-blur-xl relative overflow-hidden group hover:border-orange-500/30 transition-all cursor-pointer" onClick={() => setActiveModule("admin_console")}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Smartphone className="h-20 w-20 text-orange-500" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <Smartphone className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Gateway Config</h3>
            </div>
            <p className="text-sm text-slate-400 font-light leading-relaxed mb-6">Manage USSD rapid response templates, regional gateway routing rules, and offline accessibility parameters.</p>
            <div className="flex items-center gap-2 text-orange-400 font-black text-[10px] uppercase tracking-widest">
              Configure gateways <ChevronRight className="h-3 w-3" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
