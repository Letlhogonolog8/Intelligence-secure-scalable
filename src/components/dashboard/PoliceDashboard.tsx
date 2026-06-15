import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import {
  acknowledgePoliceAlert,
  deleteAlert,
  deleteAllAlerts,
  useEscalationRealtime,
  useOrganizationCoordination,
  usePoliceAlertsFeed,
  useUserProfile,
} from "@/data/aegisData";
import { renderMessageWithLinks } from "@/components/dashboard/renderAlertLinks";
import VoiceNoteTranslator from "@/components/voice/VoiceNoteTranslator";
import VoiceEvidenceArchive from "@/components/voice/VoiceEvidenceArchive";
import SharedEvidencePanel from "@/components/evidence/SharedEvidencePanel";
import CommunityReportsPanel from "@/components/community/CommunityReportsPanel";
import AiCaseAssistantPanel from "@/components/police/AiCaseAssistantPanel";
import CoordinationBoard from "@/components/coordination/CoordinationBoard";
import {
  useLiveJusticeCases,
  useLiveOrganization,
  useLivePoliceDepartments,
  useLiveUserProfiles,
} from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import { CaseStatusLookup } from "@/components/dashboard/CaseStatusLookup";
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
  TabBar,
} from "@/components/dashboard/DashboardPrimitives";

const POLICE_TABS = [
  { id: "response", label: "Cases & response" },
  { id: "tools", label: "Evidence & tools" },
  { id: "intel", label: "Intelligence" },
] as const;
type PoliceTab = (typeof POLICE_TABS)[number]["id"];
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSIONS, UserRole } from "@/lib/roleConfig";
import {
  dedupeBy,
  formatRelativeDateTime,
  percent,
  sortByPriorityAndRecency,
} from "@/lib/dashboardMetrics";
import CaseDispatchDialog from "@/components/justice/CaseDispatchDialog";
import FileIncidentDialog from "@/components/justice/FileIncidentDialog";
import {
  buildPoliceAvailabilitySummary,
  buildPoliceRecommendedActions,
  buildPoliceStageAging,
  normalizePoliceAlerts,
  normalizePoliceReferrals,
} from "@/lib/policeDashboard";
import { buildWeeklyLifecycle } from "@/lib/dashboardMetrics";
import {
  PoliceAvailabilityGrid,
  PoliceRecommendedActionsList,
  PoliceStageAgingList,
} from "@/components/dashboard/PoliceOperationalWidgets";
import {
  policeMonitor,
  normalizePoliceCasesEnhanced,
  prioritizeAlerts,
  downloadQueueReport,
} from "@/lib/policeDashboardEnhanced";
import { QueueMetricsDashboard } from "@/components/police/QueueMetricsDashboard";
import { CasePredictions } from "@/components/police/CasePredictions";
import { OfficerWorkloadGrid } from "@/components/police/OfficerWorkloadGrid";
import { CoordinationInsights } from "@/components/police/CoordinationInsights";
import { ConnectionStatus } from "@/components/police/ConnectionStatus";
import { usePoliceKeyboardShortcuts } from "@/hooks/usePoliceKeyboardShortcuts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PoliceDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const isPolice = profile?.role === "police";
  const resolvedRole = (profile?.role ?? "police") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];
  const organizationId = profile?.organizationId ?? null;

  const [dispatchCaseId, setDispatchCaseId] = useState<string | null>(null);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [isFileIncidentDialogOpen, setIsFileIncidentDialogOpen] =
    useState(false);
  const [activeTab, setActiveTab] = useState<PoliceTab>("response");
  const [queueSearch, setQueueSearch] = useState("");
  const [queuePriorityFilter, setQueuePriorityFilter] = useState("all");
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);
  const [clearingAlerts, setClearingAlerts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deferredQueueSearch = useDeferredValue(queueSearch);

  const { data: organization } = useLiveOrganization(organizationId, {
    enabled: isPolice && Boolean(organizationId),
    staleTime: 15000,
    refetchInterval: 30000,
  });
  const { data: departments = [], isLoading: departmentsLoading } =
    useLivePoliceDepartments({
      enabled: isPolice && Boolean(organizationId),
      organizationId,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 10,
    });
  const activeDepartment =
    departments.find((entry) => entry.isActive) ?? departments[0] ?? null;

  const { data: officers = [], isLoading: officersLoading } =
    useLiveUserProfiles({
      enabled: isPolice && Boolean(organizationId),
      role: "police",
      organizationId,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 120,
    });
  const { data: justiceCases = [], isLoading: casesLoading } =
    useLiveJusticeCases({
      enabled: isPolice && Boolean(activeDepartment?.regionId),
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 160,
      regionId: activeDepartment?.regionId ?? null,
    });
  const {
    data: alertsFeed = [],
    isLoading: alertsLoading,
    isFetching: alertsFetching,
    refetch: refetchAlerts,
  } = usePoliceAlertsFeed({
    enabled: isPolice,
    staleTime: 10000,
    refetchInterval: 15000,
    limit: 12,
  });
  // Live-refresh the alert feed the moment an SOS lands, instead of waiting for
  // the 15s poll. Polling above stays as the resilient fallback.
  useEscalationRealtime({ enabled: isPolice });
  const { data: referrals = [], isLoading: referralsLoading } =
    useOrganizationCoordination({
      enabled: isPolice,
      staleTime: 15000,
      refetchInterval: 30000,
      limit: 30,
    });

  // Track real load time: from mount until live data first finishes loading
  // (not until unmount — that previously logged session duration, not load).
  const loadTrackedRef = useRef(false);
  useEffect(() => {
    policeMonitor.startTracking("dashboard-load");
  }, []);

  const isLoadingData =
    departmentsLoading ||
    officersLoading ||
    casesLoading ||
    alertsLoading ||
    referralsLoading;

  useEffect(() => {
    if (!isLoadingData && !loadTrackedRef.current) {
      loadTrackedRef.current = true;
      policeMonitor.endTracking("dashboard-load");
      if (import.meta.env.DEV) {
        policeMonitor.logReport();
      }
    }
  }, [isLoadingData]);

  const sanitizedCases = useMemo(
    () => normalizePoliceCasesEnhanced(justiceCases),
    [justiceCases],
  );
  const sanitizedAlerts = useMemo(
    () => normalizePoliceAlerts(alertsFeed),
    [alertsFeed],
  );
  const sanitizedReferrals = useMemo(
    () => normalizePoliceReferrals(referrals),
    [referrals],
  );

  const activeOfficers = useMemo(
    () => officers.filter((entry) => entry.isActive),
    [officers],
  );
  const jurisdictionCases = useMemo(() => {
    if (!activeDepartment) return sanitizedCases;

    return sanitizedCases.filter((entry) => {
      const matchesDepartment =
        Boolean(entry.assignedPoliceDepartmentId) &&
        entry.assignedPoliceDepartmentId === activeDepartment.id;
      const matchesRegion =
        Boolean(entry.regionId) && entry.regionId === activeDepartment.regionId;
      return matchesDepartment || matchesRegion;
    });
  }, [activeDepartment, sanitizedCases]);
  const filteredQueue = useMemo(() => {
    const term = deferredQueueSearch.trim().toLowerCase();
    return jurisdictionCases.filter((entry) => {
      const matchesPriority =
        queuePriorityFilter === "all" || entry.priority === queuePriorityFilter;
      const matchesSearch =
        !term ||
        [entry.caseNumber, entry.region, entry.stage, entry.assignedTo]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesPriority && matchesSearch;
    });
  }, [deferredQueueSearch, jurisdictionCases, queuePriorityFilter]);
  const liveQueue = useMemo(
    () => sortByPriorityAndRecency(filteredQueue).slice(0, 6),
    [filteredQueue],
  );
  const urgentCases = useMemo(
    () => jurisdictionCases.filter((entry) => entry.priority === "critical"),
    [jurisdictionCases],
  );
  const highPriorityCases = useMemo(
    () => jurisdictionCases.filter((entry) => entry.priority === "high"),
    [jurisdictionCases],
  );
  const openCases = useMemo(
    () =>
      jurisdictionCases.filter(
        (entry) => !["closed", "resolved"].includes(entry.status),
      ),
    [jurisdictionCases],
  );
  const unassignedOpenCases = useMemo(
    () => openCases.filter((entry) => !entry.assignedTo),
    [openCases],
  );
  const pendingAlerts = useMemo(
    () =>
      dedupeBy(
        sanitizedAlerts.filter((entry) => entry.status !== "acknowledged"),
        (entry) => `${entry.module}|${entry.type}|${entry.message}`,
      ),
    [sanitizedAlerts],
  );
  const prioritizedAlerts = useMemo(
    () => prioritizeAlerts(pendingAlerts),
    [pendingAlerts],
  );
  const pendingReferrals = useMemo(
    () => sanitizedReferrals.filter((entry) => entry.status === "pending"),
    [sanitizedReferrals],
  );
  const completedCases = useMemo(
    () =>
      jurisdictionCases.filter((entry) =>
        ["closed", "resolved"].includes(entry.status),
      ),
    [jurisdictionCases],
  );
  const assignedCaseRatio = percent(
    openCases.length - unassignedOpenCases.length,
    Math.max(openCases.length, 1),
  );
  const responseLoad = Math.min(
    100,
    Math.round(
      ((urgentCases.length * 2 + highPriorityCases.length) /
        Math.max(activeOfficers.length, 1)) *
        20,
    ),
  );
  const coordinationPressure = Math.min(
    100,
    Math.round(
      ((pendingReferrals.length + pendingAlerts.length) /
        Math.max(activeOfficers.length, 1)) *
        25,
    ),
  );
  const officerAvailability = useMemo(
    () =>
      buildPoliceAvailabilitySummary({
        activeOfficerIds: activeOfficers.map((entry) => entry.id),
        assignedOfficerIds: openCases
          .map((entry) => entry.assignedTo)
          .filter(Boolean),
      }),
    [activeOfficers, openCases],
  );
  const responseTrend = useMemo(
    () =>
      buildWeeklyLifecycle(
        jurisdictionCases,
        (entry) => entry.createdAt,
        (entry) =>
          ["closed", "resolved"].includes(entry.status)
            ? entry.updatedAt
            : null,
        4,
      ).map((bucket) => ({
        label: bucket.label,
        opened: bucket.opened,
        active: bucket.active,
      })),
    [jurisdictionCases],
  );
  const stageAging = useMemo(
    () => buildPoliceStageAging(jurisdictionCases),
    [jurisdictionCases],
  );
  const medianDaysOpen = useMemo(() => {
    if (openCases.length === 0) return null;
    const sortedDays = openCases
      .map((entry) => entry.daysOpen ?? 0)
      .sort((left, right) => left - right);
    const middle = Math.floor(sortedDays.length / 2);
    return sortedDays.length % 2 === 0
      ? Math.round((sortedDays[middle - 1] + sortedDays[middle]) / 2)
      : sortedDays[middle];
  }, [openCases]);
  const sessionExpiry = session?.expires_at
    ? new Date(session.expires_at * 1000).toLocaleTimeString()
    : "Session inactive";
  const lastCaseUpdate =
    jurisdictionCases
      .map((entry) => entry.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) => new Date(right).getTime() - new Date(left).getTime(),
      )[0] ?? null;
  const selectedDispatchCase =
    liveQueue.find((entry) => entry.id === dispatchCaseId) ?? null;
  const topPredictedCase = liveQueue[0] ?? null;
  const recommendedActions = useMemo(
    () =>
      buildPoliceRecommendedActions({
        urgentCases: urgentCases.length,
        unassignedOpenCases: unassignedOpenCases.length,
        pendingAlerts: pendingAlerts.length,
        pendingReferrals: pendingReferrals.length,
        responseLoad,
      }),
    [
      pendingAlerts.length,
      pendingReferrals.length,
      responseLoad,
      unassignedOpenCases.length,
      urgentCases.length,
    ],
  );

  const handleExportQueue = () => {
    downloadQueueReport(
      filteredQueue,
      `police-queue-${new Date().toISOString().split("T")[0]}.csv`,
    );
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgePoliceAlert(alertId);
      await queryClient.invalidateQueries({
        queryKey: ["aegis", "alertsFeed"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["aegis", "policeAlertsFeed"],
      });
    } catch {
      // Keep failure silent in the dashboard shell; the queue will retry on refresh.
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    setDeletingAlertId(alertId);
    try {
      await deleteAlert(alertId);
      await refetchAlerts();
    } catch (error) {
      console.error("Failed to delete alert", error);
    } finally {
      setDeletingAlertId(null);
    }
  };

  const handleDeleteAllAlerts = async () => {
    if (pendingAlerts.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete all ${pendingAlerts.length} alerts? This cannot be undone.`,
      )
    )
      return;
    setClearingAlerts(true);
    try {
      await deleteAllAlerts();
      await refetchAlerts();
    } catch (error) {
      console.error("Failed to clear alerts", error);
    } finally {
      setClearingAlerts(false);
    }
  };

  usePoliceKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onRefresh: () =>
      void queryClient.invalidateQueries({ queryKey: ["live-dashboard"] }),
    onDispatch: () => {
      if (!liveQueue[0] || !permissions.canViewOrgData) return;
      setDispatchCaseId(liveQueue[0].id);
      setIsDispatchDialogOpen(true);
    },
    onAcknowledge: () => {
      if (!prioritizedAlerts[0]) return;
      void handleAcknowledgeAlert(prioritizedAlerts[0].id);
    },
  });

  if (!isPolice) {
    return (
      <DashboardPage accent="rose">
        <EmptyState
          title="Police access required"
          description="Your account does not have the required privileges to view the police operations dashboard."
          actionLabel="Open command center"
          onAction={() => setActiveModule("command_center")}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage accent="rose">
      <ConnectionStatus />
      <DashboardHero
        eyebrow="Field operations"
        title="Police emergency response"
        description="Jurisdiction-scoped command view for dispatch, case load balancing, live alerts, and partner handoffs."
        badges={[
          <HeroBadge
            key="jurisdiction"
            className="border-sky-500/20 bg-sky-500/10 text-sky-200"
          >
            {activeDepartment?.jurisdictionName ??
              organization?.region ??
              "Jurisdiction syncing"}
          </HeroBadge>,
          <HeroBadge
            key="officers"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          >
            {activeOfficers.length} active officers
          </HeroBadge>,
          <HeroBadge
            key="queue"
            className="border-rose-500/20 bg-rose-500/10 text-rose-200"
          >
            {urgentCases.length} critical cases
          </HeroBadge>,
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIsFileIncidentDialogOpen(true)}
              disabled={!permissions.canViewOrgData}
            >
              File incident
            </Button>
            <Button
              onClick={() => setActiveModule("command_center")}
              disabled={!permissions.canViewOrgData}
            >
              Open dispatch
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Critical queue"
          value={urgentCases.length}
          helper="Immediate intervention required"
          accent="rose"
          loading={isLoadingData}
        />
        <MetricCard
          label="Open investigations"
          value={openCases.length}
          helper={`${highPriorityCases.length} high priority`}
          accent="amber"
          loading={isLoadingData}
        />
        <MetricCard
          label="Officer coverage"
          value={activeOfficers.length}
          helper={`${assignedCaseRatio}% of open cases assigned`}
          accent="emerald"
          loading={isLoadingData}
        />
        <MetricCard
          label="Partner handoffs"
          value={pendingReferrals.length}
          helper={`${pendingAlerts.length} live alerts awaiting acknowledgement`}
          accent="indigo"
          loading={isLoadingData}
        />
      </section>

      <section>
        <QueueMetricsDashboard cases={jurisdictionCases} />
      </section>

      <TabBar
        accent="rose"
        active={activeTab}
        onChange={setActiveTab}
        tabs={POLICE_TABS.map((t) => ({ id: t.id, label: t.label }))}
      />

      {activeTab === "response" && (
        <>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              title="Case status lookup"
              description="Verify live case state without switching out of dispatch mode."
            >
              <CaseStatusLookup description="Use a case reference to verify the live report state before dispatch or escalation." />
            </SectionCard>

            <SectionCard
              title="Operational posture"
              description="Live jurisdiction, workload, and sync summary."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <ListItemCard
                  title="Jurisdiction"
                  subtitle={
                    activeDepartment?.departmentName ??
                    organization?.name ??
                    "Regional response desk"
                  }
                  meta={
                    <StatusPill tone="sky">
                      {activeDepartment?.jurisdictionLevel ??
                        (organization?.region ? "regional" : "syncing")}
                    </StatusPill>
                  }
                />
                <ListItemCard
                  title="Response load"
                  subtitle="Priority pressure versus available officers"
                  meta={
                    <StatusPill
                      tone={
                        responseLoad > 70
                          ? "rose"
                          : responseLoad > 40
                            ? "amber"
                            : "emerald"
                      }
                    >
                      {responseLoad}%
                    </StatusPill>
                  }
                />
                <ListItemCard
                  title="Coordination pressure"
                  subtitle="Combined referral and alert backlog"
                  meta={
                    <StatusPill
                      tone={
                        coordinationPressure > 65
                          ? "rose"
                          : coordinationPressure > 35
                            ? "amber"
                            : "sky"
                      }
                    >
                      {coordinationPressure}%
                    </StatusPill>
                  }
                />
                <ListItemCard
                  title="Median case age"
                  subtitle="Typical age of active police work in the queue"
                  meta={medianDaysOpen === null ? "--" : `${medianDaysOpen}d`}
                />
                <ListItemCard
                  title="Session expiry"
                  subtitle="Current secure access window"
                  meta={sessionExpiry}
                />
                <ListItemCard
                  title="Last case sync"
                  subtitle="Most recent jurisdiction case refresh"
                  meta={
                    lastCaseUpdate
                      ? formatRelativeDateTime(lastCaseUpdate)
                      : "Awaiting first update"
                  }
                />
                <ListItemCard
                  title="Unassigned cases"
                  subtitle="Open work still waiting for an officer"
                  meta={
                    <StatusPill
                      tone={
                        unassignedOpenCases.length > 0 ? "amber" : "emerald"
                      }
                    >
                      {unassignedOpenCases.length}
                    </StatusPill>
                  }
                />
              </div>
            </SectionCard>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard
              title="Priority dispatch queue"
              description="Ranked by severity and last update."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportQueue}
                  disabled={filteredQueue.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Queue
                </Button>
              }
            >
              <div className="mb-4 flex flex-col gap-3 md:flex-row">
                <label className="flex-1">
                  <span className="sr-only">Search dispatch queue</span>
                  <input
                    ref={searchInputRef}
                    aria-label="Search dispatch queue"
                    value={queueSearch}
                    onChange={(event) => setQueueSearch(event.target.value)}
                    placeholder="Search case, region, stage, or assignee"
                    className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none"
                  />
                </label>
                <label>
                  <span className="sr-only">
                    Filter dispatch queue by priority
                  </span>
                  <select
                    aria-label="Filter dispatch queue by priority"
                    value={queuePriorityFilter}
                    onChange={(event) =>
                      setQueuePriorityFilter(event.target.value)
                    }
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none"
                  >
                    <option value="all">All priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
              <div className="space-y-3">
                {liveQueue.length === 0 ? (
                  <EmptyState
                    title="Queue is clear"
                    description={
                      filteredQueue.length === 0 &&
                      (queueSearch || queuePriorityFilter !== "all")
                        ? "No queue items match the current search or priority filters."
                        : "No active justice cases are currently available in your jurisdiction queue."
                    }
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
                      meta={
                        <StatusPill
                          tone={
                            entry.priority === "critical"
                              ? "rose"
                              : entry.priority === "high"
                                ? "amber"
                                : "sky"
                          }
                        >
                          {entry.priority}
                        </StatusPill>
                      }
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDispatchCaseId(entry.id);
                            setIsDispatchDialogOpen(true);
                          }}
                          disabled={!permissions.canViewOrgData}
                        >
                          Dispatch
                        </Button>
                      }
                    />
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Realtime alert queue"
              description="Alerts can be acknowledged directly from this board."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refetchAlerts()}
                    disabled={alertsFetching}
                    aria-label="Refresh alerts"
                  >
                    <RefreshCw
                      className={`mr-1.5 h-3.5 w-3.5 ${alertsFetching ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDeleteAllAlerts()}
                    disabled={clearingAlerts || pendingAlerts.length === 0}
                    aria-label="Delete all alerts"
                    className="border-red-500/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear all
                  </Button>
                </div>
              }
            >
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
                  prioritizedAlerts.slice(0, 5).map((entry) => (
                    <ListItemCard
                      key={entry.id}
                      title={renderMessageWithLinks(entry.message)}
                      subtitle={`${entry.module || "core"} · ${entry.time} · Response: ${entry.estimatedResponseTime}min`}
                      meta={
                        <div className="flex items-center gap-2">
                          <StatusPill
                            tone={
                              entry.urgencyLevel === "immediate"
                                ? "rose"
                                : entry.urgencyLevel === "high"
                                  ? "amber"
                                  : "sky"
                            }
                          >
                            {entry.urgencyLevel}
                          </StatusPill>
                          <span className="text-xs text-slate-400">
                            Score: {entry.priorityScore}
                          </span>
                        </div>
                      }
                      action={
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleAcknowledgeAlert(entry.id)
                            }
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDeleteAlert(entry.id)}
                            disabled={deletingAlertId === entry.id}
                            aria-label="Delete alert"
                            className="border-red-500/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </SectionCard>
          </section>
        </>
      )}

      {activeTab === "tools" && (
        <>
          <section className="space-y-6">
            <AiCaseAssistantPanel />
            <VoiceNoteTranslator />
            <VoiceEvidenceArchive />
            <SharedEvidencePanel />
            <CommunityReportsPanel />
            <CoordinationBoard organizationId={organizationId} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard
              title="Partner coordination"
              description="Live outbound and inbound handoffs with NGOs and care teams."
            >
              <div className="space-y-3">
                {sanitizedReferrals.length === 0 ? (
                  <EmptyState
                    title="No coordination events"
                    description="Inter-agency referrals will appear here in real time as cases are routed."
                    guidance={[
                      "Transfers to care teams and NGO partners will surface here as soon as a handoff is recorded.",
                      "Use this section to confirm whether a case still needs partner follow-up.",
                    ]}
                  />
                ) : (
                  sanitizedReferrals
                    .slice(0, 5)
                    .map((entry) => (
                      <ListItemCard
                        key={entry.id}
                        title={`Referral ${entry.caseId.slice(0, 8)}`}
                        subtitle={`${entry.referralType} · ${formatRelativeDateTime(entry.createdAt)}`}
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
              title="Response trend"
              description="Recent queue movement across the jurisdiction."
            >
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <ChartFrame label="Police response trend" height={220}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={responseTrend}>
                      <defs>
                        <linearGradient
                          id="police-opened"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f43f5e"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f43f5e"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
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
                      <Area
                        type="monotone"
                        dataKey="opened"
                        stroke="#f43f5e"
                        fill="url(#police-opened)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="active"
                        stroke="#38bdf8"
                        fillOpacity={0}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartFrame>
                <div className="grid gap-3">
                  <ListItemCard
                    title="Current queue"
                    subtitle="Total jurisdiction cases in view"
                    meta={jurisdictionCases.length}
                  />
                  <ListItemCard
                    title="Completed cases"
                    subtitle="Cases closed or resolved"
                    meta={
                      <StatusPill tone="emerald">
                        {completedCases.length}
                      </StatusPill>
                    }
                  />
                  <ListItemCard
                    title="Unassigned work"
                    subtitle="Open cases without an officer"
                    meta={
                      <StatusPill
                        tone={
                          unassignedOpenCases.length > 0 ? "amber" : "emerald"
                        }
                      >
                        {unassignedOpenCases.length}
                      </StatusPill>
                    }
                  />
                  <ListItemCard
                    title="Alert backlog"
                    subtitle="Active police-facing alerts"
                    meta={
                      <StatusPill
                        tone={pendingAlerts.length > 0 ? "rose" : "emerald"}
                      >
                        {pendingAlerts.length}
                      </StatusPill>
                    }
                  />
                </div>
              </div>
            </SectionCard>
          </section>
        </>
      )}

      {activeTab === "intel" && (
        <>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              title="Predictive triage"
              description="Heuristic guidance for the next queue item most likely to need intervention."
            >
              {topPredictedCase ? (
                <div className="space-y-4">
                  <ListItemCard
                    title={`Forecast ${topPredictedCase.caseNumber}`}
                    subtitle={`${topPredictedCase.stage || "intake"} · ${topPredictedCase.region || "region pending"}`}
                    meta={
                      <StatusPill
                        tone={
                          topPredictedCase.priority === "critical"
                            ? "rose"
                            : topPredictedCase.priority === "high"
                              ? "amber"
                              : "sky"
                        }
                      >
                        {topPredictedCase.priority}
                      </StatusPill>
                    }
                  />
                  <CasePredictions caseItem={topPredictedCase} />
                </div>
              ) : (
                <EmptyState
                  title="No case predictions"
                  description="Predictions will appear once an active queue item is available for triage."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Officer workload balancing"
              description="Assignment pressure by active officer to support fair dispatching."
            >
              <OfficerWorkloadGrid
                officers={activeOfficers}
                cases={jurisdictionCases}
              />
            </SectionCard>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              title="Coordination insights"
              description="Referral throughput, partner hotspots, and handoff bottlenecks."
            >
              <CoordinationInsights referrals={sanitizedReferrals} />
            </SectionCard>

            <SectionCard
              title="Keyboard shortcuts"
              description="Power-user actions for faster police operations workflows."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ListItemCard
                  title="Focus search"
                  subtitle="Jump to the dispatch queue search field"
                  meta={<StatusPill tone="sky">Ctrl/Cmd + K</StatusPill>}
                />
                <ListItemCard
                  title="Refresh live data"
                  subtitle="Invalidate live dashboard queries"
                  meta={<StatusPill tone="emerald">Ctrl/Cmd + R</StatusPill>}
                />
                <ListItemCard
                  title="Dispatch top case"
                  subtitle="Open the first item in the priority queue"
                  meta={<StatusPill tone="amber">Ctrl/Cmd + D</StatusPill>}
                />
                <ListItemCard
                  title="Acknowledge top alert"
                  subtitle="Resolve the highest-priority pending alert"
                  meta={<StatusPill tone="rose">Ctrl/Cmd + A</StatusPill>}
                />
              </div>
            </SectionCard>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              title="Recommended actions"
              description="System-generated priorities for the current jurisdiction state."
            >
              {recommendedActions.length === 0 ? (
                <EmptyState
                  title="No urgent follow-up"
                  description="Critical queues are stable. Use this window to close residual admin work and verify recent incident updates."
                />
              ) : (
                <PoliceRecommendedActionsList
                  items={recommendedActions}
                  onAction={setActiveModule}
                />
              )}
            </SectionCard>

            <SectionCard
              title="Officer availability"
              description="Estimated dispatch capacity based on active officers with current case assignments."
            >
              <PoliceAvailabilityGrid items={officerAvailability} />
            </SectionCard>
          </section>

          <section className="grid grid-cols-1 gap-6">
            <SectionCard
              title="Stage aging"
              description="Spot stalled case stages before they become operational drag."
            >
              {stageAging.length === 0 ? (
                <EmptyState
                  title="No active stage aging"
                  description="Stage aging will appear here once jurisdiction cases remain open long enough to compare."
                />
              ) : (
                <PoliceStageAgingList items={stageAging} />
              )}
            </SectionCard>
          </section>
        </>
      )}

      <CaseDispatchDialog
        caseItem={selectedDispatchCase}
        isOpen={isDispatchDialogOpen}
        onClose={() => setIsDispatchDialogOpen(false)}
        onSuccess={() => {
          void queryClient.invalidateQueries({
            queryKey: ["live-dashboard", "justiceCases"],
          });
        }}
      />
      <FileIncidentDialog
        isOpen={isFileIncidentDialogOpen}
        onClose={() => setIsFileIncidentDialogOpen(false)}
        onSuccess={() => {
          void queryClient.invalidateQueries({
            queryKey: ["aegis", "alertsFeed"],
          });
          void queryClient.invalidateQueries({
            queryKey: ["live-dashboard", "justiceCases"],
          });
        }}
      />
    </DashboardPage>
  );
};

export default PoliceDashboard;
