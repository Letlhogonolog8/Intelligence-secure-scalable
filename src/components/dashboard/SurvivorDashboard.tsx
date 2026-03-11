import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsFeed, useIncidentTimeSeries, useUserProfile } from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import PeerSupportNetwork from "@/components/survivor/PeerSupportNetwork";
import SurvivorJourneyVisualizer from "@/components/survivor/SurvivorJourneyVisualizer";
import LegalRightsAssistant from "@/components/survivor/LegalRightsAssistant";
import { getOfflineQueueCount } from "@/lib/offlineCaseQueue";
import { 
  ShieldCheck, 
  MessageSquare, 
  Heart, 
  Search, 
  Activity, 
  Bell, 
  Lock, 
  ExternalLink,
  LifeBuoy,
  Mic
} from "lucide-react";

const VoiceIncidentReporter = lazy(() => import("@/components/survivor/VoiceIncidentReporter"));

const SurvivorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: profile, isLoading } = useUserProfile(user?.id);
  const { data: alertsFeed = [], isLoading: _alertsLoading } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 6 });
  const { data: incidentTimeSeries = [], isLoading: _trendLoading } = useIncidentTimeSeries({ staleTime: 20000, refetchInterval: 30000 });
  const { setActiveModule } = useAppStore();
  
  const [showVoiceReporter, setShowVoiceReporter] = useState(false);
  const [caseLookupId, setCaseLookupId] = useState("");
  const [caseLookupResult, setCaseLookupResult] = useState<{
    id: string;
    status: string;
    risk_level: string;
    priority: string;
    updated_at: string | null;
    created_at: string | null;
  } | null>(null);
  const [caseLookupLoading, setCaseLookupLoading] = useState(false);
  const [caseLookupError, setCaseLookupError] = useState<string | null>(null);
  const [panicMode, setPanicMode] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState(0);
  const panicTimeoutRef = useRef<number | null>(null);
  const panicIntervalRef = useRef<number | null>(null);

  const displayName = profile?.full_name || profile?.fullName || "Survivor";
  
  const latestSignal = incidentTimeSeries[incidentTimeSeries.length - 1];
  const pulseScore = latestSignal ? latestSignal.value : 0;
  const trendDirection = pulseScore > 70 ? "Rising" : pulseScore < 40 ? "Declining" : "Stable";
  
  const alertsPreview = alertsFeed.slice(0, 3);

  const aiRecommendation =
    trendDirection === "Rising"
      ? "Your recent patterns show increased stress. Consider a brief mindfulness exercise or a check-in chat."
      : trendDirection === "Declining"
        ? "Stabilization is progressing well. Maintain your current routine and self-care practices."
        : "You are maintaining a steady pace. Keep connecting with your support system as needed.";

  const handleCaseLookup = async () => {
    const trimmed = caseLookupId.trim();
    if (!trimmed) {
      setCaseLookupError("Enter a case ID to check status.");
      setCaseLookupResult(null);
      return;
    }
    setCaseLookupLoading(true);
    setCaseLookupError(null);
    const { data, error } = await supabase
      .from("case_reports")
      .select("id,status,risk_level,priority,updated_at,created_at")
      .eq("id", trimmed)
      .maybeSingle();

    if (error || !data) {
      setCaseLookupResult(null);
      setCaseLookupError("Case not found. Please verify the ID.");
      setCaseLookupLoading(false);
      return;
    }
    setCaseLookupResult(data);
    setCaseLookupLoading(false);
  };

  useEffect(() => {
    setOfflineQueue(getOfflineQueueCount());
    const updateQueue = () => setOfflineQueue(getOfflineQueueCount());
    window.addEventListener("online", updateQueue);
    window.addEventListener("storage", updateQueue);
    return () => {
      window.removeEventListener("online", updateQueue);
      window.removeEventListener("storage", updateQueue);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (panicTimeoutRef.current) window.clearTimeout(panicTimeoutRef.current);
      if (panicIntervalRef.current) window.clearInterval(panicIntervalRef.current);
    };
  }, []);

  const startPanicHold = () => {
    setHoldProgress(8);
    panicIntervalRef.current = window.setInterval(() => {
      setHoldProgress((prev) => Math.min(100, prev + 7));
    }, 120);
    panicTimeoutRef.current = window.setTimeout(() => {
      setPanicMode(true);
      setHoldProgress(100);
      if (panicIntervalRef.current) window.clearInterval(panicIntervalRef.current);
    }, 1800);
  };

  const cancelPanicHold = () => {
    if (panicTimeoutRef.current) window.clearTimeout(panicTimeoutRef.current);
    if (panicIntervalRef.current) window.clearInterval(panicIntervalRef.current);
    setHoldProgress(0);
  };

  if (panicMode) {
    return (
      <div className="min-h-screen bg-white text-slate-700 px-6 py-8">
        <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Wellness Productivity Board</h2>
            <Button size="sm" variant="outline" onClick={() => { setPanicMode(false); setHoldProgress(0); }}>
              Return
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase text-slate-500">Today</p>
              <p className="mt-2 text-2xl font-bold">3</p>
              <p className="text-sm text-slate-500">Tasks completed</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase text-slate-500">Focus</p>
              <p className="mt-2 text-2xl font-bold">52m</p>
              <p className="text-sm text-slate-500">Deep work streak</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase text-slate-500">Next Break</p>
              <p className="mt-2 text-2xl font-bold">14:30</p>
              <p className="text-sm text-slate-500">Hydration reminder</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/14 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/14 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:140px_140px]" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 relative z-10">
        {/* Welcome Header */}
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/25">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">{t('survivor.secureEnv', 'Secure AI Environment')}</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-12 w-64 bg-white/5" />
              ) : (
                <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">{t('survivor.welcome', 'Welcome back')}, {displayName}</h1>
              )}
              <p className="text-lg text-slate-200/90 max-w-2xl font-light">
                {t('survivor.profileActive', 'Your secure AEGIS profile is active. Access trauma-informed support, track your progress, and connect with help instantly.')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button 
                size="lg" 
                variant="outline" 
                className="h-14 px-8 border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all hover:scale-105" 
                onClick={() => setActiveModule("survivor_support")}
              >
                <LifeBuoy className="mr-2 h-5 w-5 text-blue-400" />
                {t('survivor.getHelp', 'Get Help')}
              </Button>
              <Button 
                size="lg" 
                className="h-14 px-8 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-xl shadow-rose-900/20 font-bold transition-all hover:scale-105" 
                onClick={() => setActiveModule("survivor_support")}
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                {t('survivor.startChat', 'Start Chat')}
              </Button>
              <button
                type="button"
                onMouseDown={startPanicHold}
                onMouseUp={cancelPanicHold}
                onMouseLeave={cancelPanicHold}
                onTouchStart={startPanicHold}
                onTouchEnd={cancelPanicHold}
                className="h-14 min-w-[170px] rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 text-left"
              >
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">Quick Exit</p>
                <p className="text-xs text-amber-100/90">Hold 2s to disguise</p>
                <div className="mt-2 h-1 w-full rounded-full bg-amber-100/15 overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${holdProgress}%` }} />
                </div>
              </button>
              {offlineQueue > 0 && (
                <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold">Offline Sync Queue</p>
                  <p className="text-sm text-cyan-100 font-semibold">{offlineQueue} pending reports</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Insights Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="border-white/15 bg-slate-950/70 p-6 backdrop-blur-md transition-all hover:border-emerald-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-400 border border-emerald-500/20 rounded-full">Recovery 65%</span>
            </div>
            <h3 className="text-white font-bold mb-1">Active Progress</h3>
            <p className="text-sm text-slate-300 mb-4">"Trauma-Informed Recovery" milestone nearly complete.</p>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "65%" }} />
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/70 p-6 backdrop-blur-md transition-all hover:border-blue-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
              <span className="bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase text-blue-400 border border-blue-500/20 rounded-full">Secure</span>
            </div>
            <h3 className="text-white font-bold mb-1">Safety Checklist</h3>
            <p className="text-sm text-slate-300 mb-4">2 critical safety updates pending review.</p>
            <Button variant="link" className="p-0 h-auto text-blue-400 hover:text-blue-300 text-xs font-bold">Review Now →</Button>
          </Card>

          <Card className="border-white/15 bg-slate-950/70 p-6 backdrop-blur-md transition-all hover:border-rose-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <Heart className="h-5 w-5 text-rose-400" />
              </div>
              <span className="bg-rose-500/10 px-3 py-1 text-[10px] font-bold uppercase text-rose-400 border border-rose-500/20 rounded-full">Priority</span>
            </div>
            <h3 className="text-white font-bold mb-1">Offline Access</h3>
            <p className="text-3xl font-mono font-black text-rose-400 mb-1">*123*456#</p>
            <p className="text-[10px] text-slate-300 font-bold uppercase">{t('survivor.ussdAccess', 'USSD Rapid Support Command')}</p>
          </Card>
        </div>

        <SurvivorJourneyVisualizer currentStage={caseLookupResult?.status === "resolved" ? "resolution" : caseLookupResult?.status === "in_review" ? "court" : "assigned"} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-white/15 bg-slate-950/65 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Court & Case Reminders</h3>
              <span className="text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded-full">
                USSD + WhatsApp
              </span>
            </div>
            <div className="space-y-3 text-sm text-slate-200">
              {!caseLookupResult ? (
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-6 text-center opacity-80">
                  <p className="text-slate-400 text-xs py-2">{t('survivor.trackCaseForReminders', 'Track your case below to view connected court dates and follow-ups.')}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Official Follow-up</p>
                    <p className="text-xs text-slate-400">Case ref: {caseLookupResult.id.substring(0, 8).toUpperCase()}</p>
                  </div>
                  <p className="text-xs text-emerald-300 font-semibold">{caseLookupResult.status === 'in_review' ? 'Awaiting Review' : 'Investigation Active'}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/65 p-6 backdrop-blur-xl">
            <h3 className="text-white font-bold text-lg mb-2">Community Safety Signals</h3>
            <p className="text-sm text-slate-300 mb-4">Crowdsourced neighborhood alerts help route support faster.</p>
            <div className="space-y-2 text-sm">
              {alertsFeed.length === 0 ? (
                <p className="text-slate-400 text-xs py-2">{t('survivor.noAlerts', 'No active community alerts in your registered zones.')}</p>
              ) : (
                alertsFeed.slice(0, 3).map((alert, idx) => (
                  <div key={idx} className={`rounded-lg border p-3 flex items-center justify-between ${
                    alert.type === 'critical' ? 'border-rose-500/20 bg-rose-500/10' :
                    alert.type === 'warning' ? 'border-amber-500/20 bg-amber-500/10' :
                    'border-emerald-500/20 bg-emerald-500/10'
                  }`}>
                    <span className={
                      alert.type === 'critical' ? 'text-rose-100' :
                      alert.type === 'warning' ? 'text-amber-100' :
                      'text-emerald-100'
                    }>{alert.message}</span>
                    <span className={`text-[10px] uppercase tracking-widest ${
                      alert.type === 'critical' ? 'text-rose-300' :
                      alert.type === 'warning' ? 'text-amber-300' :
                      'text-emerald-300'
                    }`}>{alert.type || 'Notice'}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Voice Incident Reporter */}
        <div>
          <button
            type="button"
            onClick={() => setShowVoiceReporter((v) => !v)}
            className="flex items-center gap-3 w-full rounded-2xl border border-dashed border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/50 px-6 py-4 transition-all group"
          >
            <div className="h-9 w-9 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">{t('survivor.voiceReport', 'Voice Incident Report')}</p>
              <p className="text-xs text-slate-400">{t('survivor.voiceReportSub', 'Speak your report in any language — no typing required')}</p>
            </div>
            <span className="ml-auto text-xs font-bold uppercase tracking-widest text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
              {showVoiceReporter ? t('common.close', 'Close') : t('common.open', 'Open')}
            </span>
          </button>
          {showVoiceReporter && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl bg-slate-800/50" />}>
                <VoiceIncidentReporter
                  onReportSubmitted={() => setShowVoiceReporter(false)}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Case Status & AI Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Case Lookup Section */}
          <Card className="lg:col-span-2 border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Search className="h-5 w-5 text-blue-400" />
                <h2 className="text-2xl font-bold text-white tracking-tight">{t('survivor.caseTracker', 'Case Status Tracker')}</h2>
              </div>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Input
                    value={caseLookupId}
                    onChange={(e) => setCaseLookupId(e.target.value)}
                    placeholder="Enter Secure Case ID (e.g. CAS-XXXX)"
                    className="h-14 bg-slate-950/60 border-slate-800 text-white pl-4 focus:border-blue-500/50 transition-all"
                  />
                </div>
                <Button 
                  onClick={handleCaseLookup} 
                  disabled={caseLookupLoading} 
                  size="lg" 
                  className="h-14 px-8 bg-blue-600 hover:bg-blue-500 font-bold transition-all active:scale-95"
                >
                  {caseLookupLoading ? t('common.analyzing', 'Analyzing...') : t('survivor.caseTracker', 'Track Case Status')}
                </Button>
              </div>

              {caseLookupError && <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">{caseLookupError}</div>}

              {caseLookupResult ? (
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                    <p className="text-[10px] text-slate-300 font-black uppercase mb-2 tracking-widest">Status</p>
                    <p className="text-emerald-400 font-bold text-lg">{caseLookupResult.status}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                    <p className="text-[10px] text-slate-300 font-black uppercase mb-2 tracking-widest">Risk</p>
                    <p className="text-rose-400 font-bold text-lg">{caseLookupResult.risk_level}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                    <p className="text-[10px] text-slate-300 font-black uppercase mb-2 tracking-widest">Priority</p>
                    <p className="text-white font-bold text-lg">{caseLookupResult.priority}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                    <p className="text-[10px] text-slate-300 font-black uppercase mb-2 tracking-widest">Last Update</p>
                    <p className="text-slate-300 font-medium">{caseLookupResult.updated_at ? new Date(caseLookupResult.updated_at).toLocaleDateString() : "Pending"}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 p-10 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-90">
                  <Search className="h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-300 max-w-xs">Enter your confidential case ID above to pull real-time updates from our secure justice network.</p>
                </div>
              )}
            </div>
          </Card>

          {/* AI Guidance Section */}
          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-xl flex flex-col">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white">{t('survivor.aiPulse', 'AI Health Pulse')}</h2>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-slate-300 font-black uppercase mb-1">{t('survivor.wellbeingIndex', 'Wellbeing Index')}</p>
                    <p className="text-4xl font-black text-white">{pulseScore}%</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      trendDirection === "Rising"
                        ? "bg-rose-500/20 text-rose-300"
                        : trendDirection === "Declining"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {trendDirection} Trend
                  </span>
                </div>
                <div className="relative p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                  <p className="text-sm leading-relaxed text-blue-100/90 italic font-medium">"{aiRecommendation}"</p>
                </div>
              </div>
              <Button variant="ghost" className="mt-8 w-full border border-white/5 hover:bg-white/5 text-slate-300 text-xs font-bold uppercase tracking-widest">
                Full Health Analysis
              </Button>
            </div>
          </Card>
        </div>

        {/* Updates & Resources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Alerts Feed */}
          <Card className="border-white/15 bg-slate-950/60 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-rose-400" />
                <h2 className="text-xl font-bold text-white">{t('survivor.secureAlerts', 'Secure Alerts')}</h2>
              </div>
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <div className="p-6 space-y-4">
              {alertsPreview.length === 0 ? (
                <div className="text-center py-8 opacity-90">
                  <p className="text-sm font-bold uppercase text-slate-300">No new alerts</p>
                </div>
              ) : (
                alertsPreview.map(alert => (
                  <div key={alert.id} className="group p-4 rounded-xl bg-slate-950/60 border border-white/5 flex items-start justify-between gap-4 transition-all hover:bg-slate-950/60 hover:border-white/10">
                    <p className="text-sm text-slate-200 font-medium leading-snug">{alert.message}</p>
                    <span className="text-[10px] font-bold text-slate-300 uppercase whitespace-nowrap pt-1">{alert.time}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Secure Library */}
          <Card className="border-white/15 bg-slate-950/60 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">{t('survivor.healingLibrary', 'Healing Library')}</h2>
              </div>
              <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 font-bold p-0">Browse All</Button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="group p-5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Heart className="h-5 w-5 text-emerald-400" />
                </div>
                <h4 className="text-white font-bold text-sm mb-1">Mindfulness</h4>
                <p className="text-[10px] text-slate-300 font-medium uppercase">15 resources</p>
              </div>
              <div className="group p-5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ExternalLink className="h-5 w-5 text-blue-400" />
                </div>
                <h4 className="text-white font-bold text-sm mb-1">Legal FAQ</h4>
                <p className="text-[10px] text-slate-300 font-medium uppercase">8 modules</p>
              </div>
            </div>
          </Card>
        </div>

        <LegalRightsAssistant />

        {/* Peer Support Network */}
        <PeerSupportNetwork />
      </div>
    </div>
  );
};

export default SurvivorDashboard;
