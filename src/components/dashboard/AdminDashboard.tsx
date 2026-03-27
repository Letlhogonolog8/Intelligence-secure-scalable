import { useMemo, useState } from "react";
import {
  useAlertsFeed,
  useAuditLogs,
  useDeletionRequests,
  useEscalationReviews,
  useIncidentTimeSeries,
  useSystemMetrics,
  useUserProfile,
} from "@/data/aegisData";
import { useLiveUserProfiles } from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import { DashboardHero, DashboardPage, EmptyState, HeroBadge, ListItemCard, MetricCard, SectionCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { CaseStatusLookup } from "@/components/dashboard/CaseStatusLookup";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { buildWeeklyLifecycle, dedupeBy, formatRelativeDateTime, percent } from "@/lib/dashboardMetrics";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setActiveModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const isAdmin = profile?.role === "admin";

  const { data: users = [], isLoading: usersLoading } = useLiveUserProfiles({ enabled: isAdmin, staleTime: 15000, refetchInterval: 30000, limit: 250 });
  const { data: systemMetrics, isLoading: metricsLoading } = useSystemMetrics({ enabled: isAdmin, staleTime: 10000, refetchInterval: 30000 });
  const { data: incidentTimeSeries = [], isLoading: incidentsLoading } = useIncidentTimeSeries({ enabled: isAdmin, staleTime: 10000, refetchInterval: 30000 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ enabled: isAdmin, staleTime: 5000, refetchInterval: 15000, limit: 12 });
  const { data: auditLogs = [], isLoading: auditLoading } = useAuditLogs({ enabled: isAdmin, staleTime: 10000, refetchInterval: 30000, limit: 20 });
  const { data: escalationReviews = [], isLoading: escalationsLoading } = useEscalationReviews({ enabled: isAdmin, staleTime: 10000, refetchInterval: 30000, limit: 20 });
  const { data: deletionRequests = [], isLoading: deletionsLoading } = useDeletionRequests({ enabled: isAdmin, staleTime: 10000, refetchInterval: 30000, limit: 20 });

  const [auditSearch, setAuditSearch] = useState("");
  const [auditSeverity, setAuditSeverity] = useState<string>("all");

  const isLoadingData = usersLoading || metricsLoading || incidentsLoading || alertsLoading || auditLoading || escalationsLoading || deletionsLoading;

  const activeUsers = useMemo(() => users.filter((entry) => entry.isActive), [users]);
  const privilegedUsers = useMemo(() => users.filter((entry) => ["admin", "analyst", "ngo", "police", "counselor"].includes(entry.role)), [users]);
  const pendingApprovals = useMemo(() => privilegedUsers.filter((entry) => entry.approvalStatus === "pending"), [privilegedUsers]);
  const uniqueAlerts = useMemo(() => dedupeBy(alertsFeed, (entry) => `${entry.module}|${entry.type}|${entry.message}`), [alertsFeed]);
  const criticalAlerts = useMemo(() => uniqueAlerts.filter((entry) => entry.type === "critical"), [uniqueAlerts]);
  const unresolvedEscalations = useMemo(() => escalationReviews.filter((entry) => !["resolved", "closed"].includes(entry.status.toLowerCase())), [escalationReviews]);
  const pendingDeletionRequests = useMemo(() => deletionRequests.filter((entry) => entry.status !== "processed"), [deletionRequests]);
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
    const term = auditSearch.trim().toLowerCase();
    return auditLogs
      .filter((entry) => {
        const matchesSearch = !term || [entry.action, entry.module, entry.user, entry.description ?? ""]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term));
        const matchesSeverity = auditSeverity === "all" || entry.severity === auditSeverity;
        return matchesSearch && matchesSeverity;
      })
      .slice(0, 6);
  }, [auditLogs, auditSearch, auditSeverity]);

  const incidentTrend = useMemo(() => {
    const latest = incidentTimeSeries[incidentTimeSeries.length - 1]?.value ?? 0;
    const previous = incidentTimeSeries[incidentTimeSeries.length - 2]?.value ?? latest;
    return {
      latest,
      delta: latest - previous,
    };
  }, [incidentTimeSeries]);

  const governanceTimeline = useMemo(
    () => buildWeeklyLifecycle(auditLogs, (entry) => entry.time, undefined, 4).map((bucket) => ({
      label: bucket.label,
      opened: bucket.opened,
      active: bucket.active,
    })),
    [auditLogs]
  );

  const securityPosture = useMemo(() => {
    const uptime = systemMetrics?.systemUptime ?? 0;
    const encryptionFactor = systemMetrics?.encryptionStatus === "active" ? 100 : 70;
    const alertPenalty = Math.min(35, criticalAlerts.length * 6);
    return Math.max(0, Math.round((uptime + encryptionFactor) / 2 - alertPenalty));
  }, [criticalAlerts.length, systemMetrics?.encryptionStatus, systemMetrics?.systemUptime]);

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
        <MetricCard label="Critical alerts" value={criticalAlerts.length} helper={`Δ ${incidentTrend.delta >= 0 ? `+${incidentTrend.delta}` : incidentTrend.delta} incident signal`} accent="rose" loading={isLoadingData} />
        <MetricCard label="Deletion requests" value={pendingDeletionRequests.length} helper={`${unresolvedEscalations.length} unresolved escalations`} accent="indigo" loading={isLoadingData} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Governance telemetry" description="Latest system throughput and governance event activity.">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="h-[280px] rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incidentTimeSeries}>
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
            <div className="grid gap-3">
              <ListItemCard title="System uptime" subtitle="Latest recorded service posture" meta={<StatusPill tone="emerald">{systemMetrics?.systemUptime ?? 0}%</StatusPill>} />
              <ListItemCard title="API requests today" subtitle="Live platform usage" meta={systemMetrics?.apiRequestsToday ?? 0} />
              <ListItemCard title="Data points processed" subtitle="Current analytics pipeline" meta={systemMetrics?.dataPointsProcessed ?? "--"} />
              <ListItemCard title="Active alerts" subtitle="Monitoring surface" meta={systemMetrics?.activeAlerts ?? criticalAlerts.length} />
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

        <SectionCard title="Operational backlog" description="Queues that require administrative attention right now.">
          <div className="grid gap-3 md:grid-cols-3">
            <ListItemCard title="Approvals queue" subtitle="Privileged roles awaiting enablement" meta={<StatusPill tone="amber">{pendingApprovals.length}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("admin_console")}>Review</Button>} />
            <ListItemCard title="Escalation reviews" subtitle="Open risk cases needing oversight" meta={<StatusPill tone="rose">{unresolvedEscalations.length}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("justice")}>Open queue</Button>} />
            <ListItemCard title="Deletion processing" subtitle="Privacy requests pending closure" meta={<StatusPill tone="indigo">{pendingDeletionRequests.length}</StatusPill>} action={<Button size="sm" variant="outline" onClick={() => setActiveModule("admin_console")}>Process</Button>} />
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Audit trail" description="Realtime log stream filtered by severity and search.">
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <input
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="Search actions, modules, or users"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none"
            />
            <select
              value={auditSeverity}
              onChange={(event) => setAuditSeverity(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div className="space-y-3">
            {auditFeed.length === 0 ? (
              <EmptyState title="No matching audit events" description="Adjust your search or severity filters to inspect the governance ledger." />
            ) : (
              auditFeed.map((entry) => (
                <ListItemCard
                  key={`${entry.time}-${entry.action}-${entry.user}`}
                  title={entry.action}
                  subtitle={`${entry.user || "system"} · ${entry.module || "core"} · ${formatRelativeDateTime(entry.time)}`}
                  meta={<StatusPill tone={entry.severity === "critical" ? "rose" : entry.severity === "warning" ? "amber" : "slate"}>{entry.severity}</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Alert & activity watch" description="Live alert feed and governance activity volume.">
          <div className="space-y-3">
            {uniqueAlerts.slice(0, 5).map((entry) => (
              <ListItemCard
                key={entry.id}
                title={entry.message}
                subtitle={`${entry.module || "core"} · ${entry.time}`}
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
    </DashboardPage>
  );
};

export default AdminDashboard;
