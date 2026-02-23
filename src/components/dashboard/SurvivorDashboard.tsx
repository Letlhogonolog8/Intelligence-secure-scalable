import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsFeed, useIncidentTimeSeries, useUserProfile } from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import { 
  ShieldCheck, 
  MessageSquare, 
  Heart, 
  Search, 
  Activity, 
  Bell, 
  Lock, 
  ExternalLink,
  LifeBuoy
} from "lucide-react";

const SurvivorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: profile, isLoading } = useUserProfile(user?.id);
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 6 });
  const { data: incidentTimeSeries = [], isLoading: trendLoading } = useIncidentTimeSeries({ staleTime: 20000, refetchInterval: 30000 });
  const { setActiveModule } = useAppStore();
  
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

  return (
    <div className="min-h-screen bg-[#050810] text-slate-50 px-6 py-8 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 relative z-10">
        {/* Welcome Header */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Secure AI Environment</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-12 w-64 bg-white/5" />
              ) : (
                <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">Welcome back, {displayName}</h1>
              )}
              <p className="text-lg text-slate-300/90 max-w-2xl font-light">
                Your secure AEGIS profile is active. Access trauma-informed support, track your progress, and connect with help instantly.
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
                Get Help
              </Button>
              <Button 
                size="lg" 
                className="h-14 px-8 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-xl shadow-rose-900/20 font-bold transition-all hover:scale-105" 
                onClick={() => setActiveModule("survivor_support")}
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Start Chat
              </Button>
            </div>
          </div>
        </section>

        {/* Quick Insights Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-emerald-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-400 border border-emerald-500/20 rounded-full">Recovery 65%</span>
            </div>
            <h3 className="text-white font-bold mb-1">Active Progress</h3>
            <p className="text-sm text-slate-400 mb-4">"Trauma-Informed Recovery" milestone nearly complete.</p>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "65%" }} />
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-blue-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
              <span className="bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase text-blue-400 border border-blue-500/20 rounded-full">Secure</span>
            </div>
            <h3 className="text-white font-bold mb-1">Safety Checklist</h3>
            <p className="text-sm text-slate-400 mb-4">2 critical safety updates pending review.</p>
            <Button variant="link" className="p-0 h-auto text-blue-400 hover:text-blue-300 text-xs font-bold">Review Now →</Button>
          </Card>

          <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-rose-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <Heart className="h-5 w-5 text-rose-400" />
              </div>
              <span className="bg-rose-500/10 px-3 py-1 text-[10px] font-bold uppercase text-rose-400 border border-rose-500/20 rounded-full">Priority</span>
            </div>
            <h3 className="text-white font-bold mb-1">Offline Access</h3>
            <p className="text-3xl font-mono font-black text-rose-400 mb-1">*123*456#</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase">USSD Rapid Support Command</p>
          </Card>
        </div>

        {/* Case Status & AI Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Case Lookup Section */}
          <Card className="lg:col-span-2 border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Search className="h-5 w-5 text-blue-400" />
                <h2 className="text-2xl font-bold text-white tracking-tight">Case Status Tracker</h2>
              </div>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Input
                    value={caseLookupId}
                    onChange={(e) => setCaseLookupId(e.target.value)}
                    placeholder="Enter Secure Case ID (e.g. CAS-XXXX)"
                    className="h-14 bg-slate-950/40 border-slate-800 text-white pl-4 focus:border-blue-500/50 transition-all"
                  />
                </div>
                <Button 
                  onClick={handleCaseLookup} 
                  disabled={caseLookupLoading} 
                  size="lg" 
                  className="h-14 px-8 bg-blue-600 hover:bg-blue-500 font-bold transition-all active:scale-95"
                >
                  {caseLookupLoading ? "Analyzing..." : "Track Case Status"}
                </Button>
              </div>

              {caseLookupError && <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">{caseLookupError}</div>}

              {caseLookupResult ? (
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Status</p>
                    <p className="text-emerald-400 font-bold text-lg">{caseLookupResult.status}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Risk</p>
                    <p className="text-rose-400 font-bold text-lg">{caseLookupResult.risk_level}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Priority</p>
                    <p className="text-white font-bold text-lg">{caseLookupResult.priority}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Last Update</p>
                    <p className="text-slate-300 font-medium">{caseLookupResult.updated_at ? new Date(caseLookupResult.updated_at).toLocaleDateString() : "Pending"}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 p-10 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center opacity-40">
                  <Search className="h-8 w-8 text-slate-500 mb-3" />
                  <p className="text-sm text-slate-500 max-w-xs">Enter your confidential case ID above to pull real-time updates from our secure justice network.</p>
                </div>
              )}
            </div>
          </Card>

          {/* AI Guidance Section */}
          <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl flex flex-col">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white">AI Health Pulse</h2>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Wellbeing Index</p>
                    <p className="text-4xl font-black text-white">{pulseScore}%</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${trendDirection === "Rising" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                    {trendDirection} Trend
                  </span>
                </div>
                <div className="relative p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                  <p className="text-sm leading-relaxed text-blue-100/90 italic font-medium">"{aiRecommendation}"</p>
                </div>
              </div>
              <Button variant="ghost" className="mt-8 w-full border border-white/5 hover:bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-widest">
                Full Health Analysis
              </Button>
            </div>
          </Card>
        </div>

        {/* Updates & Resources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Alerts Feed */}
          <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-rose-400" />
                <h2 className="text-xl font-bold text-white">Secure Alerts</h2>
              </div>
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <div className="p-6 space-y-4">
              {alertsPreview.length === 0 ? (
                <div className="text-center py-8 opacity-40">
                  <p className="text-sm font-bold uppercase text-slate-500">No new alerts</p>
                </div>
              ) : (
                alertsPreview.map(alert => (
                  <div key={alert.id} className="group p-4 rounded-xl bg-slate-950/40 border border-white/5 flex items-start justify-between gap-4 transition-all hover:bg-slate-950/60 hover:border-white/10">
                    <p className="text-sm text-slate-200 font-medium leading-snug">{alert.message}</p>
                    <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap pt-1">{alert.time}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Secure Library */}
          <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">Healing Library</h2>
              </div>
              <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 font-bold p-0">Browse All</Button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="group p-5 rounded-2xl bg-slate-950/40 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Heart className="h-5 w-5 text-emerald-400" />
                </div>
                <h4 className="text-white font-bold text-sm mb-1">Mindfulness</h4>
                <p className="text-[10px] text-slate-500 font-medium uppercase">15 resources</p>
              </div>
              <div className="group p-5 rounded-2xl bg-slate-950/40 border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ExternalLink className="h-5 w-5 text-blue-400" />
                </div>
                <h4 className="text-white font-bold text-sm mb-1">Legal FAQ</h4>
                <p className="text-[10px] text-slate-500 font-medium uppercase">8 modules</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SurvivorDashboard;
