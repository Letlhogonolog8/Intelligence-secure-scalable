/**
 * AEGIS-AI Police Response Portal — faithful build of the approved mock-up.
 *
 * Presentation/sample data lives in `MOCK_*` constants so each seam can be
 * wired to a live AEGIS data source later without touching the layout.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
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
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Globe,
  Handshake,
  Home,
  Languages,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Phone,
  Plus,
  Radio,
  Scale,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
  Stethoscope,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import WorldRiskMap, {
  type MapRegion,
} from "@/components/analyst/WorldRiskMap";
import SharedEvidencePanel from "@/components/evidence/SharedEvidencePanel";
import CoordinationBoard from "@/components/coordination/CoordinationBoard";
import {
  useAlertsFeed,
  useAuditLogs,
  useCaseReports,
  useEscalationEvents,
  usePlatformServices,
  usePoliceOfficers,
  useRegions,
  useSystemMetrics,
  useUserProfile,
  useUserProfiles,
} from "@/data/aegisData";
import {
  isConversationUnread,
  markConversationRead,
  secureMessagesKey,
  sendSecureMessage,
  SECURE_CONVERSATIONS_KEY,
  startSecureConversation,
  useSecureConversations,
  useSecureMessages,
  type SecureConversation,
} from "@/data/secureMessages";
import {
  acknowledgeEscalation,
  clearQueueData,
  deleteEscalation,
  dispatchEscalation,
  escalateEscalation,
  ESCALATION_EVENTS_KEY,
} from "@/data/escalationActions";
import {
  CASE_EVIDENCE_QUERY_KEY,
  caseEvidenceKind,
  createCaseEvidenceUrl,
  uploadCaseEvidence,
  useCaseEvidence,
  type CaseEvidenceEntry,
} from "@/data/caseEvidence";
import {
  responderSettingsKey,
  saveResponderSettings,
  useResponderSettings,
} from "@/data/responderSettings";
import {
  addTriageNote,
  TRIAGE_NOTES_KEY,
  useTriageNotes,
} from "@/data/triageNotes";
import {
  createDispatch,
  DISPATCHES_KEY,
  DISPATCH_UNITS_KEY,
  nextDispatchStatus,
  setUnitStatus,
  updateDispatchStatus,
  useDispatches,
  useDispatchUnits,
  type Dispatch,
  type DispatchUnit,
} from "@/data/dispatch";
import { persistPreferredLanguage } from "@/lib/languageSync";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_DEFINITIONS, type UserRole } from "@/lib/roleConfig";
import { ALLOW_MOCK, NO_DATA, mockList } from "@/lib/mockData";

const nf = new Intl.NumberFormat("en-US");
const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
const fmtRelative = (t: string) => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
};
const fmtDateTime = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString();
};

/** Canonical case-status buckets for the donut, from raw case_reports.status. */
const POLICE_CASE_STATUS: { name: string; match: string[]; color: string }[] = [
  { name: "New", match: ["new", "received"], color: "#ec4899" },
  {
    name: "In Progress",
    match: ["in_progress", "open", "escalated"],
    color: "#3b82f6",
  },
  { name: "Under Review", match: ["under_review", "review"], color: "#a855f7" },
  { name: "On Hold", match: ["on_hold"], color: "#06b6d4" },
  { name: "Resolved", match: ["resolved"], color: "#10b981" },
  { name: "Closed", match: ["closed"], color: "#64748b" },
];

type SectionKey =
  | "overview"
  | "queue"
  | "incidents"
  | "cases"
  | "dispatch"
  | "evidence"
  | "survivor"
  | "messages"
  | "partners"
  | "analytics"
  | "reports"
  | "settings";

/* ============================ MOCK / SAMPLE DATA ============================ */

const MOCK_USER = {
  name: "ACP Thandi Mokoena",
  role: "Regional Operations Command",
};

const MOCK_OVERVIEW_KPIS = [
  {
    label: "Active Emergencies",
    value: "28",
    icon: Siren,
    tone: "rose",
    delta: "5 from yesterday",
    dir: "up",
  },
  {
    label: "Critical GBV Cases",
    value: "112",
    icon: ShieldAlert,
    tone: "rose",
    delta: "14 from yesterday",
    dir: "up",
  },
  {
    label: "SOS Alerts Today",
    value: "47",
    icon: Radio,
    tone: "violet",
    delta: "11 from yesterday",
    dir: "up",
  },
  {
    label: "Average Response Time",
    value: "18 min",
    icon: Clock,
    tone: "cyan",
    delta: "3 min from yesterday",
    dir: "down",
  },
  {
    label: "Assigned Officers",
    value: "156",
    icon: Users,
    tone: "sky",
    note: "On Duty",
  },
  {
    label: "High-Risk Cases",
    value: "36",
    icon: Shield,
    tone: "amber",
    note: "Requiring Monitoring",
  },
] as const;

const MOCK_CASE_ACTIVITY = Array.from({ length: 13 }, (_, i) => ({
  t: `${String((9 + i * 2) % 24).padStart(2, "0")}:00`,
  sos: 18 + Math.round(Math.sin(i / 2) * 6) + i * 2,
  dv: 14 + Math.round(Math.cos(i / 2) * 4) + i * 1.6,
  sa: 11 + i * 1.2,
  cp: 8 + Math.round(Math.sin(i / 3) * 3) + i * 0.7,
  traf: 6 + Math.round(Math.cos(i / 3) * 2),
}));

const MOCK_SA_MAP: MapRegion[] = [
  {
    id: "jhb",
    name: "Johannesburg",
    country: "Survivor need hotspot",
    riskLevel: "critical",
    incidents: 142,
    lat: -26.2,
    lng: 28.04,
  },
  {
    id: "cpt",
    name: "Cape Town",
    country: "Survivor need hotspot",
    riskLevel: "high",
    incidents: 96,
    lat: -33.92,
    lng: 18.42,
  },
  {
    id: "dbn",
    name: "Durban",
    country: "Survivor need hotspot",
    riskLevel: "high",
    incidents: 88,
    lat: -29.86,
    lng: 31.02,
  },
  {
    id: "pta",
    name: "Pretoria",
    country: "Response location",
    riskLevel: "medium",
    incidents: 54,
    lat: -25.74,
    lng: 28.19,
  },
  {
    id: "hre",
    name: "Harare",
    country: "Partner / safe space",
    riskLevel: "medium",
    incidents: 41,
    lat: -17.83,
    lng: 31.05,
  },
  {
    id: "gab",
    name: "Gaborone",
    country: "Response location",
    riskLevel: "low",
    incidents: 22,
    lat: -24.65,
    lng: 25.91,
  },
  {
    id: "lsk",
    name: "Lusaka",
    country: "Partner / safe space",
    riskLevel: "medium",
    incidents: 37,
    lat: -15.42,
    lng: 28.28,
  },
  {
    id: "wdh",
    name: "Windhoek",
    country: "Response location",
    riskLevel: "low",
    incidents: 14,
    lat: -22.56,
    lng: 17.08,
  },
  {
    id: "mpt",
    name: "Maputo",
    country: "Survivor need hotspot",
    riskLevel: "high",
    incidents: 63,
    lat: -25.97,
    lng: 32.58,
  },
];

const MOCK_SYSTEM_OPS = [
  { name: "Dispatch Engine", icon: Radio },
  { name: "Translation Engine", icon: Languages },
  { name: "Real-Time Messaging", icon: MessageSquare },
  { name: "Evidence Sync", icon: FileCheck },
  { name: "NGO Coordination", icon: Handshake },
  { name: "Counselor Routing", icon: Users },
];

const MOCK_CASES_BY_STATUS = [
  { name: "New", value: 298, pct: "24%", color: "#ec4899" },
  { name: "In Progress", value: 412, pct: "33%", color: "#3b82f6" },
  { name: "Under Review", value: 214, pct: "17%", color: "#a855f7" },
  { name: "On Hold", value: 98, pct: "8%", color: "#06b6d4" },
  { name: "Resolved", value: 188, pct: "15%", color: "#10b981" },
  { name: "Closed", value: 38, pct: "3%", color: "#64748b" },
];

const MOCK_AI_INSIGHTS = [
  {
    title: "High Risk Survivors",
    value: "36",
    sub: "Require Immediate Follow-up",
    icon: ShieldAlert,
    tone: "rose",
  },
  {
    title: "Escalation Recommendation",
    value: "14",
    sub: "Cases Need Supervisor Review",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    title: "Voice Translation Ready",
    value: "23",
    sub: "Messages Awaiting Translation",
    icon: Languages,
    tone: "violet",
  },
  {
    title: "Distress Detection",
    value: "11",
    sub: "High Distress Signals Detected",
    icon: Radio,
    tone: "rose",
  },
];

const MOCK_RECENT_ACTIVITY = [
  {
    icon: Handshake,
    tone: "violet",
    title: "NGO referral accepted – SafeHome Trust",
    sub: "Case #GBV-2025-0519-078",
    time: "09:28 AM",
  },
  {
    icon: Users,
    tone: "sky",
    title: "Counselor assigned – A. Naidoo",
    sub: "Case #SA-2025-0519-042",
    time: "09:15 AM",
  },
  {
    icon: Phone,
    tone: "emerald",
    title: "Survivor check-in received",
    sub: "Case #DV-2025-0520-093",
    time: "09:02 AM",
  },
  {
    icon: Car,
    tone: "amber",
    title: "Officer dispatched – Sector 3 Unit",
    sub: "Case #GBV-2025-0521-011",
    time: "08:47 AM",
  },
  {
    icon: FileText,
    tone: "violet",
    title: "Evidence uploaded – Medical Report",
    sub: "Case #SA-2025-0519-042",
    time: "08:35 AM",
  },
];

const MOCK_CRITICAL_ALERTS = [
  {
    title: "Translation Queue Delays",
    desc: "High volume detected. Some responses delayed. Affected Languages: Portuguese, French, Tsonga",
    time: "09:36 AM",
    tone: "amber",
  },
  {
    title: "Urgent Safety Check Required",
    desc: "Survivor has not checked in. Case #GBV-2025-0519-078 • High Risk",
    time: "09:21 AM",
    tone: "rose",
  },
  {
    title: "High-Risk Case Escalation",
    desc: "AI recommends immediate supervisor review. Case #DV-2025-0518-064 • Risk Score: 92",
    time: "08:58 AM",
    tone: "violet",
  },
];

const MOCK_OVERVIEW_ACTIONS = [
  { label: "Open Emergency Queue", icon: Siren, tone: "violet" },
  { label: "Assign Officer", icon: Users, tone: "sky" },
  { label: "Review Evidence", icon: FileCheck, tone: "cyan" },
  { label: "Contact NGO", icon: Handshake, tone: "emerald" },
  { label: "Contact Counselor", icon: Phone, tone: "amber" },
  { label: "Generate Report", icon: FileText, tone: "violet" },
];

const MOCK_QUEUE_KPIS = [
  {
    label: "Critical Alerts",
    value: "28",
    icon: Siren,
    tone: "rose",
    delta: "6 from last hour",
    dir: "up",
  },
  {
    label: "Awaiting Dispatch",
    value: "37",
    icon: Users,
    tone: "amber",
    delta: "9 from last hour",
    dir: "up",
  },
  {
    label: "Average Triage Time",
    value: "9m 42s",
    icon: Clock,
    tone: "cyan",
    delta: "2m 18s improvement",
    dir: "down",
  },
  {
    label: "Unassigned Cases",
    value: "19",
    icon: Users,
    tone: "violet",
    delta: "4 from last hour",
    dir: "up",
  },
] as const;

const MOCK_QUEUE = [
  {
    priority: "Critical",
    id: "SOS-2025-05121-001",
    via: "via SOS App",
    type: "Domestic Violence",
    safety: "In Immediate Danger",
    safetySub: "Needs urgent response",
    loc: "Soweto, Johannesburg",
    locSub: "Gauteng",
    time: "09:37 AM",
    ago: "2 min ago",
    score: 96,
    officer: "Unassigned",
  },
  {
    priority: "Critical",
    id: "SOS-2025-05121-002",
    via: "via Phone Hotline",
    type: "Sexual Assault",
    safety: "In Immediate Danger",
    safetySub: "Needs urgent response",
    loc: "Durban Central",
    locSub: "KwaZulu-Natal",
    time: "09:35 AM",
    ago: "4 min ago",
    score: 94,
    officer: "Unassigned",
  },
  {
    priority: "High",
    id: "SOS-2025-05121-003",
    via: "via Community Report",
    type: "Child Protection",
    safety: "At Risk",
    safetySub: "Monitoring required",
    loc: "Manenberg, Cape Town",
    locSub: "Western Cape",
    time: "09:31 AM",
    ago: "8 min ago",
    score: 78,
    officer: "Unassigned",
  },
  {
    priority: "High",
    id: "SOS-2025-05121-004",
    via: "via Partner NGO",
    type: "Trafficking Alert",
    safety: "At Risk",
    safetySub: "Monitoring required",
    loc: "Beitbridge Border Post",
    locSub: "Limpopo",
    time: "09:29 AM",
    ago: "10 min ago",
    score: 76,
    officer: "Unassigned",
  },
  {
    priority: "Medium",
    id: "SOS-2025-05121-005",
    via: "via Web Intake",
    type: "Domestic Violence",
    safety: "Safe (For Now)",
    safetySub: "Follow-up required",
    loc: "Polokwane Central",
    locSub: "Limpopo",
    time: "09:24 AM",
    ago: "15 min ago",
    score: 58,
    officer: "Const. L. Ndlovu",
  },
  {
    priority: "Medium",
    id: "SOS-2025-05121-006",
    via: "via Community Report",
    type: "Emergency Community Report",
    safety: "Safe (For Now)",
    safetySub: "Information gathering",
    loc: "Alexandra, Johannesburg",
    locSub: "Gauteng",
    time: "09:20 AM",
    ago: "19 min ago",
    score: 42,
    officer: "Sgt. M. Dlamini",
  },
  {
    priority: "Medium",
    id: "SOS-2025-05121-007",
    via: "via NGO Partner",
    type: "Child Protection",
    safety: "At Risk",
    safetySub: "Monitoring required",
    loc: "Khayelitsha, Cape Town",
    locSub: "Western Cape",
    time: "09:18 AM",
    ago: "21 min ago",
    score: 47,
    officer: "Unassigned",
  },
  {
    priority: "High",
    id: "SOS-2025-05121-008",
    via: "via SOS App",
    type: "Sexual Assault",
    safety: "In Immediate Danger",
    safetySub: "Needs urgent response",
    loc: "Bloemfontein Central",
    locSub: "Free State",
    time: "09:13 AM",
    ago: "26 min ago",
    score: 91,
    officer: "Unassigned",
  },
];

const MOCK_RAPID_RECS = [
  {
    text: "Dispatch nearest GBV-trained unit immediately. Survivor safety at critical risk.",
    tag: "Critical",
    icon: Siren,
  },
  {
    text: "Engage survivor support NGO partner in area. Provide safe shelter & psychosocial support.",
    tag: "High",
    icon: Handshake,
  },
  {
    text: "Alert Child Welfare Services for possible minors. Ensure child protection protocols.",
    tag: "High",
    icon: Shield,
  },
  {
    text: "Document evidence digitally. Preserve text, call logs, photos, and location.",
    tag: "Medium",
    icon: FileCheck,
  },
];

const MOCK_RECENT_ALERTS = [
  {
    type: "Domestic Violence",
    loc: "Soweto, Johannesburg",
    sev: "Critical",
    time: "09:37 AM",
  },
  {
    type: "Sexual Assault",
    loc: "Durban Central",
    sev: "Critical",
    time: "09:35 AM",
  },
  {
    type: "Child Protection",
    loc: "Manenberg, Cape Town",
    sev: "High",
    time: "09:31 AM",
  },
  {
    type: "Trafficking Alert",
    loc: "Beitbridge Border Post",
    sev: "High",
    time: "09:29 AM",
  },
  {
    type: "Domestic Violence",
    loc: "Polokwane Central",
    sev: "Medium",
    time: "09:24 AM",
  },
];

const MOCK_CASE_KPIS = [
  {
    label: "Open Cases",
    value: "128",
    icon: Home,
    tone: "violet",
    delta: "18 from yesterday",
    dir: "up",
  },
  {
    label: "Under Review",
    value: "64",
    icon: FileText,
    tone: "sky",
    delta: "9 from yesterday",
    dir: "up",
  },
  {
    label: "Assigned Counselors",
    value: "43",
    icon: Users,
    tone: "cyan",
    delta: "7 from yesterday",
    dir: "up",
  },
  {
    label: "NGO Linked Cases",
    value: "76",
    icon: Handshake,
    tone: "emerald",
    delta: "11 from yesterday",
    dir: "up",
  },
] as const;

const MOCK_CASES = [
  {
    id: "AEGIS-2025-05121",
    alias: "Thandi K.",
    type: "Intimate Partner Violence",
    risk: "High",
    status: "In Review",
    officer: "Sgt. L. Dlamini",
    counselor: "N. Khumalo",
    ngo: "POWA",
    update: "21 May 2025 09:32 AM",
  },
  {
    id: "AEGIS-2025-05120",
    alias: "Lerato M.",
    type: "Sexual Assault",
    risk: "Critical",
    status: "Evidence Pending",
    officer: "Lt. M. Naidoo",
    counselor: "P. Zulu",
    ngo: "Rape Crisis SA",
    update: "21 May 2025 08:57 AM",
  },
  {
    id: "AEGIS-2025-05119",
    alias: "Amina B.",
    type: "Domestic Violence",
    risk: "High",
    status: "Follow-Up",
    officer: "Const. J. Mokoena",
    counselor: "L. van Wyk",
    ngo: "Thuthuzela Care",
    update: "21 May 2025 08:41 AM",
  },
  {
    id: "AEGIS-2025-05118",
    alias: "Zanele S.",
    type: "Child Protection",
    risk: "High",
    status: "New",
    officer: "Sgt. P. Ndlovu",
    counselor: "M. Dlamini",
    ngo: "Childline SA",
    update: "21 May 2025 08:19 AM",
  },
  {
    id: "AEGIS-2025-05117",
    alias: "Nokuthula P.",
    type: "Stalking / Harassment",
    risk: "Medium",
    status: "In Review",
    officer: "Sgt. A. Jacobs",
    counselor: "K. Govender",
    ngo: "POWA",
    update: "21 May 2025 07:56 AM",
  },
  {
    id: "AEGIS-2025-05116",
    alias: "Fatima H.",
    type: "Human Trafficking",
    risk: "Critical",
    status: "Evidence Pending",
    officer: "Lt. Z. Mthembu",
    counselor: "T. Mashaba",
    ngo: "A21",
    update: "21 May 2025 07:34 AM",
  },
  {
    id: "AEGIS-2025-05115",
    alias: "Nonhlanhla D.",
    type: "Elder Abuse",
    risk: "Medium",
    status: "Follow-Up",
    officer: "Const. B. Petersen",
    counselor: "S. Botha",
    ngo: "Silver Circle",
    update: "21 May 2025 06:58 AM",
  },
  {
    id: "AEGIS-2025-05114",
    alias: "Boitumelo R.",
    type: "Sexual Assault",
    risk: "High",
    status: "In Review",
    officer: "Sgt. L. Dlamini",
    counselor: "N. Khumalo",
    ngo: "Rape Crisis SA",
    update: "21 May 2025 06:21 AM",
  },
  {
    id: "AEGIS-2025-05113",
    alias: "Mpho T.",
    type: "Intimate Partner Violence",
    risk: "Medium",
    status: "Closed",
    officer: "Const. J. Mokoena",
    counselor: "P. Zulu",
    ngo: "Thuthuzela Care",
    update: "20 May 2025 11:48 PM",
  },
  {
    id: "AEGIS-2025-05112",
    alias: "Lebogang N.",
    type: "Child Protection",
    risk: "High",
    status: "Follow-Up",
    officer: "Sgt. P. Ndlovu",
    counselor: "L. van Wyk",
    ngo: "Childline SA",
    update: "20 May 2025 10:37 PM",
  },
];

const MOCK_TIMELINE = [
  {
    icon: Siren,
    title: "SOS Triggered",
    sub: "Mobile SOS alert received",
    date: "21 May 2025",
  },
  {
    icon: Users,
    title: "Officer Assigned",
    sub: "Sgt. L. Dlamini assigned",
    date: "21 May 2025",
  },
  {
    icon: Phone,
    title: "Survivor Contacted",
    sub: "Phone contact established",
    date: "21 May 2025",
  },
  {
    icon: Camera,
    title: "Evidence Uploaded",
    sub: "Photo evidence uploaded",
    date: "21 May 2025",
  },
  {
    icon: Users,
    title: "Counselor Linked",
    sub: "N. Khumalo linked",
    date: "21 May 2025",
  },
  {
    icon: Handshake,
    title: "NGO Referral",
    sub: "Referred to POWA",
    date: "21 May 2025",
  },
];

const MOCK_HIGH_RISK_SURVIVORS = [
  { name: "Thandi K.", id: "AEGIS-2025-05121", note: "Overdue" },
  { name: "Lerato M.", id: "AEGIS-2025-05120", note: "Due in 1 hr" },
  { name: "Zanele S.", id: "AEGIS-2025-05118", note: "Due in 2 hrs" },
];

const MOCK_WORKFLOW = [
  {
    n: 1,
    title: "Review Alert",
    sub: "Verify incident details, risk level, and survivor needs.",
    icon: FileText,
  },
  {
    n: 2,
    title: "Assign Unit",
    sub: "Select best available unit based on proximity and capacity.",
    icon: Users,
  },
  {
    n: 3,
    title: "Confirm Route",
    sub: "AI-optimized route and safety assessment.",
    icon: MapPin,
  },
  {
    n: 4,
    title: "Contact Survivor",
    sub: "Establish safe check-in and confirm plan.",
    icon: Phone,
  },
  {
    n: 5,
    title: "Close Dispatch",
    sub: "Complete response, update outcome and handoff if needed.",
    icon: ShieldCheck,
  },
];

const MOCK_PARTNER_KPIS = [
  {
    label: "Active NGO Referrals",
    value: "128",
    icon: Handshake,
    tone: "violet",
    delta: "18 from yesterday",
    dir: "up",
  },
  {
    label: "Counselors Linked",
    value: "96",
    icon: Users,
    tone: "sky",
    delta: "14 from yesterday",
    dir: "up",
  },
  {
    label: "Shelter Placements",
    value: "54",
    icon: Home,
    tone: "emerald",
    delta: "9 from yesterday",
    dir: "up",
  },
  {
    label: "Hospital Escalations",
    value: "25",
    icon: Stethoscope,
    tone: "rose",
    delta: "3 from yesterday",
    dir: "up",
  },
] as const;

const MOCK_PARTNER_BOARD = [
  {
    id: "AEGIS-2025-0519-042",
    ptype: "NGO",
    org: "SafeHome Trust",
    lead: "Nomsa Dlamini",
    phone: "+27 82 555 0184",
    service: "Emergency Shelter + Safety Planning",
    status: "Accepted",
    rt: "28m",
  },
  {
    id: "AEGIS-2025-0519-067",
    ptype: "Counselor",
    org: "Trauma Counseling Unit",
    lead: "Dr. Lerato Maseko",
    phone: "+27 83 221 7789",
    service: "Trauma Counseling + Case Support",
    status: "In Progress",
    rt: "1h 12m",
  },
  {
    id: "AEGIS-2025-0519-081",
    ptype: "Legal",
    org: "Women's Legal Aid",
    lead: "Adv. Priya Naidoo",
    phone: "+27 72 890 3341",
    service: "Legal Advice + Protection Order",
    status: "Pending",
    rt: "–",
  },
  {
    id: "AEGIS-2025-0519-093",
    ptype: "Shelter",
    org: "Hope Foundation Shelter",
    lead: "Fatima Khan",
    phone: "+27 76 456 2210",
    service: "Temporary Shelter + Meals",
    status: "Accepted",
    rt: "45m",
  },
  {
    id: "AEGIS-2025-0519-105",
    ptype: "Hospital",
    org: "City Hospital",
    lead: "Dr. Sipho Mbatha",
    phone: "+27 82 334 9911",
    service: "Medical Examination + Treatment",
    status: "In Progress",
    rt: "1h 35m",
  },
  {
    id: "AEGIS-2025-0519-118",
    ptype: "Counselor",
    org: "Healing Minds Collective",
    lead: "Lindiwe Zulu",
    phone: "+27 81 667 0033",
    service: "Psychological Support + Follow-up",
    status: "Pending",
    rt: "–",
  },
  {
    id: "AEGIS-2025-0519-129",
    ptype: "NGO",
    org: "SafeHome Trust",
    lead: "Nomsa Dlamini",
    phone: "+27 82 555 0184",
    service: "Economic Support + Skills Referral",
    status: "Completed",
    rt: "2h 10m",
  },
  {
    id: "AEGIS-2025-0519-136",
    ptype: "Legal",
    org: "Women's Legal Aid",
    lead: "Adv. Priya Naidoo",
    phone: "+27 72 890 3341",
    service: "Court Representation + Legal Aid",
    status: "In Progress",
    rt: "55m",
  },
];

const MOCK_SHARED_THREADS = [
  {
    org: "SafeHome Trust",
    ptype: "NGO",
    caseId: "AEGIS-2025-0519-042",
    msg: "Shelter bed confirmed. Transport arrang…",
    time: "09:36 AM",
    count: 2,
    icon: Handshake,
  },
  {
    org: "Trauma Counseling Unit",
    ptype: "Counselor",
    caseId: "AEGIS-2025-0519-067",
    msg: "Initial counseling session completed…",
    time: "09:21 AM",
    count: 1,
    icon: Users,
  },
  {
    org: "Women's Legal Aid",
    ptype: "Legal",
    caseId: "AEGIS-2025-0519-081",
    msg: "Documents received. Preparing draft…",
    time: "09:01 AM",
    count: 3,
    icon: Scale,
  },
  {
    org: "City Hospital",
    ptype: "Hospital",
    caseId: "AEGIS-2025-0519-105",
    msg: "Medical exam scheduled for 10:30 AM…",
    time: "08:47 AM",
    count: 1,
    icon: Stethoscope,
  },
];

const MOCK_PENDING_ACTIONS = [
  {
    org: "Women's Legal Aid",
    caseId: "AEGIS-2025-0519-081",
    task: "Submit legal advice and options.",
    due: "2h 18m",
    icon: Scale,
  },
  {
    org: "Hope Foundation Shelter",
    caseId: "AEGIS-2025-0519-093",
    task: "Confirm placement & transport.",
    due: "1h 05m",
    icon: Home,
  },
  {
    org: "City Hospital",
    caseId: "AEGIS-2025-0519-105",
    task: "Upload medical report.",
    due: "45m",
    icon: Stethoscope,
  },
  {
    org: "Healing Minds Collective",
    caseId: "AEGIS-2025-0519-118",
    task: "Schedule follow-up session.",
    due: "2h 30m",
    icon: Users,
  },
];

const MOCK_PARTNER_ACTIONS = [
  { label: "Refer to NGO", icon: Handshake, tone: "violet" },
  { label: "Assign Counselor", icon: Users, tone: "sky" },
  { label: "Request Shelter", icon: Home, tone: "emerald" },
  { label: "Escalate to Hospital", icon: Stethoscope, tone: "rose" },
  { label: "Request Legal Support", icon: Scale, tone: "amber" },
  { label: "New Coordination Request", icon: Plus, tone: "cyan" },
];

/* ============================== NAV / META ============================== */

const SECTION_META: Record<
  string,
  { title: string; subtitle: string; greeting?: boolean }
> = {
  overview: {
    title: "Welcome, Law Enforcement Command",
    subtitle:
      "Coordinated. Survivor-Centered. AI-Powered Response for a Safer Future.",
    greeting: true,
  },
  queue: {
    title: "Emergency Queue",
    subtitle:
      "Triage SOS alerts and urgent survivor incidents. Protect survivors. Act fast. Coordinate together.",
  },
  cases: {
    title: "Case Management",
    subtitle:
      "Track and manage survivor-centered law-enforcement cases from intake to resolution.",
  },
  dispatch: {
    title: "Dispatch Center",
    subtitle:
      "Coordinating field response and safe handoff operations for survivors.",
  },
  evidence: {
    title: "Evidence Center",
    subtitle:
      "Secure evidence review, integrity verification, and multilingual audio support for GBV and survivor-protection cases.",
  },
  partners: {
    title: "Partner Coordination",
    subtitle:
      "Survivor-centered inter-agency collaboration for coordinated case support and services.",
  },
  incidents: {
    title: "Incident Operations",
    subtitle:
      "Review live incidents, confirm priority, and route urgent field action.",
  },
  survivor: {
    title: "Survivor Safety",
    subtitle:
      "Monitor safety plans, check-ins, contact windows, and high-risk survivor follow-ups.",
  },
  messages: {
    title: "Secure Messages",
    subtitle:
      "Coordinate with responders, partner teams, and case workers from one secure queue.",
  },
  analytics: {
    title: "Police Analytics",
    subtitle:
      "Track risk patterns, response metrics, and operational performance.",
  },
  reports: {
    title: "Reports",
    subtitle:
      "Generate operational summaries, case exports, and compliance-ready reporting packs.",
  },
  settings: {
    title: "Settings",
    subtitle:
      "Manage portal preferences, responder availability, notifications, and security settings.",
  },
};

const NAV: {
  key: SectionKey | string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "queue", label: "Emergency Queue", icon: Siren },
  { key: "incidents", label: "Incidents", icon: AlertTriangle },
  { key: "cases", label: "Cases", icon: Home },
  { key: "dispatch", label: "Dispatch", icon: Radio },
  { key: "evidence", label: "Evidence", icon: FileCheck },
  { key: "survivor", label: "Survivor Safety", icon: ShieldCheck },
  { key: "messages", label: "Messages", icon: MessageSquare, badge: 12 },
  { key: "partners", label: "Partner Coordination", icon: Handshake },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const DETAILED: SectionKey[] = [
  "overview",
  "queue",
  "incidents",
  "cases",
  "dispatch",
  "evidence",
  "survivor",
  "messages",
  "partners",
  "analytics",
  "reports",
  "settings",
];

const WORKSPACE_SECTION_KEYS = [
  "incidents",
  "survivor",
  "messages",
  "analytics",
  "reports",
  "settings",
] as const;

type WorkspaceSectionKey = (typeof WORKSPACE_SECTION_KEYS)[number];

/* ============================== UI HELPERS ============================== */

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

const statusTone = (s: string) => {
  const v = s.toLowerCase();
  if (
    [
      "accepted",
      "completed",
      "verified",
      "intact",
      "confirmed",
      "on scene",
      "resolved",
      "healthy",
    ].includes(v)
  )
    return "emerald";
  if (
    [
      "in progress",
      "pending",
      "in review",
      "scheduled",
      "assigned",
      "dispatched",
      "en route",
      "medium",
      "follow-up",
      "evidence pending",
      "pending translation",
      "new",
    ].includes(v)
  )
    return v === "new" ? "violet" : "amber";
  if (
    [
      "critical",
      "high",
      "requires attention",
      "tampered",
      "in immediate danger",
      "overdue",
    ].includes(v)
  )
    return "rose";
  if (["at risk"].includes(v)) return "amber";
  if (["low", "safe (for now)", "info"].includes(v)) return "sky";
  return "slate";
};

/**
 * Shared portal context so section components (which are rendered without
 * props) can drive real navigation and open record detail views instead of
 * showing placeholder acknowledgements.
 */
type PolicePortalContextValue = {
  section: SectionKey;
  navigate: (section: SectionKey) => void;
};

const PolicePortalContext = createContext<PolicePortalContextValue | null>(
  null,
);

const usePolicePortal = (): PolicePortalContextValue => {
  const ctx = useContext(PolicePortalContext);
  if (!ctx) {
    throw new Error("usePolicePortal must be used within PolicePortal");
  }
  return ctx;
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

const Panel = ({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  subtitle?: string;
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
      <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="min-w-0">
          {title && (
            <h2 className="text-sm font-black tracking-tight text-white">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-slate-300">{subtitle}</p>
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
  icon: Icon,
  tone,
  delta,
  dir,
  note,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  delta?: string;
  dir?: string;
  note?: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-md">
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2",
          ICON_TONES[tone] ?? ICON_TONES.violet,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black text-white">{value}</p>
        {delta ? (
          <p
            className={cn(
              "mt-0.5 text-[11px] font-bold",
              dir === "down" ? "text-emerald-400" : "text-emerald-400",
            )}
          >
            {dir === "down" ? "▼" : "▲"} {delta}
          </p>
        ) : note ? (
          <p className="mt-0.5 text-[11px] text-slate-300">{note}</p>
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
        {centerLabel}
      </span>
      <span className="text-xl font-black text-white">{centerValue}</span>
    </div>
  </div>
);

const RiskRing = ({ score }: { score: number }) => {
  const color =
    score >= 90
      ? "#f43f5e"
      : score >= 70
        ? "#f59e0b"
        : score >= 50
          ? "#eab308"
          : "#10b981";
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-11 w-11 place-items-center">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#1e293b"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
        />
      </svg>
      <span className="absolute text-[11px] font-black text-white">
        {score}
      </span>
    </div>
  );
};

const tableHead =
  "border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-300";
const chartTooltip = {
  contentStyle: {
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 12,
  },
} as const;

/**
 * A compact dropdown chip. Pass `options`/`value`/`onChange` to drive a real
 * filter; without them it falls back to a self-contained selection so the
 * control still reflects the user's choice instead of doing nothing.
 */
const SelectChip = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options?: string[];
  value?: string;
  onChange?: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(value ?? label);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ?? internal;
  const items = options ?? [label, "Critical only", "High priority"];

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const choose = (option: string) => {
    if (onChange) onChange(option);
    else setInternal(option);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
        aria-expanded={open}
      >
        {selected}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-300 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-40 overflow-hidden rounded-lg border border-white/10 bg-[#0c1224] shadow-xl shadow-black/40">
          {items.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className={cn(
                "block w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-white/5",
                selected === option ? "text-violet-300" : "text-slate-300",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
/**
 * A "View all" affordance. When `target` points to another section it
 * navigates there; when the full list already renders in the current section
 * it confirms that rather than opening a dead-end popover.
 */
const LinkChip = ({
  label,
  target,
}: {
  label: string;
  target?: SectionKey;
}) => {
  const { section, navigate } = usePolicePortal();

  const handleClick = () => {
    if (target && target !== section) {
      navigate(target);
    } else {
      toast.info("Showing the full list below.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300"
    >
      {label}
      <ChevronRight className="h-3 w-3" />
    </button>
  );
};

const Pagination = ({ pages = ["1"] }: { pages?: string[] }) => {
  const isEllipsisPage = (page: string) =>
    page === "?" || page === "…" || page === "â€¦";
  const selectablePages = pages.filter((page) => !isEllipsisPage(page));
  const [activePage, setActivePage] = useState(selectablePages[0] ?? "1");
  const activeIndex = Math.max(0, selectablePages.indexOf(activePage));
  const setPage = (page: string) => {
    setActivePage(page);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setPage(selectablePages[0] ?? "1")}
        disabled={activeIndex === 0}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
      >
        <ChevronsLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() =>
          setPage(selectablePages[Math.max(0, activeIndex - 1)] ?? "1")
        }
        disabled={activeIndex === 0}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((page, index) => {
        const isEllipsis = isEllipsisPage(page);
        return (
          <button
            key={`${page}-${index}`}
            type="button"
            onClick={() => !isEllipsis && setPage(page)}
            disabled={isEllipsis}
            className={cn(
              "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[11px] font-bold disabled:cursor-default",
              page === activePage
                ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                : "border border-white/10 text-slate-300 hover:bg-white/5",
            )}
          >
            {page}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() =>
          setPage(
            selectablePages[
              Math.min(selectablePages.length - 1, activeIndex + 1)
            ] ?? activePage,
          )
        }
        disabled={activeIndex >= selectablePages.length - 1}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() =>
          setPage(selectablePages[selectablePages.length - 1] ?? activePage)
        }
        disabled={activeIndex >= selectablePages.length - 1}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
      >
        <ChevronsRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const Avatar = ({ name, tone = "violet" }: { name: string; tone?: string }) => (
  <div
    className={cn(
      "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10px] font-black",
      ICON_TONES[tone] ?? ICON_TONES.violet,
    )}
  >
    {name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase()}
  </div>
);

/** Maps quick-action labels to the section that handles them. */
const ACTION_TARGETS: { match: string; section: SectionKey }[] = [
  { match: "queue", section: "queue" },
  { match: "emergency", section: "queue" },
  { match: "evidence", section: "evidence" },
  { match: "dispatch", section: "dispatch" },
  { match: "unit", section: "dispatch" },
  { match: "officer", section: "dispatch" },
  { match: "route", section: "dispatch" },
  { match: "ngo", section: "partners" },
  { match: "counselor", section: "partners" },
  { match: "shelter", section: "partners" },
  { match: "hospital", section: "partners" },
  { match: "legal", section: "partners" },
  { match: "partner", section: "partners" },
  { match: "coordination", section: "partners" },
  { match: "contact survivor", section: "messages" },
  { match: "survivor", section: "survivor" },
  { match: "safety plan", section: "survivor" },
  { match: "welfare", section: "survivor" },
  { match: "report", section: "reports" },
  { match: "brief", section: "reports" },
  { match: "incident", section: "incidents" },
  { match: "message", section: "messages" },
  { match: "heat map", section: "analytics" },
  { match: "forecast", section: "analytics" },
  { match: "analytics", section: "analytics" },
];

const sectionForAction = (label: string): SectionKey | undefined =>
  ACTION_TARGETS.find((entry) => label.toLowerCase().includes(entry.match))
    ?.section;

const ActionBar = ({
  items,
}: {
  items: {
    label: string;
    icon: ComponentType<{ className?: string }>;
    tone: string;
  }[];
}) => {
  const { section, navigate } = usePolicePortal();

  const handleAction = (label: string) => {
    const target = sectionForAction(label);
    if (target && target !== section) {
      navigate(target);
    } else {
      toast.success(label);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => handleAction(a.label)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-left text-[11px] font-bold text-white transition-colors hover:border-white/20"
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                ICON_TONES[a.tone],
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
};

const SectionTitle = ({
  meta,
}: {
  meta: { title: string; subtitle: string };
}) => (
  <div className="flex items-center gap-3">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-violet-500/30 bg-violet-500/10 text-violet-300">
      <Shield className="h-5 w-5" />
    </div>
    <div>
      <h2 className="text-2xl font-black tracking-tight text-white">
        {meta.title}
      </h2>
      <p className="mt-0.5 text-sm text-slate-300">{meta.subtitle}</p>
    </div>
  </div>
);

/** Download an array of rows as a CSV file (browser only). */
const downloadCsv = (
  filename: string,
  header: string[],
  rows: (string | number)[][],
) => {
  if (typeof document === "undefined") return;
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const Toggle = ({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
  sub?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02]"
  >
    <div>
      <p className="text-sm font-bold text-white">{label}</p>
      {sub ? <p className="mt-1 text-xs text-slate-300">{sub}</p> : null}
    </div>
    <span
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        on
          ? "border-violet-400/50 bg-violet-500/40"
          : "border-white/15 bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white transition-all",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </span>
  </button>
);

const IncidentsSection = () => {
  const { navigate } = usePolicePortal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: escalations = [] } = useEscalationEvents({
    limit: 200,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const [handled, setHandled] = useState<Record<string, boolean>>({});

  const isOpen = (s: string) =>
    !["resolved", "closed", "acknowledged"].includes(s.toLowerCase());
  const sevRank = (s: string) =>
    s === "critical" ? 0 : s === "high" ? 1 : s === "medium" ? 2 : 3;
  const rows = [...escalations].sort(
    (a, b) =>
      sevRank((a.severity || "").toLowerCase()) -
      sevRank((b.severity || "").toLowerCase()),
  );

  const kpis = [
    {
      label: "Open Incidents",
      value: nf.format(
        escalations.filter((e) => isOpen(e.status || "")).length,
      ),
      icon: AlertTriangle,
      tone: "rose",
      note: "Live triage",
    },
    {
      label: "Critical",
      value: nf.format(
        escalations.filter(
          (e) => (e.severity || "").toLowerCase() === "critical",
        ).length,
      ),
      icon: Siren,
      tone: "amber",
      note: "Immediate action",
    },
    {
      label: "Acknowledged",
      value: nf.format(
        escalations.filter((e) => !isOpen(e.status || "")).length,
      ),
      icon: CheckCircle2,
      tone: "emerald",
      note: "Responder confirmed",
    },
    {
      label: "Total Tracked",
      value: nf.format(escalations.length),
      icon: Clock,
      tone: "sky",
      note: "All incidents",
    },
  ];

  const acknowledge = async (id: string) => {
    setHandled((current) => ({ ...current, [id]: true }));
    toast.success("Incident acknowledged");
    try {
      await acknowledgeEscalation(id, user?.id ?? "");
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
    } catch {
      toast.error("Couldn't save acknowledgement.");
    }
  };

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={hasSupabase ? k.value : NO_DATA}
            icon={k.icon}
            tone={k.tone}
            note={k.note}
          />
        ))}
      </section>
      <Panel
        title="Active Incidents"
        subtitle="Live incidents from SOS alerts and survivor/community reports — acknowledge or route to dispatch"
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-300">
            No live incidents right now. New SOS alerts and reports appear here
            in real time.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((e) => {
              const done = handled[e.id] || !isOpen(e.status || "");
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <Pill
                      tone={statusTone((e.severity || "medium").toLowerCase())}
                    >
                      {titleCase(e.severity || "medium")}
                    </Pill>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {titleCase(
                          (e.escalationType || "Incident").replace(/_/g, " "),
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        {e.reason || "—"}
                        {e.lat != null && e.lng != null
                          ? ` · ${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}`
                          : ""}
                        {e.triggeredAt
                          ? ` · ${fmtRelative(e.triggeredAt)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void acknowledge(e.id)}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/5"
                        >
                          Acknowledge
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("dispatch")}
                          className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white"
                        >
                          Dispatch
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
};

type SafetyRow = {
  key: string;
  escalationId?: string;
  caseLabel: string;
  severity: string;
  statusLabel: string;
  statusTone: string;
  escalation: string;
  reason: string;
  loc: string;
  when: string;
  officer: string;
  resolved: boolean;
};

const safetyStatusFor = (severity: string): { label: string; tone: string } => {
  const s = severity.toLowerCase();
  if (s === "critical") return { label: "In Immediate Danger", tone: "rose" };
  if (s === "high") return { label: "At Risk", tone: "amber" };
  if (s === "medium") return { label: "Monitoring", tone: "sky" };
  return { label: "Stable", tone: "emerald" };
};

const SurvivorSafetySection = () => {
  const { navigate } = usePolicePortal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: escalations = [] } = useEscalationEvents({
    limit: 200,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: officers = [] } = usePoliceOfficers({ limit: 200 });
  const officerName = (id: string) =>
    !id
      ? "Unassigned"
      : officers.find((o) => o.id === id)?.fullName || id.slice(0, 8);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});

  const persistAcknowledge = async (escalationId: string) => {
    try {
      await acknowledgeEscalation(escalationId, user?.id ?? "");
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
    } catch {
      toast.error("Couldn't save acknowledgement — please retry.");
    }
  };

  const sevRank = (s: string) =>
    s === "critical" ? 0 : s === "high" ? 1 : s === "medium" ? 2 : 3;

  const liveRows: SafetyRow[] = [...escalations]
    .sort(
      (a, b) =>
        sevRank(a.severity.toLowerCase()) - sevRank(b.severity.toLowerCase()),
    )
    .map((e) => {
      const status = safetyStatusFor(e.severity);
      const closed = ["acknowledged", "resolved", "closed"].includes(
        (e.status || "").toLowerCase(),
      );
      return {
        key: e.id,
        escalationId: e.id,
        caseLabel: e.caseId
          ? `AEG-${e.caseId.slice(0, 8).toUpperCase()}`
          : `ESC-${e.id.slice(0, 8).toUpperCase()}`,
        severity: titleCase(e.severity || "medium"),
        statusLabel: status.label,
        statusTone: status.tone,
        escalation: titleCase(
          (e.escalationType || "Escalation").replace(/_/g, " "),
        ),
        reason: e.reason || "—",
        loc:
          e.lat != null && e.lng != null
            ? `${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}`
            : "Location pending",
        when: e.triggeredAt ? fmtRelative(e.triggeredAt) : "—",
        officer: officerName(e.assignedTo),
        resolved: closed,
      };
    });

  const fallbackRows: SafetyRow[] = MOCK_QUEUE.map((q) => ({
    key: q.id,
    caseLabel: q.id,
    severity: q.priority,
    statusLabel: q.safety,
    statusTone: safetyStatusFor(q.priority).tone,
    escalation: q.type,
    reason: q.safetySub,
    loc: q.loc,
    when: q.ago,
    officer: q.officer,
    resolved: false,
  }));

  const rows = liveRows.length ? liveRows : ALLOW_MOCK ? fallbackRows : [];
  const isLive = liveRows.length > 0;

  const count = (predicate: (r: SafetyRow) => boolean) =>
    nf.format(rows.filter(predicate).length);
  const kpiValue = (live: string, sample: string) =>
    isLive ? live : ALLOW_MOCK ? sample : NO_DATA;

  const safetyKpis = [
    {
      label: "High-Risk Survivors",
      value: kpiValue(
        count((r) => ["Critical", "High"].includes(r.severity)),
        "12",
      ),
      icon: ShieldAlert,
      tone: "rose",
      note: "Critical & high severity",
    },
    {
      label: "Active Escalations",
      value: kpiValue(
        count((r) => !r.resolved),
        "39",
      ),
      icon: Siren,
      tone: "amber",
      note: "Awaiting response",
    },
    {
      label: "Acknowledged",
      value: kpiValue(
        count((r) => r.resolved),
        "28",
      ),
      icon: ShieldCheck,
      tone: "emerald",
      note: "Responder confirmed",
    },
    {
      label: "Total Tracked",
      value: kpiValue(nf.format(rows.length), "64"),
      icon: Users,
      tone: "sky",
      note: "Survivor safety events",
    },
  ];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {safetyKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            note={k.note}
          />
        ))}
      </section>
      <Panel
        title="Survivor Safety & Escalations"
        subtitle={
          isLive
            ? "Live risk status and escalation details from survivor reports and SOS alerts"
            : "Live risk status from survivor reports and SOS alerts"
        }
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-300">
            No survivor safety escalations right now. New SOS alerts and
            high-risk survivor reports appear here in real time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Safety Status</th>
                  <th className="px-4 py-3">Escalation</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Triggered</th>
                  <th className="px-4 py-3">Officer</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => {
                  const done = acknowledged[r.key] || r.resolved;
                  return (
                    <tr key={r.key} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-[11px] text-violet-300">
                        {r.caseLabel}
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={statusTone(r.severity)}>{r.severity}</Pill>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={r.statusTone}>{r.statusLabel}</Pill>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-white">{r.escalation}</p>
                        <p className="max-w-[220px] truncate text-[10px] text-slate-300">
                          {r.reason}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {r.loc}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-300">
                        {r.when}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {r.officer}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate("cases")}
                            className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5"
                          >
                            View Case
                          </button>
                          {done ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                              Acknowledged
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAcknowledged((current) => ({
                                  ...current,
                                  [r.key]: true,
                                }));
                                toast.success("Safety escalation acknowledged");
                                if (r.escalationId)
                                  void persistAcknowledge(r.escalationId);
                              }}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
};

const conversationTitle = (
  conv: SecureConversation,
  selfId: string,
  nameFor: (id: string) => string,
) => {
  if (conv.subject) return conv.subject;
  const others = conv.participants.filter((p) => p.userId !== selfId);
  if (others.length === 0) return "Just you";
  return others.map((p) => nameFor(p.userId)).join(", ");
};

const NewConversationModal = ({
  selfId,
  onClose,
  onCreated,
}: {
  selfId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) => {
  const { data: profiles = [] } = useUserProfiles({ limit: 200 });
  const [subject, setSubject] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const recipients = profiles.filter(
    (p) => p.id !== selfId && p.isActive !== false,
  );

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const create = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setBusy(true);
    try {
      const id = await startSecureConversation({
        subject: subject.trim() || null,
        caseId: caseRef.trim() || null,
        participantIds: selected,
      });
      toast.success("Conversation started");
      onCreated(id);
    } catch {
      toast.error("Couldn't start the conversation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="New secure conversation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">
            New secure conversation
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Message survivors, NGOs, counselors, and fellow officers.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            value={caseRef}
            onChange={(event) => setCaseRef(event.target.value)}
            placeholder="Case reference (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Recipients
            </p>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
              {recipients.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400">
                  No other users available to message yet.
                </p>
              ) : (
                recipients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-white/5",
                      selected.includes(p.id) && "bg-violet-500/15",
                    )}
                  >
                    <Avatar name={p.fullName || p.email || "User"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {p.fullName || p.email || "User"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        {p.role}
                      </p>
                    </div>
                    {selected.includes(p.id) && (
                      <CheckCircle2 className="h-4 w-4 text-violet-300" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start conversation"}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessagesSection = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const selfId = user?.id ?? "";
  const { data: profile } = useUserProfile(selfId || undefined);
  const { data: profiles = [] } = useUserProfiles({ limit: 200 });
  const { data: conversations = [] } = useSecureConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);

  const nameFor = (id: string) => {
    if (id === selfId) return "You";
    const p = profiles.find((x) => x.id === id);
    return p?.fullName || p?.email || id.slice(0, 8);
  };

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;
  const { data: messages = [] } = useSecureMessages(activeId);

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    if (!activeId || !selfId) return;
    void markConversationRead(activeId, selfId).then(() => {
      void queryClient.invalidateQueries({
        queryKey: SECURE_CONVERSATIONS_KEY,
      });
    });
  }, [activeId, selfId, queryClient, messages.length]);

  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("secure-messages-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "secure_messages" },
        (payload) => {
          const row = payload.new as { conversation_id?: string };
          void queryClient.invalidateQueries({
            queryKey: SECURE_CONVERSATIONS_KEY,
          });
          if (row.conversation_id) {
            void queryClient.invalidateQueries({
              queryKey: secureMessagesKey(row.conversation_id),
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const send = async () => {
    const body = draft.trim();
    if (!activeId) {
      toast.error("Select a conversation first");
      return;
    }
    if (!body || !selfId) {
      if (!body) toast.error("Message is empty");
      return;
    }
    setDraft("");
    try {
      await sendSecureMessage({
        conversationId: activeId,
        senderId: selfId,
        senderRole: profile?.role ?? null,
        body,
      });
      void queryClient.invalidateQueries({
        queryKey: secureMessagesKey(activeId),
      });
      void queryClient.invalidateQueries({
        queryKey: SECURE_CONVERSATIONS_KEY,
      });
    } catch {
      setDraft(body);
      toast.error("Couldn't send message");
    }
  };

  const unreadCount = conversations.filter((c) =>
    isConversationUnread(c, selfId),
  ).length;
  const participantCount = new Set(
    conversations.flatMap((c) => c.participants.map((p) => p.userId)),
  ).size;

  const messagesKpis = [
    {
      label: "Conversations",
      value: hasSupabase ? nf.format(conversations.length) : NO_DATA,
      icon: MessageSquare,
      tone: "violet",
      note: "Secure threads",
    },
    {
      label: "Unread",
      value: hasSupabase ? nf.format(unreadCount) : NO_DATA,
      icon: Bell,
      tone: "amber",
      note: "Awaiting your reply",
    },
    {
      label: "Participants",
      value: hasSupabase ? nf.format(participantCount) : NO_DATA,
      icon: Users,
      tone: "sky",
      note: "Across all threads",
    },
    {
      label: "Channel",
      value: "Live",
      icon: Radio,
      tone: "emerald",
      note: "Realtime encrypted",
    },
  ];

  return (
    <>
      {composing && (
        <NewConversationModal
          selfId={selfId}
          onClose={() => setComposing(false)}
          onCreated={(id) => {
            setComposing(false);
            void queryClient.invalidateQueries({
              queryKey: SECURE_CONVERSATIONS_KEY,
            });
            setActiveId(id);
          }}
        />
      )}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {messagesKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            note={k.note}
          />
        ))}
      </section>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New Conversation
        </button>
      </div>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Conversations" bodyClassName="p-0">
          {conversations.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-300">
              No conversations yet. Start one to message survivors, NGOs,
              counselors, or fellow officers.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {conversations.map((conv) => {
                const unread = isConversationUnread(conv, selfId);
                const title = conversationTitle(conv, selfId, nameFor);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setActiveId(conv.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]",
                      conv.id === activeId && "bg-white/[0.05]",
                    )}
                  >
                    <Avatar name={title} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {title}
                      </p>
                      <p className="truncate text-xs text-slate-300">
                        {conv.caseId ? `Case ${conv.caseId} · ` : ""}
                        {conv.participants.length} participant
                        {conv.participants.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-slate-400">
                        {fmtRelative(conv.lastMessageAt)}
                      </span>
                      {unread && (
                        <span className="h-2 w-2 rounded-full bg-violet-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel
          title={
            activeConversation
              ? conversationTitle(activeConversation, selfId, nameFor)
              : "Conversation"
          }
          subtitle={
            activeConversation?.caseId
              ? `Case ${activeConversation.caseId}`
              : activeConversation
                ? `${activeConversation.participants.length} participants`
                : "Select a conversation"
          }
          bodyClassName="flex h-[520px] flex-col"
        >
          <div className="flex-1 space-y-3 overflow-y-auto">
            {!activeConversation ? (
              <p className="py-10 text-center text-xs text-slate-400">
                Select or start a conversation to view messages.
              </p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                No messages yet. Say hello.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === selfId;
                return (
                  <div
                    key={m.id}
                    className={cn("max-w-[80%]", mine && "ml-auto")}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[10px] font-bold text-violet-300">
                        {nameFor(m.senderId)}
                        {m.senderRole ? ` · ${titleCase(m.senderRole)}` : ""}
                      </p>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2 text-sm",
                        mine
                          ? "rounded-tr-sm bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                          : "rounded-tl-sm border border-white/10 bg-white/[0.04] text-slate-200",
                      )}
                    >
                      {m.body}
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-[9px] text-slate-500",
                        mine && "text-right",
                      )}
                    >
                      {fmtRelative(m.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder={
                activeConversation
                  ? "Type a secure message…"
                  : "Select a conversation first"
              }
              disabled={!activeConversation}
              className="h-10 border-white/10 bg-slate-900/60 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!activeConversation}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </Panel>
      </section>
    </>
  );
};

const dayKey = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** Build a 7-day incident/case volume series ending today. */
const buildVolumeSeries = (
  escalations: { triggeredAt?: string | null }[],
  cases: { createdAt?: string | null }[],
) => {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString([], { weekday: "short" }),
    });
  }
  return days.map((day) => ({
    t: day.label,
    incidents: escalations.filter((e) => dayKey(e.triggeredAt) === day.key)
      .length,
    cases: cases.filter((c) => dayKey(c.createdAt) === day.key).length,
  }));
};

const AnalyticsSection = () => {
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: escalations = [] } = useEscalationEvents({
    limit: 500,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const total = cases.length;
  const breakdown = POLICE_CASE_STATUS.map((bucket) => {
    const value = cases.filter((c) =>
      bucket.match.includes((c.status || "").toLowerCase()),
    ).length;
    return {
      name: bucket.name,
      value,
      color: bucket.color,
      pct: total ? `${Math.round((value / total) * 100)}%` : "0%",
    };
  });
  const series = buildVolumeSeries(escalations, cases);

  const openCases = cases.filter(
    (c) => !["closed", "resolved"].includes((c.status || "").toLowerCase()),
  ).length;
  const activeEscalations = escalations.filter(
    (e) => !["resolved", "closed"].includes((e.status || "").toLowerCase()),
  ).length;
  const critical = cases.filter((c) =>
    ["critical", "high"].includes((c.riskLevel || "").toLowerCase()),
  ).length;

  const kpis = [
    {
      label: "Total Cases",
      value: nf.format(total),
      icon: BarChart3,
      tone: "violet",
    },
    {
      label: "Open Cases",
      value: nf.format(openCases),
      icon: FileText,
      tone: "sky",
    },
    {
      label: "Active Escalations",
      value: nf.format(activeEscalations),
      icon: Siren,
      tone: "amber",
    },
    {
      label: "High / Critical",
      value: nf.format(critical),
      icon: ShieldAlert,
      tone: "rose",
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      "police-incident-volume.csv",
      ["Day", "Incidents", "Cases"],
      series.map((point) => [point.t, point.incidents, point.cases]),
    );
    toast.success("Analytics exported");
  };

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={hasSupabase ? k.value : NO_DATA}
            icon={k.icon}
            tone={k.tone}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <Panel
          title="Incident & Case Volume (7 days)"
          subtitle="Escalations and new cases per day"
          action={
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-300 hover:bg-violet-500/20"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="t" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
              <Tooltip {...chartTooltip} />
              <Line
                type="monotone"
                dataKey="incidents"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cases"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Case Status Breakdown" bodyClassName="p-0">
          {total === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-300">
              No case data yet.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {breakdown.map((status) => (
                <div
                  key={status.name}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-200">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: status.color }}
                    />
                    {status.name}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {nf.format(status.value)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">
                      {status.pct}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </>
  );
};

const ReportsSection = () => {
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
  });
  const { data: escalations = [] } = useEscalationEvents({
    limit: 500,
    staleTime: 10000,
  });

  const resolved = cases.filter((c) =>
    ["closed", "resolved"].includes((c.status || "").toLowerCase()),
  ).length;

  const kpis = [
    {
      label: "Cases",
      value: nf.format(cases.length),
      icon: FileText,
      tone: "violet",
    },
    {
      label: "Escalations",
      value: nf.format(escalations.length),
      icon: Siren,
      tone: "amber",
    },
    {
      label: "Resolved",
      value: nf.format(resolved),
      icon: CheckCircle2,
      tone: "emerald",
    },
    { label: "Datasets", value: "3", icon: Download, tone: "sky" },
  ];

  const exportCases = () =>
    downloadCsv(
      "aegis-case-register.csv",
      ["Case ID", "Status", "Risk", "Priority", "Source", "Created"],
      cases.map((c) => [
        c.id,
        c.status || "",
        c.riskLevel || "",
        c.priority || "",
        c.source || "",
        c.createdAt || "",
      ]),
    );

  const exportEscalations = () =>
    downloadCsv(
      "aegis-escalation-log.csv",
      ["Escalation ID", "Type", "Severity", "Status", "Triggered"],
      escalations.map((e) => [
        e.id,
        e.escalationType || "",
        e.severity || "",
        e.status || "",
        e.triggeredAt || "",
      ]),
    );

  const exportStatusSummary = () => {
    const total = cases.length;
    downloadCsv(
      "aegis-case-status-summary.csv",
      ["Status", "Count", "Percent"],
      POLICE_CASE_STATUS.map((bucket) => {
        const value = cases.filter((c) =>
          bucket.match.includes((c.status || "").toLowerCase()),
        ).length;
        return [
          bucket.name,
          value,
          total ? `${Math.round((value / total) * 100)}%` : "0%",
        ];
      }),
    );
  };

  const reports = [
    {
      key: "cases",
      title: "Case Register",
      detail: `${nf.format(cases.length)} cases · all fields`,
      run: exportCases,
    },
    {
      key: "escalations",
      title: "Escalation Log",
      detail: `${nf.format(escalations.length)} escalations · SOS & incidents`,
      run: exportEscalations,
    },
    {
      key: "status",
      title: "Case Status Summary",
      detail: "Counts and percentages by status",
      run: exportStatusSummary,
    },
  ];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={hasSupabase ? k.value : NO_DATA}
            icon={k.icon}
            tone={k.tone}
          />
        ))}
      </section>
      <Panel
        title="Reports Workspace"
        subtitle="Export court-ready CSVs from live operational data"
        bodyClassName="p-0"
      >
        <div className="divide-y divide-white/5">
          {reports.map((report) => (
            <div
              key={report.key}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="text-sm font-bold text-white">{report.title}</p>
                <p className="mt-1 text-xs text-slate-300">{report.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  report.run();
                  toast.success(`${report.title} exported`);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/5"
              >
                <Download className="h-3.5 w-3.5" /> Download CSV
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
};

const LANGUAGE_OPTIONS: { label: string; code: string }[] = [
  { label: "English", code: "en" },
  { label: "isiZulu", code: "zu" },
  { label: "Afrikaans", code: "af" },
  { label: "Sesotho", code: "st" },
];

const SettingsSection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: saved } = useResponderSettings(user?.id);

  const [criticalPush, setCriticalPush] = useState(true);
  const [caseAssign, setCaseAssign] = useState(true);
  const [auditVisibility, setAuditVisibility] = useState(true);
  const [available, setAvailable] = useState(true);
  const [languageCode, setLanguageCode] = useState("en");
  const [saving, setSaving] = useState(false);

  // Adopt persisted values once they load.
  useEffect(() => {
    if (!saved) return;
    setCriticalPush(saved.criticalPush);
    setCaseAssign(saved.caseAssignmentPush);
    setAuditVisibility(saved.auditVisibility);
    setAvailable(saved.available);
  }, [saved]);

  const save = async () => {
    if (!user?.id) {
      toast.error("Sign in to save preferences");
      return;
    }
    setSaving(true);
    try {
      await saveResponderSettings(user.id, {
        criticalPush,
        caseAssignmentPush: caseAssign,
        auditVisibility,
        available,
      });
      await persistPreferredLanguage(languageCode);
      void queryClient.invalidateQueries({
        queryKey: responderSettingsKey(user.id),
      });
      toast.success("Preferences saved");
    } catch {
      toast.error("Couldn't save preferences — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "Notifications",
            value: criticalPush ? "On" : "Off",
            icon: Bell,
            tone: "violet",
            note: "Critical alerts",
          },
          {
            label: "Language",
            value: languageCode.toUpperCase(),
            icon: Globe,
            tone: "sky",
            note: "Portal default",
          },
          {
            label: "Security",
            value: "MFA",
            icon: Shield,
            tone: "emerald",
            note: "Enforced",
          },
          {
            label: "Availability",
            value: available ? "Online" : "Offline",
            icon: Radio,
            tone: "amber",
            note: available ? "Responder online" : "Responder offline",
          },
        ].map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            note={k.note}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Notifications" bodyClassName="p-0">
          <div className="divide-y divide-white/5">
            <Toggle
              on={criticalPush}
              onChange={setCriticalPush}
              label="Critical alert push"
              sub="SOS and high-risk escalations"
            />
            <Toggle
              on={caseAssign}
              onChange={setCaseAssign}
              label="Case assignment notifications"
              sub="Immediate dashboard and push updates"
            />
            <Toggle
              on={auditVisibility}
              onChange={setAuditVisibility}
              label="Audit visibility"
              sub="Staff actions are logged for accountability"
            />
          </div>
        </Panel>
        <Panel title="Responder Profile">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Availability
              </p>
              <div className="mt-2 flex gap-2">
                {[
                  { label: "Online", value: true },
                  { label: "Offline", value: false },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setAvailable(option.value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold",
                      available === option.value
                        ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                        : "border-white/10 text-slate-300 hover:bg-white/5",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Portal language
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setLanguageCode(option.code)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[11px] font-bold",
                      languageCode === option.code
                        ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                        : "border-white/10 text-slate-300 hover:bg-white/5",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              <SettingsIcon className="h-3.5 w-3.5" />{" "}
              {saving ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </Panel>
      </section>
    </>
  );
};

const OperationalWorkspaceSection = ({
  section,
}: {
  section: WorkspaceSectionKey;
}) => {
  switch (section) {
    case "incidents":
      return <IncidentsSection />;
    case "survivor":
      return <SurvivorSafetySection />;
    case "messages":
      return <MessagesSection />;
    case "analytics":
      return <AnalyticsSection />;
    case "reports":
      return <ReportsSection />;
    case "settings":
      return <SettingsSection />;
    default:
      return null;
  }
};

/* ================================ PORTAL ================================ */

const PolicePortal: React.FC = () => {
  const [section, setSection] = useState<SectionKey>("overview");
  const [caseQuery, setCaseQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const portalContext = useMemo<PolicePortalContextValue>(
    () => ({
      section,
      navigate: setSection,
    }),
    [section],
  );
  const [now, setNow] = useState(() => new Date());
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = SECTION_META[section] ?? { title: "Section", subtitle: "" };

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
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

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
    <PolicePortalContext.Provider value={portalContext}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#070b18] text-slate-50">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0a0f1f] lg:flex">
          <div className="flex items-center gap-3 px-5 py-5">
            <svg
              viewBox="0 0 40 40"
              className="h-9 w-9 shrink-0"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="aegis-police" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
              </defs>
              <path d="M20 2 L36 11 L20 38 L4 11 Z" fill="url(#aegis-police)" />
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
                Police Response Portal
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSection(item.key as SectionKey)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all",
                    active
                      ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-white" : "text-slate-300",
                    )}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500/20 px-1 text-[10px] font-black text-violet-300">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="px-4 pb-5">
            <div className="rounded-xl border border-white/10 bg-gradient-to-b from-violet-500/10 to-transparent p-4 text-center">
              <p className="text-sm font-black tracking-wide text-white">
                AEGIS-AI
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300">
                AI-Enhanced · Survivor-Centered
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-300">
                Safer Together
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0f1f]/80 px-4 backdrop-blur-xl md:px-6">
            <div className="relative hidden max-w-md flex-1 lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input
                value={caseQuery}
                onChange={(event) => setCaseQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setSection("cases");
                }}
                placeholder="Search cases, survivors, locations, or officers..."
                className="h-9 border-white/10 bg-slate-900/60 pl-10 pr-12 text-sm text-white placeholder:text-slate-300"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 text-[10px] text-slate-300">
                ⌘K
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 md:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                LIVE <span className="text-slate-300">System Operational</span>{" "}
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <button
                type="button"
                onClick={() => setSection("queue")}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                  7
                </span>
              </button>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-xs font-bold text-white">
                  {now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-[10px] text-slate-300">
                  {now.toLocaleDateString([], {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSection("settings")}
                className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-300 hover:text-white md:flex"
              >
                <Globe className="h-4 w-4" /> English{" "}
                <ChevronDown className="h-3 w-3" />
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
                  <Avatar name={account.name} />
                  <div className="hidden text-left leading-tight lg:block">
                    <p className="text-sm font-bold text-white">
                      {account.name}
                    </p>
                    <p className="text-[10px] text-slate-300">{account.role}</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "hidden h-4 w-4 text-slate-300 transition-transform lg:block",
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
            {DETAILED.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors",
                  section === key
                    ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                    : "text-slate-300 hover:text-white",
                )}
              >
                {key}
              </button>
            ))}
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
              {section === "overview" && <OverviewSection />}
              {section === "queue" && (
                <>
                  <SectionTitle meta={meta} />
                  <QueueSection />
                </>
              )}
              {section === "cases" && (
                <>
                  <SectionTitle meta={meta} />
                  <CasesSection
                    query={caseQuery}
                    onQueryChange={setCaseQuery}
                  />
                </>
              )}
              {section === "dispatch" && (
                <>
                  <SectionTitle meta={meta} />
                  <DispatchSection />
                </>
              )}
              {section === "evidence" && (
                <>
                  <SectionTitle meta={meta} />
                  <EvidenceSection />
                </>
              )}
              {section === "partners" && (
                <>
                  <SectionTitle meta={meta} />
                  <PartnersSection />
                </>
              )}
              {WORKSPACE_SECTION_KEYS.includes(
                section as WorkspaceSectionKey,
              ) && (
                <>
                  <SectionTitle meta={meta} />
                  <OperationalWorkspaceSection
                    section={section as WorkspaceSectionKey}
                  />
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </PolicePortalContext.Provider>
  );
};

/* =============================== Overview =============================== */

type EscalationLike = {
  id: string;
  severity: string;
  escalationType: string;
  lat: number | null;
  lng: number | null;
};

/** Plot escalations that carry GPS as points on the risk map. */
const buildEscalationRegions = (escalations: EscalationLike[]): MapRegion[] =>
  escalations
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({
      id: e.id,
      name: `SOS-${e.id.slice(0, 8).toUpperCase()}`,
      country: titleCase((e.escalationType || "Incident").replace(/_/g, " ")),
      riskLevel: (["critical", "high", "medium", "low"].includes(
        (e.severity || "").toLowerCase(),
      )
        ? (e.severity || "").toLowerCase()
        : "medium") as MapRegion["riskLevel"],
      incidents: 1,
      lat: e.lat as number,
      lng: e.lng as number,
    }));

const OverviewSection = () => {
  const { navigate } = usePolicePortal();
  const { data: sm } = useSystemMetrics({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: regions = [] } = useRegions({ limit: 200 });
  const { data: audit = [] } = useAuditLogs({ limit: 5, staleTime: 30000 });
  const { data: alerts = [] } = useAlertsFeed({ limit: 3, staleTime: 30000 });
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: services = [] } = usePlatformServices({ staleTime: 30000 });
  const { data: escalations = [] } = useEscalationEvents({
    limit: 200,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const isHigh = (c: { riskLevel: string }) =>
    ["critical", "high"].includes((c.riskLevel || "").toLowerCase());
  const activeEmergencies = escalations.filter(
    (e) => !["resolved", "closed"].includes((e.status || "").toLowerCase()),
  ).length;

  const kpis = MOCK_OVERVIEW_KPIS.map((k) => {
    if (k.label === "Average Response Time" && sm?.avgResponseTime)
      return { ...k, value: sm.avgResponseTime };
    if (k.label === "Assigned Officers" && sm?.agentsOnline != null)
      return { ...k, value: nf.format(sm.agentsOnline) };
    if (k.label === "SOS Alerts Today") {
      if (escalations.length)
        return { ...k, value: nf.format(escalations.length) };
      if (sm?.activeAlerts != null)
        return { ...k, value: nf.format(sm.activeAlerts) };
    }
    if (k.label === "Active Emergencies" && escalations.length)
      return { ...k, value: nf.format(activeEmergencies) };
    if (k.label === "Critical GBV Cases" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) => (c.riskLevel || "").toLowerCase() === "critical")
            .length,
        ),
      };
    if (k.label === "High-Risk Cases" && cases.length)
      return { ...k, value: nf.format(cases.filter(isHigh).length) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  const casesByStatus = cases.length
    ? POLICE_CASE_STATUS.map((s) => ({
        name: s.name,
        value: cases.filter((c) =>
          s.match.includes((c.status || "").toLowerCase()),
        ).length,
        color: s.color,
      })).filter((s) => s.value > 0)
    : ALLOW_MOCK
      ? MOCK_CASES_BY_STATUS.map((c) => ({
          name: c.name,
          value: c.value,
          color: c.color,
        }))
      : [];
  const casesByStatusTotal = casesByStatus.reduce((sum, c) => sum + c.value, 0);

  const systemOps = services.length
    ? services.map((s) => ({ name: s.name, status: s.status }))
    : ALLOW_MOCK
      ? MOCK_SYSTEM_OPS.map((s) => ({ name: s.name, status: "healthy" }))
      : [];
  const locatedRegions = buildEscalationRegions(escalations);
  const mapRegions: MapRegion[] = locatedRegions.length
    ? locatedRegions
    : mockList(regions, MOCK_SA_MAP);
  const activity = audit.length
    ? audit.slice(0, 5).map((a, i) => ({
        key: i,
        icon:
          a.severity === "critical"
            ? ShieldAlert
            : a.severity === "warning"
              ? AlertTriangle
              : FileText,
        tone:
          a.severity === "critical"
            ? "rose"
            : a.severity === "warning"
              ? "amber"
              : "violet",
        title: a.action,
        sub: a.description || `${a.module} · ${a.user || "system"}`,
        time: fmtRelative(a.time),
      }))
    : ALLOW_MOCK
      ? MOCK_RECENT_ACTIVITY.map((a, i) => ({ key: i, ...a }))
      : [];
  const criticalAlerts = alerts.length
    ? alerts.slice(0, 3).map((a, i) => ({
        key: i,
        title: a.type || a.message,
        desc: a.message || a.module,
        time: fmtRelative(a.time),
        tone:
          (a.status || "").toLowerCase() === "critical"
            ? "rose"
            : (a.status || "").toLowerCase() === "info"
              ? "violet"
              : "amber",
      }))
    : ALLOW_MOCK
      ? MOCK_CRITICAL_ALERTS.map((a, i) => ({ key: i, ...a }))
      : [];

  return (
    <>
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white md:text-3xl">
          <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-violet-500/30 bg-violet-500/10 text-violet-300">
            <Shield className="h-5 w-5" />
          </span>
          Welcome, Law Enforcement Command
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Coordinated. Survivor-Centered. AI-Powered Response for a Safer
          Future.
        </p>
      </div>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            dir={"dir" in k ? k.dir : undefined}
            note={"note" in k ? k.note : undefined}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Live Case Activity"
          action={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                Live
              </span>
              <SelectChip
                label="Last 24 Hours"
                options={["Last 24 Hours", "Last 7 Days", "Last 30 Days"]}
              />
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-3">
            {[
              ["SOS Alerts", "#f43f5e"],
              ["Domestic Violence", "#a855f7"],
              ["Sexual Assault", "#3b82f6"],
              ["Child Protection", "#f59e0b"],
              ["Trafficking Alerts", "#06b6d4"],
            ].map(([l, c]) => (
              <span
                key={l}
                className="flex items-center gap-1.5 text-[10px] text-slate-300"
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
            <LineChart data={MOCK_CASE_ACTIVITY}>
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="t"
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
                dataKey="sos"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="dv"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sa"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cp"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="traf"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="AEGIS Response Map – Southern Africa"
          action={<LinkChip label="View Map Details" target="analytics" />}
        >
          <WorldRiskMap
            regions={mapRegions}
            height={300}
            center={[-20, 27]}
            zoom={4}
          />
        </Panel>

        <Panel
          title="AEGIS System Operations"
          subtitle="All core services are operational"
          action={<LinkChip label="View Status" target="analytics" />}
        >
          <div className="space-y-2.5">
            {systemOps.length ? (
              systemOps.map((s) => {
                const healthy =
                  s.status === "healthy" || s.status === "operational";
                return (
                  <div
                    key={s.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={cn(
                          "h-4 w-4",
                          healthy ? "text-violet-300" : "text-amber-300",
                        )}
                      />
                      <span className="text-xs font-medium text-slate-300">
                        {s.name}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-bold",
                        healthy ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {healthy ? "Healthy" : titleCase(s.status)}{" "}
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="py-4 text-center text-xs text-slate-300">
                No service data yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate("analytics")}
              className="mt-1 w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
            >
              View System Status
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Panel title="Cases by Status">
          {casesByStatus.length ? (
            <>
              <Donut
                data={casesByStatus}
                centerValue={nf.format(casesByStatusTotal)}
                centerLabel="Total"
              />
              <div className="mt-2 space-y-1">
                {casesByStatus.map((c) => (
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
                      {c.value}{" "}
                      <span className="font-medium text-slate-300">
                        (
                        {casesByStatusTotal
                          ? Math.round((c.value / casesByStatusTotal) * 100)
                          : 0}
                        %)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="grid place-items-center py-12 text-center text-xs text-slate-300">
              No case data yet.
            </p>
          )}
        </Panel>

        <Panel
          title="AEGIS-AI Insights"
          subtitle="Smart insights from platform data"
          className="xl:col-span-1"
          action={<LinkChip label="View all" target="analytics" />}
        >
          <div className="grid grid-cols-1 gap-2.5">
            {MOCK_AI_INSIGHTS.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.title}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-lg border",
                        ICON_TONES[a.tone],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-lg font-black text-white">
                      {a.value}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-white">
                    {a.title}
                  </p>
                  <p className="text-[10px] text-slate-300">{a.sub}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Recent Activity"
          subtitle="Live system activity feed"
          action={<LinkChip label="View all" target="incidents" />}
        >
          <div className="space-y-3">
            {activity.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                      ICON_TONES[a.tone],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {a.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-300">
                      {a.sub}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-300">{a.time}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Critical Alerts"
          action={<LinkChip label="View All" target="queue" />}
        >
          <div className="space-y-2.5">
            {criticalAlerts.map((a) => (
              <div
                key={a.key}
                className={cn(
                  "rounded-xl border p-3",
                  a.tone === "rose"
                    ? "border-rose-500/20 bg-rose-500/5"
                    : a.tone === "amber"
                      ? "border-amber-500/20 bg-amber-500/5"
                      : "border-violet-500/20 bg-violet-500/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        a.tone === "rose"
                          ? "text-rose-400"
                          : a.tone === "amber"
                            ? "text-amber-400"
                            : "text-violet-400",
                      )}
                    />
                    <p className="text-xs font-bold text-white">{a.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-300">
                    {a.time}
                  </span>
                </div>
                <p className="mt-1 pl-6 text-[10px] text-slate-300">{a.desc}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <ActionBar items={[...MOCK_OVERVIEW_ACTIONS]} />
    </>
  );
};

/* =============================== Emergency Queue =============================== */

const QueueSection = () => {
  const { navigate } = usePolicePortal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: escalations = [] } = useEscalationEvents({
    limit: 200,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: officers = [] } = usePoliceOfficers({ limit: 200 });
  const { data: alerts = [] } = useAlertsFeed({ limit: 6, staleTime: 30000 });
  const { data: triageNotes = [] } = useTriageNotes();
  const officerName = (id: string) =>
    !id
      ? "Unassigned"
      : officers.find((o) => o.id === id)?.fullName || id.slice(0, 8);
  const [triageNote, setTriageNote] = useState("");
  const [dispatched, setDispatched] = useState<Record<string, boolean>>({});
  const [escalated, setEscalated] = useState<Record<string, boolean>>({});

  const sevRank = (s: string) => (s === "critical" ? 0 : s === "high" ? 1 : 2);
  const queueRows = escalations.length
    ? [...escalations]
        .sort(
          (a, b) =>
            sevRank((a.severity || "").toLowerCase()) -
            sevRank((b.severity || "").toLowerCase()),
        )
        .map((e) => {
          const sev = (e.severity || "").toLowerCase();
          const priority =
            sev === "critical"
              ? "Critical"
              : sev === "high"
                ? "High"
                : "Medium";
          const danger = sev === "critical";
          return {
            priority,
            id: `SOS-${e.id.slice(0, 8).toUpperCase()}`,
            via: `via ${titleCase((e.escalationType || "alert").replace(/_/g, " "))}`,
            type: titleCase(
              (e.escalationType || "Emergency").replace(/_/g, " "),
            ),
            safety: danger
              ? "In Immediate Danger"
              : sev === "high"
                ? "At Risk"
                : "Safe (For Now)",
            safetySub: danger
              ? "Needs urgent response"
              : sev === "high"
                ? "Monitoring required"
                : "Follow-up required",
            loc:
              e.lat != null && e.lng != null
                ? `${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}`
                : "Location pending",
            locSub: titleCase(e.status || ""),
            time: e.triggeredAt ? fmtDateTime(e.triggeredAt) : "—",
            ago: e.triggeredAt ? fmtRelative(e.triggeredAt) : "",
            score: sev === "critical" ? 95 : sev === "high" ? 78 : 55,
            officer: officerName(e.assignedTo),
            escalationId: e.id as string | undefined,
            rawStatus: (e.status || "").toLowerCase(),
          };
        })
    : ALLOW_MOCK
      ? MOCK_QUEUE.map((q) => ({
          ...q,
          escalationId: undefined as string | undefined,
          rawStatus: "",
        }))
      : [];

  const persistDispatch = async (escalationId: string) => {
    try {
      await dispatchEscalation(escalationId, user?.id ?? "");
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
    } catch {
      toast.error("Couldn't save dispatch — please retry.");
    }
  };
  const persistEscalate = async (escalationId: string) => {
    try {
      await escalateEscalation(escalationId);
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
    } catch {
      toast.error("Couldn't save escalation — please retry.");
    }
  };
  const removeOne = async (escalationId: string) => {
    try {
      await deleteEscalation(escalationId);
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
      toast.success("Incident removed");
    } catch {
      toast.error("Couldn't remove — you may not have permission.");
    }
  };
  const clearAll = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Delete ALL escalations and alerts from the queue? This cannot be undone.",
      )
    )
      return;
    try {
      await clearQueueData();
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
      void queryClient.invalidateQueries({
        queryKey: ["aegis", "alertsFeed"],
      });
      toast.success("Queue cleared");
    } catch {
      toast.error("Couldn't clear the queue — police/admin only.");
    }
  };

  const queueKpis = MOCK_QUEUE_KPIS.map((k) => {
    if (k.label === "Critical Alerts" && escalations.length)
      return {
        ...k,
        value: nf.format(
          escalations.filter(
            (e) => (e.severity || "").toLowerCase() === "critical",
          ).length,
        ),
        delta: undefined,
      };
    if (k.label === "Unassigned Cases" && escalations.length)
      return {
        ...k,
        value: nf.format(escalations.filter((e) => !e.assignedTo).length),
        delta: undefined,
      };
    if (k.label === "Awaiting Dispatch")
      return {
        ...k,
        value: hasSupabase
          ? nf.format(
              escalations.filter(
                (e) => (e.status || "").toLowerCase() === "triggered",
              ).length,
            )
          : NO_DATA,
        delta: undefined,
      };
    // Average Triage Time has no live timing source yet — don't fabricate it.
    if (k.label === "Average Triage Time")
      return { ...k, value: NO_DATA, delta: undefined };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, delta: undefined };
  });

  const recentAlerts: {
    key: string;
    text: string;
    when: string;
    tone: string;
  }[] = alerts.length
    ? alerts.map((a) => ({
        key: a.id,
        text: a.message || titleCase((a.type || "alert").replace(/_/g, " ")),
        when: a.time ? fmtRelative(a.time) : "",
        tone: /sos|panic|critical/i.test(`${a.type} ${a.message}`)
          ? "rose"
          : "amber",
      }))
    : ALLOW_MOCK
      ? MOCK_RECENT_ALERTS.map((a, i) => ({
          key: String(i),
          text: `${a.type} · ${a.loc}`,
          when: a.time,
          tone:
            a.sev === "Critical" ? "rose" : a.sev === "High" ? "amber" : "sky",
        }))
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {queueKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            dir={k.dir}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Panel
          title={`Priority Queue · ${queueRows.length}`}
          subtitle="Review and take action on pending requests"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-[10px] font-bold sm:flex">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Critical
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  High
                </span>
                <span className="flex items-center gap-1 text-yellow-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  Medium
                </span>
              </div>
              <button
                type="button"
                onClick={() => void clearAll()}
                className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3 w-3" /> Clear queue
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Incident Type</th>
                  <th className="px-4 py-3">Survivor Safety</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">AI Risk</th>
                  <th className="px-4 py-3">Officer</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {queueRows.map((q) => {
                  const isDispatched =
                    dispatched[q.id] || q.rawStatus === "dispatched";
                  const isEscalated =
                    escalated[q.id] || q.rawStatus === "escalated";
                  return (
                    <tr key={q.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Pill tone={statusTone(q.priority)}>{q.priority}</Pill>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[11px] text-slate-300">
                          {q.id}
                        </p>
                        <p className="text-[10px] text-slate-300">{q.via}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{q.type}</td>
                      <td className="px-4 py-3">
                        <p
                          className={cn(
                            "text-xs font-bold",
                            q.safety.includes("Danger")
                              ? "text-rose-400"
                              : q.safety.includes("Risk")
                                ? "text-amber-400"
                                : "text-emerald-400",
                          )}
                        >
                          {q.safety}
                        </p>
                        <p className="text-[10px] text-slate-300">
                          {q.safetySub}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-300">{q.loc}</p>
                        <p className="text-[10px] text-slate-300">{q.locSub}</p>
                      </td>
                      <td className="px-4 py-3">
                        <RiskRing score={q.score} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {isDispatched ? "Unit en route" : q.officer}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-1.5">
                            {isDispatched ? (
                              <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> Dispatched
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDispatched((current) => ({
                                    ...current,
                                    [q.id]: true,
                                  }));
                                  toast.success(`Unit dispatched to ${q.id}`);
                                  if (q.escalationId)
                                    void persistDispatch(q.escalationId);
                                }}
                                className="rounded-md bg-gradient-to-r from-violet-500 to-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Dispatch
                              </button>
                            )}
                            {isEscalated ? (
                              <span className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-300">
                                <ShieldAlert className="h-3 w-3" /> Escalated
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEscalated((current) => ({
                                    ...current,
                                    [q.id]: true,
                                  }));
                                  toast.success(
                                    `${q.id} escalated for senior review`,
                                  );
                                  if (q.escalationId)
                                    void persistEscalate(q.escalationId);
                                }}
                                className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-300"
                              >
                                Escalate
                              </button>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                navigate("cases");
                                toast.info(
                                  `Opening ${q.id} in Case Management`,
                                );
                              }}
                              className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5"
                            >
                              View Case
                            </button>
                            {q.escalationId && (
                              <button
                                type="button"
                                onClick={() => void removeOne(q.escalationId!)}
                                aria-label={`Delete ${q.id}`}
                                className="grid h-6 w-6 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-300">
              {queueRows.length} in queue
            </span>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Live Triage Notes"
            action={<LinkChip label="View All" />}
          >
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Add a triage note..."
                value={triageNote}
                onChange={(event) => setTriageNote(event.target.value)}
                className="h-8 border-white/10 bg-slate-900/60 text-xs text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const note = triageNote.trim();
                  if (!note) {
                    toast.error("Triage note is empty");
                    return;
                  }
                  if (!user?.id) {
                    toast.error("Sign in to add a note");
                    return;
                  }
                  setTriageNote("");
                  try {
                    await addTriageNote({
                      note,
                      authorId: user.id,
                      authorName: officerName(user.id),
                    });
                    void queryClient.invalidateQueries({
                      queryKey: TRIAGE_NOTES_KEY,
                    });
                    toast.success("Triage note added");
                  } catch {
                    setTriageNote(note);
                    toast.error("Couldn't save the note — please retry.");
                  }
                }}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 text-[11px] font-bold text-white"
              >
                Add Note
              </button>
            </div>
            <div className="space-y-3">
              {triageNotes.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-slate-400">
                  No triage notes yet.
                </p>
              ) : (
                triageNotes.map((n) => (
                  <div
                    key={n.id}
                    className="border-l-2 border-violet-500/40 pl-3"
                  >
                    <span className="text-[10px] font-bold text-slate-300">
                      {fmtRelative(n.createdAt)}
                    </span>
                    <p className="text-[10px] text-violet-300">
                      {n.authorName || "Responder"}
                    </p>
                    <p className="text-[11px] text-slate-300">{n.note}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
          <Panel
            title="Rapid Response Recommendations"
            action={
              <span className="text-[10px] font-bold text-violet-300">
                ✦ AEGIS-AI
              </span>
            }
          >
            <div className="space-y-2.5">
              {MOCK_RAPID_RECS.map((r, i) => {
                const Icon = r.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="min-w-0 flex-1 text-[11px] text-slate-300">
                      {r.text}
                    </p>
                    <Pill tone={statusTone(r.tag)}>{r.tag}</Pill>
                  </div>
                );
              })}
              <LinkChip label="View All Recommendations" />
            </div>
          </Panel>
          <Panel
            title="Recent Alerts"
            action={<LinkChip label="View All" target="incidents" />}
          >
            <div className="space-y-2">
              {recentAlerts.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-slate-400">
                  No recent alerts.
                </p>
              ) : (
                recentAlerts.map((a) => (
                  <div key={a.key} className="flex items-center gap-2">
                    <Siren
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        a.tone === "rose"
                          ? "text-rose-400"
                          : a.tone === "amber"
                            ? "text-amber-400"
                            : "text-sky-400",
                      )}
                    />
                    <span className="shrink-0 text-[10px] text-slate-300">
                      {a.when}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white">
                      {a.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/50 px-5 py-3">
        <p className="flex items-center gap-2 text-[11px] text-slate-300">
          <Shield className="h-4 w-4 text-violet-300" /> AEGIS-AI is committed
          to survivor safety, dignity, and justice. If you are in immediate
          danger, call <span className="font-black text-white">10111</span> or
          use the SOS button in the app.
        </p>
        <button
          type="button"
          onClick={() =>
            toast.warning(
              "Immediate danger? Call 10111 or trigger SOS in the survivor app.",
            )
          }
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white"
        >
          <Siren className="h-4 w-4" /> SOS Quick Access
        </button>
      </div>
    </>
  );
};

/* =============================== Cases =============================== */

type CaseRow = {
  id: string;
  alias: string;
  type: string;
  risk: string;
  status: string;
  officer: string;
  counselor: string;
  ngo: string;
  update: string;
};

const CaseDetailModal = ({
  row,
  onClose,
  onSurvivorSafety,
}: {
  row: CaseRow;
  onClose: () => void;
  onSurvivorSafety: () => void;
}) => {
  const fields: { label: string; value: string }[] = [
    { label: "Survivor", value: row.alias },
    { label: "Case Type", value: row.type },
    { label: "Officer", value: row.officer },
    { label: "Counselor", value: row.counselor },
    { label: "NGO Partner", value: row.ngo },
    { label: "Last Update", value: row.update },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Case ${row.id}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-black text-violet-300">
              {row.id}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-300">Case details</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Pill tone={statusTone(row.status)}>{row.status}</Pill>
            <Pill tone={statusTone(row.risk)}>{row.risk} risk</Pill>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-5 py-5">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {field.label}
              </p>
              <p className="mt-1 text-sm font-bold text-white">{field.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              downloadCsv(
                `${row.id.toLowerCase()}.csv`,
                [
                  "Case ID",
                  "Survivor",
                  "Type",
                  "Risk",
                  "Status",
                  "Officer",
                  "Counselor",
                  "NGO",
                  "Updated",
                ],
                [
                  [
                    row.id,
                    row.alias,
                    row.type,
                    row.risk,
                    row.status,
                    row.officer,
                    row.counselor,
                    row.ngo,
                    row.update,
                  ],
                ],
              );
              toast.success("Case exported");
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-100 hover:bg-white/5"
          >
            Export
          </button>
          <button
            type="button"
            onClick={onSurvivorSafety}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            Survivor Safety
          </button>
        </div>
      </div>
    </div>
  );
};

const NewCaseModal = ({
  createdBy,
  onClose,
  onCreated,
}: {
  createdBy: string;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [risk, setRisk] = useState("high");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!description.trim()) {
      toast.error("Add a short description");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("case_reports").insert({
        reported_by: createdBy || null,
        source: "police_portal",
        report_method: "in_app",
        status: "new",
        risk_level: risk,
        priority:
          risk === "critical"
            ? "critical"
            : risk === "high"
              ? "high"
              : "medium",
        category: category.trim() || null,
        description: description.trim(),
        is_anonymous: false,
      });
      if (error) throw error;
      toast.success("Case created");
      onCreated();
    } catch {
      toast.error("Couldn't create the case — please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="New case"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">New case</h2>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Log a case from a walk-in report or officer intake.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the incident…"
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400"
          />
          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category, e.g. Domestic Violence (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Risk level
            </p>
            <div className="flex gap-2">
              {["low", "medium", "high", "critical"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize",
                    risk === r
                      ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                      : "border-white/10 text-slate-300 hover:bg-white/5",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create case"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CasesSection = ({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) => {
  const { navigate } = usePolicePortal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailRow, setDetailRow] = useState<CaseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [riskFilter, setRiskFilter] = useState("All Risks");
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const caseKpis = MOCK_CASE_KPIS.map((k) => {
    if (k.label === "Open Cases" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter(
            (c) =>
              !["closed", "resolved"].includes((c.status || "").toLowerCase()),
          ).length,
        ),
        delta: undefined,
      };
    if (k.label === "Under Review" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) =>
            ["under_review", "open"].includes((c.status || "").toLowerCase()),
          ).length,
        ),
        delta: undefined,
      };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, delta: undefined };
  });

  const caseRows = cases.length
    ? cases.map((c) => ({
        id: `AEG-${c.id.slice(0, 8).toUpperCase()}`,
        alias: "Protected",
        type: c.description
          ? c.description.length > 36
            ? `${c.description.slice(0, 36)}…`
            : c.description
          : "GBV Case",
        risk: titleCase(c.riskLevel),
        status: titleCase((c.status || "").replace(/_/g, " ")),
        officer: "Unassigned",
        counselor: "—",
        ngo: "—",
        update: fmtDateTime(c.createdAt),
      }))
    : ALLOW_MOCK
      ? MOCK_CASES
      : [];

  const normalizedQuery = query.trim().toLowerCase();
  const byRisk =
    riskFilter === "All Risks"
      ? caseRows
      : caseRows.filter((c) => c.risk === riskFilter);
  const visibleCaseRows = normalizedQuery
    ? byRisk.filter((c) =>
        [c.id, c.alias, c.type, c.risk, c.status, c.officer, c.counselor, c.ngo]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : byRisk;

  const exportCases = () => {
    if (visibleCaseRows.length === 0) {
      toast.error("No cases to export");
      return;
    }
    downloadCsv(
      "aegis-police-cases.csv",
      [
        "Case ID",
        "Survivor",
        "Type",
        "Risk",
        "Status",
        "Officer",
        "Counselor",
        "NGO",
        "Updated",
      ],
      visibleCaseRows.map((c) => [
        c.id,
        c.alias,
        c.type,
        c.risk,
        c.status,
        c.officer,
        c.counselor,
        c.ngo,
        c.update,
      ]),
    );
    toast.success("Cases exported");
  };

  return (
    <>
      {detailRow && (
        <CaseDetailModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onSurvivorSafety={() => {
            setDetailRow(null);
            navigate("survivor");
          }}
        />
      )}
      {creating && (
        <NewCaseModal
          createdBy={user?.id ?? ""}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void queryClient.invalidateQueries({
              queryKey: ["aegis", "caseReports"],
            });
          }}
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <SelectChip
          label="All Risks"
          options={["All Risks", "Critical", "High", "Medium", "Low"]}
          value={riskFilter}
          onChange={setRiskFilter}
        />
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New Case
        </button>
      </div>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {caseKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            dir={k.dir}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Panel
          title="All Cases"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                <Input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Search by Case ID, Survivor Alias..."
                  className="h-8 w-56 border-white/10 bg-slate-900/60 pl-8 text-xs text-white"
                />
              </div>
              <button
                type="button"
                onClick={exportCases}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Survivor Alias</th>
                  <th className="px-4 py-3">Case Type</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Officer</th>
                  <th className="px-4 py-3">Counselor</th>
                  <th className="px-4 py-3">NGO Partner</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleCaseRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-xs text-slate-300"
                    >
                      No cases match “{query}”.
                    </td>
                  </tr>
                )}
                {visibleCaseRows.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-[11px] text-violet-300">
                      {c.id}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      {c.alias}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{c.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          c.risk === "Critical" || c.risk === "High"
                            ? "text-rose-400"
                            : "text-amber-400",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            c.risk === "Critical" || c.risk === "High"
                              ? "bg-rose-500"
                              : "bg-amber-500",
                          )}
                        />
                        {c.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c.officer}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c.counselor}
                    </td>
                    <td className="px-4 py-3 text-xs text-violet-300">
                      {c.ngo}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailRow(c)}
                        aria-label={`Open case ${c.id}`}
                        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/5"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-300">
              {visibleCaseRows.length ? `1–${visibleCaseRows.length}` : "0"} of{" "}
              {nf.format(caseRows.length)}
            </span>
            <Pagination />
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Case Timeline Preview"
            action={<Pill tone="rose">High Risk</Pill>}
          >
            <div className="mb-3">
              <p className="font-mono text-xs text-violet-300">
                AEGIS-2025-05121
              </p>
              <p className="text-[11px] text-slate-300">
                Survivor Alias: Thandi K.
              </p>
              <p className="text-[11px] text-slate-300">
                Case Type: Intimate Partner Violence
              </p>
            </div>
            <div className="space-y-3">
              {MOCK_TIMELINE.map((t, i) => {
                const Icon = t.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {i < MOCK_TIMELINE.length - 1 && (
                        <span className="mt-1 h-5 w-px bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white">{t.title}</p>
                      <p className="text-[10px] text-slate-300">
                        {t.sub} · {t.date}
                      </p>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => navigate("incidents")}
                className="w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
              >
                View Full Case Timeline →
              </button>
            </div>
          </Panel>
          <Panel
            title="High-Risk Survivors Requiring Check-In"
            action={<AlertTriangle className="h-4 w-4 text-rose-400" />}
          >
            <div className="space-y-2">
              {MOCK_HIGH_RISK_SURVIVORS.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <Avatar name={s.name} tone="rose" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {s.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-300">
                      {s.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-rose-400">
                      High Risk
                    </p>
                    <p className="text-[10px] text-slate-300">{s.note}</p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => navigate("survivor")}
                className="w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
              >
                View All High-Risk Cases
              </button>
            </div>
          </Panel>
        </div>
      </section>
      <ActionBar
        items={[
          { label: "Open Emergency Queue", icon: Siren, tone: "violet" },
          { label: "Assign Officer", icon: Users, tone: "sky" },
          { label: "Link Counselor", icon: Users, tone: "cyan" },
          { label: "Connect NGO Partner", icon: Handshake, tone: "emerald" },
          { label: "Schedule Follow-Up", icon: Clock, tone: "amber" },
          { label: "Generate Case Report", icon: FileText, tone: "violet" },
        ]}
      />
    </>
  );
};

/* =============================== Dispatch =============================== */

const DISPATCH_STATUS_TONE: Record<string, string> = {
  assigned: "amber",
  en_route: "sky",
  on_scene: "violet",
  completed: "emerald",
  cancelled: "slate",
};

const UNIT_STATUS_TONE: Record<string, string> = {
  available: "emerald",
  en_route: "sky",
  on_scene: "violet",
  offline: "slate",
};

const AssignOfficerModal = ({
  onClose,
  onAssigned,
}: {
  onClose: () => void;
  onAssigned: () => void;
}) => {
  const { data: officers = [] } = usePoliceOfficers({ limit: 200 });
  const { data: escalations = [] } = useEscalationEvents({ limit: 200 });
  const openIncidents = escalations.filter(
    (e) => !["resolved", "closed"].includes((e.status || "").toLowerCase()),
  );
  const [incidentId, setIncidentId] = useState(openIncidents[0]?.id ?? "");
  const [officerId, setOfficerId] = useState("");
  const [busy, setBusy] = useState(false);

  const assign = async () => {
    if (!incidentId || !officerId) {
      toast.error("Pick an incident and an officer");
      return;
    }
    setBusy(true);
    try {
      await acknowledgeEscalation(incidentId, officerId);
      const officer = officers.find((o) => o.id === officerId);
      toast.success(
        `Assigned ${officer?.fullName || "officer"} to the incident`,
      );
      onAssigned();
    } catch {
      toast.error("Couldn't assign the officer — please retry.");
    } finally {
      setBusy(false);
    }
  };

  const incidentLabel = (e: (typeof escalations)[number]) =>
    `${titleCase((e.escalationType || "Incident").replace(/_/g, " "))} · ${titleCase(
      e.severity || "medium",
    )}`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Assign officer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">Assign officer</h2>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Assign a responding officer to an open incident.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Incident
            </p>
            {openIncidents.length === 0 ? (
              <p className="text-xs text-slate-400">No open incidents.</p>
            ) : (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
                {openIncidents.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setIncidentId(e.id)}
                    className={cn(
                      "block w-full rounded-md px-3 py-2 text-left text-[11px] font-bold hover:bg-white/5",
                      incidentId === e.id
                        ? "bg-violet-500/15 text-violet-200"
                        : "text-slate-300",
                    )}
                  >
                    {incidentLabel(e)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Officer
            </p>
            {officers.length === 0 ? (
              <p className="text-xs text-slate-400">
                No officers available. Approve police accounts first.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
                {officers.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOfficerId(o.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] font-bold hover:bg-white/5",
                      officerId === o.id
                        ? "bg-violet-500/15 text-violet-200"
                        : "text-slate-300",
                    )}
                  >
                    <span>{o.fullName || o.email || "Officer"}</span>
                    {officerId === o.id && (
                      <CheckCircle2 className="h-4 w-4 text-violet-300" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={assign}
            disabled={busy || !incidentId || !officerId}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Assigning…" : "Assign officer"}
          </button>
        </div>
      </div>
    </div>
  );
};

const NewDispatchModal = ({
  createdBy,
  units,
  onClose,
  onCreated,
}: {
  createdBy: string;
  units: DispatchUnit[];
  onClose: () => void;
  onCreated: () => void;
}) => {
  const available = units.filter((u) => u.status === "available");
  const [unitId, setUnitId] = useState(available[0]?.id ?? "");
  const [caseRef, setCaseRef] = useState("");
  const [priority, setPriority] = useState("high");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!createdBy) {
      toast.error("Sign in to dispatch");
      return;
    }
    setBusy(true);
    try {
      await createDispatch({
        createdBy,
        unitId: unitId || null,
        caseReference: caseRef,
        priority,
        etaMinutes: eta ? Number(eta) : null,
      });
      toast.success("Dispatch created");
      onCreated();
    } catch {
      toast.error("Couldn't create dispatch — please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="New dispatch"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">New dispatch</h2>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Assign an available unit to a case.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Unit
            </p>
            {available.length === 0 ? (
              <p className="text-xs text-slate-400">
                No available units. Bring a unit online first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {available.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnitId(u.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[11px] font-bold",
                      unitId === u.id
                        ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                        : "border-white/10 text-slate-300 hover:bg-white/5",
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input
            value={caseRef}
            onChange={(event) => setCaseRef(event.target.value)}
            placeholder="Case reference (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Priority
            </p>
            <div className="flex gap-2">
              {["low", "medium", "high", "critical"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize",
                    priority === p
                      ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                      : "border-white/10 text-slate-300 hover:bg-white/5",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Input
            value={eta}
            onChange={(event) =>
              setEta(event.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="ETA in minutes (optional)"
            inputMode="numeric"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={busy || !unitId}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Dispatching…" : "Dispatch unit"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DispatchSection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: units = [] } = useDispatchUnits();
  const { data: dispatches = [] } = useDispatches();
  const { data: escalations = [] } = useEscalationEvents({ limit: 200 });
  const locatedRegions = buildEscalationRegions(escalations);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("dispatch-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatches" },
        () => void queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatch_units" },
        () =>
          void queryClient.invalidateQueries({ queryKey: DISPATCH_UNITS_KEY }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const unitLabel = (id: string | null) =>
    units.find((u) => u.id === id)?.label ?? "Unassigned";

  const isActive = (s: string) => !["completed", "cancelled"].includes(s);
  const kpis = [
    {
      label: "Units Available",
      value: nf.format(units.filter((u) => u.status === "available").length),
      icon: Car,
      tone: "violet",
    },
    {
      label: "Active Dispatches",
      value: nf.format(dispatches.filter((d) => isActive(d.status)).length),
      icon: Radio,
      tone: "sky",
    },
    {
      label: "On Scene",
      value: nf.format(
        dispatches.filter((d) => d.status === "on_scene").length,
      ),
      icon: MapPin,
      tone: "amber",
    },
    {
      label: "Completed",
      value: nf.format(
        dispatches.filter((d) => d.status === "completed").length,
      ),
      icon: ShieldCheck,
      tone: "emerald",
    },
  ];

  const advance = async (d: Dispatch) => {
    const next = nextDispatchStatus(d.status);
    if (!next) return;
    try {
      await updateDispatchStatus(d.id, next, d.unitId);
      void queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
      void queryClient.invalidateQueries({ queryKey: DISPATCH_UNITS_KEY });
      toast.success(`Dispatch ${next.replace(/_/g, " ")}`);
    } catch {
      toast.error("Couldn't update dispatch.");
    }
  };

  const toggleUnit = async (u: DispatchUnit) => {
    const next = u.status === "offline" ? "available" : "offline";
    try {
      await setUnitStatus(u.id, next);
      void queryClient.invalidateQueries({ queryKey: DISPATCH_UNITS_KEY });
    } catch {
      toast.error("Couldn't update unit.");
    }
  };

  return (
    <>
      {creating && (
        <NewDispatchModal
          createdBy={user?.id ?? ""}
          units={units}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: DISPATCHES_KEY });
            void queryClient.invalidateQueries({
              queryKey: DISPATCH_UNITS_KEY,
            });
          }}
        />
      )}
      {assigning && (
        <AssignOfficerModal
          onClose={() => setAssigning(false)}
          onAssigned={() => {
            setAssigning(false);
            void queryClient.invalidateQueries({
              queryKey: ESCALATION_EVENTS_KEY,
            });
          }}
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setAssigning(true)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-white hover:bg-white/5"
        >
          <Users className="h-3.5 w-3.5" /> Assign Officer
        </button>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New Dispatch
        </button>
      </div>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={hasSupabase ? k.value : NO_DATA}
            icon={k.icon}
            tone={k.tone}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Panel
            title="Live Operations Map – Southern Africa"
            action={
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                Live
              </span>
            }
          >
            <WorldRiskMap
              regions={locatedRegions.length ? locatedRegions : MOCK_SA_MAP}
              height={300}
              center={[-20, 27]}
              zoom={4}
            />
          </Panel>
          <Panel title="Active Dispatches" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">ETA</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dispatches.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-xs text-slate-300"
                      >
                        No dispatches yet. Use New Dispatch to send a unit.
                      </td>
                    </tr>
                  ) : (
                    dispatches.map((d) => {
                      const next = nextDispatchStatus(d.status);
                      return (
                        <tr key={d.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-mono text-[11px] text-violet-300">
                            {d.caseReference ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Pill tone={statusTone(d.priority)}>
                              {titleCase(d.priority)}
                            </Pill>
                          </td>
                          <td className="px-4 py-3 text-xs text-white">
                            {unitLabel(d.unitId)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">
                            {d.etaMinutes != null ? `${d.etaMinutes} min` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Pill
                              tone={DISPATCH_STATUS_TONE[d.status] ?? "slate"}
                            >
                              {titleCase(d.status.replace(/_/g, " "))}
                            </Pill>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {next ? (
                              <button
                                type="button"
                                onClick={() => void advance(d)}
                                className="rounded-md bg-gradient-to-r from-violet-500 to-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Mark {next.replace(/_/g, " ")}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Done
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Response Units" bodyClassName="p-0">
            <div className="divide-y divide-white/5">
              {units.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-300">
                  No units configured.
                </p>
              ) : (
                units.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                        <Car className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {u.label}
                        </p>
                        <p className="text-[10px] text-slate-300">
                          {u.region ?? "—"} · {u.activeOfficers} officers
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={UNIT_STATUS_TONE[u.status] ?? "slate"}>
                        {titleCase(u.status.replace(/_/g, " "))}
                      </Pill>
                      <button
                        type="button"
                        onClick={() => void toggleUnit(u)}
                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5"
                      >
                        {u.status === "offline"
                          ? "Bring online"
                          : "Set offline"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
          <Panel title="Dispatch Workflow">
            <div className="space-y-4">
              {MOCK_WORKFLOW.map((w, i) => {
                const Icon = w.icon;
                return (
                  <div key={w.n} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      {i < MOCK_WORKFLOW.length - 1 && (
                        <span className="my-1 h-6 w-px bg-white/10" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{w.title}</p>
                      <p className="text-[11px] text-slate-300">{w.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </section>
      <ActionBar
        items={[
          { label: "Open Emergency Queue", icon: Siren, tone: "violet" },
          { label: "Partner Directory", icon: Handshake, tone: "amber" },
          { label: "Contact Survivor", icon: Phone, tone: "violet" },
        ]}
      />
    </>
  );
};

/* =============================== Evidence =============================== */

const EVIDENCE_KIND_ICON = {
  image: Camera,
  audio: Mic,
  video: Video,
  document: FileText,
} as const;

const EvidenceUploadModal = ({
  uploaderId,
  onClose,
  onUploaded,
}: {
  uploaderId: string;
  onClose: () => void;
  onUploaded: () => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [caseRef, setCaseRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    if (!uploaderId) {
      toast.error("Sign in to upload evidence");
      return;
    }
    setBusy(true);
    try {
      await uploadCaseEvidence({
        file,
        uploaderId,
        caseReference: caseRef,
        note,
      });
      toast.success("Evidence uploaded");
      onUploaded();
    } catch {
      toast.error("Upload failed — please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upload evidence"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">Upload evidence</h2>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Photos, documents, audio or video attached to a case.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center hover:border-violet-400/40">
            <Upload className="h-5 w-5 text-violet-300" />
            <span className="text-xs font-bold text-white">
              {file ? file.name : "Choose a file"}
            </span>
            <span className="text-[10px] text-slate-400">
              {file ? `${Math.ceil(file.size / 1024)} KB` : "Click to browse"}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <Input
            value={caseRef}
            onChange={(event) => setCaseRef(event.target.value)}
            placeholder="Case reference (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CaseEvidenceRegister = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: evidence = [], isLoading } = useCaseEvidence();
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel("case-evidence-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_evidence" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: CASE_EVIDENCE_QUERY_KEY,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const normalized = query.trim().toLowerCase();
  const rows = normalized
    ? evidence.filter((e) =>
        [e.fileName, e.caseReference, e.evidenceType, e.note]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
    : evidence;

  const countKind = (kind: string) =>
    evidence.filter((e) => caseEvidenceKind(e) === kind).length;

  const kpis = [
    {
      label: "Evidence Files",
      value: nf.format(evidence.length),
      icon: FileText,
      tone: "violet",
    },
    {
      label: "Images",
      value: nf.format(countKind("image")),
      icon: Camera,
      tone: "sky",
    },
    {
      label: "Audio / Video",
      value: nf.format(countKind("audio") + countKind("video")),
      icon: Mic,
      tone: "amber",
    },
    {
      label: "Documents",
      value: nf.format(countKind("document")),
      icon: FileCheck,
      tone: "emerald",
    },
  ];

  const openFile = async (entry: CaseEvidenceEntry) => {
    setOpeningId(entry.id);
    try {
      const url = await createCaseEvidenceUrl(entry.storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Couldn't open that file.");
    } finally {
      setOpeningId(null);
    }
  };

  const uploaderLabel = (id: string | null) =>
    !id ? "—" : id === user?.id ? "You" : id.slice(0, 8);

  return (
    <>
      {uploading && (
        <EvidenceUploadModal
          uploaderId={user?.id ?? ""}
          onClose={() => setUploading(false)}
          onUploaded={() => {
            setUploading(false);
            void queryClient.invalidateQueries({
              queryKey: CASE_EVIDENCE_QUERY_KEY,
            });
          }}
        />
      )}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setUploading(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
        >
          <Upload className="h-3.5 w-3.5" /> Upload Evidence
        </button>
      </div>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={hasSupabase ? k.value : NO_DATA}
            icon={k.icon}
            tone={k.tone}
          />
        ))}
      </section>
      <Panel
        title="Case Evidence Register"
        subtitle="Responder-uploaded evidence, attached to cases"
        bodyClassName="p-0"
        action={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search evidence..."
              className="h-8 w-44 border-white/10 bg-slate-900/60 pl-8 text-xs text-white"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Uploaded By</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-xs text-slate-300"
                  >
                    Loading evidence…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-xs text-slate-300"
                  >
                    {query
                      ? `No evidence matches “${query}”.`
                      : "No case evidence yet. Use Upload Evidence to attach files to a case."}
                  </td>
                </tr>
              ) : (
                rows.map((e) => {
                  const kind = caseEvidenceKind(e);
                  const Icon = EVIDENCE_KIND_ICON[kind];
                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-white">
                          {e.fileName ?? "Evidence"}
                        </p>
                        {e.note ? (
                          <p className="max-w-[220px] truncate text-[10px] text-slate-300">
                            {e.note}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-violet-300">
                        {e.caseReference ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Icon className="h-3.5 w-3.5 text-violet-300" />
                          {titleCase(kind)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {uploaderLabel(e.uploadedBy)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-300">
                        {e.createdAt ? fmtRelative(e.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => void openFile(e)}
                            disabled={openingId === e.id}
                            aria-label={`Open ${e.fileName ?? "evidence"}`}
                            className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-bold text-violet-300 hover:bg-white/5 disabled:opacity-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-slate-300">
            {rows.length} file{rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </Panel>
    </>
  );
};

const EvidenceSection = () => (
  <>
    {/* Live: evidence a survivor consented to share from the mobile app. */}
    <SharedEvidencePanel />
    {/* Live: evidence responders upload and attach to cases. */}
    <CaseEvidenceRegister />
  </>
);

/* =============================== Partner Coordination =============================== */

const PartnersSection = () => {
  const { navigate } = usePolicePortal();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const tabs = [
    "All",
    "NGOs",
    "Counselors",
    "Shelters",
    "Hospitals",
    "Legal Support",
  ];
  const [activeTab, setActiveTab] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const ptypeTone: Record<string, string> = {
    NGO: "violet",
    Counselor: "sky",
    Legal: "amber",
    Shelter: "emerald",
    Hospital: "rose",
  };
  const TAB_PTYPE: Record<string, string> = {
    NGOs: "NGO",
    Counselors: "Counselor",
    Shelters: "Shelter",
    Hospitals: "Hospital",
    "Legal Support": "Legal",
  };
  const byType =
    activeTab === "All"
      ? MOCK_PARTNER_BOARD
      : MOCK_PARTNER_BOARD.filter((p) => p.ptype === TAB_PTYPE[activeTab]);
  const visiblePartners =
    statusFilter === "All Status"
      ? byType
      : byType.filter((p) => p.status === statusFilter);

  const exportPartners = () => {
    if (visiblePartners.length === 0) {
      toast.error("No referrals to export");
      return;
    }
    downloadCsv(
      "aegis-partner-referrals.csv",
      [
        "Case ID",
        "Partner Type",
        "Organization",
        "Contact Lead",
        "Phone",
        "Service Requested",
        "Status",
        "Response Time",
      ],
      visiblePartners.map((p) => [
        p.id,
        p.ptype,
        p.org,
        p.lead,
        p.phone,
        p.service,
        p.status,
        p.rt,
      ]),
    );
    toast.success("Referrals exported");
  };

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {MOCK_PARTNER_KPIS.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={k.delta}
            dir={k.dir}
          />
        ))}
      </section>
      {/* Live: real inter-agency case handoffs (organization_coordination). */}
      <CoordinationBoard
        organizationId={profile?.organizationId ?? undefined}
      />
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Panel
          title="Partner Coordination Board"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <SelectChip
                label="All Status"
                options={["All Status", "Accepted", "In Progress", "Pending"]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <button
                type="button"
                onClick={exportPartners}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          }
        >
          <div className="flex gap-1 border-b border-white/5 px-4 pt-3">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={cn(
                  "rounded-t-lg px-3 py-2 text-[11px] font-bold",
                  activeTab === t
                    ? "border-b-2 border-violet-500 text-white"
                    : "text-slate-300 hover:text-white",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Partner Type</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Contact Lead</th>
                  <th className="px-4 py-3">Service Requested</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Response</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visiblePartners.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-xs text-slate-300"
                    >
                      No {activeTab.toLowerCase()} referrals right now.
                    </td>
                  </tr>
                )}
                {visiblePartners.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                      {p.id}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={ptypeTone[p.ptype] ?? "slate"}>
                        {p.ptype}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {p.org}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-white">{p.lead}</p>
                      <p className="text-[10px] text-slate-300">{p.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {p.service}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{p.rt}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate("messages")}
                          aria-label={`Message ${p.org}`}
                          className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-violet-300 hover:bg-white/5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("messages")}
                          aria-label={`Open ${p.org} coordination`}
                          className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-300">
              {visiblePartners.length} referral
              {visiblePartners.length === 1 ? "" : "s"}
            </span>
          </div>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel
            title="Shared Case Threads"
            action={<LinkChip label="View All" />}
          >
            <div className="space-y-2.5">
              {MOCK_SHARED_THREADS.map((t, i) => {
                const Icon = t.icon;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-white">
                            {t.org}
                          </p>
                          <Pill tone={ptypeTone[t.ptype] ?? "slate"}>
                            {t.ptype}
                          </Pill>
                        </div>
                        <p className="truncate text-[10px] text-slate-300">
                          {t.caseId}
                        </p>
                        <p className="truncate text-[10px] text-slate-300">
                          {t.msg}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-300">
                          {t.time}
                        </span>
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-violet-500 text-[9px] font-black text-white">
                          {t.count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <LinkChip label="View all threads" />
            </div>
          </Panel>
          <Panel
            title="Pending Partner Actions"
            action={<LinkChip label="View All" />}
          >
            <div className="space-y-2.5">
              {MOCK_PENDING_ACTIONS.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">
                        {a.org}
                      </p>
                      <p className="truncate text-[10px] text-slate-300">
                        {a.caseId}
                      </p>
                      <p className="truncate text-[10px] text-slate-300">
                        {a.task}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-300">Due in</p>
                      <p className="text-[11px] font-bold text-amber-400">
                        {a.due}
                      </p>
                    </div>
                  </div>
                );
              })}
              <LinkChip label="View all pending actions" />
            </div>
          </Panel>
        </div>
      </section>
      <ActionBar items={[...MOCK_PARTNER_ACTIONS]} />
    </>
  );
};

export default PolicePortal;
