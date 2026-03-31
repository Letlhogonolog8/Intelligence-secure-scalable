import { useDeferredValue, useMemo, useState } from "react";
import {
  useAlertsFeed,
  useAuditLogs,
  useAdminDashboardConfig,
  useDeletionRequests,
  useEscalationReviews,
  useIncidentTimeSeries,
  useSystemMetrics,
  useUserProfile,
} from "@/data/aegisData";
import { useLiveUserProfiles } from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import {
  DashboardHero,
  DashboardPage,
  EmptyState,
  HeroBadge,
  ListItemCard,
  MetricCard,
  SectionCard,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { CaseStatusLookup } from "@/components/dashboard/CaseStatusLookup";
import {
  AdminAuditSeveritySummary,
  AdminFeedHealthGrid,
  AdminRecommendedActionsList,
  AdminThresholdNotifications,
} from "@/components/dashboard/AdminOperationalWidgets";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { buildWeeklyLifecycle, dedupeBy, formatRelativeDateTime, percent } from "@/lib/dashboardMetrics";
import {
  buildAdminFeedHealth,
  buildAdminRecommendedActions,
  buildThresholdNotifications,
  normalizeAdminAlerts,
  normalizeAdminAuditLogs,
  normalizeAdminIncidentSeries,
} from "@/lib/adminDashboard";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Database, ShieldCheck, Users } from "lucide-react";
import { ADMIN_DASHBOARD_REFRESH_INTERVALS, ADMIN_DASHBOARD_THRESHOLDS } from "@/config/adminDashboardThresholds";

const severityTone = {
  critical: "rose",
  error: "rose",
  warning: "amber",
  info: "slate",
} as const;

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setActiveModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const isAdmin = profile?.role === "admin";
  const { data: adminDashboardConfig } = useAdminDashboardConfig({ enabled: isAdmin });
  const refreshIntervals = adminDashboardConfig?.refresh ?? ADMIN_DASHBOARD_REFRESH_INTERVALS;
  const adminThresholds = adminDashboardConfig?.thresholds ?? ADMIN_DASHBOARD_THRESHOLDS;

  const { data: users = [], isLoading: usersLoading } = useLiveUserProfiles({ enabled: isAdmin, staleTime: refreshIntervals.metricsMs, refetchInterval: refreshIntervals.metricsMs, limit: 250 });
  const { data: systemMetrics, isLoading: metricsLoading } = useSystemMetrics({ enabled: isAdmin, staleTime: refreshIntervals.metricsMs, refetchInterval: refreshIntervals.metricsMs });
  const { data: incidentTimeSeries = [], isLoading: incidentsLoading } = useIncidentTimeSeries({ enabled: isAdmin, staleTime: refreshIntervals.metricsMs, refetchInterval: refreshIntervals.metricsMs });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ enabled: isAdmin, staleTime: refreshIntervals.alertsMs, refetchInterval: refreshIntervals.alertsMs, limit: 12 });
  const { data: auditLogs = [], isLoading: auditLoading } = useAuditLogs({ enabled: isAdmin, staleTime: refreshIntervals.auditMs, refetchInterval: refreshIntervals.auditMs, limit: 24 });
  const { data: escalationReviews = [], isLoading: escalationsLoading } = useEscalationReviews({ enabled: isAdmin, staleTime: refreshIntervals.metricsMs, refetchInterval: refreshIntervals.metricsMs, limit: 20 });
  const { data: deletionRequests = [], isLoading: deletionsLoading } = useDeletionRequests({ enabled: isAdmin, staleTime: refreshIntervals.metricsMs, refetchInterval: refreshIntervals.metricsMs, limit: 20 });

  const [auditSearch, setAuditSearch] = useState("");
  const [auditSeverity, setAuditSeverity] = useState<string>("all");
  const [auditExpanded, setAuditExpanded] = useState(false);
  const deferredAuditSearch = useDeferredValue(auditSearch);

  const isLoadingData = usersLoading || metricsLoading || incidentsLoading || alertsLoading || auditLoading || escalationsLoading || deletionsLoading;
  const sanitizedIncidentSeries = useMemo(() => normalizeAdminIncidentSeries(incidentTimeSeries), [incidentTimeSeries]);
  const sanitizedAuditLogs = useMemo(() => normalizeAdminAuditLogs(auditLogs), [auditLogs]);
  const sanitizedAlerts = useMemo(() => normalizeAdminAlerts(alertsFeed), [alertsFeed]);

  const activeUsers = useMemo(() => users.filter((entry) => entry.isActive), [users]);
  const privilegedUsers = useMemo(() => users.filter((entry) => ["admin", "analyst", "ngo", "police", "counselor"].includes(entry.role)), [users]);
  const pendingApprovals = useMemo(() => privilegedUsers.filter((entry) => entry.approvalStatus === "pending"), [privilegedUsers]);
  const uniqueAlerts = useMemo(() => dedupeBy(sanitizedAlerts, (entry) => `${entry.module}|${entry.type}|${entry.message}`), [sanitizedAlerts]);
  const criticalAlerts = useMemo(() => uniqueAlerts.filter((entry) => entry.type === "critical"), [uniqueAlerts]);
  const unresolvedEscalations = useMemo(() => escalationReviews.filter((entry) => !["resolved", "closed"].includes(entry.status.toLowerCase())), [escalationReviews]);
  const pendingDeletionRequests = useMemo(() => deletionRequests.filter((entry) => entry.status?.toLowerCase() !== "processed"), [deletionRequests]);
  const roleDistribution = useMemo(() => {
    const distribution = new Map<string, number>();
    users.forEach((entry) => {
      distribution.set(entry.role, (distribution.get(entry.role) ?? 0) + 1);
    });
    return Array.from(distribution.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [users]);

  const auditFeed = useMemo(() => {
    const term = deferredAuditSearch.trim().toLowerCase();
    return sanitizedAuditLogs.filter((entry) => {
      const matchesSearch = !term || [entry.action, entry.module, entry.user, entry.description ?? ""]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
      const matchesSeverity = auditSeverity === "all" || entry.severity === auditSeverity;
      return matchesSearch && matchesSeverity;
    });
  }, [sanitizedAuditLogs, deferredAuditSearch, auditSeverity]);

  const visibleAuditFeed = useMemo(() => auditFeed.slice(0, auditExpanded ? 12 : 6), [auditExpanded, auditFeed]);

  const incidentTrend = useMemo(() => {
    const latest = sanitizedIncidentSeries[sanitizedIncidentSeries.length - 1]?.value ?? 0;
    const previous = sanitizedIncidentSeries[sanitizedIncidentSeries.length - 2]?.value ?? latest;
    return {
      latest,
      delta: latest - previous,
    };
  }, [sanitizedIncidentSeries]);

  const governanceTimeline = useMemo(
    () => buildWeeklyLifecycle(sanitizedAuditLogs, (entry) => entry.time, undefined, 4).map((bucket) => ({
      label: bucket.label,
      opened: bucket.opened,
      active: bucket.active,
    })),
    [sanitizedAuditLogs]
  );
  const auditSeveritySummary = useMemo(() => {
    const summary = { critical: 0, error: 0, warning: 0, info: 0 };
    sanitizedAuditLogs.forEach((entry) => {
      if (entry.severity in summary) {
        summary[entry.severity as keyof typeof summary] += 1;
      }
    });
    return summary;
  }, [sanitizedAuditLogs]);
  const recentAuditActors = useMemo(() => new Set(sanitizedAuditLogs.slice(0, 12).map((entry) => entry.user).filter(Boolean)).size, [sanitizedAuditLogs]);
  const securityPosture = useMemo(() => {
    const uptime = systemMetrics?.systemUptime ?? 0;
    const encryptionFactor = systemMetrics?.encryptionStatus === "active" ? 100 : 70;
    const alertPenalty = Math.min(35, criticalAlerts.length * 6);
    return Math.min(100, Math.max(0, Math.round((uptime + encryptionFactor) / 2 - alertPenalty)));
  }, [criticalAlerts.length, systemMetrics?.encryptionStatus, systemMetrics?.systemUptime]);

  const incidentTrendLabel = useMemo(() => {
    if (incidentTrend.delta === 0) {
      return "Stable incident signal";
    }
    return `Delta ${incidentTrend.delta > 0 ? `+${incidentTrend.delta}` : incidentTrend.delta} incident signal`;
  }, [incidentTrend.delta]);
  const feedHealth = useMemo(
    () =>
      buildAdminFeedHealth({
        userCount: users.length,
        incidentPointCount: sanitizedIncidentSeries.length,
        auditEntryCount: sanitizedAuditLogs.length,
      }),
    [sanitizedAuditLogs.length, sanitizedIncidentSeries.length, users.length]
  );
  const recommendedActions = useMemo(
    () =>
      buildAdminRecommendedActions({
        pendingApprovals: pendingApprovals.length,
        criticalAlerts: criticalAlerts.length,
        unresolvedEscalations: unresolvedEscalations.length,
        pendingDeletionRequests: pendingDeletionRequests.length,
      }),
    [criticalAlerts.length, pendingApprovals.length, pendingDeletionRequests.length, unresolvedEscalations.length]
  );
  const thresholdNotifications = useMemo(
    () =>
      buildThresholdNotifications({
        pendingApprovals: pendingApprovals.length,
        criticalAlerts: criticalAlerts.length,
        unresolvedEscalations: unresolvedEscalations.length,
        pendingDeletionRequests: pendingDeletionRequests.length,
        securityPosture,
        thresholds: adminThresholds,
      }),
    [adminThresholds, criticalAlerts.length, pendingApprovals.length, pendingDeletionRequests.length, securityPosture, unresolvedEscalations.length]
  );

  const priorityBoard = useMemo(
    () => [
      {
        title: "Approval queue",
        subtitle: "Privileged roles awaiting enablement",
        value: pendingApprovals.length,
        tone: "amber" as const,
        actionLabel: "Review queue",
        action: () => setActiveModule("admin_console"),
      },
      {
        title: "Critical alerts",
        subtitle: "Platform or governance events that need review",
        value: criticalAlerts.length,
        tone: "rose" as const,
        actionLabel: "Inspect alerts",
        action: () => setActiveModule("governance"),
      },
      {
        title: "Escalation reviews",
        subtitle: "Open cases still waiting on oversight",
        value: unresolvedEscalations.length,
        tone: "rose" as const,
        actionLabel: "Open justice queue",
        action: () => setActiveModule("justice"),
      },
      {
        title: "Deletion requests",
        subtitle: "Privacy requests awaiting closure",
        value: pendingDeletionRequests.length,
        tone: "indigo" as const,
        actionLabel: "Process requests",
        action: () => setActiveModule("admin_console"),
      },
    ],
    [criticalAlerts.length, pendingApprovals.length, pendingDeletionRequests.length, setActiveModule, unresolvedEscalations.length]
  );

  if (!isAdmin) {
    return (
      <DashboardPage accent="sky">
        <EmptyState
          title="Administrative access required"
          description="Your account does not have the required privileges to view the oversight console."
          actionLabel="Open command center"
          onAction={() => setActiveModule("command_center")}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage accent="sky">
      <DashboardHero
        eyebrow="Security & governance"
        title="Administrative oversight"
        description="Live command surface for identity controls, system health, governance actions, and audit response across the platform."
        badges={[
          <HeroBadge key="posture" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{securityPosture}% security posture</HeroBadge>,
          <HeroBadge key="approvals" className="border-amber-500/20 bg-amber-500/10 text-amber-200">{pendingApprovals.length} pending approvals</HeroBadge>,
          <HeroBadge key="alerts" className="border-rose-500/20 bg-rose-500/10 text-rose-200">{criticalAlerts.length} critical alerts</HeroBadge>,
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => setActiveModule("reporting")}>Export reporting</Button>
            <Button onClick={() => setActiveModule("admin_console")}>Open admin console</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active users" value={activeUsers.length} helper={`${users.length} profiles tracked`} accent="sky" loading={isLoadingData} />
        <MetricCard label="Privileged queue" value={pendingApprovals.length} helper="Awaiting access approval" accent="amber" loading={isLoadingData} />
        <MetricCard label="Critical alerts" value={criticalAlerts.length} helper={incidentTrendLabel} accent="rose" loading={isLoadingData} />
        <MetricCard label="Deletion requests" value={pendingDeletionRequests.length} helper={`${unresolvedEscalations.length} unresolved escalations`} accent="indigo" loading={isLoadingData} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Priority board"
          description="Triage the most urgent admin queues before moving into deeper analysis."
          action={<StatusPill tone="sky">Alerts {Math.round(refreshIntervals.alertsMs / 1000)}s • Metrics {Math.round(refreshIntervals.metricsMs / 1000)}s</StatusPill>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {priorityBoard.map((item) => (
              <ListItemCard
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                meta={<StatusPill tone={item.tone}>{item.value}</StatusPill>}
                action={<Button size="sm" variant="outline" onClick={item.action}>{item.actionLabel}</Button>}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Operator snapshot" description="A compact read on posture, throughput, and current workload.">
          <div className="grid gap-3">
            <ListItemCard title="System uptime" subtitle="Latest recorded service posture" meta={<StatusPill tone="emerald">{systemMetrics?.systemUptime ?? 0}%</StatusPill>} />
            <ListItemCard title="API requests today" subtitle="Live platform usage" meta={systemMetrics?.apiRequestsToday ?? 0} />
            <ListItemCard title="Data points processed" subtitle="Current analytics pipeline" meta={systemMetrics?.dataPointsProcessed ?? "--"} />
            <ListItemCard title="Alert surface" subtitle="Combined alert watch and backlog pressure" meta={<StatusPill tone={criticalAlerts.length > 0 ? "rose" : "sky"}>{criticalAlerts.length > 0 ? `${criticalAlerts.length} critical` : "Calm"}</StatusPill>} />
            <ListItemCard title="Recent audit actors" subtitle="Unique operators in the latest audit activity window" meta={<StatusPill tone="sky">{recentAuditActors}</StatusPill>} />
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Governance telemetry" description="Latest system throughput and governance event activity.">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            {sanitizedIncidentSeries.length > 0 ? (
              <div className="h-[280px] rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sanitizedIncidentSeries}>
                    <defs>
                      <linearGradient id="admin-incident" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#38bdf8" fill="url(#admin-incident)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="No governance telemetry yet"
                description="Incident telemetry will render here once the monitoring and governance feeds start publishing data."
                guidance={[
                  "Confirm incident telemetry is reaching the connected environment and is being persisted successfully.",
                  "After new points are ingested, this chart will populate automatically on the next refresh cycle.",
                ]}
              />
            )}
            <div className="grid gap-3">
              <ListItemCard title="Security posture" subtitle="Composite of uptime, encryption, and alert pressure" meta={<StatusPill tone={securityPosture >= 85 ? "emerald" : securityPosture >= 65 ? "amber" : "rose"}>{securityPosture}%</StatusPill>} />
              <ListItemCard title="Incident trend" subtitle="Current delta compared with the previous interval" meta={incidentTrend.delta === 0 ? "Stable" : incidentTrend.delta > 0 ? `+${incidentTrend.delta}` : incidentTrend.delta} />
              <ListItemCard title="Governance activity" subtitle="Events opened across the weekly lifecycle" meta={governanceTimeline.reduce((sum, bucket) => sum + bucket.opened, 0)} />
              <ListItemCard title="Active alerts" subtitle="Current monitoring watch surface" meta={systemMetrics?.activeAlerts ?? criticalAlerts.length} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Identity & role mix" description="Real-time role distribution and access posture.">
          <div className="space-y-3">
            {roleDistribution.length === 0 ? (
              <EmptyState
                title="No profiles available"
                description="User profiles will appear here as soon as they are synchronized."
                guidance={[
                  "Approve and activate role access so live identity coverage can populate this view.",
                  "If accounts were created recently, allow the workspace sync to refresh before reviewing access posture again.",
                ]}
              />
            ) : (
              roleDistribution.map((entry) => (
                <div key={entry.role} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{entry.role}</p>
                      <p className="text-xs text-slate-400">{percent(entry.count, users.length)}% of active identity surface</p>
                    </div>
                    <StatusPill tone="sky">{entry.count}</StatusPill>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Case resolution lookup" description="Shared live lookup for case status verification across admin workflows.">
          <CaseStatusLookup
            description="Use a secure case reference to retrieve the current status, priority, and last movement in the case pipeline."
            placeholder="Enter secure case ID"
          />
        </SectionCard>

        <SectionCard title="Recommended actions" description="System-generated next steps based on current admin pressure points.">
          <AdminRecommendedActionsList items={recommendedActions} onAction={setActiveModule} />
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Attention matrix" description="At-a-glance view of where intervention is most likely needed next.">
          <div className="grid gap-3 sm:grid-cols-2">
            <ListItemCard title="Approvals" subtitle="Privileged identities waiting for enablement" meta={<StatusPill tone="amber">{pendingApprovals.length}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("admin_console")}>Review</Button>} />
            <ListItemCard title="Escalations" subtitle="Risk cases still open in oversight" meta={<StatusPill tone="rose">{unresolvedEscalations.length}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("justice")}>Open queue</Button>} />
            <ListItemCard title="Privacy" subtitle="Deletion processing awaiting closure" meta={<StatusPill tone="indigo">{pendingDeletionRequests.length}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("admin_console")}>Process</Button>} />
            <ListItemCard title="Signal watch" subtitle="Critical alerts currently affecting posture" meta={<StatusPill tone={criticalAlerts.length > 0 ? "rose" : "emerald"}>{criticalAlerts.length > 0 ? criticalAlerts.length : "Clear"}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("governance")}>Inspect</Button>} />
          </div>
        </SectionCard>

        <SectionCard title="Feed health" description="Status of the main admin data surfaces used by the oversight console.">
          <AdminFeedHealthGrid items={feedHealth} />
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Audit trail"
          description="Realtime log stream filtered by severity and search."
          action={auditFeed.length > 6 ? <StatusPill tone="sky">{auditFeed.length} matches</StatusPill> : undefined}
        >
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <label className="flex-1">
              <span className="sr-only">Search audit trail</span>
              <input
                aria-label="Search audit trail"
                value={auditSearch}
                onChange={(event) => {
                  setAuditSearch(event.target.value);
                  setAuditExpanded(false);
                }}
                placeholder="Search actions, modules, or users"
                className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none"
              />
            </label>
            <label>
              <span className="sr-only">Filter audit severity</span>
              <select
                aria-label="Filter audit severity"
                value={auditSeverity}
                onChange={(event) => {
                  setAuditSeverity(event.target.value);
                  setAuditExpanded(false);
                }}
                className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none"
              >
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>
          </div>
          <AdminAuditSeveritySummary summary={auditSeveritySummary} />
          <div className="space-y-3">
            {visibleAuditFeed.length === 0 ? (
              <EmptyState title="No matching audit events" description="Adjust your search or severity filters to inspect the governance ledger." />
            ) : (
              visibleAuditFeed.map((entry) => (
                <ListItemCard
                  key={`${entry.time}-${entry.action}-${entry.user}`}
                  title={entry.action}
                  subtitle={`${entry.user} • ${entry.module} • ${formatRelativeDateTime(entry.time)}`}
                  meta={<StatusPill tone={severityTone[entry.severity as keyof typeof severityTone] ?? "slate"}>{entry.severity}</StatusPill>}
                />
              ))
            )}
          </div>
          {auditFeed.length > 6 ? (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setAuditExpanded((current) => !current)}>
                {auditExpanded ? "Show less" : `Show ${Math.min(12, auditFeed.length)} entries`}
              </Button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Alert & activity watch" description="Live alert feed and governance activity volume.">
          <div className="grid gap-3">
            {uniqueAlerts.slice(0, 4).map((entry) => (
              <ListItemCard
                key={entry.id}
                title={entry.message}
                subtitle={`${entry.module} • ${entry.time}`}
                meta={<StatusPill tone={entry.type === "critical" ? "rose" : "amber"}>{entry.type || "notice"}</StatusPill>}
              />
            ))}
            {uniqueAlerts.length === 0 ? (
              <EmptyState
                title="No system alerts"
                description="Critical and warning signals will appear here in real time."
                guidance={[
                  "Platform, security, and governance notices will appear here when the system detects something that needs review.",
                  "If you expected alerts from a recent workflow, refresh after the next monitoring cycle completes.",
                ]}
              />
            ) : null}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Critical signals</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{criticalAlerts.length}</p>
                </div>
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-200">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Privileged identities</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{privilegedUsers.length}</p>
                </div>
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-200">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Escalation watch</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{unresolvedEscalations.length}</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Privacy queue</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{pendingDeletionRequests.length}</p>
                </div>
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-200">
                  <Database className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Governance activity</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {governanceTimeline.map((bucket) => (
                <div key={bucket.label} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-400">{bucket.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{bucket.opened}</p>
                  <p className="text-xs text-slate-500">events</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Threshold notifications" description="Alerts generated when key admin queues exceed operational thresholds.">
          <AdminThresholdNotifications items={thresholdNotifications} />
        </SectionCard>

        <SectionCard title="Admin efficiency notes" description="Pragmatic improvements that will keep the oversight console maintainable.">
          <div className="space-y-3">
            <ListItemCard title="Thresholds now come from the backend" subtitle={`Approval ${adminThresholds.pendingApprovalsWarning}, escalations ${adminThresholds.unresolvedEscalationsWarning}, privacy ${adminThresholds.pendingDeletionRequestsWarning}, posture minimum ${adminThresholds.securityPostureMinimum}%.`} />
            <ListItemCard title="Polling policy is centralized" subtitle={`Metrics ${Math.round(refreshIntervals.metricsMs / 1000)}s, alerts ${Math.round(refreshIntervals.alertsMs / 1000)}s, audit ${Math.round(refreshIntervals.auditMs / 1000)}s.`} />
            <ListItemCard title="Normalize data upstream" subtitle="Alert, incident, and audit sanitization now sits outside the render layer and should continue moving into shared data services." />
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-1">
        <SectionCard title="Live posture summary" description="Quick, role-specific admin guidance for the next move.">
          <div className="grid gap-3 md:grid-cols-3">
            <ListItemCard
              title="Identity controls"
              subtitle="Open the admin console when you need to provision, approve, or recover privileged accounts."
              meta={<StatusPill tone="sky"><ShieldCheck className="mr-1 h-3.5 w-3.5 inline" />Control ready</StatusPill>}
              action={<Button size="sm" variant="outline" onClick={() => setActiveModule("admin_console")}>Open console</Button>}
            />
            <ListItemCard
              title="Governance review"
              subtitle="Use the governance hub to inspect alert-driven policy or fairness issues across the platform."
              meta={<StatusPill tone={criticalAlerts.length > 0 ? "rose" : "emerald"}>{criticalAlerts.length > 0 ? "Needs review" : "Stable"}</StatusPill>}
              action={<Button size="sm" variant="outline" onClick={() => setActiveModule("governance")}>Open governance</Button>}
            />
            <ListItemCard
              title="Operational escalation"
              subtitle="Jump into the justice queue when sensitive escalations require cross-team follow-up."
              meta={<StatusPill tone={unresolvedEscalations.length > 0 ? "amber" : "emerald"}>{unresolvedEscalations.length > 0 ? "Backlog active" : "Queue clear"}</StatusPill>}
              action={<Button size="sm" variant="outline" onClick={() => setActiveModule("justice")}>Open justice</Button>}
            />
          </div>
        </SectionCard>
      </section>
    </DashboardPage>
  );
};

export default AdminDashboard;


