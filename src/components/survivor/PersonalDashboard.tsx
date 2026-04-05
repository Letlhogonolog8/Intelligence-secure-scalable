import React, { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsFeed, useUserProfile } from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { useAppStore } from "@/store/appStore";
import { dedupeBy } from "@/lib/dashboardMetrics";
import { SafetyPlanCard } from "@/components/survivor/cards/SafetyPlanCard";
import { AppointmentCard } from "@/components/survivor/cards/AppointmentCard";
import { TrustedContactsCard } from "@/components/survivor/cards/TrustedContactsCard";
import { DocumentVaultCard } from "@/components/survivor/cards/DocumentVaultCard";
import {
  useActivityPresenceSummary,
  useDocumentVaultSummary,
  useLiveActivitySummary,
  useSafetyPlanSummary,
  useSecureMessagesSummary,
  useSupportRequestsSummary,
  useTrustedContactsSummary,
  useUpcomingAppointmentSummary,
} from "@/hooks/survivor/usePersonalDashboardSummaries";

const PersonalDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setActiveModule } = useAppStore();
  const { data: profile, isLoading, error: profileError } = useUserProfile(user?.id);
  const { data: alertsFeed = [], isLoading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 30000,
    limit: 6,
  });
  const { data: safetyPlanSummary, isLoading: safetyPlanLoading } = useSafetyPlanSummary(user?.id);
  const { data: appointmentSummary, isLoading: appointmentLoading } = useUpcomingAppointmentSummary(user?.id);
  const { data: trustedContactsSummary, isLoading: trustedContactsLoading } = useTrustedContactsSummary(user?.id);
  const { data: documentVaultSummary, isLoading: documentVaultLoading } = useDocumentVaultSummary(user?.id);
  const { data: supportRequestsSummary } = useSupportRequestsSummary(user?.id);
  const { data: secureMessagesSummary } = useSecureMessagesSummary(user?.id);
  const { data: liveActivitySummary } = useLiveActivitySummary(user?.id);
  const { data: activityPresenceSummary } = useActivityPresenceSummary(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = useMemo(
    () => profile?.full_name || profile?.fullName || profile?.name || "Survivor",
    [profile?.full_name, profile?.fullName, profile?.name]
  );

  const recentUpdates = useMemo(
    () => dedupeBy(alertsFeed, (entry) => `${entry.module}|${entry.type}|${entry.message}`).slice(0, 4),
    [alertsFeed]
  );

  const handleOpenSafetyPlan = useCallback(() => {
    setActiveModule("safety_plan");
  }, [setActiveModule]);

  const handleCallHotline = useCallback(() => {
    window.location.href = "tel:+2710111";
  }, []);

  const handleMessageContact = useCallback(() => {
    setActiveModule("secure_messages");
  }, [setActiveModule]);

  const handleOpenAppointments = useCallback(() => {
    setActiveModule("appointments");
  }, [setActiveModule]);

  const handleOpenTrustedContacts = useCallback(() => {
    setActiveModule("trusted_contacts");
  }, [setActiveModule]);

  const handleOpenDocumentVault = useCallback(() => {
    setActiveModule("document_vault");
  }, [setActiveModule]);

  const handleOpenSupportRequests = useCallback(() => {
    setActiveModule("support_requests");
  }, [setActiveModule]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAlerts();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAlerts]);

  if (profileError) {
    return (
      <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <ErrorState
            variant="card"
            title="Unable to load personal dashboard"
            message="Profile information could not be loaded. Retry or verify the current session state."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/14 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-rose-600/12 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:140px_140px]" />
      </div>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 relative z-10">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400/90">Personal Space</p>
              <h1 className="text-3xl font-bold tracking-tight text-white">Personal Dashboard</h1>
              <p className="text-base text-slate-300 font-medium">Welcome back, {displayName}</p>
              <div className="flex flex-wrap gap-2 pt-2" aria-live="polite">
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200" aria-label={`Support requests status: ${supportRequestsSummary.headline}`}>
                  {supportRequestsSummary.headline}
                </span>
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200" aria-label={`Secure messages status: ${secureMessagesSummary.headline}`}>
                  {secureMessagesSummary.headline}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200" aria-label={`Recent unseen activity: ${activityPresenceSummary.hasNew ? `${activityPresenceSummary.newCount} new` : "All caught up"}`}>
                  {activityPresenceSummary.hasNew ? `${activityPresenceSummary.newCount} new` : "All caught up"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={handleOpenSafetyPlan} aria-label="Open safety plan workspace">
                Update Plan
              </Button>
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20" onClick={handleOpenSupportRequests} aria-label="Open support requests workspace">
                New Support Request
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-white/15 bg-slate-950/60 shadow-xl backdrop-blur-md">
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Activity</p>
              <p className="mt-2 text-2xl font-bold text-white">{liveActivitySummary.recentEventCount}</p>
              <p className="mt-1 text-sm text-slate-400">Recent events tracked</p>
            </div>
          </Card>
          <Card className="border-white/15 bg-slate-950/60 shadow-xl backdrop-blur-md">
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Module Pulse</p>
              <p className="mt-2 text-2xl font-bold text-white">{liveActivitySummary.activeModules}</p>
              <p className="mt-1 text-sm text-slate-400">Modules active in the live feed</p>
            </div>
          </Card>
          <Card className="border-white/15 bg-slate-950/60 shadow-xl backdrop-blur-md">
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest Update</p>
              <p className="mt-2 text-sm font-semibold text-white">{liveActivitySummary.latestUpdateLabel}</p>
              <p className="mt-2 text-xs text-slate-500">{activityPresenceSummary.lastSeenLabel}</p>
            </div>
          </Card>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <SafetyPlanCard
            isLoading={isLoading || safetyPlanLoading}
            status={safetyPlanSummary.status}
            statusTone={safetyPlanSummary.statusTone}
            meta={safetyPlanSummary.meta}
            actionLabel={safetyPlanSummary.actionLabel}
            onAction={handleOpenSafetyPlan}
          />
          <AppointmentCard
            isLoading={isLoading || appointmentLoading}
            headline={appointmentSummary.headline}
            meta={appointmentSummary.meta}
            actionLabel={appointmentSummary.actionLabel}
            onAction={handleOpenAppointments}
          />
          <TrustedContactsCard
            isLoading={isLoading || trustedContactsLoading}
            headline={trustedContactsSummary.headline}
            meta={trustedContactsSummary.meta}
            actionLabel={trustedContactsSummary.actionLabel}
            onAction={handleOpenTrustedContacts}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Emergency Support</h2>
                  <p className="text-sm text-slate-300">Immediate outreach options.</p>
                </div>
                <Button size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={handleOpenTrustedContacts} aria-label="Open trusted contacts workspace">
                  View Contacts
                </Button>
              </div>
              <div className="mb-4">
                <DocumentVaultCard
                  isLoading={isLoading || documentVaultLoading}
                  headline={documentVaultSummary.headline}
                  meta={documentVaultSummary.meta}
                  actionLabel={documentVaultSummary.actionLabel}
                  onAction={handleOpenDocumentVault}
                  compact
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <span className="font-medium text-slate-200">Emergency Hotline</span>
                  <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10" onClick={handleCallHotline} aria-label="Call emergency hotline">
                    Call
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <span className="font-medium text-slate-200">Trusted Contact</span>
                  <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10" onClick={handleMessageContact} aria-label="Open secure messaging workspace">
                    Message
                  </Button>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-200">Live Support Queue</p>
                      <p className="text-sm text-slate-400 mt-1">{supportRequestsSummary.meta}</p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-rose-300 whitespace-nowrap">
                      {supportRequestsSummary.headline}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-200">Secure Inbox</p>
                      <p className="text-sm text-slate-400 mt-1">{secureMessagesSummary.meta}</p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-blue-300 whitespace-nowrap">
                      {secureMessagesSummary.headline}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Recent Updates</h2>
                  <p className="text-sm text-slate-300">System notifications.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={activityPresenceSummary.markAllSeen}
                    disabled={!activityPresenceSummary.hasNew}
                    aria-label="Mark recent updates as seen"
                  >
                    Mark seen
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={handleRefresh} disabled={refreshing} aria-label="Refresh recent updates">
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
              </div>
              {alertsError ? (
                <ErrorState
                  variant="card"
                  title="Unable to load recent updates"
                  message="Live activity could not be loaded right now. You can retry refresh or continue using the dashboard."
                />
              ) : (
                <>
              <div className="mb-6 rounded-xl border border-white/5 bg-slate-950/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">What changed recently</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {liveActivitySummary.topModules.length > 0 ? (
                    liveActivitySummary.topModules.map((item) => (
                      <span key={item.module} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                        {item.module}: {item.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No module activity yet</span>
                  )}
                </div>
              </div>
              {isLoading || alertsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full bg-slate-800/60" />
                  <Skeleton className="h-12 w-5/6 bg-slate-800/60" />
                </div>
              ) : recentUpdates.length === 0 ? (
                <div className="text-slate-500 text-sm font-bold text-center py-10 border border-dashed border-slate-800 rounded-xl uppercase tracking-widest">
                  No recent updates
                </div>
              ) : (
                <div className="space-y-3" aria-live="polite">
                  {recentUpdates.map((update) => (
                    <div key={update.id} className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-200">{update.message}</p>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 whitespace-nowrap">{update.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalDashboard;
