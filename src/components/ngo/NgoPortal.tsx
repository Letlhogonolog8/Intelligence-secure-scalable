/**
 * AEGIS-AI NGO Portal — faithful build of the approved NGO mock-up.
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
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  GraduationCap,
  Handshake,
  Heart,
  HelpCircle,
  Home,
  LayoutGrid,
  LogOut,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Settings as SettingsIcon,
  Send,
  Stethoscope,
  Upload,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import WorldRiskMap, {
  type MapRegion,
} from "@/components/analyst/WorldRiskMap";
import SecureMessagesWorkspace from "@/components/messaging/SecureMessagesWorkspace";
import {
  useCaseReports,
  useEscalationEvents,
  useShelters,
  useUserProfile,
} from "@/data/aegisData";
import {
  createPartnerReferral,
  PARTNER_REFERRALS_KEY,
  usePartnerReferrals,
  type PartnerType,
  type ReferralStatus,
} from "@/data/partnerReferrals";
import { acknowledgeEscalation } from "@/data/escalationActions";
import { ESCALATION_EVENTS_KEY } from "@/data/escalationActions";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useOrganizationContext } from "@/contexts/organizationContext";
import { ROLE_DEFINITIONS, type UserRole } from "@/lib/roleConfig";
import { ALLOW_MOCK, NO_DATA, gateKpis, sample } from "@/lib/mockData";

const nf = new Intl.NumberFormat("en-US");
const fmtRelative = (t: string) => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
};
const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

type SectionKey =
  | "overview"
  | "cases"
  | "survivors"
  | "referrals"
  | "followups"
  | "counseling"
  | "shelter"
  | "legalaid"
  | "medical"
  | "analytics"
  | "reports"
  | "messages"
  | "placeholder";

/* ============================ MOCK / SAMPLE DATA ============================ */

const MOCK_ORG = {
  name: "Hope Foundation",
  user: "Sarah M.",
  role: "Program Director",
};

const MOCK_CASE_KPIS = [
  {
    label: "Open Cases",
    value: "1,287",
    icon: Briefcase,
    tone: "violet",
    delta: { dir: "up", text: "12.6%" },
  },
  {
    label: "High Risk Cases",
    value: "186",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "8.3%" },
  },
  {
    label: "In Progress",
    value: "764",
    icon: Clock,
    tone: "amber",
    delta: { dir: "up", text: "9.7%" },
  },
  {
    label: "Resolved",
    value: "2,451",
    icon: CheckCircle2,
    tone: "emerald",
    delta: { dir: "up", text: "14.6%" },
  },
] as const;

const MOCK_CASES = [
  {
    id: "AEG-2026-1187",
    name: "Thandi N.",
    sid: "SUR-003241",
    type: "Domestic Violence",
    typeColor: "#a855f7",
    risk: "Critical",
    status: "New",
    worker: "Sarah M.",
    updated: "10m ago",
  },
  {
    id: "AEG-2026-1185",
    name: "Nomsa D.",
    sid: "SUR-002987",
    type: "Sexual Assault",
    typeColor: "#ec4899",
    risk: "Critical",
    status: "In Progress",
    worker: "Lerato K.",
    updated: "25m ago",
  },
  {
    id: "AEG-2026-1182",
    name: "Zanele P.",
    sid: "SUR-003102",
    type: "Child Abuse",
    typeColor: "#f59e0b",
    risk: "High",
    status: "In Progress",
    worker: "Sipho M.",
    updated: "35m ago",
  },
  {
    id: "AEG-2026-1180",
    name: "Aisha F.",
    sid: "SUR-002754",
    type: "Emotional Abuse",
    typeColor: "#06b6d4",
    risk: "High",
    status: "Assigned",
    worker: "Thabo R.",
    updated: "1h ago",
  },
  {
    id: "AEG-2026-1178",
    name: "Mpho L.",
    sid: "SUR-002689",
    type: "Domestic Violence",
    typeColor: "#a855f7",
    risk: "Medium",
    status: "In Progress",
    worker: "Sarah M.",
    updated: "1h ago",
  },
  {
    id: "AEG-2026-1176",
    name: "Fatima K.",
    sid: "SUR-003011",
    type: "Human Trafficking",
    typeColor: "#3b82f6",
    risk: "High",
    status: "In Progress",
    worker: "Lerato K.",
    updated: "2h ago",
  },
  {
    id: "AEG-2026-1174",
    name: "Priya S.",
    sid: "SUR-003045",
    type: "Domestic Violence",
    typeColor: "#a855f7",
    risk: "Medium",
    status: "New",
    worker: "Sipho M.",
    updated: "2h ago",
  },
  {
    id: "AEG-2026-1172",
    name: "Nadine C.",
    sid: "SUR-002988",
    type: "Sexual Assault",
    typeColor: "#ec4899",
    risk: "Critical",
    status: "In Progress",
    worker: "Thabo R.",
    updated: "3h ago",
  },
  {
    id: "AEG-2026-1170",
    name: "Lebogang T.",
    sid: "SUR-002812",
    type: "Child Abuse",
    typeColor: "#f59e0b",
    risk: "High",
    status: "Resolved",
    worker: "Sarah M.",
    updated: "4h ago",
  },
  {
    id: "AEG-2026-1168",
    name: "Grace M.",
    sid: "SUR-002901",
    type: "Emotional Abuse",
    typeColor: "#06b6d4",
    risk: "Medium",
    status: "In Progress",
    worker: "Lerato K.",
    updated: "5h ago",
  },
];

const MOCK_URGENT_CASES = [
  {
    id: "AEG-2026-1187",
    type: "Domestic Violence",
    loc: "Pretoria",
    time: "10m ago",
  },
  {
    id: "AEG-2026-1185",
    type: "Sexual Assault",
    loc: "Cape Town",
    time: "25m ago",
  },
  { id: "AEG-2026-1182", type: "Child Abuse", loc: "Durban", time: "35m ago" },
  {
    id: "AEG-2026-1176",
    type: "Human Trafficking",
    loc: "Johannesburg",
    time: "2h ago",
  },
  {
    id: "AEG-2026-1172",
    type: "Sexual Assault",
    loc: "Polokwane",
    time: "3h ago",
  },
];

const MOCK_CASE_UPDATES = [
  {
    icon: Pencil,
    tone: "violet",
    title: "Case updated",
    sub: "AEG-2026-1182 status changed to In Progress",
    time: "35m ago",
  },
  {
    icon: FileText,
    tone: "sky",
    title: "New note added",
    sub: "AEG-2026-1178 – Follow-up session notes added",
    time: "1h ago",
  },
  {
    icon: Users,
    tone: "violet",
    title: "Case assigned",
    sub: "AEG-2026-1176 assigned to Lerato K.",
    time: "2h ago",
  },
  {
    icon: AlertTriangle,
    tone: "amber",
    title: "Risk level updated",
    sub: "AEG-2026-1172 risk level changed to Critical",
    time: "3h ago",
  },
  {
    icon: CheckCircle2,
    tone: "emerald",
    title: "Case resolved",
    sub: "AEG-2026-1170 marked as Resolved",
    time: "4h ago",
  },
];

const MOCK_CASE_QUICK = [
  { label: "Add New Case", desc: "Register a new case", icon: UserPlus },
  { label: "Assign Case", desc: "Assign to team member", icon: Users },
  { label: "Export Cases", desc: "Download case data", icon: Download },
  {
    label: "Bulk Update Status",
    desc: "Update multiple cases",
    icon: ClipboardList,
  },
  { label: "Generate Report", desc: "Create case report", icon: FileText },
  { label: "Import Cases", desc: "Upload case data", icon: Upload },
];

const MOCK_SURVIVOR_KPIS = [
  {
    label: "Active Survivors",
    value: "2,251",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.3%" },
  },
  {
    label: "New Intakes (7 days)",
    value: "186",
    icon: UserPlus,
    tone: "sky",
    delta: { dir: "up", text: "8.7%" },
  },
  {
    label: "High Priority",
    value: "245",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "5.2%" },
  },
  {
    label: "Support Plans",
    value: "1,842",
    icon: ClipboardList,
    tone: "emerald",
    delta: { dir: "up", text: "11.8%" },
  },
] as const;

const MOCK_SURVIVORS = [
  {
    name: "Thandi Ndlovu",
    meta: "28 • Johannesburg",
    caseId: "AEG-2026-1187",
    need: "Counseling",
    counselor: "Lerato K.",
    status: "In Progress",
    followup: "May 16, 10:00 AM",
    urgent: false,
  },
  {
    name: "Nomsa Dlamini",
    meta: "34 • Durban",
    caseId: "AEG-2026-1185",
    need: "Legal Aid",
    counselor: "Thabo R.",
    status: "In Progress",
    followup: "May 17, 11:00 AM",
    urgent: false,
  },
  {
    name: "Zanele P. Mokoena",
    meta: "16 • Durban",
    caseId: "AEG-2026-1182",
    need: "Shelter",
    counselor: "Sipho M.",
    status: "High Priority",
    followup: "Today, 02:00 PM",
    urgent: true,
  },
  {
    name: "Aisha F. Khan",
    meta: "22 • Pretoria",
    caseId: "AEG-2026-1180",
    need: "Medical Support",
    counselor: "Priya S.",
    status: "In Progress",
    followup: "May 18, 09:30 AM",
    urgent: false,
  },
  {
    name: "Mpho L. Sekgobela",
    meta: "31 • Cape Town",
    caseId: "AEG-2026-1178",
    need: "Counseling",
    counselor: "Nandi Z.",
    status: "Medium Priority",
    followup: "May 20, 10:00 AM",
    urgent: false,
  },
  {
    name: "Siphesihle B.",
    meta: "19 • Port Elizabeth",
    caseId: "AEG-2026-1175",
    need: "Legal Aid",
    counselor: "Lerato K.",
    status: "In Progress",
    followup: "May 21, 11:30 AM",
    urgent: false,
  },
  {
    name: "Khanyisa M.",
    meta: "27 • East London",
    caseId: "AEG-2026-1173",
    need: "Shelter",
    counselor: "Thabo R.",
    status: "High Priority",
    followup: "Tomorrow, 10:00 AM",
    urgent: true,
  },
  {
    name: "Jessica B.",
    meta: "24 • Bloemfontein",
    caseId: "AEG-2026-1170",
    need: "Medical Support",
    counselor: "Priya S.",
    status: "In Progress",
    followup: "May 19, 02:00 PM",
    urgent: false,
  },
];

const MOCK_VULNERABLE = [
  {
    tag: "High Risk",
    name: "Zanele P. Mokoena",
    sub: "AEG-2026-1182 • 16 years old",
    time: "Today",
  },
  {
    tag: "Follow-up Overdue",
    name: "Khanyisa M.",
    sub: "AEG-2026-1173 • 27 years old",
    time: "1 day ago",
  },
  {
    tag: "High Risk",
    name: "Nomsa Dlamini",
    sub: "AEG-2026-1185 • 34 years old",
    time: "2 days ago",
  },
  {
    tag: "No Recent Activity",
    name: "Siphesihle B.",
    sub: "AEG-2026-1175 • 19 years old",
    time: "3 days ago",
  },
  {
    tag: "Urgent Need",
    name: "Aisha F. Khan",
    sub: "AEG-2026-1180 • 22 years old",
    time: "Today",
  },
];

const MOCK_AGE_GROUPS = [
  { name: "0-17", value: 18, color: "#a855f7" },
  { name: "18-25", value: 29, color: "#3b82f6" },
  { name: "26-35", value: 28, color: "#06b6d4" },
  { name: "36-45", value: 15, color: "#f59e0b" },
  { name: "46+", value: 10, color: "#10b981" },
];

const MOCK_SUPPORT_CATEGORIES = [
  { name: "Counseling", value: "892", pct: "39.6%", color: "rose" },
  { name: "Shelter", value: "612", pct: "27.1%", color: "violet" },
  { name: "Legal Aid", value: "478", pct: "21.2%", color: "sky" },
  { name: "Medical Support", value: "269", pct: "11.9%", color: "emerald" },
];

const MOCK_REFERRAL_KPIS = [
  {
    label: "Pending Referrals",
    value: "43",
    icon: Send,
    tone: "violet",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "Accepted",
    value: "126",
    icon: CheckCircle2,
    tone: "emerald",
    delta: { dir: "up", text: "18.2%" },
  },
  {
    label: "Rejected",
    value: "18",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "4.7%" },
  },
  {
    label: "Awaiting Response",
    value: "29",
    icon: Clock,
    tone: "sky",
    delta: { dir: "up", text: "7.3%" },
  },
] as const;

const MOCK_PIPELINE = [
  { n: 1, label: "Pending", value: 43, color: "#a855f7" },
  { n: 2, label: "Accepted", value: 126, color: "#3b82f6" },
  { n: 3, label: "In Progress", value: 88, color: "#10b981" },
  { n: 4, label: "Completed", value: 96, color: "#f59e0b" },
  { n: 5, label: "Rejected", value: 18, color: "#f43f5e" },
];

const MOCK_REFERRALS = [
  {
    id: "REF-2026-1245",
    name: "Thandi N.",
    caseId: "AEG-2026-1187",
    service: "Counseling",
    to: "Safe Haven Counseling",
    loc: "Pretoria",
    priority: "High",
    status: "Pending",
    date: "May 15, 2026",
    time: "10:30 AM",
  },
  {
    id: "REF-2026-1244",
    name: "Nomsa D.",
    caseId: "AEG-2026-1185",
    service: "Legal Aid",
    to: "Justice For All",
    loc: "Cape Town",
    priority: "High",
    status: "Accepted",
    date: "May 15, 2026",
    time: "9:15 AM",
  },
  {
    id: "REF-2026-1243",
    name: "Zanele P.",
    caseId: "AEG-2026-1182",
    service: "Shelter",
    to: "Hope Shelter",
    loc: "Durban",
    priority: "Critical",
    status: "In Progress",
    date: "May 14, 2026",
    time: "4:20 PM",
  },
  {
    id: "REF-2026-1242",
    name: "Aisha F.",
    caseId: "AEG-2026-1180",
    service: "Medical Support",
    to: "CareWell Clinic",
    loc: "Johannesburg",
    priority: "Medium",
    status: "Awaiting Response",
    date: "May 14, 2026",
    time: "11:08 AM",
  },
  {
    id: "REF-2026-1241",
    name: "Sipho M.",
    caseId: "AEG-2026-1179",
    service: "Legal Aid",
    to: "Legal Eagles",
    loc: "Pretoria",
    priority: "High",
    status: "Pending",
    date: "May 13, 2026",
    time: "2:35 PM",
  },
  {
    id: "REF-2026-1240",
    name: "Lerato K.",
    caseId: "AEG-2026-1175",
    service: "Counseling",
    to: "Bright Path Counseling",
    loc: "Johannesburg",
    priority: "Medium",
    status: "In Progress",
    date: "May 13, 2026",
    time: "10:10 AM",
  },
  {
    id: "REF-2026-1239",
    name: "Jabulani R.",
    caseId: "AEG-2026-1173",
    service: "Shelter",
    to: "Uplift Shelter",
    loc: "Port Elizabeth",
    priority: "High",
    status: "Accepted",
    date: "May 12, 2026",
    time: "5:45 PM",
  },
  {
    id: "REF-2026-1238",
    name: "Mapaseka P.",
    caseId: "AEG-2026-1171",
    service: "Emergency Aid",
    to: "Community Relief Org.",
    loc: "Cape Town",
    priority: "Medium",
    status: "Completed",
    date: "May 12, 2026",
    time: "12:22 PM",
  },
];

const MOCK_URGENT_REFERRALS = [
  {
    tag: "Critical",
    id: "REF-2026-1243",
    sub: "Shelter • Hope Shelter, Durban",
    time: "20m ago",
  },
  {
    tag: "High",
    id: "REF-2026-1245",
    sub: "Counseling • Safe Haven, Pretoria",
    time: "35m ago",
  },
  {
    tag: "High",
    id: "REF-2026-1241",
    sub: "Legal Aid • Legal Eagles, Pretoria",
    time: "1h ago",
  },
  {
    tag: "Medium",
    id: "REF-2026-1242",
    sub: "Medical Support • CareWell Clinic",
    time: "1h ago",
  },
];

const MOCK_FOLLOWUP_KPIS = [
  {
    label: "Due Today",
    value: "18",
    icon: Calendar,
    tone: "violet",
    delta: { dir: "up", text: "12%" },
    sub: "vs yesterday",
  },
  {
    label: "Upcoming",
    value: "47",
    icon: Clock,
    tone: "sky",
    delta: { dir: "up", text: "8%" },
  },
  {
    label: "Overdue",
    value: "9",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "18%" },
  },
  {
    label: "Completed",
    value: "126",
    icon: CheckCircle2,
    tone: "emerald",
    delta: { dir: "up", text: "15%" },
  },
] as const;

const MOCK_WEEK = [
  { day: "Mon", date: "May 12", count: 18 },
  { day: "Tue", date: "May 13", count: 24, active: true },
  { day: "Wed", date: "May 14", count: 16 },
  { day: "Thu", date: "May 15", count: 15 },
  { day: "Fri", date: "May 16", count: 20 },
  { day: "Sat", date: "May 17", count: 11 },
  { day: "Sun", date: "May 18", count: 9 },
];

const MOCK_FOLLOWUPS = [
  {
    date: "May 12, 2025",
    time: "10:00 AM",
    name: "Thandi N.",
    caseId: "AEG-2026-1187",
    worker: "Sarah M.",
    type: "Counseling Session",
    status: "Due Today",
    notes: "Trauma counseling follow-up",
  },
  {
    date: "May 12, 2025",
    time: "11:30 AM",
    name: "Nomsa D.",
    caseId: "AEG-2026-1185",
    worker: "Lerato K.",
    type: "Legal Consultation",
    status: "Due Today",
    notes: "Court preparation review",
  },
  {
    date: "May 12, 2025",
    time: "2:00 PM",
    name: "Zanele P.",
    caseId: "AEG-2026-1182",
    worker: "Sipho M.",
    type: "Counseling Session",
    status: "Due Today",
    notes: "Anxiety management session",
  },
  {
    date: "May 12, 2025",
    time: "3:30 PM",
    name: "Aisha F.",
    caseId: "AEG-2026-1180",
    worker: "Thabo R.",
    type: "Shelter Check-in",
    status: "Due Today",
    notes: "Safety and needs assessment",
  },
  {
    date: "May 13, 2025",
    time: "10:00 AM",
    name: "Nokuthula M.",
    caseId: "AEG-2026-1176",
    worker: "Sarah M.",
    type: "Legal Consultation",
    status: "Upcoming",
    notes: "Document review and advice",
  },
  {
    date: "May 13, 2025",
    time: "1:00 PM",
    name: "Fatima K.",
    caseId: "AEG-2026-1174",
    worker: "Lerato K.",
    type: "Medical Follow-up",
    status: "Upcoming",
    notes: "Post-treatment check-in",
  },
  {
    date: "May 14, 2025",
    time: "11:00 AM",
    name: "Lindiwe S.",
    caseId: "AEG-2026-1169",
    worker: "Sipho M.",
    type: "Counseling Session",
    status: "Scheduled",
    notes: "Building coping strategies",
  },
  {
    date: "May 15, 2025",
    time: "9:30 AM",
    name: "Mpho L.",
    caseId: "AEG-2026-1178",
    worker: "Sarah M.",
    type: "Shelter Check-in",
    status: "Scheduled",
    notes: "Monthly follow-up visit",
  },
];

const MOCK_OVERDUE = [
  {
    name: "Naledi T.",
    sub: "AEG-2026-1159 • Counseling Session",
    time: "5 days",
  },
  {
    name: "Busisiwe J.",
    sub: "AEG-2026-1148 • Legal Consultation",
    time: "3 days",
  },
  {
    name: "Patricia M.",
    sub: "AEG-2026-1137 • Shelter Check-in",
    time: "2 days",
  },
  {
    name: "Hannah R.",
    sub: "AEG-2026-1126 • Medical Follow-up",
    time: "1 day",
  },
  {
    name: "Grace L.",
    sub: "AEG-2026-1115 • Counseling Session",
    time: "1 day",
  },
];

const MOCK_FOLLOWUP_QUICK = [
  {
    label: "Schedule Follow-up",
    desc: "Create a new follow-up",
    icon: Calendar,
  },
  { label: "Mark Complete", desc: "Complete a follow-up", icon: CheckCircle2 },
  { label: "Send Reminder", desc: "Send reminder to survivor", icon: Send },
  { label: "Reschedule", desc: "Reschedule follow-up", icon: Clock },
  { label: "Add Note", desc: "Add follow-up note", icon: FileText },
  { label: "View Calendar", desc: "Open full calendar", icon: Calendar },
];

const MOCK_COUNSELING_KPIS = [
  {
    label: "Sessions Today",
    value: "21",
    icon: Calendar,
    tone: "violet",
    delta: { dir: "up", text: "16.7%" },
    sub: "vs yesterday",
  },
  {
    label: "Upcoming Sessions",
    value: "48",
    icon: Clock,
    tone: "sky",
    delta: { dir: "up", text: "20.0%" },
  },
  {
    label: "Assigned Counselors",
    value: "18",
    icon: Users,
    tone: "emerald",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "Pending Notes",
    value: "14",
    icon: FileText,
    tone: "amber",
    delta: { dir: "down", text: "12.5%" },
  },
] as const;

const MOCK_SESSIONS = [
  {
    id: "CS-2026-1192",
    name: "Thandi N.",
    age: 28,
    counselor: "Lerato K.",
    date: "May 16, 2026",
    time: "10:00 AM",
    mode: "Video",
    status: "Completed",
  },
  {
    id: "CS-2026-1193",
    name: "Nomsa D.",
    age: 32,
    counselor: "Sipho M.",
    date: "May 16, 2026",
    time: "11:00 AM",
    mode: "Phone",
    status: "In Progress",
  },
  {
    id: "CS-2026-1194",
    name: "Zanele P.",
    age: 24,
    counselor: "Aisha F.",
    date: "May 16, 2026",
    time: "12:30 PM",
    mode: "Video",
    status: "Scheduled",
  },
  {
    id: "CS-2026-1195",
    name: "Lerato K.",
    age: 19,
    counselor: "Thabo R.",
    date: "May 16, 2026",
    time: "02:00 PM",
    mode: "Phone",
    status: "Scheduled",
  },
  {
    id: "CS-2026-1196",
    name: "Sipho M.",
    age: 27,
    counselor: "Sarah M.",
    date: "May 16, 2026",
    time: "03:30 PM",
    mode: "Video",
    status: "Pending",
  },
  {
    id: "CS-2026-1197",
    name: "Aisha F.",
    age: 34,
    counselor: "Lerato K.",
    date: "May 16, 2026",
    time: "04:30 PM",
    mode: "Phone",
    status: "Pending",
  },
  {
    id: "CS-2026-1198",
    name: "Mpho L.",
    age: 22,
    counselor: "Sipho M.",
    date: "May 16, 2026",
    time: "05:30 PM",
    mode: "Video",
    status: "Pending",
  },
];

const MOCK_URGENT_COUNSELING = [
  {
    name: "Thabo R.",
    age: 26,
    need: "Anxiety & panic attacks",
    time: "25m ago",
  },
  {
    name: "Zanele P.",
    age: 24,
    need: "Recent trauma incident",
    time: "45m ago",
  },
  { name: "Mpho L.", age: 22, need: "Emotional distress", time: "1h ago" },
  {
    name: "Nomsa D.",
    age: 32,
    need: "Crisis support needed",
    time: "1h 15m ago",
  },
  {
    name: "Aisha F.",
    age: 34,
    need: "Safety & emotional support",
    time: "2h ago",
  },
];

const MOCK_WEEKLY_APPTS = [
  { day: "Mon", completed: 18, scheduled: 22, progress: 8, cancelled: 2 },
  { day: "Tue", completed: 28, scheduled: 26, progress: 12, cancelled: 3 },
  { day: "Wed", completed: 24, scheduled: 28, progress: 10, cancelled: 2 },
  { day: "Thu", completed: 32, scheduled: 24, progress: 14, cancelled: 4 },
  { day: "Fri", completed: 26, scheduled: 30, progress: 11, cancelled: 2 },
  { day: "Sat", completed: 20, scheduled: 16, progress: 7, cancelled: 1 },
  { day: "Sun", completed: 22, scheduled: 18, progress: 9, cancelled: 2 },
];

const MOCK_COUNSEL_MODE = [
  { name: "Video", value: 36, pct: "53%", color: "#a855f7" },
  { name: "Phone", value: 20, pct: "29%", color: "#3b82f6" },
  { name: "In-Person", value: 8, pct: "12%", color: "#10b981" },
  { name: "Other", value: 4, pct: "6%", color: "#f59e0b" },
];

const MOCK_SHELTER_KPIS = [
  {
    label: "Available Beds",
    value: "186",
    icon: Home,
    tone: "violet",
    delta: { dir: "up", text: "12.4%" },
  },
  {
    label: "Active Placements",
    value: "237",
    icon: Users,
    tone: "sky",
    delta: { dir: "up", text: "8.7%" },
  },
  {
    label: "Pending Requests",
    value: "34",
    icon: ClipboardList,
    tone: "amber",
    delta: { dir: "down", text: "5.6%" },
  },
  {
    label: "Partner Shelters",
    value: "18",
    icon: Building2,
    tone: "emerald",
    delta: { dir: "up", text: "5.9%" },
  },
] as const;

const MOCK_SHELTERS = [
  {
    name: "Safe Haven Shelter",
    loc: "Pretoria, GP",
    cap: 60,
    beds: 18,
    contact: "+27 12 345 6789",
    status: "Available",
  },
  {
    name: "Ubuntu House",
    loc: "Johannesburg, GP",
    cap: 40,
    beds: 7,
    contact: "+27 11 234 5678",
    status: "Limited",
  },
  {
    name: "New Beginnings",
    loc: "Cape Town, WC",
    cap: 50,
    beds: 12,
    contact: "+27 21 456 7890",
    status: "Available",
  },
  {
    name: "Hope Shelter",
    loc: "Durban, KZN",
    cap: 35,
    beds: 3,
    contact: "+27 31 567 8901",
    status: "Limited",
  },
  {
    name: "Lebone Shelter",
    loc: "Polokwane, LP",
    cap: 25,
    beds: 8,
    contact: "+27 15 123 4567",
    status: "Available",
  },
  {
    name: "Thuthuzela House",
    loc: "Port Elizabeth, EC",
    cap: 30,
    beds: 6,
    contact: "+27 41 234 5678",
    status: "Limited",
  },
  {
    name: "Peaceful Pathways",
    loc: "Bloemfontein, FS",
    cap: 20,
    beds: 2,
    contact: "+27 51 987 6543",
    status: "Limited",
  },
  {
    name: "Safe Space Shelter",
    loc: "East London, EC",
    cap: 25,
    beds: 14,
    contact: "+27 43 654 3210",
    status: "Available",
  },
];

const MOCK_SHELTER_MAP: MapRegion[] = [
  {
    id: "pol",
    name: "Polokwane",
    country: "8 beds",
    riskLevel: "low",
    incidents: 8,
    lat: -23.9,
    lng: 29.45,
  },
  {
    id: "pta",
    name: "Pretoria",
    country: "18 beds",
    riskLevel: "low",
    incidents: 18,
    lat: -25.74,
    lng: 28.19,
  },
  {
    id: "jhb",
    name: "Johannesburg",
    country: "12 beds",
    riskLevel: "medium",
    incidents: 12,
    lat: -26.2,
    lng: 28.04,
  },
  {
    id: "dbn",
    name: "Durban",
    country: "3 beds",
    riskLevel: "high",
    incidents: 3,
    lat: -29.86,
    lng: 31.02,
  },
  {
    id: "bfn",
    name: "Bloemfontein",
    country: "2 beds",
    riskLevel: "high",
    incidents: 2,
    lat: -29.12,
    lng: 26.21,
  },
  {
    id: "el",
    name: "East London",
    country: "14 beds",
    riskLevel: "low",
    incidents: 14,
    lat: -33.02,
    lng: 27.91,
  },
  {
    id: "pe",
    name: "Port Elizabeth",
    country: "6 beds",
    riskLevel: "medium",
    incidents: 6,
    lat: -33.96,
    lng: 25.6,
  },
  {
    id: "cpt",
    name: "Cape Town",
    country: "12 beds",
    riskLevel: "medium",
    incidents: 12,
    lat: -33.92,
    lng: 18.42,
  },
];

const MOCK_URGENT_SHELTER = [
  {
    tag: "Critical",
    id: "CASE-2026-1187",
    type: "Domestic Violence",
    loc: "Pretoria, GP",
    time: "20m ago",
  },
  {
    tag: "Critical",
    id: "CASE-2026-1185",
    type: "Sexual Assault",
    loc: "Cape Town, WC",
    time: "35m ago",
  },
  {
    tag: "High",
    id: "CASE-2026-1182",
    type: "Child Abuse",
    loc: "Durban, KZN",
    time: "50m ago",
  },
  {
    tag: "High",
    id: "CASE-2026-1180",
    type: "Emotional Abuse",
    loc: "Polokwane, LP",
    time: "1h ago",
  },
  {
    tag: "Medium",
    id: "CASE-2026-1179",
    type: "Domestic Violence",
    loc: "Bloemfontein, FS",
    time: "1h ago",
  },
];

const MOCK_LEGAL_KPIS = [
  {
    label: "Open Legal Referrals",
    value: "142",
    icon: FileText,
    tone: "violet",
    delta: { dir: "up", text: "14.6%" },
  },
  {
    label: "Court Dates",
    value: "28",
    icon: Calendar,
    tone: "sky",
    delta: { dir: "up", text: "12.3%" },
  },
  {
    label: "Active Legal Partners",
    value: "16",
    icon: Users,
    tone: "emerald",
    delta: { dir: "up", text: "6.7%" },
  },
  {
    label: "Urgent Legal Needs",
    value: "12",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "20.0%" },
  },
] as const;

const MOCK_LEGAL_CASES = [
  {
    id: "LAE-2026-1187",
    name: "Thandi N.",
    meta: "28 yrs • Johannesburg",
    need: "Domestic Violence Protection Order",
    firm: "Justice First Legal",
    adv: "Adv. Priya Naidoo",
    date: "May 19, 2026",
    time: "10:00 AM",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "LAE-2026-1185",
    name: "Nomsa D.",
    meta: "34 yrs • Cape Town",
    need: "Sexual Assault Case Representation",
    firm: "Women's Justice Collective",
    adv: "Adv. Lerato Khumalo",
    date: "May 20, 2026",
    time: "09:30 AM",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "LAE-2026-1182",
    name: "Zanele P.",
    meta: "31 yrs • Durban",
    need: "Child Custody Dispute",
    firm: "Khanyisa Attorneys",
    adv: "Adv. Sipho M.",
    date: "May 22, 2026",
    time: "11:00 AM",
    status: "Scheduled",
    priority: "Medium",
  },
  {
    id: "LAE-2026-1180",
    name: "Aisha F.",
    meta: "27 yrs • Pretoria",
    need: "Maintenance Application",
    firm: "Pro Bono SA",
    adv: "Adv. Thabo R.",
    date: "May 25, 2026",
    time: "02:00 PM",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "LAE-2026-1178",
    name: "Mpho L.",
    meta: "23 yrs • Polokwane",
    need: "Eviction Prevention",
    firm: "Legal Aid SA",
    adv: "Adv. Nomvula S.",
    date: "May 27, 2026",
    time: "09:00 AM",
    status: "New",
    priority: "Medium",
  },
  {
    id: "LAE-2026-1176",
    name: "Kgomotso T.",
    meta: "29 yrs • Bloemfontein",
    need: "Employment Dispute",
    firm: "Work Rights Alliance",
    adv: "Adv. David Jacobs",
    date: "May 27, 2026",
    time: "10:30 AM",
    status: "In Progress",
    priority: "Low",
  },
  {
    id: "LAE-2026-1173",
    name: "Sibongile P.",
    meta: "38 yrs • East London",
    need: "Property Rights Claim",
    firm: "Ubuntu Law Collective",
    adv: "Adv. Lindiwe M.",
    date: "Jun 1, 2026",
    time: "11:00 AM",
    status: "Scheduled",
    priority: "Low",
  },
  {
    id: "LAE-2026-1170",
    name: "Jacqueline R.",
    meta: "26 yrs • Nelspruit",
    need: "Harassment Case",
    firm: "Safe Justice Network",
    adv: "Adv. Priya Naidoo",
    date: "Jun 3, 2026",
    time: "01:30 PM",
    status: "New",
    priority: "High",
  },
];

const MOCK_COURT_DATES = [
  {
    d: "MAY",
    n: "19",
    name: "Thandi N. – Protection Order Hearing",
    sub: "LAE-2026-1187 • Justice First Legal",
    court: "10:00 AM • Johannesburg Magistrate Court",
    chip: "TODAY",
  },
  {
    d: "MAY",
    n: "20",
    name: "Nomsa D. – Trial Preparation",
    sub: "LAE-2026-1185 • Women's Justice Collective",
    court: "09:30 AM • Cape Town High Court",
    chip: "1 DAY",
  },
  {
    d: "MAY",
    n: "22",
    name: "Zanele P. – Custody Hearing",
    sub: "LAE-2026-1182 • Khanyisa Attorneys",
    court: "11:00 AM • Durban Family Court",
    chip: "3 DAYS",
  },
  {
    d: "MAY",
    n: "25",
    name: "Aisha F. – Maintenance Hearing",
    sub: "LAE-2026-1180 • Pro Bono SA",
    court: "02:00 PM • Pretoria Regional Court",
    chip: "6 DAYS",
  },
  {
    d: "MAY",
    n: "27",
    name: "Mpho L. – Eviction Hearing",
    sub: "LAE-2026-1178 • Legal Aid SA",
    court: "09:00 AM • Polokwane Magistrate Court",
    chip: "8 DAYS",
  },
];

const MOCK_MEDICAL_KPIS = [
  {
    label: "Medical Referrals",
    value: "285",
    icon: Plus,
    tone: "violet",
    delta: { dir: "up", text: "14.5%" },
  },
  {
    label: "Completed Visits",
    value: "198",
    icon: Stethoscope,
    tone: "sky",
    delta: { dir: "up", text: "12.8%" },
  },
  {
    label: "Partner Clinics",
    value: "24",
    icon: Building2,
    tone: "emerald",
    delta: { dir: "up", text: "6.3%" },
  },
  {
    label: "Urgent Cases",
    value: "23",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "8.7%" },
  },
] as const;

const MOCK_MEDICAL = [
  {
    name: "Lerato K.",
    caseId: "AEG-2026-1185",
    service: "General Checkup",
    serviceSub: "Routine",
    facility: "SafeCare Clinic",
    loc: "Johannesburg",
    date: "May 16, 2025",
    time: "09:30 AM",
    status: "Scheduled",
    priority: "Medium",
  },
  {
    name: "Nomsa D.",
    caseId: "AEG-2026-1182",
    service: "STI Screening",
    serviceSub: "Lab Test",
    facility: "HopeHealth Center",
    loc: "Durban",
    date: "May 16, 2025",
    time: "11:00 AM",
    status: "Scheduled",
    priority: "Medium",
  },
  {
    name: "Thandi N.",
    caseId: "AEG-2026-1187",
    service: "GYN Consultation",
    serviceSub: "Specialist",
    facility: "Ubuntu Women's Clinic",
    loc: "Pretoria",
    date: "May 17, 2025",
    time: "02:00 PM",
    status: "In Progress",
    priority: "High",
  },
  {
    name: "Sipho M.",
    caseId: "AEG-2026-1180",
    service: "Mental Health Eval.",
    serviceSub: "Consultation",
    facility: "LifeLine Health",
    loc: "Cape Town",
    date: "May 18, 2025",
    time: "10:30 AM",
    status: "Scheduled",
    priority: "Medium",
  },
  {
    name: "Aisha F.",
    caseId: "AEG-2026-1180",
    service: "Pregnancy Care",
    serviceSub: "Follow-up",
    facility: "SafeCare Clinic",
    loc: "Johannesburg",
    date: "May 19, 2025",
    time: "09:00 AM",
    status: "Pending",
    priority: "High",
  },
  {
    name: "Zanele P.",
    caseId: "AEG-2026-1182",
    service: "HIV Testing",
    serviceSub: "Lab Test",
    facility: "HopeHealth Center",
    loc: "Durban",
    date: "May 19, 2025",
    time: "01:30 PM",
    status: "Pending",
    priority: "Medium",
  },
  {
    name: "Mpho L.",
    caseId: "AEG-2026-1178",
    service: "Dermatology Consult",
    serviceSub: "Specialist",
    facility: "Ubuntu Women's Clinic",
    loc: "Pretoria",
    date: "May 20, 2025",
    time: "03:00 PM",
    status: "Scheduled",
    priority: "Low",
  },
  {
    name: "John D.",
    caseId: "AEG-2026-1174",
    service: "Physical Therapy",
    serviceSub: "Rehabilitation",
    facility: "LifeLine Health",
    loc: "Cape Town",
    date: "May 21, 2025",
    time: "11:00 AM",
    status: "Confirmed",
    priority: "Low",
  },
];

const MOCK_URGENT_MEDICAL = [
  {
    id: "Case AEG-2026-1187",
    name: "Thandi N.",
    need: "Severe abdominal pain",
    ref: "LifeLine Health, Cape Town",
    time: "10m ago",
  },
  {
    id: "Case AEG-2026-1182",
    name: "Zanele P.",
    need: "High fever and chills",
    ref: "HopeHealth Center, Durban",
    time: "25m ago",
  },
  {
    id: "Case AEG-2026-1185",
    name: "Nomsa D.",
    need: "Severe pelvic pain",
    ref: "Ubuntu Women's Clinic, Pretoria",
    time: "35m ago",
  },
  {
    id: "Case AEG-2026-1178",
    name: "Mpho L.",
    need: "Allergic reaction",
    ref: "SafeCare Clinic, Johannesburg",
    time: "1h ago",
  },
];

const MOCK_FACILITY_UTIL = [
  { name: "SafeCare Clinic – Johannesburg", pct: 78 },
  { name: "HopeHealth Center – Durban", pct: 65 },
  { name: "Ubuntu Women's Clinic – Pretoria", pct: 82 },
  { name: "LifeLine Health – Cape Town", pct: 71 },
];

const MOCK_ANALYTICS_KPIS = [
  {
    label: "Cases This Month",
    value: "1,287",
    icon: Briefcase,
    tone: "violet",
    delta: { dir: "up", text: "14.6%" },
    sub: "vs Mar 17 – Apr 15",
  },
  {
    label: "Referral Success Rate",
    value: "82.4%",
    icon: Users,
    tone: "sky",
    delta: { dir: "up", text: "8.7%" },
    sub: "vs Mar 17 – Apr 15",
  },
  {
    label: "Survivors Assisted",
    value: "2,451",
    icon: Heart,
    tone: "emerald",
    delta: { dir: "up", text: "12.3%" },
    sub: "vs Mar 17 – Apr 15",
  },
  {
    label: "Resolution Rate",
    value: "76.3%",
    icon: CheckCircle2,
    tone: "amber",
    delta: { dir: "up", text: "7.2%" },
    sub: "vs Mar 17 – Apr 15",
  },
] as const;

const MOCK_CASE_TRENDS = Array.from({ length: 15 }, (_, i) => ({
  day: `D${i + 1}`,
  newCases: 200 + Math.round(Math.sin(i / 2) * 60) + i * 12,
  inProgress: 150 + Math.round(Math.cos(i / 2) * 40) + i * 8,
  resolved: 90 + i * 6,
  closed: 40 + Math.round(Math.sin(i / 3) * 10),
}));

const MOCK_CASES_BY_TYPE = [
  { name: "Domestic Violence", value: 540, pct: "42% (540)", color: "#a855f7" },
  { name: "Sexual Assault", value: 270, pct: "21% (270)", color: "#f43f5e" },
  { name: "Child Abuse", value: 193, pct: "15% (193)", color: "#3b82f6" },
  { name: "Emotional Abuse", value: 129, pct: "10% (129)", color: "#10b981" },
  { name: "Human Trafficking", value: 90, pct: "7% (90)", color: "#f59e0b" },
  { name: "Other", value: 65, pct: "5% (65)", color: "#64748b" },
];

const MOCK_TOP_REGIONS = [
  { name: "Gauteng", value: "624", pct: "48.5%" },
  { name: "Western Cape", value: "312", pct: "24.3%" },
  { name: "KwaZulu-Natal", value: "198", pct: "15.4%" },
  { name: "Eastern Cape", value: "89", pct: "6.9%" },
  { name: "Limpopo", value: "64", pct: "5.0%" },
];

const MOCK_SERVICE_UTIL = [
  {
    week: "Apr 16 – 22",
    counseling: 480,
    shelter: 310,
    legal: 220,
    medical: 185,
    emergency: 120,
  },
  {
    week: "Apr 23 – 29",
    counseling: 520,
    shelter: 330,
    legal: 235,
    medical: 190,
    emergency: 140,
  },
  {
    week: "Apr 30 – May 6",
    counseling: 610,
    shelter: 360,
    legal: 260,
    medical: 210,
    emergency: 150,
  },
  {
    week: "May 7 – 13",
    counseling: 560,
    shelter: 340,
    legal: 245,
    medical: 200,
    emergency: 135,
  },
  {
    week: "May 14 – 15",
    counseling: 580,
    shelter: 355,
    legal: 240,
    medical: 195,
    emergency: 130,
  },
];

const MOCK_REPORT_KPIS = [
  {
    label: "Reports Generated",
    value: "186",
    icon: BarChart3,
    tone: "violet",
    delta: { dir: "up", text: "18.6%" },
  },
  {
    label: "Monthly Reports",
    value: "24",
    icon: Calendar,
    tone: "sky",
    delta: { dir: "up", text: "9.1%" },
  },
  {
    label: "Pending Reports",
    value: "8",
    icon: Clock,
    tone: "amber",
    delta: { dir: "down", text: "3.6%" },
  },
  {
    label: "Exported Files",
    value: "142",
    icon: FileText,
    tone: "emerald",
    delta: { dir: "up", text: "22.8%" },
  },
] as const;

const MOCK_REPORT_CATEGORIES = [
  {
    name: "Case Reports",
    desc: "Overview of cases, status, outcomes, and case management performance.",
    icon: FolderOpen,
    tone: "violet",
    count: 28,
  },
  {
    name: "Counseling Reports",
    desc: "Counseling session statistics, survivor progress, and wellbeing indicators.",
    icon: Heart,
    tone: "rose",
    count: 22,
  },
  {
    name: "Shelter Reports",
    desc: "Shelter occupancy, referrals, length of stay, and shelter utilization.",
    icon: Home,
    tone: "sky",
    count: 18,
  },
  {
    name: "Legal Aid Reports",
    desc: "Legal case tracking, outcomes, and legal assistance provided.",
    icon: Scale,
    tone: "violet",
    count: 16,
  },
  {
    name: "Medical Support Reports",
    desc: "Medical services provided, referrals, and health support statistics.",
    icon: Plus,
    tone: "emerald",
    count: 14,
  },
  {
    name: "Community Outreach Reports",
    desc: "Outreach programs, participants, and community engagement metrics.",
    icon: Users,
    tone: "amber",
    count: 20,
  },
];

const MOCK_RECENT_REPORTS = [
  {
    name: "Monthly Case Summary - April 2026",
    by: "Sarah M.",
    role: "Program Director",
    date: "May 15, 2026 10:30 AM",
    status: "Completed",
  },
  {
    name: "Counseling Services Report - Q2 2026",
    by: "Priya N.",
    role: "Counseling Lead",
    date: "May 14, 2026 05:45 PM",
    status: "Completed",
  },
  {
    name: "Shelter Utilization Report - April 2026",
    by: "Thabo R.",
    role: "Shelter Coordinator",
    date: "May 14, 2026 09:15 AM",
    status: "Completed",
  },
  {
    name: "Legal Aid Case Outcomes - Q1 2026",
    by: "Aisha F.",
    role: "Legal Advisor",
    date: "May 13, 2026 02:20 PM",
    status: "Completed",
  },
  {
    name: "Medical Support Report - April 2026",
    by: "Dr. Nomsa D.",
    role: "Medical Coordinator",
    date: "May 12, 2026 11:05 AM",
    status: "Processing",
  },
  {
    name: "Community Outreach Impact - Q1 2026",
    by: "Lerato K.",
    role: "Outreach Manager",
    date: "May 11, 2026 04:30 PM",
    status: "Failed",
  },
];

/* ============================== NAV / META ============================== */

const SECTION_META: Record<
  string,
  { title: string; subtitle: string; greeting?: boolean }
> = {
  overview: {
    title: "Welcome, Hope Foundation",
    subtitle: "Empowering survivors. Strengthening communities.",
    greeting: true,
  },
  cases: {
    title: "Cases",
    subtitle: "Manage and track survivor cases efficiently.",
  },
  survivors: {
    title: "Survivors",
    subtitle: "Manage survivor profiles, needs, and support services.",
  },
  referrals: {
    title: "Referrals",
    subtitle:
      "Connect survivors with trusted services and partner organizations.",
  },
  followups: {
    title: "Follow-ups",
    subtitle:
      "Manage and track survivor follow-ups to ensure timely support and continuity of care.",
  },
  counseling: {
    title: "Counseling",
    subtitle:
      "Manage counseling sessions, counselor assignments, and survivor support.",
  },
  shelter: {
    title: "Shelter",
    subtitle:
      "Manage partner shelters, capacity, and safe accommodation placements.",
  },
  legalaid: {
    title: "Legal Aid",
    subtitle:
      "Provide legal support and ensure access to justice for survivors.",
  },
  medical: {
    title: "Medical Support",
    subtitle:
      "Manage medical referrals, appointments, and survivor healthcare support.",
  },
  analytics: {
    title: "Analytics Dashboard",
    subtitle: "Data-driven insights to monitor impact and improve outcomes.",
  },
  reports: {
    title: "Reports",
    subtitle:
      "Generate, manage, and export reports to track impact and performance.",
  },
};

const NAV_GROUPS: {
  heading?: string;
  items: {
    key: SectionKey | string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[];
}[] = [
  { items: [{ key: "overview", label: "Overview", icon: LayoutGrid }] },
  {
    heading: "Case Management",
    items: [
      { key: "cases", label: "Cases", icon: Briefcase },
      { key: "survivors", label: "Survivors", icon: Users },
      { key: "referrals", label: "Referrals", icon: Send },
      { key: "followups", label: "Follow-ups", icon: RefreshCw },
      { key: "messages", label: "Secure Messages", icon: MessageSquare },
    ],
  },
  {
    heading: "Service Management",
    items: [
      { key: "counseling", label: "Counseling", icon: MessageSquare },
      { key: "shelter", label: "Shelter", icon: Home },
      { key: "legalaid", label: "Legal Aid", icon: Scale },
      { key: "medical", label: "Medical Support", icon: Stethoscope },
      { key: "emergency", label: "Emergency Aid", icon: AlertTriangle },
    ],
  },
  {
    heading: "Community & Outreach",
    items: [
      { key: "community", label: "Community Programs", icon: Users },
      { key: "awareness", label: "Awareness Campaigns", icon: Megaphone },
      { key: "volunteers", label: "Volunteer Management", icon: Heart },
    ],
  },
  {
    heading: "Resources",
    items: [
      { key: "directory", label: "Resource Directory", icon: FolderOpen },
      { key: "library", label: "Document Library", icon: BookOpen },
      { key: "training", label: "Training Materials", icon: GraduationCap },
    ],
  },
  {
    heading: "Reports & Analytics",
    items: [
      { key: "analytics", label: "Analytics Dashboard", icon: BarChart3 },
      { key: "reports", label: "Reports", icon: FileText },
    ],
  },
  {
    heading: "Administration",
    items: [
      { key: "team", label: "Team Management", icon: Users },
      { key: "settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

const DETAILED: SectionKey[] = [
  "overview",
  "cases",
  "survivors",
  "referrals",
  "followups",
  "counseling",
  "shelter",
  "legalaid",
  "medical",
  "analytics",
  "reports",
  "messages",
];

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
      "completed",
      "accepted",
      "available",
      "confirmed",
      "resolved",
      "verified",
    ].includes(v)
  )
    return "emerald";
  if (
    [
      "in progress",
      "scheduled",
      "pending",
      "awaiting response",
      "upcoming",
      "due today",
      "medium",
      "medium priority",
      "limited",
    ].includes(v)
  )
    return "amber";
  if (
    [
      "critical",
      "high",
      "high priority",
      "rejected",
      "failed",
      "overdue",
      "processing",
    ].includes(v)
  )
    return v === "processing" ? "sky" : "rose";
  if (["new", "assigned", "low"].includes(v)) return "sky";
  return "slate";
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
  <span className="inline-flex items-center gap-1 text-[11px] font-medium">
    <span
      className={cn(
        "font-bold",
        dir === "up" ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {dir === "up" ? "↑" : "↓"} {text}
    </span>
    <span className="text-slate-500">{sub ?? "vs last 7 days"}</span>
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
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
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
  sub,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  delta?: { dir: string; text: string };
  sub?: string;
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
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black text-white">{value}</p>
        {delta ? (
          <div className="mt-0.5">
            <Delta dir={delta.dir} text={delta.text} sub={sub} />
          </div>
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

/* ============================ PORTAL CONTEXT ============================ */

type NgoPortalContextValue = {
  section: SectionKey;
  navigate: (section: SectionKey) => void;
};

const NgoPortalContext = createContext<NgoPortalContextValue | null>(null);

const useNgoPortal = (): NgoPortalContextValue => {
  const ctx = useContext(NgoPortalContext);
  if (!ctx) throw new Error("useNgoPortal must be used within NgoPortal");
  return ctx;
};

/** Route a quick-action label to the section that owns that capability. */
const ACTION_TARGETS: { match: string; section: SectionKey }[] = [
  { match: "case", section: "cases" },
  { match: "survivor", section: "survivors" },
  { match: "referral", section: "referrals" },
  { match: "refer", section: "referrals" },
  { match: "follow", section: "followups" },
  { match: "counsel", section: "counseling" },
  { match: "session", section: "counseling" },
  { match: "shelter", section: "shelter" },
  { match: "bed", section: "shelter" },
  { match: "legal", section: "legalaid" },
  { match: "medical", section: "medical" },
  { match: "facility", section: "medical" },
  { match: "report", section: "reports" },
  { match: "analytic", section: "analytics" },
  { match: "message", section: "messages" },
  { match: "contact", section: "messages" },
];

const sectionForAction = (label: string): SectionKey | undefined =>
  ACTION_TARGETS.find((entry) => label.toLowerCase().includes(entry.match))
    ?.section;

/** Client-side CSV download of live rows (quotes and escapes cell values). */
const downloadCsv = (
  filename: string,
  rows: Record<string, unknown>[],
): boolean => {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => cell(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
};

/** Dropdown filter chip: selecting an option updates the chip label. */
const SelectChip = ({
  label,
  options,
  onSelect,
}: {
  label: string;
  options?: string[];
  onSelect?: (option: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(label);
  const choices = options ?? [label];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
      >
        {selected}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#0c1224] shadow-xl shadow-black/40">
          {choices.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setSelected(option);
                setOpen(false);
                onSelect?.(option);
              }}
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
  const { section, navigate } = useNgoPortal();

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
      className="text-[11px] font-bold text-violet-400 hover:text-violet-300"
    >
      {label}
    </button>
  );
};

const Pagination = ({ pages = ["1"] }: { pages?: string[] }) => {
  const [active, setActive] = useState(pages[0] ?? "1");
  const activeIndex = Math.max(0, pages.indexOf(active));

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => setActive(pages[Math.max(0, activeIndex - 1)])}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-500 hover:bg-white/5"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) => (
        <button
          key={`${p}-${i}`}
          type="button"
          onClick={() => setActive(p)}
          className={cn(
            "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[11px] font-bold",
            p === active
              ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
              : "border border-white/10 text-slate-400 hover:bg-white/5",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        onClick={() =>
          setActive(pages[Math.min(pages.length - 1, activeIndex + 1)])
        }
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-500 hover:bg-white/5"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

/**
 * Row-level actions. `subject` names the row for the confirmation/detail
 * toasts; `detail` (when provided) is shown by the view action; `onExport`
 * (when provided) replaces the default "more" behaviour with a CSV export.
 */
const RowActions = ({
  subject,
  detail,
  onExport,
}: {
  subject?: string;
  detail?: string;
  onExport?: () => void;
}) => (
  <div className="flex items-center justify-end gap-1.5">
    <button
      type="button"
      aria-label={subject ? `View ${subject}` : "View details"}
      onClick={() =>
        toast.info(detail ?? `${subject ?? "Record"} — full detail below.`)
      }
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-violet-300 hover:bg-white/5"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      aria-label={subject ? `Edit ${subject}` : "Edit"}
      onClick={() =>
        toast.info(
          "Editing is coordinated with the case team — use Secure Messages to request changes.",
        )
      }
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      aria-label={subject ? `Export ${subject}` : "More actions"}
      onClick={() =>
        onExport ? onExport() : toast.info(`${subject ?? "Record"} noted.`)
      }
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  </div>
);

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

const QuickActionGrid = ({
  items,
  cols = "sm:grid-cols-2",
}: {
  items: {
    label: string;
    desc: string;
    icon: ComponentType<{ className?: string }>;
  }[];
  cols?: string;
}) => {
  const { section, navigate } = useNgoPortal();

  const handleAction = (label: string) => {
    const target = sectionForAction(label);
    if (target && target !== section) {
      navigate(target);
    } else {
      toast.success(label);
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3", cols)}>
      {items.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => handleAction(a.label)}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-left transition-colors hover:border-white/20"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">{a.label}</p>
              <p className="text-[10px] text-slate-500">{a.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

/* ================================ PORTAL ================================ */

const NgoPortal: React.FC = () => {
  const [section, setSection] = useState<SectionKey>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Placeholder sections take their title from the nav label rather than a
  // generic "Section" heading.
  const navLabel = NAV_GROUPS.flatMap((group) => group.items).find(
    (item) => item.key === section,
  )?.label;
  const meta = SECTION_META[section] ?? {
    title: navLabel ?? "Section",
    subtitle: "This workspace is being connected to live AEGIS data.",
  };

  const portalContext = useMemo<NgoPortalContextValue>(
    () => ({ section, navigate: setSection }),
    [section],
  );

  const { user, signOut } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { organizationName } = useOrganizationContext();
  const orgName = organizationName || MOCK_ORG.name;
  const account = {
    name: profile?.fullName || MOCK_ORG.user,
    role: profile?.role
      ? (ROLE_DEFINITIONS[profile.role as UserRole]?.label ??
        titleCase(profile.role))
      : MOCK_ORG.role,
  };

  // Live bell count: escalations not yet attended by a responder.
  const { data: headerEscalations = [] } = useEscalationEvents({
    limit: 200,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const pendingAlerts = headerEscalations.filter(
    (e) =>
      !["acknowledged", "dispatched", "resolved", "closed"].includes(
        (e.status || "").toLowerCase(),
      ),
  ).length;

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
    <NgoPortalContext.Provider value={portalContext}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#070b18] text-slate-50">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0a0f1f] lg:flex">
          <div className="flex items-center justify-between px-5 py-5">
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 40 40"
                className="h-9 w-9 shrink-0"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="aegis-ngo" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#6d28d9" />
                  </linearGradient>
                </defs>
                <path d="M20 2 L36 11 L20 38 L4 11 Z" fill="url(#aegis-ngo)" />
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
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
                  NGO Portal
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-600" />
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.heading ?? `g-${gi}`}>
                {group.heading && (
                  <p className="px-3 pb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                    {group.heading}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = section === item.key;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setSection(item.key as SectionKey)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all",
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
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Organization Status
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
              Verified NGO
            </p>
            <div className="mt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Partnership Level</span>
                <span className="font-bold text-amber-400">Gold</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Member Since</span>
                <span className="text-slate-300">Jan 2024</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  `${orgName} — organization details are managed by your administrator in the Admin console.`,
                )
              }
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 py-2 text-[11px] font-bold text-white"
            >
              View Organization Profile
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0f1f]/80 px-4 backdrop-blur-xl md:px-6">
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 truncate text-base font-black tracking-tight text-white md:text-lg">
                {meta.greeting ? `Welcome, ${orgName}` : meta.title}
                {meta.greeting && (
                  <CheckCircle2 className="h-4 w-4 text-violet-400" />
                )}
              </h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {meta.subtitle}
              </p>
            </div>
            <div className="relative ml-auto hidden max-w-md flex-1 lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search cases, survivors, services, resources..."
                className="h-9 border-white/10 bg-slate-900/60 pl-10 pr-12 text-sm text-white placeholder:text-slate-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 text-[10px] text-slate-500">
                ⌘K
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                LIVE
              </span>
              <button
                type="button"
                onClick={() => setSection("cases")}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {pendingAlerts > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                    {pendingAlerts > 9 ? "9+" : pendingAlerts}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => window.open("/info/how-it-works", "_blank")}
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
                  <Avatar name={account.name} />
                  <div className="hidden text-left leading-tight lg:block">
                    <p className="text-sm font-bold text-white">
                      {account.name}
                    </p>
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

          {/* Mobile nav */}
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
                    : "text-slate-400 hover:text-white",
                )}
              >
                {key}
              </button>
            ))}
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
              {!DETAILED.includes(section) && <SectionTitle meta={meta} />}
              {section === "overview" && (
                <OverviewSection onNavigate={setSection} />
              )}
              {section === "cases" && <CasesSection />}
              {section === "survivors" && <SurvivorsSection />}
              {section === "referrals" && <ReferralsSection />}
              {section === "followups" && <FollowupsSection />}
              {section === "counseling" && <CounselingSection />}
              {section === "shelter" && <ShelterSection />}
              {section === "legalaid" && <LegalAidSection />}
              {section === "medical" && <MedicalSection />}
              {section === "analytics" && <AnalyticsSection />}
              {section === "reports" && <ReportsSection />}
              {section === "messages" && <SecureMessagesWorkspace />}
              {!DETAILED.includes(section) && (
                <PlaceholderSection meta={meta} />
              )}
            </div>
          </main>
        </div>
      </div>
    </NgoPortalContext.Provider>
  );
};

const SectionTitle = ({
  meta,
}: {
  meta: { title: string; subtitle: string };
}) => (
  <div>
    <h2 className="text-2xl font-black tracking-tight text-white">
      {meta.title}
    </h2>
    <p className="mt-1 text-sm text-slate-400">{meta.subtitle}</p>
  </div>
);

const PlaceholderSection = ({ meta }: { meta: { title: string } }) => (
  <Panel>
    <div className="grid place-items-center px-4 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border-2 border-violet-500/30 bg-violet-500/10 text-violet-300">
        <LayoutGrid className="h-6 w-6" />
      </div>
      <p className="text-sm font-bold text-slate-200">{meta.title}</p>
      <p className="mt-1 max-w-md text-xs text-slate-500">
        This module is part of the NGO portal layout and will surface live data
        once its backend is connected.
      </p>
    </div>
  </Panel>
);

/* =============================== Overview =============================== */

const OverviewSection = ({
  onNavigate,
}: {
  onNavigate: (s: SectionKey) => void;
}) => (
  <>
    <SectionTitle
      meta={{
        title: "Overview",
        subtitle: "A snapshot of your organization's impact and active work.",
      }}
    />
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {gateKpis(MOCK_CASE_KPIS).map((k) => (
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
      <Panel title="Active Survivors by Need" className="xl:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MOCK_SUPPORT_CATEGORIES.map((c) => (
            <div
              key={c.name}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center"
            >
              <p
                className={cn(
                  "text-2xl font-black",
                  c.color === "rose"
                    ? "text-rose-400"
                    : c.color === "violet"
                      ? "text-violet-400"
                      : c.color === "sky"
                        ? "text-sky-400"
                        : "text-emerald-400",
                )}
              >
                {c.value}
              </p>
              <p className="mt-1 text-[11px] font-bold text-white">{c.name}</p>
              <p className="text-[10px] text-slate-500">{c.pct}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <QuickActionGrid
            items={MOCK_CASE_QUICK.slice(0, 4)}
            cols="sm:grid-cols-2 xl:grid-cols-4"
          />
        </div>
      </Panel>
      <Panel title="Urgent Cases" action={<LinkChip label="View all" />}>
        <div className="space-y-2">
          {MOCK_URGENT_CASES.slice(0, 5).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onNavigate("cases")}
              className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left hover:border-white/15"
            >
              <Pill tone="rose">Critical</Pill>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{c.id}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {c.type} • {c.loc}
                </p>
              </div>
              <span className="text-[10px] text-slate-500">{c.time}</span>
            </button>
          ))}
        </div>
      </Panel>
    </section>
  </>
);

/* =============================== Cases =============================== */

const NGO_TYPE_COLORS = [
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#3b82f6",
  "#10b981",
];

const CasesSection = () => {
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All Risk Levels");

  const isResolved = (c: { status: string }) =>
    ["closed", "resolved"].includes((c.status || "").toLowerCase());
  const caseKpis = MOCK_CASE_KPIS.map((k) => {
    if (k.label === "Open Cases" && cases.length)
      return {
        ...k,
        value: nf.format(cases.filter((c) => !isResolved(c)).length),
        delta: undefined,
      };
    if (k.label === "High Risk Cases" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) =>
            ["critical", "high"].includes((c.riskLevel || "").toLowerCase()),
          ).length,
        ),
        delta: undefined,
      };
    if (k.label === "In Progress" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) =>
            ["in_progress", "open", "assigned"].includes(
              (c.status || "").toLowerCase(),
            ),
          ).length,
        ),
        delta: undefined,
      };
    if (k.label === "Resolved" && cases.length)
      return {
        ...k,
        value: nf.format(cases.filter(isResolved).length),
        delta: undefined,
      };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, delta: undefined };
  });

  const caseRows = cases.length
    ? cases.map((c, i) => ({
        id: `AEG-${c.id.slice(0, 8).toUpperCase()}`,
        name: "Protected",
        sid: `SUR-${c.id.slice(0, 6).toUpperCase()}`,
        type: c.description
          ? c.description.length > 24
            ? `${c.description.slice(0, 24)}…`
            : c.description
          : "GBV Case",
        typeColor: NGO_TYPE_COLORS[i % NGO_TYPE_COLORS.length],
        risk: titleCase(c.riskLevel),
        status: titleCase((c.status || "").replace(/_/g, " ")),
        worker: "Unassigned",
        updated: fmtRelative(c.createdAt),
      }))
    : ALLOW_MOCK
      ? MOCK_CASES
      : [];

  // Real filtering over the live rows: free-text search + risk level.
  const visibleRows = caseRows.filter((c) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      [c.id, c.sid, c.type, c.status, c.worker]
        .join(" ")
        .toLowerCase()
        .includes(q);
    const matchesRisk =
      riskFilter === "All Risk Levels" ||
      c.risk.toLowerCase() === riskFilter.toLowerCase();
    return matchesQuery && matchesRisk;
  });

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {caseKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
          />
        ))}
      </section>

      <Panel bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cases by ID, survivor, or keyword..."
              className="h-9 border-white/10 bg-slate-900/60 pl-10 text-sm text-white placeholder:text-slate-500"
            />
          </div>
          <SelectChip
            key={`risk-${riskFilter}`}
            label={riskFilter}
            options={["All Risk Levels", "Critical", "High", "Medium", "Low"]}
            onSelect={setRiskFilter}
          />
          <SelectChip
            label="All Assigned Workers"
            options={["All Assigned Workers", "Unassigned"]}
          />
          <SelectChip
            label="Last 30 days"
            options={["Last 7 days", "Last 30 days", "Last 90 days"]}
          />
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRiskFilter("All Risk Levels");
              toast.info("Filters reset");
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() =>
              toast.success(
                `${visibleRows.length} case${visibleRows.length === 1 ? "" : "s"} match the current filters`,
              )
            }
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
          >
            <Filter className="h-3.5 w-3.5" /> Apply Filters
          </button>
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title="All Cases" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Case ID</th>
                  <th className="px-5 py-3">Survivor</th>
                  <th className="px-5 py-3">Case Type</th>
                  <th className="px-5 py-3">Risk Level</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned Worker</th>
                  <th className="px-5 py-3">Last Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleRows.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                      {c.id}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} />
                        <div>
                          <p className="font-bold text-white">{c.name}</p>
                          <p className="text-[10px] text-slate-500">
                            ID: {c.sid}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: c.typeColor }}
                        />
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(c.risk)}>{c.risk}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{c.worker}</td>
                    <td className="px-5 py-3 text-slate-400">{c.updated}</td>
                    <td className="px-5 py-3">
                      <RowActions />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-500">
              Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of{" "}
              {nf.format(visibleRows.length)} cases
            </span>
            <Pagination />
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Urgent Cases Requiring Attention"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2">
              {MOCK_URGENT_CASES.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <Pill tone="rose">Critical</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {c.id}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {c.type} • {c.loc}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">{c.time}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Recent Case Updates"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-3">
              {MOCK_CASE_UPDATES.map((u, i) => {
                const Icon = u.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                        ICON_TONES[u.tone],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">
                        {u.title}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {u.sub}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500">{u.time}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Quick Actions">
            <QuickActionGrid items={MOCK_CASE_QUICK} />
          </Panel>
        </div>
      </section>
    </>
  );
};

/* =============================== Survivors =============================== */

const SurvivorsSection = () => (
  <>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {gateKpis(MOCK_SURVIVOR_KPIS).map((k) => (
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
        <Panel
          title="Survivors Directory"
          bodyClassName="p-0"
          action={
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "Survivors self-register through the mobile app; new cases arrive in Case Management automatically.",
                )
              }
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add Survivor
            </button>
          }
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by name, case ID, needs, or counselor..."
                className="h-9 border-white/10 bg-slate-900/60 pl-10 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                toast.info("Use the status selector to filter the directory.")
              }
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
            >
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
            <SelectChip
              label="All Statuses"
              options={["All Statuses", "Active", "Monitoring", "Closed"]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Case ID</th>
                  <th className="px-5 py-3">Primary Need</th>
                  <th className="px-5 py-3">Assigned Counselor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Next Follow-up</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_SURVIVORS.map((s) => (
                  <tr key={s.caseId} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} />
                        <div>
                          <p className="font-bold text-white">{s.name}</p>
                          <p className="text-[10px] text-slate-500">{s.meta}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                      {s.caseId}
                    </td>
                    <td className="px-5 py-3 text-slate-300">{s.need}</td>
                    <td className="px-5 py-3 text-slate-300">{s.counselor}</td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3",
                        s.urgent ? "font-bold text-rose-400" : "text-slate-400",
                      )}
                    >
                      {s.followup}
                    </td>
                    <td className="px-5 py-3">
                      <RowActions
                        subject={s.caseId}
                        detail={`${s.caseId} · ${s.name} — follow-up ${s.followup}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-500">
              Showing 1 to 8 of 2,251 survivors
            </span>
            <Pagination pages={["1", "2", "3", "4", "5", "…", "282"]} />
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel
          title="Vulnerable Survivors Needing Attention"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2.5">
            {MOCK_VULNERABLE.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[10px] font-bold",
                      v.tag.includes("Risk") || v.tag.includes("Urgent")
                        ? "text-rose-400"
                        : "text-amber-400",
                    )}
                  >
                    {v.tag}
                  </p>
                  <p className="truncate text-xs font-bold text-white">
                    {v.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{v.sub}</p>
                </div>
                <span className="text-[10px] text-slate-500">{v.time}</span>
                <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Survivor Demographics"
          action={<LinkChip label="View report" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Donut
              data={MOCK_AGE_GROUPS}
              centerValue="2,251"
              centerLabel="Total"
            />
            <div className="space-y-1.5 self-center">
              {MOCK_AGE_GROUPS.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: a.color }}
                    />
                    {a.name}
                  </span>
                  <span className="font-bold text-white">{a.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Primary Support Categories"
          action={<LinkChip label="View report" />}
        >
          <div className="grid grid-cols-2 gap-2">
            {MOCK_SUPPORT_CATEGORIES.map((c) => (
              <div
                key={c.name}
                className={cn("rounded-xl border p-3", ICON_TONES[c.color])}
              >
                <p className="text-[10px] font-bold uppercase">{c.name}</p>
                <p className="mt-1 text-lg font-black text-white">{c.value}</p>
                <p className="text-[10px] opacity-80">{c.pct}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  </>
);

/* =============================== Referrals =============================== */

const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  declined: "Declined",
};

/** Create a real partner referral (persists to partner_referrals). */
const NewReferralModal = ({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [partnerType, setPartnerType] = useState<PartnerType>("ngo");
  const [organizationName, setOrganizationName] = useState("");
  const [service, setService] = useState("");
  const [caseReference, setCaseReference] = useState("");
  const [busy, setBusy] = useState(false);
  const TYPES: PartnerType[] = [
    "ngo",
    "counselor",
    "shelter",
    "hospital",
    "legal",
  ];

  const create = async () => {
    if (!organizationName.trim() || !service.trim()) {
      toast.error("Organization and service are required");
      return;
    }
    setBusy(true);
    try {
      await createPartnerReferral({
        requestedBy: userId,
        partnerType,
        organizationName,
        serviceRequested: service,
        caseReference: caseReference || null,
      });
      void queryClient.invalidateQueries({ queryKey: PARTNER_REFERRALS_KEY });
      toast.success(`Referral sent to ${organizationName.trim()}`);
      onClose();
    } catch {
      toast.error("Couldn't create the referral — please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create referral"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">Create referral</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Refer a survivor case to a partner service — visible to every
            responder in real time.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPartnerType(type)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[11px] font-bold",
                  partnerType === type
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                    : "border-white/10 text-slate-300 hover:bg-white/5",
                )}
              >
                {type === "ngo" ? "NGO" : titleCase(type)}
              </button>
            ))}
          </div>
          <Input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="Organization name"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            value={service}
            onChange={(event) => setService(event.target.value)}
            placeholder="Service requested"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            value={caseReference}
            onChange={(event) => setCaseReference(event.target.value)}
            placeholder="Case reference (optional)"
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
            onClick={() => void create()}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send referral"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReferralsSection = () => {
  const { user } = useAuth();
  const { data: referrals = [] } = usePartnerReferrals();
  const [showNewReferral, setShowNewReferral] = useState(false);

  const PIPELINE_COLORS: Record<ReferralStatus, string> = {
    pending: "#f59e0b",
    accepted: "#3b82f6",
    in_progress: "#8b5cf6",
    completed: "#10b981",
    declined: "#64748b",
  };
  const pipeline = referrals.length
    ? (Object.keys(REFERRAL_STATUS_LABEL) as ReferralStatus[]).map(
        (status, i) => ({
          n: i + 1,
          label: REFERRAL_STATUS_LABEL[status],
          value: referrals.filter((r) => r.status === status).length,
          color: PIPELINE_COLORS[status],
        }),
      )
    : sample(MOCK_PIPELINE);

  const isUrgent = (dueAt: string | null) =>
    Boolean(dueAt && new Date(dueAt).getTime() - Date.now() < 24 * 3600_000);
  const referralRows = referrals.length
    ? referrals.map((r) => ({
        id: r.caseReference || `REF-${r.id.slice(0, 8).toUpperCase()}`,
        name: "Protected",
        caseId: r.caseReference || r.id.slice(0, 8).toUpperCase(),
        service: r.serviceRequested,
        to: r.organizationName,
        loc: r.contactName || "—",
        priority: isUrgent(r.dueAt) ? "Urgent" : "Standard",
        status: REFERRAL_STATUS_LABEL[r.status],
        date: new Date(r.createdAt).toLocaleDateString(),
        time: new Date(r.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }))
    : sample(MOCK_REFERRALS);

  const urgentReferrals = referrals.length
    ? referrals
        .filter(
          (r) =>
            ["pending", "accepted"].includes(r.status) &&
            (isUrgent(r.dueAt) || r.status === "pending"),
        )
        .slice(0, 4)
        .map((r) => ({
          id: r.organizationName,
          tag: isUrgent(r.dueAt) ? "Urgent" : "Pending",
          sub: r.serviceRequested,
          time: fmtRelative(r.createdAt),
        }))
    : sample(MOCK_URGENT_REFERRALS);

  const referralKpis = referrals.length
    ? [
        {
          label: "Active Referrals",
          value: nf.format(
            referrals.filter((r) =>
              ["pending", "accepted", "in_progress"].includes(r.status),
            ).length,
          ),
          icon: Send,
          tone: "violet",
        },
        {
          label: "Awaiting Response",
          value: nf.format(
            referrals.filter((r) => r.status === "pending").length,
          ),
          icon: Clock,
          tone: "amber",
        },
        {
          label: "Completed",
          value: nf.format(
            referrals.filter((r) => r.status === "completed").length,
          ),
          icon: CheckCircle2,
          tone: "emerald",
        },
        {
          label: "Partner Organizations",
          value: nf.format(
            new Set(referrals.map((r) => r.organizationName)).size,
          ),
          icon: Handshake,
          tone: "sky",
        },
      ]
    : gateKpis(MOCK_REFERRAL_KPIS);

  return (
    <>
      {showNewReferral && user && (
        <NewReferralModal
          userId={user.id}
          onClose={() => setShowNewReferral(false)}
        />
      )}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {referralKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel
            title="Referral Pipeline"
            action={
              <button
                type="button"
                onClick={() => setShowNewReferral(true)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Create Referral
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {pipeline.map((p) => (
                <div
                  key={p.n}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center"
                >
                  <span
                    className="mx-auto mb-2 grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-white"
                    style={{ background: p.color }}
                  >
                    {p.n}
                  </span>
                  <p className="text-[10px] font-bold text-slate-400">
                    {p.label}
                  </p>
                  <p className="text-xl font-black text-white">{p.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="All Referrals"
            bodyClassName="p-0"
            action={
              <div className="flex items-center gap-2">
                <SelectChip label="Filter" />
                <SelectChip label="Export" />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="px-5 py-3">Referral ID</th>
                    <th className="px-5 py-3">Survivor</th>
                    <th className="px-5 py-3">Service Type</th>
                    <th className="px-5 py-3">Referred To</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referralRows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                        {r.id}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} />
                          <div>
                            <p className="font-bold text-white">{r.name}</p>
                            <p className="text-[10px] text-slate-500">
                              Case {r.caseId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{r.service}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{r.to}</p>
                        <p className="text-[10px] text-slate-500">{r.loc}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={statusTone(r.priority)}>{r.priority}</Pill>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        <p>{r.date}</p>
                        <p className="text-[10px] text-slate-500">{r.time}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <span className="text-[11px] text-slate-500">
                Showing {referralRows.length ? 1 : 0} to {referralRows.length}{" "}
                of {nf.format(referralRows.length)} referrals
              </span>
              <Pagination />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel
            title="Urgent Referrals"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2.5">
              {urgentReferrals.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <Pill tone={statusTone(r.tag)}>{r.tag}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {r.id}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {r.sub}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">{r.time}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Quick Actions">
            <QuickActionGrid
              cols=""
              items={[
                {
                  label: "Create Referral",
                  desc: "Refer a survivor to a service or partner",
                  icon: Plus,
                },
                {
                  label: "Track Referral",
                  desc: "Check the status of a referral",
                  icon: Search,
                },
                {
                  label: "Contact Partner",
                  desc: "Reach out to partner organizations",
                  icon: Phone,
                },
                {
                  label: "View Partner Directory",
                  desc: "Browse partner organizations",
                  icon: FolderOpen,
                },
                {
                  label: "Referral Report",
                  desc: "Download referral summary",
                  icon: Download,
                },
              ]}
            />
          </Panel>
        </div>
      </section>
    </>
  );
};

/* =============================== Follow-ups =============================== */

const FollowupsSection = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: followEscalations = [] } = useEscalationEvents({
    limit: 200,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const openEscalations = followEscalations.filter(
    (e) => !["resolved", "closed"].includes((e.status || "").toLowerCase()),
  );
  const followupRows = followEscalations.length
    ? openEscalations.map((e) => {
        const d = new Date(e.triggeredAt || Date.now());
        const status = (e.status || "").toLowerCase();
        return {
          key: e.id,
          escalationId: e.id as string | undefined,
          rawStatus: status,
          date: d.toLocaleDateString(),
          time: d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          name: "Protected",
          caseId: `SOS-${e.id.slice(0, 8).toUpperCase()}`,
          worker:
            status === "acknowledged" || status === "dispatched"
              ? "Assigned"
              : "Unassigned",
          type: titleCase(
            (e.escalationType || "escalation").replace(/_/g, " "),
          ),
          status: titleCase(status.replace(/_/g, " ") || "pending"),
          notes: e.reason || "—",
        };
      })
    : ALLOW_MOCK
      ? MOCK_FOLLOWUPS.map((f, i) => ({
          ...f,
          key: String(i),
          escalationId: undefined as string | undefined,
          rawStatus: "",
        }))
      : [];

  const acknowledge = async (row: { escalationId?: string }) => {
    if (!row.escalationId || !user?.id) return;
    try {
      await acknowledgeEscalation(row.escalationId, user.id);
      void queryClient.invalidateQueries({ queryKey: ESCALATION_EVENTS_KEY });
      toast.success("Follow-up acknowledged");
    } catch {
      toast.error("Couldn't acknowledge — please retry.");
    }
  };

  const followupKpis = followEscalations.length
    ? [
        {
          label: "Open Follow-ups",
          value: nf.format(openEscalations.length),
          icon: RefreshCw,
          tone: "violet",
        },
        {
          label: "Unacknowledged",
          value: nf.format(
            openEscalations.filter(
              (e) =>
                !["acknowledged", "dispatched"].includes(
                  (e.status || "").toLowerCase(),
                ),
            ).length,
          ),
          icon: AlertTriangle,
          tone: "rose",
        },
        {
          label: "Being Handled",
          value: nf.format(
            openEscalations.filter((e) =>
              ["acknowledged", "dispatched"].includes(
                (e.status || "").toLowerCase(),
              ),
            ).length,
          ),
          icon: CheckCircle2,
          tone: "emerald",
        },
        {
          label: "Critical",
          value: nf.format(
            openEscalations.filter(
              (e) => (e.severity || "").toLowerCase() === "critical",
            ).length,
          ),
          icon: Bell,
          tone: "amber",
        },
      ]
    : gateKpis(MOCK_FOLLOWUP_KPIS);

  return (
    <>
      <SectionTitle meta={SECTION_META.followups} />
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {followupKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            sub={"sub" in k ? k.sub : undefined}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel
            title="Upcoming Follow-ups"
            action={<LinkChip label="View Calendar" />}
          >
            <div className="grid grid-cols-7 gap-2">
              {MOCK_WEEK.map((d) => (
                <div
                  key={d.day}
                  className={cn(
                    "rounded-xl border p-3 text-center",
                    d.active
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-white/10 bg-white/[0.02]",
                  )}
                >
                  <p className="text-[10px] font-bold text-slate-400">
                    {d.day}
                  </p>
                  <p className="text-[9px] text-slate-500">{d.date}</p>
                  <p className="mt-1 text-lg font-black text-white">
                    {d.count}
                  </p>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1 w-1 rounded-full bg-violet-400"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400">
              {[
                ["Counseling", "#a855f7"],
                ["Legal", "#3b82f6"],
                ["Shelter", "#10b981"],
                ["Medical", "#f59e0b"],
                ["Other", "#64748b"],
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c }}
                  />
                  {l}
                </span>
              ))}
            </div>
          </Panel>
          <Panel
            title="Follow-up List"
            bodyClassName="p-0"
            action={
              <div className="flex items-center gap-2">
                <SelectChip label="Filters" />
                <SelectChip label="Export" />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Survivor</th>
                    <th className="px-5 py-3">Case ID</th>
                    <th className="px-5 py-3">Assigned Worker</th>
                    <th className="px-5 py-3">Follow-up Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {followupRows.map((f) => (
                    <tr key={f.key} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-400">
                        <p>{f.date}</p>
                        <p className="text-[10px] text-slate-500">{f.time}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={f.name} />
                          {f.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                        {f.caseId}
                      </td>
                      <td className="px-5 py-3 text-slate-300">{f.worker}</td>
                      <td className="px-5 py-3 text-slate-300">{f.type}</td>
                      <td className="px-5 py-3">
                        <Pill tone={statusTone(f.status)}>{f.status}</Pill>
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{f.notes}</span>
                          {f.escalationId &&
                            !["acknowledged", "dispatched"].includes(
                              f.rawStatus,
                            ) && (
                              <button
                                type="button"
                                onClick={() => void acknowledge(f)}
                                className="shrink-0 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-200 hover:bg-violet-500/20"
                              >
                                Acknowledge
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <span className="text-[11px] text-slate-500">
                Showing {followupRows.length ? 1 : 0} to {followupRows.length}{" "}
                of {nf.format(followupRows.length)} follow-ups
              </span>
              <Pagination />
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel
            title="Overdue Follow-ups"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2.5">
              {MOCK_OVERDUE.map((o, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <Avatar name={o.name} tone="rose" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {o.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {o.sub}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-rose-400">
                      {o.time}
                    </p>
                    <Pill tone="rose">Overdue</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Quick Actions">
            <QuickActionGrid items={MOCK_FOLLOWUP_QUICK} />
          </Panel>
        </div>
      </section>
    </>
  );
};

/* =============================== Counseling =============================== */

const CounselingSection = () => (
  <>
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {gateKpis(MOCK_COUNSELING_KPIS).map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={k.value}
          icon={k.icon}
          tone={k.tone}
          delta={k.delta}
          sub={"sub" in k ? k.sub : undefined}
        />
      ))}
    </section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
      <Panel
        title="Session Overview"
        bodyClassName="p-0"
        action={<SelectChip label="All Counselors" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">Session ID</th>
                <th className="px-5 py-3">Survivor</th>
                <th className="px-5 py-3">Counselor</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_SESSIONS.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-[11px] text-violet-300">
                    {s.id}
                  </td>
                  <td className="px-5 py-3 text-white">
                    {s.name} <span className="text-slate-500">• {s.age}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.counselor} />
                      <div>
                        <p className="text-xs font-medium text-white">
                          {s.counselor}
                        </p>
                        <p className="text-[10px] text-slate-500">Counselor</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    <p>{s.date}</p>
                    <p className="text-[10px] text-slate-500">{s.time}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      {s.mode === "Video" ? (
                        <Video className="h-3.5 w-3.5 text-violet-300" />
                      ) : (
                        <Phone className="h-3.5 w-3.5 text-sky-300" />
                      )}
                      {s.mode}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            Showing 1 to 7 of 48 sessions
          </span>
          <Pagination pages={["1", "2", "3", "…", "7"]} />
        </div>
      </Panel>
      <Panel
        title="Urgent Counseling Requests"
        action={<LinkChip label="View all" />}
      >
        <div className="space-y-2.5">
          {MOCK_URGENT_COUNSELING.map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <Pill tone="rose">High</Pill>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {u.name} <span className="text-slate-500">• {u.age}</span>
                </p>
                <p className="truncate text-[10px] text-slate-500">{u.need}</p>
              </div>
              <span className="text-[10px] text-slate-500">{u.time}</span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel
        title="Weekly Appointments"
        className="xl:col-span-2"
        action={<SelectChip label="This Week" />}
      >
        <div className="mb-3 flex flex-wrap gap-4">
          {[
            ["Completed", "#a855f7"],
            ["Scheduled", "#3b82f6"],
            ["In Progress", "#10b981"],
            ["Cancelled", "#f43f5e"],
          ].map(([l, c]) => (
            <span
              key={l}
              className="flex items-center gap-1.5 text-[11px] text-slate-400"
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
          <LineChart data={MOCK_WEEKLY_APPTS}>
            <CartesianGrid
              stroke="#1e293b"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="day"
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
              dataKey="completed"
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            <Line
              type="monotone"
              dataKey="scheduled"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            <Line
              type="monotone"
              dataKey="progress"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            <Line
              type="monotone"
              dataKey="cancelled"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Counseling by Mode" subtitle="This Week">
        <Donut data={MOCK_COUNSEL_MODE} centerValue="68" centerLabel="Total" />
        <div className="mt-2 space-y-1.5">
          {MOCK_COUNSEL_MODE.map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: m.color }}
                />
                {m.name}
              </span>
              <span className="font-bold text-white">
                {m.value}{" "}
                <span className="font-medium text-slate-500">({m.pct})</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  </>
);

/* =============================== Shelter =============================== */

const ShelterSection = () => {
  const { data: shelters = [] } = useShelters({ limit: 500, staleTime: 30000 });

  const shelterKpis = MOCK_SHELTER_KPIS.map((k) => {
    if (k.label === "Partner Shelters" && shelters.length)
      return { ...k, value: nf.format(shelters.length), delta: undefined };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, delta: undefined };
  });

  const shelterRows = shelters.length
    ? shelters.map((s) => ({
        // Live shelter names repeat across regions ("… - Unit 1"); key by id.
        key: s.id,
        name: s.name,
        loc: s.region || "—",
        cap: "—",
        beds: "—",
        contact: s.phone || "—",
        status: s.available247 ? "Available" : "Limited",
      }))
    : ALLOW_MOCK
      ? MOCK_SHELTERS.map((s) => ({
          ...s,
          key: s.name,
          cap: String(s.cap),
          beds: String(s.beds),
        }))
      : [];

  const shelterMap: MapRegion[] = shelters.length
    ? shelters
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          id: s.id,
          name: s.name,
          country: s.region || "Shelter",
          riskLevel: "low" as const,
          incidents: 1,
          lat: s.lat as number,
          lng: s.lng as number,
        }))
    : ALLOW_MOCK
      ? MOCK_SHELTER_MAP
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {shelterKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel
            title="Partner Shelter Capacity"
            bodyClassName="p-0"
            action={<SelectChip label="Export" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="px-5 py-3">Shelter Name</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Capacity</th>
                    <th className="px-5 py-3">Available Beds</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {shelterRows.map((s) => (
                    <tr key={s.key} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                            <Home className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-white">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{s.loc}</td>
                      <td className="px-5 py-3 text-slate-300">{s.cap}</td>
                      <td
                        className={cn(
                          "px-5 py-3 font-bold",
                          Number(s.beds) <= 3
                            ? "text-rose-400"
                            : Number(s.beds) <= 9
                              ? "text-amber-400"
                              : "text-emerald-400",
                        )}
                      >
                        {s.beds}
                      </td>
                      <td className="px-5 py-3 text-slate-400">{s.contact}</td>
                      <td className="px-5 py-3">
                        <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            aria-label={`View ${s.name}`}
                            onClick={() =>
                              toast.info(
                                `${s.name} · ${s.loc} — ${s.beds} beds available of ${s.cap} · ${s.contact}`,
                              )
                            }
                            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-violet-300 hover:bg-white/5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Update ${s.name}`}
                            onClick={() =>
                              toast.info(
                                "Bed availability is updated by the shelter partner; use Secure Messages to request changes.",
                              )
                            }
                            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
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
                Showing {shelterRows.length ? 1 : 0} to {shelterRows.length} of{" "}
                {nf.format(shelterRows.length)} shelters
              </span>
              <Pagination />
            </div>
          </Panel>
          <Panel title="Shelter Locations">
            <WorldRiskMap
              regions={shelterMap}
              height={300}
              center={[-29, 25]}
              zoom={5}
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel
            title="Urgent Shelter Requests"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2.5">
              {MOCK_URGENT_SHELTER.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <Pill tone={statusTone(r.tag)}>{r.tag}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {r.id}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {r.type} • {r.loc}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">{r.time}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                <span className="text-slate-400">Total pending requests</span>
                <span className="font-black text-white">34</span>
              </div>
            </div>
          </Panel>
          <Panel title="Quick Actions">
            <QuickActionGrid
              cols=""
              items={[
                {
                  label: "Create Placement",
                  desc: "Place survivor in shelter",
                  icon: Plus,
                },
                {
                  label: "Contact Shelter",
                  desc: "Call or message shelter",
                  icon: Phone,
                },
                {
                  label: "Update Capacity",
                  desc: "Update shelter bed availability",
                  icon: BarChart3,
                },
                {
                  label: "View Placements",
                  desc: "View all active placements",
                  icon: FileText,
                },
              ]}
            />
          </Panel>
        </div>
      </section>
    </>
  );
};

/* =============================== Legal Aid =============================== */

const LegalAidSection = () => (
  <>
    <SectionTitle meta={SECTION_META.legalaid} />
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {gateKpis(MOCK_LEGAL_KPIS).map((k) => (
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
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <Panel
        title="Legal Aid Cases"
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <SelectChip label="All Statuses" />
            <SelectChip label="Filters" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">Case ID</th>
                <th className="px-5 py-3">Survivor</th>
                <th className="px-5 py-3">Legal Need</th>
                <th className="px-5 py-3">Partner / Advocate</th>
                <th className="px-5 py-3">Next Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_LEGAL_CASES.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                    {c.id}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} />
                      <div>
                        <p className="font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.meta}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{c.need}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{c.firm}</p>
                    <p className="text-[10px] text-slate-500">{c.adv}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    <p>{c.date}</p>
                    <p className="text-[10px] text-slate-500">{c.time}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(c.priority)}>{c.priority}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            Showing 1 to 8 of 142 results
          </span>
          <Pagination pages={["1", "2", "3", "…", "18"]} />
        </div>
      </Panel>
      <div className="flex flex-col gap-6">
        <Panel
          title="Upcoming Court & Legal Deadlines"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2.5">
            {MOCK_COURT_DATES.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-center">
                  <span className="text-[9px] font-bold text-violet-300">
                    {d.d}
                  </span>
                  <span className="text-sm font-black text-white">{d.n}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {d.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{d.sub}</p>
                  <p className="truncate text-[10px] text-slate-500">
                    {d.court}
                  </p>
                </div>
                <Pill tone={d.chip === "TODAY" ? "rose" : "amber"}>
                  {d.chip}
                </Pill>
              </div>
            ))}
            <LinkChip label="Sync calendar" />
          </div>
        </Panel>
        <Panel title="Quick Actions">
          <QuickActionGrid
            items={[
              {
                label: "Create Legal Referral",
                desc: "Register new referral",
                icon: Plus,
              },
              {
                label: "Contact Partner",
                desc: "Reach out to advocate",
                icon: Phone,
              },
              {
                label: "Upload Document",
                desc: "Add case document",
                icon: Upload,
              },
              {
                label: "Request Legal Aid",
                desc: "External legal support",
                icon: Scale,
              },
              {
                label: "Schedule Meeting",
                desc: "Book with survivor",
                icon: Calendar,
              },
              {
                label: "Generate Report",
                desc: "Legal aid summary",
                icon: FileText,
              },
            ]}
          />
        </Panel>
      </div>
    </section>
  </>
);

/* =============================== Medical =============================== */

const MedicalSection = () => (
  <>
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {gateKpis(MOCK_MEDICAL_KPIS).map((k) => (
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
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <Panel
        title="Medical Support Requests"
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <SelectChip label="All Status" />
            <SelectChip label="May 9 – May 15, 2025" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">Survivor</th>
                <th className="px-5 py-3">Service Needed</th>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Appointment Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_MEDICAL.map((m, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} />
                      <div>
                        <p className="font-bold text-white">{m.name}</p>
                        <p className="text-[10px] text-slate-500">
                          Case {m.caseId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{m.service}</p>
                    <p className="text-[10px] text-slate-500">{m.serviceSub}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{m.facility}</p>
                    <p className="text-[10px] text-slate-500">{m.loc}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    <p>{m.date}</p>
                    <p className="text-[10px] text-slate-500">{m.time}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(m.status)}>{m.status}</Pill>
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(m.priority)}>{m.priority}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            Showing 1 to 8 of 285 entries
          </span>
          <Pagination pages={["1", "2", "3", "…", "36"]} />
        </div>
      </Panel>
      <div className="flex flex-col gap-6">
        <Panel
          title="Urgent Medical Cases"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2.5">
            {MOCK_URGENT_MEDICAL.map((m, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {m.id}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {m.name} • {m.need}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    Referred to: {m.ref}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">{m.time}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Facility Utilization"
          subtitle="Next 7 Days"
          action={<LinkChip label="View report" />}
        >
          <div className="space-y-3">
            {MOCK_FACILITY_UTIL.map((f) => (
              <div key={f.name}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">{f.name}</span>
                  <span className="font-bold text-white">{f.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{ width: `${f.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
    <Panel title="Quick Actions">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Create Medical Referral",
            desc: "Refer a survivor to a partner facility",
            icon: Plus,
          },
          {
            label: "Book Appointment",
            desc: "Schedule an appointment for a survivor",
            icon: Calendar,
          },
          {
            label: "Contact Facility",
            desc: "Get in touch with partner facilities",
            icon: Phone,
          },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() =>
                toast.info(
                  `${a.label}: coordinate with the facility via Secure Messages — contact details are in the directory above.`,
                )
              }
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-left hover:border-white/20"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-white">{a.label}</p>
                <p className="text-xs text-slate-500">{a.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  </>
);

/* =============================== Analytics =============================== */

const AnalyticsSection = () => (
  <>
    <SectionTitle meta={SECTION_META.analytics} />
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {gateKpis(MOCK_ANALYTICS_KPIS).map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={k.value}
          icon={k.icon}
          tone={k.tone}
          delta={k.delta}
          sub={k.sub}
        />
      ))}
    </section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel
        title="Case Trends Over Time"
        className="xl:col-span-2"
        action={<SelectChip label="Daily" />}
      >
        <div className="mb-3 flex flex-wrap gap-4">
          {[
            ["New Cases", "#a855f7"],
            ["In Progress", "#3b82f6"],
            ["Resolved", "#10b981"],
            ["Closed", "#64748b"],
          ].map(([l, c]) => (
            <span
              key={l}
              className="flex items-center gap-1.5 text-[11px] text-slate-400"
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
          <LineChart data={MOCK_CASE_TRENDS}>
            <CartesianGrid
              stroke="#1e293b"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="day"
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
              dataKey="newCases"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="inProgress"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="closed"
              stroke="#64748b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Cases by Type">
        <Donut
          data={MOCK_CASES_BY_TYPE}
          centerValue="1,287"
          centerLabel="Total"
        />
        <div className="mt-2 space-y-1.5">
          {MOCK_CASES_BY_TYPE.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                {c.name}
              </span>
              <span className="font-bold text-white">{c.pct}</span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel
        title="Service Utilization"
        className="xl:col-span-2"
        action={<SelectChip label="Weekly" />}
      >
        <div className="mb-3 flex flex-wrap gap-4">
          {[
            ["Counseling", "#a855f7"],
            ["Shelter", "#3b82f6"],
            ["Legal", "#10b981"],
            ["Medical", "#f59e0b"],
            ["Emergency", "#64748b"],
          ].map(([l, c]) => (
            <span
              key={l}
              className="flex items-center gap-1.5 text-[11px] text-slate-400"
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
          <BarChart data={MOCK_SERVICE_UTIL}>
            <CartesianGrid
              stroke="#1e293b"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="week"
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
            <Legend wrapperStyle={{ display: "none" }} />
            <Bar dataKey="counseling" fill="#a855f7" radius={[3, 3, 0, 0]} />
            <Bar dataKey="shelter" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="legal" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="medical" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="emergency" fill="#64748b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-slate-400">
          Total services delivered{" "}
          <span className="font-black text-white">3,825</span>{" "}
          <span className="font-bold text-emerald-400">↑ 11.4%</span>
        </p>
      </Panel>
      <Panel title="Insights & Highlights">
        <p className="mb-2 text-[11px] font-bold text-slate-300">
          Top Regions by Cases
        </p>
        <div className="space-y-2">
          {MOCK_TOP_REGIONS.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-slate-300">{r.name}</span>
              <span className="font-bold text-violet-300">
                {r.value}{" "}
                <span className="font-medium text-slate-500">({r.pct})</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  </>
);

/* =============================== Reports =============================== */

const ReportsSection = () => {
  const { data: reportCases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 30000,
  });

  const generateReport = () => {
    const rows = reportCases.map((c) => ({
      case_id: c.id,
      status: c.status,
      risk_level: c.riskLevel,
      created_at: c.createdAt,
    }));
    if (downloadCsv("aegis-ngo-case-report.csv", rows)) {
      toast.success(`Report exported — ${rows.length} cases`);
    } else {
      toast.info("No live case data to report yet.");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle meta={SECTION_META.reports} />
        <button
          type="button"
          onClick={generateReport}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white"
        >
          <BarChart3 className="h-4 w-4" /> Generate Report
        </button>
      </div>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {gateKpis(MOCK_REPORT_KPIS).map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={k.delta}
            sub={
              k.label === "Monthly Reports"
                ? "vs last month"
                : "vs last 30 days"
            }
          />
        ))}
      </section>
      <Panel
        title="Report Categories"
        subtitle="Choose a category to generate reports and export data."
        action={<LinkChip label="View All Categories" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_REPORT_CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.name}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                        ICON_TONES[c.tone],
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{c.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {c.count} reports generated
                  </span>
                  <div className="flex gap-1.5">
                    {[
                      ["PDF", "rose"],
                      ["CSV", "sky"],
                      ["Excel", "emerald"],
                    ].map(([f, t]) => (
                      <span
                        key={f}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold",
                          PILL_TONES[t],
                        )}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Panel
          title="Recent Reports"
          subtitle="View and manage your recently generated reports."
          bodyClassName="p-0"
          action={<LinkChip label="View All Reports" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Report Name</th>
                  <th className="px-5 py-3">Generated By</th>
                  <th className="px-5 py-3">Date Generated</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_RECENT_REPORTS.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-bold text-white">{r.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.by} />
                        <div>
                          <p className="text-xs font-medium text-white">
                            {r.by}
                          </p>
                          <p className="text-[10px] text-slate-500">{r.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{r.date}</td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`View ${r.name}`}
                          onClick={() =>
                            toast.info(`${r.name} · ${r.by} (${r.role})`)
                          }
                          className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-violet-300 hover:bg-white/5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Download ${r.name}`}
                          onClick={() => {
                            downloadCsv(
                              `${r.name.replace(/\s+/g, "-").toLowerCase()}.csv`,
                              [r as unknown as Record<string, unknown>],
                            );
                            toast.success(`${r.name} exported`);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Export ${r.name}`}
                          onClick={() => {
                            downloadCsv(
                              `${r.name.replace(/\s+/g, "-").toLowerCase()}.csv`,
                              [r as unknown as Record<string, unknown>],
                            );
                            toast.success(`${r.name} exported`);
                          }}
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
        </Panel>
        <Panel title="Quick Actions">
          <QuickActionGrid
            cols=""
            items={[
              {
                label: "Generate Report",
                desc: "Create a custom report with filters and date ranges.",
                icon: BarChart3,
              },
              {
                label: "Schedule Report",
                desc: "Automate report generation and delivery via email.",
                icon: Calendar,
              },
              {
                label: "Export Data",
                desc: "Export raw data for advanced analysis and backup.",
                icon: Download,
              },
            ]}
          />
        </Panel>
      </section>
    </>
  );
};

export default NgoPortal;
