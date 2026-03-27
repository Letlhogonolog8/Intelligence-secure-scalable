import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsFeed, useUserProfile } from "@/data/aegisData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/appStore";
import { dedupeBy } from "@/lib/dashboardMetrics";

const PersonalDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setActiveModule } = useAppStore();
  const { data: profile, isLoading } = useUserProfile(user?.id);
  const { data: alertsFeed = [], isLoading: alertsLoading, refetch: refetchAlerts } = useAlertsFeed({
    staleTime: 15000,
    refetchInterval: 30000,
    limit: 6,
  });
  const [refreshing, setRefreshing] = useState(false);

  const displayName = profile?.full_name || profile?.fullName || profile?.name || "Survivor";
  const recentUpdates = dedupeBy(alertsFeed, (entry) => `${entry.module}|${entry.type}|${entry.message}`).slice(0, 4);

  const handleOpenSupport = () => {
    setActiveModule("survivor_support");
  };

  const handleCallHotline = () => {
    window.location.href = "tel:+2710111";
  };

  const handleMessageContact = () => {
    setActiveModule("survivor_support");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchAlerts();
    setRefreshing(false);
  };

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
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" className="border-white/20 hover:bg-white/10 text-white" onClick={handleOpenSupport}>
                Update Plan
              </Button>
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20" onClick={handleOpenSupport}>
                New Support Request
              </Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="border-white/15 bg-slate-950/70 shadow-xl backdrop-blur-sm">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Safety Plan</p>
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-32 bg-slate-800/60" />
                  <Skeleton className="mt-4 h-9 w-28 bg-slate-800/60" />
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-emerald-400">Active</p>
                  <Button size="sm" className="mt-4 border-white/10 text-white" variant="outline" onClick={handleOpenSupport}>
                    Review Plan
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/70 shadow-xl backdrop-blur-sm">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Next Appointment</p>
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-24 bg-slate-800/60" />
                  <Skeleton className="mt-2 h-3 w-32 bg-slate-800/60" />
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-slate-500 italic">None Scheduled</p>
                  <p className="text-sm text-slate-400 mt-2">Check back later</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-white/15 bg-slate-950/70 shadow-xl backdrop-blur-sm">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Documents</p>
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-28 bg-slate-800/60" />
                  <Skeleton className="mt-2 h-3 w-32 bg-slate-800/60" />
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-white">0 Files</p>
                  <p className="text-sm text-slate-300 mt-2">Encrypted Vault</p>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Emergency Support</h2>
                  <p className="text-sm text-slate-300">Immediate outreach options.</p>
                </div>
                <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={handleOpenSupport}>
                  View Contacts
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <span className="font-medium text-slate-200">Emergency Hotline</span>
                  <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10" onClick={handleCallHotline}>
                    Call
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <span className="font-medium text-slate-200">Trusted Contact</span>
                  <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10" onClick={handleMessageContact}>
                    Message
                  </Button>
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
                <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
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
                <div className="space-y-3">
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalDashboard;
