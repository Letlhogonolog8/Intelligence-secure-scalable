import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  TooltipProps,
} from "recharts";

export type ImpactChartTab = "overview" | "channels";

interface ImpactDashboardChartsProps {
  activeTab: ImpactChartTab;
}

const CHART_PANEL_CLASSNAME = "rounded-2xl border border-white/10 bg-slate-950/60 p-6";
const TOOLTIP_CONTENT_STYLE = {
  background: "#0f172a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#f1f5f9",
} as const;

const MONTHLY_CASES = [
  { month: "Aug", cases: 847, resolved: 721, avgResponse: 28 },
  { month: "Sep", cases: 923, resolved: 804, avgResponse: 24 },
  { month: "Oct", cases: 1041, resolved: 912, avgResponse: 21 },
  { month: "Nov", cases: 1187, resolved: 1043, avgResponse: 18 },
  { month: "Dec", cases: 1294, resolved: 1156, avgResponse: 16 },
  { month: "Jan", cases: 1089, resolved: 978, avgResponse: 17 },
  { month: "Feb", cases: 1342, resolved: 1198, avgResponse: 14 },
];

const CHANNEL_DATA = [
  { name: "Web Portal", value: 41, color: "#6366f1" },
  { name: "USSD (*123*456#)", value: 33, color: "#22c55e" },
  { name: "WhatsApp Bot", value: 19, color: "#f97316" },
  { name: "Voice Report", value: 7, color: "#ec4899" },
];

const formatPercentTooltip = (value: number | string) => [`${value}%`, ""];

const CustomAreaTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-white font-bold mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex justify-between gap-4" style={{ color: item.color }}>
          <span className="capitalize">{item.name}</span>
          <span className="font-bold">{item.value?.toLocaleString?.() ?? item.value}</span>
        </div>
      ))}
    </div>
  );
};

const ImpactDashboardCharts: React.FC<ImpactDashboardChartsProps> = ({ activeTab }) => {
  if (activeTab === "overview") {
    return (
      <div className="space-y-6">
        <div className={CHART_PANEL_CLASSNAME}>
          <h3 className="text-white font-bold mb-1">Monthly Cases & Resolutions</h3>
          <p className="text-xs text-slate-400 mb-5">Anonymised incident volume and resolution rate over 7 months</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={MONTHLY_CASES}>
              <defs>
                <linearGradient id="cases" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="resolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area type="monotone" dataKey="cases" name="Cases" stroke="#6366f1" fill="url(#cases)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" fill="url(#resolved)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={CHART_PANEL_CLASSNAME}>
          <h3 className="text-white font-bold mb-1">Average Response Time (Minutes)</h3>
          <p className="text-xs text-slate-400 mb-5">Time from incident report to first responder assignment</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MONTHLY_CASES}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomAreaTooltip />} />
              <Bar dataKey="avgResponse" name="Minutes" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className={CHART_PANEL_CLASSNAME}>
        <h3 className="text-white font-bold mb-1">Reporting Channel Distribution</h3>
        <p className="text-xs text-slate-400 mb-5">How survivors are accessing AEGIS services</p>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={CHANNEL_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3}>
              {CHANNEL_DATA.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={formatPercentTooltip}
              contentStyle={TOOLTIP_CONTENT_STYLE}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        <h3 className="text-white font-bold">Accessibility Breakdown</h3>
        {CHANNEL_DATA.map((channel) => (
          <div key={channel.name} className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: channel.color }} />
              <div>
                <p className="text-white font-semibold text-sm">{channel.name}</p>
                {channel.name.includes("USSD") && <p className="text-[10px] text-emerald-400 font-bold">Works offline · No smartphone</p>}
                {channel.name.includes("WhatsApp") && <p className="text-[10px] text-orange-400 font-bold">No app install required</p>}
                {channel.name.includes("Voice") && <p className="text-[10px] text-pink-400 font-bold">No literacy required</p>}
              </div>
            </div>
            <span className="text-xl font-black" style={{ color: channel.color }}>{channel.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImpactDashboardCharts;
