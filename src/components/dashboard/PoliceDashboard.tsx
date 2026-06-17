import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  LiveIncidentMap,
  type MapPoint,
} from "@/components/police/LiveIncidentMap";
import {
  acknowledgePoliceAlert,
  deleteAlert,
  deleteAllAlerts,
  useEscalationRealtime,
  useOrganizationCoordination,
  usePoliceAlertsFeed,
  useUserProfile,
  type ModuleType,
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

type PoliceTab =
  | "response"
  | "queue"
  | "incidents"
  | "tools"
  | "intel"
  | "directory";

// The police role uses the global left-nav shell: each sidebar module maps to a
// command-center section. The dashboard renders the section for the active
// module (the Overview command center is the default "dashboard" module).
const MODULE_SECTION: Partial<Record<ModuleType, PoliceTab>> = {
  dashboard: "response",
  police_queue: "queue",
  police_incidents: "incidents",
  police_evidence: "tools",
  police_analytics: "intel",
  police_officers: "directory",
};

interface IncidentRow {
  id: string;
  category: string | null;
  status: string | null;
  risk_level: string | null;
  priority: string | null;
  description: string | null;
  report_method: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
}

const INCIDENT_FILTERS: {
  key: string;
  label: string;
  match: (r: IncidentRow) => boolean;
}[] = [
  { key: "all", label: "All", match: () => true },
  {
    key: "sos",
    label: "SOS",
    match: (r) => /sos|panic|escal/i.test(`${r.report_method} ${r.category}`),
  },
  {
    key: "dv",
    label: "Domestic",
    match: (r) => /domestic|partner|family/i.test(`${r.category}`),
  },
  {
    key: "sexual",
    label: "Sexual",
    match: (r) => /sexual|rape|assault/i.test(`${r.category}`),
  },
  {
    key: "child",
    label: "Child",
    match: (r) => /child|minor/i.test(`${r.category}`),
  },
  {
    key: "trafficking",
    label: "Trafficking",
    match: (r) => /traffick/i.test(`${r.category}`),
  },
  {
    key: "community",
    label: "Community",
    match: (r) => /community/i.test(`${r.report_method}`),
  },
  {
    key: "anonymous",
    label: "Anonymous",
    match: (r) => Boolean(r.is_anonymous),
  },
];

/** Heuristic triage score (0–99) for the emergency queue: priority drives the
 * band, with bumps for unassigned/stale work. Deterministic, not a stored AI
 * score — labelled "risk" for fast visual triage. */
function caseRiskScore(c: {
  priority: string;
  assignedTo?: string | null;
  daysOpen?: number | null;
}): number {
  const base =
    c.priority === "critical"
      ? 90
      : c.priority === "high"
        ? 76
        : c.priority === "medium"
          ? 55
          : 30;
  let score = base;
  if (!c.assignedTo) score += 5;
  if (c.daysOpen && c.daysOpen > 14) score += 4;
  else if (c.daysOpen && c.daysOpen > 7) score += 2;
  return Math.min(99, score);
}

const PRIORITY_TONE: Record<string, "rose" | "amber" | "sky" | "emerald"> = {
  critical: "rose",
  high: "amber",
  medium: "sky",
  low: "emerald",
};

/** Heuristic 0–99 risk for an incoming incident report, banded from its stored
 * risk level / priority (deterministic, for fast visual triage). */
function incidentRisk(r: IncidentRow): number {
  const lvl = `${r.risk_level ?? ""} ${r.priority ?? ""}`.toLowerCase();
  if (/crit/.test(lvl)) return 95;
  if (/high/.test(lvl)) return 82;
  if (/med/.test(lvl)) return 58;
  if (/low/.test(lvl)) return 32;
  return 50;
}
function incidentTone(r: IncidentRow): "rose" | "amber" | "sky" {
  const risk = incidentRisk(r);
  return risk >= 90 ? "rose" : risk >= 70 ? "amber" : "sky";
}
function incidentLabel(r: IncidentRow): string {
  const cat = (r.category ?? "").trim();
  return cat ? cat.replace(/_/g, " ") : "Incident report";
}
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveModule, activeModule } = useAppStore();
  const { data: profile } = useUserProfile(user?.id);
  const isPolice = profile?.role === "police";
  const resolvedRole = (profile?.role ?? "police") as UserRole;
  const permissions = PERMISSIONS[resolvedRole];
  const organizationId = profile?.organizationId ?? null;

  const [dispatchCaseId, setDispatchCaseId] = useState<string | null>(null);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [isFileIncidentDialogOpen, setIsFileIncidentDialogOpen] =
    useState(false);
  const activeTab: PoliceTab = MODULE_SECTION[activeModule] ?? "response";
  const [queueSearch, setQueueSearch] = useState("");
  const [queuePriorityFilter, setQueuePriorityFilter] = useState("all");
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);
  const [clearingAlerts, setClearingAlerts] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState("all");
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

  // Live operational map points: SOS/incidents that carry GPS, plus located
  // facilities (resources). Rows without coordinates are simply skipped.
  const { data: mapPoints = [] } = useQuery({
    queryKey: ["police-map-points", isPolice],
    enabled: isPolice,
    staleTime: 15000,
    refetchInterval: 30000,
    queryFn: async (): Promise<MapPoint[]> => {
      const [esc, res] = await Promise.all([
        supabase
          .from("escalation_events")
          .select("id,severity,status,location,triggered_at")
          .order("triggered_at", { ascending: false })
          .limit(40),
        supabase
          .from("resources")
          .select("id,resource_type,name,latitude,longitude")
          .limit(60),
      ]);
      const points: MapPoint[] = [];
      for (const row of (esc.data ?? []) as Record<string, unknown>[]) {
        const loc = row.location as { lat?: unknown; lng?: unknown } | null;
        const lat = Number(loc?.lat);
        const lng = Number(loc?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const sev = String(row.severity ?? "").toLowerCase();
        const kind =
          sev === "critical"
            ? "sos"
            : sev === "high"
              ? "high"
              : sev === "low"
                ? "low"
                : "medium";
        points.push({
          id: `e-${String(row.id)}`,
          lat,
          lng,
          kind,
          label: `SOS · ${String(row.status ?? "active")}`,
        });
      }
      for (const row of (res.data ?? []) as Record<string, unknown>[]) {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const ty = String(row.resource_type ?? "").toLowerCase();
        points.push({
          id: `r-${String(row.id)}`,
          lat,
          lng,
          kind: /hospital|medic|health|clinic/.test(ty)
            ? "hospital"
            : "shelter",
          label: String(row.name ?? "Facility"),
        });
      }
      return points;
    },
  });

  // Incoming incident reports (case_reports) for the Incidents section.
  const { data: incidentsFeed = [] } = useQuery({
    queryKey: ["police-incidents", isPolice],
    enabled: isPolice,
    staleTime: 15000,
    refetchInterval: 30000,
    queryFn: async (): Promise<IncidentRow[]> => {
      const { data } = await supabase
        .from("case_reports")
        .select(
          "id,category,status,risk_level,priority,description,report_method,is_anonymous,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(40);
      return (data as IncidentRow[] | null) ?? [];
    },
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
  const officerNameById = useMemo(
    () => new Map(officers.map((o) => [o.id, o.fullName || o.id])),
    [officers],
  );
  // Emergency triage queue: open cases ranked by heuristic risk (AI-style sort).
  const emergencyQueue = useMemo(
    () =>
      openCases
        .map((c) => ({ ...c, risk: caseRiskScore(c) }))
        .sort((a, b) => b.risk - a.risk),
    [openCases],
  );
  // Average response time (minutes) across active alerts — the live estimate
  // carried on each prioritised alert; null when the alert queue is clear.
  const avgResponseTime = useMemo(() => {
    const vals = prioritizedAlerts
      .map((a) => Number(a.estimatedResponseTime))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((sum, n) => sum + n, 0) / vals.length);
  }, [prioritizedAlerts]);
  // Recent activity — merged from real signals (officer assignments, partner
  // referrals, escalated alerts), newest first. No synthetic events.
  const recentActivity = useMemo(() => {
    type Activity = {
      id: string;
      title: string;
      subtitle: string;
      tone: "sky" | "emerald" | "rose";
      ts: number;
    };
    const items: Activity[] = [];
    openCases.forEach((c) => {
      if (!c.assignedTo) return;
      items.push({
        id: `asg-${c.id}`,
        title: `Officer assigned · Case ${c.caseNumber}`,
        subtitle: `${officerNameById.get(c.assignedTo) ?? "Officer"} · ${c.region || "region pending"}`,
        tone: "sky",
        ts: Date.parse(c.updatedAt ?? "") || 0,
      });
    });
    sanitizedReferrals.forEach((r) => {
      items.push({
        id: `ref-${r.id}`,
        title: `Partner referral · ${r.referralType || "agency"}`,
        subtitle: `Status ${r.status}`,
        tone: "emerald",
        ts: Date.parse(r.createdAt) || 0,
      });
    });
    pendingAlerts.forEach((a) => {
      items.push({
        id: `alt-${a.id}`,
        title: "Emergency escalated",
        subtitle: a.message,
        tone: "rose",
        ts: Date.parse(String(a.time)) || Date.now(),
      });
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [openCases, sanitizedReferrals, pendingAlerts, officerNameById]);
  const filteredIncidents = useMemo(() => {
    const f =
      INCIDENT_FILTERS.find((x) => x.key === incidentFilter) ??
      INCIDENT_FILTERS[0];
    return incidentsFeed.filter((r) => f.match(r));
  }, [incidentsFeed, incidentFilter]);
  // Officer roster with live caseload for the directory section.
  const officerRoster = useMemo(() => {
    const caseload = new Map<string, number>();
    openCases.forEach((c) => {
      if (c.assignedTo)
        caseload.set(c.assignedTo, (caseload.get(c.assignedTo) ?? 0) + 1);
    });
    return officers
      .map((o) => ({
        id: o.id,
        name: o.fullName || o.id,
        isActive: o.isActive,
        caseload: caseload.get(o.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) || b.caseload - a.caseload,
      );
  }, [officers, openCases]);
  const responseLoad = Math.min(
    100,
    Math.round(
      ((urgentCases.length * 2 + highPriorityCases.length) /
        Math.max(activeOfficers.length, 1)) *
        20,
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
    } catch (error) {
      console.error("Failed to acknowledge alert", error);
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

      {/* KPI strip, live map and queue metrics form the Overview command
          centre; focused sections (queue, incidents, evidence, intel,
          directory) render on their own without this heavy header. */}
      {activeTab === "response" && (
        <>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Active emergencies"
              value={pendingAlerts.length}
              helper="Unacknowledged alerts"
              accent="rose"
              loading={isLoadingData}
            />
            <MetricCard
              label="Critical cases"
              value={urgentCases.length}
              helper="Immediate intervention"
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
              label="Pending dispatch"
              value={unassignedOpenCases.length}
              helper="Unassigned open cases"
              accent="sky"
              loading={isLoadingData}
            />
            <MetricCard
              label="Officers available"
              value={activeOfficers.length}
              helper={`${assignedCaseRatio}% caseload assigned`}
              accent="emerald"
              loading={isLoadingData}
            />
            <MetricCard
              label="Avg response time"
              value={avgResponseTime === null ? "—" : `${avgResponseTime}m`}
              helper={
                avgResponseTime === null
                  ? "No active alerts"
                  : "Across active alerts"
              }
              accent="indigo"
              loading={isLoadingData}
            />
          </section>

          {/* Live operational map — command-centre centrepiece */}
          <SectionCard
            title="Live incident map"
            description="SOS alerts, incidents with GPS, and located facilities in your jurisdiction."
            action={
              <StatusPill tone="emerald">
                {mapPoints.length}{" "}
                {mapPoints.length === 1 ? "marker" : "markers"}
              </StatusPill>
            }
          >
            <LiveIncidentMap points={mapPoints} height={420} />
          </SectionCard>
        </>
      )}

      {activeTab === "response" && (
        <>
          {/* Quick actions */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Button
              variant="outline"
              onClick={() => setIsFileIncidentDialogOpen(true)}
            >
              Create incident
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveModule("command_center")}
              disabled={!permissions.canViewOrgData}
            >
              Open dispatch
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveModule("reporting")}
              disabled={!permissions.canAccessAnalytics}
            >
              Generate report
            </Button>
            <Button variant="outline" onClick={() => void refetchAlerts()}>
              Refresh live data
            </Button>
          </section>

          {/* Live incident feed + AI risk assessment */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              title="Live incident feed"
              description="Incoming SOS, domestic violence, child, trafficking, and community reports — newest first."
              action={
                <StatusPill tone="sky">{incidentsFeed.length}</StatusPill>
              }
            >
              <div className="space-y-3">
                {incidentsFeed.length === 0 ? (
                  <EmptyState
                    title="No incidents yet"
                    description="New reports from survivors and community members appear here in real time."
                  />
                ) : (
                  incidentsFeed.slice(0, 6).map((r) => (
                    <ListItemCard
                      key={r.id}
                      title={incidentLabel(r)}
                      subtitle={`${r.is_anonymous ? "Anonymous" : r.report_method || "report"} · ${formatRelativeDateTime(r.created_at)}`}
                      meta={
                        <div className="flex items-center gap-2">
                          <StatusPill tone={incidentTone(r)}>
                            {(
                              r.priority ||
                              r.risk_level ||
                              "review"
                            ).toLowerCase()}
                          </StatusPill>
                          <span className="text-xs text-slate-400">
                            {incidentRisk(r)}%
                          </span>
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="AI risk assessment"
              description="Open cases ranked by triage risk score."
            >
              <div className="space-y-3">
                {emergencyQueue.length === 0 ? (
                  <EmptyState
                    title="No active cases"
                    description="High-risk cases appear here once cases enter your jurisdiction queue."
                  />
                ) : (
                  emergencyQueue
                    .slice(0, 6)
                    .map((c) => (
                      <ListItemCard
                        key={c.id}
                        title={`Case ${c.caseNumber}`}
                        subtitle={`${c.status.replace(/_/g, " ")} · ${c.region || "region pending"}`}
                        meta={
                          <StatusPill
                            tone={
                              c.risk >= 90
                                ? "rose"
                                : c.risk >= 70
                                  ? "amber"
                                  : "sky"
                            }
                          >
                            {c.risk}% risk
                          </StatusPill>
                        }
                      />
                    ))
                )}
              </div>
            </SectionCard>
          </section>

          {/* Recent activity */}
          <SectionCard
            title="Recent activity"
            description="Latest assignments, partner referrals, and escalations across your jurisdiction."
          >
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Officer assignments, partner referrals, and escalations appear here as they happen."
                />
              ) : (
                recentActivity.map((a) => (
                  <ListItemCard
                    key={a.id}
                    title={a.title}
                    subtitle={a.subtitle}
                    meta={<StatusPill tone={a.tone}>live</StatusPill>}
                  />
                ))
              )}
            </div>
          </SectionCard>
        </>
      )}

      {activeTab === "queue" && (
        <>
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

      {activeTab === "queue" && (
        <SectionCard
          title="Emergency queue"
          description="Open cases ranked by triage risk. Dispatch, view, or escalate directly."
          action={
            <StatusPill tone="rose">{emergencyQueue.length} open</StatusPill>
          }
        >
          {emergencyQueue.length === 0 ? (
            <EmptyState
              title="Queue is clear"
              description="No open cases require triage in your jurisdiction right now."
            />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-2 py-2 font-semibold">Priority</th>
                    <th className="px-2 py-2 font-semibold">Case</th>
                    <th className="px-2 py-2 font-semibold">Location</th>
                    <th className="px-2 py-2 font-semibold">Age</th>
                    <th className="px-2 py-2 font-semibold">Risk</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">Officer</th>
                    <th className="px-2 py-2 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {emergencyQueue.map((c) => {
                    const riskTone =
                      c.risk >= 90 ? "rose" : c.risk >= 70 ? "amber" : "sky";
                    return (
                      <tr
                        key={c.id}
                        className="border-t border-white/10 align-middle"
                      >
                        <td className="px-2 py-3">
                          <StatusPill
                            tone={PRIORITY_TONE[c.priority] ?? "slate"}
                          >
                            {c.priority}
                          </StatusPill>
                        </td>
                        <td className="px-2 py-3 font-semibold text-white">
                          {c.caseNumber}
                        </td>
                        <td className="px-2 py-3 text-slate-300">
                          {c.region || "Region pending"}
                        </td>
                        <td className="px-2 py-3 text-slate-300">
                          {c.daysOpen != null ? `${c.daysOpen}d` : "—"}
                        </td>
                        <td className="px-2 py-3">
                          <StatusPill tone={riskTone}>{c.risk}%</StatusPill>
                        </td>
                        <td className="px-2 py-3 capitalize text-slate-300">
                          {c.status.replace(/_/g, " ")}
                        </td>
                        <td className="px-2 py-3 text-slate-300">
                          {c.assignedTo
                            ? (officerNameById.get(c.assignedTo) ?? "Assigned")
                            : "Unassigned"}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setDispatchCaseId(c.id);
                                setIsDispatchDialogOpen(true);
                              }}
                            >
                              Dispatch
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveModule("justice")}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "incidents" && (
        <SectionCard
          title="Incoming incidents"
          description="Reports arriving from survivors and community members, newest first."
          action={
            <StatusPill tone="sky">{filteredIncidents.length}</StatusPill>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {INCIDENT_FILTERS.map((f) => {
              const on = f.key === incidentFilter;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setIncidentFilter(f.key)}
                  className={
                    on
                      ? "rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100"
                      : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300 hover:text-white"
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {filteredIncidents.length === 0 ? (
            <EmptyState
              title="No incidents in this view"
              description="Incoming reports appear here in real time as survivors and community members submit them."
            />
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((r) => (
                <ListItemCard
                  key={r.id}
                  title={
                    <span className="capitalize">
                      {(r.category || "Incident report").replace(/_/g, " ")}
                      {r.is_anonymous ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">
                          · anonymous
                        </span>
                      ) : null}
                    </span>
                  }
                  subtitle={`${(r.report_method || "in-app").replace(/_/g, " ")} · ${
                    r.created_at
                      ? formatRelativeDateTime(r.created_at)
                      : "just now"
                  }${r.description ? ` · ${r.description.slice(0, 80)}` : ""}`}
                  meta={
                    <StatusPill
                      tone={
                        r.priority === "critical" || r.risk_level === "critical"
                          ? "rose"
                          : r.priority === "high" || r.risk_level === "high"
                            ? "amber"
                            : "sky"
                      }
                    >
                      {r.status ? r.status.replace(/_/g, " ") : "new"}
                    </StatusPill>
                  }
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveModule("justice")}
                    >
                      Open
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </SectionCard>
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

      {activeTab === "directory" && (
        <SectionCard
          title="Officer directory"
          description="Your unit roster with live status and current caseload."
          action={
            <StatusPill tone="emerald">
              {officerRoster.filter((o) => o.isActive).length} on duty
            </StatusPill>
          }
        >
          {officerRoster.length === 0 ? (
            <EmptyState
              title="No officers in this unit yet"
              description="Officers appear here once they are added to your organisation."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {officerRoster.map((o) => (
                <ListItemCard
                  key={o.id}
                  title={o.name}
                  subtitle={`${o.caseload} open case${o.caseload === 1 ? "" : "s"} assigned`}
                  meta={
                    <StatusPill tone={o.isActive ? "emerald" : "slate"}>
                      {o.isActive ? "on duty" : "off duty"}
                    </StatusPill>
                  }
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveModule("secure_messages")}
                    >
                      Message
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </SectionCard>
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
