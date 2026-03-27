import { useMemo } from "react";
import {
  useAlertsFeed,
  useAnomalyAlerts,
  useFairnessMetrics,
  useGovernanceModels,
  useIncidentTimeSeries,
  usePolicyScenarios,
  useSystemMetrics,
  useUserProfile,
} from "@/data/aegisData";
import { Button } from "@/components/ui/button";
import { DashboardHero, DashboardPage, EmptyState, HeroBadge, ListItemCard, MetricCard, SectionCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import { dedupeBy, percent } from "@/lib/dashboardMetrics";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import HotspotHeatmap from "@/components/analytics/HotspotHeatmap";

const AnalystDashboard: React.FC = () => {
  const { setActiveModule } = useAppStore();
  const { user, session } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const resolvedRole = (profile?.role ?? "analyst") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];

  const { data: fairnessMetrics = [], isLoading: fairnessLoading } = useFairnessMetrics({ staleTime: 15000, refetchInterval: 30000, limit: 24 });
  const { data: policyScenarios = [], isLoading: policyLoading } = usePolicyScenarios({ staleTime: 15000, refetchInterval: 30000, limit: 12 });
  const { data: incidentTimeSeries = [], isLoading: trendLoading } = useIncidentTimeSeries({ staleTime: 10000, refetchInterval: 15000 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 10000, refetchInterval: 15000, limit: 12 });
  const { data: anomalyAlerts = [], isLoading: anomalyLoading } = useAnomalyAlerts({ staleTime: 10000, refetchInterval: 15000, limit: 8 });
  const { data: systemMetrics, isLoading: metricsLoading } = useSystemMetrics({ staleTime: 10000, refetchInterval: 30000 });
  const { data: governanceModels = [], isLoading: governanceLoading } = useGovernanceModels({ staleTime: 15000, refetchInterval: 30000, limit: 20 });

  const isLoadingData = fairnessLoading || policyLoading || trendLoading || alertsLoading || anomalyLoading || metricsLoading || governanceLoading;

  const passRate = useMemo(() => percent(fairnessMetrics.filter((entry) => entry.status === "pass").length, Math.max(fairnessMetrics.length, 1)), [fairnessMetrics]);
  const warningCount = useMemo(() => fairnessMetrics.filter((entry) => entry.status === "warning" || entry.status === "fail").length, [fairnessMetrics]);
  const trendLatest = incidentTimeSeries[incidentTimeSeries.length - 1]?.value ?? 0;
  const trendPrevious = incidentTimeSeries[incidentTimeSeries.length - 2]?.value ?? trendLatest;
  const trendDelta = trendLatest - trendPrevious;
  const scenarioPreview = useMemo(() => policyScenarios.slice(0, 4), [policyScenarios]);
  const anomalyPreview = useMemo(() => anomalyAlerts.slice(0, 5), [anomalyAlerts]);
  const alertsPreview = useMemo(
    () => dedupeBy(alertsFeed, (entry) => `${entry.module}|${entry.type}|${entry.message}`).slice(0, 4),
    [alertsFeed]
  );
  const activeModels = useMemo(() => governanceModels.filter((entry) => entry.status === "active"), [governanceModels]);
  const averageFairness = useMemo(() => {
    if (activeModels.length === 0) return 0;
    return Math.round(activeModels.reduce((sum, entry) => sum + entry.fairness, 0) / activeModels.length);
  }, [activeModels]);
  const sessionExpiry = session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : "Session inactive";

  return (
    <DashboardPage accent="indigo">
      <DashboardHero
        eyebrow="Intelligence operations"
        title="Analyst intelligence console"
        description="Realtime fairness, anomaly, policy, and prediction monitoring built on live telemetry and governance feeds."
        badges={[
          <HeroBadge key="fairness" className="border-indigo-500/20 bg-indigo-500/10 text-indigo-200">{passRate}% fairness pass rate</HeroBadge>,
          <HeroBadge key="models" className="border-sky-500/20 bg-sky-500/10 text-sky-200">{activeModels.length} active models</HeroBadge>,
          <HeroBadge key="anomalies" className="border-rose-500/20 bg-rose-500/10 text-rose-200">{anomalyAlerts.length} anomaly alerts</HeroBadge>,
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Open reporting</Button>
            <Button onClick={() => setActiveModule("policy")} disabled={!permissions.canAccessAnalytics}>Run simulation</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fairness pass" value={`${passRate}%`} helper={`${warningCount} metrics need attention`} accent="indigo" loading={isLoadingData} />
        <MetricCard label="Active models" value={activeModels.length} helper={`${averageFairness}% average fairness`} accent="sky" loading={isLoadingData} />
        <MetricCard label="Data throughput" value={systemMetrics?.dataPointsProcessed ?? "--"} helper="Signals processed today" accent="emerald" loading={isLoadingData} />
        <MetricCard label="Threat delta" value={trendLatest} helper={`${trendDelta >= 0 ? `+${trendDelta}` : trendDelta} from previous signal`} accent="rose" loading={isLoadingData} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Incident trend" description="Actual versus forecasted incident movement from the shared intelligence timeseries.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incidentTimeSeries}>
                <defs>
                  <linearGradient id="analyst-actual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="analyst-predicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="url(#analyst-actual)" strokeWidth={2} />
                <Area type="monotone" dataKey="predicted" stroke="#6366f1" fill="url(#analyst-predicted)" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Fairness breakdown" description="Current model-level fairness metric scores.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fairnessMetrics}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="metric" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} interval={0} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {fairnessMetrics.map((entry, index) => (
                    <Cell key={`${entry.metric}-${index}`} fill={entry.status === "fail" ? "#fb7185" : entry.status === "warning" ? "#f59e0b" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Anomaly intelligence" description="Live anomaly feed ordered by latest detection.">
          <div className="space-y-3">
            {anomalyPreview.length === 0 ? (
                <EmptyState
                  title="No anomalies detected"
                  description="The anomaly stream is clear at the moment."
                  guidance={[
                    "Model and telemetry anomalies will appear here when monitoring detects unusual behavior.",
                    "If you just ran a new workload, wait for the next analysis cycle before checking again.",
                  ]}
                />
              ) : (
              anomalyPreview.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.type}
                  subtitle={`${entry.region} · ${entry.time}`}
                  meta={<StatusPill tone={entry.severity === "critical" ? "rose" : entry.severity === "high" ? "amber" : "sky"}>{entry.severity}</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Policy simulation queue" description="Latest scenario outputs with modeled GBV reduction impact.">
          <div className="space-y-3">
            {scenarioPreview.length === 0 ? (
                <EmptyState
                  title="No simulations queued"
                  description="Run a policy scenario to populate this feed with live projections."
                  guidance={[
                    "Completed scenario runs and freshly published projections appear here automatically.",
                    "If a simulation finished moments ago, allow the analytics sync to publish the latest result set.",
                  ]}
                />
              ) : (
              scenarioPreview.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.name}
                  subtitle={`${entry.timeframe} · confidence ${entry.confidence}%`}
                  meta={<StatusPill tone="indigo">-{entry.gbvReduction}%</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Signal alerts" description="Critical analyst-facing system alerts.">
          <div className="space-y-3">
            {alertsPreview.length === 0 ? (
                <EmptyState
                  title="No analyst alerts"
                  description="Critical platform and intelligence alerts will appear here in real time."
                  guidance={[
                    "Governance, intelligence, and pipeline notices will surface here when they need analyst review.",
                    "If another team reported an issue recently, refresh after the alert stream catches up.",
                  ]}
                />
              ) : (
              alertsPreview.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.message}
                  subtitle={`${entry.module || "core"} · ${entry.time}`}
                  meta={<StatusPill tone={entry.type === "critical" ? "rose" : "amber"}>{entry.type || "notice"}</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Session & compliance" description="Analyst access context and active governance state.">
          <div className="space-y-3">
            <ListItemCard title="Session expiry" subtitle="Current secure analyst session window" meta={sessionExpiry} />
            <ListItemCard title="Governance posture" subtitle="Live active governance models" meta={<StatusPill tone="emerald">{activeModels.length} active</StatusPill>} />
            <ListItemCard title="Encrypted telemetry" subtitle="Secure monitoring and evidence chain" meta={<StatusPill tone="sky">enabled</StatusPill>} />
            <div className="pt-2">
              <Button variant="outline" onClick={() => setActiveModule("governance")} disabled={!permissions.canAccessAnalytics}>Open governance hub</Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="GBV hotspot heatmap" description="Realtime hotspot analysis across monitored regions.">
          <HotspotHeatmap />
        </SectionCard>
      </section>
    </DashboardPage>
  );
};

export default AnalystDashboard;
