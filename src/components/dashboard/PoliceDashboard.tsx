import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAlertsFeed, useOrganizationCoordination, useUserProfile } from "@/data/aegisData";
import { useLiveJusticeCases, useLiveOrganization, useLivePoliceDepartments, useLiveUserProfiles } from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import { CaseStatusLookup } from "@/components/dashboard/CaseStatusLookup";
import { DashboardHero, DashboardPage, EmptyState, HeroBadge, ListItemCard, MetricCard, SectionCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import { dedupeBy, sortByPriorityAndRecency, formatRelativeDateTime, percent } from "@/lib/dashboardMetrics";
import { supabase } from "@/lib/supabase";
import CaseDispatchDialog from "@/components/justice/CaseDispatchDialog";
import FileIncidentDialog from "@/components/justice/FileIncidentDialog";

const PoliceDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const resolvedRole = (profile?.role ?? "police") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];

  const { data: organization } = useLiveOrganization(profile?.organizationId, { staleTime: 15000, refetchInterval: 30000 });
  const { data: departments = [], isLoading: departmentsLoading } = useLivePoliceDepartments({ organizationId: profile?.organizationId, staleTime: 15000, refetchInterval: 30000, limit: 10 });
  const activeDepartment = departments.find((entry) => entry.isActive) ?? departments[0] ?? null;

  const { data: officers = [], isLoading: officersLoading } = useLiveUserProfiles({ role: "police", organizationId: profile?.organizationId, staleTime: 15000, refetchInterval: 30000, limit: 120 });
  const { data: justiceCases = [], isLoading: casesLoading } = useLiveJusticeCases({ staleTime: 15000, refetchInterval: 30000, limit: 160, regionId: activeDepartment?.regionId ?? null });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 10000, refetchInterval: 15000, limit: 12 });
  const { data: referrals = [], isLoading: referralsLoading } = useOrganizationCoordination({ staleTime: 15000, refetchInterval: 30000, limit: 30 });

  const [dispatchCaseId, setDispatchCaseId] = useState<string | null>(null);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [isFileIncidentDialogOpen, setIsFileIncidentDialogOpen] = useState(false);

  const isLoadingData = departmentsLoading || officersLoading || casesLoading || alertsLoading || referralsLoading;

  const activeOfficers = useMemo(() => officers.filter((entry) => entry.isActive), [officers]);
  const jurisdictionCases = useMemo(() => {
    if (!activeDepartment) return justiceCases;
    return justiceCases.filter((entry) => {
      const matchesDepartment = Boolean(entry.assignedPoliceDepartmentId) && entry.assignedPoliceDepartmentId === activeDepartment.id;
      const matchesRegion = Boolean(entry.regionId) && entry.regionId === activeDepartment.regionId;
      return matchesDepartment || matchesRegion || (!entry.assignedPoliceDepartmentId && !entry.regionId);
    });
  }, [activeDepartment, justiceCases]);
  const liveQueue = useMemo(() => sortByPriorityAndRecency(jurisdictionCases).slice(0, 6), [jurisdictionCases]);
  const urgentCases = useMemo(() => jurisdictionCases.filter((entry) => entry.priority === "critical"), [jurisdictionCases]);
  const highPriorityCases = useMemo(() => jurisdictionCases.filter((entry) => entry.priority === "high"), [jurisdictionCases]);
  const openCases = useMemo(() => jurisdictionCases.filter((entry) => !["closed", "resolved"].includes(entry.status.toLowerCase())), [jurisdictionCases]);
  const pendingAlerts = useMemo(
    () => dedupeBy(alertsFeed.filter((entry) => entry.status !== "acknowledged"), (entry) => `${entry.module}|${entry.type}|${entry.message}`),
    [alertsFeed]
  );
  const pendingReferrals = useMemo(() => referrals.filter((entry) => entry.status === "pending"), [referrals]);
  const assignedCaseRatio = percent(openCases.filter((entry) => Boolean(entry.assignedTo)).length, Math.max(openCases.length, 1));
  const responseLoad = Math.min(100, Math.round(((urgentCases.length * 2 + highPriorityCases.length) / Math.max(activeOfficers.length, 1)) * 20));
  const sessionExpiry = session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : "Session inactive";
  const lastCaseUpdate = jurisdictionCases
    .map((entry) => entry.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const selectedDispatchCase = liveQueue.find((entry) => entry.id === dispatchCaseId) ?? null;

  const handleAcknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from("alerts_feed")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id,
      })
      .eq("id", alertId);

    if (!error) {
      await queryClient.invalidateQueries({ queryKey: ["aegis", "alertsFeed"] });
    }
  };


  return (
    <DashboardPage accent="rose">
      <DashboardHero
        eyebrow="Field operations"
        title="Police emergency response"
        description="Jurisdiction-scoped command view for dispatch, case load balancing, live alerts, and partner handoffs."
        badges={[
          <HeroBadge key="jurisdiction" className="border-sky-500/20 bg-sky-500/10 text-sky-200">{activeDepartment?.jurisdictionName ?? organization?.region ?? "Jurisdiction syncing"}</HeroBadge>,
          <HeroBadge key="officers" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{activeOfficers.length} active officers</HeroBadge>,
          <HeroBadge key="queue" className="border-rose-500/20 bg-rose-500/10 text-rose-200">{urgentCases.length} critical cases</HeroBadge>,
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => setIsFileIncidentDialogOpen(true)} disabled={!permissions.canViewOrgData}>File incident</Button>
            <Button onClick={() => setActiveModule("command_center")} disabled={!permissions.canViewOrgData}>Open dispatch</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Critical queue" value={urgentCases.length} helper="Immediate intervention required" accent="rose" loading={isLoadingData} />
        <MetricCard label="Open investigations" value={openCases.length} helper={`${highPriorityCases.length} high priority`} accent="amber" loading={isLoadingData} />
        <MetricCard label="Officer coverage" value={activeOfficers.length} helper={`${assignedCaseRatio}% of open cases assigned`} accent="emerald" loading={isLoadingData} />
        <MetricCard label="Partner handoffs" value={pendingReferrals.length} helper={`${pendingAlerts.length} live alerts awaiting acknowledgement`} accent="indigo" loading={isLoadingData} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Case status lookup" description="Verify live case state without switching out of dispatch mode.">
          <CaseStatusLookup description="Use a case reference to verify the live report state before dispatch or escalation." />
        </SectionCard>

        <SectionCard title="Operational posture" description="Live jurisdiction and workload summary.">
          <div className="grid gap-3 md:grid-cols-2">
            <ListItemCard title="Jurisdiction" subtitle={activeDepartment?.departmentName ?? organization?.name ?? "Regional response desk"} meta={<StatusPill tone="sky">{activeDepartment?.jurisdictionLevel ?? (organization?.region ? "regional" : "syncing")}</StatusPill>} />
            <ListItemCard title="Response load" subtitle="Priority pressure versus available officers" meta={<StatusPill tone={responseLoad > 70 ? "rose" : responseLoad > 40 ? "amber" : "emerald"}>{responseLoad}%</StatusPill>} />
            <ListItemCard title="Session expiry" subtitle="Current secure access window" meta={sessionExpiry} />
            <ListItemCard title="Last case sync" subtitle="Most recent jurisdiction case refresh" meta={lastCaseUpdate ? formatRelativeDateTime(lastCaseUpdate) : "Awaiting first update"} />
            <ListItemCard title="Coordination backlog" subtitle="Open inter-agency referrals" meta={pendingReferrals.length} />
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Priority dispatch queue" description="Ranked by severity and last update.">
          <div className="space-y-3">
            {liveQueue.length === 0 ? (
                <EmptyState
                  title="Queue is clear"
                  description="No active justice cases are currently available in your jurisdiction queue."
                  guidance={[
                    "New incidents appear here when they are routed into your response area and remain open for action.",
                    "If dispatch was updated recently, wait for the next live sync before retrying.",
                  ]}
                />
              ) : (
              liveQueue.map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={`Case ${entry.caseNumber}`}
                  subtitle={`${entry.stage || "intake"} · ${entry.region || "region pending"} · updated ${formatRelativeDateTime(entry.updatedAt)}`}
                  meta={<StatusPill tone={entry.priority === "critical" ? "rose" : entry.priority === "high" ? "amber" : "sky"}>{entry.priority}</StatusPill>}
                  action={<Button size="sm" variant="outline" onClick={() => { setDispatchCaseId(entry.id); setIsDispatchDialogOpen(true); }} disabled={!permissions.canViewOrgData}>Dispatch</Button>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Realtime alert queue" description="Alerts can be acknowledged directly from this board.">
          <div className="space-y-3">
            {pendingAlerts.length === 0 ? (
                <EmptyState
                  title="No unacknowledged alerts"
                  description="The live alert queue is currently clear for your team."
                  guidance={[
                    "Field alerts will appear here when dispatch, intake, or partner systems flag something for police response.",
                    "Acknowledged items drop out automatically after the live queue refreshes.",
                  ]}
                />
              ) : (
              pendingAlerts.slice(0, 5).map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.message}
                  subtitle={`${entry.module || "core"} · ${entry.time}`}
                  meta={<StatusPill tone={entry.type === "critical" ? "rose" : "amber"}>{entry.type || "notice"}</StatusPill>}
                  action={<Button size="sm" variant="outline" onClick={() => void handleAcknowledgeAlert(entry.id)}>Acknowledge</Button>}
                />
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Partner coordination" description="Live outbound and inbound handoffs with NGOs and care teams.">
          <div className="space-y-3">
            {referrals.length === 0 ? (
                <EmptyState
                  title="No coordination events"
                  description="Inter-agency referrals will appear here in real time as cases are routed."
                  guidance={[
                    "Transfers to care teams and NGO partners will surface here as soon as a handoff is recorded.",
                    "Use this section to confirm whether a case still needs partner follow-up.",
                  ]}
                />
              ) : (
              referrals.slice(0, 5).map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={`Referral ${entry.caseId.slice(0, 8)}`}
                  subtitle={`${entry.referralType} · ${formatRelativeDateTime(entry.createdAt)}`}
                  meta={<StatusPill tone={entry.status === "completed" ? "emerald" : entry.status === "pending" ? "amber" : "sky"}>{entry.status}</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Jurisdiction health" description="Stage distribution across accessible police cases.">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Filed" value={jurisdictionCases.length} accent="slate" loading={isLoadingData} />
            <MetricCard label="Investigation" value={jurisdictionCases.filter((entry) => entry.stage === "investigation").length} accent="sky" loading={isLoadingData} />
            <MetricCard label="Prosecution" value={jurisdictionCases.filter((entry) => entry.stage === "prosecution").length} accent="indigo" loading={isLoadingData} />
            <MetricCard label="Closed" value={jurisdictionCases.filter((entry) => ["closed", "resolved"].includes(entry.status.toLowerCase())).length} accent="emerald" loading={isLoadingData} />
          </div>
        </SectionCard>
      </section>

      <CaseDispatchDialog
        caseItem={selectedDispatchCase}
        isOpen={isDispatchDialogOpen}
        onClose={() => setIsDispatchDialogOpen(false)}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["live-dashboard", "justiceCases"] });
        }}
      />
      <FileIncidentDialog
        isOpen={isFileIncidentDialogOpen}
        onClose={() => setIsFileIncidentDialogOpen(false)}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["aegis", "alertsFeed"] });
          void queryClient.invalidateQueries({ queryKey: ["live-dashboard", "justiceCases"] });
        }}
      />
    </DashboardPage>
  );
};

export default PoliceDashboard;
