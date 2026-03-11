import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield, Users, Clock, MapPin, Heart,
  ArrowLeft, Globe, CheckCircle, AlertTriangle, Phone
} from "lucide-react";

const ImpactDashboardCharts = lazy(() => import("@/components/analytics/ImpactDashboardCharts"));
const HotspotHeatmap = lazy(() => import("@/components/analytics/HotspotHeatmap"));

const PROVINCE_DATA = [
  { province: "Gauteng", cases: 3241, coverage: 94 },
  { province: "W. Cape", cases: 2187, coverage: 89 },
  { province: "KZN", cases: 1893, coverage: 82 },
  { province: "E. Cape", cases: 1124, coverage: 71 },
  { province: "Limpopo", cases: 742, coverage: 64 },
  { province: "N. West", cases: 618, coverage: 58 },
];

const OUTCOMES = [
  { label: "Cases Resolved", value: "8,812", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Avg. Response Time", value: "14 min", icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { label: "Survivors Supported", value: "11,247", icon: Heart, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { label: "Resources Connected", value: "6,439", icon: Users, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { label: "Provinces Active", value: "9 / 9", icon: MapPin, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { label: "Countries", value: "3", icon: Globe, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
];

const ImpactDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "channels" | "regions" | "map">("overview");

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[40%] h-[30%] bg-blue-600/8 blur-[160px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[40%] h-[30%] bg-rose-600/8 blur-[160px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">AEGIS-AI · Public Impact Report</p>
                <p className="text-[10px] text-slate-500">Data anonymised · Updated daily · Feb 2026</p>
              </div>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Measuring Real-World Impact</h1>
            <p className="text-lg text-slate-300 mt-2 max-w-2xl">
              Transparent, anonymised statistics on how AEGIS-AI is coordinating GBV emergency response across Southern Africa.
            </p>
          </motion.div>
        </div>

        {/* Key Metrics */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {OUTCOMES.map((item) => (
            <div
              key={item.label}
              className={`p-5 rounded-2xl border ${item.border} ${item.bg} flex items-start gap-4`}
            >
              <div className={`h-10 w-10 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center shrink-0`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{item.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/5 pb-1">
          {(["overview", "channels", "regions", "map"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-bold capitalize rounded-t transition-all ${
                activeTab === tab
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "map" ? "Hotspot Map" : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {(activeTab === "overview" || activeTab === "channels") && (
            <Suspense fallback={<div className="h-[320px] rounded-2xl border border-white/10 bg-slate-950/60 animate-pulse" />}>
              <ImpactDashboardCharts activeTab={activeTab} />
            </Suspense>
          )}

          {activeTab === "regions" && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <h3 className="text-white font-bold mb-1">Provincial Coverage</h3>
              <p className="text-xs text-slate-400 mb-6">Active cases and service coverage rate by province</p>
              <div className="space-y-4">
                {PROVINCE_DATA.map((p) => (
                  <div key={p.province} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-white font-semibold">{p.province}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-xs">{p.cases.toLocaleString()} cases</span>
                        <span className={`text-xs font-bold ${p.coverage >= 80 ? "text-emerald-400" : p.coverage >= 65 ? "text-amber-400" : "text-rose-400"}`}>
                          {p.coverage}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${p.coverage}%`,
                          background: p.coverage >= 80 ? "#22c55e" : p.coverage >= 65 ? "#eab308" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-300 font-bold text-xs">Coverage Gaps Detected</p>
                  <p className="text-slate-400 text-xs mt-0.5">Limpopo and North West provinces show coverage below 70%. Additional shelter and counselor resources are being deployed.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "map" && (
            <Suspense fallback={<div className="h-[420px] rounded-2xl border border-white/10 bg-slate-950/60 animate-pulse" />}>
              <HotspotHeatmap />
            </Suspense>
          )}
        </motion.div>

        {/* Emergency footer */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-white font-bold">Need immediate help?</p>
              <p className="text-slate-300 text-sm mt-0.5">
                Crisis line: <span className="font-mono text-rose-400 font-bold">0800 428 428</span> · USSD:{" "}
                <span className="font-mono text-rose-400 font-bold">*123*456#</span> · Police:{" "}
                <span className="font-mono text-rose-400 font-bold">10111</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/auth")}
            className="shrink-0 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl transition-all"
          >
            Access AEGIS Platform
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-600 pb-4">
          All data is anonymised and aggregated. No personally identifiable information is displayed. POPIA compliant. © AEGIS-AI 2026
        </p>
      </div>
    </div>
  );
};

export default ImpactDashboard;
