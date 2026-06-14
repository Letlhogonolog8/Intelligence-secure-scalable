import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Users,
  Clock,
  MapPin,
  Heart,
  ArrowLeft,
  Globe,
  CheckCircle,
  AlertTriangle,
  Phone,
  RefreshCw,
  Download,
  Printer,
} from "lucide-react";
import { useImpactMetrics, useProvinceMetrics } from "@/hooks/useImpactMetrics";
import {
  buildImpactCsv,
  buildPolicyBrief,
  downloadTextFile,
  impactFilename,
} from "@/lib/impactExport";

const ImpactDashboardCharts = lazy(
  () => import("@/components/analytics/ImpactDashboardCharts"),
);
const HotspotHeatmap = lazy(
  () => import("@/components/analytics/HotspotHeatmap"),
);

function formatNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

const ImpactDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "overview" | "channels" | "regions" | "map"
  >("overview");

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch,
    dataUpdatedAt,
  } = useImpactMetrics();
  const { data: provinceData, isLoading: provinceLoading } =
    useProvinceMetrics();

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const outcomes = metrics
    ? [
        {
          label: "Cases Resolved",
          value: formatNumber(metrics.casesResolved),
          icon: CheckCircle,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
        },
        {
          label: "Avg. Response Time",
          value: `${metrics.avgResponseMinutes} min`,
          icon: Clock,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
          border: "border-blue-500/20",
        },
        {
          label: "Survivors Supported",
          value: formatNumber(metrics.survivorsSupported),
          icon: Heart,
          color: "text-rose-400",
          bg: "bg-rose-500/10",
          border: "border-rose-500/20",
        },
        {
          label: "Resources Connected",
          value: formatNumber(metrics.resourcesConnected),
          icon: Users,
          color: "text-purple-400",
          bg: "bg-purple-500/10",
          border: "border-purple-500/20",
        },
        {
          label: "Provinces Active",
          value: `${metrics.provincesActive} / 9`,
          icon: MapPin,
          color: "text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
        },
        {
          label: "Countries",
          value: String(metrics.countriesActive),
          icon: Globe,
          color: "text-cyan-400",
          bg: "bg-cyan-500/10",
          border: "border-cyan-500/20",
        },
      ]
    : [];

  const displayProvinces = provinceData ?? [];

  const exportCsv = () => {
    if (!metrics) return;
    downloadTextFile(
      impactFilename("csv"),
      buildImpactCsv(metrics, displayProvinces),
      "text/csv;charset=utf-8",
    );
  };

  const exportBrief = () => {
    if (!metrics) return;
    downloadTextFile(
      impactFilename("txt"),
      buildPolicyBrief(metrics, displayProvinces),
    );
  };

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[40%] h-[30%] bg-blue-600/8 blur-[160px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[40%] h-[30%] bg-rose-600/8 blur-[160px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                    AEGIS-AI · Public Impact Report
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Data anonymised · Live
                    {updatedLabel ? ` · Updated ${updatedLabel}` : ""} · POPIA
                    compliant
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCsv}
                  disabled={!metrics}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-40"
                  title="Download anonymised impact data as CSV"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </button>
                <button
                  onClick={exportBrief}
                  disabled={!metrics}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-40"
                  title="Download a plain-text policy brief"
                >
                  <Download className="h-3 w-3" />
                  Brief
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
                  title="Print or save as PDF"
                >
                  <Printer className="h-3 w-3" />
                  Print
                </button>
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              Measuring Real-World Impact
            </h1>
            <p className="text-lg text-slate-300 mt-2 max-w-2xl">
              Transparent, anonymised statistics on how AEGIS-AI is coordinating
              GBV emergency response across Southern Africa.
            </p>
          </motion.div>
        </div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {metricsLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl border border-white/10 bg-slate-950/60 animate-pulse h-24"
                />
              ))
            : outcomes.map((item) => (
                <div
                  key={item.label}
                  className={`p-5 rounded-2xl border ${item.border} ${item.bg} flex items-start gap-4`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center shrink-0`}
                  >
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-black ${item.color}`}>
                      {item.value}
                    </p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
        </motion.div>

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

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {(activeTab === "overview" || activeTab === "channels") && (
            <Suspense
              fallback={
                <div className="h-[320px] rounded-2xl border border-white/10 bg-slate-950/60 animate-pulse" />
              }
            >
              <ImpactDashboardCharts activeTab={activeTab} />
            </Suspense>
          )}

          {activeTab === "regions" && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <h3 className="text-white font-bold mb-1">Provincial Coverage</h3>
              <p className="text-xs text-slate-400 mb-6">
                Active cases and service coverage rate by province
              </p>
              {provinceLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-8 rounded-lg bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayProvinces.map((p) => (
                    <div key={p.province} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-white font-semibold">
                            {p.province}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400 text-xs">
                            {p.cases.toLocaleString()} cases
                          </span>
                          <span
                            className={`text-xs font-bold ${p.coverage >= 80 ? "text-emerald-400" : p.coverage >= 65 ? "text-amber-400" : "text-rose-400"}`}
                          >
                            {p.coverage}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${p.coverage}%`,
                            background:
                              p.coverage >= 80
                                ? "#22c55e"
                                : p.coverage >= 65
                                  ? "#eab308"
                                  : "#ef4444",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-300 font-bold text-xs">
                    Coverage Gaps Detected
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Limpopo and North West provinces show coverage below 70%.
                    Additional shelter and counselor resources are being
                    deployed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "map" && (
            <Suspense
              fallback={
                <div className="h-[420px] rounded-2xl border border-white/10 bg-slate-950/60 animate-pulse" />
              }
            >
              <HotspotHeatmap />
            </Suspense>
          )}
        </motion.div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-white font-bold">Need immediate help?</p>
              <p className="text-slate-300 text-sm mt-0.5">
                Crisis line:{" "}
                <span className="font-mono text-rose-400 font-bold">
                  0800 428 428
                </span>{" "}
                · USSD:{" "}
                <span className="font-mono text-rose-400 font-bold">
                  *135*1782#
                </span>{" "}
                · Police:{" "}
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
          All data is anonymised and aggregated. No personally identifiable
          information is displayed. POPIA compliant. © AEGIS-AI 2026
        </p>
      </main>
    </div>
  );
};

export default ImpactDashboard;
