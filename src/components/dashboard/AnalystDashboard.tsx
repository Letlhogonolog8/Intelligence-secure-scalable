import { 
  useAlertsFeed,
  useFairnessMetrics,
  useIncidentTimeSeries,
  usePolicyScenarios, 
  useUserProfile,
  useAnomalyAlerts,
  useSystemMetrics
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
  CartesianGrid, 
  Cell,
  AreaChart,
  Area
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AegisIcons } from "@/components/ui/AegisIcons";
import HotspotHeatmap from "@/components/analytics/HotspotHeatmap";

const AnalystDashboard: React.FC = () => {
  const { setActiveModule } = useAppStore();
  const { user, session } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const resolvedRole = (profile?.role ?? "analyst") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];

  const { data: fairnessMetrics = [], isLoading: fairnessLoading } = useFairnessMetrics({ staleTime: 60000, refetchInterval: 60000, limit: 24 });
  const { data: policyScenarios = [], isLoading: policyLoading } = usePolicyScenarios({ staleTime: 45000, refetchInterval: 60000, limit: 12 });
  const { data: incidentTimeSeries = [], isLoading: trendLoading } = useIncidentTimeSeries({ staleTime: 20000, refetchInterval: 30000 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 6 });
  const { data: anomalyAlerts = [], isLoading: anomalyLoading } = useAnomalyAlerts({ limit: 5 });
  const { data: systemMetrics, isLoading: metricsLoading } = useSystemMetrics();

  const isLoadingData = fairnessLoading || policyLoading || trendLoading || alertsLoading || anomalyLoading || metricsLoading;
  const totalMetrics = fairnessMetrics.length;
  const passCount = fairnessMetrics.filter((metric) => metric.status === "pass").length;
  const passRate = totalMetrics ? Math.round((passCount / totalMetrics) * 100) : 0;
  const trendLatest = incidentTimeSeries[incidentTimeSeries.length - 1];
  const trendPrevious = incidentTimeSeries[incidentTimeSeries.length - 2];
  const trendDelta = trendLatest && trendPrevious ? trendLatest.value - trendPrevious.value : 0;
  const trendDirection = trendDelta > 0 ? "Rising" : trendDelta < 0 ? "Declining" : "Stable";
  const alertsPreview = alertsFeed.slice(0, 3);
  const sessionExpiry = session?.expires_at
    ? new Date(session.expires_at * 1000).toLocaleTimeString()
    : "Session inactive";
  const scenarioPreview = policyScenarios.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/14 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-cyan-600/12 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:140px_140px]" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 relative z-10">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Insight Operations</p>
              <h1 className="text-3xl font-semibold">Analyst Intelligence Console</h1>
              <p className="text-sm text-slate-400">Policy signals, fairness metrics, and real-time trends.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Open Reporting</Button>
              <Button size="sm" onClick={() => setActiveModule("policy")} disabled={!permissions.canAccessAnalytics}>Run Simulation</Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-white/10 bg-slate-950/70 transition-all hover:bg-slate-900/80">
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Algorithmic Trust</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-20 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2 text-indigo-200">{passRate}%</p>
                  <p className="text-xs text-slate-500 mt-2 font-mono uppercase">Fairness Index</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 transition-all hover:bg-slate-900/80">
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Model Precision</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2">{systemMetrics?.modelsDeployed ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-2 font-mono uppercase">Active Agents</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 transition-all hover:bg-slate-900/80">
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Data Throughput</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-16 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2">{systemMetrics?.dataPointsProcessed ?? "-"}</p>
                  <p className="text-xs text-slate-500 mt-2 font-mono uppercase">Signals / 24h</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 transition-all hover:bg-slate-900/80">
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Threat Vectors</p>
              {isLoadingData ? (
                <Skeleton className="mt-3 h-8 w-20 bg-slate-800/60" />
              ) : (
                <>
                  <p className="text-3xl font-semibold mt-2 text-cyan-200">{trendLatest ? trendLatest.value : 0}</p>
                  <p className="text-xs text-slate-500 mt-2 font-mono uppercase tracking-tighter">
                    {trendDirection} · Δ {trendDelta >= 0 ? `+${trendDelta}` : trendDelta}
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">Incident Trends</h2>
                  <p className="text-sm text-slate-400">Historical & predictive incident tracking.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-cyan-400"></div>
                    <span className="text-[10px] uppercase text-slate-500">Actual</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                    <span className="text-[10px] uppercase text-slate-500">Predicted</span>
                  </div>
                </div>
              </div>
              <div className="h-[240px] w-full">
                {trendLoading ? (
                  <Skeleton className="h-full w-full bg-slate-800/40" />
                ) : (
                  <ChartContainer config={{
                    value: { label: "Actual", color: "#22d3ee" },
                    predicted: { label: "Predicted", color: "#6366f1" }
                  }}>
                    <AreaChart data={incidentTimeSeries}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
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
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="value" stroke="#22d3ee" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                      <Area type="monotone" dataKey="predicted" stroke="#6366f1" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPredicted)" strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-1">Algorithmic Fairness Breakdown</h2>
              <p className="text-sm text-slate-400 mb-6">Bias assessment across protected demographic groups.</p>
              <div className="h-[240px] w-full">
                {fairnessLoading ? (
                  <Skeleton className="h-full w-full bg-slate-800/40" />
                ) : (
                  <ChartContainer config={{
                    score: { label: "Bias Score", color: "#818cf8" }
                  }}>
                    <BarChart data={fairnessMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                      <XAxis 
                        dataKey="metric" 
                        stroke="#475569" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        interval={0}
                      />
                      <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {fairnessMetrics.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.status === 'fail' ? '#ef4444' : entry.status === 'warning' ? '#f59e0b' : '#6366f1'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Anomaly Intelligence</h2>
              <p className="text-sm text-slate-400">Real-time detection of irregular data patterns.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-12 w-full bg-slate-800/40" />
                    <Skeleton className="h-12 w-full bg-slate-800/40" />
                  </>
                ) : anomalyAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AegisIcons.ShieldCheck className="h-10 w-10 text-emerald-500/50 mb-2" />
                    <p className="text-xs text-slate-500 uppercase tracking-widest">No Anomalies Detected</p>
                  </div>
                ) : (
                  anomalyAlerts.map((anomaly) => (
                    <div key={anomaly.id} className="group relative rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 transition-colors hover:bg-slate-900/40">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${
                              anomaly.severity === 'critical' ? 'bg-red-500 animate-pulse' : 
                              anomaly.severity === 'high' ? 'bg-orange-500' : 
                              'bg-amber-500'
                            }`} />
                            <span className="text-xs font-medium text-slate-200 uppercase tracking-tighter">{anomaly.type}</span>
                          </div>
                          <p className="text-xs text-slate-400">{anomaly.region}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums">{anomaly.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Policy Simulation Intelligence</h2>
              <p className="text-sm text-slate-400">Forecasting impact of legislative interventions.</p>
              <div className="mt-5 space-y-4">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
                    <Skeleton className="h-4 w-2/3 bg-slate-800/60" />
                  </>
                ) : scenarioPreview.length === 0 ? (
                  <p className="text-sm text-slate-400">No scenarios queued.</p>
                ) : (
                  scenarioPreview.map((scenario) => (
                    <div key={scenario.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 uppercase tracking-tight">{scenario.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{scenario.timeframe}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all" 
                            style={{ width: `${scenario.gbvReduction}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400">-{scenario.gbvReduction}%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        Estimated Impact: {scenario.impact} · Confidence: {scenario.confidence}%
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/60">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Realtime Alerts</h2>
              <p className="text-sm text-slate-400">Critical signal updates for analysts.</p>
              <div className="mt-5 space-y-3">
                {isLoadingData ? (
                  <>
                    <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
                    <Skeleton className="h-4 w-2/3 bg-slate-800/60" />
                  </>
                ) : alertsPreview.length === 0 ? (
                  <p className="text-sm text-slate-400">No analyst alerts right now.</p>
                ) : (
                  alertsPreview.map((alert) => (
                    <div key={alert.id} className="flex items-start justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-sm">
                      <span>{alert.message}</span>
                      <span className="text-xs text-slate-400">{alert.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-950/60">
          <div className="p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Session & Compliance</h2>
                <p className="text-sm text-slate-400">Secure access governance for analyst sessions.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveModule("governance")} disabled={!permissions.canAccessAnalytics}>Open Governance Hub</Button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Session expiry</p>
                <p className="text-lg font-semibold mt-2">{sessionExpiry}</p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Access scope</p>
                <p className="text-lg font-semibold mt-2">Institutional</p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase text-slate-500">Encryption</p>
                <p className="text-lg font-semibold mt-2 text-emerald-300">Enabled</p>
              </div>
            </div>
          </div>
        </Card>

        {/* GBV Hotspot Heatmap */}
        <HotspotHeatmap />
      </div>
    </div>
  );
};

export default AnalystDashboard;
