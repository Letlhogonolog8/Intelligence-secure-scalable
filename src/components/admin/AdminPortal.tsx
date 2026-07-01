/**
 * AEGIS-AI Admin Portal.
 *
 * This screen is a faithful build of the approved Admin Portal mock-up. The
 * data below is sample/presentation data captured from the mock-up and lives in
 * clearly-marked constants so it can be wired to live AEGIS data sources later
 * without touching the layout. Search for `MOCK_` to find every seam.
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
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
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  Flag,
  Globe,
  HardDrive,
  Heart,
  HelpCircle,
  Info,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Network,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Smartphone,
  TrendingDown,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import SecureMessagesWorkspace from "@/components/messaging/SecureMessagesWorkspace";
import WorldRiskMap, {
  type MapRegion,
} from "@/components/analyst/WorldRiskMap";
import {
  useAlertsFeed,
  useAuditLogs,
  useCaseReports,
  useCommunicationGateways,
  useComplianceStandards,
  useConsentCategories,
  useConsentMetrics,
  useDeletionRequests,
  useOrganizations,
  usePartnerIntegrations,
  usePlatformServices,
  useRegions,
  useScheduledJobs,
  useStorageMetrics,
  useSystemMetrics,
  useUserProfile,
  useUserProfiles,
} from "@/data/aegisData";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_DEFINITIONS, type UserRole } from "@/lib/roleConfig";
import { ALLOW_MOCK, NO_DATA, mockList } from "@/lib/mockData";

const nf = new Intl.NumberFormat("en-US");
const fmtRelative = (t: string) => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
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
const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
const fmtTB = (bytes: number) => `${(bytes / 1_099_511_627_776).toFixed(2)} TB`;

type SectionKey =
  | "overview"
  | "approvals"
  | "identities"
  | "operations"
  | "compliance"
  | "messages";

/* ============================ MOCK / SAMPLE DATA ============================ */
/* Replace each constant with a live data hook when wiring the portal. */

const MOCK_ADMIN = { name: "Admin User", role: "Super Administrator" };

const MOCK_KPIS_OVERVIEW = [
  {
    label: "Total Users",
    value: "24,589",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.5%" },
    sub: "vs last 7 days",
  },
  {
    label: "Active Cases",
    value: "8,347",
    icon: Briefcase,
    tone: "sky",
    delta: { dir: "up", text: "8.3%" },
    sub: "vs last 7 days",
  },
  {
    label: "Incidents Reported",
    value: "3,921",
    icon: AlertTriangle,
    tone: "rose",
    delta: { dir: "up", text: "15.7%" },
    sub: "vs last 7 days",
  },
  {
    label: "Organizations",
    value: "156",
    icon: Building2,
    tone: "amber",
    delta: { dir: "up", text: "5.4%" },
    sub: "vs last 7 days",
  },
  {
    label: "System Uptime",
    value: "99.97%",
    icon: ShieldCheck,
    tone: "emerald",
    delta: { dir: "up", text: "0.02%" },
    sub: "vs last 7 days",
  },
  {
    label: "AI Processed Items",
    value: "192,784",
    icon: Cpu,
    tone: "violet",
    delta: { dir: "up", text: "18.9%" },
    sub: "vs last 7 days",
  },
] as const;

const MOCK_PLATFORM_ACTIVITY = [
  { day: "May 09", users: 720, cases: 480, incidents: 250 },
  { day: "May 10", users: 880, cases: 560, incidents: 300 },
  { day: "May 11", users: 1080, cases: 640, incidents: 360 },
  { day: "May 12", users: 940, cases: 600, incidents: 320 },
  { day: "May 13", users: 1180, cases: 720, incidents: 420 },
  { day: "May 14", users: 1040, cases: 680, incidents: 360 },
  { day: "May 15", users: 1320, cases: 820, incidents: 470 },
];

const MOCK_CASE_REGIONS = [
  { name: "Africa", value: "3,421", pct: 41, color: "#3b82f6" },
  { name: "Asia", value: "2,187", pct: 26, color: "#6366f1" },
  { name: "Europe", value: "1,243", pct: 15, color: "#f59e0b" },
  { name: "Americas", value: "1,012", pct: 12, color: "#06b6d4" },
  { name: "Oceania", value: "484", pct: 6, color: "#94a3b8" },
];

const MOCK_MAP_REGIONS: MapRegion[] = [
  {
    id: "jhb",
    name: "Johannesburg",
    country: "South Africa",
    riskLevel: "critical",
    incidents: 342,
    lat: -26.2,
    lng: 28.04,
  },
  {
    id: "lagos",
    name: "Lagos",
    country: "Nigeria",
    riskLevel: "high",
    incidents: 234,
    lat: 6.52,
    lng: 3.37,
  },
  {
    id: "nairobi",
    name: "Nairobi",
    country: "Kenya",
    riskLevel: "high",
    incidents: 145,
    lat: -1.29,
    lng: 36.82,
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    riskLevel: "high",
    incidents: 198,
    lat: 19.07,
    lng: 72.87,
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    riskLevel: "medium",
    incidents: 88,
    lat: 51.5,
    lng: -0.12,
  },
  {
    id: "saopaulo",
    name: "São Paulo",
    country: "Brazil",
    riskLevel: "high",
    incidents: 121,
    lat: -23.55,
    lng: -46.63,
  },
  {
    id: "manila",
    name: "Manila",
    country: "Philippines",
    riskLevel: "medium",
    incidents: 96,
    lat: 14.6,
    lng: 120.98,
  },
  {
    id: "sydney",
    name: "Sydney",
    country: "Australia",
    riskLevel: "low",
    incidents: 34,
    lat: -33.87,
    lng: 151.21,
  },
];

const MOCK_SYSTEM_HEALTH = [
  { name: "API Services", icon: Server },
  { name: "Database", icon: Database },
  { name: "AI Engine", icon: Brain },
  { name: "File Storage", icon: HardDrive },
  { name: "Real-time Engine", icon: Activity },
  { name: "Notification Service", icon: Bell },
  { name: "Backup Service", icon: RefreshCw },
];

const MOCK_CASES_BY_STATUS = [
  { name: "Under Review", value: 2456, pct: 29, color: "#8b5cf6" },
  { name: "In Progress", value: 2189, pct: 26, color: "#3b82f6" },
  { name: "Assigned", value: 1876, pct: 22, color: "#10b981" },
  { name: "Resolved", value: 1234, pct: 15, color: "#06b6d4" },
  { name: "Closed", value: 592, pct: 7, color: "#a855f7" },
];

const MOCK_AI_INSIGHTS = [
  {
    title: "High Risk Areas",
    desc: "3 regions require attention",
    action: "View Details",
    icon: TrendingUp,
    tone: "rose",
  },
  {
    title: "Response Efficiency",
    desc: "Avg. response time improved",
    action: "View Report",
    icon: Activity,
    tone: "emerald",
  },
  {
    title: "Predictive Alert",
    desc: "Possible surge in reports",
    action: "View Prediction",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    title: "Sentiment Analysis",
    desc: "Survivor sentiment improving",
    action: "View Analysis",
    icon: Heart,
    tone: "violet",
  },
];

const MOCK_RECENT_ACTIVITY = [
  {
    icon: Users,
    tone: "violet",
    title: "New user registered: Nomsa Dlamini",
    sub: "Survivor · Johannesburg, South Africa",
    time: "2 min ago",
  },
  {
    icon: Briefcase,
    tone: "sky",
    title: "Case #AEG-2026-1187 created",
    sub: "Domestic Violence · Cape Town, SA",
    time: "5 min ago",
  },
  {
    icon: CheckCircle2,
    tone: "emerald",
    title: "NGO Hope Foundation accepted referral",
    sub: "Case #AEG-2026-1185 · Durban, SA",
    time: "12 min ago",
  },
  {
    icon: Shield,
    tone: "rose",
    title: "Officer Sgt. Mokoena updated case status",
    sub: "Case #AEG-2026-1184 · Pretoria, SA",
    time: "18 min ago",
  },
  {
    icon: Database,
    tone: "emerald",
    title: "System backup completed successfully",
    sub: "Backup ID: BKP-2026-0515-1024",
    time: "32 min ago",
  },
];

const MOCK_CRITICAL_ALERTS = [
  {
    sev: "critical",
    title: "High API response time detected",
    time: "2 min ago",
  },
  { sev: "warning", title: "AI translation queue delay", time: "8 min ago" },
  { sev: "info", title: "Database replication lag", time: "15 min ago" },
  {
    sev: "warning",
    title: "New login from unknown device",
    time: "23 min ago",
  },
  { sev: "warning", title: "Disk space running low (78%)", time: "1 hour ago" },
];

const MOCK_QUICK_ACTIONS = [
  {
    label: "Add New User",
    desc: "Create platform user",
    icon: UserPlus,
    tone: "violet",
  },
  {
    label: "Create Organization",
    desc: "Add new organization",
    icon: Building2,
    tone: "sky",
  },
  {
    label: "Manage Roles",
    desc: "Roles & permissions",
    icon: UserCog,
    tone: "rose",
  },
  {
    label: "Configure AI Model",
    desc: "Manage AI settings",
    icon: Brain,
    tone: "amber",
  },
  {
    label: "Generate Report",
    desc: "Create system report",
    icon: FileText,
    tone: "emerald",
  },
  {
    label: "System Settings",
    desc: "Configure platform",
    icon: SettingsIcon,
    tone: "cyan",
  },
  {
    label: "View Audit Logs",
    desc: "Track system activity",
    icon: ClipboardList,
    tone: "violet",
  },
];

const MOCK_APPROVAL_QUEUE_MINI = [
  {
    name: "NGO Registration: Women First Initiative",
    sub: "NGO Registration · South Africa",
    tag: "NGO Approval",
    tone: "amber" as const,
  },
  {
    name: "Officer Access: Lt. Thandiwe Mokoena",
    sub: "Officer Access · Johannesburg",
    tag: "Role Approval",
    tone: "sky" as const,
  },
  {
    name: "Data Access: Analyst Team",
    sub: "Data Access · Cape Town",
    tag: "Data Access",
    tone: "violet" as const,
  },
];

const MOCK_IDENTITY_OVERVIEW = [
  {
    label: "Active Users",
    value: "24,589",
    delta: { dir: "up", text: "12.5%" },
  },
  {
    label: "Privileged Accounts",
    value: "142",
    delta: { dir: "up", text: "4.1%" },
  },
  { label: "MFA Enabled", value: "98.6%", delta: { dir: "up", text: "2.3%" } },
  {
    label: "Failed Logins (7d)",
    value: "263",
    delta: { dir: "down", text: "8.7%" },
  },
] as const;

const MOCK_COMPLIANCE_OVERVIEW = [
  {
    name: "Data Protection",
    desc: "GDPR, POPIA Compliant",
    icon: Lock,
    tone: "rose",
  },
  {
    name: "Security Standards",
    desc: "ISO 27001 Aligned",
    icon: ShieldCheck,
    tone: "amber",
  },
  {
    name: "Audit Readiness",
    desc: "96% Requirements Met",
    icon: ClipboardList,
    tone: "emerald",
  },
];

const MOCK_STORAGE = [
  { label: "Total Storage Used", used: "2.45 TB", total: "10 TB", pct: 24.5 },
  { label: "File Storage", used: "1.32 TB", total: "5 TB", pct: 26.4 },
  { label: "Database Storage", used: "1.13 TB", total: "5 TB", pct: 22.6 },
];

const MOCK_APPROVAL_KPIS = [
  {
    label: "Pending Approvals",
    value: "8",
    icon: ClipboardList,
    tone: "violet",
    delta: { dir: "up", text: "14.3%" },
  },
  {
    label: "High Priority Requests",
    value: "3",
    icon: Flag,
    tone: "rose",
    delta: { dir: "up", text: "20.0%" },
  },
  {
    label: "Identity Verifications",
    value: "15",
    icon: ShieldCheck,
    tone: "sky",
    delta: { dir: "up", text: "8.6%" },
  },
  {
    label: "Organization Requests",
    value: "4",
    icon: Building2,
    tone: "amber",
    delta: { dir: "down", text: "11.1%" },
  },
] as const;

const MOCK_APPROVAL_ROWS = [
  {
    type: "Role Change Request",
    typeSub: "Elevated access request",
    icon: UserCog,
    by: "Jane Cooper",
    email: "jane.cooper@metro.gov",
    org: "Metro Police Dept.",
    orgSub: "Law Enforcement",
    priority: "High",
    submitted: "May 15, 2025",
    time: "10:22 AM",
  },
  {
    type: "New Partner Organization",
    typeSub: "Organization onboarding",
    icon: Building2,
    by: "Michael Chen",
    email: "michael.chen@univhosp.org",
    org: "Riverside University Hospital",
    orgSub: "Healthcare",
    priority: "High",
    submitted: "May 15, 2025",
    time: "9:41 AM",
  },
  {
    type: "Police Account Access",
    typeSub: "System access request",
    icon: Shield,
    by: "Officer Daniel Ruiz",
    email: "d.ruiz@citypd.gov",
    org: "City Police Department",
    orgSub: "Law Enforcement",
    priority: "Medium",
    submitted: "May 15, 2025",
    time: "8:35 AM",
  },
  {
    type: "Counselor Verification",
    typeSub: "Professional verification",
    icon: ShieldCheck,
    by: "Sarah Johnson, LPC",
    email: "sarah.johnson@safehands.org",
    org: "SafeHands Counseling",
    orgSub: "Mental Health",
    priority: "Medium",
    submitted: "May 15, 2025",
    time: "8:12 AM",
  },
  {
    type: "Data Access Request",
    typeSub: "Case data access",
    icon: Database,
    by: "Ethan Walker",
    email: "ethan.walker@da.office.gov",
    org: "County District Attorney",
    orgSub: "Legal",
    priority: "Low",
    submitted: "May 15, 2025",
    time: "7:28 AM",
  },
  {
    type: "Role Change Request",
    typeSub: "Role modification",
    icon: UserCog,
    by: "Lisa Martinez",
    email: "lisa.martinez@healthdept.gov",
    org: "County Health Department",
    orgSub: "Government",
    priority: "Low",
    submitted: "May 15, 2025",
    time: "6:54 AM",
  },
  {
    type: "New Partner Organization",
    typeSub: "Organization onboarding",
    icon: Building2,
    by: "David Park",
    email: "david.park@youthconnect.org",
    org: "YouthConnect Services",
    orgSub: "Non-Profit",
    priority: "Medium",
    submitted: "May 15, 2025",
    time: "6:15 AM",
  },
  {
    type: "Counselor Verification",
    typeSub: "Professional verification",
    icon: ShieldCheck,
    by: "Dr. Amanda Lee",
    email: "amanda.lee@wellmind.org",
    org: "WellMind Therapy Group",
    orgSub: "Mental Health",
    priority: "Low",
    submitted: "May 15, 2025",
    time: "5:42 AM",
  },
];

const MOCK_RECENT_DECISIONS = [
  {
    title: "Data Access Request",
    by: "Alex Thompson",
    org: "County District Attorney",
    status: "Approved",
    time: "12 min ago",
  },
  {
    title: "Role Change Request",
    by: "Mark Wilson",
    org: "City Police Department",
    status: "Denied",
    time: "35 min ago",
  },
  {
    title: "Counselor Verification",
    by: "Emily Rodriguez",
    org: "SafeHands Counseling",
    status: "Approved",
    time: "1 hour ago",
  },
  {
    title: "New Partner Organization",
    by: "James Carter",
    org: "Hope House Services",
    status: "Approved",
    time: "2 hours ago",
  },
  {
    title: "Police Account Access",
    by: "Officer Taylor Smith",
    org: "Metro Police Department",
    status: "Deferred",
    time: "2 hours ago",
  },
];

const MOCK_CHECKLIST = [
  { label: "Verify requester identity and affiliation", done: true },
  { label: "Confirm organization and role alignment", done: true },
  { label: "Review supporting documents", done: true },
  { label: "Assess data access level and scope", done: true },
  { label: "Check for conflicting access or risks", done: false },
  { label: "Add notes or request more information", done: false },
];

const MOCK_IDENTITY_KPIS = [
  {
    label: "Total Identities",
    value: "24,589",
    icon: Users,
    tone: "violet",
    delta: { dir: "up", text: "12.5%" },
    sub: "vs last 7 days",
  },
  {
    label: "MFA Enabled",
    value: "18,342",
    icon: Lock,
    tone: "sky",
    sub: "74.6% of total identities",
  },
  {
    label: "Pending Verification",
    value: "142",
    icon: Clock,
    tone: "amber",
    sub: "Requires action",
  },
  {
    label: "Suspended Accounts",
    value: "36",
    icon: UserPlus,
    tone: "rose",
    delta: { dir: "down", text: "8.3%" },
    sub: "vs last 7 days",
  },
] as const;

const MOCK_IDENTITIES = [
  {
    name: "James Anderson",
    email: "janderson@globex.com",
    role: "Super Administrator",
    org: "Globex Corporation",
    status: "Verified",
    active: "May 15, 2025 10:22 AM",
  },
  {
    name: "Sarah Mitchell",
    email: "smitchell@globex.com",
    role: "Security Analyst",
    org: "Globex Corporation",
    status: "Verified",
    active: "May 15, 2025 09:48 AM",
  },
  {
    name: "David Chen",
    email: "dchen@globex.com",
    role: "Case Manager",
    org: "Globex Corporation",
    status: "Pending",
    active: "May 15, 2025 08:31 AM",
  },
  {
    name: "Priya Shah",
    email: "pshah@initech.com",
    role: "Analyst",
    org: "Initech Solutions",
    status: "Verified",
    active: "May 14, 2025 04:12 PM",
  },
  {
    name: "Michael Rodriguez",
    email: "mrodriguez@initech.com",
    role: "IT Administrator",
    org: "Initech Solutions",
    status: "Suspended",
    active: "May 14, 2025 11:05 AM",
  },
  {
    name: "Emily Watson",
    email: "ewatson@initech.com",
    role: "Case Manager",
    org: "Initech Solutions",
    status: "Pending",
    active: "May 13, 2025 03:21 PM",
  },
  {
    name: "Robert Kim",
    email: "rkim@umbrella.com",
    role: "Auditor",
    org: "Umbrella Corp",
    status: "Verified",
    active: "May 13, 2025 09:17 AM",
  },
  {
    name: "Linda Martinez",
    email: "lmartinez@umbrella.com",
    role: "Analyst",
    org: "Umbrella Corp",
    status: "Verified",
    active: "May 12, 2025 05:44 PM",
  },
];

const MOCK_RECOVERY = [
  {
    name: "Daniel Lewis",
    email: "dlewis@globex.com",
    org: "Globex Corporation",
    requested: "May 15, 2025 09:15 AM",
    reason: "Forgot credentials",
    status: "New",
  },
  {
    name: "Aisha Patel",
    email: "apatel@initech.com",
    org: "Initech Solutions",
    requested: "May 15, 2025 08:02 AM",
    reason: "Account locked",
    status: "In Review",
  },
  {
    name: "Thomas Wright",
    email: "twright@umbrella.com",
    org: "Umbrella Corp",
    requested: "May 14, 2025 06:41 PM",
    reason: "MFA reset",
    status: "New",
  },
];

const MOCK_VERIFICATION_ALERTS = [
  {
    name: "David Chen",
    email: "dchen@globex.com",
    org: "Globex Corporation",
    alert: "Email not verified",
    triggered: "May 15, 2025 08:31 AM",
    severity: "Medium",
  },
  {
    name: "Emily Watson",
    email: "ewatson@initech.com",
    org: "Initech Solutions",
    alert: "MFA not configured",
    triggered: "May 13, 2025 03:21 PM",
    severity: "Medium",
  },
  {
    name: "System",
    email: "system@umbrella.com",
    org: "Umbrella Corp",
    alert: "Unusual sign-in location",
    triggered: "May 12, 2025 11:07 AM",
    severity: "High",
  },
];

const MOCK_OPS_KPIS = [
  {
    label: "Active Services",
    value: "6 / 6",
    icon: Boxes,
    tone: "violet",
    deltaText: "100% Healthy",
  },
  {
    label: "Connected Partners",
    value: "24",
    icon: Users,
    tone: "sky",
    deltaText: "4 vs last 7 days",
  },
  {
    label: "Gateway Status",
    value: "4 / 4",
    icon: Network,
    tone: "emerald",
    deltaText: "100% Operational",
  },
  {
    label: "Scheduled Tasks",
    value: "18",
    icon: Calendar,
    tone: "amber",
    deltaText: "2 due today",
  },
] as const;

const MOCK_SERVICES = [
  {
    name: "Authentication Service",
    desc: "User authentication & authorization",
    icon: ShieldCheck,
    uptime: "99.98%",
  },
  {
    name: "Notification Service",
    desc: "Alerts, emails & push notifications",
    icon: Bell,
    uptime: "99.95%",
  },
  {
    name: "AI Engine",
    desc: "AI processing & inference",
    icon: Brain,
    uptime: "99.96%",
  },
  {
    name: "Translation Service",
    desc: "Language translation & processing",
    icon: Globe,
    uptime: "99.94%",
  },
  {
    name: "File Storage",
    desc: "File storage & asset management",
    icon: HardDrive,
    uptime: "99.97%",
  },
  {
    name: "Real-Time Engine",
    desc: "Real-time data & event streaming",
    icon: Activity,
    uptime: "99.96%",
  },
];

const MOCK_GATEWAYS = [
  {
    name: "SMS Connector",
    desc: "Twilio SMS Gateway",
    icon: MessageSquare,
    latency: "120ms",
    messages: "12,842",
  },
  {
    name: "WhatsApp Connector",
    desc: "Meta WhatsApp Business API",
    icon: MessageSquare,
    latency: "98ms",
    messages: "8,421",
  },
  {
    name: "USSD Connector",
    desc: "Africa's Talking USSD",
    icon: Smartphone,
    latency: "150ms",
    messages: "3,210",
  },
  {
    name: "Email Connector",
    desc: "SMTP Email Service",
    icon: Mail,
    latency: "110ms",
    messages: "9,156",
  },
];

const MOCK_PARTNERS = [
  {
    name: "Home Affairs",
    desc: "Identity Verification",
    status: "Synced",
    sync: "2 min ago",
    records: "4,821",
  },
  {
    name: "Banks API",
    desc: "Financial Data",
    status: "Synced",
    sync: "5 min ago",
    records: "12,410",
  },
  {
    name: "Telco Providers",
    desc: "Subscriber Data",
    status: "Synced",
    sync: "7 min ago",
    records: "18,593",
  },
  {
    name: "Credit Bureaus",
    desc: "Credit Reporting",
    status: "Syncing",
    sync: "12 min ago",
    records: "6,231",
  },
  {
    name: "Law Enforcement",
    desc: "Watchlist Data",
    status: "Synced",
    sync: "15 min ago",
    records: "2,114",
  },
];

const MOCK_JOBS = [
  {
    name: "User Session Cleanup",
    type: "Maintenance",
    typeTone: "sky",
    next: "Today, 11:00 AM",
    freq: "Every 1 hour",
    last: "Today, 10:00 AM",
  },
  {
    name: "Database Backup",
    type: "Backup",
    typeTone: "emerald",
    next: "Today, 01:00 PM",
    freq: "Daily",
    last: "Today, 01:00 AM",
  },
  {
    name: "Audit Log Rotation",
    type: "Maintenance",
    typeTone: "sky",
    next: "Today, 02:00 PM",
    freq: "Daily",
    last: "Today, 02:00 AM",
  },
  {
    name: "Analytics Data Aggregation",
    type: "Processing",
    typeTone: "violet",
    next: "Today, 03:00 PM",
    freq: "Daily",
    last: "Today, 03:00 AM",
  },
  {
    name: "System Health Report",
    type: "Report",
    typeTone: "amber",
    next: "Today, 04:00 PM",
    freq: "Daily",
    last: "Today, 04:00 AM",
  },
];

const MOCK_OPS_ACTIVITY = [
  {
    time: "10:18 AM",
    title: "Database backup completed successfully",
    sub: "Backup ID: BKP-2026-0515-1018",
    tag: "Success",
    tone: "emerald" as const,
  },
  {
    time: "10:12 AM",
    title: "Partner sync completed: Home Affairs",
    sub: "4,821 records synchronized",
    tag: "Success",
    tone: "emerald" as const,
  },
  {
    time: "10:05 AM",
    title: "New user login detected: admin.user@aegis.ai",
    sub: "IP: 197.210.34.12 · Cape Town, South Africa",
    tag: "Info",
    tone: "sky" as const,
  },
  {
    time: "09:58 AM",
    title: "High API response time detected on AI Engine",
    sub: "Average response time: 1.52s",
    tag: "Warning",
    tone: "amber" as const,
  },
  {
    time: "09:47 AM",
    title: "File storage optimization completed",
    sub: "Freed: 2.45 GB",
    tag: "Success",
    tone: "emerald" as const,
  },
];

const MOCK_COMPLIANCE_KPIS = [
  {
    label: "POPIA Status",
    value: "Compliant",
    icon: ShieldCheck,
    tone: "violet",
    note: "No critical issues",
  },
  {
    label: "GDPR Status",
    value: "Compliant",
    icon: Shield,
    tone: "sky",
    note: "No critical issues",
  },
  {
    label: "Consent Records",
    value: "48,237",
    icon: Users,
    tone: "emerald",
    delta: { dir: "up", text: "6.3%" },
  },
  {
    label: "Open Data Requests",
    value: "23",
    icon: FileText,
    tone: "amber",
    delta: { dir: "up", text: "12.5%" },
  },
] as const;

const MOCK_DATA_RIGHTS = [
  {
    id: "DR-2025-0412",
    type: "Export",
    typeTone: "violet",
    requester: "Nomsa Dlamini",
    email: "nomsa.k@example.com",
    status: "Completed",
    submitted: "May 14, 2025",
    due: "May 21, 2025",
    assignee: "Thandiwe S.",
    initials: "TS",
  },
  {
    id: "DR-2025-0411",
    type: "Deletion",
    typeTone: "rose",
    requester: "Liam Johnson",
    email: "liam.j@example.com",
    status: "In Progress",
    submitted: "May 13, 2025",
    due: "May 20, 2025",
    assignee: "Alex R.",
    initials: "AR",
  },
  {
    id: "DR-2025-0410",
    type: "Consent Withdrawal",
    typeTone: "amber",
    requester: "Ahmed Khan",
    email: "ahmed.k@example.com",
    status: "In Progress",
    submitted: "May 13, 2025",
    due: "May 20, 2025",
    assignee: "Melissa B.",
    initials: "MS",
  },
  {
    id: "DR-2025-0409",
    type: "Export",
    typeTone: "violet",
    requester: "Sophie Martin",
    email: "sophie.m@example.com",
    status: "Completed",
    submitted: "May 12, 2025",
    due: "May 19, 2025",
    assignee: "Thandiwe S.",
    initials: "TS",
  },
  {
    id: "DR-2025-0408",
    type: "Deletion",
    typeTone: "rose",
    requester: "Jabulani Maseko",
    email: "jabulani.m@example.com",
    status: "Pending",
    submitted: "May 12, 2025",
    due: "May 19, 2025",
    assignee: "Alex R.",
    initials: "AR",
  },
];

const MOCK_STANDARDS = [
  {
    name: "POPIA Compliance",
    desc: "Protection of Personal Information Act",
    pct: 96,
    status: "Compliant",
    statusTone: "emerald" as const,
    barColor: "#8b5cf6",
  },
  {
    name: "GDPR Compliance",
    desc: "General Data Protection Regulation",
    pct: 94,
    status: "Compliant",
    statusTone: "emerald" as const,
    barColor: "#3b82f6",
  },
  {
    name: "ISO 27001",
    desc: "Information Security Management",
    pct: 88,
    status: "Compliant",
    statusTone: "emerald" as const,
    barColor: "#f59e0b",
  },
  {
    name: "Audit Readiness",
    desc: "Internal Audit Preparedness",
    pct: 82,
    status: "In Progress",
    statusTone: "amber" as const,
    barColor: "#10b981",
  },
];

const MOCK_CONSENT = [
  { name: "Active Consent", value: 32145, pct: "66.6%", color: "#10b981" },
  { name: "Expired Consent", value: 7842, pct: "16.2%", color: "#f59e0b" },
  { name: "Withdrawn Consent", value: 5231, pct: "10.8%", color: "#f97316" },
  { name: "Pending Consent", value: 2319, pct: "4.8%", color: "#ec4899" },
  { name: "No Consent Record", value: 700, pct: "1.4%", color: "#64748b" },
];

const MOCK_CONSENT_CATEGORIES = [
  { name: "Marketing Communications", value: "18,432", pct: "38.2%" },
  { name: "Service Personalization", value: "12,876", pct: "26.7%" },
  { name: "Analytics & Insights", value: "8,345", pct: "18.3%" },
  { name: "Third-Party Sharing", value: "4,721", pct: "9.8%" },
  { name: "Product Improvement", value: "3,263", pct: "6.8%" },
];

const MOCK_COMPLIANCE_ACTIVITY = [
  {
    icon: CheckCircle2,
    tone: "emerald",
    title: "Data export request completed",
    sub: "DR-2025-0412 · Nomsa Dlamini",
    time: "2 min ago",
  },
  {
    icon: Info,
    tone: "sky",
    title: "Consent updated",
    sub: "Marketing Communications · Sophie Martin",
    time: "15 min ago",
  },
  {
    icon: AlertTriangle,
    tone: "amber",
    title: "Data deletion request submitted",
    sub: "DR-2025-0411 · Liam Johnson",
    time: "32 min ago",
  },
  {
    icon: CheckCircle2,
    tone: "emerald",
    title: "Privacy policy updated",
    sub: "Version 2.4 · Published by Admin User",
    time: "1 hour ago",
  },
  {
    icon: Info,
    tone: "sky",
    title: "Third-party processor assessment completed",
    sub: "AWS Europe (Ireland) · Risk: Low",
    time: "2 hours ago",
  },
];

/* ================================ HELPERS ================================ */

const SECTION_META: Record<
  SectionKey,
  { title: string; subtitle: string; greeting?: boolean }
> = {
  overview: {
    title: "Hello, Admin User",
    subtitle: "System overview and platform intelligence.",
    greeting: true,
  },
  approvals: {
    title: "Approvals",
    subtitle: "Review and manage platform approval requests.",
  },
  identities: {
    title: "Identities",
    subtitle: "Manage user identities, roles, and access across the platform.",
  },
  operations: {
    title: "Operations",
    subtitle: "Operations center and platform management.",
  },
  compliance: {
    title: "Compliance Overview",
    subtitle:
      "Manage data protection, privacy compliance, and regulatory obligations.",
  },
  messages: {
    title: "Secure Messages",
    subtitle:
      "Coordinate securely with officers, NGOs, counselors, and survivors.",
  },
};

/** Maps icon names stored on operational rows to their lucide component. */
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Bell,
  Brain,
  Globe,
  HardDrive,
  Activity,
  Server,
  Database,
  RefreshCw,
  MessageSquare,
  Smartphone,
  Mail,
};
const iconFor = (name: string): ComponentType<{ className?: string }> =>
  ICON_MAP[name] ?? Boxes;

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
        "inline-flex items-center gap-0.5 font-bold",
        dir === "up" ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {dir === "up" ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {text}
    </span>
    {sub ? <span className="text-slate-500">{sub}</span> : null}
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
  deltaText,
  sub,
  note,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  delta?: { dir: string; text: string };
  deltaText?: string;
  sub?: string;
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
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black text-white">{value}</p>
        {delta ? (
          <div className="mt-0.5">
            <Delta dir={delta.dir} text={delta.text} sub={sub} />
          </div>
        ) : deltaText ? (
          <p className="mt-0.5 text-[11px] font-bold text-emerald-400">
            ↑ {deltaText}
          </p>
        ) : note ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {note}
          </p>
        ) : sub ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
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
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={88}
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
      <span className="text-2xl font-black text-white">{centerValue}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {centerLabel}
      </span>
    </div>
  </div>
);

const tableHead =
  "border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500";

const NAV_GROUPS: {
  heading: string;
  items: {
    key: SectionKey | string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
    disabled?: boolean;
  }[];
}[] = [
  {
    heading: "Main",
    items: [
      { key: "overview", label: "Overview", icon: LayoutGrid },
      { key: "approvals", label: "Approvals", icon: ClipboardList, badge: 8 },
      { key: "identities", label: "Identities", icon: Users },
      { key: "operations", label: "Operations", icon: Boxes },
      { key: "compliance", label: "Compliance", icon: Shield },
      { key: "messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    heading: "Management",
    items: [
      { key: "identities", label: "User Management", icon: UserCog },
      { key: "approvals", label: "Case Management", icon: Briefcase },
      { key: "operations", label: "System Configuration", icon: SettingsIcon },
      { key: "operations", label: "AI & Models", icon: Brain },
      { key: "operations", label: "Integrations", icon: Plug },
    ],
  },
  {
    heading: "Monitoring & Insights",
    items: [
      { key: "operations", label: "Analytics & Reports", icon: BarChart3 },
      { key: "operations", label: "Audit Logs", icon: FileText },
      { key: "operations", label: "System Health", icon: Activity },
    ],
  },
  {
    heading: "Support & Tools",
    items: [
      {
        key: "support",
        label: "Support Center",
        icon: LifeBuoy,
        disabled: true,
      },
      {
        key: "support",
        label: "Knowledge Base",
        icon: HelpCircle,
        disabled: true,
      },
      {
        key: "support",
        label: "Maintenance Mode",
        icon: Wrench,
        disabled: true,
      },
    ],
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

const statusPillTone = (status: string) => {
  const s = status.toLowerCase();
  if (
    [
      "verified",
      "completed",
      "approved",
      "synced",
      "compliant",
      "success",
    ].includes(s)
  )
    return "emerald";
  if (
    [
      "pending",
      "in progress",
      "in review",
      "medium",
      "syncing",
      "scheduled",
      "warning",
      "deferred",
    ].includes(s)
  )
    return "amber";
  if (["suspended", "denied", "high"].includes(s)) return "rose";
  if (["new", "low", "info"].includes(s)) return "sky";
  return "slate";
};

/* ================================ PORTAL ================================ */

const AdminPortal: React.FC = () => {
  const [section, setSection] = useState<SectionKey>("overview");
  const [activeNav, setActiveNav] = useState("Main-Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = SECTION_META[section];

  const { user, signOut } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const admin = {
    name: profile?.fullName || MOCK_ADMIN.name,
    role: profile?.role
      ? (ROLE_DEFINITIONS[profile.role as UserRole]?.label ??
        titleCase(profile.role))
      : MOCK_ADMIN.role,
  };

  // Live header clock (replaces the hard-coded "10:24 AM").
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Close the profile menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const go = (key: SectionKey, navId: string) => {
    setSection(key);
    setActiveNav(navId);
  };

  return (
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
              <linearGradient id="aegis-admin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>
            <path d="M20 2 L36 11 L20 38 L4 11 Z" fill="url(#aegis-admin)" />
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
              Admin Portal
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                {group.heading}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const navId = `${group.heading}-${item.label}`;
                  const active = activeNav === navId;
                  return (
                    <button
                      key={navId}
                      type="button"
                      disabled={item.disabled}
                      onClick={() =>
                        !item.disabled && go(item.key as SectionKey, navId)
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all",
                        item.disabled
                          ? "cursor-not-allowed text-slate-600"
                          : active
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
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500/20 px-1 text-[10px] font-black text-amber-300">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 pb-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-black text-white">System Status</p>
            </div>
            <p className="mt-1 text-[11px] font-medium text-emerald-400">
              All Systems Operational
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>Uptime 99.97%</span>
              <span>v3.2.1</span>
            </div>
            <button
              type="button"
              onClick={() =>
                go("operations", "Monitoring & Insights-System Health")
              }
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 py-2 text-[11px] font-bold text-white"
            >
              View System Health
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0f1f]/80 px-4 backdrop-blur-xl md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black tracking-tight text-white md:text-lg">
              {meta.greeting ? `Hello, ${admin.name} 👋` : meta.title}
            </h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {meta.subtitle}
            </p>
          </div>
          <div className="relative ml-auto hidden max-w-sm flex-1 lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search users, cases, organizations, modules..."
              className="h-9 border-white/10 bg-slate-900/60 pl-10 pr-12 text-sm text-white placeholder:text-slate-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 text-[10px] text-slate-500">
              ⌘K
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
              LIVE{" "}
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              type="button"
              className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-violet-500 text-[9px] font-black text-white">
                12
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
                  {initials(admin.name)}
                </div>
                <div className="hidden leading-tight text-left lg:block">
                  <p className="text-sm font-bold text-white">{admin.name}</p>
                  <p className="text-[10px] text-slate-500">{admin.role}</p>
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
          {(
            [
              "overview",
              "approvals",
              "identities",
              "operations",
              "compliance",
            ] as SectionKey[]
          ).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                go(key, `Main-${key.charAt(0).toUpperCase()}${key.slice(1)}`)
              }
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
            {section === "overview" && <OverviewSection />}
            {section === "approvals" && <ApprovalsSection />}
            {section === "identities" && <IdentitiesSection />}
            {section === "operations" && <OperationsSection />}
            {section === "compliance" && <ComplianceSection />}
            {section === "messages" && <SecureMessagesWorkspace />}
          </div>
        </main>
      </div>
    </div>
  );
};

/* =============================== Overview =============================== */

/** Canonical case-status buckets used to turn raw `case_reports.status`
 *  values into the donut shown on the Overview screen. */
const CASE_STATUS_DISPLAY: { name: string; match: string[]; color: string }[] =
  [
    { name: "New", match: ["new", "received"], color: "#ec4899" },
    {
      name: "Under Review",
      match: ["under_review", "review"],
      color: "#8b5cf6",
    },
    { name: "Assigned", match: ["assigned"], color: "#10b981" },
    {
      name: "In Progress",
      match: ["in_progress", "open", "escalated"],
      color: "#3b82f6",
    },
    { name: "Resolved", match: ["resolved"], color: "#06b6d4" },
    { name: "Closed", match: ["closed"], color: "#a855f7" },
  ];

const OverviewSection = () => {
  const { data: sm } = useSystemMetrics({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: orgs = [] } = useOrganizations();
  const { data: regions = [] } = useRegions({ limit: 200 });
  const { data: audit = [] } = useAuditLogs({ limit: 5, staleTime: 30000 });
  const { data: alerts = [] } = useAlertsFeed({ limit: 5, staleTime: 30000 });
  const { data: cases = [] } = useCaseReports({
    limit: 1000,
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const { data: profiles = [] } = useUserProfiles();
  const { data: services = [] } = usePlatformServices({ staleTime: 30000 });
  const { data: storage = [] } = useStorageMetrics({ staleTime: 30000 });

  const systemHealth = services.length
    ? services.map((s) => ({
        name: s.name,
        icon: iconFor(s.icon),
        status: s.status,
      }))
    : ALLOW_MOCK
      ? MOCK_SYSTEM_HEALTH.map((s) => ({
          name: s.name,
          icon: s.icon,
          status: "healthy",
        }))
      : [];
  const storageRows = storage.length
    ? storage.map((s) => ({
        label: s.label,
        used: fmtTB(s.usedBytes),
        total: fmtTB(s.totalBytes),
        pct: s.totalBytes
          ? Math.round((s.usedBytes / s.totalBytes) * 1000) / 10
          : 0,
      }))
    : ALLOW_MOCK
      ? MOCK_STORAGE
      : [];

  const kpis = MOCK_KPIS_OVERVIEW.map((k) => {
    if (k.label === "Total Users" && profiles.length)
      return { ...k, value: nf.format(profiles.length) };
    if (k.label === "Active Cases") {
      const active = cases.filter(
        (c) => !["closed", "resolved"].includes((c.status || "").toLowerCase()),
      ).length;
      if (cases.length) return { ...k, value: nf.format(active) };
      if (sm?.casesProcessed != null)
        return { ...k, value: nf.format(sm.casesProcessed) };
    }
    if (k.label === "Incidents Reported") {
      if (cases.length) return { ...k, value: nf.format(cases.length) };
      if (sm?.totalIncidents != null)
        return { ...k, value: nf.format(sm.totalIncidents) };
    }
    if (k.label === "Organizations" && orgs.length)
      return { ...k, value: nf.format(orgs.length) };
    if (k.label === "System Uptime" && sm?.systemUptime != null)
      return { ...k, value: `${sm.systemUptime}%` };
    if (k.label === "AI Processed Items" && sm?.dataPointsProcessed)
      return { ...k, value: sm.dataPointsProcessed };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  // Live "Cases by Status" donut, aggregated from real case_reports rows.
  const casesByStatus = cases.length
    ? CASE_STATUS_DISPLAY.map((s) => ({
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
  const mapRegions: MapRegion[] = mockList(regions, MOCK_MAP_REGIONS);
  const activity = audit.length
    ? audit.slice(0, 5).map((a, i) => ({
        key: i,
        icon:
          a.severity === "critical"
            ? Shield
            : a.severity === "warning"
              ? AlertTriangle
              : Database,
        tone:
          a.severity === "critical"
            ? "rose"
            : a.severity === "warning"
              ? "amber"
              : "emerald",
        title: a.action,
        sub: a.description || `${a.module} · ${a.user || "system"}`,
        time: fmtRelative(a.time),
      }))
    : ALLOW_MOCK
      ? MOCK_RECENT_ACTIVITY.map((a, i) => ({ key: i, ...a }))
      : [];
  const criticalAlerts = alerts.length
    ? alerts.slice(0, 5).map((a, i) => ({
        key: i,
        sev:
          (a.status || "warning").toLowerCase() === "critical"
            ? "critical"
            : (a.status || "").toLowerCase() === "info"
              ? "info"
              : "warning",
        title: a.message || a.type,
        time: fmtRelative(a.time),
      }))
    : ALLOW_MOCK
      ? MOCK_CRITICAL_ALERTS.map((a, i) => ({ key: i, ...a }))
      : [];

  // Global Case Distribution — real incidents grouped by country.
  const distPalette = [
    "#3b82f6",
    "#6366f1",
    "#f59e0b",
    "#06b6d4",
    "#94a3b8",
    "#a855f7",
    "#10b981",
  ];
  const caseDistribution = regions.length
    ? Object.entries(
        regions.reduce<Record<string, number>>((acc, r) => {
          acc[r.country] = (acc[r.country] ?? 0) + (r.incidents ?? 0);
          return acc;
        }, {}),
      )
        .map(([name, value], i) => ({
          name,
          value,
          color: distPalette[i % distPalette.length],
        }))
        .sort((a, b) => b.value - a.value)
    : ALLOW_MOCK
      ? MOCK_CASE_REGIONS.map((r) => ({
          name: r.name,
          value: Number(String(r.value).replace(/,/g, "")),
          color: r.color,
        }))
      : [];
  const caseDistTotal = caseDistribution.reduce((s, c) => s + c.value, 0);

  // Identity & Access Overview — real aggregates from user_profiles.
  const identityOverview: {
    label: string;
    value: string;
    delta?: { dir: string; text: string };
  }[] = profiles.length
    ? [
        {
          label: "Active Users",
          value: nf.format(profiles.filter((p) => p.isActive).length),
        },
        {
          label: "Privileged Accounts",
          value: nf.format(
            profiles.filter((p) =>
              ["admin", "analyst"].includes((p.role || "").toLowerCase()),
            ).length,
          ),
        },
        {
          label: "MFA Enabled",
          value: `${Math.round((profiles.filter((p) => p.mfaEnabled).length / profiles.length) * 100)}%`,
        },
        {
          label: "Pending Approvals",
          value: nf.format(
            profiles.filter(
              (p) => (p.approvalStatus || "").toLowerCase() === "pending",
            ).length,
          ),
        },
      ]
    : ALLOW_MOCK
      ? MOCK_IDENTITY_OVERVIEW.map((s) => ({
          label: s.label,
          value: s.value,
          delta: s.delta,
        }))
      : MOCK_IDENTITY_OVERVIEW.map((s) => ({ label: s.label, value: NO_DATA }));

  // Approval Queue — real pending user_profiles.
  const pendingProfiles = profiles.filter(
    (p) => (p.approvalStatus || "").toLowerCase() === "pending",
  );
  const approvalQueue = pendingProfiles.length
    ? pendingProfiles.slice(0, 3).map((p) => ({
        name: p.fullName || p.email || "New user",
        sub: `${titleCase(p.role)} · ${p.organizationName || "Unassigned"}`,
        tag: `${titleCase(p.role)} Approval`,
        tone: "amber" as const,
      }))
    : ALLOW_MOCK
      ? MOCK_APPROVAL_QUEUE_MINI
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
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
          title="Platform Activity"
          subtitle="Activity trend for the selected period"
          className="xl:col-span-2"
          action={<SelectChip label="Last 7 Days" />}
        >
          <div className="mb-3 flex flex-wrap gap-4">
            {[
              { label: "New Users", color: "#a855f7" },
              { label: "New Cases", color: "#3b82f6" },
              { label: "Incidents", color: "#ef4444" },
            ].map((l) => (
              <span
                key={l.label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400"
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: l.color }}
                />{" "}
                {l.label}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={MOCK_PLATFORM_ACTIVITY}>
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
              <Tooltip
                contentStyle={{
                  background: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  color: "#e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ display: "none" }} />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="cases"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="incidents"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="System Health"
          subtitle="All core services are operational"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-2.5">
            {systemHealth.length ? (
              systemHealth.map((s) => {
                const Icon = s.icon;
                const healthy =
                  s.status === "healthy" || s.status === "operational";
                return (
                  <div
                    key={s.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          healthy ? "text-emerald-400" : "text-amber-400",
                        )}
                      />
                      <span className="text-xs font-medium text-slate-300">
                        {s.name}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-bold",
                        healthy ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {healthy ? "Operational" : titleCase(s.status)}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-xs text-slate-500">
                No service data yet.
              </p>
            )}
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
            >
              View Full System Health
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Global Case Distribution" subtitle="Incidents by country">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
            <div className="space-y-2.5">
              {caseDistribution.length ? (
                caseDistribution.map((r) => (
                  <div key={r.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: r.color }}
                    />
                    <span className="flex-1 text-xs font-medium text-slate-300">
                      {r.name}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {r.value.toLocaleString()}
                    </span>
                    <span className="w-10 text-right text-[11px] text-slate-500">
                      (
                      {caseDistTotal
                        ? Math.round((r.value / caseDistTotal) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500">
                  No region data yet.
                </div>
              )}
            </div>
            <WorldRiskMap regions={mapRegions} height={200} />
          </div>
        </Panel>

        <Panel title="Cases by Status">
          {casesByStatus.length ? (
            <>
              <Donut
                data={casesByStatus}
                centerValue={nf.format(casesByStatusTotal)}
                centerLabel="Total"
              />
              <div className="mt-3 space-y-1.5">
                {casesByStatus.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="text-slate-300">{c.name}</span>
                    </div>
                    <span className="font-bold text-white">
                      {c.value.toLocaleString()}{" "}
                      <span className="font-medium text-slate-500">
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
            <div className="grid place-items-center py-12 text-center text-xs text-slate-500">
              No case data yet.
            </div>
          )}
        </Panel>

        <Panel
          title="AI Insights"
          subtitle="Smart insights from platform data"
          action={<LinkChip label="View all" />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MOCK_AI_INSIGHTS.map((a) => {
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
                  <p className="text-xs font-bold text-white">{a.title}</p>
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
          title="Recent Activity"
          subtitle="Live system activity feed"
          className="xl:col-span-2"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-3">
            {activity.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                      ICON_TONES[a.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {a.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {a.sub}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {a.time}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Critical System Alerts"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-3">
            {criticalAlerts.map((a) => (
              <div key={a.key} className="flex items-start gap-3">
                {a.sev === "critical" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                ) : a.sev === "info" ? (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                )}
                <p className="min-w-0 flex-1 text-xs text-slate-300">
                  {a.title}
                </p>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Quick Actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          {MOCK_QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                type="button"
                className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-left transition-colors hover:border-white/20"
              >
                <div
                  className={cn(
                    "mb-2 grid h-9 w-9 place-items-center rounded-lg border",
                    ICON_TONES[a.tone],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-black text-white">{a.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{a.desc}</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Panel
          title="Approval Queue"
          subtitle="Pending approvals"
          action={
            <Pill tone="amber">
              {pendingProfiles.length || approvalQueue.length} Pending
            </Pill>
          }
        >
          <div className="space-y-2">
            {approvalQueue.length ? (
              approvalQueue.map((q) => (
                <div
                  key={q.name}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {q.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {q.sub}
                      </p>
                    </div>
                    <Pill tone={q.tone}>{q.tag}</Pill>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                No pending approvals.
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Identity & Access Overview"
          subtitle="Access and authentication summary"
        >
          <div className="space-y-2.5">
            {identityOverview.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">
                    {s.value}
                  </span>
                  {s.delta ? (
                    <Delta dir={s.delta.dir} text={s.delta.text} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Compliance Overview"
          subtitle="Platform compliance status"
        >
          <div className="space-y-2.5">
            {MOCK_COMPLIANCE_OVERVIEW.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                        ICON_TONES[c.tone],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {c.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                  <Pill tone="emerald">Compliant</Pill>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Storage & Usage" subtitle="Platform resource utilization">
          <div className="space-y-4">
            {storageRows.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{s.label}</span>
                  <span className="text-slate-400">
                    {s.used} / {s.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] text-slate-500">
                  {s.pct}%
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
};

/* =============================== Approvals =============================== */

const ApprovalsSection = () => {
  const { data: profiles = [] } = useUserProfiles();
  const pending = profiles.filter(
    (p) => (p.approvalStatus ?? "").toLowerCase() === "pending",
  );

  const approvalKpis = MOCK_APPROVAL_KPIS.map((k) => {
    if (k.label === "Pending Approvals")
      return { ...k, value: nf.format(pending.length) };
    if (k.label === "Identity Verifications" && profiles.length)
      return { ...k, value: nf.format(pending.length) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
  });

  const approvalRows = pending.length
    ? pending.map((p) => ({
        type: `${titleCase(p.role)} Access Request`,
        typeSub: "Account access request",
        icon: UserCog,
        by: p.fullName || p.username || "New user",
        email: p.email || "—",
        org: p.organizationName || "Unassigned",
        orgSub: p.jobTitle || titleCase(p.role),
        priority: "Medium",
        submitted: p.createdAt ? fmtDateTime(p.createdAt).split(",")[0] : "—",
        time: p.createdAt ? fmtRelative(p.createdAt) : "",
      }))
    : ALLOW_MOCK
      ? MOCK_APPROVAL_ROWS
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {approvalKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={k.delta}
            sub="vs last 7 days"
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Panel
          title="Pending Approval Queue"
          subtitle="Review and take action on pending approval requests"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <SelectChip label="All Types" />
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
              >
                <Filter className="h-3.5 w-3.5" /> Filters
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Request Type</th>
                  <th className="px-5 py-3">Requested By</th>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {approvalRows.map((r, i) => {
                  const Icon = r.icon;
                  return (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{r.type}</p>
                            <p className="text-[10px] text-slate-500">
                              {r.typeSub}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{r.by}</p>
                        <p className="text-[10px] text-slate-500">{r.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{r.org}</p>
                        <p className="text-[10px] text-slate-500">{r.orgSub}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              r.priority === "High"
                                ? "bg-rose-500"
                                : r.priority === "Medium"
                                  ? "bg-amber-500"
                                  : "bg-sky-500",
                            )}
                          />
                          <span className="text-xs text-slate-300">
                            {r.priority}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-slate-300">{r.submitted}</p>
                        <p className="text-[10px] text-slate-500">{r.time}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone="amber">Pending</Pill>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-500">
              Showing {approvalRows.length ? 1 : 0} to {approvalRows.length} of{" "}
              {approvalRows.length} requests
            </span>
            <Pagination />
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Recent Decisions"
            subtitle="Latest approval actions taken"
            action={<LinkChip label="View all" />}
          >
            <div className="space-y-3">
              {MOCK_RECENT_DECISIONS.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {d.status === "Approved" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : d.status === "Denied" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-white">
                        {d.title}
                      </p>
                      <Pill tone={statusPillTone(d.status)}>{d.status}</Pill>
                    </div>
                    <p className="truncate text-[10px] text-slate-500">
                      by {d.by} · {d.org}
                    </p>
                    <p className="text-[10px] text-slate-600">{d.time}</p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="w-full text-center text-[11px] font-bold text-violet-400 hover:text-violet-300"
              >
                View All Decisions
              </button>
            </div>
          </Panel>

          <Panel
            title="Quick Review Checklist"
            subtitle="Use this checklist to ensure complete review"
          >
            <ul className="space-y-2.5">
              {MOCK_CHECKLIST.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center gap-2.5 text-xs text-slate-300"
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded border",
                      c.done
                        ? "border-violet-500 bg-violet-500 text-white"
                        : "border-white/20",
                    )}
                  >
                    {c.done ? <Check className="h-3 w-3" /> : null}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full text-center text-[11px] font-bold text-violet-400 hover:text-violet-300"
            >
              View Approval Guidelines
            </button>
          </Panel>
        </div>
      </section>
    </>
  );
};

/* =============================== Identities =============================== */

const IdentitiesSection = () => {
  // Live counts drive the KPI strip; the detailed roster below stays on
  // sample data until the directory schema exposes email / last-active.
  const { data: profiles = [] } = useUserProfiles();
  const kpis = MOCK_IDENTITY_KPIS.map((k) => {
    if (!profiles.length) return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
    if (k.label === "Total Identities")
      return { ...k, value: nf.format(profiles.length) };
    if (k.label === "MFA Enabled") {
      const n = profiles.filter((p) => p.mfaEnabled).length;
      return {
        ...k,
        value: nf.format(n),
        sub: `${Math.round((n / profiles.length) * 100)}% of total identities`,
      };
    }
    if (k.label === "Pending Verification")
      return {
        ...k,
        value: nf.format(
          profiles.filter(
            (p) => (p.approvalStatus ?? "").toLowerCase() === "pending",
          ).length,
        ),
      };
    if (k.label === "Suspended Accounts")
      return {
        ...k,
        value: nf.format(profiles.filter((p) => !p.isActive).length),
      };
    return k;
  });

  // Real roster rows from user_profiles (email/org now mapped from the table).
  const identityRows = profiles.length
    ? profiles.map((p) => ({
        name: p.fullName || p.username || "Unnamed user",
        email: p.email || p.username || "—",
        role: titleCase(p.role),
        org: p.organizationName || "—",
        status: !p.isActive
          ? "Suspended"
          : (p.approvalStatus ?? "").toLowerCase() === "pending"
            ? "Pending"
            : "Verified",
        active: p.updatedAt
          ? fmtDateTime(p.updatedAt)
          : p.createdAt
            ? fmtDateTime(p.createdAt)
            : "—",
      }))
    : ALLOW_MOCK
      ? MOCK_IDENTITIES
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            delta={"delta" in k ? k.delta : undefined}
            sub={k.sub}
          />
        ))}
      </section>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name, email, or username..."
              className="h-9 border-white/10 bg-slate-900/60 pl-10 text-sm text-white placeholder:text-slate-500"
            />
          </div>
          <SelectChip label="All Organizations" />
          <SelectChip label="All Roles" />
          <SelectChip label="All Statuses" />
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
          >
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>
          <button
            type="button"
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add Identity
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={tableHead}>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Organization</th>
                <th className="px-5 py-3">Identity Status</th>
                <th className="px-5 py-3">Last Active</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {identityRows.map((u, i) => {
                const suspended = u.status === "Suspended";
                const pending = u.status === "Pending";
                return (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-black text-white">
                          {initials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">
                            {u.name}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-violet-300">
                      {u.role}
                    </td>
                    <td className="px-5 py-3 text-slate-300">{u.org}</td>
                    <td className="px-5 py-3">
                      <Pill tone={statusPillTone(u.status)}>
                        {pending ? "Pending Verification" : u.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{u.active}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionBtn icon={Eye} label="View" tone="sky" />
                        {pending || suspended ? (
                          <ActionBtn
                            icon={ShieldCheck}
                            label="Verify"
                            tone="sky"
                            disabled={suspended}
                          />
                        ) : (
                          <ActionBtn icon={KeyRound} label="Reset" tone="sky" />
                        )}
                        {suspended ? (
                          <ActionBtn
                            icon={UserPlus}
                            label="Activate"
                            tone="violet"
                          />
                        ) : (
                          <ActionBtn icon={Lock} label="Suspend" tone="rose" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            Showing {identityRows.length ? 1 : 0} to {identityRows.length} of{" "}
            {nf.format(identityRows.length)} identities
          </span>
          <Pagination />
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Access Recovery Requests"
          subtitle="Users requesting access or account recovery"
          bodyClassName="p-0"
          action={<LinkChip label="View all" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_RECOVERY.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{r.name}</p>
                      <p className="text-[10px] text-slate-500">{r.org}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{r.requested}</td>
                    <td className="px-5 py-3 text-slate-300">{r.reason}</td>
                    <td className="px-5 py-3">
                      <Pill tone={statusPillTone(r.status)}>{r.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View All Requests
          </p>
        </Panel>

        <Panel
          title="Verification Alerts"
          subtitle="Identities requiring attention or verification"
          bodyClassName="p-0"
          action={<LinkChip label="View all" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Alert</th>
                  <th className="px-5 py-3">Triggered</th>
                  <th className="px-5 py-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_VERIFICATION_ALERTS.map((a, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{a.name}</p>
                      <p className="text-[10px] text-slate-500">{a.org}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{a.alert}</td>
                    <td className="px-5 py-3 text-slate-400">{a.triggered}</td>
                    <td className="px-5 py-3">
                      <Pill tone={statusPillTone(a.severity)}>
                        {a.severity}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View All Alerts
          </p>
        </Panel>
      </section>
    </>
  );
};

/* =============================== Operations =============================== */

const OperationsSection = () => {
  const { data: audit = [] } = useAuditLogs({ limit: 5, staleTime: 30000 });
  const { data: services = [] } = usePlatformServices({ staleTime: 30000 });
  const { data: gateways = [] } = useCommunicationGateways({
    staleTime: 30000,
  });
  const { data: partners = [] } = usePartnerIntegrations({ staleTime: 30000 });
  const { data: jobs = [] } = useScheduledJobs({ staleTime: 30000 });

  const opsKpis = MOCK_OPS_KPIS.map((k) => {
    if (k.label === "Active Services" && services.length)
      return {
        ...k,
        value: `${services.filter((s) => s.status === "healthy").length} / ${services.length}`,
      };
    if (k.label === "Connected Partners" && partners.length)
      return { ...k, value: nf.format(partners.length) };
    if (k.label === "Gateway Status" && gateways.length)
      return {
        ...k,
        value: `${gateways.filter((g) => g.status === "operational").length} / ${gateways.length}`,
      };
    if (k.label === "Scheduled Tasks" && jobs.length)
      return { ...k, value: nf.format(jobs.length) };
    return ALLOW_MOCK ? k : { ...k, value: NO_DATA, deltaText: undefined };
  });

  const serviceRows = services.length
    ? services.map((s) => ({
        name: s.name,
        desc: s.description,
        icon: iconFor(s.icon),
        uptime: `${s.uptime}%`,
        status: s.status,
      }))
    : ALLOW_MOCK
      ? MOCK_SERVICES.map((s) => ({
          name: s.name,
          desc: s.desc,
          icon: s.icon,
          uptime: s.uptime,
          status: "healthy",
        }))
      : [];
  const gatewayRows = gateways.length
    ? gateways.map((g) => ({
        name: g.name,
        desc: g.description,
        icon: iconFor(g.icon),
        latency: `${g.latencyMs}ms`,
        messages: nf.format(g.messages24h),
      }))
    : ALLOW_MOCK
      ? MOCK_GATEWAYS.map((g) => ({
          name: g.name,
          desc: g.desc,
          icon: g.icon,
          latency: g.latency,
          messages: g.messages,
        }))
      : [];
  const partnerRows = partners.length
    ? partners.map((p) => ({
        name: p.name,
        desc: p.description,
        sync: p.lastSyncAt ? fmtRelative(p.lastSyncAt) : "—",
        status: titleCase(p.status),
        records: nf.format(p.records),
      }))
    : ALLOW_MOCK
      ? MOCK_PARTNERS
      : [];
  const jobRows = jobs.length
    ? jobs.map((j) => ({
        name: j.name,
        type: j.jobType,
        typeTone:
          j.jobType === "Backup"
            ? "emerald"
            : j.jobType === "Processing"
              ? "violet"
              : j.jobType === "Report"
                ? "amber"
                : "sky",
        freq: j.frequency,
        next: j.nextRunAt ? fmtDateTime(j.nextRunAt) : "—",
        last: j.lastRunAt ? fmtRelative(j.lastRunAt) : "—",
      }))
    : ALLOW_MOCK
      ? MOCK_JOBS
      : [];

  const opsActivity = audit.length
    ? audit.slice(0, 5).map((a, i) => {
        const tone =
          a.severity === "critical"
            ? "rose"
            : a.severity === "warning"
              ? "amber"
              : a.severity === "info"
                ? "sky"
                : "emerald";
        const tag =
          a.severity === "critical"
            ? "Critical"
            : a.severity === "warning"
              ? "Warning"
              : a.severity === "info"
                ? "Info"
                : "Success";
        return {
          key: i,
          time: fmtRelative(a.time),
          title: a.action,
          sub: a.description || `${a.module} · ${a.user || "system"}`,
          tag,
          tone,
        };
      })
    : ALLOW_MOCK
      ? MOCK_OPS_ACTIVITY.map((a, i) => ({ key: i, ...a }))
      : [];

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {opsKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            deltaText={k.deltaText}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Service Control"
          subtitle="Manage core platform services"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {serviceRows.map((s) => {
                  const Icon = s.icon;
                  return (
                    <tr key={s.name} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-violet-300" />
                          <div>
                            <p className="font-bold text-white">{s.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {s.desc}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Pill
                          tone={s.status === "healthy" ? "emerald" : "amber"}
                        >
                          {titleCase(s.status)}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-300">
                        {s.uptime}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View All Services
          </p>
        </Panel>

        <Panel
          title="Communications Gateway"
          subtitle="Monitor external communication channels"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Gateway</th>
                  <th className="px-5 py-3">Latency</th>
                  <th className="px-5 py-3 text-right">24h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {gatewayRows.map((g) => {
                  const Icon = g.icon;
                  return (
                    <tr key={g.name} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="font-bold text-white">{g.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {g.desc}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{g.latency}</td>
                      <td className="px-5 py-3 text-right font-medium text-white">
                        {g.messages}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View Gateway Details
          </p>
        </Panel>

        <Panel
          title="Partner Sync Status"
          subtitle="Real-time partner integration status"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Partner</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {partnerRows.map((p) => (
                  <tr key={p.name} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {p.desc} · {p.sync}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusPillTone(p.status)}>{p.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-white">
                      {p.records}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View All Partner Integrations
          </p>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Scheduled Jobs / Maintenance Tasks"
          subtitle="Manage automated jobs and maintenance routines"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-5 py-3">Job Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Next Run</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobRows.map((j) => (
                  <tr key={j.name} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{j.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {j.freq} · last {j.last}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={j.typeTone}>{j.type}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{j.next}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <Pill tone="sky">Scheduled</Pill>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 py-3 text-center text-[11px] font-bold text-violet-400">
            View All Scheduled Jobs
          </p>
        </Panel>

        <Panel
          title="Recent Operational Activity"
          subtitle="Latest system operations and activities"
        >
          <div className="space-y-4">
            {opsActivity.map((a, i) => (
              <div key={a.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      a.tone === "emerald"
                        ? "bg-emerald-400"
                        : a.tone === "amber"
                          ? "bg-amber-400"
                          : a.tone === "rose"
                            ? "bg-rose-400"
                            : "bg-sky-400",
                    )}
                  />
                  {i < opsActivity.length - 1 ? (
                    <span className="mt-1 h-8 w-px bg-white/10" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500">
                      {a.time}
                    </span>
                    <Pill tone={a.tone}>{a.tag}</Pill>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-bold text-white">
                    {a.title}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{a.sub}</p>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="w-full text-center text-[11px] font-bold text-violet-400 hover:text-violet-300"
            >
              View All Activity
            </button>
          </div>
        </Panel>
      </section>
    </>
  );
};

/* =============================== Compliance =============================== */

const ComplianceSection = () => {
  const { data: deletions = [] } = useDeletionRequests({
    limit: 20,
    staleTime: 30000,
  });
  const dataRights = deletions.length
    ? deletions.slice(0, 5).map((d) => ({
        id: d.id ? `DR-${d.id.slice(0, 8).toUpperCase()}` : "DR-—",
        type: "Deletion",
        typeTone: "rose",
        requester: d.survivorId || d.userId || "Unknown",
        email: d.reason || "—",
        status: titleCase(d.status || "Pending"),
        submitted: d.requestedAt ? fmtDateTime(d.requestedAt) : "—",
        due: d.processedAt ? fmtDateTime(d.processedAt) : "—",
        assignee: d.processedBy || "Unassigned",
        initials: initials(d.processedBy || "NA"),
      }))
    : ALLOW_MOCK
      ? MOCK_DATA_RIGHTS
      : [];
  const openRequests = deletions.length
    ? deletions.filter(
        (d) =>
          !["completed", "approved", "rejected", "denied"].includes(
            (d.status || "").toLowerCase(),
          ),
      ).length
    : null;

  const { data: standards = [] } = useComplianceStandards({ staleTime: 30000 });
  const { data: consent = [] } = useConsentMetrics({ staleTime: 30000 });
  const { data: consentCats = [] } = useConsentCategories({ staleTime: 30000 });

  const standardsRows = standards.length
    ? standards.map((s) => ({
        name: s.name,
        desc: s.description,
        pct: s.score,
        status: titleCase(s.status.replace(/_/g, " ")),
        statusTone: (s.status === "compliant" ? "emerald" : "amber") as
          | "emerald"
          | "amber",
        barColor: s.color,
      }))
    : ALLOW_MOCK
      ? MOCK_STANDARDS
      : [];
  const consentData = consent.length
    ? consent.map((c) => ({ name: c.name, value: c.value, color: c.color }))
    : ALLOW_MOCK
      ? MOCK_CONSENT.map((c) => ({
          name: c.name,
          value: c.value,
          color: c.color,
        }))
      : [];
  const consentTotal = consentData.reduce((s, c) => s + c.value, 0);
  const consentCatTotal = consentCats.reduce((s, c) => s + c.value, 0);
  const consentCatRows = consentCats.length
    ? consentCats.map((c) => ({
        name: c.name,
        value: nf.format(c.value),
        pct: consentCatTotal
          ? `${((c.value / consentCatTotal) * 100).toFixed(1)}%`
          : "0%",
      }))
    : ALLOW_MOCK
      ? MOCK_CONSENT_CATEGORIES
      : [];

  const findStandard = (kw: string) =>
    standards.find((s) => s.name.toLowerCase().includes(kw));

  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {MOCK_COMPLIANCE_KPIS.map((k) => {
          if (k.label === "Open Data Requests")
            return openRequests != null
              ? { ...k, value: nf.format(openRequests) }
              : ALLOW_MOCK
                ? k
                : { ...k, value: NO_DATA };
          if (k.label === "Consent Records" && consentTotal)
            return { ...k, value: nf.format(consentTotal) };
          if (k.label === "POPIA Status") {
            const s = findStandard("popia");
            if (s)
              return {
                ...k,
                value: titleCase(s.status.replace(/_/g, " ")),
                note: `${s.score}% requirements met`,
              };
          }
          if (k.label === "GDPR Status") {
            const s = findStandard("gdpr");
            if (s)
              return {
                ...k,
                value: titleCase(s.status.replace(/_/g, " ")),
                note: `${s.score}% requirements met`,
              };
          }
          return ALLOW_MOCK ? k : { ...k, value: NO_DATA };
        }).map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-md"
          >
            <KpiCardInner k={k} />
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
            >
              View Details
            </button>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Panel
          title="Data Rights Requests"
          subtitle="Track and manage data subject rights requests"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <SelectChip label="All Request Types" />
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/5"
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
                  <th className="px-5 py-3">Request ID</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Requester</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dataRights.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                      {r.id}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={r.typeTone}>{r.type}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{r.requester}</p>
                      <p className="text-[10px] text-slate-500">{r.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusPillTone(r.status)}>{r.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{r.due}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/20 text-[9px] font-black text-violet-300">
                          {r.initials}
                        </span>
                        <span className="text-xs text-slate-300">
                          {r.assignee}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <span className="text-[11px] text-slate-500">
              Showing 1 to 5 of 23 requests
            </span>
            <Pagination pages={["1", "2", "3", "4", "5"]} />
          </div>
        </Panel>

        <Panel
          title="Compliance Standards"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-4">
            {standardsRows.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">
                      {s.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {s.desc}
                    </p>
                  </div>
                  <Pill tone={s.statusTone}>{s.status}</Pill>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.pct}%`, background: s.barColor }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {s.pct}%
                  </span>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="mt-1 w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
            >
              View Full Compliance Report
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Panel
          title="Consent Management Overview"
          subtitle="Summary of consent status across the platform"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Donut
                data={consentData}
                centerValue={nf.format(consentTotal)}
                centerLabel="Total"
              />
              <div className="mt-3 space-y-1.5">
                {consentData.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="text-slate-300">{c.name}</span>
                    </div>
                    <span className="font-bold text-white">
                      {c.value.toLocaleString()}{" "}
                      <span className="font-medium text-slate-500">
                        (
                        {consentTotal
                          ? ((c.value / consentTotal) * 100).toFixed(1)
                          : 0}
                        %)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="mb-3 text-xs font-bold text-white">
                Top Consent Categories
              </p>
              <div className="space-y-2.5">
                {consentCatRows.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-300">{c.name}</span>
                    <span className="font-bold text-white">
                      {c.value}{" "}
                      <span className="font-medium text-slate-500">
                        ({c.pct})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-white/10 py-2 text-[11px] font-bold text-violet-400 hover:bg-white/5"
              >
                View All Categories
              </button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Recent Compliance Activity"
          action={<LinkChip label="View all" />}
        >
          <div className="space-y-3">
            {MOCK_COMPLIANCE_ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-start gap-2.5">
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
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {a.time}
                  </span>
                </div>
              );
            })}
            <button
              type="button"
              className="w-full text-center text-[11px] font-bold text-violet-400 hover:text-violet-300"
            >
              View All Activity
            </button>
          </div>
        </Panel>
      </section>
    </>
  );
};

const KpiCardInner = ({
  k,
}: {
  k: {
    label: string;
    value: string;
    icon: ComponentType<{ className?: string }>;
    tone: string;
    note?: string;
    delta?: { dir: string; text: string };
  };
}) => {
  const Icon = k.icon;
  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2",
          ICON_TONES[k.tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {k.label}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-black",
            k.value === "Compliant" ? "text-emerald-300" : "text-white",
          )}
        >
          {k.value}
        </p>
        {k.delta ? (
          <div className="mt-0.5">
            <Delta dir={k.delta.dir} text={k.delta.text} sub="vs last 7 days" />
          </div>
        ) : k.note ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
            {k.note}
          </p>
        ) : null}
      </div>
    </div>
  );
};

/* ============================== Small UI bits ============================== */

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
    className="text-[11px] font-bold text-violet-400 hover:text-violet-300"
  >
    {label}
  </button>
);

const ActionBtn = ({
  icon: Icon,
  label,
  tone,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    className={cn(
      "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-40",
      tone === "rose"
        ? "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
        : tone === "violet"
          ? "border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
          : "border-sky-500/30 text-sky-300 hover:bg-sky-500/10",
    )}
  >
    <Icon className="h-3 w-3" /> {label}
  </button>
);

const Pagination = ({ pages = ["1"] }: { pages?: string[] }) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-500 hover:bg-white/5"
    >
      <ChevronsLeft className="h-3.5 w-3.5" />
    </button>
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
    <button
      type="button"
      className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-500 hover:bg-white/5"
    >
      <ChevronsRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

export default AdminPortal;
