/**
 * AEGIS-AI Data Analyst Portal — faithful build of the approved mock-up.
 *
 * Presentation/sample data lives in `MOCK_*` constants so each seam can be
 * wired to a live AEGIS data source later without touching the layout.
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  GitBranch,
  Globe,
  HelpCircle,
  Home,
  LayoutGrid,
  LogOut,
  MapPin,
  Maximize2,
  MoreHorizontal,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import WorldRiskMap, {
  type MapRegion,
} from "@/components/analyst/WorldRiskMap";
import {
  useAnomalyAlerts,
  useAuditLogs,
  useIncidentTimeSeries,
  useRegions,
  useSystemMetrics,
  useUserProfile,
} from "@/data/aegisData";
import {
  freshnessLabel,
  saveAnalystSettings,
  useAnalystReports,
  useAnalystSettings,
  useCaseCategories,
  useDataQualityAlerts,
  useDatasetCatalog,
  useForecastMetrics,
  useForecastScenarios,
  useForecastVariables,
  useHotspotEmergence,
  useIncidentAgeGroups,
  useReportingChannels,
} from "@/data/analyticsData";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_DEFINITIONS, type UserRole } from "@/lib/roleConfig";
import { ALLOW_MOCK, NO_DATA, sample } from "@/lib/mockData";
import { toast } from "sonner";

const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

const nf = new Intl.NumberFormat("en-US");
/** Use live rows when present, otherwise the mock-up sample so the UI never blanks. */
const live = <T,>(rows: T[] | undefined, fallback: T[]) =>
  rows && rows.length ? rows : sample(fallback);
const fmtTime = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime())
    ? t
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const fmtDateTime = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString();
};
const riskLabel = (l: string) =>
  l === "critical" ? "Extreme" : l.charAt(0).toUpperCase() + l.slice(1);

type SectionKey =
  | "overview"
  | "analytics"
  | "hotspots"
  | "forecasting"
  | "reports"
  | "datasets"
  | "settings";

/* ============================ MOCK / SAMPLE DATA ============================ */

const MOCK_USER = { name: "Naledi M.", role: "Data Analyst" };

const MOCK_OVERVIEW_KPIS = [
  {
    label: "Active Cases",
    value: "8,742",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.4%" },
  },
  {
    label: "New Reports",
    value: "1,326",
    icon: FileText,
    tone: "sky",
    delta: { dir: "up", text: "18.7%" },
  },
  {
    label: "High-Risk Cases",
    value: "452",
    icon: ShieldAlert,
    tone: "rose",
    delta: { dir: "up", text: "9.8%" },
  },
  {
    label: "Countries / Regions",
    value: "23",
    suffix: "of 26",
    icon: Globe,
    tone: "cyan",
    note: "88% coverage",
  },
  {
    label: "AI Risk Alerts",
    value: "167",
    icon: AlertTriangle,
    tone: "amber",
    delta: { dir: "up", text: "14.1%" },
  },
  {
    label: "Resolution Trend",
    value: "68%",
    icon: TrendingUp,
    tone: "emerald",
    delta: { dir: "up", text: "6.3 pp" },
  },
] as const;

const MOCK_TRENDS = [
  { d: "Mar 10", total: 920, high: 230, resolved: 560 },
  { d: "Mar 24", total: 1080, high: 250, resolved: 640 },
  { d: "Apr 7", total: 1180, high: 280, resolved: 720 },
  { d: "Apr 21", total: 1240, high: 300, resolved: 800 },
  { d: "May 5", total: 1480, high: 340, resolved: 880 },
  { d: "May 19", total: 1560, high: 360, resolved: 980 },
  { d: "Jun 2", total: 1620, high: 400, resolved: 1080 },
  { d: "Jun 16", total: 1700, high: 430, resolved: 1180 },
  { d: "Jun 30", total: 1760, high: 470, resolved: 1260 },
];

const MOCK_AFRICA_MAP: MapRegion[] = [
  {
    id: "drc",
    name: "Goma",
    country: "DR Congo",
    riskLevel: "critical",
    incidents: 632,
    lat: -1.68,
    lng: 29.22,
  },
  {
    id: "som",
    name: "Mogadishu",
    country: "Somalia",
    riskLevel: "high",
    incidents: 486,
    lat: 2.04,
    lng: 45.34,
  },
  {
    id: "nga",
    name: "Maiduguri",
    country: "Nigeria",
    riskLevel: "high",
    incidents: 389,
    lat: 11.85,
    lng: 13.16,
  },
  {
    id: "eth",
    name: "Addis Ababa",
    country: "Ethiopia",
    riskLevel: "medium",
    incidents: 210,
    lat: 9.03,
    lng: 38.74,
  },
  {
    id: "mli",
    name: "Bamako",
    country: "Mali",
    riskLevel: "high",
    incidents: 298,
    lat: 12.64,
    lng: -8.0,
  },
  {
    id: "ssd",
    name: "Juba",
    country: "South Sudan",
    riskLevel: "high",
    incidents: 256,
    lat: 4.85,
    lng: 31.58,
  },
  {
    id: "moz",
    name: "Pemba",
    country: "Mozambique",
    riskLevel: "medium",
    incidents: 178,
    lat: -12.97,
    lng: 40.52,
  },
  {
    id: "sa",
    name: "Johannesburg",
    country: "South Africa",
    riskLevel: "medium",
    incidents: 142,
    lat: -26.2,
    lng: 28.04,
  },
  {
    id: "uga",
    name: "Gulu",
    country: "Uganda",
    riskLevel: "medium",
    incidents: 188,
    lat: 2.77,
    lng: 32.3,
  },
];

const MOCK_CASE_CATEGORIES = [
  {
    name: "Intimate Partner Violence",
    value: 3102,
    pct: "35.5%",
    color: "#a855f7",
  },
  { name: "Sexual Violence", value: 2287, pct: "26.2%", color: "#3b82f6" },
  { name: "Physical Assault", value: 1542, pct: "17.6%", color: "#06b6d4" },
  { name: "Psychological Abuse", value: 1086, pct: "12.4%", color: "#8b5cf6" },
  { name: "Economic Abuse", value: 725, pct: "8.3%", color: "#f59e0b" },
];

const MOCK_AGE_GROUPS = [
  { name: "0-17", value: 1142 },
  { name: "18-24", value: 2316 },
  { name: "25-34", value: 2684 },
  { name: "35-44", value: 1876 },
  { name: "45-54", value: 1021 },
  { name: "55+", value: 623 },
];

const MOCK_AI_INSIGHTS = [
  {
    icon: Brain,
    text: "Neural risk model detected a 23% increase in high-risk cases in Eastern DRC and northern Mozambique.",
    link: "View hotspot details",
  },
  {
    icon: Shield,
    text: "Weekend reporting spikes suggest limited weekend support access in 6 regions.",
    link: "See temporal patterns",
  },
  {
    icon: FileText,
    text: "Economic abuse underreporting likely in West Africa based on anomaly detection.",
    link: "View data quality insights",
  },
];

const MOCK_RECENT_ACTIVITY = [
  {
    icon: FileText,
    tone: "violet",
    title: "Report generated: GBV Monthly Dashboard – May 2024",
    by: "by Naledi M.",
    time: "10:24 AM",
  },
  {
    icon: Database,
    tone: "sky",
    title: "Dataset updated: Incident Reports – East Africa",
    by: "by System",
    time: "09:41 AM",
  },
  {
    icon: AlertTriangle,
    tone: "amber",
    title: "AI Alert: Spike in high-risk cases detected in Kivu, DRC",
    by: "by AEGIS-AI",
    time: "08:15 AM",
  },
  {
    icon: Download,
    tone: "emerald",
    title: "Dataset exported: Case Management Data (CSV)",
    by: "by Naledi M.",
    time: "Yesterday",
  },
];

const MOCK_OVERVIEW_ACTIONS = [
  {
    label: "View Hotspots",
    desc: "Explore real-time hotspot map",
    icon: MapPin,
    tone: "violet",
  },
  {
    label: "Generate Report",
    desc: "Create custom analytics report",
    icon: FileText,
    tone: "sky",
  },
  {
    label: "Export CSV",
    desc: "Export data for external use",
    icon: Download,
    tone: "cyan",
  },
  {
    label: "Run Forecast",
    desc: "Predict trends & risks",
    icon: BarChart3,
    tone: "amber",
  },
  {
    label: "Open Datasets",
    desc: "Browse available datasets",
    icon: Database,
    tone: "emerald",
  },
];

const MOCK_ANALYTICS_KPIS = [
  {
    label: "Total Incidents",
    value: "8,742",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.4%" },
  },
  {
    label: "High-Risk Incidents",
    value: "1,326",
    icon: ShieldAlert,
    tone: "rose",
    delta: { dir: "up", text: "18.7%" },
  },
  {
    label: "Avg Response Time",
    value: "6.2 hrs",
    icon: Clock,
    tone: "cyan",
    delta: { dir: "down", text: "8.3%" },
  },
  {
    label: "Reopened Cases",
    value: "412",
    icon: RefreshCw,
    tone: "amber",
    delta: { dir: "down", text: "5.6%" },
  },
  {
    label: "Regional Coverage",
    value: "23",
    suffix: "of 26",
    icon: Globe,
    tone: "sky",
    note: "88% coverage",
  },
] as const;

const MOCK_CATEGORY_VOLUME = [
  { name: "Intimate Partner Violence", value: 3102 },
  { name: "Sexual Violence", value: 2287 },
  { name: "Physical Assault", value: 1542 },
  { name: "Psychological Abuse", value: 1085 },
  { name: "Economic Abuse", value: 725 },
  { name: "Neglect & Abandonment", value: 381 },
  { name: "Other", value: 120 },
];

const MOCK_ANOMALIES = [
  {
    text: "Spike in high-risk cases detected in",
    bold: "Goma, DRC",
    note: "+42% vs last 7 days",
    time: "10:24 AM",
  },
  {
    text: "Unusual increase in sexual violence cases reported via Hotline",
    bold: "",
    note: "+28% vs last 7 days",
    time: "09:41 AM",
  },
  {
    text: "Low response rate in West Africa region (below 70% target)",
    bold: "",
    note: "68% current rate",
    time: "08:15 AM",
  },
];

const MOCK_CHANNELS = [
  { name: "Hotline", value: 3667, pct: 42, color: "#a855f7" },
  { name: "Mobile App", value: 2094, pct: 24, color: "#06b6d4" },
  { name: "In-Person", value: 1396, pct: 16, color: "#ec4899" },
  { name: "Web Portal", value: 872, pct: 10, color: "#f59e0b" },
  { name: "Community Report", value: 523, pct: 6, color: "#10b981" },
  { name: "Other", value: 190, pct: 2, color: "#64748b" },
];

const MOCK_TOP_CATEGORIES = [
  {
    name: "Intimate Partner Violence",
    incidents: "3,102",
    pct: "35.5%",
    trend: "14.1%",
    dir: "up",
  },
  {
    name: "Sexual Violence",
    incidents: "2,237",
    pct: "25.6%",
    trend: "11.3%",
    dir: "up",
  },
  {
    name: "Physical Assault",
    incidents: "1,542",
    pct: "17.6%",
    trend: "9.7%",
    dir: "up",
  },
  {
    name: "Psychological Abuse",
    incidents: "1,085",
    pct: "12.4%",
    trend: "7.6%",
    dir: "up",
  },
  {
    name: "Economic Abuse",
    incidents: "725",
    pct: "8.3%",
    trend: "5.2%",
    dir: "up",
  },
  {
    name: "Neglect & Abandonment",
    incidents: "381",
    pct: "4.4%",
    trend: "1.8%",
    dir: "down",
  },
  { name: "Other", incidents: "120", pct: "1.4%", trend: "2.2%", dir: "up" },
];

const MOCK_INSIGHT_NOTES = [
  {
    icon: Brain,
    text: "AI model detected a 23% increase in high-risk cases in Eastern DRC and northern Mozambique.",
    link: "View hotspot details",
  },
  {
    icon: Shield,
    text: "Weekend reporting spikes suggest limited weekend support access in 6 regions.",
    link: "See temporal patterns",
  },
  {
    icon: BarChart3,
    text: "Economic abuse underreporting likely in West Africa based on anomaly detection.",
    link: "View data quality insights",
  },
];

const MOCK_HOTSPOT_KPIS = [
  {
    label: "Hotspot Regions",
    value: "42",
    icon: MapPin,
    tone: "violet",
    delta: { dir: "up", text: "16.7%" },
  },
  {
    label: "Critical Hotspots",
    value: "12",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "up", text: "20.0%" },
  },
  {
    label: "Early-Warning Alerts",
    value: "28",
    icon: Bell,
    tone: "amber",
    delta: { dir: "up", text: "33.3%" },
  },
  {
    label: "Affected Communities",
    value: "1.84M",
    icon: Users,
    tone: "cyan",
    delta: { dir: "up", text: "14.9%" },
  },
  {
    label: "Coverage",
    value: "68%",
    icon: Radar,
    tone: "emerald",
    delta: { dir: "up", text: "6.2 pp" },
  },
] as const;

const MOCK_TOP_CITIES = [
  {
    rank: 1,
    city: "Goma",
    country: "DRC",
    risk: "Extreme",
    trend: "28%",
    incidents: "632",
  },
  {
    rank: 2,
    city: "Port-au-Prince",
    country: "Haiti",
    risk: "Extreme",
    trend: "22%",
    incidents: "518",
  },
  {
    rank: 3,
    city: "Mogadishu",
    country: "Somalia",
    risk: "High",
    trend: "18%",
    incidents: "486",
  },
  {
    rank: 4,
    city: "Beni",
    country: "DRC",
    risk: "High",
    trend: "15%",
    incidents: "412",
  },
  {
    rank: 5,
    city: "Maiduguri",
    country: "Nigeria",
    risk: "High",
    trend: "12%",
    incidents: "389",
  },
];

const MOCK_SEVERITY = [
  { name: "Extreme", value: 12, pct: "28.6%", color: "#f43f5e" },
  { name: "High", value: 14, pct: "33.3%", color: "#f97316" },
  { name: "Medium", value: 9, pct: "21.4%", color: "#a855f7" },
  { name: "Low", value: 5, pct: "11.9%", color: "#3b82f6" },
  { name: "Minimal", value: 2, pct: "4.8%", color: "#06b6d4" },
];

const MOCK_EMERGENCE = Array.from({ length: 13 }, (_, i) => ({
  d: `W${i + 1}`,
  newH: 22 + Math.round(Math.sin(i / 2) * 6) + i,
  esc: 14 + Math.round(Math.cos(i / 2) * 3),
  deesc: 8 + Math.round(Math.sin(i / 3) * 2),
}));

const MOCK_HOTSPOT_RECS = [
  {
    icon: Shield,
    text: "Increase response resources in Goma, DRC due to rapid escalation in GBV incidents.",
    tag: "High Priority",
  },
  {
    icon: AlertTriangle,
    text: "Monitor Maiduguri, Nigeria for potential escalation based on early-warning signals.",
    tag: "Medium Priority",
  },
  {
    icon: Users,
    text: "Strengthen community support services in Port-au-Prince, Haiti.",
    tag: "High Priority",
  },
];

const MOCK_FORECAST_KPIS = [
  {
    label: "Forecast Accuracy",
    value: "87%",
    icon: Target,
    tone: "violet",
    delta: { dir: "up", text: "6%" },
  },
  {
    label: "Expected Case Growth",
    value: "+18.7%",
    icon: TrendingUp,
    tone: "sky",
    note: "vs next 30 days",
  },
  {
    label: "High-Risk Regions Forecasted",
    value: "23",
    icon: ShieldAlert,
    tone: "rose",
    delta: { dir: "up", text: "3" },
  },
  {
    label: "Projected Support Demand",
    value: "12,640",
    icon: Users,
    tone: "cyan",
    delta: { dir: "up", text: "15.2%" },
  },
  {
    label: "Model Confidence",
    value: "82%",
    icon: Cpu,
    tone: "amber",
    note: "High",
  },
] as const;

const MOCK_FORECAST = [
  { d: "Jan 24", hist: 920, fc: null, up: null, low: null },
  { d: "Feb 24", hist: 1080, fc: null, up: null, low: null },
  { d: "Mar 24", hist: 1240, fc: null, up: null, low: null },
  { d: "Apr 24", hist: 1560, fc: null, up: null, low: null },
  { d: "May 24", hist: 1760, fc: 1760, up: 1760, low: 1760 },
  { d: "Jun 24", hist: null, fc: 1820, up: 1980, low: 1660 },
  { d: "Jul 24", hist: null, fc: 1900, up: 2120, low: 1700 },
  { d: "Aug 24", hist: null, fc: 1980, up: 2260, low: 1720 },
  { d: "Sep 24", hist: null, fc: 2040, up: 2360, low: 1740 },
  { d: "Oct 24", hist: null, fc: 2080, up: 2440, low: 1760 },
  { d: "Nov 24", hist: null, fc: 2120, up: 2520, low: 1780 },
  { d: "Dec 24", hist: null, fc: 2160, up: 2600, low: 1800 },
];

const MOCK_MODEL_VARS = [
  { name: "Weekend / Holiday Indicator", impact: "High" },
  { name: "Economic Hardship Index", impact: "High" },
  { name: "Previous 4-Week Incidents", impact: "High" },
  { name: "School Term Calendar", impact: "Medium" },
  { name: "Sexual Violence Reports", impact: "Medium" },
  { name: "Weather Extremes", impact: "Low" },
];

const MOCK_SCENARIOS = [
  {
    name: "Baseline (Current Trend)",
    cases: "2,150",
    change: "—",
    conf: 82,
    color: "#a855f7",
  },
  {
    name: "Improved Response Capacity",
    cases: "1,720",
    change: "-20.0%",
    conf: 78,
    color: "#06b6d4",
  },
  {
    name: "Increased Community Outreach",
    cases: "1,810",
    change: "-15.8%",
    conf: 76,
    color: "#10b981",
  },
  {
    name: "Deteriorating Conditions",
    cases: "2,720",
    change: "+26.5%",
    conf: 75,
    color: "#f43f5e",
  },
];

const MOCK_REGION_PRIORITY = [
  { rank: 1, region: "Kivu, DRC", risk: "High", cases: "342", change: "32%" },
  {
    rank: 2,
    region: "Lindi, Tanzania",
    risk: "High",
    cases: "298",
    change: "28%",
  },
  {
    rank: 3,
    region: "Unity, South Sudan",
    risk: "High",
    cases: "256",
    change: "25%",
  },
  {
    rank: 4,
    region: "Northern Uganda",
    risk: "Elevated",
    cases: "214",
    change: "18%",
  },
  {
    rank: 5,
    region: "Mogadishu, Somalia",
    risk: "Elevated",
    cases: "189",
    change: "16%",
  },
];

const MOCK_FORECAST_RECS = [
  {
    icon: Users,
    title: "Increase counselor capacity",
    desc: "Projected caseload exceeds current capacity in 8 regions. Recommended: +15% counselor coverage.",
    tag: "High Impact",
  },
  {
    icon: Home,
    title: "Prepare shelter referrals",
    desc: "Shelter demand expected to rise by 19%. Pre-position supplies and strengthen referral partners.",
    tag: "High Impact",
  },
  {
    icon: Calendar,
    title: "Monitor weekend surge",
    desc: "Weekend-related incidents likely to spike. Enhance weekend support and patrol presence.",
    tag: "Medium Impact",
  },
];

const MOCK_REPORT_KPIS = [
  {
    label: "Reports Generated",
    value: "642",
    icon: FileText,
    tone: "violet",
    delta: { dir: "up", text: "18.6%" },
  },
  {
    label: "Scheduled Reports",
    value: "38",
    icon: Calendar,
    tone: "sky",
    delta: { dir: "up", text: "15.3%" },
  },
  {
    label: "Exports This Month",
    value: "1,254",
    icon: Download,
    tone: "cyan",
    delta: { dir: "up", text: "22.7%" },
  },
  {
    label: "Stakeholders Reached",
    value: "4,892",
    icon: Users,
    tone: "emerald",
    delta: { dir: "up", text: "31.2%" },
  },
  {
    label: "Report Templates",
    value: "24",
    icon: LayoutGrid,
    tone: "amber",
    delta: { dir: "up", text: "9.1%" },
  },
] as const;

const MOCK_REPORT_LIBRARY = [
  {
    name: "GBV Incident Report – May 2024",
    type: "Incident Report",
    region: "East Africa",
    status: "Completed",
    owner: "Naledi M.",
    updated: "May 10, 2024 10:24 AM",
  },
  {
    name: "High-Risk Hotspots – April 2024",
    type: "Hotspot Report",
    region: "West Africa",
    status: "Completed",
    owner: "James K.",
    updated: "May 9, 2024 04:18 PM",
  },
  {
    name: "GBV Risk Forecast – Q2 2024",
    type: "Forecast Report",
    region: "Multi-Region",
    status: "In Progress",
    owner: "Amina H.",
    updated: "May 9, 2024 09:02 AM",
  },
  {
    name: "Executive Summary – April 2024",
    type: "Executive Summary",
    region: "Southern Africa",
    status: "Completed",
    owner: "Naledi M.",
    updated: "May 8, 2024 03:41 PM",
  },
  {
    name: "NGO/Police Briefing – Kinshasa",
    type: "NGO/Police Briefing",
    region: "DRC",
    status: "Completed",
    owner: "Patrick L.",
    updated: "May 8, 2024 11:21 AM",
  },
];

const MOCK_REPORT_CATEGORIES = [
  {
    name: "Incident Reports",
    desc: "Detailed analysis of GBV incidents, trends, and case data.",
    icon: FileText,
    tone: "violet",
  },
  {
    name: "Hotspot Reports",
    desc: "High-risk areas, case density, and trend analysis.",
    icon: MapPin,
    tone: "sky",
  },
  {
    name: "Forecast Reports",
    desc: "Predictive risk models and scenario projections.",
    icon: BarChart3,
    tone: "emerald",
  },
  {
    name: "Executive Summaries",
    desc: "High-level insights for decision-makers and leadership.",
    icon: FileText,
    tone: "amber",
  },
  {
    name: "NGO/Police Briefings",
    desc: "Operational updates and actionable recommendations.",
    icon: Users,
    tone: "violet",
  },
];

const MOCK_SCHEDULED = [
  {
    name: "GBV Incident Report",
    freq: "Weekly",
    next: "May 13, 2024",
    recipients: 12,
  },
  {
    name: "High-Risk Hotspots",
    freq: "Weekly",
    next: "May 13, 2024",
    recipients: 18,
  },
  {
    name: "GBV Risk Forecast",
    freq: "Monthly",
    next: "May 31, 2024",
    recipients: 15,
  },
  {
    name: "Executive Summary",
    freq: "Monthly",
    next: "May 31, 2024",
    recipients: 22,
  },
  {
    name: "NGO/Police Briefing",
    freq: "Bi-Weekly",
    next: "May 15, 2024",
    recipients: 10,
  },
];

const MOCK_DATASET_KPIS = [
  {
    label: "Connected Datasets",
    value: "26",
    icon: Database,
    tone: "violet",
    delta: { dir: "up", text: "3" },
  },
  {
    label: "Last Sync Time",
    value: "10:24 AM",
    icon: Clock,
    tone: "sky",
    note: "May 20, 2024",
  },
  {
    label: "Data Quality Score",
    value: "92%",
    icon: ShieldCheck,
    tone: "emerald",
    delta: { dir: "up", text: "4%" },
  },
  {
    label: "Active Pipelines",
    value: "18",
    icon: GitBranch,
    tone: "cyan",
    delta: { dir: "up", text: "2" },
  },
  {
    label: "Flagged Issues",
    value: "7",
    icon: AlertTriangle,
    tone: "amber",
    delta: { dir: "down", text: "3" },
  },
] as const;

const MOCK_DATASETS = [
  {
    name: "Incident Reports",
    desc: "GBV incidents and survivor reports",
    source: "Case Management System",
    records: "128,742",
    fresh: "10 min ago",
    quality: 95,
    ok: true,
  },
  {
    name: "Shelter Referrals",
    desc: "Shelter intake and referral data",
    source: "Shelter Management System",
    records: "45,316",
    fresh: "25 min ago",
    quality: 91,
    ok: true,
  },
  {
    name: "Counseling Sessions",
    desc: "Psychosocial support sessions",
    source: "MHPSS Platform",
    records: "67,892",
    fresh: "35 min ago",
    quality: 93,
    ok: true,
  },
  {
    name: "Police Intake",
    desc: "Police reports and intake data",
    source: "Police MIS",
    records: "33,417",
    fresh: "1 hr ago",
    quality: 86,
    ok: false,
  },
  {
    name: "Community Reports",
    desc: "Community feedback and alerts",
    source: "Community Reporting App",
    records: "21,903",
    fresh: "2 hr ago",
    quality: 78,
    ok: false,
  },
  {
    name: "Hotline Data",
    desc: "Helpline calls and case logs",
    source: "Hotline System",
    records: "58,884",
    fresh: "3 hr ago",
    quality: 88,
    ok: false,
  },
];

const MOCK_REFRESH = [
  { name: "Incident Reports", status: "On schedule", ok: true },
  { name: "Shelter Referrals", status: "On schedule", ok: true },
  { name: "Counseling Sessions", status: "On schedule", ok: true },
  { name: "Police Intake", status: "Delayed", ok: false },
  { name: "Community Reports", status: "On schedule", ok: true },
];

const MOCK_CONNECTORS = [
  { name: "Case Management System", status: "Connected" },
  { name: "Shelter Management System", status: "Connected" },
  { name: "MHPSS Platform", status: "Connected" },
  { name: "Police MIS", status: "Connected" },
  { name: "Community Reporting App", status: "Connected" },
  { name: "Hotline System", status: "Connected" },
];

const MOCK_SCHEMA = [
  { name: "Incident Reports", status: "Up to date", ok: true },
  { name: "Shelter Referrals", status: "Up to date", ok: true },
  { name: "Counseling Sessions", status: "Up to date", ok: true },
  { name: "Police Intake", status: "Schema change", ok: false },
  { name: "Community Reports", status: "Up to date", ok: true },
  { name: "Hotline Data", status: "Up to date", ok: true },
];

const MOCK_DQ_ALERTS = [
  {
    name: "Police Intake",
    desc: "Missing values in 3 critical fields",
    sev: "High",
  },
  {
    name: "Community Reports",
    desc: "Duplicate records detected",
    sev: "Medium",
  },
  {
    name: "Hotline Data",
    desc: "Old records exceeding freshness SLA",
    sev: "Medium",
  },
  {
    name: "Shelter Referrals",
    desc: "Invalid referral outcome codes",
    sev: "Low",
  },
];

const MOCK_KEY_SOURCES = [
  {
    name: "Incident Reports",
    records: "128,742 records",
    sync: "10 min ago",
    color: "#a855f7",
  },
  {
    name: "Shelter Referrals",
    records: "45,316 records",
    sync: "25 min ago",
    color: "#06b6d4",
  },
  {
    name: "Counseling Sessions",
    records: "67,892 records",
    sync: "35 min ago",
    color: "#8b5cf6",
  },
  {
    name: "Police Intake",
    records: "33,417 records",
    sync: "1 hr ago",
    color: "#3b82f6",
  },
  {
    name: "Community Reports",
    records: "21,903 records",
    sync: "2 hr ago",
    color: "#10b981",
  },
  {
    name: "Hotline Data",
    records: "58,884 records",
    sync: "3 hr ago",
    color: "#a855f7",
  },
];

const spark = () =>
  Array.from({ length: 12 }, (_, i) => ({
    v: 30 + Math.round(Math.sin(i / 1.5) * 12 + Math.random() * 8),
  }));

/* ============================ NAV / META ============================ */

const SECTION_META: Record<
  SectionKey,
  { title: string; subtitle: string; greeting?: boolean }
> = {
  overview: {
    title: "Welcome, Naledi M.",
    subtitle:
      "Evidence-driven intelligence for survivor protection and policy action.",
    greeting: true,
  },
  analytics: {
    title: "Incident Analytics",
    subtitle:
      "Deep-dive analysis of case trends, risk signals, and category performance.",
  },
  hotspots: {
    title: "Hotspot Intelligence",
    subtitle: "Geographic patterns, emerging clusters, and risk concentration.",
  },
  forecasting: {
    title: "Forecasting",
    subtitle:
      "Predictive analytics for risk escalation, demand, and intervention planning.",
  },
  reports: {
    title: "Reports",
    subtitle: "Generate, schedule, export, and review intelligence reports.",
  },
  datasets: {
    title: "Datasets",
    subtitle: "Manage data sources, refresh schedules, and data quality.",
  },
  settings: {
    title: "Settings",
    subtitle:
      "Configure analytics preferences, alerts, exports, and AI behavior.",
  },
};

const NAV: {
  key: SectionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "analytics", label: "Incident Analytics", icon: TrendingUp },
  { key: "hotspots", label: "Hotspot Intelligence", icon: Radar },
  { key: "forecasting", label: "Forecasting", icon: Activity },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "datasets", label: "Datasets", icon: Database },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

/* ============================ UI HELPERS ============================ */

const ICON_TONES: Record<string, string> = {
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
};
const PILL_TONES: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  slate: "border-white/15 bg-white/[0.06] text-slate-300",
};
const riskTone = (s: string) => {
  const v = s.toLowerCase();
  if (["extreme", "high"].includes(v))
    return v === "extreme" ? "rose" : "amber";
  if (["elevated", "medium"].includes(v))
    return v === "elevated" ? "amber" : "violet";
  if (["completed", "connected", "up to date", "on schedule"].includes(v))
    return "emerald";
  if (["in progress", "delayed", "schema change"].includes(v)) return "amber";
  return "sky";
};

const Pill = ({ tone, children }: { tone: string; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
      PILL_TONES[tone] ?? PILL_TONES.slate,
    )}
  >
    {children}
  </span>
);
const Delta = ({
  dir,
  text,
  sub,
}: {
  dir: string;
  text: string;
  sub?: string;
}) => (
  <p className="mt-0.5 text-[11px]">
    <span
      className={cn(
        "font-bold",
        dir === "up" ? "text-emerald-400" : "text-emerald-400",
      )}
    >
      {dir === "up" ? "↑" : "↓"} {text}
    </span>{" "}
    <span className="text-slate-500">{sub ?? "vs last 30 days"}</span>
  </p>
);
const Panel = ({
  title,
  info,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  info?: boolean;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md",
      className,
    )}
  >
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-1.5">
          {title && (
            <h2 className="text-sm font-black tracking-tight text-white">
              {title}
            </h2>
          )}
          {info && (
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-white/15 text-[8px] font-black text-slate-500">
              i
            </span>
          )}
        </div>
        {action}
      </div>
    )}
    <div className={cn("p-5", bodyClassName)}>{children}</div>
  </div>
);
const KpiCard = ({
  label,
  value,
  suffix,
  icon: Icon,
  tone,
  delta,
  note,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  delta?: { dir: string; text: string };
  note?: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-md">
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2",
          ICON_TONES[tone] ?? ICON_TONES.violet,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black text-white">
          {value}{" "}
          {suffix && (
            <span className="text-sm font-medium text-slate-500">{suffix}</span>
          )}
        </p>
        {delta ? (
          <Delta dir={delta.dir} text={delta.text} />
        ) : note ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>
        ) : null}
      </div>
    </div>
  </div>
);
const Donut = ({
  data,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) => (
  <div className="relative">
    <ResponsiveContainer width="100%" height={190}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={84}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#0b1220",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#e2e8f0",
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-xl font-black text-white">{centerValue}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {centerLabel}
      </span>
    </div>
  </div>
);
const tableHead =
  "border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500";
const chartTooltip = {
  contentStyle: {
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 12,
  },
} as const;
const SelectChip = ({ label }: { label: string }) => (
  <button
    type="button"
    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
  >
    {label}
    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
  </button>
);
const LinkChip = ({ label }: { label: string }) => (
  <button
    type="button"
    className="flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300"
  >
    {label}
    <ChevronRight className="h-3 w-3" />
  </button>
);
const Pagination = ({ pages = ["1"] }: { pages?: string[] }) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-500 hover:bg-white/5"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
    </button>
    {pages.map((p, i) => (
      <button
        key={`${p}-${i}`}
        type="button"
        className={cn(
          "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[11px] font-bold",
          i === 0
            ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
            : "border border-white/10 text-slate-400 hover:bg-white/5",
        )}
      >
        {p}
      </button>
    ))}
    <button
      type="button"
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-500 hover:bg-white/5"
    >
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  </div>
);
const ActionBar = ({
  items,
}: {
  items: {
    label: string;
    desc: string;
    icon: ComponentType<{ className?: string }>;
    tone: string;
  }[];
}) => (
  <div
    className={cn(
      "grid grid-cols-1 gap-3",
      items.length >= 5 ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-3",
    )}
  >
    {items.map((a) => {
      const Icon = a.icon;
      return (
        <button
          key={a.label}
          type="button"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-left transition-colors hover:border-white/20"
        >
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
              ICON_TONES[a.tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">{a.label}</p>
            <p className="truncate text-[11px] text-slate-500">{a.desc}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
        </button>
      );
    })}
  </div>
);
const Sparkline = ({ color }: { color: string }) => (
  <ResponsiveContainer width="100%" height={36}>
    <LineChart data={spark()}>
      <Line
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

/* ============================ PORTAL ============================ */

const AnalystPortal: React.FC = () => {
  const [section, setSection] = useState<SectionKey>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = SECTION_META[section];

  const { user, signOut } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const account = {
    name: profile?.fullName || MOCK_USER.name,
    role: profile?.role
      ? (ROLE_DEFINITIONS[profile.role as UserRole]?.label ??
        titleCase(profile.role))
      : MOCK_USER.role,
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b18] text-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0a0f1f] lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <svg
            viewBox="0 0 40 40"
            className="h-9 w-9 shrink-0"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="aegis-analyst" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>
            <path d="M20 2 L36 11 L20 38 L4 11 Z" fill="url(#aegis-analyst)" />
            <path d="M20 2 L20 38 L4 11 Z" fill="#ffffff" opacity="0.14" />
            <path
              d="M20 11 L27 27 H23.5 L20 19 L16.5 27 H13 Z"
              fill="#ffffff"
            />
          </svg>
          <div className="leading-tight">
            <p className="text-base font-black tracking-tight text-white">
              AEGIS-AI
            </p>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">
              Data Analyst Portal
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all",
                  active
                    ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-white" : "text-slate-500",
                  )}
                />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-4 pb-5">
          <div className="rounded-xl border border-white/10 bg-gradient-to-b from-violet-500/10 to-transparent p-4">
            <Shield className="mb-2 h-7 w-7 text-violet-300" />
            <p className="text-xs font-black text-white">GBV Intelligence.</p>
            <p className="text-xs font-black text-white">Safer Futures.</p>
            <p className="text-xs font-black text-violet-300">
              Stronger Communities.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0f1f]/80 px-4 backdrop-blur-xl md:px-6">
          <div className="relative hidden max-w-lg flex-1 lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search datasets, reports, regions, indicators..."
              className="h-9 border-white/10 bg-slate-900/60 pl-10 pr-12 text-sm text-white placeholder:text-slate-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 text-[10px] text-slate-500">
              ⌘K
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
              LIVE
            </span>
            <button
              type="button"
              className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-violet-500 text-[9px] font-black text-white">
                7
              </span>
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-white sm:grid"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <div
              ref={menuRef}
              className="relative border-l border-white/10 pl-2 sm:pl-3"
            >
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">
                  {initialsOf(account.name)}
                </div>
                <div className="hidden text-left leading-tight lg:block">
                  <p className="text-sm font-bold text-white">{account.name}</p>
                  <p className="text-[10px] text-slate-500">{account.role}</p>
                </div>
                <ChevronDown
                  className={cn(
                    "hidden h-4 w-4 text-slate-500 transition-transform lg:block",
                    menuOpen && "rotate-180",
                  )}
                />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0c1224] shadow-xl shadow-black/40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-rose-300 hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-white/10 bg-[#0a0f1f]/80 px-3 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setSection(n.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                section === n.key
                  ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                  {meta.greeting ? `Welcome, ${account.name}` : meta.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{meta.subtitle}</p>
              </div>
              {section === "analytics" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <Filter className="h-3.5 w-3.5" /> Filter
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <Calendar className="h-3.5 w-3.5" /> Compare Periods
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
                  >
                    <Download className="h-3.5 w-3.5" /> Export Analysis
                  </button>
                </div>
              )}
              {section === "forecasting" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
                  >
                    <Activity className="h-3.5 w-3.5" /> Run Forecast
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> Compare Models
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Scenario
                  </button>
                </div>
              )}
              {section === "reports" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Generate Report
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Template
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <Calendar className="h-3.5 w-3.5" /> Schedule Delivery
                  </button>
                </div>
              )}
              {section === "datasets" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Dataset
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh All
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Review Quality
                  </button>
                </div>
              )}
            </div>
            {section === "overview" && <OverviewSection />}
            {section === "analytics" && <AnalyticsSection />}
            {section === "hotspots" && <HotspotsSection />}
            {section === "forecasting" && <ForecastingSection />}
            {section === "reports" && <ReportsSection />}
            {section === "datasets" && <DatasetsSection />}
            {section === "settings" && <SettingsSection />}
            <footer className="mt-2 border-t border-white/5 pt-5 text-center text-[11px] text-slate-600">
              GBV intelligence for survivor protection and policy action. Handle
              data responsibly and follow privacy best practices.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

/* =============================== Overview =============================== */

const OverviewSection = () => {
  const { data: sm } = useSystemMetrics({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: regions = [] } = useRegions({ limit: 200 });
  const { data: ts = [] } = useIncidentTimeSeries({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: ageGroups } = useIncidentAgeGroups();
  const { data: audit = [] } = useAuditLogs({ limit: 6, staleTime: 30000 });
  const { data: categoryData } = useCaseCategories();

  const categories =
    categoryData && categoryData.length
      ? categoryData.map((c) => ({
          name: c.name,
          value: c.value,
          pct: `${c.pct}%`,
          color: c.color,
        }))
      : sample(MOCK_CASE_CATEGORIES);
  const catTotal = categories.reduce((s, c) => s + c.value, 0);

  const kpis = MOCK_OVERVIEW_KPIS.map((k) => {
    if (k.label === "Active Cases" && sm?.casesProcessed != null)
      return { ...k, value: nf.format(sm.casesProcessed) };
    if (k.label === "Countries / Regions" && sm?.countriesActive != null)
      return { ...k, value: String(sm.countriesActive) };
    if (k.label === "AI Risk Alerts" && sm?.activeAlerts != null)
      return { ...k, value: nf.format(sm.activeAlerts) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });
  const trends = ts.length
    ? ts.map((p) => ({
        d: p.date,
        total: p.value,
        high: Math.round(p.value * 0.27),
      }))
    : sample(MOCK_TRENDS);
  const mapRegions: MapRegion[] = regions.length
    ? regions
    : sample(MOCK_AFRICA_MAP);
  const ages =
    ageGroups && ageGroups.length
      ? ageGroups.map((a) => ({ name: a.label, value: a.value }))
      : sample(MOCK_AGE_GROUPS);
  const activity = audit.length
    ? audit
        .slice(0, 4)
        .map((a, i) => ({
          key: i,
          icon: a.severity === "critical" ? AlertTriangle : FileText,
          tone: a.severity === "critical" ? "amber" : "violet",
          title: a.action,
          by: `by ${a.user || "system"}`,
          time: fmtTime(a.time),
        }))
    : sample(MOCK_RECENT_ACTIVITY).map((a, i) => ({ key: i, ...a }));

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            suffix={"suffix" in k ? k.suffix : undefined}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            note={"note" in k ? k.note : undefined}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Incident Trends (Last 12 Weeks)"
          info
          action={<SelectChip label="All Regions" />}
        >
          <div className="mb-2 flex gap-3">
            {[
              ["Total Incidents", "#a855f7"],
              ["High-Risk Incidents", "#06b6d4"],
            ].map(([l, c]) => (
              <span
                key={l}
                className="flex items-center gap-1.5 text-[10px] text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c }}
                />
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={trends}>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="d"
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <Tooltip {...chartTooltip} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="high"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[10px] text-emerald-400">
            ● Data is updated in real-time
          </p>
        </Panel>
        <Panel
          title="Hotspot Distribution (Last 30 Days)"
          info
          action={
            <div className="flex gap-2 text-[10px]">
              {[
                ["High", "#f59e0b"],
                ["Medium", "#a855f7"],
                ["Low", "#3b82f6"],
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c }}
                  />
                  {l}
                </span>
              ))}
            </div>
          }
        >
          <WorldRiskMap
            regions={mapRegions}
            height={250}
            center={[5, 20]}
            zoom={3}
          />
        </Panel>
        <Panel
          title="Case Categories"
          info
          action={<LinkChip label="View full breakdown" />}
        >
          <Donut
            data={categories}
            centerValue={nf.format(catTotal)}
            centerLabel="Total"
          />
          <div className="mt-2 space-y-1">
            {categories.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between text-[10px]"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
                <span className="font-bold text-white">
                  {c.value.toLocaleString()}{" "}
                  <span className="font-medium text-slate-500">({c.pct})</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Age Group / Risk Group Distribution" info>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ages}>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="name"
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
              <Tooltip
                {...chartTooltip}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="AI Insights & Recommendations" info>
          <div className="space-y-3">
            {MOCK_AI_INSIGHTS.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-300">{a.text}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-violet-400">
                      {a.link} →
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Recent Activity"
          info
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-3">
            {activity.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                      ICON_TONES[a.tone],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-white">
                      {a.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {a.by}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">{a.time}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">
          Quick Actions
        </p>
        <ActionBar items={[...MOCK_OVERVIEW_ACTIONS]} />
      </div>
    </>
  );
};

/* =============================== Incident Analytics =============================== */

const AnalyticsSection = () => {
  const { data: sm } = useSystemMetrics({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: ts = [] } = useIncidentTimeSeries({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: anomalies = [] } = useAnomalyAlerts({
    limit: 6,
    staleTime: 10000,
  });
  const { data: channelData } = useReportingChannels();
  const { data: categoryData } = useCaseCategories();
  const categoryVolume =
    categoryData && categoryData.length
      ? categoryData.map((c) => ({ name: c.name, value: c.value }))
      : sample(MOCK_CATEGORY_VOLUME);

  const kpis = MOCK_ANALYTICS_KPIS.map((k) => {
    if (k.label === "Total Incidents" && sm?.totalIncidents != null)
      return { ...k, value: nf.format(sm.totalIncidents) };
    if (k.label === "High-Risk Incidents" && sm?.activeAlerts != null)
      return { ...k, value: nf.format(sm.activeAlerts) };
    if (k.label === "Regional Coverage" && sm?.countriesActive != null)
      return { ...k, value: String(sm.countriesActive) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });
  const trends = ts.length
    ? ts.map((p) => ({
        d: p.date,
        total: p.value,
        high: Math.round(p.value * 0.27),
        resolved: Math.round(p.value * 0.7),
      }))
    : sample(MOCK_TRENDS);
  const anomalyRows = anomalies.length
    ? anomalies
        .slice(0, 3)
        .map((a) => ({
          text: a.type,
          bold: a.region,
          note: a.severity,
          time: fmtTime(a.time),
        }))
    : sample(MOCK_ANOMALIES);
  const channels = live(channelData, MOCK_CHANNELS);

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            suffix={"suffix" in k ? k.suffix : undefined}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            note={"note" in k ? k.note : undefined}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Incident Trends (Last 12 Weeks)"
          info
          className="xl:col-span-2"
          action={<SelectChip label="Last 12 weeks" />}
        >
          <div className="mb-2 flex gap-3">
            {[
              ["Total Incidents", "#a855f7"],
              ["High-Risk Incidents", "#f43f5e"],
              ["Resolved Cases", "#06b6d4"],
            ].map(([l, c]) => (
              <span
                key={l}
                className="flex items-center gap-1.5 text-[10px] text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c }}
                />
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trends}>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="d"
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
              <Tooltip {...chartTooltip} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="high"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Anomaly Alerts"
          info
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-3">
            {anomalyRows.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-300">
                    {a.text}{" "}
                    {a.bold && (
                      <span className="font-bold text-white">{a.bold}</span>
                    )}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-400">
                    {a.note}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">{a.time}</span>
              </div>
            ))}
            <LinkChip label="View all alerts" />
          </div>
        </Panel>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Case Volume by Category (Last 30 Days)"
          info
          action={<LinkChip label="View full breakdown" />}
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={categoryVolume}>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={8}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <Tooltip
                {...chartTooltip}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Reporting Channel Breakdown (Last 30 Days)" info>
          <div className="flex h-7 w-full overflow-hidden rounded-lg">
            {channels.map((c) => (
              <div
                key={c.name}
                style={{ width: `${c.pct}%`, background: c.color }}
                className="grid place-items-center text-[9px] font-bold text-white"
              >
                {c.pct >= 6 ? `${c.pct}%` : ""}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {channels.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
                <span className="font-bold text-white">
                  {c.value.toLocaleString()}{" "}
                  <span className="font-medium text-slate-500">({c.pct}%)</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            ● Percentages may not sum to 100% due to rounding
          </p>
        </Panel>
        <Panel
          title="AI Insight Notes"
          info
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-3">
            {MOCK_INSIGHT_NOTES.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-300">{a.text}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-violet-400">
                      {a.link} →
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
      <Panel
        title="Top Incident Categories (Last 30 Days)"
        info
        bodyClassName="p-0"
        action={<SelectChip label="View All Categories" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Incidents</th>
                <th className="px-5 py-3 text-right">% of Total</th>
                <th className="px-5 py-3 text-right">
                  Trend (vs last 30 days)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_TOP_CATEGORIES.map((c, i) => (
                <tr key={c.name} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-5 py-3 font-bold text-white">{c.name}</td>
                  <td className="px-5 py-3 text-right text-slate-300">
                    {c.incidents}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400">
                    {c.pct}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        "font-bold",
                        c.dir === "up" ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {c.dir === "up" ? "↑" : "↓"} {c.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
};

/* =============================== Hotspot Intelligence =============================== */

const HotspotsSection = () => {
  const { data: regions = [] } = useRegions({ limit: 200 });
  const { data: emergenceData } = useHotspotEmergence();
  const mapRegions: MapRegion[] = regions.length
    ? regions
    : sample(MOCK_AFRICA_MAP);
  const ranked = [...regions].sort((a, b) => b.incidents - a.incidents);
  const topCities = ranked.length
    ? ranked
        .slice(0, 5)
        .map((r, i) => ({
          rank: i + 1,
          city: r.name,
          country: r.country,
          risk: riskLabel(r.riskLevel),
          trend: `${r.trendPercent}%`,
          incidents: nf.format(r.incidents),
        }))
    : sample(MOCK_TOP_CITIES);
  const severity = (() => {
    if (!regions.length) return MOCK_SEVERITY;
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    regions.forEach((r) => {
      counts[r.riskLevel] = (counts[r.riskLevel] ?? 0) + 1;
    });
    const total = regions.length || 1;
    const colorByName: Record<string, string> = {
      Extreme: "#f43f5e",
      High: "#f97316",
      Medium: "#a855f7",
      Low: "#3b82f6",
    };
    return (
      [
        ["Extreme", counts.critical],
        ["High", counts.high],
        ["Medium", counts.medium],
        ["Low", counts.low],
      ] as const
    )
      .filter(([, v]) => v > 0)
      .map(([name, v]) => ({
        name,
        value: v,
        pct: `${Math.round((v / total) * 100)}%`,
        color: colorByName[name],
      }));
  })();
  const severityTotal = severity.reduce((s, d) => s + d.value, 0);
  const emergence = live(emergenceData, MOCK_EMERGENCE);
  const kpis = MOCK_HOTSPOT_KPIS.map((k) => {
    if (k.label === "Hotspot Regions" && regions.length)
      return { ...k, value: String(regions.length) };
    if (k.label === "Critical Hotspots" && regions.length)
      return {
        ...k,
        value: String(regions.filter((r) => r.riskLevel === "critical").length),
      };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={k.delta}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Hotspot Heat Map – Africa" info className="xl:col-span-2">
          <WorldRiskMap
            regions={mapRegions}
            height={340}
            center={[3, 20]}
            zoom={3}
          />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel
            title="Regional Distribution"
            info
            action={<SelectChip label="Last 30 days" />}
          >
            <WorldRiskMap
              regions={mapRegions}
              height={140}
              center={[10, 30]}
              zoom={1}
            />
          </Panel>
          <Panel
            title="Top Hotspot Cities / Regions"
            info
            action={<LinkChip label="View Regions" />}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={tableHead}>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">City / Region</th>
                    <th className="px-4 py-2">Risk</th>
                    <th className="px-4 py-2 text-right">Trend</th>
                    <th className="px-4 py-2 text-right">Incidents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topCities.map((c) => (
                    <tr key={c.rank} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-slate-500">{c.rank}</td>
                      <td className="px-4 py-2">
                        <p className="font-bold text-white">{c.city}</p>
                        <p className="text-[10px] text-slate-500">
                          {c.country}
                        </p>
                      </td>
                      <td className="px-4 py-2">
                        <Pill tone={riskTone(c.risk)}>{c.risk}</Pill>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-400">
                        ↑ {c.trend}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {c.incidents}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Hotspot Severity Breakdown"
          info
          action={<LinkChip label="View full breakdown" />}
        >
          <Donut
            data={severity}
            centerValue={String(severityTotal)}
            centerLabel="Total"
          />
          <div className="mt-2 space-y-1">
            {severity.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
                <span className="font-bold text-white">
                  {c.value} ({c.pct})
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Hotspot Emergence Over Time"
          info
          action={<SelectChip label="Last 90 days" />}
        >
          <div className="mb-2 flex gap-3">
            {[
              ["New Hotspots", "#a855f7"],
              ["Escalated Hotspots", "#f43f5e"],
              ["De-escalated Hotspots", "#06b6d4"],
            ].map(([l, c]) => (
              <span
                key={l}
                className="flex items-center gap-1.5 text-[10px] text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c }}
                />
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={emergence}>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="d"
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <Tooltip {...chartTooltip} />
              <Line
                type="monotone"
                dataKey="newH"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="esc"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="deesc"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="AI Recommendations"
          info
          action={<LinkChip label="View all" />}
        >
          <p className="mb-2 text-[10px] text-slate-500">
            Our AI model analyzed incident patterns, mobility data, and risk
            indicators.
          </p>
          <div className="space-y-2">
            {MOCK_HOTSPOT_RECS.map((r, i) => {
              const Icon = r.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="min-w-0 flex-1 text-[11px] text-slate-300">
                    {r.text}
                  </p>
                  <Pill tone={r.tag.includes("High") ? "rose" : "amber"}>
                    {r.tag}
                  </Pill>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
      <ActionBar
        items={[
          {
            label: "Open Map",
            desc: "Explore interactive hotspot map",
            icon: MapPin,
            tone: "violet",
          },
          {
            label: "View Regions",
            desc: "Browse region intelligence",
            icon: FileText,
            tone: "sky",
          },
          {
            label: "Export Geo Report",
            desc: "Download geospatial intelligence report",
            icon: Download,
            tone: "emerald",
          },
        ]}
      />
    </>
  );
};

/* =============================== Forecasting =============================== */

const ForecastingSection = () => {
  const { data: fm } = useForecastMetrics();
  const { data: ts = [] } = useIncidentTimeSeries({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: scenarioData } = useForecastScenarios();
  const { data: variableData } = useForecastVariables();

  const kpis = MOCK_FORECAST_KPIS.map((k) => {
    if (!fm) return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
    if (k.label === "Forecast Accuracy")
      return { ...k, value: `${fm.accuracy}%` };
    if (k.label === "Expected Case Growth")
      return { ...k, value: `+${fm.growth}%` };
    if (k.label === "High-Risk Regions Forecasted")
      return { ...k, value: String(fm.highRiskRegions) };
    if (k.label === "Projected Support Demand")
      return { ...k, value: nf.format(fm.projectedDemand) };
    if (k.label === "Model Confidence")
      return { ...k, value: `${fm.modelConfidence}%` };
    return ALLOW_MOCK
      ? k
      : { ...(k as (typeof MOCK_FORECAST_KPIS)[number]), value: NO_DATA };
  });
  const hasFc = ts.some((p) => p.predicted != null || p.upper != null);
  const forecastData = hasFc
    ? ts.map((p) => ({
        d: p.date,
        hist: p.value,
        fc: p.predicted ?? null,
        up: p.upper ?? null,
        low: p.lower ?? null,
      }))
    : sample(MOCK_FORECAST);
  const scenarios =
    scenarioData && scenarioData.length
      ? scenarioData.map((s) => ({
          name: s.name,
          cases: nf.format(s.totalCases),
          change:
            s.changePct == null
              ? "—"
              : `${s.changePct > 0 ? "+" : ""}${s.changePct}%`,
          conf: s.confidence,
          color: s.color,
        }))
      : sample(MOCK_SCENARIOS);
  const variables = live(variableData, MOCK_MODEL_VARS);

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            note={"note" in k ? k.note : undefined}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="GBV Incidents Forecast" info className="xl:col-span-2">
          <div className="mb-2 flex flex-wrap gap-3">
            {[
              ["Historical (Reported)", "#a855f7"],
              ["Forecast (Median)", "#06b6d4"],
              ["Upper Bound (80%)", "#8b5cf6"],
              ["Lower Bound (80%)", "#22d3ee"],
            ].map(([l, c]) => (
              <span
                key={l}
                className="flex items-center gap-1.5 text-[10px] text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c }}
                />
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="d"
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={9}
              />
              <Tooltip {...chartTooltip} />
              <Area
                type="monotone"
                dataKey="up"
                stroke="#8b5cf6"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="url(#fc-band)"
              />
              <Area
                type="monotone"
                dataKey="low"
                stroke="#22d3ee"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="transparent"
              />
              <Line
                type="monotone"
                dataKey="hist"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="fc"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[10px] text-slate-500">
            ● Data as of May 19, 2024 • Forecast generated today at 10:24 AM
          </p>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Risk Outlook" info>
            <div className="space-y-3">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">
                    SHORT-TERM (Next 30 Days)
                  </p>
                  <Pill tone="rose">High Risk</Pill>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Elevated risk expected in 8 regions. Peak risk window: May 25
                  – June 8
                </p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">
                    LONG-TERM (Next 90 Days)
                  </p>
                  <Pill tone="amber">Elevated</Pill>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Sustained high risk in 12 regions. Key drivers: Economic
                  stress, School terms, Weekend pattern
                </p>
              </div>
            </div>
          </Panel>
          <Panel
            title="Model Insights"
            info
            action={<LinkChip label="View all variables" />}
          >
            <p className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
              Top Influential Variables <span>Impact</span>
            </p>
            <div className="space-y-2">
              {variables.map((v) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-slate-300">{v.name}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 font-bold",
                      v.impact === "High"
                        ? "text-rose-400"
                        : v.impact === "Medium"
                          ? "text-amber-400"
                          : "text-sky-400",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {v.impact}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Scenario Comparison"
          info
          action={<LinkChip label="Customize scenarios" />}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-2">Scenario</th>
                  <th className="px-4 py-2 text-right">Total Cases</th>
                  <th className="px-4 py-2 text-right">Change</th>
                  <th className="px-4 py-2 text-right">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scenarios.map((s) => (
                  <tr key={s.name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: s.color }}
                        />
                        {s.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-white">
                      {s.cases}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-bold",
                        s.change.startsWith("-")
                          ? "text-emerald-400"
                          : s.change.startsWith("+")
                            ? "text-rose-400"
                            : "text-slate-400",
                      )}
                    >
                      {s.change}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {s.conf}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Region Priority (Next 30 Days)"
          info
          action={<LinkChip label="View all regions" />}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-2">Region</th>
                  <th className="px-4 py-2">Risk</th>
                  <th className="px-4 py-2 text-right">Cases</th>
                  <th className="px-4 py-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_REGION_PRIORITY.map((r) => (
                  <tr key={r.rank} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-bold text-white">
                      {r.region}
                    </td>
                    <td className="px-4 py-2">
                      <Pill tone={riskTone(r.risk)}>{r.risk}</Pill>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {r.cases}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-rose-400">
                      ↑ {r.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="AI Forecast Recommendations"
          info
          action={<LinkChip label="View all recommendations" />}
        >
          <div className="space-y-2">
            {MOCK_FORECAST_RECS.map((r, i) => {
              const Icon = r.icon;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-xs font-bold text-white">{r.title}</p>
                    </div>
                    <Pill tone={r.tag.includes("High") ? "violet" : "amber"}>
                      {r.tag}
                    </Pill>
                  </div>
                  <p className="mt-1 pl-9 text-[10px] text-slate-500">
                    {r.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
    </>
  );
};

/* =============================== Reports =============================== */

const ReportsSection = () => {
  const { data: reports = [] } = useAnalystReports();
  const library = reports.filter((r) => !r.scheduled);
  const scheduled = reports.filter((r) => r.scheduled);
  const libraryRows = library.length
    ? library.map((r) => ({
        name: r.name,
        type: r.type,
        region: r.region,
        status: r.status,
        owner: r.owner,
        updated: fmtDateTime(r.generatedAt),
      }))
    : sample(MOCK_REPORT_LIBRARY);
  const scheduledRows = scheduled.length
    ? scheduled.map((r) => ({
        name: r.name,
        freq: r.frequency,
        next: r.nextDelivery,
        recipients: r.recipients,
      }))
    : sample(MOCK_SCHEDULED);
  const kpis = MOCK_REPORT_KPIS.map((k) => {
    if (k.label === "Reports Generated" && reports.length)
      return { ...k, value: String(reports.length) };
    if (k.label === "Scheduled Reports" && scheduled.length)
      return { ...k, value: String(scheduled.length) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={k.delta}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Report Library"
          info
          className="xl:col-span-2"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <SelectChip label="All Regions" />
              <SelectChip label="All Types" />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Report Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {libraryRows.map((r) => (
                  <tr key={r.name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{r.name}</p>
                      <p className="text-[10px] text-slate-500">{r.updated}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone="violet">{r.type}</Pill>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.region}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          r.status === "Completed"
                            ? "text-emerald-400"
                            : "text-sky-400",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {r.owner}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="rounded border border-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          PDF
                        </span>
                        <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          CSV
                        </span>
                        <button type="button" className="text-slate-500">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View all reports →
          </p>
        </Panel>
        <Panel
          title="Recently Generated Reports"
          info
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2.5">
            {libraryRows.map((r) => (
              <div key={r.name} className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-white">
                    {r.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {r.region}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">
                  {r.updated.split(" ").slice(-2).join(" ")}
                </span>
                <button type="button" className="text-slate-500">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Report Categories" info className="xl:col-span-2">
          <div className="space-y-2">
            {MOCK_REPORT_CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.name}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                      ICON_TONES[c.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white">{c.name}</p>
                    <p className="truncate text-[10px] text-slate-500">
                      {c.desc}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {["PDF", "CSV", "PPT"].map((f) => (
                      <span
                        key={f}
                        className="rounded border border-white/10 px-2 py-0.5 text-[9px] font-bold text-slate-300"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Scheduled Reports"
          info
          action={<LinkChip label="Manage schedules" />}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-2">Report</th>
                  <th className="px-4 py-2">Frequency</th>
                  <th className="px-4 py-2 text-right">Recipients</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scheduledRows.map((s) => (
                  <tr key={s.name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2">
                      <p className="font-bold text-white">{s.name}</p>
                      <p className="text-[10px] text-slate-500">{s.next}</p>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{s.freq}</td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {s.recipients}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
};

/* =============================== Datasets =============================== */

const DatasetsSection = () => {
  const { data: datasets = [] } = useDatasetCatalog();
  const { data: dq } = useDataQualityAlerts();
  const rows = datasets.length
    ? datasets.map((d) => ({
        name: d.name,
        desc: d.description,
        source: d.source,
        records: nf.format(d.records),
        fresh: freshnessLabel(d.freshnessMinutes),
        quality: d.quality,
        ok: d.freshnessMinutes <= 35,
      }))
    : sample(MOCK_DATASETS);
  const refresh = datasets.length
    ? datasets.map((d) => ({
        name: d.name,
        status: d.schema === "Schema change" ? "Delayed" : "On schedule",
        ok: d.schema !== "Schema change",
      }))
    : sample(MOCK_REFRESH);
  const connectors = datasets.length
    ? datasets.map((d) => ({ name: d.source, status: d.connector }))
    : sample(MOCK_CONNECTORS);
  const schema = datasets.length
    ? datasets.map((d) => ({
        name: d.name,
        status: d.schema,
        ok: d.schema === "Up to date",
      }))
    : sample(MOCK_SCHEMA);
  const dqRows =
    dq && dq.length
      ? dq.map((a) => ({ name: a.name, desc: a.description, sev: a.severity }))
      : sample(MOCK_DQ_ALERTS);
  const sparkColors = [
    "#a855f7",
    "#06b6d4",
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#a855f7",
  ];
  const keySources = datasets.length
    ? datasets.map((d, i) => ({
        name: d.name,
        records: `${nf.format(d.records)} records`,
        sync: freshnessLabel(d.freshnessMinutes),
        color: sparkColors[i % sparkColors.length],
      }))
    : sample(MOCK_KEY_SOURCES);
  const kpis = MOCK_DATASET_KPIS.map((k) => {
    if (k.label === "Connected Datasets" && datasets.length)
      return { ...k, value: String(datasets.length) };
    if (k.label === "Flagged Issues" && dq)
      return { ...k, value: String(dq.length) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            note={"note" in k ? k.note : undefined}
          />
        ))}
      </section>
      <Panel
        title="Dataset Management"
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Search datasets..."
                className="h-8 w-44 border-white/10 bg-slate-900/60 pl-8 text-xs text-white"
              />
            </div>
            <SelectChip label="All Regions" />
            <SelectChip label="All Status" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-4 py-3">Dataset Name</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3">Freshness</th>
                <th className="px-4 py-3">Quality Score</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((d) => (
                <tr key={d.name} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-bold text-white">{d.name}</p>
                    <p className="text-[10px] text-slate-500">{d.desc}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-white">{d.source}</p>
                    <p className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">All Regions</td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {d.records}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[11px]",
                        d.ok ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {d.fresh}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            d.quality >= 90 ? "bg-emerald-500" : "bg-amber-500",
                          )}
                          style={{ width: `${d.quality}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-white">
                        {d.quality}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-violet-300 hover:bg-white/5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            Showing 1 to 6 of 26 datasets
          </span>
          <Pagination pages={["1", "2", "3"]} />
        </div>
      </Panel>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Refresh Schedules" action={<LinkChip label="View all" />}>
          <div className="space-y-2">
            {refresh.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-slate-300">{r.name}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-bold",
                    r.ok ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {r.status}
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Source Connectors" action={<LinkChip label="View all" />}>
          <div className="space-y-2">
            {connectors.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-slate-300">{c.name}</span>
                <span className="font-bold text-emerald-400">Connected +</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Schema Status" action={<LinkChip label="View all" />}>
          <div className="space-y-2">
            {schema.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-slate-300">{s.name}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-bold",
                    s.ok ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {s.ok ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Data Quality Alerts"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2">
            {dqRows.map((a) => (
              <div key={a.name} className="flex items-start gap-2">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    a.sev === "High"
                      ? "text-rose-400"
                      : a.sev === "Medium"
                        ? "text-amber-400"
                        : "text-sky-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-white">
                    {a.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {a.desc}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    a.sev === "High"
                      ? "text-rose-400"
                      : a.sev === "Medium"
                        ? "text-amber-400"
                        : "text-sky-400",
                  )}
                >
                  ▸ {a.sev}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <Panel title="Key Sources (GBV Intelligence)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {keySources.map((s) => (
            <div
              key={s.name}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <p className="text-[11px] font-black text-white">{s.name}</p>
              <p className="text-[10px] text-slate-400">{s.records}</p>
              <div className="my-1">
                <Sparkline color={s.color} />
              </div>
              <p className="text-[10px] text-slate-500">Last sync: {s.sync}</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
};

/* =============================== Settings =============================== */

const SettingToggle = ({
  label,
  desc,
  defaultOn = true,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  defaultOn?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) => {
  const [internal, setInternal] = useState(defaultOn);
  const on = checked ?? internal;
  const set = onChange ?? setInternal;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-xs font-bold text-white">{label}</p>
        {desc && <p className="text-[10px] text-slate-500">{desc}</p>}
      </div>
      <Switch checked={on} onCheckedChange={set} />
    </div>
  );
};
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <p className="mb-1 text-[10px] font-bold text-slate-400">{label}</p>
    {children}
  </div>
);

const SETTINGS_DEFAULTS: Record<string, boolean> = {
  "Show onboarding tips": true,
  "In-app notifications": true,
  Email: true,
  SMS: true,
  WhatsApp: false,
  "Auto-anonymize exports": true,
  "Restrict raw data download": false,
  "Include Visualizations": true,
  "Include Data Tables": true,
  "Include Methodology Notes": true,
  "Auto-retrain on new data": true,
};

const SettingsSection = () => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { data: stored } = useAnalystSettings(user?.id);
  const profileName = profile?.fullName || MOCK_USER.name;
  const profileRole = profile?.role
    ? (ROLE_DEFINITIONS[profile.role as UserRole]?.label ??
      titleCase(profile.role))
    : MOCK_USER.role;
  const [form, setForm] = useState<Record<string, boolean>>(SETTINGS_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = stored?.toggles as Record<string, boolean> | undefined;
    if (t) setForm((f) => ({ ...f, ...t }));
  }, [stored]);

  const toggle = (label: string) => ({
    checked: form[label] ?? SETTINGS_DEFAULTS[label],
    onChange: (v: boolean) => setForm((f) => ({ ...f, [label]: v })),
  });
  const onSave = async () => {
    if (!user?.id) {
      toast.error("Sign in to save settings");
      return;
    }
    setSaving(true);
    const { error } = await saveAnalystSettings(user.id, { toggles: form });
    setSaving(false);
    if (error) toast.error("Failed to save settings");
    else toast.success("Settings saved");
  };
  const onReset = () => setForm(SETTINGS_DEFAULTS);

  return (
    <>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Panel title="Profile Preferences" className="xl:col-span-1">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name">
                <Input
                  key={profileName}
                  defaultValue={profileName}
                  className="h-9 border-white/10 bg-slate-950/50 text-sm text-white"
                />
              </Field>
              <Field label="Role">
                <SelectChip label={profileRole} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preferred Language">
                <SelectChip label="English" />
              </Field>
              <Field label="Theme">
                <SelectChip label="Dark" />
              </Field>
            </div>
            <SettingToggle
              label="Show onboarding tips"
              desc="Display contextual help and tips."
              {...toggle("Show onboarding tips")}
            />
          </div>
        </Panel>
        <Panel title="Notification Rules">
          <div className="space-y-2">
            <Field label="Anomaly alert sensitivity">
              <SelectChip label="High (More alerts, earlier detection)" />
            </Field>
            <p className="text-[10px] font-bold text-slate-400">
              Report delivery channels
            </p>
            {["In-app notifications", "Email", "SMS", "WhatsApp"].map((l) => (
              <SettingToggle key={l} label={l} {...toggle(l)} />
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Quiet hours (from)">
                <SelectChip label="22:00" />
              </Field>
              <Field label="to">
                <SelectChip label="06:00" />
              </Field>
            </div>
          </div>
        </Panel>
        <Panel title="Regional Defaults">
          <div className="space-y-3">
            <Field label="Default Region">
              <SelectChip label="All Regions" />
            </Field>
            <Field label="Sub-Region View">
              <SelectChip label="Country level" />
            </Field>
            <Field label="Time Zone">
              <SelectChip label="(UTC+02:00) Harare, Pretoria" />
            </Field>
            <Field label="Date Range Default">
              <SelectChip label="Last 30 days" />
            </Field>
          </div>
        </Panel>
        <Panel title="System Status">
          <div className="space-y-2.5">
            {[
              ["Platform Status", Globe],
              ["Data Pipeline", GitBranch],
              ["AI Models", Cpu],
              ["Alert Engine", Bell],
            ].map(([l, Ic]) => {
              const Icon = Ic as ComponentType<{ className?: string }>;
              return (
                <div
                  key={l as string}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Icon className="h-3.5 w-3.5 text-violet-300" />
                    {l as string}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400">
                    Operational
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 border-t border-white/5 pt-2 text-[10px] text-slate-500">
              <Clock className="h-3 w-3" /> Last Updated · May 20, 2024 10:24 AM
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> All systems are running
              normally.
            </p>
          </div>
        </Panel>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Panel title="Data Privacy Controls">
          <div className="space-y-3">
            <Field label="Data Access Scope">
              <SelectChip label="Role-based (Recommended)" />
            </Field>
            <Field label="Data Retention Period">
              <SelectChip label="24 months" />
            </Field>
            <SettingToggle
              label="Auto-anonymize exports"
              {...toggle("Auto-anonymize exports")}
            />
            <SettingToggle
              label="Restrict raw data download"
              {...toggle("Restrict raw data download")}
            />
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-[10px] text-emerald-300">
              All settings comply with GBV data protection standards and
              survivor confidentiality protocols.
            </div>
          </div>
        </Panel>
        <Panel title="Export Preferences">
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-bold text-white">
                Default Export Format
              </span>
              <SelectChip label="PDF" />
            </div>
            <SettingToggle
              label="Include Visualizations"
              {...toggle("Include Visualizations")}
            />
            <SettingToggle
              label="Include Data Tables"
              {...toggle("Include Data Tables")}
            />
            <SettingToggle
              label="Include Methodology Notes"
              {...toggle("Include Methodology Notes")}
            />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-bold text-white">
                Default Aggregation Level
              </span>
              <SelectChip label="District" />
            </div>
          </div>
        </Panel>
        <Panel title="AI / Forecast Settings">
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-bold text-white">
                Model Refresh Interval
              </span>
              <SelectChip label="Weekly" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-bold text-white">
                Forecast Horizon Default
              </span>
              <SelectChip label="30 days" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-bold text-white">
                Confidence Threshold
              </span>
              <SelectChip label="70%" />
            </div>
            <SettingToggle
              label="Auto-retrain on new data"
              {...toggle("Auto-retrain on new data")}
            />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-bold text-white">
                Explainability Mode
              </span>
              <SelectChip label="Balanced (Recommended)" />
            </div>
          </div>
        </Panel>
        <Panel title="Audit Summary (Last 30 Days)">
          <div className="space-y-2">
            {[
              ["Settings Changed", "14"],
              ["Alerts Configured", "32"],
              ["Exports Generated", "27"],
              ["Logins", "48"],
              ["Data Access Events", "126"],
            ].map(([l, v]) => (
              <div
                key={l}
                className="flex items-center justify-between border-b border-white/5 pb-1.5 text-[11px]"
              >
                <span className="text-slate-400">{l}</span>
                <span className="font-black text-white">{v}</span>
              </div>
            ))}
            <button
              type="button"
              className="mt-1 flex w-full items-center justify-center gap-1 text-[11px] font-bold text-violet-400"
            >
              View Audit Log <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </Panel>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/50 px-5 py-3">
        <p className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-4 w-4 text-violet-300" /> Changes are saved
          to your profile and apply across all modules.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={() => toast.success("Test alert sent")}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5"
          >
            <Bell className="h-3.5 w-3.5" /> Test Alert
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />{" "}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
};

export default AnalystPortal;
