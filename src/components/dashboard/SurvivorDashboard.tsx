import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsFeed, useIncidentTimeSeries, useUserProfile, useSurvivorProfile, useSafetyPlan } from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import PeerSupportNetwork from "@/components/survivor/PeerSupportNetwork";
import SurvivorJourneyVisualizer from "@/components/survivor/SurvivorJourneyVisualizer";
import LegalRightsAssistant from "@/components/survivor/LegalRightsAssistant";
import { getOfflineQueueCount } from "@/lib/offlineCaseQueue";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  Heart,
  LifeBuoy,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  NotebookText,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

const VoiceIncidentReporter = lazy(() => import("@/components/survivor/VoiceIncidentReporter"));

type ToneName = "emerald" | "blue" | "violet" | "rose" | "amber";

const toneStyles: Record<ToneName, string> = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-200",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-200",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
};

const toneStylesStrong: Record<ToneName, string> = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
};

const toneBadgeStyles: Record<ToneName, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

const SurvivorSectionFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-1 backdrop-blur-xl">{children}</div>
);

const SurvivorStatusTile = ({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: ToneName;
}) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </div>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${toneBadgeStyles[tone]}`}>
        {Number(value) > 0 ? "Ready" : "Needs update"}
      </span>
    </div>
    <p className="mt-3 text-sm text-slate-300">{helper}</p>
  </div>
);

const SurvivorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { setActiveModule } = useAppStore();

  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const { data: survivorProfile } = useSurvivorProfile(user?.id);
  const { data: safetyPlan } = useSafetyPlan(survivorProfile?.id);
  const { data: alertsFeed = [] } = useAlertsFeed({ staleTime: 15000, refetchInterval: 30000, limit: 8 });
  const { data: incidentTimeSeries = [] } = useIncidentTimeSeries({ staleTime: 20000, refetchInterval: 30000 });

  const [showVoiceReporter, setShowVoiceReporter] = useState(false);
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
  const [panicMode, setPanicMode] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState(0);

  const panicTimeoutRef = useRef<number | null>(null);
  const panicIntervalRef = useRef<number | null>(null);

  const displayName = profile?.full_name || profile?.fullName || survivorProfile?.fullName || "Survivor";

  const latestSignal = incidentTimeSeries[incidentTimeSeries.length - 1];
  const pulseScore = latestSignal?.value ?? 0;
  const trendDirection = pulseScore > 70 ? "Rising" : pulseScore < 40 ? "Declining" : "Stable";

  const trustedContactsCount = safetyPlan?.trustedContacts?.length ?? 0;
  const safeLocationsCount = safetyPlan?.safeLocations?.length ?? 0;
  const emergencyResourcesCount = safetyPlan?.emergencyResources?.length ?? 0;
  const triggersCount = safetyPlan?.identifiedTriggers?.length ?? 0;
  const copingStrategiesCount = safetyPlan?.copingStrategies?.length ?? 0;

  const safetyItemsCount = [
    trustedContactsCount > 0,
    safeLocationsCount > 0,
    emergencyResourcesCount > 0,
    triggersCount > 0,
    copingStrategiesCount > 0,
  ].filter(Boolean).length;

  const safetyCoverage = Math.round((safetyItemsCount / 5) * 100);
  const safetyChecklistStatus =
    safetyItemsCount === 5
      ? t("survivor.safetyReady", "All safety protocols are active.")
      : t("survivor.safetyPending", "{{count}} critical safety sections still need updates.", {
          count: 5 - safetyItemsCount,
        });

  const profileCompletenessFields = [
    Boolean(survivorProfile?.phoneNumber),
    Boolean(survivorProfile?.emergencyContact),
    Boolean(survivorProfile?.location),
    Boolean(survivorProfile?.supportStatus),
  ];
  const profileCompleteness = Math.round((profileCompletenessFields.filter(Boolean).length / 4) * 100);

  const alertsPreview = alertsFeed.slice(0, 4);
  const criticalAlerts = alertsFeed.filter((alert) => alert.type === "critical").length;

  const aiRecommendation =
    trendDirection === "Rising"
      ? t(
          "survivor.aiAdviceRising",
          "Stress indicators are rising. Consider a check-in with support and enable your quick safety actions."
        )
      : trendDirection === "Declining"
        ? t(
            "survivor.aiAdviceDeclining",
            "Your indicators are stabilizing. Keep following your current support routine."
          )
        : t(
            "survivor.aiAdviceStable",
            "Your wellbeing trend is steady. Continue your plan and monitor any new changes."
          );

  const recoveryProgress =
    survivorProfile?.supportStatus === "recovered"
      ? 100
      : survivorProfile?.supportStatus === "active"
        ? 65
        : 30;

  const supportStatusLabel = survivorProfile?.supportStatus || "Pending";
  const emergencyContactReady = Boolean(survivorProfile?.emergencyContact);
  const locationReady = Boolean(survivorProfile?.location);
  const profileSignals = [
    {
      label: "Emergency Contact",
      value: emergencyContactReady ? "Ready" : "Missing",
      icon: Phone,
      tone: emergencyContactReady ? "emerald" : "amber",
    },
    {
      label: "Location Status",
      value: locationReady ? "Shared" : "Needed",
      icon: MapPin,
      tone: locationReady ? "blue" : "amber",
    },
    {
      label: "Recovery Track",
      value: `${recoveryProgress}%`,
      icon: RefreshCcw,
      tone: "violet",
    },
  ] as const;

  const headlineMetrics = [
    {
      label: "Wellbeing Pulse",
      value: `${pulseScore}%`,
      helper: aiRecommendation,
      badge: trendDirection,
      icon: Activity,
      tone: "blue",
    },
    {
      label: "Safety Plan Coverage",
      value: `${safetyCoverage}%`,
      helper: safetyChecklistStatus,
      badge: `${safetyItemsCount}/5`,
      icon: CheckCircle2,
      tone: "emerald",
    },
    {
      label: "Community Alerts",
      value: `${alertsFeed.length}`,
      helper: "Live local signal feed connected.",
      badge: `${criticalAlerts} critical`,
      icon: Bell,
      tone: "rose",
    },
    {
      label: "Recovery Track",
      value: `${profileCompleteness}%`,
      helper: "Profile readiness for care coordination.",
      badge: `${recoveryProgress}%`,
      icon: TrendingUp,
      tone: "violet",
    },
  ] as const;

  const inventoryItems = [
    {
      label: "Trusted Contacts",
      value: trustedContactsCount,
      tone: trustedContactsCount > 0 ? "emerald" : "amber",
      helper: trustedContactsCount > 0 ? "Support circle available." : "Add at least one trusted contact.",
    },
    {
      label: "Safe Locations",
      value: safeLocationsCount,
      tone: safeLocationsCount > 0 ? "blue" : "amber",
      helper: safeLocationsCount > 0 ? "Safe route options stored." : "Define a safe location.",
    },
    {
      label: "Emergency Resources",
      value: emergencyResourcesCount,
      tone: emergencyResourcesCount > 0 ? "rose" : "amber",
      helper: emergencyResourcesCount > 0 ? "Rapid response contacts ready." : "Add emergency resources.",
    },
    {
      label: "Coping Strategies",
      value: copingStrategiesCount,
      tone: copingStrategiesCount > 0 ? "violet" : "amber",
      helper: copingStrategiesCount > 0 ? "Recovery tools documented." : "Add a coping strategy.",
    },
  ] as const;

  const alertsStatusLabel =
    criticalAlerts > 0
      ? `${criticalAlerts} critical signal${criticalAlerts > 1 ? "s" : ""}`
      : alertsFeed.length > 0
        ? "Monitoring active"
        : "No active alerts";

  const handleCaseLookup = async () => {
    const trimmed = caseLookupId.trim();
    if (!trimmed) {
      setCaseLookupError(t("survivor.caseLookupRequired", "Enter a case ID to check status."));
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
      setCaseLookupError(t("survivor.caseLookupNotFound", "Case not found. Please verify the ID."));
      setCaseLookupLoading(false);
      return;
    }

    setCaseLookupResult(data);
    setCaseLookupLoading(false);
  };

  useEffect(() => {
    setOfflineQueue(getOfflineQueueCount());
    const updateQueue = () => setOfflineQueue(getOfflineQueueCount());
    window.addEventListener("online", updateQueue);
    window.addEventListener("storage", updateQueue);
    return () => {
      window.removeEventListener("online", updateQueue);
      window.removeEventListener("storage", updateQueue);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (panicTimeoutRef.current) {
        window.clearTimeout(panicTimeoutRef.current);
      }
      if (panicIntervalRef.current) {
        window.clearInterval(panicIntervalRef.current);
      }
    };
  }, []);

  const startPanicHold = () => {
    setHoldProgress(8);
    panicIntervalRef.current = window.setInterval(() => {
      setHoldProgress((prev) => Math.min(100, prev + 7));
    }, 120);
    panicTimeoutRef.current = window.setTimeout(() => {
      setPanicMode(true);
      setHoldProgress(100);
      if (panicIntervalRef.current) {
        window.clearInterval(panicIntervalRef.current);
      }
    }, 1800);
  };

  const cancelPanicHold = () => {
    if (panicTimeoutRef.current) {
      window.clearTimeout(panicTimeoutRef.current);
    }
    if (panicIntervalRef.current) {
      window.clearInterval(panicIntervalRef.current);
    }
    setHoldProgress(0);
  };

  if (panicMode) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-slate-700">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Daily Planner</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPanicMode(false);
                setHoldProgress(0);
              }}
            >
              Return
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4" />
                <p className="text-xs uppercase">Today</p>
              </div>
              <p className="mt-3 text-lg font-semibold">3 scheduled reminders</p>
              <p className="text-sm text-slate-500">Calendar overview</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <NotebookText className="h-4 w-4" />
                <p className="text-xs uppercase">Notes</p>
              </div>
              <p className="mt-3 text-lg font-semibold">Journal review pending</p>
              <p className="text-sm text-slate-500">Personal workspace</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Heart className="h-4 w-4" />
                <p className="text-xs uppercase">Check-in</p>
              </div>
              <p className="mt-3 text-lg font-semibold">Wellness review available</p>
              <p className="text-sm text-slate-500">Resume when safe</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_18%,rgba(59,130,246,0.22),transparent_42%),radial-gradient(circle_at_90%_12%,rgba(244,63,94,0.18),transparent_45%),linear-gradient(155deg,#050914_0%,#091225_58%,#040812_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:132px_132px]" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/15 bg-slate-950/65 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/35 bg-blue-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                {t("survivor.secureEnv", "Secure AI Environment")}
              </div>

              {profileLoading ? (
                <Skeleton className="h-12 w-64 bg-white/10" />
              ) : (
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                    {t("survivor.welcome", "Welcome back")}, {displayName}
                  </h1>
                  <p className="max-w-2xl text-base text-slate-200/90 sm:text-lg">
                    {t(
                      "survivor.profileActive",
                      "Your secure profile is live. Manage your safety plan, track updates, and reach support instantly."
                    )}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  Support status: <span className="font-semibold">{supportStatusLabel}</span>
                </div>
                <div className="rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
                  Safety plan: <span className="font-semibold">{safetyCoverage}% ready</span>
                </div>
                <div className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
                  Offline reports: <span className="font-semibold">{offlineQueue}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="h-12 bg-gradient-to-r from-rose-600 to-rose-500 px-5 font-semibold text-white hover:from-rose-500 hover:to-rose-400"
                  onClick={() => setActiveModule("survivor_support")}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("survivor.startChat", "Start Chat")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
                  onClick={() => setActiveModule("survivor_support")}
                >
                  <LifeBuoy className="mr-2 h-4 w-4 text-blue-300" />
                  {t("survivor.getHelp", "Get Help")}
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 border border-blue-500/25 bg-blue-500/10 px-5 text-blue-100 hover:bg-blue-500/15"
                  onClick={() => setActiveModule("personal_dashboard")}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {t("survivor.updatePlan", "Update Safety Plan")}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Safety brief</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Current readiness snapshot</h2>
                </div>
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-100">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {profileSignals.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/65 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl border p-2 ${toneStyles[item.tone]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-xs text-slate-400">Live profile signal</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-100">{item.value}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                {aiRecommendation}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {headlineMetrics.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="border-white/15 bg-slate-950/65 p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`rounded-xl border p-2 ${toneStylesStrong[item.tone]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${toneBadgeStyles[item.tone]}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-sm text-slate-300">{item.helper}</p>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_0.55fr]">
          <Card className="border-white/15 bg-slate-950/65 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <Search className="h-5 w-5 text-blue-300" />
              <h2 className="text-xl font-semibold text-white">{t("survivor.caseTracker", "Case Status Tracker")}</h2>
            </div>

            <div className="mb-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
              Look up your secure case reference to see official status, priority, and the latest movement without exposing extra details.
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={caseLookupId}
                onChange={(e) => {
                  setCaseLookupId(e.target.value);
                  setCaseLookupError(null);
                  setCaseLookupResult(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !caseLookupLoading) {
                    void handleCaseLookup();
                  }
                }}
                placeholder={t("survivor.caseLookupPlaceholder", "Enter secure case ID")}
                className="h-12 border-white/10 bg-slate-950/70 text-white"
              />
              <Button
                onClick={() => {
                  void handleCaseLookup();
                }}
                disabled={caseLookupLoading}
                className="h-12 min-w-[180px] bg-blue-600 font-semibold hover:bg-blue-500"
              >
                {caseLookupLoading ? t("common.analyzing", "Analyzing...") : t("survivor.trackCase", "Track Case")}
              </Button>
            </div>

            {caseLookupError && (
              <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {caseLookupError}
              </div>
            )}

            {caseLookupResult ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Status</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-300">{caseLookupResult.status}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Priority</p>
                  <p className="mt-2 text-lg font-semibold text-white">{caseLookupResult.priority}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Risk Level</p>
                  <p className="mt-2 text-lg font-semibold text-rose-300">{caseLookupResult.risk_level}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Last Update</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">
                    {caseLookupResult.updated_at
                      ? new Date(caseLookupResult.updated_at).toLocaleDateString()
                      : t("common.pending", "Pending")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-slate-300">
                {t(
                  "survivor.caseLookupHint",
                  "Use your confidential case reference to load official status updates from the secure network."
                )}
              </div>
            )}
          </Card>

          <Card className="border-white/15 bg-slate-950/65 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("survivor.quickSafety", "Quick Safety Actions")}</h3>
                <p className="mt-1 text-sm text-slate-300">Fast controls for privacy, offline reporting, and voice-based escalation.</p>
              </div>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-100">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
              <button
                type="button"
                onMouseDown={startPanicHold}
                onMouseUp={cancelPanicHold}
                onMouseLeave={cancelPanicHold}
                onTouchStart={startPanicHold}
                onTouchEnd={cancelPanicHold}
                className="w-full text-left"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                  {t("survivor.quickExit", "Quick Exit")}
                </p>
                <p className="mt-1 text-xs text-amber-100/90">{t("survivor.holdToExit", "Hold for 2 seconds")}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100/20">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${holdProgress}%` }} />
                </div>
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">Offline Queue</p>
                <p className="mt-1 text-sm font-semibold text-cyan-100">
                  {offlineQueue > 0
                    ? t("survivor.offlinePending", "{{count}} pending reports awaiting sync", { count: offlineQueue })
                    : t("survivor.offlineClear", "No pending offline reports")}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Voice Reporting</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {showVoiceReporter ? "Voice report panel is open." : "Voice incident reporting is ready."}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              className="mt-4 w-full justify-start border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              onClick={() => setShowVoiceReporter((open) => !open)}
            >
              <Mic className="mr-2 h-4 w-4 text-rose-300" />
              {showVoiceReporter
                ? t("survivor.closeVoiceReport", "Close Voice Incident Report")
                : t("survivor.openVoiceReport", "Open Voice Incident Report")}
            </Button>
          </Card>
        </section>

        {showVoiceReporter && (
          <section className="animate-in fade-in slide-in-from-top-1 duration-300">
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl bg-slate-800/40" />}>
              <VoiceIncidentReporter onReportSubmitted={() => setShowVoiceReporter(false)} />
            </Suspense>
          </section>
        )}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/15 bg-slate-950/65 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-rose-300" />
                  <h3 className="text-lg font-semibold text-white">{t("survivor.secureAlerts", "Secure Alerts")}</h3>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Localized signal monitoring for your registered zones, with critical items surfaced first.
                </p>
              </div>
              <div className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-200">
                {alertsStatusLabel}
              </div>
            </div>

            <div className="space-y-3">
              {alertsPreview.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-slate-300">
                  <p className="font-medium text-slate-100">Signal feed is clear.</p>
                  <p className="mt-1">{t("survivor.noAlerts", "No active community alerts in your registered zones.")}</p>
                </div>
              ) : (
                alertsPreview.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-xl border p-2 ${
                            alert.type === "critical"
                              ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
                              : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                          }`}
                        >
                          <Bell className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                            {alert.type || t("common.notice", "Notice")}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-100">{alert.message}</p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{alert.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/65 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-lg font-semibold text-white">{t("survivor.safetyInventory", "Safety Inventory")}</h3>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Readiness view of the items your safety plan depends on during escalation.
                </p>
              </div>
              <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                {safetyItemsCount}/5 active
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {inventoryItems.map((item) => (
                <SurvivorStatusTile
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  helper={item.helper}
                  tone={item.tone}
                />
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2">
                  <Heart className="mt-0.5 h-4 w-4 text-blue-200" />
                  <p className="text-sm text-blue-100">
                    {t(
                      "survivor.safetyPrompt",
                      "Keep your plan updated so support teams can act faster and safer if escalation is required."
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="shrink-0 border border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                  onClick={() => setActiveModule("personal_dashboard")}
                >
                  Review Plan
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-6">
          <SurvivorSectionFrame>
            <SurvivorJourneyVisualizer
              currentStage={
                caseLookupResult?.status === "resolved"
                  ? "resolution"
                  : caseLookupResult?.status === "in_review"
                    ? "court"
                    : "assigned"
              }
            />
          </SurvivorSectionFrame>
        </section>

        <section className="space-y-6">
          <SurvivorSectionFrame>
            <LegalRightsAssistant />
          </SurvivorSectionFrame>
        </section>

        <section className="space-y-6 pb-2">
          <SurvivorSectionFrame>
            <PeerSupportNetwork />
          </SurvivorSectionFrame>
        </section>
      </div>
    </div>
  );
};

export default SurvivorDashboard;
