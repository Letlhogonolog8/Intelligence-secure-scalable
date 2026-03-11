import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  TooltipProps,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, TrendingUp, AlertTriangle, Shield } from "lucide-react";

interface HotspotPoint {
  region: string;
  lat: number;
  lng: number;
  incidents: number;
  riskScore: number;
  trend: "rising" | "stable" | "declining";
  resourceGap: boolean;
}

const DEMO_HOTSPOTS: HotspotPoint[] = [
  { region: "Johannesburg South", lat: -26.27, lng: 28.04, incidents: 142, riskScore: 91, trend: "rising", resourceGap: true },
  { region: "Cape Flats", lat: -34.01, lng: 18.57, incidents: 118, riskScore: 87, trend: "rising", resourceGap: true },
  { region: "Durban North", lat: -29.79, lng: 31.04, incidents: 89, riskScore: 74, trend: "stable", resourceGap: false },
  { region: "Khayelitsha", lat: -34.04, lng: 18.67, incidents: 103, riskScore: 83, trend: "rising", resourceGap: true },
  { region: "Tshwane West", lat: -25.74, lng: 28.18, incidents: 71, riskScore: 65, trend: "declining", resourceGap: false },
  { region: "East London", lat: -33.01, lng: 27.91, incidents: 58, riskScore: 59, trend: "stable", resourceGap: false },
  { region: "Polokwane", lat: -23.9, lng: 29.45, incidents: 47, riskScore: 52, trend: "declining", resourceGap: false },
  { region: "Soweto", lat: -26.27, lng: 27.86, incidents: 96, riskScore: 79, trend: "rising", resourceGap: true },
  { region: "Port Elizabeth North", lat: -33.76, lng: 25.6, incidents: 64, riskScore: 62, trend: "stable", resourceGap: false },
  { region: "Mitchells Plain", lat: -34.05, lng: 18.62, incidents: 81, riskScore: 71, trend: "rising", resourceGap: true },
];

type FilterType = "all" | "critical" | "gap";
type TrendFilter = "all" | "rising" | "stable" | "declining";

const riskColor = (score: number) => {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 50) return "#eab308";
  return "#22c55e";
};

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as HotspotPoint | undefined;
  if (!d) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-4 shadow-2xl min-w-[180px]">
      <p className="text-white font-bold text-sm mb-2">{d.region}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Incidents</span>
          <span className="text-white font-bold">{d.incidents}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Risk Score</span>
          <span style={{ color: riskColor(d.riskScore) }} className="font-bold">{d.riskScore}/100</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Trend</span>
          <span className={`font-bold capitalize ${d.trend === "rising" ? "text-rose-400" : d.trend === "declining" ? "text-emerald-400" : "text-blue-400"}`}>
            {d.trend}
          </span>
        </div>
        {d.resourceGap && (
          <div className="mt-2 pt-2 border-t border-white/5 text-amber-400 font-bold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Resource Gap
          </div>
        )}
      </div>
    </div>
  );
};

interface HotspotHeatmapProps {
  compact?: boolean;
}

const HotspotHeatmap: React.FC<HotspotHeatmapProps> = ({ compact = false }) => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [trendFilter, setTrendFilter] = useState<TrendFilter>("all");

  const filtered = useMemo(() => {
    return DEMO_HOTSPOTS.filter((h) => {
      if (filter === "critical" && h.riskScore < 75) return false;
      if (filter === "gap" && !h.resourceGap) return false;
      if (trendFilter !== "all" && h.trend !== trendFilter) return false;
      return true;
    });
  }, [filter, trendFilter]);

  const stats = useMemo(() => ({
    total: DEMO_HOTSPOTS.reduce((s, h) => s + h.incidents, 0),
    critical: DEMO_HOTSPOTS.filter((h) => h.riskScore >= 80).length,
    gaps: DEMO_HOTSPOTS.filter((h) => h.resourceGap).length,
    rising: DEMO_HOTSPOTS.filter((h) => h.trend === "rising").length,
  }), []);

  return (
    <Card className="border-white/15 bg-slate-950/70 overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-rose-400" />
            <h3 className="text-white font-bold">GBV Incident Hotspot Map</h3>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
              Anonymised
            </span>
          </div>
          {!compact && (
            <div className="flex gap-1 flex-wrap">
              {(["all", "critical", "gap"] as FilterType[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "ghost"}
                  onClick={() => setFilter(f)}
                  className={`h-7 text-[11px] px-3 font-bold capitalize ${filter === f ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {f === "gap" ? "Resource Gap" : f}
                </Button>
              ))}
            </div>
          )}
        </div>

        {!compact && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: "Total Incidents", value: stats.total, color: "text-white" },
              { label: "Critical Zones", value: stats.critical, color: "text-rose-400" },
              { label: "Resource Gaps", value: stats.gaps, color: "text-amber-400" },
              { label: "Rising Trends", value: stats.rising, color: "text-orange-400" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`p-5 ${compact ? "pb-3" : ""}`}>
        {!compact && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {(["all", "rising", "stable", "declining"] as TrendFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTrendFilter(t)}
                className={`text-[10px] px-2 py-1 rounded font-bold uppercase border transition-all ${
                  trendFilter === t
                    ? "bg-white/10 border-white/20 text-white"
                    : "border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                }`}
              >
                {t === "rising" ? "📈 Rising" : t === "declining" ? "📉 Declining" : t === "stable" ? "⚡ Stable" : "All Trends"}
              </button>
            ))}
          </div>
        )}

        <ResponsiveContainer width="100%" height={compact ? 180 : 300}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis
              dataKey="lng"
              type="number"
              domain={[17, 32]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              label={{ value: "Longitude →", fill: "#475569", fontSize: 10, position: "insideBottomRight", offset: -5 }}
            />
            <YAxis
              dataKey="lat"
              type="number"
              domain={[-36, -22]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              label={{ value: "Latitude →", fill: "#475569", fontSize: 10, angle: -90, position: "insideTopLeft", offset: 10 }}
            />
            <ZAxis dataKey="incidents" range={[compact ? 40 : 60, compact ? 200 : 400]} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Scatter data={filtered} fillOpacity={0.75}>
              {filtered.map((entry, index) => (
                <Cell
                  key={index}
                  fill={riskColor(entry.riskScore)}
                  stroke={entry.resourceGap ? "#fbbf24" : "transparent"}
                  strokeWidth={entry.resourceGap ? 2 : 0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            { color: "#ef4444", label: "Critical (80+)" },
            { color: "#f97316", label: "High (65-79)" },
            { color: "#eab308", label: "Medium (50-64)" },
            { color: "#22c55e", label: "Low (<50)" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-slate-400 font-medium">{l.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-400 bg-transparent" />
            <span className="text-[10px] text-slate-400 font-medium">Resource Gap</span>
          </div>
        </div>

        {!compact && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Highest Risk Zones</p>
            {DEMO_HOTSPOTS.filter((h) => h.riskScore >= 75)
              .sort((a, b) => b.riskScore - a.riskScore)
              .slice(0, 3)
              .map((h) => (
                <div key={h.region} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="flex items-center gap-2">
                    {h.resourceGap ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    ) : (
                      <Shield className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-sm text-white font-medium">{h.region}</span>
                    <TrendingUp className={`h-3 w-3 ${h.trend === "rising" ? "text-rose-400" : "text-slate-500"}`} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{h.incidents} cases</span>
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded"
                      style={{ color: riskColor(h.riskScore), background: `${riskColor(h.riskScore)}18` }}
                    >
                      {h.riskScore}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default HotspotHeatmap;
