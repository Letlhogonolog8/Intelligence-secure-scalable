import { lazy, Suspense } from "react";
import { MODULE_METADATA, ModuleType } from "@/data/aegisData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { useSurvivorWorkspaceSummaries } from "@/hooks/survivor/usePersonalDashboardSummaries";

const EvidenceVault = lazy(() => import("@/components/survivor/EvidenceVault"));

interface SurvivorFeatureWorkspaceProps {
  module: Extract<
    ModuleType,
    "safety_plan" | "appointments" | "trusted_contacts" | "document_vault" | "support_requests" | "secure_messages"
  >;
}

const featureHighlights: Record<SurvivorFeatureWorkspaceProps["module"], string[]> = {
  safety_plan: ["Review plan readiness", "Update safe actions", "Verify emergency contacts"],
  appointments: [
    "Bring any case notes you need",
    "Confirm time and channel before attending",
    "Request a follow-up if your schedule changes",
  ],
  trusted_contacts: ["Manage primary contacts", "Prepare fast outreach", "Review emergency availability"],
  document_vault: ["Review secure files", "Prepare uploads", "Keep sensitive evidence organized"],
  support_requests: ["Open new requests", "Monitor request progress", "Track follow-up actions"],
  secure_messages: ["Open private conversations", "Review communication history", "Respond to support outreach"],
};

const SurvivorFeatureWorkspace: React.FC<SurvivorFeatureWorkspaceProps> = ({ module }) => {
  const { user } = useAuth();
  const { setActiveModule } = useAppStore();
  const metadata = MODULE_METADATA[module];
  const {
    safetyPlanSummary,
    appointmentSummary,
    trustedContactsSummary,
    documentVaultSummary,
    supportRequestsSummary,
    secureMessagesSummary,
    modulePulseSummary,
  } = useSurvivorWorkspaceSummaries(module, user?.id);

  const isAppointmentsModule = module === "appointments";
  const appointmentStatusLabel = appointmentSummary.hasUpcoming ? "Scheduled" : "No appointment";
  const appointmentStatusVariant = appointmentSummary.hasUpcoming ? "success" : "secondary";

  const summaryContent =
    module === "safety_plan"
      ? {
          title: "Current Safety Plan Status",
          primary: safetyPlanSummary.status,
          secondary: `${safetyPlanSummary.completionPercent}% complete`,
          detail: `${safetyPlanSummary.meta}. ${safetyPlanSummary.lastUpdatedLabel}`,
        }
      : module === "appointments"
        ? {
            title: "Next Appointment",
            primary: appointmentSummary.headline,
            secondary: appointmentSummary.hasUpcoming ? "Upcoming support session" : "No appointment scheduled",
            detail: appointmentSummary.meta,
          }
        : module === "trusted_contacts"
          ? {
              title: "Trusted Contacts Snapshot",
              primary: trustedContactsSummary.headline,
              secondary: trustedContactsSummary.total > 0 ? "Emergency outreach path available" : "No trusted contact on file",
              detail: trustedContactsSummary.meta,
            }
          : module === "document_vault"
            ? {
                title: "Document Vault Snapshot",
                primary: documentVaultSummary.headline,
                secondary: documentVaultSummary.vaultState === "ready" ? "Vault activity detected" : "Vault is empty",
                detail: documentVaultSummary.meta,
              }
            : module === "support_requests"
              ? {
                  title: "Support Requests Snapshot",
                  primary: supportRequestsSummary.headline,
                  secondary: supportRequestsSummary.openCount > 0 ? "Live support activity detected" : "No active requests",
                  detail: supportRequestsSummary.meta,
                }
              : module === "secure_messages"
                ? {
                    title: "Secure Messages Snapshot",
                    primary: secureMessagesSummary.headline,
                    secondary: secureMessagesSummary.unreadCount > 0 ? "Unread communication available" : "Inbox is clear",
                    detail: secureMessagesSummary.meta,
                  }
                : null;

  const pulseContent = isAppointmentsModule
    ? {
        title: "Recent Updates",
        emptyHeadline: "No recent updates",
        emptyMeta: "There are no new appointment changes right now.",
      }
    : {
        title: "Live Pulse",
        emptyHeadline: "No live signals",
        emptyMeta: "No recent activity detected for this workflow in the current live feed",
      };

  const workspaceContent = isAppointmentsModule
    ? {
        title: "How To Prepare",
        description: "Use these steps to stay ready for your next counseling, legal, or follow-up session.",
      }
    : {
        title: "Implementation Workspace",
        description: "This route is now distinct and operational. Summaries combine live Supabase data with the alerts feed when needed.",
      };

  const pulseHeadline = modulePulseSummary.activityCount > 0 ? modulePulseSummary.headline : pulseContent.emptyHeadline;
  const pulseMeta = modulePulseSummary.activityCount > 0 ? modulePulseSummary.meta : pulseContent.emptyMeta;

  if (module === "document_vault") {
    return (
      <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 relative z-10">
          <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className={`text-xs font-bold uppercase tracking-[0.3em] ${metadata.colorClass}`}>Secure Vault</p>
                <h1 className="text-3xl font-bold tracking-tight text-white">{metadata.title}</h1>
                <p className="text-base text-slate-300 font-medium">{metadata.description}</p>
              </div>
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white shrink-0"
                onClick={() => setActiveModule("personal_dashboard")}
              >
                Back to Dashboard
              </Button>
            </div>
          </section>

          <Suspense fallback={<div className="h-64 rounded-2xl border border-white/10 bg-slate-950/60 animate-pulse" />}>
            <EvidenceVault />
          </Suspense>
        </div>
      </div>
    );
  }

  if (isAppointmentsModule && summaryContent) {
    return (
      <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 relative z-10">
          <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className={`text-xs font-bold uppercase tracking-[0.3em] ${metadata.colorClass}`}>Personal Dashboard</p>
                <h1 className="text-3xl font-bold tracking-tight text-white">{metadata.title}</h1>
                <p className="text-base text-slate-300 font-medium">
                  Keep track of counseling, legal, and follow-up sessions in one place.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setActiveModule("personal_dashboard")}
              >
                Back to Personal Dashboard
              </Button>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
              <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{summaryContent.title}</p>
                    <h2 className="mt-3 text-3xl font-bold text-white">{summaryContent.primary}</h2>
                    <p className="mt-2 text-sm uppercase tracking-wider text-slate-400">{summaryContent.secondary}</p>
                  </div>
                  <Badge variant={appointmentStatusVariant} size="lg" className="self-start">
                    {appointmentStatusLabel}
                  </Badge>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-5">
                  <p className="text-sm text-slate-300">{summaryContent.detail}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Button className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => setActiveModule("support_requests")}>
                    Request Appointment
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => setActiveModule("support_requests")}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => setActiveModule("secure_messages")}
                  >
                    Message Support
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Status</h2>
                  <p className="mt-1 text-sm text-slate-300">Current appointment and support signal summary.</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Appointment</p>
                  <p className="mt-2 text-lg font-semibold text-white">{appointmentStatusLabel}</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Support Requests</p>
                  <p className="mt-2 text-lg font-semibold text-white">{supportRequestsSummary.headline}</p>
                  <p className="mt-1 text-sm text-slate-400">{supportRequestsSummary.meta}</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Messages</p>
                  <p className="mt-2 text-lg font-semibold text-white">{secureMessagesSummary.headline}</p>
                  <p className="mt-1 text-sm text-slate-400">{secureMessagesSummary.meta}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
              <div className="p-6">
                <h2 className="text-xl font-bold text-white">Recent Updates</h2>
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest signal</p>
                    <p className="mt-2 text-lg font-semibold text-white">{pulseHeadline}</p>
                    <p className="mt-2 text-sm text-slate-300">{pulseMeta}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Appointment history</p>
                    <ul className="mt-3 space-y-3 text-sm text-slate-300">
                      <li className="rounded-lg border border-white/5 bg-black/10 p-3">Current status: {appointmentSummary.headline}</li>
                      <li className="rounded-lg border border-white/5 bg-black/10 p-3">Requests in queue: {supportRequestsSummary.headline}</li>
                      <li className="rounded-lg border border-white/5 bg-black/10 p-3">Messages related to support: {secureMessagesSummary.headline}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
              <div className="p-6">
                <h2 className="text-xl font-bold text-white">{workspaceContent.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{workspaceContent.description}</p>
                <ul className="mt-6 space-y-3">
                  {featureHighlights[module].map((item) => (
                    <li key={item} className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-slate-200">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 relative z-10">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className={`text-xs font-bold uppercase tracking-[0.3em] ${metadata.colorClass}`}>
                {isAppointmentsModule ? "Personal Dashboard" : "Phase 1 Workspace"}
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white">{metadata.title}</h1>
              <p className="text-base text-slate-300 font-medium">
                {isAppointmentsModule
                  ? "Keep track of counseling, legal, and follow-up sessions in one place."
                  : metadata.description}
              </p>
            </div>
            <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setActiveModule("personal_dashboard")}>
              Back to Personal Dashboard
            </Button>
          </div>
        </section>

        {summaryContent && (
          <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white">{summaryContent.title}</h2>
              <div className="mt-6 rounded-xl border border-white/5 bg-slate-950/40 p-5">
                <p className="text-2xl font-bold text-white">{summaryContent.primary}</p>
                <p className="text-sm uppercase tracking-wider text-slate-400 mt-2">{summaryContent.secondary}</p>
                <p className="text-sm text-slate-300 mt-4">{summaryContent.detail}</p>
              </div>
            </div>
          </Card>
        )}

        <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white">{pulseContent.title}</h2>
            <div className="mt-6 rounded-xl border border-white/5 bg-slate-950/40 p-5">
              <p className="text-2xl font-bold text-white">{pulseHeadline}</p>
              <p className="text-sm text-slate-300 mt-4">{pulseMeta}</p>
            </div>
          </div>
        </Card>

        <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white">{workspaceContent.title}</h2>
            <p className="text-sm text-slate-300 mt-2">{workspaceContent.description}</p>
            <ul className="mt-6 space-y-3">
              {featureHighlights[module].map((item) => (
                <li key={item} className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-slate-200">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SurvivorFeatureWorkspace;
