/**
 * AEGIS-AI Counselor Portal — faithful build of the approved mock-up.
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
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Globe,
  Handshake,
  Headphones,
  Heart,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import SecureMessagesWorkspace from "@/components/messaging/SecureMessagesWorkspace";
import {
  useAuditLogs,
  useCaseReports,
  useEscalationEvents,
  useUserProfile,
} from "@/data/aegisData";
import { useCaseCategories } from "@/data/analyticsData";
import { useLiveResources } from "@/data/liveDashboardData";
import {
  scheduleSession,
  updateSessionStatus,
  useCounselingSessions,
  COUNSELING_SESSIONS_KEY,
  type SessionMode,
  type SessionType,
} from "@/data/counselingSessions";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_DEFINITIONS, type UserRole } from "@/lib/roleConfig";
import { ALLOW_MOCK, NO_DATA, gateKpis } from "@/lib/mockData";

const nf = new Intl.NumberFormat("en-US");
const fmtDateTime = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString();
};
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

type SectionKey =
  | "overview"
  | "cases"
  | "survivors"
  | "sessions"
  | "followups"
  | "messages"
  | "resources"
  | "reports"
  | "settings";

/* ============================ MOCK / SAMPLE DATA ============================ */

const MOCK_USER = { name: "Dr. Sarah M.", role: "Counselor" };

const MOCK_OVERVIEW_KPIS = [
  {
    label: "Active Survivors",
    value: "68",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.5%" },
    sub: "vs last 7 days",
  },
  {
    label: "Today's Sessions",
    value: "12",
    icon: Calendar,
    tone: "sky",
    delta: { dir: "up", text: "9.1%" },
    sub: "vs yesterday",
  },
  {
    label: "High-Risk Follow-Ups",
    value: "7",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "12.5%" },
    sub: "vs last 7 days",
  },
  {
    label: "Pending Referrals",
    value: "14",
    icon: Handshake,
    tone: "emerald",
    delta: { dir: "up", text: "7.7%" },
    sub: "vs last 7 days",
  },
  {
    label: "Unread Messages",
    value: "8",
    icon: MoreHorizontal,
    tone: "violet",
    note: "New messages",
  },
  {
    label: "Wellness Check-Ins",
    value: "24",
    icon: Heart,
    tone: "cyan",
    delta: { dir: "up", text: "20%" },
    sub: "vs last 7 days",
  },
] as const;

const MOCK_CARE_ACTIVITY = [
  { day: "May 9", sessions: 24, followups: 14, notes: 5 },
  { day: "May 10", sessions: 41, followups: 18, notes: 12 },
  { day: "May 11", sessions: 45, followups: 25, notes: 14 },
  { day: "May 12", sessions: 36, followups: 19, notes: 11 },
  { day: "May 13", sessions: 38, followups: 27, notes: 16 },
  { day: "May 14", sessions: 41, followups: 23, notes: 13 },
  { day: "May 15", sessions: 39, followups: 28, notes: 17 },
];

const MOCK_SCHEDULE = [
  {
    time: "10:00 AM",
    name: "Aisha K.",
    type: "Counseling Session",
    kind: "Individual",
  },
  {
    time: "11:30 AM",
    name: "Zanele P.",
    type: "Counseling Session",
    kind: "Individual",
  },
  {
    time: "02:00 PM",
    name: "Thandi N.",
    type: "Counseling Session",
    kind: "Individual",
  },
  {
    time: "03:30 PM",
    name: "Lerato K.",
    type: "Counseling Session",
    kind: "Family",
  },
];

const MOCK_HIGH_RISK = [
  {
    tag: "Critical",
    name: "Aisha K.",
    type: "Domestic Violence",
    score: "9.2",
    note: "Overdue follow-up",
    time: "1d ago",
  },
  {
    tag: "High",
    name: "Zanele P.",
    type: "Emotional Abuse",
    score: "8.1",
    note: "Follow-up due",
    time: "Today",
  },
  {
    tag: "High",
    name: "Nomsa D.",
    type: "Sexual Assault",
    score: "7.8",
    note: "Missed appointment",
    time: "2d ago",
  },
  {
    tag: "Medium",
    name: "Lerato K.",
    type: "Child Protection",
    score: "6.2",
    note: "Follow-up due",
    time: "Tomorrow",
  },
  {
    tag: "Medium",
    name: "Thabo R.",
    type: "Domestic Violence",
    score: "5.9",
    note: "Check-in due",
    time: "Tomorrow",
  },
];

const MOCK_SUPPORT_TYPES = [
  { name: "Domestic Violence", value: 26, pct: "38%", color: "#a855f7" },
  { name: "Sexual Assault", value: 16, pct: "24%", color: "#3b82f6" },
  { name: "Child Protection", value: 11, pct: "16%", color: "#f59e0b" },
  { name: "Emotional Abuse", value: 9, pct: "13%", color: "#f43f5e" },
  { name: "Human Trafficking", value: 6, pct: "9%", color: "#10b981" },
];

const MOCK_CARE_INSIGHTS = [
  {
    title: "Distress Signals",
    value: "6",
    desc: "Survivors showing increased distress",
    action: "Review now",
    icon: AlertTriangle,
    tone: "rose",
  },
  {
    title: "Missed Appointments",
    value: "3",
    desc: "In the last 7 days",
    action: "Follow up",
    icon: Calendar,
    tone: "amber",
  },
  {
    title: "Follow-Up Due",
    value: "11",
    desc: "Within the next 48 hours",
    action: "View list",
    icon: Clock,
    tone: "sky",
  },
  {
    title: "AI Wellness Insight",
    value: "",
    desc: "Overall survivor well-being is improving",
    action: "Positive Trend",
    icon: Brain,
    tone: "emerald",
  },
];

const MOCK_ACTIVITY_FEED = [
  {
    icon: Calendar,
    tone: "violet",
    title: "Session completed with Aisha K.",
    sub: "Counseling session",
    time: "10:15 AM",
  },
  {
    icon: FileText,
    tone: "sky",
    title: "Session note added for Zanele P.",
    sub: "Progress note",
    time: "09:45 AM",
  },
  {
    icon: AlertTriangle,
    tone: "amber",
    title: "High-risk alert triggered for Nomsa D.",
    sub: "Risk score updated",
    time: "Yesterday",
  },
  {
    icon: MoreHorizontal,
    tone: "violet",
    title: "New message from Lerato K.",
    sub: "Needs your response",
    time: "Yesterday",
  },
  {
    icon: Handshake,
    tone: "emerald",
    title: "Referral accepted for Thandi N.",
    sub: "Referred to Safe Haven Shelter",
    time: "2d ago",
  },
];

const MOCK_CASE_KPIS = [
  {
    label: "Open Cases",
    value: "68",
    icon: FolderOpen,
    tone: "violet",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "High-Risk Cases",
    value: "12",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "up", text: "2.1%" },
  },
  {
    label: "Follow-Ups Due",
    value: "11",
    icon: Calendar,
    tone: "sky",
    delta: { dir: "up", text: "8.3%" },
  },
  {
    label: "Pending Referrals",
    value: "14",
    icon: Handshake,
    tone: "emerald",
    delta: { dir: "up", text: "7.2%" },
  },
] as const;

const MOCK_CASES = [
  {
    id: "AEG-2026-1187",
    name: "Aisha K.",
    type: "Domestic Violence",
    risk: "Critical",
    last: "May 16, 10:00 AM",
    next: "May 22, 11:00 AM",
    ngo: "Safe Haven Shelter",
  },
  {
    id: "AEG-2026-1185",
    name: "Zanele P.",
    type: "Emotional Abuse",
    risk: "High",
    last: "May 16, 11:30 AM",
    next: "May 21, 02:00 PM",
    ngo: "Hope for All",
  },
  {
    id: "AEG-2026-1183",
    name: "Lerato K.",
    type: "Child Protection",
    risk: "High",
    last: "May 16, 02:00 PM",
    next: "May 23, 09:00 AM",
    ngo: "ChildSafe SA",
  },
  {
    id: "AEG-2026-1179",
    name: "Nomsa D.",
    type: "Sexual Assault",
    risk: "High",
    last: "May 17, 08:00 AM",
    next: "May 24, 10:00 AM",
    ngo: "Women Rise",
  },
  {
    id: "AEG-2026-1176",
    name: "Thabo R.",
    type: "Domestic Violence",
    risk: "Medium",
    last: "May 17, 03:30 PM",
    next: "May 25, 01:00 PM",
    ngo: "Mens Support Hub",
  },
  {
    id: "AEG-2026-1174",
    name: "Sipho M.",
    type: "Emotional Abuse",
    risk: "Medium",
    last: "May 15, 09:00 AM",
    next: "May 22, 03:00 PM",
    ngo: "Hope for All",
  },
  {
    id: "AEG-2026-1171",
    name: "Fatima N.",
    type: "Child Protection",
    risk: "Medium",
    last: "May 15, 01:00 PM",
    next: "May 23, 11:00 AM",
    ngo: "ChildSafe SA",
  },
  {
    id: "AEG-2026-1169",
    name: "Palesa M.",
    type: "Domestic Violence",
    risk: "High",
    last: "May 14, 04:30 PM",
    next: "May 20, 09:30 AM",
    ngo: "Safe Haven Shelter",
  },
  {
    id: "AEG-2026-1167",
    name: "Mpho T.",
    type: "Emotional Abuse",
    risk: "Medium",
    last: "May 14, 11:00 AM",
    next: "May 21, 10:00 AM",
    ngo: "Hope for All",
  },
  {
    id: "AEG-2026-1163",
    name: "Nandi S.",
    type: "Sexual Assault",
    risk: "Critical",
    last: "May 13, 02:00 PM",
    next: "May 19, 02:00 PM",
    ngo: "Women Rise",
  },
];

const MOCK_TIMELINE = [
  {
    icon: Calendar,
    title: "Session completed with Aisha K.",
    sub: "Counseling session",
    date: "May 16, 2026 10:00 AM",
    tag: "Completed",
    tone: "emerald",
  },
  {
    icon: FileText,
    title: "Note added for Zanele P.",
    sub: "Risk assessment updated",
    date: "May 16, 2026 11:30 AM",
    tag: "Note Added",
    tone: "sky",
  },
  {
    icon: Bell,
    title: "Follow-up due for Lerato K.",
    sub: "Session scheduled",
    date: "May 17, 2026 02:00 PM",
    tag: "Upcoming",
    tone: "amber",
  },
  {
    icon: Handshake,
    title: "Referral accepted for Thandi N.",
    sub: "Safe Haven Shelter",
    date: "May 17, 2026 03:30 PM",
    tag: "Accepted",
    tone: "emerald",
  },
  {
    icon: ShieldCheck,
    title: "Safety plan updated for Nomsa D.",
    sub: "Plan review completed",
    date: "May 18, 2026 09:00 AM",
    tag: "Completed",
    tone: "emerald",
  },
];

const MOCK_URGENT = [
  {
    name: "Aisha K.",
    type: "Domestic Violence",
    tag: "Critical",
    time: "1d ago",
  },
  { name: "Nandi S.", type: "Sexual Assault", tag: "Critical", time: "2d ago" },
  { name: "Zanele P.", type: "Emotional Abuse", tag: "High", time: "Today" },
  { name: "Lerato K.", type: "Child Protection", tag: "High", time: "2d ago" },
  { name: "Palesa M.", type: "Domestic Violence", tag: "High", time: "1d ago" },
];

const MOCK_SURVIVOR_KPIS = [
  {
    label: "Active Survivors",
    value: "68",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "High-Risk Survivors",
    value: "12",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "New Intakes",
    value: "9",
    icon: Plus,
    tone: "sky",
    delta: { dir: "up", text: "8.3%" },
  },
  {
    label: "Safety Plans Active",
    value: "24",
    icon: ShieldCheck,
    tone: "emerald",
    delta: { dir: "up", text: "20%" },
  },
] as const;

const MOCK_SURVIVORS = [
  {
    name: "Aisha K.",
    id: "AEG-2026-1187",
    type: "Domestic Violence",
    risk: "Critical",
    counselor: "Dr. Sarah M.",
    ngo: "Safe Haven Shelter",
    contact: "Today 10:15 AM",
    next: "May 16, 10:00 AM",
  },
  {
    name: "Zanele P.",
    id: "AEG-2026-1185",
    type: "Emotional Abuse",
    risk: "High",
    counselor: "Dr. Sarah M.",
    ngo: "Women First Initiative",
    contact: "Today 09:45 AM",
    next: "May 16, 11:30 AM",
  },
  {
    name: "Lerato K.",
    id: "AEG-2026-1183",
    type: "Child Protection",
    risk: "High",
    counselor: "N. Dlamini",
    ngo: "ChildSafe Network",
    contact: "Yesterday 04:30 PM",
    next: "May 16, 02:00 PM",
  },
  {
    name: "Nonisa D.",
    id: "AEG-2026-1179",
    type: "Sexual Assault",
    risk: "High",
    counselor: "Dr. Sarah M.",
    ngo: "Healing Hands NGO",
    contact: "Yesterday 03:15 PM",
    next: "May 17, 09:00 AM",
  },
  {
    name: "Thabo R.",
    id: "AEG-2026-1178",
    type: "Domestic Violence",
    risk: "Medium",
    counselor: "N. Dlamini",
    ngo: "Safe Haven Shelter",
    contact: "2 days ago 11:20 AM",
    next: "May 17, 03:30 PM",
  },
  {
    name: "Jabulani M.",
    id: "AEG-2026-1175",
    type: "Emotional Abuse",
    risk: "Medium",
    counselor: "T. Jacobs",
    ngo: "Men's Support Network",
    contact: "2 days ago 10:50 AM",
    next: "May 18, 10:00 AM",
  },
  {
    name: "Sipho P.",
    id: "AEG-2026-1173",
    type: "Intimate Partner Violence",
    risk: "Low",
    counselor: "T. Jacobs",
    ngo: "Ubuntu Support Centre",
    contact: "3 days ago 09:10 AM",
    next: "May 18, 02:00 PM",
  },
  {
    name: "Nqobile G.",
    id: "AEG-2026-1171",
    type: "Child Protection",
    risk: "Low",
    counselor: "N. Dlamini",
    ngo: "ChildSafe Network",
    contact: "3 days ago 04:45 PM",
    next: "May 19, 11:00 AM",
  },
];

const MOCK_WELLNESS_TRENDS = [
  { name: "Improving", value: 34, pct: "50%", color: "#10b981" },
  { name: "Stable", value: 18, pct: "26%", color: "#3b82f6" },
  { name: "Declining", value: 10, pct: "15%", color: "#f43f5e" },
  { name: "No Data", value: 6, pct: "9%", color: "#64748b" },
];

const MOCK_SURVIVOR_ACTIVITY = [
  {
    icon: ShieldCheck,
    tone: "emerald",
    title: "Aisha K. completed a safety plan",
    time: "Today, 10:15 AM",
  },
  {
    icon: Calendar,
    tone: "violet",
    title: "Zanele P. attended a session",
    time: "Today, 09:45 AM",
  },
  {
    icon: MoreHorizontal,
    tone: "sky",
    title: "Lerato K. sent a message",
    time: "Yesterday, 04:30 PM",
  },
  {
    icon: AlertTriangle,
    tone: "amber",
    title: "Nonisa D. updated risk score",
    time: "Yesterday, 03:15 PM",
  },
  {
    icon: CheckCircle2,
    tone: "emerald",
    title: "Thabo R. checked in",
    time: "2 days ago, 11:20 AM",
  },
];

const MOCK_SESSION_KPIS = [
  {
    label: "Today's Sessions",
    value: "6",
    icon: Calendar,
    tone: "sky",
    delta: { dir: "up", text: "20%" },
    sub: "vs yesterday",
  },
  {
    label: "Completed Sessions",
    value: "8",
    icon: CheckCircle2,
    tone: "emerald",
    delta: { dir: "up", text: "14%" },
    sub: "vs yesterday",
  },
  {
    label: "Missed Sessions",
    value: "1",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "down", text: "33%" },
    sub: "vs yesterday",
  },
  {
    label: "Upcoming This Week",
    value: "18",
    icon: Calendar,
    tone: "violet",
    delta: { dir: "up", text: "12%" },
    sub: "vs last week",
  },
] as const;

const MOCK_SESSION_SCHEDULE = [
  {
    time: "09:00 AM",
    name: "Aisha K.",
    type: "Individual Counseling",
    mode: "Virtual",
    status: "In Progress",
  },
  {
    time: "10:30 AM",
    name: "Zanele P.",
    type: "Individual Counseling",
    mode: "In-Person",
    status: "Scheduled",
  },
  {
    time: "12:00 PM",
    name: "Lerato K.",
    type: "Family Counseling",
    mode: "Virtual",
    status: "Scheduled",
  },
  {
    time: "01:30 PM",
    name: "Nomaso D.",
    type: "Crisis Counseling",
    mode: "In-Person",
    status: "Scheduled",
  },
  {
    time: "03:00 PM",
    name: "Thabo R.",
    type: "Individual Counseling",
    mode: "Virtual",
    status: "Scheduled",
  },
  {
    time: "04:30 PM",
    name: "Sipho M.",
    type: "Individual Counseling",
    mode: "Virtual",
    status: "Scheduled",
  },
];

const MOCK_PREP_CHECKLIST = [
  { label: "Review case history", done: true },
  { label: "Check previous notes", done: true },
  { label: "Prepare session plan", done: true },
  { label: "Review risk assessment", done: false },
  { label: "Confirm attendance", done: false },
  { label: "Prepare resources", done: false },
];

const MOCK_SESSION_NOTES = [
  {
    date: "May 15, 2024",
    name: "Zanele P.",
    type: "Individual",
    title: "Emotional regulation progress",
    status: "Completed",
    followup: "None",
  },
  {
    date: "May 14, 2024",
    name: "Lerato K.",
    type: "Family",
    title: "Family communication strategies",
    status: "Pending",
    followup: "Follow-Up Due",
  },
  {
    date: "May 14, 2024",
    name: "Nomaso D.",
    type: "Crisis",
    title: "Crisis intervention session",
    status: "Completed",
    followup: "Review Risk",
  },
  {
    date: "May 13, 2024",
    name: "Thabo R.",
    type: "Individual",
    title: "Trauma coping mechanisms",
    status: "Draft",
    followup: "None",
  },
];

const MOCK_PENDING_DOCS = [
  { label: "Progress Notes", count: 3 },
  { label: "Session Summaries", count: 2 },
  { label: "Attendance Forms", count: 1 },
];

const MOCK_FOLLOWUP_KPIS = [
  {
    label: "Overdue Follow-Ups",
    value: "14",
    icon: Clock,
    tone: "rose",
    delta: { dir: "up", text: "33%" },
  },
  {
    label: "Due Today",
    value: "9",
    icon: Calendar,
    tone: "amber",
    delta: { dir: "up", text: "12%" },
    sub: "vs yesterday",
  },
  {
    label: "Check-Ins Completed",
    value: "53",
    icon: CheckCircle2,
    tone: "emerald",
    delta: { dir: "up", text: "18%" },
  },
  {
    label: "Escalations Required",
    value: "6",
    icon: AlertTriangle,
    tone: "violet",
    delta: { dir: "up", text: "20%" },
  },
] as const;

const MOCK_FOLLOWUP_QUEUE = [
  {
    name: "Aisha K.",
    id: "AEG-2026-1187",
    type: "Check-In",
    due: "May 16, 10:00 AM",
    dueNote: "Overdue",
    risk: "Critical",
    counselor: "Dr. Sarah M.",
    status: "Overdue",
  },
  {
    name: "Zanele P.",
    id: "AEG-2026-1185",
    type: "Safety Planning",
    due: "May 16, 9:30 AM",
    dueNote: "Overdue",
    risk: "High",
    counselor: "Dr. Sarah M.",
    status: "Overdue",
  },
  {
    name: "Nomsa D.",
    id: "AEG-2026-1183",
    type: "Wellness Check-In",
    due: "May 16, 3:00 PM",
    dueNote: "Today",
    risk: "High",
    counselor: "Thabo R.",
    status: "Today",
  },
  {
    name: "Lerato K.",
    id: "AEG-2026-1186",
    type: "Progress Review",
    due: "May 16, 6:00 PM",
    dueNote: "Today",
    risk: "Medium",
    counselor: "Dr. Sarah M.",
    status: "Today",
  },
  {
    name: "Thandi M.",
    id: "AEG-2026-1184",
    type: "Check-In",
    due: "May 17, 10:00 AM",
    dueNote: "Tomorrow",
    risk: "Medium",
    counselor: "Nomsa D.",
    status: "Tomorrow",
  },
  {
    name: "Karabo N.",
    id: "AEG-2026-1188",
    type: "Wellness Check-In",
    due: "May 18, 11:00 AM",
    dueNote: "Scheduled",
    risk: "Low",
    counselor: "Lerato K.",
    status: "Scheduled",
  },
];

const MOCK_UPCOMING_CHECKINS = [
  {
    date: "May 17, 2026 9:00 AM",
    name: "Thandi M.",
    id: "AEG-2026-1184",
    type: "Check-In",
    chip: "Tomorrow",
    by: "Nomsa D.",
  },
  {
    date: "May 18, 2026 10:00 AM",
    name: "Karabo N.",
    id: "AEG-2026-1188",
    type: "Wellness Check-In",
    chip: "May 18",
    by: "Lerato K.",
  },
  {
    date: "May 19, 2026 11:00 AM",
    name: "Sipho M.",
    id: "AEG-2026-1189",
    type: "Wellness Check-In",
    chip: "May 19",
    by: "Thabo R.",
  },
  {
    date: "May 20, 2026 2:00 PM",
    name: "Naledi S.",
    id: "AEG-2026-1190",
    type: "Check-In",
    chip: "May 20",
    by: "Dr. Sarah M.",
  },
];

const MOCK_FOLLOWUP_OUTCOMES = [
  {
    date: "May 15, 2026 4:30 PM",
    name: "Lerato K.",
    id: "AEG-2026-1186",
    outcome: "Check-In Completed",
    by: "Dr. Sarah M.",
    tone: "emerald",
  },
  {
    date: "May 15, 2026 1:15 PM",
    name: "Nokuthula B.",
    id: "AEG-2026-1182",
    outcome: "Safety Plan Updated",
    by: "Nomsa D.",
    tone: "emerald",
  },
  {
    date: "May 14, 2026 10:20 AM",
    name: "Minenhle D.",
    id: "AEG-2026-1179",
    outcome: "Rescheduled",
    by: "Thabo R.",
    tone: "amber",
  },
  {
    date: "May 14, 2026 9:00 AM",
    name: "Palesa T.",
    id: "AEG-2026-1178",
    outcome: "Wellness Check-In Completed",
    by: "Lerato K.",
    tone: "emerald",
  },
];

const MOCK_FU_ALERTS = [
  {
    tag: "Critical",
    name: "Aisha K.",
    type: "Domestic Violence",
    note: "Overdue Check-In",
    sub: "16h overdue",
  },
  {
    tag: "High",
    name: "Zanele P.",
    type: "Emotional Abuse",
    note: "Overdue Safety Plan",
    sub: "2h overdue",
  },
  {
    tag: "High",
    name: "Nomsa D.",
    type: "Sexual Assault",
    note: "Elevated Risk Score",
    sub: "Score: 8.2",
  },
  {
    tag: "Medium",
    name: "Lerato K.",
    type: "Child Protection",
    note: "Missed Appointment",
    sub: "1 follow-up",
  },
  {
    tag: "Medium",
    name: "Thabo R.",
    type: "Domestic Violence",
    note: "Check-In Due",
    sub: "Tomorrow",
  },
];

const MOCK_NEXT_ACTIONS = [
  {
    title: "Reach out to 3 overdue survivors",
    sub: "High-priority check-ins pending",
    icon: MoreHorizontal,
    tone: "violet",
  },
  {
    title: "Escalate 2 high-risk cases",
    sub: "Require immediate supervisor review",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    title: "Schedule wellness check-ins",
    sub: "9 survivors due this week",
    icon: Heart,
    tone: "rose",
  },
  {
    title: "Review safety plans",
    sub: "4 plans need updates",
    icon: FileText,
    tone: "sky",
  },
];

const MOCK_RES_KPIS = [
  {
    label: "Available Resources",
    value: "142",
    icon: FolderOpen,
    tone: "violet",
    note: "+ 12 new this week",
  },
  {
    label: "Shelter Partners",
    value: "38",
    icon: Home,
    tone: "sky",
    note: "+ 3 new partners",
  },
  {
    label: "Legal Services",
    value: "27",
    icon: Scale,
    tone: "emerald",
    note: "+ 2 new partners",
  },
  {
    label: "Emergency Contacts",
    value: "12",
    icon: Phone,
    tone: "rose",
    note: "Always available",
  },
] as const;

const MOCK_RESOURCES = [
  {
    org: "Safe Haven Shelter",
    desc: "Emergency shelter & support",
    cat: "Shelters",
    loc: "Northside, Cityville",
    avail: "24/7",
    contact: "0800 111 2222",
    color: "sky",
  },
  {
    org: "Women's Legal Aid Center",
    desc: "Legal aid & court support",
    cat: "Legal",
    loc: "Downtown, Cityville",
    avail: "Mon - Fri 9AM - 5PM",
    contact: "0800 222 3333",
    color: "violet",
  },
  {
    org: "Cityville Community Clinic",
    desc: "Medical care & examinations",
    cat: "Medical",
    loc: "Eastside, Cityville",
    avail: "Mon - Sun 8AM - 8PM",
    contact: "0800 333 4444",
    color: "emerald",
  },
  {
    org: "Healing Voices Center",
    desc: "Counseling & therapy services",
    cat: "Counseling",
    loc: "Westside, Cityville",
    avail: "Mon - Sat 9AM - 6PM",
    contact: "0800 444 5555",
    color: "violet",
  },
  {
    org: "ChildSafe Protection Services",
    desc: "Child protection & family support",
    cat: "Child Protection",
    loc: "Central City, Cityville",
    avail: "Mon - Fri 8AM - 6PM",
    contact: "0800 555 6666",
    color: "amber",
  },
  {
    org: "National Domestic Violence Hotline",
    desc: "Crisis support & safety planning",
    cat: "Safety Tools",
    loc: "Nationwide",
    avail: "24/7",
    contact: "0800 777 8888",
    color: "rose",
  },
];

const MOCK_TEMPLATES = [
  { name: "Safety Plan Template", desc: "Create a personalized safety plan" },
  { name: "Crisis Plan Template", desc: "Step-by-step crisis response plan" },
  {
    name: "Counseling Session Guide",
    desc: "Session structure & discussion prompts",
  },
  {
    name: "Risk Assessment Tool",
    desc: "Evaluate risk factors & safety needs",
  },
  { name: "Psychoeducation Handout", desc: "Trauma recovery information" },
  { name: "Child Safety Worksheet", desc: "Child-focused safety planning" },
];

const MOCK_REPORT_KPIS = [
  {
    label: "Sessions Completed",
    value: "214",
    icon: Calendar,
    tone: "violet",
    delta: { dir: "up", text: "18.4%" },
  },
  {
    label: "Active Survivors",
    value: "68",
    icon: Users,
    tone: "sky",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "Follow-Up Completion Rate",
    value: "76%",
    icon: CheckCircle2,
    tone: "cyan",
    delta: { dir: "up", text: "9.3%" },
  },
  {
    label: "Positive Wellness Trend",
    value: "72%",
    icon: Heart,
    tone: "emerald",
    delta: { dir: "up", text: "14.2%" },
  },
] as const;

const MOCK_REPORT_TYPES = [
  { name: "Domestic Violence", value: 72, pct: "33%", color: "#a855f7" },
  { name: "Emotional Abuse", value: 54, pct: "25%", color: "#3b82f6" },
  { name: "Sexual Assault", value: 38, pct: "18%", color: "#10b981" },
  { name: "Child Protection", value: 26, pct: "12%", color: "#f59e0b" },
  { name: "Crisis Support", value: 16, pct: "7%", color: "#f43f5e" },
  { name: "Other / Referrals", value: 8, pct: "4%", color: "#64748b" },
];

const MOCK_AGE_GROUPS = [
  { name: "Under 18", value: 18, color: "#a855f7" },
  { name: "18-24", value: 34, color: "#3b82f6" },
  { name: "25-34", value: 62, color: "#10b981" },
  { name: "35-44", value: 48, color: "#f59e0b" },
  { name: "45-54", value: 28, color: "#a855f7" },
  { name: "55+", value: 24, color: "#3b82f6" },
];

const MOCK_REPORTS = [
  {
    name: "Monthly Counseling Summary",
    type: "Summary Report",
    date: "May 16, 2025 10:15 AM",
    range: "Apr 16 – May 15, 2025",
    by: "Dr. Sarah M.",
  },
  {
    name: "Follow-Up Completion Report",
    type: "Follow-Up Report",
    date: "May 9, 2025 02:45 PM",
    range: "Apr 9 – May 8, 2025",
    by: "Dr. Sarah M.",
  },
  {
    name: "High-Risk Cases Overview",
    type: "Risk Report",
    date: "May 2, 2025 11:30 AM",
    range: "Apr 2 – May 1, 2025",
    by: "Dr. Sarah M.",
  },
  {
    name: "Weekly Activity Report",
    type: "Activity Report",
    date: "Apr 30, 2025 09:00 AM",
    range: "Apr 23 – Apr 29, 2025",
    by: "Dr. Sarah M.",
  },
  {
    name: "Quarterly Support Trends",
    type: "Trends Report",
    date: "Apr 15, 2025 03:20 PM",
    range: "Jan 1 – Mar 31, 2025",
    by: "Dr. Sarah M.",
  },
];

const MOCK_REPORT_SUMMARY = [
  { label: "Total Sessions", value: "214", icon: Calendar },
  { label: "Active Survivors", value: "68", icon: Users },
  { label: "New Survivors", value: "19", icon: Plus },
  { label: "Follow-Up Completed", value: "76%", icon: CheckCircle2 },
  { label: "Positive Wellness Trend", value: "72%", icon: Heart },
];

/* ============================ NAV / META ============================ */

const SECTION_META: Record<SectionKey, { title: string; subtitle: string }> = {
  overview: {
    title: "Overview",
    subtitle: "A snapshot of your caseload, sessions, and survivor well-being.",
  },
  cases: {
    title: "Assigned Cases",
    subtitle:
      "Manage survivor-centered counseling cases from intake to resolution.",
  },
  survivors: {
    title: "Survivors",
    subtitle:
      "Track survivor profiles, risk levels, care status, and support needs.",
  },
  sessions: {
    title: "Sessions",
    subtitle: "Manage counseling appointments, progress notes, and attendance.",
  },
  followups: {
    title: "Follow-Ups",
    subtitle:
      "Track overdue check-ins, recovery milestones, and survivor support actions.",
  },
  messages: {
    title: "Messages",
    subtitle:
      "Secure communication with survivors, NGOs, police, and partner services.",
  },
  resources: {
    title: "Resources",
    subtitle:
      "Access support directories, safety tools, and referral services.",
  },
  reports: {
    title: "Reports",
    subtitle:
      "Review counseling outcomes, workload, and survivor support trends.",
  },
  settings: {
    title: "Settings",
    subtitle:
      "Manage your profile, privacy, notifications, language, and workflow preferences.",
  },
};

const NAV: {
  key: SectionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "cases", label: "Assigned Cases", icon: FolderOpen },
  { key: "survivors", label: "Survivors", icon: Users },
  { key: "sessions", label: "Sessions", icon: FileText },
  { key: "followups", label: "Follow-Ups", icon: RefreshCw },
  { key: "messages", label: "Messages", icon: MoreHorizontal, badge: 8 },
  { key: "resources", label: "Resources", icon: BookOpen },
  { key: "reports", label: "Reports", icon: BarChart3 },
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
const statusTone = (s: string) => {
  const v = s.toLowerCase();
  if (
    ["completed", "active", "available", "accepted", "in progress"].includes(v)
  )
    return v === "in progress" ? "sky" : "emerald";
  if (
    [
      "pending",
      "scheduled",
      "today",
      "tomorrow",
      "medium",
      "draft",
      "follow-up due",
      "review risk",
      "rescheduled",
    ].includes(v)
  )
    return "amber";
  if (["critical", "high", "overdue"].includes(v)) return "rose";
  if (["low", "note added", "upcoming"].includes(v)) return "sky";
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
  note,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  delta?: { dir: string; text: string };
  sub?: string;
  note?: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-black text-white">{value}</p>
        {delta ? (
          <div className="mt-0.5">
            <Delta dir={delta.dir} text={delta.text} sub={sub} />
          </div>
        ) : note ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2",
          ICON_TONES[tone] ?? ICON_TONES.violet,
        )}
      >
        <Icon className="h-5 w-5" />
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

type CounselorPortalContextValue = {
  section: SectionKey;
  navigate: (section: SectionKey) => void;
};

const CounselorPortalContext =
  createContext<CounselorPortalContextValue | null>(null);

const useCounselorPortal = (): CounselorPortalContextValue => {
  const ctx = useContext(CounselorPortalContext);
  if (!ctx)
    throw new Error("useCounselorPortal must be used within CounselorPortal");
  return ctx;
};

/** Route a quick-action label to the section that owns that capability. */
const ACTION_TARGETS: { match: string; section: SectionKey }[] = [
  { match: "case", section: "cases" },
  { match: "survivor", section: "survivors" },
  { match: "session", section: "sessions" },
  { match: "schedule", section: "sessions" },
  { match: "calendar", section: "sessions" },
  { match: "follow", section: "followups" },
  { match: "check", section: "followups" },
  { match: "message", section: "messages" },
  { match: "note", section: "cases" },
  { match: "resource", section: "resources" },
  { match: "report", section: "reports" },
  { match: "insight", section: "reports" },
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
  const { section, navigate } = useCounselorPortal();

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
const QuickActions = ({
  items,
}: {
  items: {
    label: string;
    icon: ComponentType<{ className?: string }>;
    tone?: string;
  }[];
}) => {
  const { section, navigate } = useCounselorPortal();

  const handleAction = (label: string) => {
    const target = sectionForAction(label);
    if (target && target !== section) {
      navigate(target);
    } else {
      toast.success(label);
    }
  };

  return (
    <Panel title="Quick Actions">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => handleAction(a.label)}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-center transition-colors hover:border-white/20"
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg border",
                  ICON_TONES[a.tone ?? "violet"],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-bold text-white">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
};

/* ============================== PORTAL ============================== */

const CounselorPortal: React.FC = () => {
  const [section, setSection] = useState<SectionKey>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = SECTION_META[section];

  const portalContext = useMemo<CounselorPortalContextValue>(
    () => ({ section, navigate: setSection }),
    [section],
  );

  const { user, signOut } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const account = {
    name: profile?.fullName || MOCK_USER.name,
    role: profile?.role
      ? (ROLE_DEFINITIONS[profile.role as UserRole]?.label ??
        titleCase(profile.role))
      : MOCK_USER.role,
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
    <CounselorPortalContext.Provider value={portalContext}>
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
                  <linearGradient
                    id="aegis-counselor"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#6d28d9" />
                  </linearGradient>
                </defs>
                <path
                  d="M20 2 L36 11 L20 38 L4 11 Z"
                  fill="url(#aegis-counselor)"
                />
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
                  Counselor Portal
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-600" />
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
                  {item.badge ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500/20 px-1 text-[10px] font-black text-violet-300">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="space-y-3 px-4 pb-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-xs font-black text-white">
                <Heart className="h-3.5 w-3.5 text-rose-400" /> Your Wellness
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Self-care is essential. You've completed 3 of 7 check-ins this
                week.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{ width: "43%" }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  43%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSection("followups")}
                className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-[11px] font-bold text-violet-400 hover:bg-white/5"
              >
                Check In Now →
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-xs font-black text-white">
                <Headphones className="h-3.5 w-3.5 text-violet-300" /> Support
                Hotline
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Need support? Contact supervisor
              </p>
              <p className="text-xs font-bold text-violet-300">0800 123 456</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0f1f]/80 px-4 backdrop-blur-xl md:px-6">
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 truncate text-base font-black tracking-tight text-white md:text-lg">
                Welcome, {account.name}{" "}
                <CheckCircle2 className="h-4 w-4 text-violet-400" />
              </h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                Trauma-informed care. Coordinated support. Survivor-centered
                healing.
              </p>
            </div>
            <div className="relative ml-auto hidden max-w-md flex-1 lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search survivors, cases, sessions, notes, resources..."
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
                onClick={() => setSection("followups")}
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
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {meta.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{meta.subtitle}</p>
              </div>
              {section === "overview" && <OverviewSection />}
              {section === "cases" && <CasesSection />}
              {section === "survivors" && <SurvivorsSection />}
              {section === "sessions" && <SessionsSection />}
              {section === "followups" && <FollowupsSection />}
              {section === "messages" && <MessagesSection />}
              {section === "resources" && <ResourcesSection />}
              {section === "reports" && <ReportsSection />}
              {section === "settings" && <SettingsSection />}
            </div>
          </main>
        </div>
      </div>
    </CounselorPortalContext.Provider>
  );
};

/* =============================== Overview =============================== */

const CATEGORY_COLORS = [
  "#a855f7",
  "#3b82f6",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#06b6d4",
  "#64748b",
];

const OverviewSection = () => {
  const { navigate } = useCounselorPortal();
  const { data: audit = [] } = useAuditLogs({ limit: 5, staleTime: 30000 });
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: categories = [] } = useCaseCategories();

  const supportTypes = categories.length
    ? categories.map((c, i) => ({
        name: titleCase(c.name),
        value: c.value,
        pct: `${c.pct}%`,
        color: c.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
    : ALLOW_MOCK
      ? MOCK_SUPPORT_TYPES
      : [];
  const supportTotal = supportTypes.reduce((s, c) => s + c.value, 0);

  const overviewKpis = MOCK_OVERVIEW_KPIS.map((k) => {
    if (k.label === "High-Risk Follow-Ups" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) =>
            ["critical", "high"].includes((c.riskLevel || "").toLowerCase()),
          ).length,
        ),
      };
    if (k.label === "Active Survivors" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter(
            (c) =>
              !["closed", "resolved"].includes((c.status || "").toLowerCase()),
          ).length,
        ),
      };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  const caseRows = cases.length
    ? cases.slice(0, 5).map((c) => ({
        id: `AEG-${c.id.slice(0, 8).toUpperCase()}`,
        name: "Protected",
        type: c.description
          ? c.description.length > 28
            ? `${c.description.slice(0, 28)}…`
            : c.description
          : "GBV Case",
        risk: titleCase(c.riskLevel),
        last: fmtDateTime(c.createdAt),
      }))
    : ALLOW_MOCK
      ? MOCK_CASES
      : [];

  const activity = audit.length
    ? audit.slice(0, 5).map((a, i) => ({
        key: i,
        icon:
          a.severity === "critical"
            ? AlertTriangle
            : a.severity === "warning"
              ? Clock
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
      ? MOCK_ACTIVITY_FEED.map((a, i) => ({ key: i, ...a }))
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {overviewKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            sub={"sub" in k ? k.sub : undefined}
            note={"note" in k ? k.note : undefined}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Care Activity Overview"
          className="xl:col-span-2"
          action={<SelectChip label="Last 7 Days" />}
        >
          <div className="mb-3 flex flex-wrap gap-4">
            {[
              ["Sessions Conducted", "#a855f7"],
              ["Follow-Ups Completed", "#3b82f6"],
              ["Support Notes Added", "#10b981"],
            ].map(([l, c]) => (
              <span
                key={l}
                className="flex items-center gap-1.5 text-[11px] text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: c }}
                />
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={MOCK_CARE_ACTIVITY}>
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
                dataKey="sessions"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="followups"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="notes"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="My Session Schedule"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2">
            {MOCK_SCHEDULE.map((s) => (
              <div
                key={s.time}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
              >
                <div className="rounded-lg bg-violet-500/10 px-2 py-1 text-center">
                  <p className="text-[11px] font-black text-violet-300">
                    {s.time.split(" ")[0]}
                  </p>
                  <p className="text-[8px] text-slate-500">
                    {s.time.split(" ")[1]}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {s.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {s.type} · {s.kind}
                  </p>
                </div>
                <Pill tone="violet">Today</Pill>
              </div>
            ))}
            <button
              type="button"
              onClick={() => navigate("sessions")}
              className="w-full pt-1 text-center text-[11px] font-bold text-violet-400"
            >
              View full schedule →
            </button>
          </div>
        </Panel>
        <HighRiskPanel />
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Cases by Support Type">
          {supportTypes.length ? (
            <>
              <Donut
                data={supportTypes}
                centerValue={nf.format(supportTotal)}
                centerLabel="Total"
              />
              <div className="mt-2 space-y-1">
                {supportTypes.map((c) => (
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
                      <span className="font-medium text-slate-500">
                        ({c.pct})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="grid place-items-center py-12 text-center text-xs text-slate-500">
              No case data yet.
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate("reports")}
            className="mt-2 w-full text-center text-[11px] font-bold text-violet-400"
          >
            View full breakdown
          </button>
        </Panel>
        <Panel title="Care Insights" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MOCK_CARE_INSIGHTS.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.title}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div
                    className={cn(
                      "mb-2 grid h-8 w-8 place-items-center rounded-lg border",
                      ICON_TONES[a.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    {a.value && (
                      <span className="text-lg font-black text-white">
                        {a.value}
                      </span>
                    )}
                    <span className="text-xs font-bold text-white">
                      {a.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">{a.desc}</p>
                  <p className="mt-1.5 text-[10px] font-bold text-violet-400">
                    {a.action}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Recent Activity Feed"
          action={<LinkChip label="View all" />}
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
                    <p className="truncate text-[10px] text-slate-500">
                      {a.sub}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">{a.time}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Assigned Cases"
          className="xl:col-span-2"
          bodyClassName="p-0"
          action={<LinkChip label="View all" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Case ID</th>
                  <th className="px-5 py-3">Survivor</th>
                  <th className="px-5 py-3">Case Type</th>
                  <th className="px-5 py-3">Risk</th>
                  <th className="px-5 py-3">Next Session</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {caseRows.slice(0, 5).map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-[11px] text-violet-300">
                      {c.id}
                    </td>
                    <td className="px-5 py-3 font-bold text-white">{c.name}</td>
                    <td className="px-5 py-3 text-slate-300">{c.type}</td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(c.risk)}>{c.risk}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{c.last}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
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
      <QuickActions
        items={[
          { label: "Start Session", icon: Video },
          { label: "Add Session Note", icon: Pencil },
          { label: "Safety Plan", icon: ShieldCheck, tone: "emerald" },
          { label: "Refer to NGO", icon: Handshake, tone: "sky" },
          { label: "Escalate Case", icon: AlertTriangle, tone: "rose" },
          { label: "Generate Report", icon: FileText },
        ]}
      />
    </>
  );
};

const HighRiskPanel = () => {
  return (
    <Panel
      title="High-Risk Survivors Requiring Attention"
      action={<LinkChip label="View all" />}
    >
      <div className="space-y-2">
        {MOCK_HIGH_RISK.map((h) => (
          <div
            key={h.name}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <Pill tone={statusTone(h.tag)}>{h.tag}</Pill>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{h.name}</p>
              <p className="truncate text-[10px] text-slate-500">{h.type}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-white">Risk {h.score}</p>
              <p className="text-[10px] text-slate-500">{h.note}</p>
            </div>
            <span className="text-[10px] text-slate-500">{h.time}</span>
            <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
          </div>
        ))}
      </div>
    </Panel>
  );
};

/* =============================== Assigned Cases =============================== */

const CasesSection = () => {
  const { navigate } = useCounselorPortal();
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
    if (k.label === "High-Risk Cases" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) =>
            ["critical", "high"].includes((c.riskLevel || "").toLowerCase()),
          ).length,
        ),
        delta: undefined,
      };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, delta: undefined };
  });

  const caseRows = cases.length
    ? cases.map((c) => ({
        id: `AEG-${c.id.slice(0, 8).toUpperCase()}`,
        name: "Protected",
        type: c.description
          ? c.description.length > 28
            ? `${c.description.slice(0, 28)}…`
            : c.description
          : "GBV Case",
        risk: titleCase(c.riskLevel),
        next: "—",
        ngo: "—",
      }))
    : ALLOW_MOCK
      ? MOCK_CASES
      : [];

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
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Panel
          title="Assigned Cases"
          bodyClassName="p-0"
          action={<LinkChip label="View all cases" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Survivor</th>
                  <th className="px-4 py-3">Case Type</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Next Session</th>
                  <th className="px-4 py-3">NGO</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {caseRows.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-[11px] text-violet-300">
                      {c.id}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{c.name}</td>
                    <td className="px-4 py-3 text-slate-300">{c.type}</td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(c.risk)}>{c.risk}</Pill>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{c.next}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c.ngo}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            toast.info(
                              `${c.id} — full case record is shared with you via the case team thread.`,
                            )
                          }
                          className="rounded-md border border-violet-500/30 px-2 py-1 text-[10px] font-bold text-violet-300 hover:bg-violet-500/10"
                        >
                          View Case
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("messages")}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5"
                        >
                          Add Note
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("sessions")}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5"
                        >
                          Schedule
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
              {caseRows.length
                ? `Showing 1 to ${caseRows.length}`
                : "Showing 0"}{" "}
              of {nf.format(caseRows.length)} cases
            </span>
            <Pagination />
          </div>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel
            title="Case Timeline Preview"
            action={<LinkChip label="View full timeline" />}
          >
            <div className="space-y-3">
              {MOCK_TIMELINE.map((t, i) => {
                const Icon = t.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-full border",
                          ICON_TONES[t.tone],
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {i < MOCK_TIMELINE.length - 1 && (
                        <span className="mt-1 h-5 w-px bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-500">{t.date}</p>
                        <Pill tone={t.tone}>{t.tag}</Pill>
                      </div>
                      <p className="text-xs font-bold text-white">{t.title}</p>
                      <p className="text-[10px] text-slate-500">{t.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel
            title="Urgent Cases Requiring Attention"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2">
              {MOCK_URGENT.map((u) => (
                <div
                  key={u.name}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {u.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {u.type}
                    </p>
                  </div>
                  <Pill tone={statusTone(u.tag)}>{u.tag}</Pill>
                  <span className="text-[10px] text-slate-500">{u.time}</span>
                </div>
              ))}
              <button
                type="button"
                className="w-full pt-1 text-center text-[11px] font-bold text-violet-400"
                onClick={() => navigate("cases")}
              >
                View all high-risk cases →
              </button>
            </div>
          </Panel>
        </div>
      </section>
      <QuickActions
        items={[
          { label: "Open Case", icon: FolderOpen },
          { label: "Add Note", icon: Pencil },
          { label: "Schedule Session", icon: Calendar, tone: "sky" },
          { label: "Create Safety Plan", icon: ShieldCheck, tone: "emerald" },
          { label: "Refer to NGO", icon: Handshake },
          { label: "Generate Report", icon: FileText },
        ]}
      />
    </>
  );
};

/* =============================== Survivors =============================== */

const SurvivorsSection = () => {
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const survivorKpis = MOCK_SURVIVOR_KPIS.map((k) => {
    if (k.label === "Active Survivors" && cases.length)
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
    if (k.label === "High-Risk Survivors" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) =>
            ["critical", "high"].includes((c.riskLevel || "").toLowerCase()),
          ).length,
        ),
        delta: undefined,
      };
    if (k.label === "New Intakes" && cases.length)
      return {
        ...k,
        value: nf.format(
          cases.filter((c) => {
            const t = new Date(c.createdAt).getTime();
            return !Number.isNaN(t) && Date.now() - t <= 7 * 864e5;
          }).length,
        ),
        delta: undefined,
      };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, delta: undefined };
  });

  const survivorRows = cases.length
    ? cases.slice(0, 8).map((c) => ({
        name: "Protected",
        id: `AEG-${c.id.slice(0, 8).toUpperCase()}`,
        type: c.description
          ? c.description.length > 28
            ? `${c.description.slice(0, 28)}…`
            : c.description
          : "GBV Case",
        risk: titleCase(c.riskLevel),
        counselor: "—",
        ngo: "—",
        next: "—",
      }))
    : ALLOW_MOCK
      ? MOCK_SURVIVORS
      : [];
  const totalSurvivors = cases.length
    ? cases.filter(
        (c) => !["closed", "resolved"].includes((c.status || "").toLowerCase()),
      ).length
    : ALLOW_MOCK
      ? 68
      : 0;

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {survivorKpis.map((k) => (
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
          title="Survivor Management"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Search survivors…"
                  className="h-8 w-56 border-white/10 bg-slate-900/60 pl-8 text-xs text-white"
                />
              </div>
              <SelectChip label="Filters" />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Survivor Alias</th>
                  <th className="px-4 py-3">Case Type</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Counselor</th>
                  <th className="px-4 py-3">Assigned NGO</th>
                  <th className="px-4 py-3">Next Session</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {survivorRows.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} />
                        <div>
                          <p className="font-bold text-white">{s.name}</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {s.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{s.type}</td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(s.risk)}>{s.risk}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {s.counselor}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {s.ngo}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.next}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={() =>
                          toast.info(
                            "Full record actions are available from the case team thread in Messages.",
                          )
                        }
                        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-500">
              Showing {survivorRows.length ? 1 : 0} to {survivorRows.length} of{" "}
              {nf.format(totalSurvivors)} survivors
            </span>
            <Pagination pages={["1", "2", "3", "4", "5", "…", "9"]} />
          </div>
        </Panel>
        <QuickActions
          items={[
            { label: "Add Survivor Note", icon: Pencil },
            { label: "Create Safety Plan", icon: ShieldCheck, tone: "emerald" },
            { label: "Schedule Session", icon: Calendar, tone: "sky" },
            { label: "Refer to Shelter", icon: Home },
            { label: "Message Survivor", icon: MoreHorizontal },
            { label: "Export List", icon: Download },
          ]}
        />
      </div>
      <div className="flex flex-col gap-6">
        <Panel
          title="Survivor Snapshot"
          action={<SelectChip label="Aisha K." />}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-black text-white">
              AK
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Aisha K.</p>
              <p className="font-mono text-[10px] text-slate-500">
                AEG-2026-1187
              </p>
              <p className="text-[10px] text-slate-500">Female · 29 years</p>
            </div>
            <Pill tone="rose">Critical</Pill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="text-slate-500">Demographics</p>
              <p className="text-slate-300">Johannesburg, GP</p>
              <p className="text-slate-300">Born May 12, 1995</p>
              <p className="text-slate-300">English, Zulu</p>
            </div>
            <div>
              <p className="text-slate-500">Current Safety Level</p>
              <p className="mt-1 text-2xl font-black text-rose-400">20%</p>
              <p className="text-rose-400">Unsafe</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] text-slate-500">
              Support Services Connected
            </p>
            <div className="mt-2 space-y-1.5">
              {[
                ["Individual Counseling", true],
                ["Safety Planning", true],
                ["Legal Support", true],
                ["Financial Assistance", false],
              ].map(([l, on]) => (
                <div
                  key={l as string}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {on ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-600" />
                  )}
                  <span className={on ? "text-slate-300" : "text-slate-500"}>
                    {l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Wellness & Safety Trends"
          action={<SelectChip label="Last 7 Days" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Donut
              data={MOCK_WELLNESS_TRENDS}
              centerValue="68"
              centerLabel="Total"
            />
            <div className="space-y-1.5 self-center">
              {MOCK_WELLNESS_TRENDS.map((w) => (
                <div
                  key={w.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: w.color }}
                    />
                    {w.name}
                  </span>
                  <span className="font-bold text-white">
                    {w.value} ({w.pct})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Recent Survivor Activity"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2.5">
            {MOCK_SURVIVOR_ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                      ICON_TONES[a.tone],
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-white">
                      {a.title}
                    </p>
                    <p className="text-[10px] text-slate-500">{a.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </section>
  );
};

/* =============================== Sessions =============================== */

/** Schedule a real counseling session (persists to counseling_sessions). */
const ScheduleSessionModal = ({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [alias, setAlias] = useState("");
  const [caseReference, setCaseReference] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("individual");
  const [mode, setMode] = useState<SessionMode>("virtual");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const scheduledAt = when ? new Date(when) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      toast.error("Pick a date and time for the session");
      return;
    }
    setBusy(true);
    try {
      await scheduleSession({
        counselorId: userId,
        scheduledAt: scheduledAt.toISOString(),
        survivorAlias: alias || null,
        caseReference: caseReference || null,
        sessionType,
        mode,
      });
      void queryClient.invalidateQueries({
        queryKey: COUNSELING_SESSIONS_KEY,
      });
      toast.success("Session scheduled");
      onClose();
    } catch {
      toast.error("Couldn't schedule the session — please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule session"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-black text-white">Schedule session</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Book a counseling session — it appears on every responder calendar
            in real time.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <Input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Survivor alias (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            value={caseReference}
            onChange={(event) => setCaseReference(event.target.value)}
            placeholder="Case reference (optional)"
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <Input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className="h-9 border-white/10 bg-slate-900/60 text-sm text-white"
          />
          <div className="flex flex-wrap gap-2">
            {(
              [
                "individual",
                "group",
                "family",
                "crisis",
                "follow_up",
              ] as SessionType[]
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSessionType(t)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[11px] font-bold",
                  sessionType === t
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                    : "border-white/10 text-slate-300 hover:bg-white/5",
                )}
              >
                {titleCase(t.replace("_", " "))}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["virtual", "in_person", "phone"] as SessionMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold",
                  mode === m
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                    : "border-white/10 text-slate-300 hover:bg-white/5",
                )}
              >
                {titleCase(m.replace("_", " "))}
              </button>
            ))}
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
            onClick={() => void create()}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

const SessionsSection = () => {
  const { navigate } = useCounselorPortal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useCounselingSessions();
  const [showSchedule, setShowSchedule] = useState(false);

  const scheduleRows = sessions.length
    ? sessions.slice(0, 8).map((s) => {
        const d = new Date(s.scheduledAt);
        return {
          key: s.id,
          sessionId: s.id,
          rawStatus: s.status,
          time: d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          name: s.survivorAlias || s.caseReference || "Survivor (protected)",
          type: `${titleCase(s.sessionType.replace("_", " "))} · ${d.toLocaleDateString()}`,
          mode: s.mode === "in_person" ? "In-Person" : titleCase(s.mode),
          status: SESSION_STATUS_LABEL[s.status] ?? titleCase(s.status),
        };
      })
    : ALLOW_MOCK
      ? MOCK_SESSION_SCHEDULE.map((s) => ({
          ...s,
          key: s.time,
          sessionId: undefined as string | undefined,
          rawStatus: "" as string,
        }))
      : [];

  const todayCount = sessions.filter(
    (s) => new Date(s.scheduledAt).toDateString() === new Date().toDateString(),
  ).length;
  const sessionKpis = sessions.length
    ? [
        {
          label: "Today's Sessions",
          value: String(todayCount),
          icon: Calendar,
          tone: "sky",
        },
        {
          label: "Completed Sessions",
          value: String(
            sessions.filter((s) => s.status === "completed").length,
          ),
          icon: CheckCircle2,
          tone: "emerald",
        },
        {
          label: "Upcoming",
          value: String(
            sessions.filter(
              (s) =>
                s.status === "scheduled" &&
                new Date(s.scheduledAt).getTime() > Date.now(),
            ).length,
          ),
          icon: Clock,
          tone: "violet",
        },
        {
          label: "Cancellations",
          value: String(
            sessions.filter((s) => ["cancelled", "no_show"].includes(s.status))
              .length,
          ),
          icon: AlertTriangle,
          tone: "rose",
        },
      ]
    : gateKpis(MOCK_SESSION_KPIS);

  const advanceSession = async (row: {
    sessionId?: string;
    rawStatus: string;
  }) => {
    if (!row.sessionId) return;
    const next =
      row.rawStatus === "scheduled"
        ? "in_progress"
        : row.rawStatus === "in_progress"
          ? "completed"
          : null;
    if (!next) return;
    try {
      await updateSessionStatus(row.sessionId, next);
      void queryClient.invalidateQueries({
        queryKey: COUNSELING_SESSIONS_KEY,
      });
      toast.success(`Session ${SESSION_STATUS_LABEL[next].toLowerCase()}`);
    } catch {
      toast.error("Couldn't update the session — please retry.");
    }
  };

  return (
    <>
      {showSchedule && user && (
        <ScheduleSessionModal
          userId={user.id}
          onClose={() => setShowSchedule(false)}
        />
      )}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {sessionKpis.map((k) => (
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
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Session Schedule"
          action={
            <button
              type="button"
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> New Session
            </button>
          }
        >
          <div className="space-y-2">
            {scheduleRows.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-slate-500">
                No sessions scheduled yet — use "New Session" to book one.
              </p>
            )}
            {scheduleRows.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
              >
                <div className="w-16 text-center">
                  <p className="text-[11px] font-black text-violet-300">
                    {s.time.split(" ")[0]}
                  </p>
                  <p className="text-[8px] text-slate-500">
                    {s.time.split(" ")[1]}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {s.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {s.type}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  {s.mode === "Virtual" ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <Users className="h-3 w-3" />
                  )}
                  {s.mode}
                </span>
                <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                {s.sessionId &&
                  ["scheduled", "in_progress"].includes(s.rawStatus) && (
                    <button
                      type="button"
                      onClick={() => void advanceSession(s)}
                      className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-200 hover:bg-violet-500/20"
                    >
                      {s.rawStatus === "scheduled" ? "Start" : "Complete"}
                    </button>
                  )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "The full calendar lists every scheduled session below.",
                )
              }
              className="w-full pt-1 text-center text-[11px] font-bold text-violet-400"
            >
              View full calendar →
            </button>
          </div>
        </Panel>
        <Panel
          title="Selected Session Details"
          action={<Pill tone="violet">SES-2024-0516-001</Pill>}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">
              AK
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Aisha K.</p>
              <p className="font-mono text-[10px] text-slate-500">
                AEG-2026-1187
              </p>
            </div>
            <Pill tone="sky">In Progress</Pill>
          </div>
          <div className="mt-3 space-y-2 text-[11px]">
            {[
              ["Session Type", "Individual Counseling"],
              ["Mode", "Virtual"],
              ["Date & Time", "May 16, 2024 · 09:00–10:00 AM"],
              ["Counselor", "Dr. Sarah M."],
              ["Location / Link", "Secure Video Room"],
              ["Status", "In Progress"],
              ["Attendance", "Present"],
              ["Case", "AEG-2026-1187 · Domestic Violence"],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <span className="text-slate-500">{l}</span>
                <span className="text-right text-slate-300">{v}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate("cases")}
            className="mt-3 w-full text-center text-[11px] font-bold text-violet-400"
          >
            View case →
          </button>
        </Panel>
        <Panel
          title="Session Preparation Checklist"
          action={<LinkChip label="View full checklist" />}
        >
          <ul className="space-y-2.5">
            {MOCK_PREP_CHECKLIST.map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-2.5 text-xs text-slate-300"
              >
                {c.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-slate-600" />
                )}
                {c.label}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-white/5 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-white">
              <FileText className="h-3.5 w-3.5 text-violet-300" /> Pending
              Documentation
            </p>
            <div className="space-y-1.5">
              {MOCK_PENDING_DOCS.map((d) => (
                <div
                  key={d.label}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <span className="text-slate-300">{d.label}</span>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-500/20 text-[10px] font-black text-violet-300">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>
      <Panel
        title="Recent Session Notes"
        bodyClassName="p-0"
        action={<LinkChip label="View all notes" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Survivor</th>
                <th className="px-5 py-3">Session Type</th>
                <th className="px-5 py-3">Note Title</th>
                <th className="px-5 py-3">Note Status</th>
                <th className="px-5 py-3">Follow-Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_SESSION_NOTES.map((n, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-slate-400">{n.date}</td>
                  <td className="px-5 py-3 font-bold text-white">{n.name}</td>
                  <td className="px-5 py-3 text-slate-300">{n.type}</td>
                  <td className="px-5 py-3 text-slate-300">{n.title}</td>
                  <td className="px-5 py-3">
                    <Pill tone={statusTone(n.status)}>{n.status}</Pill>
                  </td>
                  <td className="px-5 py-3">
                    {n.followup === "None" ? (
                      <span className="text-[11px] text-slate-500">None</span>
                    ) : (
                      <Pill tone={statusTone(n.followup)}>{n.followup}</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-3">
        <span className="px-2 text-sm font-black text-white">
          Quick Actions
        </span>
        {[
          { label: "Start Session", icon: Video },
          { label: "Add Session Note", icon: Pencil },
          { label: "Reschedule", icon: Calendar },
          { label: "Mark Completed", icon: CheckCircle2 },
          { label: "Refer Case", icon: Handshake },
          { label: "Generate Session Summary", icon: FileText },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => toast.success(a.label)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-[11px] font-bold text-white hover:border-white/20"
            >
              <Icon className="h-4 w-4 text-violet-300" />
              {a.label}
            </button>
          );
        })}
      </div>
    </>
  );
};

/* =============================== Follow-Ups =============================== */

const FollowupsSection = () => (
  <>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {gateKpis(MOCK_FOLLOWUP_KPIS).map((k) => (
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
        <Panel
          title="Prioritized Follow-Up Queue"
          bodyClassName="p-0"
          action={<LinkChip label="View full queue" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Survivor</th>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Counselor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_FOLLOWUP_QUEUE.map((f) => (
                  <tr key={f.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={f.name} />
                        <span className="font-bold text-white">{f.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {f.id}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{f.type}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-300">{f.due}</p>
                      <p
                        className={cn(
                          "text-[10px]",
                          f.dueNote === "Overdue"
                            ? "text-rose-400"
                            : f.dueNote === "Today"
                              ? "text-amber-400"
                              : "text-slate-500",
                        )}
                      >
                        ({f.dueNote})
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(f.risk)}>{f.risk}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {f.counselor}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(f.status)}>{f.status}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label="More actions"
                          onClick={() =>
                            toast.info(
                              "Follow-up details are coordinated in the case team thread in Messages.",
                            )
                          }
                          className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-violet-300 hover:bg-white/5"
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
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel
            title="Upcoming Wellness Check-Ins"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2">
              {MOCK_UPCOMING_CHECKINS.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <Calendar className="h-4 w-4 text-violet-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {c.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {c.id} · {c.type}
                    </p>
                  </div>
                  <Pill tone="sky">{c.chip}</Pill>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Recent Follow-Up Outcomes"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2">
              {MOCK_FOLLOWUP_OUTCOMES.map((o, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <CheckCircle2
                    className={cn(
                      "h-4 w-4",
                      o.tone === "emerald"
                        ? "text-emerald-400"
                        : "text-amber-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {o.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {o.outcome}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500">{o.by}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
      <div className="flex flex-col gap-6">
        <Panel
          title="High-Risk Follow-Up Alerts"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2">
            {MOCK_FU_ALERTS.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <Pill tone={statusTone(a.tag)}>{a.tag}</Pill>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {a.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {a.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-amber-400">
                    {a.note}
                  </p>
                  <p className="text-[10px] text-slate-500">{a.sub}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Recommended Next Actions">
          <div className="space-y-2">
            {MOCK_NEXT_ACTIONS.map((a, i) => {
              const Icon = a.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toast.success(a.title)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left hover:border-white/15"
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                      ICON_TONES[a.tone],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {a.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {a.sub}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </section>
    <QuickActions
      items={[
        { label: "Add Follow-Up", icon: Plus },
        { label: "Complete Check-In", icon: CheckCircle2, tone: "emerald" },
        { label: "Escalate Case", icon: AlertTriangle, tone: "rose" },
        { label: "Message Survivor", icon: MoreHorizontal },
        { label: "Create Reminder", icon: Bell, tone: "amber" },
        { label: "Export Queue", icon: Download },
      ]}
    />
  </>
);

/* =============================== Messages =============================== */

const MessagesSection = () => <SecureMessagesWorkspace />;

/* =============================== Resources =============================== */

const RESOURCE_TYPE_TONE: Record<string, string> = {
  shelter: "emerald",
  hotline: "violet",
  legal: "amber",
  medical: "rose",
  counseling: "sky",
};

const ResourcesSection = () => {
  const { data: liveResources = [] } = useLiveResources({ limit: 200 });
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("All Categories");
  const cats = [
    "All Categories",
    "Shelters",
    "Legal",
    "Medical",
    "Counseling",
    "Child Protection",
    "Safety Tools",
  ];
  const CAT_MATCH: Record<string, string> = {
    Shelters: "shelter",
    Legal: "legal",
    Medical: "medical",
    Counseling: "counsel",
    "Child Protection": "child",
    "Safety Tools": "safety",
  };

  type ResourceRow = {
    key: string;
    org: string;
    desc: string;
    cat: string;
    rawType: string;
    color: string;
    loc: string;
    avail: string;
    contact: string;
  };
  const allRows: ResourceRow[] = liveResources.length
    ? liveResources.map((r) => ({
        key: r.id,
        org: r.name,
        desc: r.description ?? "",
        cat: titleCase(r.resourceType),
        rawType: r.resourceType.toLowerCase(),
        color: RESOURCE_TYPE_TONE[r.resourceType.toLowerCase()] ?? "violet",
        loc: r.languages.slice(0, 2).join(", ") || "—",
        avail: r.available247 ? "24/7" : "Business hours",
        contact: r.contactInfo ?? "—",
      }))
    : ALLOW_MOCK
      ? MOCK_RESOURCES.map((r) => ({ ...r, key: r.org, rawType: "" }))
      : [];
  const resourceRows = allRows.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q || `${r.org} ${r.desc} ${r.cat}`.toLowerCase().includes(q);
    const matchesCat =
      activeCat === "All Categories" ||
      r.rawType.includes(CAT_MATCH[activeCat] ?? "") ||
      r.cat.toLowerCase().includes((CAT_MATCH[activeCat] ?? "").toLowerCase());
    return matchesQuery && matchesCat;
  });

  const resKpis = liveResources.length
    ? [
        {
          label: "Available Resources",
          value: nf.format(liveResources.length),
          icon: BookOpen,
          tone: "violet",
          note: "In the live directory",
        },
        {
          label: "Shelter Partners",
          value: nf.format(
            liveResources.filter((r) => r.resourceType === "shelter").length,
          ),
          icon: Home,
          tone: "emerald",
          note: "Placement ready",
        },
        {
          label: "24/7 Services",
          value: nf.format(liveResources.filter((r) => r.available247).length),
          icon: Clock,
          tone: "sky",
          note: "Always reachable",
        },
        {
          label: "Hotlines",
          value: nf.format(
            liveResources.filter((r) => r.resourceType === "hotline").length,
          ),
          icon: Bell,
          tone: "rose",
          note: "Crisis lines",
        },
      ]
    : gateKpis(MOCK_RES_KPIS);

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {resKpis.map((k) => (
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
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Panel
          title="Resource Directory"
          bodyClassName="p-0"
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search resources..."
                className="h-8 w-56 border-white/10 bg-slate-900/60 pl-8 text-xs text-white"
              />
            </div>
          }
        >
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 p-3">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-bold",
                  c === activeCat
                    ? "bg-violet-500/20 text-violet-300"
                    : "border border-white/10 text-slate-400 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resourceRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-xs text-slate-500"
                    >
                      No resources match the current filters.
                    </td>
                  </tr>
                )}
                {resourceRows.map((r) => (
                  <tr key={r.key} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{r.org}</p>
                      <p className="text-[10px] text-slate-500">{r.desc}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={r.color}>{r.cat}</Pill>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.loc}</td>
                    <td className="px-4 py-3 text-slate-400">{r.avail}</td>
                    <td className="px-4 py-3 text-slate-300">{r.contact}</td>
                    <td className="px-4 py-3">
                      <Pill tone="emerald">Available</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-500">
              Showing {resourceRows.length ? 1 : 0} to {resourceRows.length} of{" "}
              {nf.format(allRows.length)} resources
            </span>
            <Pagination />
          </div>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel
            title="Recommended Resources for Current Cases"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2">
              {allRows.slice(0, 4).map((r) => (
                <div
                  key={r.key}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                      ICON_TONES[r.color],
                    )}
                  >
                    <Home className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {r.org}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {r.desc}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Recently Used Resources"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-2">
              {allRows.slice(0, 4).map((r, i) => (
                <div
                  key={r.org}
                  className="flex items-center gap-2.5 text-[11px]"
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                      ICON_TONES[r.color],
                    )}
                  >
                    <Phone className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{r.org}</p>
                    <p className="text-[10px] text-slate-500">{r.contact}</p>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {i === 0
                      ? "Today"
                      : i === 1
                        ? "Yesterday"
                        : `${i + 1} days ago`}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
      <Panel title="Safety Plan Templates & Counseling Tools">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {MOCK_TEMPLATES.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <FileText className="mb-2 h-5 w-5 text-violet-300" />
              <p className="text-[11px] font-bold text-white">{t.name}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{t.desc}</p>
              <button
                type="button"
                onClick={() => {
                  downloadCsv(
                    `${t.name.replace(/s+/g, "-").toLowerCase()}.csv`,
                    [t as unknown as Record<string, unknown>],
                  );
                  toast.success(`${t.name} downloaded`);
                }}
                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-violet-400"
              >
                Download <Download className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <QuickActions
        items={[
          { label: "Open Directory", icon: FolderOpen },
          { label: "Request Shelter", icon: Home, tone: "sky" },
          { label: "Refer to Legal Aid", icon: Scale, tone: "emerald" },
          { label: "Call Hotline", icon: Phone, tone: "rose" },
          { label: "Download Template", icon: Download },
          { label: "Share Resource", icon: Send },
        ]}
      />
    </>
  );
};

/* =============================== Reports =============================== */

const ReportsSection = () => (
  <>
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {gateKpis(MOCK_REPORT_KPIS).map((k) => (
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
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
      <Panel
        title="Support Activity Over Time"
        className="xl:col-span-2"
        action={<SelectChip label="Last 30 Days" />}
      >
        <div className="mb-3 flex flex-wrap gap-3">
          {[
            ["Sessions Completed", "#a855f7"],
            ["Follow-Ups Completed", "#3b82f6"],
            ["Support Notes Added", "#10b981"],
          ].map(([l, c]) => (
            <span
              key={l}
              className="flex items-center gap-1.5 text-[10px] text-slate-400"
            >
              <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart
            data={MOCK_CARE_ACTIVITY.concat(MOCK_CARE_ACTIVITY).map((d, i) => ({
              ...d,
              day: `D${i + 1}`,
            }))}
          >
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
              dataKey="sessions"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="followups"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="notes"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Cases by Support Type">
        <Donut data={MOCK_REPORT_TYPES} centerValue="214" centerLabel="Total" />
        <div className="mt-2 space-y-1">
          {MOCK_REPORT_TYPES.map((c) => (
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
                {c.value} ({c.pct})
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Survivors by Age Group" action={<LinkChip label="View" />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MOCK_AGE_GROUPS}>
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
              fontSize={9}
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
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {MOCK_AGE_GROUPS.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <Panel
        title="Recent Reports"
        bodyClassName="p-0"
        action={<LinkChip label="View all reports" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">Report Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Date Generated</th>
                <th className="px-5 py-3">Date Range</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_REPORTS.map((r, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-bold text-white">{r.name}</td>
                  <td className="px-5 py-3 text-slate-300">{r.type}</td>
                  <td className="px-5 py-3 text-slate-400">{r.date}</td>
                  <td className="px-5 py-3 text-slate-400">{r.range}</td>
                  <td className="px-5 py-3">
                    <Pill tone="emerald">Completed</Pill>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Download ${r.name}`}
                      onClick={() => {
                        downloadCsv(
                          `${r.name.replace(/s+/g, "-").toLowerCase()}.csv`,
                          [r as unknown as Record<string, unknown>],
                        );
                        toast.success(`${r.name} exported`);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="flex flex-col gap-6">
        <Panel title="Report Summary">
          <div className="space-y-2">
            {MOCK_REPORT_SUMMARY.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Icon className="h-3.5 w-3.5 text-violet-300" />
                    {s.label}
                  </span>
                  <span className="text-sm font-black text-white">
                    {s.value}
                  </span>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "Detailed insights are summarised in the panels on this page.",
                )
              }
              className="mt-1 w-full text-center text-[11px] font-bold text-violet-400"
            >
              View detailed insights →
            </button>
          </div>
        </Panel>
        <Panel
          title="Export Center"
          subtitle="Download and share reports in your preferred format."
        >
          <div className="space-y-2">
            {[
              ["Export as PDF", "rose"],
              ["Export as CSV", "emerald"],
              ["Summary Report", "violet"],
            ].map(([l, t]) => (
              <button
                key={l}
                type="button"
                onClick={() =>
                  toast.success(`${l} queued — check your downloads`)
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold",
                  PILL_TONES[t],
                )}
              >
                <FileText className="h-4 w-4" />
                {l}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </section>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-3">
      <span className="px-2 text-sm font-black text-white">Quick Actions</span>
      {[
        { label: "Generate Report", icon: BarChart3 },
        { label: "Export PDF", icon: FileText, tone: "rose" },
        { label: "Export CSV", icon: Download, tone: "emerald" },
        { label: "Share Summary", icon: Send },
        { label: "View Trends", icon: BarChart3 },
        { label: "Download Dashboard", icon: Download },
      ].map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => toast.success(a.label)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-[11px] font-bold text-white hover:border-white/20"
          >
            <Icon
              className={cn(
                "h-4 w-4",
                a.tone === "rose"
                  ? "text-rose-300"
                  : a.tone === "emerald"
                    ? "text-emerald-300"
                    : "text-violet-300",
              )}
            />
            {a.label}
          </button>
        );
      })}
    </div>
  </>
);

/* =============================== Settings =============================== */

const SettingToggle = ({
  label,
  desc,
  defaultOn = true,
}: {
  label: string;
  desc: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-[11px] text-slate-500">{desc}</p>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
};

const SettingsSection = () => (
  <>
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {[
        {
          l: "Profile Status",
          v: "Complete",
          note: "All profile details up to date",
          icon: Users,
          tone: "violet",
        },
        {
          l: "MFA Enabled",
          v: "Yes",
          note: "Multi-factor authentication active",
          icon: ShieldCheck,
          tone: "sky",
        },
        {
          l: "Notification Channels",
          v: "3 Active",
          note: "Email, SMS, Push",
          icon: Bell,
          tone: "violet",
        },
        {
          l: "Language Settings",
          v: "English (US)",
          note: "Primary language",
          icon: Globe,
          tone: "emerald",
        },
      ].map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.l}
            className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl border-2",
                  ICON_TONES[k.tone],
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {k.l}
                </p>
                <p className="text-lg font-black text-emerald-300">{k.v}</p>
                <p className="text-[10px] text-slate-500">{k.note}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel title="Profile" action={<LinkChip label="Edit" />}>
            <div className="space-y-2 text-[11px]">
              {[
                ["Full Name", "Dr. Sarah M."],
                ["Email", "sarah.m@aegis-ai.org"],
                ["Phone", "+1 234 567 8901"],
                ["Timezone", "(GMT+5:30) Asia/Kolkata"],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0"
                >
                  <span className="text-slate-500">{l}</span>
                  <span className="text-right text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Security" action={<LinkChip label="Edit" />}>
            <div className="space-y-2 text-[11px]">
              {[
                ["Password", "••••••••••••", "Edit"],
                ["Multi-Factor Authentication", "Enabled", "Manage"],
                ["Trusted Devices", "3 devices", "Manage"],
                ["Session Timeout", "30 minutes", "Edit"],
              ].map(([l, v, a]) => (
                <div
                  key={l}
                  className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0"
                >
                  <span className="text-slate-500">{l}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        v === "Enabled" ? "text-emerald-400" : "text-slate-300"
                      }
                    >
                      {v}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(
                          "Security settings are managed with your administrator.",
                        )
                      }
                      className="text-violet-400"
                    >
                      {a}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Notifications" action={<LinkChip label="Edit" />}>
            <div className="divide-y divide-white/5">
              <SettingToggle
                label="Email Notifications"
                desc="Receive updates via email"
              />
              <SettingToggle
                label="SMS Notifications"
                desc="Receive updates via SMS"
              />
              <SettingToggle
                label="Push Notifications"
                desc="Receive push notifications in-app"
              />
            </div>
          </Panel>
          <Panel
            title="Language & Accessibility"
            action={<LinkChip label="Edit" />}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-bold text-white">Language</span>
                <SelectChip label="English (US)" />
              </div>
              <SettingToggle
                label="Translation Support"
                desc="Enable real-time translation"
              />
              <SettingToggle
                label="High Contrast Mode"
                desc="Improve readability"
                defaultOn={false}
              />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-bold text-white">Text Size</span>
                <SelectChip label="Medium" />
              </div>
            </div>
          </Panel>
          <Panel title="Session Defaults" action={<LinkChip label="Edit" />}>
            <div className="space-y-2 text-[11px]">
              {[
                ["Default Session Duration", "60 minutes"],
                ["Default Session Type", "Individual"],
                ["Notes Visibility", "Private"],
                ["Auto-Save Notes", "Enabled"],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0"
                >
                  <span className="text-slate-500">{l}</span>
                  <span
                    className={cn(
                      "text-right",
                      v === "Enabled" ? "text-emerald-400" : "text-slate-300",
                    )}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="AI Assistance" action={<LinkChip label="Edit" />}>
            <div className="divide-y divide-white/5">
              <SettingToggle
                label="Distress Detection Assist"
                desc="Get alerts for high-risk indicators"
              />
              <SettingToggle
                label="Wellness Reminders"
                desc="Receive reminders to take breaks"
              />
              <SettingToggle
                label="AI Summary Suggestions"
                desc="Suggest session summaries"
              />
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="Account Summary">
        <div className="flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-black text-white">
            D
          </div>
        </div>
        <div className="mt-4 space-y-3 text-[11px]">
          {[
            [Users, "Role", "Counselor"],
            [Home, "Organization", "AEGIS Counseling Services"],
            [ShieldCheck, "License Status", "Active · Expires May 31, 2026"],
            [Clock, "Last Login", "May 17, 2025 10:15 AM"],
            [Lock, "Account Created", "Jan 12, 2024"],
          ].map(([Ic, l, v], i) => {
            const Icon = Ic as ComponentType<{ className?: string }>;
            return (
              <div
                key={i}
                className="flex items-start gap-2 border-b border-white/5 pb-2"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 text-violet-300" />
                <div>
                  <p className="text-slate-500">{l as string}</p>
                  <p className="text-slate-300">{v as string}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          <div>
            <p className="text-[10px] text-slate-500">Account ID</p>
            <p className="text-[11px] font-bold text-violet-300">
              AEGIS-DRSM-78421
            </p>
          </div>
          <button
            type="button"
            aria-label="Copy account ID"
            onClick={() => {
              void navigator.clipboard?.writeText("AEGIS-DRSM-78421");
              toast.success("Account ID copied");
            }}
            className="text-slate-400 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </Panel>
    </section>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-3">
      <span className="px-2 text-sm font-black text-white">Quick Actions</span>
      {[
        { label: "Save Changes", icon: CheckCircle2 },
        { label: "Update Password", icon: Lock },
        { label: "Manage Notifications", icon: Bell },
        { label: "Change Language", icon: Globe },
        { label: "Enable MFA", icon: ShieldCheck },
        { label: "Reset Preferences", icon: RefreshCw },
      ].map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => toast.success(a.label)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-[11px] font-bold text-white hover:border-white/20"
          >
            <Icon className="h-4 w-4 text-violet-300" />
            {a.label}
          </button>
        );
      })}
    </div>
  </>
);

export default CounselorPortal;
