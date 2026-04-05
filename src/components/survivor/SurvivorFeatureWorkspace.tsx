import React from "react";
import { MODULE_METADATA, ModuleType } from "@/data/aegisData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import {
  useDocumentVaultSummary,
  useModulePulseSummary,
  useSafetyPlanSummary,
  useSecureMessagesSummary,
  useSupportRequestsSummary,
  useTrustedContactsSummary,
  useUpcomingAppointmentSummary,
} from "@/hooks/survivor/usePersonalDashboardSummaries";

interface SurvivorFeatureWorkspaceProps {
  module: Extract<
    ModuleType,
    "safety_plan" | "appointments" | "trusted_contacts" | "document_vault" | "support_requests" | "secure_messages"
  >;
}

const featureHighlights: Record<SurvivorFeatureWorkspaceProps["module"], string[]> = {
  safety_plan: ["Review plan readiness", "Update safe actions", "Verify emergency contacts"],
  appointments: ["Track upcoming sessions", "Prepare follow-ups", "Monitor scheduling status"],
  trusted_contacts: ["Manage primary contacts", "Prepare fast outreach", "Review emergency availability"],
  document_vault: ["Review secure files", "Prepare uploads", "Keep sensitive evidence organized"],
  support_requests: ["Open new requests", "Monitor request progress", "Track follow-up actions"],
  secure_messages: ["Open private conversations", "Review communication history", "Respond to support outreach"],
};

const SurvivorFeatureWorkspace: React.FC<SurvivorFeatureWorkspaceProps> = ({ module }) => {
  const { user } = useAuth();
  const { setActiveModule } = useAppStore();
  const metadata = MODULE_METADATA[module];
  const { data: safetyPlanSummary } = useSafetyPlanSummary(user?.id);
  const { data: appointmentSummary } = useUpcomingAppointmentSummary(user?.id);
  const { data: trustedContactsSummary } = useTrustedContactsSummary(user?.id);
  const { data: documentVaultSummary } = useDocumentVaultSummary(user?.id);
  const { data: supportRequestsSummary } = useSupportRequestsSummary(user?.id);
  const { data: secureMessagesSummary } = useSecureMessagesSummary(user?.id);
  const { data: modulePulseSummary } = useModulePulseSummary(module, user?.id);

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
            title: "Upcoming Appointment Snapshot",
            primary: appointmentSummary.headline,
            secondary: appointmentSummary.hasUpcoming ? "Immediate follow-up required" : "No appointment on record",
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

  return (
    <div className="min-h-screen bg-[#04060c] text-slate-50 px-6 py-8 relative overflow-hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 relative z-10">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className={`text-xs font-bold uppercase tracking-[0.3em] ${metadata.colorClass}`}>Phase 1 Workspace</p>
              <h1 className="text-3xl font-bold tracking-tight text-white">{metadata.title}</h1>
              <p className="text-base text-slate-300 font-medium">{metadata.description}</p>
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
            <h2 className="text-xl font-bold text-white">Live Pulse</h2>
            <div className="mt-6 rounded-xl border border-white/5 bg-slate-950/40 p-5">
              <p className="text-2xl font-bold text-white">{modulePulseSummary.headline}</p>
              <p className="text-sm text-slate-300 mt-4">{modulePulseSummary.meta}</p>
            </div>
          </div>
        </Card>

        <Card className="border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white">Implementation Workspace</h2>
            <p className="text-sm text-slate-300 mt-2">
              This route is now distinct and operational. The next iteration will bind it to feature-specific data and workflows.
            </p>
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
