import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Mic, ShieldCheck } from "lucide-react";
import { useAlertsFeed, useUserProfile } from "@/data/aegisData";
import { useLiveCaseReports, useLiveSafetyPlans, useLiveSurvivorChatSessions, useLiveSurvivors } from "@/data/liveDashboardData";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHero, DashboardPage, EmptyState, HeroBadge, ListItemCard, MetricCard, SectionCard, StatusPill } from "@/components/dashboard/DashboardPrimitives";
import { CaseStatusLookup } from "@/components/dashboard/CaseStatusLookup";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import PeerSupportNetwork from "@/components/survivor/PeerSupportNetwork";
import SurvivorJourneyVisualizer from "@/components/survivor/SurvivorJourneyVisualizer";
import LegalRightsAssistant from "@/components/survivor/LegalRightsAssistant";
import { getOfflineQueueCount } from "@/lib/offlineCaseQueue";
import { dedupeBy, formatRelativeDateTime, riskWeight } from "@/lib/dashboardMetrics";

const VoiceIncidentReporter = lazy(() => import("@/components/survivor/VoiceIncidentReporter"));

const SurvivorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { setActiveModule } = useAppStore();

  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const { data: survivorProfiles = [], isLoading: survivorLoading } = useLiveSurvivors({ userId: user?.id, staleTime: 10000, refetchInterval: 20000, limit: 5 });
  const survivorProfile = survivorProfiles[0] ?? null;
  const { data: safetyPlans = [], isLoading: plansLoading } = useLiveSafetyPlans({ survivorId: survivorProfile?.id, staleTime: 10000, refetchInterval: 20000, limit: 5 });
  const safetyPlan = safetyPlans[0] ?? null;
  const { data: caseReports = [], isLoading: caseReportsLoading } = useLiveCaseReports({ survivorId: survivorProfile?.id, staleTime: 10000, refetchInterval: 20000, limit: 10 });
  const { data: sessions = [], isLoading: sessionsLoading } = useLiveSurvivorChatSessions({ survivorId: survivorProfile?.id, staleTime: 10000, refetchInterval: 20000, limit: 20 });
  const { data: alertsFeed = [], isLoading: alertsLoading } = useAlertsFeed({ staleTime: 10000, refetchInterval: 15000, limit: 8 });

  const [showVoiceReporter, setShowVoiceReporter] = useState(false);
  const [panicMode, setPanicMode] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState(0);

  const panicTimeoutRef = useRef<number | null>(null);
  const panicIntervalRef = useRef<number | null>(null);

  const isLoadingData = profileLoading || survivorLoading || plansLoading || caseReportsLoading || sessionsLoading || alertsLoading;
  const displayName = profile?.fullName || survivorProfile?.fullName || t("survivor.defaultName", "Survivor");
  const latestCase = caseReports[0] ?? null;
  const latestSession = sessions[0] ?? null;
  const openCases = useMemo(() => caseReports.filter((entry) => !["closed", "resolved"].includes(entry.status.toLowerCase())), [caseReports]);
  const uniqueAlerts = useMemo(() => dedupeBy(alertsFeed, (entry) => `${entry.module}|${entry.type}|${entry.message}`), [alertsFeed]);
  const criticalAlerts = useMemo(() => uniqueAlerts.filter((entry) => entry.type === "critical").length, [uniqueAlerts]);
  const activeSessions = useMemo(() => sessions.filter((entry) => !entry.endedAt), [sessions]);
  const trustedContactsCount = safetyPlan?.trustedContacts?.length ?? 0;
  const safeLocationsCount = safetyPlan?.safeLocations?.length ?? 0;
  const emergencyResourcesCount = safetyPlan?.emergencyResources?.length ?? 0;
  const triggersCount = safetyPlan?.identifiedTriggers?.length ?? 0;
  const copingStrategiesCount = safetyPlan?.copingStrategies?.length ?? 0;
  const safetyCoverage = Math.round(([
    trustedContactsCount > 0,
    safeLocationsCount > 0,
    emergencyResourcesCount > 0,
    triggersCount > 0,
    copingStrategiesCount > 0,
  ].filter(Boolean).length / 5) * 100);
  const wellbeingPulse = latestCase?.riskScore ? Math.max(0, 100 - Math.round(latestCase.riskScore)) : riskWeight(survivorProfile?.currentRiskLevel);
  const riskDirection = wellbeingPulse >= 70 ? t("survivor.stable", "Stable") : wellbeingPulse >= 45 ? t("survivor.watchful", "Watchful") : t("survivor.urgent", "Needs support");
  const supportStatus = survivorProfile?.supportStatus || t("common.pending", "Pending");

  useEffect(() => {
    const updateQueue = () => setOfflineQueue(getOfflineQueueCount());
    updateQueue();
    window.addEventListener("online", updateQueue);
    window.addEventListener("storage", updateQueue);
    return () => {
      window.removeEventListener("online", updateQueue);
      window.removeEventListener("storage", updateQueue);
    };
  }, []);

  useEffect(() => () => {
    if (panicTimeoutRef.current) window.clearTimeout(panicTimeoutRef.current);
    if (panicIntervalRef.current) window.clearInterval(panicIntervalRef.current);
  }, []);

  const startPanicHold = () => {
    setHoldProgress(8);
    panicIntervalRef.current = window.setInterval(() => {
      setHoldProgress((current) => Math.min(100, current + 7));
    }, 120);
    panicTimeoutRef.current = window.setTimeout(() => {
      setPanicMode(true);
      setHoldProgress(100);
      if (panicIntervalRef.current) window.clearInterval(panicIntervalRef.current);
    }, 1800);
  };

  const cancelPanicHold = () => {
    if (panicTimeoutRef.current) window.clearTimeout(panicTimeoutRef.current);
    if (panicIntervalRef.current) window.clearInterval(panicIntervalRef.current);
    setHoldProgress(0);
  };

  if (panicMode) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-slate-700">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Daily planner</h2>
            <Button size="sm" variant="outline" onClick={() => { setPanicMode(false); setHoldProgress(0); }}>Return</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Messages</p>
              <p className="mt-3 text-lg font-semibold">{activeSessions.length} open conversations</p>
              <p className="text-sm text-slate-500">Neutral workspace summary</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reminders</p>
              <p className="mt-3 text-lg font-semibold">{openCases.length} case updates tracked</p>
              <p className="text-sm text-slate-500">Live progress snapshot</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Wellbeing</p>
              <p className="mt-3 text-lg font-semibold">{wellbeingPulse}% readiness</p>
              <p className="text-sm text-slate-500">Keep routine when safe</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardPage accent="violet">
      <DashboardHero
        eyebrow={t("survivor.secureEnv", "Secure AI environment")}
        title={`${t("survivor.welcome", "Welcome back")}, ${displayName}`}
        description={t("survivor.profileActive", "Your secure profile is live. Manage your safety plan, track updates, and reach support instantly.")}
        badges={[
          <HeroBadge key="status" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{t("survivor.supportStatus", "Support status")}: {supportStatus}</HeroBadge>,
          <HeroBadge key="safety" className="border-sky-500/20 bg-sky-500/10 text-sky-200">{safetyCoverage}% {t("survivor.safetyCoverage", "safety coverage")}</HeroBadge>,
          <HeroBadge key="offline" className="border-violet-500/20 bg-violet-500/10 text-violet-200">{offlineQueue} {t("survivor.offlineReports", "offline reports")}</HeroBadge>,
        ]}
        actions={
          <>
            <Button onClick={() => setActiveModule("survivor_support")} className="bg-rose-600 hover:bg-rose-500">
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("survivor.startChat", "Start chat")}
            </Button>
            <Button variant="outline" onClick={() => setActiveModule("personal_dashboard")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t("survivor.updatePlan", "Update safety plan")}
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("survivor.wellbeingPulse", "Wellbeing pulse")} value={`${wellbeingPulse}%`} helper={riskDirection} accent="sky" loading={isLoadingData} />
        <MetricCard label={t("survivor.activeCases", "Active cases")} value={openCases.length} helper={latestCase ? formatRelativeDateTime(latestCase.updatedAt) : t("common.pending", "Pending")} accent="rose" loading={isLoadingData} />
        <MetricCard label={t("survivor.safetyCoverage", "Safety coverage")} value={`${safetyCoverage}%`} helper={`${trustedContactsCount} ${t("survivor.contacts", "contacts")} · ${safeLocationsCount} ${t("survivor.locations", "locations")}`} accent="emerald" loading={isLoadingData} />
        <MetricCard label={t("survivor.communityAlerts", "Community alerts")} value={uniqueAlerts.length} helper={`${criticalAlerts} ${t("common.critical", "critical")}`} accent="indigo" loading={isLoadingData} />
      </section>

      {!survivorLoading && !survivorProfile ? (
        <EmptyState
          title={t("survivor.profileMissingTitle", "Profile setup is incomplete")}
            description={t("survivor.profileMissingDescription", "We could not find a linked survivor record for this account yet, so live dashboard signals are limited.")}
            guidance={[
              t("survivor.profileMissingGuidanceIdentity", "Finish profile setup so this account is linked to a survivor record."),
              t("survivor.profileMissingGuidanceRls", "If setup was completed recently, wait for the secure profile sync to refresh this view."),
            ]}
            actionLabel={t("survivor.openSupport", "Open support")}
            onAction={() => setActiveModule("survivor_support")}
        />
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title={t("survivor.caseTracker", "Case status tracker")} description={t("survivor.caseLookupHint", "Use your confidential case reference to load official status updates from the secure network.")}>
          <CaseStatusLookup
            description={t("survivor.caseLookupDescription", "Use your secure case reference to retrieve live status, priority, and most recent movement.")}
            placeholder={t("survivor.caseLookupPlaceholder", "Enter secure case ID")}
          />
        </SectionCard>

        <SectionCard title={t("survivor.quickSafety", "Quick safety actions")} description={t("survivor.quickSafetyDescription", "Fast controls for privacy, offline reporting, and voice-based escalation.")}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
              <button
                type="button"
                onMouseDown={startPanicHold}
                onMouseUp={cancelPanicHold}
                onMouseLeave={cancelPanicHold}
                onTouchStart={startPanicHold}
                onTouchEnd={cancelPanicHold}
                className="w-full text-left"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">{t("survivor.quickExit", "Quick exit")}</p>
                <p className="mt-1 text-xs text-amber-100/90">{t("survivor.holdToExit", "Hold for 2 seconds")}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100/20">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${holdProgress}%` }} />
                </div>
              </button>
            </div>
            <ListItemCard title={t("survivor.offlineQueue", "Offline queue")} subtitle={offlineQueue > 0 ? t("survivor.offlinePending", "{{count}} reports awaiting sync", { count: offlineQueue }) : t("survivor.offlineClear", "No pending offline reports")} meta={<StatusPill tone="sky">{offlineQueue}</StatusPill>} />
            <ListItemCard title={t("survivor.voiceReporting", "Voice reporting")} subtitle={showVoiceReporter ? t("survivor.voiceOpen", "Voice panel is open.") : t("survivor.voiceReady", "Voice incident reporting is ready.")} meta={<StatusPill tone="rose">live</StatusPill>} />
            <Button variant="ghost" className="w-full justify-start border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" onClick={() => setShowVoiceReporter((current) => !current)}>
              <Mic className="mr-2 h-4 w-4 text-rose-300" />
              {showVoiceReporter ? t("survivor.closeVoiceReport", "Close voice incident report") : t("survivor.openVoiceReport", "Open voice incident report")}
            </Button>
          </div>
        </SectionCard>
      </section>

      {showVoiceReporter ? (
        <section className="animate-in fade-in slide-in-from-top-1 duration-300">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl bg-slate-800/40" />}>
            <VoiceIncidentReporter onReportSubmitted={() => setShowVoiceReporter(false)} />
          </Suspense>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title={t("survivor.secureAlerts", "Secure alerts")} description={t("survivor.alertDescription", "Localized signal monitoring for your registered zones, with critical items surfaced first.")}>
          <div className="space-y-3">
            {uniqueAlerts.length === 0 ? (
              <EmptyState
                title={t("survivor.noAlertsTitle", "Signal feed is clear.")}
                description={t("survivor.noAlerts", "No active community alerts in your registered zones.")}
                guidance={[
                  t("survivor.noAlertsGuidanceRegion", "Safety notices appear here when your area or care network reports a new concern."),
                  t("survivor.noAlertsGuidanceRls", "If someone just updated your case or support plan, refresh after the next secure sync."),
                ]}
              />
            ) : (
              uniqueAlerts.slice(0, 4).map((entry) => (
                <ListItemCard
                  key={entry.id}
                  title={entry.message}
                  subtitle={`${entry.module || t("common.notice", "Notice")} · ${entry.time}`}
                  meta={<StatusPill tone={entry.type === "critical" ? "rose" : "amber"}>{entry.type || t("common.notice", "Notice")}</StatusPill>}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title={t("survivor.safetyInventory", "Safety inventory")} description={t("survivor.inventoryDescription", "Readiness view of the items your safety plan depends on during escalation.")}>
          {!plansLoading && !safetyPlan ? (
            <EmptyState
              title={t("survivor.planMissingTitle", "No safety plan on file")}
              description={t("survivor.planMissingDescription", "Your dashboard is live, but a safety plan has not been created for this survivor profile yet.")}
              guidance={[
                t("survivor.planMissingGuidanceCreate", "Create your first safety plan to unlock trusted contacts, safe places, and coping steps."),
                t("survivor.planMissingGuidanceSync", "If a plan was just saved, wait for the secure sync to refresh the dashboard."),
              ]}
              actionLabel={t("survivor.reviewPlan", "Review plan")}
              onAction={() => setActiveModule("personal_dashboard")}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [t("survivor.trustedContacts", "Trusted contacts"), trustedContactsCount, trustedContactsCount > 0 ? "emerald" : "amber"],
                [t("survivor.safeLocations", "Safe locations"), safeLocationsCount, safeLocationsCount > 0 ? "sky" : "amber"],
                [t("survivor.emergencyResources", "Emergency resources"), emergencyResourcesCount, emergencyResourcesCount > 0 ? "rose" : "amber"],
                [t("survivor.copingStrategies", "Coping strategies"), copingStrategiesCount, copingStrategiesCount > 0 ? "indigo" : "amber"],
              ].map(([label, value, tone]) => (
                <ListItemCard key={String(label)} title={label as string} subtitle={t("survivor.livePlanSignal", "Live safety-plan signal")} meta={<StatusPill tone={tone as "emerald" | "sky" | "rose" | "indigo" | "amber"}>{value as number}</StatusPill>} />
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" onClick={() => setActiveModule("personal_dashboard")}>{t("survivor.reviewPlan", "Review plan")}</Button>
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title={t("survivor.supportSessions", "Support activity")} description={t("survivor.supportActivityDescription", "Live counseling activity and case progression from your secure support records.")}>
          <div className="space-y-3">
            <ListItemCard title={t("survivor.openSessions", "Open sessions")} subtitle={latestSession ? formatRelativeDateTime(latestSession.updatedAt ?? latestSession.createdAt) : t("common.pending", "Pending")} meta={<StatusPill tone="sky">{activeSessions.length}</StatusPill>} />
            <ListItemCard title={t("survivor.latestCase", "Latest case update")} subtitle={latestCase ? formatRelativeDateTime(latestCase.updatedAt) : t("common.pending", "Pending")} meta={<StatusPill tone={latestCase?.priority === "critical" ? "rose" : "amber"}>{latestCase?.priority || t("common.pending", "Pending")}</StatusPill>} />
            <ListItemCard title={t("survivor.supportStatus", "Support status")} subtitle={survivorProfile?.location || t("survivor.locationPending", "Location not yet shared")} meta={<StatusPill tone="emerald">{supportStatus}</StatusPill>} />
          </div>
        </SectionCard>

        <SectionCard title={t("survivor.recoveryPath", "Recovery path")} description={t("survivor.recoveryPathDescription", "Journey milestones based on your live case status and support activity.")}>
          <SurvivorJourneyVisualizer
            currentStage={latestCase?.status === "resolved" ? "resolution" : latestCase?.status === "in_review" ? "court" : latestCase ? "assigned" : "reporting"}
          />
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title={t("survivor.legalRights", "Legal rights assistant")} description={t("survivor.legalRightsDescription", "Guided rights information available in your current secure session.")}>
          <LegalRightsAssistant />
        </SectionCard>
        <SectionCard title={t("survivor.peerSupport", "Peer support network")} description={t("survivor.peerSupportDescription", "Secure community pathways and mutual-support options.")}>
          <PeerSupportNetwork />
        </SectionCard>
      </section>
    </DashboardPage>
  );
};

export default SurvivorDashboard;
