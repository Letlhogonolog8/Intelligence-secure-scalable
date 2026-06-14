import { useMemo } from "react";
import {
  useAlertsFeed,
  useEscalationReviews,
  useOrganizationCoordination,
  useUserProfile,
} from "@/data/aegisData";
import {
  useLiveNgoPrograms,
  useLiveOrganization,
  useLiveResources,
  useLiveSurvivors,
  useLiveUserProfiles,
} from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import {
  ChartFrame,
  DashboardHero,
  DashboardPage,
  EmptyState,
  HeroBadge,
  ListItemCard,
  MetricCard,
  SectionCard,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { useOrganizationContext } from "@/contexts/organizationContext";
import VoiceNoteTranslator from "@/components/voice/VoiceNoteTranslator";
import VoiceEvidenceArchive from "@/components/voice/VoiceEvidenceArchive";
import SharedEvidencePanel from "@/components/evidence/SharedEvidencePanel";
import CommunityReportsPanel from "@/components/community/CommunityReportsPanel";
import CoordinationBoard from "@/components/coordination/CoordinationBoard";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import {
  averageHoursBetween,
  buildWeeklyLifecycle,
  dedupeBy,
  formatHours,
  formatRelativeDateTime,
  percent,
  uniqueCount,
} from "@/lib/dashboardMetrics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const NgoDashboard: React.FC = () => {
  const { organizationId, organizationName } = useOrganizationContext();
  const { user, session } = useAuth();
  const { setActiveModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const isNgo = profile?.role === "ngo";
  const resolvedRole = (profile?.role ?? "ngo") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];
  const effectiveOrganizationId =
    organizationId ?? profile?.organizationId ?? null;

  const { data: organization } = useLiveOrganization(effectiveOrganizationId, {
    enabled: isNgo && Boolean(effectiveOrganizationId),
    staleTime: 15000,
    refetchInterval: 30000,
  });
  const { data: teamMembers = [], isLoading: teamLoading } =
    useLiveUserProfiles({
      enabled: isNgo && Boolean(effectiveOrganizationId),
      organizationId: effectiveOrganizationId,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 200,
    });
  const { data: survivors = [], isLoading: survivorsLoading } =
    useLiveSurvivors({
      enabled: isNgo,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 200,
    });
  const { data: programs = [], isLoading: programsLoading } =
    useLiveNgoPrograms({
      enabled: isNgo && Boolean(effectiveOrganizationId),
      organizationId: effectiveOrganizationId,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 50,
    });
  const { data: resources = [], isLoading: resourcesLoading } =
    useLiveResources({
      enabled: isNgo,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 200,
    });
  const { data: coordination = [], isLoading: coordinationLoading } =
    useOrganizationCoordination({
      enabled: isNgo,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 50,
    });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({
    enabled: isNgo,
    staleTime: 10000,
    refetchInterval: 15000,
    limit: 10,
  });
  const { data: escalations = [], isLoading: escalationsLoading } =
    useEscalationReviews({
      enabled: isNgo,
      staleTime: 10000,
      refetchInterval: 20000,
      limit: 20,
    });

  const isLoadingData =
    teamLoading ||
    survivorsLoading ||
    programsLoading ||
    resourcesLoading ||
    coordinationLoading ||
    alertsLoading ||
    escalationsLoading;

  const counselors = useMemo(
    () => teamMembers.filter((entry) => entry.role === "counselor"),
    [teamMembers],
  );
  const coordinators = useMemo(
    () => teamMembers.filter((entry) => entry.role === "ngo"),
    [teamMembers],
  );
  const organizationCoordination = useMemo(() => {
    if (!effectiveOrganizationId) return coordination;
    return coordination.filter(
      (entry) =>
        entry.fromOrganizationId === effectiveOrganizationId ||
        entry.toOrganizationId === effectiveOrganizationId,
    );
  }, [coordination, effectiveOrganizationId]);
  const shelterResources = useMemo(
    () => resources.filter((entry) => entry.resourceType === "shelter"),
    [resources],
  );
  const alwaysOnResources = useMemo(
    () => resources.filter((entry) => entry.available247),
    [resources],
  );
  const pendingHandoffs = useMemo(
    () =>
      organizationCoordination.filter((entry) => entry.status === "pending"),
    [organizationCoordination],
  );
  const completedHandoffs = useMemo(
    () =>
      organizationCoordination.filter((entry) => entry.status === "completed"),
    [organizationCoordination],
  );
  const urgentEscalations = useMemo(() => {
    return escalations.filter((entry) => {
      if (!["high", "critical"].includes(entry.riskLevel.toLowerCase()))
        return false;
      return !entry.assignedTo || !user?.id || entry.assignedTo === user.id;
    });
  }, [escalations, user?.id]);
  const coordinationTrend = useMemo(
    () =>
      buildWeeklyLifecycle(
        organizationCoordination,
        (entry) => entry.createdAt,
        (entry) => entry.completedAt,
        4,
      ),
    [organizationCoordination],
  );
  const averageCompletionHours = useMemo(
    () =>
      averageHoursBetween(
        completedHandoffs,
        (entry) => entry.createdAt,
        (entry) => entry.completedAt,
      ),
    [completedHandoffs],
  );
  const partnerCoverage = useMemo(
    () =>
      uniqueCount(organizationCoordination, (entry) => entry.toOrganizationId),
    [organizationCoordination],
  );
  const alertHighlights = useMemo(
    () =>
      dedupeBy(
        alertsFeed.filter((entry) =>
          [
            "survivor_support",
            "reporting",
            "command_center",
            "admin_console",
          ].includes(entry.module || ""),
        ),
        (entry) => `${entry.module}|${entry.type}|${entry.message}`,
      ).slice(0, 4),
    [alertsFeed],
  );
  const activePrograms = useMemo(
    () => programs.filter((entry) => entry.isActive),
    [programs],
  );
  const survivorLoad = percent(
    survivors.length,
    Math.max(teamMembers.length, 1),
  );
  const sessionExpiry = session?.expires_at
    ? new Date(session.expires_at * 1000).toLocaleTimeString()
    : "Session inactive";
  const lastCoordinationSync =
    organizationCoordination
      .map((entry) => entry.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) => new Date(right).getTime() - new Date(left).getTime(),
      )[0] ?? null;

  if (profile && !isNgo) {
    return (
      <DashboardPage accent="cyan">
        <EmptyState
          title="NGO access required"
          description="Your account does not have the required privileges to view the NGO operations hub."
          actionLabel="Open dashboard"
          onAction={() => setActiveModule("dashboard")}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage accent="cyan">
      <DashboardHero
        eyebrow="Partner operations"
        title={`${organizationName || organization?.name || "Organization"} hub`}
        description="Live NGO operations view for survivor support coverage, referral throughput, shelter resources, and program execution."
        badges={[
          <HeroBadge
            key="region"
            className="border-sky-500/20 bg-sky-500/10 text-sky-200"
          >
            {organization?.region || "Region syncing"}
          </HeroBadge>,
          <HeroBadge
            key="survivors"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          >
            {survivors.length} visible survivors
          </HeroBadge>,
          <HeroBadge
            key="programs"
            className="border-indigo-500/20 bg-indigo-500/10 text-indigo-200"
          >
            {activePrograms.length} active programs
          </HeroBadge>,
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setActiveModule("reporting")}
              disabled={!permissions.canAccessAnalytics}
            >
              Impact report
            </Button>
            <Button
              onClick={() => setActiveModule("policy")}
              disabled={!permissions.canAccessAnalytics}
            >
              Launch initiative
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Team capacity"
          value={teamMembers.length}
          helper={`${counselors.length} counselors · ${coordinators.length} coordinators`}
          accent="sky"
          loading={isLoadingData}
        />
        <MetricCard
          label="Survivor coverage"
          value={survivors.length}
          helper={`${survivorLoad}% survivor-to-team ratio`}
          accent="emerald"
          loading={isLoadingData}
        />
        <MetricCard
          label="Pending handoffs"
          value={pendingHandoffs.length}
          helper={`${completedHandoffs.length} completed referrals`}
          accent="amber"
          loading={isLoadingData}
        />
        <MetricCard
          label="Shelter network"
          value={shelterResources.length}
          helper={`${alwaysOnResources.length} resources available 24/7`}
          accent="indigo"
          loading={isLoadingData}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Live operations snapshot"
          description="Current program, referral, and resource posture."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ListItemCard
              title="Program coverage"
              subtitle="Active NGO programs for this organization"
              meta={
                <StatusPill tone="indigo">{activePrograms.length}</StatusPill>
              }
            />
            <ListItemCard
              title="Referral turnaround"
              subtitle="Average time from handoff to completion"
              meta={
                <StatusPill tone="emerald">
                  {formatHours(averageCompletionHours)}
                </StatusPill>
              }
            />
            <ListItemCard
              title="Partner reach"
              subtitle="Unique destination organizations in active pipeline"
              meta={<StatusPill tone="sky">{partnerCoverage}</StatusPill>}
            />
            <ListItemCard
              title="Urgent escalations"
              subtitle="High-severity support items visible to the NGO queue"
              meta={
                <StatusPill
                  tone={urgentEscalations.length > 0 ? "rose" : "emerald"}
                >
                  {urgentEscalations.length}
                </StatusPill>
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Security & access"
          description="Session and organization verification posture."
        >
          <div className="space-y-3">
            <ListItemCard
              title="Session expiry"
              subtitle="Current secure NGO session window"
              meta={sessionExpiry}
            />
            <ListItemCard
              title="Organization verification"
              subtitle="Trust posture for inter-agency coordination"
              meta={
                <StatusPill
                  tone={organization?.isVerified ? "emerald" : "amber"}
                >
                  {organization?.isVerified ? "verified" : "pending"}
                </StatusPill>
              }
            />
            <ListItemCard
              title="Last handoff sync"
              subtitle="Most recent referral update in your workspace"
              meta={
                lastCoordinationSync
                  ? formatRelativeDateTime(lastCoordinationSync)
                  : "Awaiting first referral"
              }
            />
            <ListItemCard
              title="Subscription tier"
              subtitle="Active workspace level"
              meta={organization?.subscriptionLevel || "standard"}
            />
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Referral pipeline"
          description="Live outbound and inbound referral queue."
        >
          <div className="space-y-3">
            {organizationCoordination.length === 0 ? (
              <EmptyState
                title="No referral activity yet"
                description="Partner coordination events will appear here as soon as cases are routed to or from your organization."
                guidance={[
                  "This queue fills automatically when your team accepts, forwards, or closes a partner handoff.",
                  "If a referral was just created, allow the workspace sync to refresh before reviewing it here.",
                ]}
              />
            ) : (
              organizationCoordination
                .slice(0, 6)
                .map((entry) => (
                  <ListItemCard
                    key={entry.id}
                    title={`${entry.referralType} referral`}
                    subtitle={`Case ${entry.caseId.slice(0, 8)} · ${formatRelativeDateTime(entry.createdAt)}`}
                    meta={
                      <StatusPill
                        tone={
                          entry.status === "completed"
                            ? "emerald"
                            : entry.status === "pending"
                              ? "amber"
                              : "sky"
                        }
                      >
                        {entry.status}
                      </StatusPill>
                    }
                  />
                ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Realtime alerts"
          description="Live operational alerts from the shared response grid."
        >
          <div className="space-y-3">
            {alertHighlights.length === 0 ? (
              <EmptyState
                title="No active alerts"
                description="Operational alerts for your organization will surface here automatically."
                guidance={[
                  "Response notices, care escalations, and partner warnings will appear here when they require NGO action.",
                  "If another team has just updated a handoff, refresh once the live feed settles.",
                ]}
              />
            ) : (
              alertHighlights.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.message}
                  subtitle={`${entry.module || "operations"} · ${entry.time}`}
                  meta={
                    <StatusPill
                      tone={entry.type === "critical" ? "rose" : "amber"}
                    >
                      {entry.type || "notice"}
                    </StatusPill>
                  }
                />
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Referral flow trend"
          description="Weekly referral openings versus completed handoffs."
        >
          {coordinationTrend.some(
            (entry) => entry.opened > 0 || entry.resolved > 0,
          ) ? (
            <ChartFrame label="Referral flow trend">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coordinationTrend}>
                  <CartesianGrid
                    stroke="#1e293b"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                  />
                  <Tooltip />
                  <Bar dataKey="opened" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="resolved"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          ) : (
            <EmptyState
              title="No referral flow yet"
              description="This trend chart will render once partner handoffs start moving through the organization pipeline."
              guidance={[
                "New referrals and completions will appear here automatically when coordination records are created or updated.",
                "If your team just routed a case, wait for the next workspace refresh and check again.",
              ]}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Program & resource network"
          description="Live program registry and support-resource footprint."
        >
          <div className="space-y-3">
            <ListItemCard
              title="Active programs"
              subtitle="Programs registered for this NGO workspace"
              meta={
                <StatusPill tone="indigo">{activePrograms.length}</StatusPill>
              }
            />
            <ListItemCard
              title="Shelter resources"
              subtitle="Shelter nodes currently mapped in accessible resource data"
              meta={
                <StatusPill tone="emerald">
                  {shelterResources.length}
                </StatusPill>
              }
            />
            <ListItemCard
              title="24/7 support resources"
              subtitle="Always-on support channels and facilities"
              meta={
                <StatusPill tone="sky">{alwaysOnResources.length}</StatusPill>
              }
            />
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => setActiveModule("admin_console")}
                disabled={!permissions.canCreateUsers}
              >
                Manage partner workspace
              </Button>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Active programs"
          description="Registered NGO programs sourced directly from workspace data."
        >
          <div className="space-y-3">
            {activePrograms.length === 0 ? (
              <EmptyState
                title="No active programs configured"
                description="Program records will appear here after they are configured for this organization."
                guidance={[
                  "Add and activate service programs for this workspace to show live coverage and focus areas here.",
                  "Once a program is published, the dashboard refreshes automatically with the latest roster.",
                ]}
              />
            ) : (
              activePrograms.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.programName}
                  subtitle={`${entry.programType} · ${entry.focusAreas.join(", ") || "focus areas pending"}`}
                  meta={<StatusPill tone="indigo">active</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Urgent escalation watch"
          description="High-severity escalations visible to the NGO support queue."
        >
          <div className="space-y-3">
            {urgentEscalations.length === 0 ? (
              <EmptyState
                title="No urgent escalation items"
                description="High-severity escalation reviews will surface here when intervention is needed."
                guidance={[
                  "Urgent intervention requests appear here when linked survivor cases need immediate NGO response.",
                  "If a case was escalated moments ago, wait for the live queue to refresh before checking again.",
                ]}
              />
            ) : (
              urgentEscalations
                .slice(0, 5)
                .map((entry) => (
                  <ListItemCard
                    key={entry.id}
                    title={entry.emotionDetected || "Escalation review"}
                    subtitle={`${entry.status} · ${formatRelativeDateTime(entry.createdAt)}`}
                    meta={
                      <StatusPill
                        tone={entry.riskLevel === "critical" ? "rose" : "amber"}
                      >
                        {entry.riskLevel}
                      </StatusPill>
                    }
                  />
                ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="space-y-6">
        <VoiceNoteTranslator />
        <VoiceEvidenceArchive />
        <SharedEvidencePanel />
        <CommunityReportsPanel />
        <CoordinationBoard organizationId={effectiveOrganizationId} />
      </section>
    </DashboardPage>
  );
};

export default NgoDashboard;
