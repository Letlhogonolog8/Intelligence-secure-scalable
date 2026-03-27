import { useMemo } from "react";
import { useAlertsFeed, useEscalationReviews, useOrganizationCoordination, useUserProfile } from "@/data/aegisData";
import { useLiveJusticeCases, useLiveSafetyPlans, useLiveSurvivorChatSessions, useLiveSurvivors } from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import { DashboardHero, DashboardPage, EmptyState, HeroBadge, ListItemCard, MetricCard, SectionCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import { buildWeeklyLifecycle, dedupeBy, formatRelativeDateTime, percent, sortByPriorityAndRecency } from "@/lib/dashboardMetrics";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CounselorDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const { setActiveModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const resolvedRole = (profile?.role ?? "counselor") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];

  const { data: justiceCases = [], isLoading: casesLoading } = useLiveJusticeCases({ assignedTo: user?.id, staleTime: 15000, refetchInterval: 30000, limit: 120 });
  const { data: sessions = [], isLoading: sessionsLoading } = useLiveSurvivorChatSessions({ counselorId: user?.id, staleTime: 10000, refetchInterval: 20000, limit: 120 });
  const { data: survivors = [], isLoading: survivorsLoading } = useLiveSurvivors({ staleTime: 15000, refetchInterval: 30000, limit: 120 });
  const { data: safetyPlans = [], isLoading: plansLoading } = useLiveSafetyPlans({ staleTime: 15000, refetchInterval: 30000, limit: 120 });
  const { data: escalationReviews = [], isLoading: escalationLoading } = useEscalationReviews({ staleTime: 10000, refetchInterval: 20000, limit: 80 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 10000, refetchInterval: 15000, limit: 10 });
  const { data: coordination = [], isLoading: coordinationLoading } = useOrganizationCoordination({ staleTime: 15000, refetchInterval: 30000, limit: 30 });

  const isLoadingData = casesLoading || sessionsLoading || survivorsLoading || plansLoading || escalationLoading || alertsLoading || coordinationLoading;

  const activeCases = useMemo(() => justiceCases.filter((entry) => !["closed", "resolved"].includes(entry.status.toLowerCase())), [justiceCases]);
  const attentionNeeded = useMemo(() => activeCases.filter((entry) => ["critical", "high"].includes(entry.priority.toLowerCase())), [activeCases]);
  const openSessions = useMemo(() => sessions.filter((entry) => !entry.endedAt), [sessions]);
  const escalatedSessions = useMemo(() => sessions.filter((entry) => entry.escalatedToCounselor), [sessions]);
  const activeCollaborations = useMemo(() => coordination.filter((entry) => ["pending", "accepted", "in_progress"].includes(entry.status)), [coordination]);
  const visibleCases = useMemo(() => sortByPriorityAndRecency(activeCases).slice(0, 5), [activeCases]);
  const alertHighlights = useMemo(
    () => dedupeBy(alertsFeed, (entry) => `${entry.module}|${entry.type}|${entry.message}`).slice(0, 4),
    [alertsFeed]
  );
  const coveredSafetyPlans = useMemo(() => new Set(safetyPlans.map((entry) => entry.survivorId)).size, [safetyPlans]);
  const survivorCoverage = percent(coveredSafetyPlans, Math.max(survivors.length, 1));
  const weeklySessionFlow = useMemo(() => buildWeeklyLifecycle(sessions, (entry) => entry.createdAt, (entry) => entry.endedAt, 4), [sessions]);
  const sessionExpiry = useMemo(() => (session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : "Session inactive"), [session?.expires_at]);

  return (
    <DashboardPage accent="emerald">
      <DashboardHero
        eyebrow="Care coordination"
        title="Counselor operations board"
        description="Live caseload, support-session, escalation, and safety-plan oversight tailored to your assigned survivor support queue."
        badges={[
          <HeroBadge key="caseload" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{activeCases.length} active cases</HeroBadge>,
          <HeroBadge key="sessions" className="border-sky-500/20 bg-sky-500/10 text-sky-200">{openSessions.length} open sessions</HeroBadge>,
          <HeroBadge key="coverage" className="border-violet-500/20 bg-violet-500/10 text-violet-200">{survivorCoverage}% safety-plan coverage</HeroBadge>,
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => setActiveModule("reporting")} disabled={!permissions.canAccessAnalytics}>Daily brief</Button>
            <Button onClick={() => setActiveModule("survivor_support")} disabled={!permissions.canViewOwnData}>Open support console</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active caseload" value={activeCases.length} helper={`${attentionNeeded.length} high-risk cases`} accent="emerald" loading={isLoadingData} />
        <MetricCard label="Open sessions" value={openSessions.length} helper={`${escalatedSessions.length} escalated to counselor`} accent="sky" loading={isLoadingData} />
        <MetricCard label="Safety plans" value={coveredSafetyPlans} helper={`${survivors.length} visible survivor profiles`} accent="indigo" loading={isLoadingData} />
        <MetricCard label="Coordination backlog" value={activeCollaborations.length} helper={`${escalationReviews.length} escalation reviews`} accent="amber" loading={isLoadingData} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Care guidance" description="Live signals derived from your current support queue.">
          <div className="grid gap-3 md:grid-cols-2">
            <ListItemCard title="Risk load" subtitle="Share of open cases marked high or critical" meta={<StatusPill tone={attentionNeeded.length > 0 ? "rose" : "emerald"}>{percent(attentionNeeded.length, Math.max(activeCases.length, 1))}%</StatusPill>} />
            <ListItemCard title="Follow-ups due" subtitle="Open sessions still awaiting closure" meta={openSessions.length} />
            <ListItemCard title="Session expiry" subtitle="Current secure access window" meta={sessionExpiry} />
            <ListItemCard title="Cross-team handoffs" subtitle="Pending partner coordination items" meta={activeCollaborations.length} />
          </div>
        </SectionCard>

        <SectionCard title="Realtime alert queue" description="Support-related alerts and operational signals.">
          <div className="space-y-3">
            {alertHighlights.length === 0 ? (
                <EmptyState
                  title="No new alerts"
                  description="The support queue is clear right now."
                  guidance={[
                    "New escalations and support notices will appear here automatically when survivors need attention.",
                    "If your team just updated a case, give the realtime feed a moment to refresh.",
                  ]}
                />
              ) : (
              alertHighlights.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.message}
                  subtitle={`${entry.module || "support"} · ${entry.time}`}
                  meta={<StatusPill tone={entry.type === "critical" ? "rose" : "amber"}>{entry.type || "notice"}</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Today’s live queue" description="Current cases and support sessions sorted by urgency.">
          <div className="space-y-3">
            {visibleCases.length === 0 && openSessions.length === 0 ? (
                <EmptyState
                  title="No active queue items"
                  description="Assigned cases and support sessions will surface here automatically in real time."
                  guidance={[
                    "Assigned cases and support conversations appear here as soon as they are linked to your account.",
                    "If a survivor was recently reassigned, refresh after the care coordination sync completes.",
                  ]}
                />
              ) : (
              <>
                {visibleCases.map((entry) => (
                  <ListItemCard
                    key={entry.id}
                    title={`Case ${entry.caseNumber}`}
                    subtitle={`${entry.stage || "intake"} · ${entry.region || "region pending"} · ${formatRelativeDateTime(entry.updatedAt)}`}
                    meta={<StatusPill tone={entry.priority === "critical" ? "rose" : entry.priority === "high" ? "amber" : "sky"}>{entry.priority}</StatusPill>}
                    action={<Button size="sm" variant="outline" onClick={() => setActiveModule("justice")}>Review</Button>}
                  />
                ))}
                {openSessions.slice(0, 3).map((entry) => (
                  <ListItemCard
                    key={entry.id}
                    title={`Support session ${entry.id.slice(0, 8)}`}
                    subtitle={`${entry.riskLevelEnd ?? entry.riskLevelStart ?? "risk pending"} · opened ${formatRelativeDateTime(entry.createdAt)}`}
                    meta={<StatusPill tone={entry.escalatedToCounselor ? "amber" : "emerald"}>{entry.escalatedToCounselor ? "escalated" : "active"}</StatusPill>}
                    action={<Button size="sm" variant="outline" onClick={() => setActiveModule("survivor_support")}>Open</Button>}
                  />
                ))}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Risk distribution" description="Real-time spread across your assigned case queue.">
          <div className="space-y-3">
            {[
              ["critical", activeCases.filter((entry) => entry.priority === "critical").length, "rose"],
              ["high", activeCases.filter((entry) => entry.priority === "high").length, "amber"],
              ["medium", activeCases.filter((entry) => entry.priority === "medium").length, "sky"],
              ["low", activeCases.filter((entry) => entry.priority === "low").length, "emerald"],
            ].map(([label, value, tone]) => (
              <ListItemCard key={String(label)} title={`${label} risk`} subtitle="Assigned case count" meta={<StatusPill tone={tone as "rose" | "amber" | "sky" | "emerald"}>{value as number}</StatusPill>} />
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Session flow" description="Weekly opened versus resolved support sessions.">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySessionFlow}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip />
                <Bar dataKey="opened" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Documentation posture" description="Live visibility into support plans and escalation workflow.">
          <div className="space-y-3">
            <ListItemCard title="Safety plans linked" subtitle="Visible survivor plans with active coverage" meta={<StatusPill tone="emerald">{coveredSafetyPlans}</StatusPill>} />
            <ListItemCard title="Escalation reviews" subtitle="Support incidents awaiting counselor/admin closure" meta={<StatusPill tone={escalationReviews.length > 0 ? "amber" : "emerald"}>{escalationReviews.length}</StatusPill>} />
            <ListItemCard title="Partner handoffs" subtitle="Police and NGO coordination in motion" meta={<StatusPill tone={activeCollaborations.length > 0 ? "sky" : "emerald"}>{activeCollaborations.length}</StatusPill>} />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setActiveModule("personal_dashboard")}>Review safety plans</Button>
              <Button onClick={() => setActiveModule("survivor_support")}>Open sessions</Button>
            </div>
          </div>
        </SectionCard>
      </section>
    </DashboardPage>
  );
};

export default CounselorDashboard;
