import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Users,
  ClipboardList,
  Phone,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Heart,
  UserCheck,
  Clock,
  ChevronRight,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { enqueueOfflineReport } from "@/hooks/useOfflineSync";
import {
  DashboardHero,
  DashboardPage,
  EmptyState,
  HeroBadge,
  ListItemCard,
  MetricCard,
  NoticeBanner,
  SectionCard,
  StatusPill,
  TabBar,
} from "@/components/dashboard/DashboardPrimitives";

interface ReferralEntry {
  id: string;
  survivorCode: string;
  serviceType: string;
  status: string;
  createdAt: string;
  notes?: string;
}

interface VisitLog {
  id: string;
  location: string;
  survivorsReached: number;
  date: string;
  outcome: string;
}

const SERVICE_TYPES = [
  "Medical / Clinic",
  "Safe Shelter",
  "Legal Aid",
  "Counselling",
  "Food / Nutrition",
  "Police Report",
  "Child Protection",
];

type Row = Record<string, unknown>;

/**
 * Live CHW field data. Referrals are the case_reports this worker filed
 * (report_method "chw_referral"); visits are the escalation_events they logged
 * (escalation_type "chw_visit"). No demo/seed rows — empty means nothing filed yet.
 */
async function fetchCHWStats(userId: string) {
  const [referrals, visits] = await Promise.allSettled([
    supabase
      .from("case_reports")
      .select("id, survivor_id, status, description, risk_level, created_at")
      .eq("reported_by", userId)
      .eq("report_method", "chw_referral")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("escalation_events")
      .select("id, reason, location, severity, status, triggered_at")
      .eq("user_id", userId)
      .eq("escalation_type", "chw_visit")
      .order("triggered_at", { ascending: false })
      .limit(50),
  ]);

  const referralData = (
    referrals.status === "fulfilled" ? (referrals.value.data ?? []) : []
  ) as Row[];
  const visitData = (
    visits.status === "fulfilled" ? (visits.value.data ?? []) : []
  ) as Row[];

  return { referralData, visitData };
}

const str = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value : fallback;

/** The submit forms encode service/notes/outcome into free-text fields; parse them back for display. */
const parseServiceType = (description: unknown) =>
  str(description)
    .match(/Service:\s*([^.]+)/i)?.[1]
    ?.trim() || "Service referral";

const parseSurvivorsReached = (reason: unknown) => {
  const match = str(reason).match(/(\d+)\s+survivors?/i);
  return match ? Number(match[1]) : 0;
};

const parseVisitOutcome = (reason: unknown) => {
  const text = str(reason);
  return text.match(/reached\.\s*(.+)$/i)?.[1]?.trim() || text || "Field visit";
};

const mapReferral = (row: Row): ReferralEntry => ({
  id: str(row.id, crypto.randomUUID()),
  survivorCode: str(row.survivor_id, "Unknown"),
  serviceType: parseServiceType(row.description),
  status: str(row.status, "open"),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapVisit = (row: Row): VisitLog => {
  const location = row.location as { address?: string } | null;
  return {
    id: str(row.id, crypto.randomUUID()),
    location: str(location?.address, "Field location"),
    survivorsReached: parseSurvivorsReached(row.reason),
    date: str(row.triggered_at, new Date().toISOString()),
    outcome: parseVisitOutcome(row.reason),
  };
};

const referralTone = (status: string) =>
  /completed|resolved|closed/i.test(status)
    ? "emerald"
    : /accepted|progress|active/i.test(status)
      ? "sky"
      : "amber";

const CHWDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, pendingCount } = useOfflineSync();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    "overview" | "referrals" | "visits" | "report"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralForm, setReferralForm] = useState({
    survivorCode: "",
    serviceType: SERVICE_TYPES[0],
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [visitForm, setVisitForm] = useState({
    location: "",
    survivorsReached: "",
    outcome: "",
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["chw-stats", user?.id],
    queryFn: () => fetchCHWStats(user?.id ?? ""),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Live updates: refresh the moment a referral or visit is written anywhere
  // (this worker's web session, another device, or the mobile field app).
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`chw-stats:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_reports" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["chw-stats", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "escalation_events" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["chw-stats", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const referrals = useMemo<ReferralEntry[]>(
    () => (stats?.referralData ?? []).map(mapReferral),
    [stats],
  );
  const visits = useMemo<VisitLog[]>(
    () => (stats?.visitData ?? []).map(mapVisit),
    [stats],
  );

  const totalReached = visits.reduce((acc, v) => acc + v.survivorsReached, 0);
  const pendingReferrals = referrals.filter((r) =>
    /pending|open|new/i.test(r.status),
  ).length;
  const completedReferrals = referrals.filter((r) =>
    /completed|resolved|closed/i.test(r.status),
  ).length;

  const handleReferralSubmit = async () => {
    if (!referralForm.survivorCode.trim()) return;
    setSubmitting(true);
    const payload = {
      id: `REF-${Date.now()}`,
      survivor_id: referralForm.survivorCode,
      reported_by: user?.id ?? null,
      report_method: "chw_referral",
      description: `CHW Referral — Service: ${referralForm.serviceType}. Notes: ${referralForm.notes}`,
      status: "open",
      risk_level: "medium",
      priority: "normal",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from("case_reports").insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["chw-stats", user?.id] });
    } catch {
      await enqueueOfflineReport({
        id: payload.id,
        type: "case_report",
        payload,
        createdAt: payload.created_at,
      });
    }

    setSubmitting(false);
    setSubmitSuccess(true);
    setReferralForm({
      survivorCode: "",
      serviceType: SERVICE_TYPES[0],
      notes: "",
    });
    setTimeout(() => {
      setSubmitSuccess(false);
      setShowReferralForm(false);
    }, 2500);
  };

  const handleVisitLog = async () => {
    if (!visitForm.location.trim()) return;
    setSubmitting(true);
    const payload = {
      id: `VISIT-${Date.now()}`,
      case_id: null,
      // user_id is the canonical owner column (escalation_events INSERT policy
      // checks user_id = auth.uid()); the live table has no triggered_by column.
      user_id: user?.id ?? null,
      escalation_type: "chw_visit",
      severity: "low",
      reason: `Field visit — ${visitForm.survivorsReached} survivors reached. ${visitForm.outcome}`,
      location: { address: visitForm.location },
      status: "resolved",
      triggered_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("escalation_events")
        .insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["chw-stats", user?.id] });
    } catch {
      await enqueueOfflineReport({
        id: payload.id,
        type: "escalation",
        payload,
        createdAt: payload.triggered_at,
      });
    }

    setSubmitting(false);
    setVisitForm({ location: "", survivorsReached: "", outcome: "" });
    setActiveTab("overview");
  };

  const filteredReferrals = referrals.filter(
    (r) =>
      r.survivorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.serviceType.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardPage accent="emerald">
      <DashboardHero
        eyebrow="Community outreach"
        title="Community health field hub"
        description="Field referrals, outreach visits, and survivor connections — built to keep working when connectivity drops."
        badges={[
          <HeroBadge
            key="reach"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          >
            {totalReached} survivors reached
          </HeroBadge>,
          <HeroBadge
            key="pending"
            className="border-amber-500/20 bg-amber-500/10 text-amber-200"
          >
            {pendingReferrals} referrals pending
          </HeroBadge>,
          <HeroBadge
            key="sync"
            className={
              isOnline
                ? "border-sky-500/20 bg-sky-500/10 text-sky-200"
                : "border-amber-500/20 bg-amber-500/10 text-amber-200"
            }
          >
            {isOnline ? "Live sync active" : "Offline mode"}
          </HeroBadge>,
        ]}
      />

      <NoticeBanner
        tone={isOnline ? "emerald" : "amber"}
        icon={
          isOnline ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )
        }
      >
        {isOnline
          ? `Online · All data syncing live${pendingCount > 0 ? ` · ${pendingCount} pending upload` : ""}`
          : `Offline · ${pendingCount} report${pendingCount !== 1 ? "s" : ""} queued locally — will sync when reconnected`}
      </NoticeBanner>

      {/* Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Survivors Reached"
          value={totalReached}
          helper="This week"
          accent="emerald"
          loading={isLoading}
        />
        <MetricCard
          label="Pending Referrals"
          value={pendingReferrals}
          helper="Awaiting acceptance"
          accent="amber"
          loading={isLoading}
        />
        <MetricCard
          label="Completed Referrals"
          value={completedReferrals}
          helper="Services connected"
          accent="sky"
          loading={isLoading}
        />
        <MetricCard
          label="Field Visits"
          value={visits.length}
          helper="Logged this month"
          accent="indigo"
          loading={isLoading}
        />
      </section>

      {/* Tabs */}
      <TabBar
        accent="emerald"
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "referrals", label: "Referrals" },
          { id: "visits", label: "Visits" },
          { id: "report", label: "Log Visit" },
        ]}
      />

      {/* Overview */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 xl:grid-cols-2 gap-6"
        >
          <SectionCard
            title="Quick Actions"
            description="Most common field tasks"
          >
            <div className="space-y-2">
              {[
                {
                  icon: Plus,
                  label: "Log new referral",
                  color: "text-emerald-400",
                  action: () => {
                    setShowReferralForm(true);
                    setActiveTab("referrals");
                  },
                },
                {
                  icon: ClipboardList,
                  label: "Log field visit",
                  color: "text-blue-400",
                  action: () => setActiveTab("report"),
                },
                {
                  icon: Mic,
                  label: "Voice incident report",
                  color: "text-rose-400",
                  action: () => setActiveTab("report"),
                },
                {
                  icon: Search,
                  label: "Look up survivor case",
                  color: "text-purple-400",
                  action: () => setActiveTab("referrals"),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm text-slate-200 font-medium">
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Emergency Resources"
            description="Contacts for immediate field escalation"
          >
            <div className="space-y-3">
              {[
                {
                  label: "GBV Crisis Line",
                  value: "0800 428 428",
                  note: "24/7 · Free",
                },
                {
                  label: "Police Emergency",
                  value: "10111",
                  note: "Immediate danger",
                },
                {
                  label: "USSD (no internet)",
                  value: "*135*1782#",
                  note: "Works on any phone",
                },
                {
                  label: "Legal Aid SA",
                  value: "0800 110 110",
                  note: "Free legal advice",
                },
              ].map((c) => (
                <ListItemCard
                  key={c.label}
                  title={c.label}
                  subtitle={c.note}
                  meta={
                    <a
                      href={`tel:${c.value.replace(/[^0-9+*#]/g, "")}`}
                      className="flex items-center gap-1.5 font-mono text-sm font-bold text-rose-400 transition-colors hover:text-rose-300"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {c.value}
                    </a>
                  }
                />
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}

      {/* Referrals */}
      {activeTab === "referrals" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by survivor code or service…"
                className="pl-9 bg-slate-900/60 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              onClick={() => setShowReferralForm(!showReferralForm)}
              className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Referral
            </Button>
          </div>

          {showReferralForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 space-y-4"
            >
              <h3 className="text-white font-bold text-sm">
                New Service Referral
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                    Survivor Code / ID
                  </label>
                  <Input
                    value={referralForm.survivorCode}
                    onChange={(e) =>
                      setReferralForm((p) => ({
                        ...p,
                        survivorCode: e.target.value,
                      }))
                    }
                    placeholder="e.g. SUR-001A"
                    className="bg-slate-900/60 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="chw-referral-service-type"
                    className="text-xs text-slate-400 font-semibold mb-1.5 block"
                  >
                    Service Type
                  </label>
                  <select
                    id="chw-referral-service-type"
                    value={referralForm.serviceType}
                    onChange={(e) =>
                      setReferralForm((p) => ({
                        ...p,
                        serviceType: e.target.value,
                      }))
                    }
                    className="w-full h-10 rounded-md border border-white/10 bg-slate-900/60 text-white text-sm px-3"
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                  Notes (optional)
                </label>
                <Input
                  value={referralForm.notes}
                  onChange={(e) =>
                    setReferralForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Additional context for the receiving service…"
                  className="bg-slate-900/60 border-white/10 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleReferralSubmit}
                  disabled={submitting || !referralForm.survivorCode.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {submitting ? "Saving…" : "Submit Referral"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReferralForm(false)}
                  className="border-white/15 text-slate-300"
                >
                  Cancel
                </Button>
                {submitSuccess && (
                  <p className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Saved
                    {!isOnline ? " (offline queue)" : ""}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          <div className="space-y-3">
            {filteredReferrals.length === 0 ? (
              <EmptyState
                title={
                  referrals.length === 0
                    ? "No referrals yet"
                    : "No matching referrals"
                }
                description={
                  referrals.length === 0
                    ? "Referrals you file appear here in real time — including any synced from the field once you reconnect."
                    : "No referrals match your search. Clear the search to see all of your referrals."
                }
              />
            ) : (
              filteredReferrals.map((r) => (
                <ListItemCard
                  key={r.id}
                  title={
                    <span className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 shrink-0 text-slate-400" />
                      {r.survivorCode}
                    </span>
                  }
                  subtitle={`${r.serviceType} · ${new Date(r.createdAt).toLocaleDateString()}`}
                  meta={
                    <StatusPill tone={referralTone(r.status)}>
                      {r.status}
                    </StatusPill>
                  }
                />
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Visit History */}
      {activeTab === "visits" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {visits.length === 0 ? (
            <EmptyState
              title="No field visits logged yet"
              description="Visits you log from the field appear here in real time. Use the “Log Visit” tab to record outreach activity — it works offline and syncs when you reconnect."
            />
          ) : (
            visits.map((v) => (
              <ListItemCard
                key={v.id}
                title={
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
                    {v.location}
                  </span>
                }
                subtitle={v.outcome}
                meta={
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                      <span className="font-bold text-blue-400">
                        {v.survivorsReached}
                      </span>{" "}
                      reached
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(v.date).toLocaleDateString()}
                    </span>
                  </span>
                }
              />
            ))
          )}
        </motion.div>
      )}

      {/* Log Visit */}
      {activeTab === "report" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SectionCard
            title="Log Field Visit"
            description="Record your outreach activity for reporting and impact tracking"
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                  Location / Community
                </label>
                <Input
                  value={visitForm.location}
                  onChange={(e) =>
                    setVisitForm((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="e.g. Diepsloot Ward 3, Orange Farm"
                  className="bg-slate-900/60 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                  Number of Survivors Reached
                </label>
                <Input
                  type="number"
                  min="0"
                  value={visitForm.survivorsReached}
                  onChange={(e) =>
                    setVisitForm((p) => ({
                      ...p,
                      survivorsReached: e.target.value,
                    }))
                  }
                  placeholder="0"
                  className="bg-slate-900/60 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                  Outcome / Notes
                </label>
                <Input
                  value={visitForm.outcome}
                  onChange={(e) =>
                    setVisitForm((p) => ({ ...p, outcome: e.target.value }))
                  }
                  placeholder="Referrals made, safety plans updated, issues identified…"
                  className="bg-slate-900/60 border-white/10 text-white"
                />
              </div>

              {!isOnline && (
                <NoticeBanner
                  tone="amber"
                  icon={
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  }
                >
                  You are offline. This visit will be saved locally and synced
                  when you reconnect.
                </NoticeBanner>
              )}

              <Button
                onClick={handleVisitLog}
                disabled={submitting || !visitForm.location.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 w-full"
              >
                <Heart className="h-4 w-4 mr-2" />
                {submitting
                  ? "Saving…"
                  : `Save Visit Log${!isOnline ? " (offline)" : ""}`}
              </Button>
            </div>
          </SectionCard>
        </motion.div>
      )}
    </DashboardPage>
  );
};

export default CHWDashboard;
