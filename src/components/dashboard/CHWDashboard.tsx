import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, Users, ClipboardList, Phone, Wifi, WifiOff,
  CheckCircle2, AlertTriangle, Plus, Search, Heart,
  UserCheck, Clock, ChevronRight, Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { enqueueOfflineReport } from "@/hooks/useOfflineSync";
import { DashboardPage, MetricCard, SectionCard } from "@/components/dashboard/DashboardPrimitives";

interface ReferralEntry {
  id: string;
  survivorCode: string;
  serviceType: string;
  status: "pending" | "accepted" | "completed";
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

async function fetchCHWStats(userId: string) {
  const [referrals, visits] = await Promise.allSettled([
    supabase
      .from("case_reports")
      .select("id, status, created_at, risk_level")
      .eq("survivor_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("escalation_events")
      .select("id, severity, status, triggered_at")
      .eq("triggered_by", userId)
      .order("triggered_at", { ascending: false })
      .limit(10),
  ]);

  const referralData =
    referrals.status === "fulfilled" ? (referrals.value.data ?? []) : [];
  const visitData =
    visits.status === "fulfilled" ? (visits.value.data ?? []) : [];

  return { referralData, visitData };
}

const CHWDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, pendingCount } = useOfflineSync();

  const [activeTab, setActiveTab] = useState<"overview" | "referrals" | "visits" | "report">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralForm, setReferralForm] = useState({ survivorCode: "", serviceType: SERVICE_TYPES[0], notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [visitForm, setVisitForm] = useState({ location: "", survivorsReached: "", outcome: "" });

  const { data: _stats, isLoading } = useQuery({
    queryKey: ["chw-stats", user?.id],
    queryFn: () => fetchCHWStats(user?.id ?? ""),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const localReferrals: ReferralEntry[] = [
    { id: "r1", survivorCode: "SUR-001A", serviceType: "Medical / Clinic", status: "completed", createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "r2", survivorCode: "SUR-002B", serviceType: "Safe Shelter", status: "pending", createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "r3", survivorCode: "SUR-003C", serviceType: "Legal Aid", status: "accepted", createdAt: new Date(Date.now() - 7200000).toISOString() },
  ];

  const localVisits: VisitLog[] = [
    { id: "v1", location: "Diepsloot Ward 3", survivorsReached: 8, date: new Date(Date.now() - 86400000 * 2).toISOString(), outcome: "4 referrals made, 2 safety plans updated" },
    { id: "v2", location: "Orange Farm Ext 4", survivorsReached: 5, date: new Date(Date.now() - 86400000).toISOString(), outcome: "3 survivors linked to shelter" },
  ];

  const totalReached = localVisits.reduce((acc, v) => acc + v.survivorsReached, 0);
  const pendingReferrals = localReferrals.filter(r => r.status === "pending").length;
  const completedReferrals = localReferrals.filter(r => r.status === "completed").length;

  const handleReferralSubmit = async () => {
    if (!referralForm.survivorCode.trim()) return;
    setSubmitting(true);
    const payload = {
      id: `REF-${Date.now()}`,
      survivor_id: referralForm.survivorCode,
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
    } catch {
      await enqueueOfflineReport({ id: payload.id, type: "case_report", payload, createdAt: payload.created_at });
    }

    setSubmitting(false);
    setSubmitSuccess(true);
    setReferralForm({ survivorCode: "", serviceType: SERVICE_TYPES[0], notes: "" });
    setTimeout(() => { setSubmitSuccess(false); setShowReferralForm(false); }, 2500);
  };

  const handleVisitLog = async () => {
    if (!visitForm.location.trim()) return;
    setSubmitting(true);
    const payload = {
      id: `VISIT-${Date.now()}`,
      case_id: null,
      triggered_by: user?.id ?? "chw",
      escalation_type: "chw_visit",
      severity: "low",
      reason: `Field visit — ${visitForm.survivorsReached} survivors reached. ${visitForm.outcome}`,
      location: { address: visitForm.location },
      status: "resolved",
      triggered_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from("escalation_events").insert(payload);
      if (error) throw error;
    } catch {
      await enqueueOfflineReport({ id: payload.id, type: "escalation", payload, createdAt: payload.triggered_at });
    }

    setSubmitting(false);
    setVisitForm({ location: "", survivorsReached: "", outcome: "" });
    setActiveTab("overview");
  };

  const filteredReferrals = localReferrals.filter(r =>
    r.survivorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.serviceType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardPage accent="emerald">
      {/* Connectivity Banner */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${isOnline ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-amber-500/10 border border-amber-500/20 text-amber-300"}`}>
        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {isOnline
          ? `Online · All data syncing live${pendingCount > 0 ? ` · ${pendingCount} pending upload` : ""}`
          : `Offline · ${pendingCount} report${pendingCount !== 1 ? "s" : ""} queued locally — will sync when reconnected`}
      </div>

      {/* Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Survivors Reached" value={totalReached} helper="This week" accent="emerald" loading={isLoading} />
        <MetricCard label="Pending Referrals" value={pendingReferrals} helper="Awaiting acceptance" accent="amber" loading={isLoading} />
        <MetricCard label="Completed Referrals" value={completedReferrals} helper="Services connected" accent="sky" loading={isLoading} />
        <MetricCard label="Field Visits" value={localVisits.length} helper="Logged this month" accent="indigo" loading={isLoading} />
      </section>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/8 pb-1">
        {(["overview", "referrals", "visits", "report"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize rounded-t transition-all ${
              activeTab === tab ? "text-white border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
            }`}
          >
            {tab === "report" ? "Log Visit" : tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SectionCard title="Quick Actions" description="Most common field tasks">
            <div className="space-y-2">
              {[
                { icon: Plus, label: "Log new referral", color: "text-emerald-400", action: () => { setShowReferralForm(true); setActiveTab("referrals"); } },
                { icon: ClipboardList, label: "Log field visit", color: "text-blue-400", action: () => setActiveTab("report") },
                { icon: Mic, label: "Voice incident report", color: "text-rose-400", action: () => setActiveTab("report") },
                { icon: Search, label: "Look up survivor case", color: "text-purple-400", action: () => setActiveTab("referrals") },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm text-slate-200 font-medium">{item.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Emergency Resources" description="Contacts for immediate field escalation">
            <div className="space-y-3">
              {[
                { label: "GBV Crisis Line", value: "0800 428 428", note: "24/7 · Free" },
                { label: "Police Emergency", value: "10111", note: "Immediate danger" },
                { label: "USSD (no internet)", value: "*123*456#", note: "Works on any phone" },
                { label: "Legal Aid SA", value: "0800 110 110", note: "Free legal advice" },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-[11px] text-slate-400">{c.note}</p>
                  </div>
                  <a href={`tel:${c.value.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-1.5 text-rose-400 font-mono text-sm font-bold hover:text-rose-300 transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                    {c.value}
                  </a>
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}

      {/* Referrals */}
      {activeTab === "referrals" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
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
            <Button onClick={() => setShowReferralForm(!showReferralForm)} className="bg-emerald-600 hover:bg-emerald-500 shrink-0">
              <Plus className="h-4 w-4 mr-1.5" /> New Referral
            </Button>
          </div>

          {showReferralForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 space-y-4">
              <h3 className="text-white font-bold text-sm">New Service Referral</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Survivor Code / ID</label>
                  <Input value={referralForm.survivorCode} onChange={e => setReferralForm(p => ({ ...p, survivorCode: e.target.value }))} placeholder="e.g. SUR-001A" className="bg-slate-900/60 border-white/10 text-white" />
                </div>
                <div>
                  <label htmlFor="chw-referral-service-type" className="text-xs text-slate-400 font-semibold mb-1.5 block">Service Type</label>
                  <select id="chw-referral-service-type" value={referralForm.serviceType} onChange={e => setReferralForm(p => ({ ...p, serviceType: e.target.value }))} className="w-full h-10 rounded-md border border-white/10 bg-slate-900/60 text-white text-sm px-3">
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Notes (optional)</label>
                <Input value={referralForm.notes} onChange={e => setReferralForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional context for the receiving service…" className="bg-slate-900/60 border-white/10 text-white" />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleReferralSubmit} disabled={submitting || !referralForm.survivorCode.trim()} className="bg-emerald-600 hover:bg-emerald-500">
                  {submitting ? "Saving…" : "Submit Referral"}
                </Button>
                <Button variant="outline" onClick={() => setShowReferralForm(false)} className="border-white/15 text-slate-300">Cancel</Button>
                {submitSuccess && <p className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Saved{!isOnline ? " (offline queue)" : ""}</p>}
              </div>
            </motion.div>
          )}

          <div className="space-y-3">
            {filteredReferrals.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/4 border border-white/8">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">{r.survivorCode}</p>
                    <p className="text-xs text-slate-400">{r.serviceType} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : r.status === "accepted" ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Visit History */}
      {activeTab === "visits" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {localVisits.map(v => (
            <div key={v.id} className="p-5 rounded-2xl border border-white/10 bg-white/4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-white text-sm">{v.location}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(v.date).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                <span><span className="font-bold text-blue-400">{v.survivorsReached}</span> survivors reached</span>
              </div>
              <p className="text-xs text-slate-400 pl-5">{v.outcome}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Log Visit */}
      {activeTab === "report" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <SectionCard title="Log Field Visit" description="Record your outreach activity for reporting and impact tracking">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Location / Community</label>
                <Input value={visitForm.location} onChange={e => setVisitForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Diepsloot Ward 3, Orange Farm" className="bg-slate-900/60 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Number of Survivors Reached</label>
                <Input type="number" min="0" value={visitForm.survivorsReached} onChange={e => setVisitForm(p => ({ ...p, survivorsReached: e.target.value }))} placeholder="0" className="bg-slate-900/60 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Outcome / Notes</label>
                <Input value={visitForm.outcome} onChange={e => setVisitForm(p => ({ ...p, outcome: e.target.value }))} placeholder="Referrals made, safety plans updated, issues identified…" className="bg-slate-900/60 border-white/10 text-white" />
              </div>

              {!isOnline && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">You are offline. This visit will be saved locally and synced when you reconnect.</p>
                </div>
              )}

              <Button onClick={handleVisitLog} disabled={submitting || !visitForm.location.trim()} className="bg-emerald-600 hover:bg-emerald-500 w-full">
                <Heart className="h-4 w-4 mr-2" />
                {submitting ? "Saving…" : `Save Visit Log${!isOnline ? " (offline)" : ""}`}
              </Button>
            </div>
          </SectionCard>
        </motion.div>
      )}
    </DashboardPage>
  );
};

export default CHWDashboard;
