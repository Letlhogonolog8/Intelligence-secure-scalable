import React from "react";
import { ModuleType } from "@/data/aegisData";
import { ChevronRightIcon, HomeIcon } from "@/components/ui/AegisIcons";

interface BreadcrumbProps {
  currentModule: ModuleType;
  currentPage?: string;
  roleLabel?: string;
  organizationLabel?: string;
}

const moduleNames: Record<ModuleType, string> = {
  dashboard: "Dashboard",
  personal_dashboard: "Personal Dashboard",
  safety_plan: "Safety Plan",
  appointments: "Appointments",
  trusted_contacts: "Trusted Contacts",
  document_vault: "Document Vault",
  support_requests: "Support Requests",
  secure_messages: "Secure Messages",
  reporting: "Reporting Center",
  admin_console: "Admin Console",
  command_center: "Command Center",
  survivor_support: "Survivor Support",
  prediction: "Risk Prediction",
  justice: "Justice Analytics",
  policy: "Policy Simulation",
  governance: "AI Governance",
  police_queue: "Emergency Queue",
  police_incidents: "Incidents",
  police_evidence: "Evidence Center",
  police_analytics: "Analytics",
  police_officers: "Officer Directory",
};

const policeModuleNames: Partial<Record<ModuleType, string>> = {
  dashboard: "Overview",
  police_queue: "Emergency Queue",
  police_incidents: "Incidents",
  justice: "Cases",
  command_center: "Dispatch Center",
  police_evidence: "Evidence Center",
  secure_messages: "Messages",
  police_analytics: "Analytics",
  reporting: "Reports",
  police_officers: "Officer Directory",
  governance: "Settings",
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentModule,
  currentPage,
  roleLabel,
  organizationLabel,
}) => {
  const isPolicePortal = roleLabel === "Law Enforcement";
  const currentModuleLabel =
    (isPolicePortal ? policeModuleNames[currentModule] : undefined) ??
    moduleNames[currentModule];

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs text-slate-400"
    >
      <a
        href="/"
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <HomeIcon size={14} />
        <span className="hidden sm:inline">AEGIS</span>
      </a>

      {organizationLabel && (
        <>
          <ChevronRightIcon size={14} className="hidden opacity-50 sm:block" />
          <span className="hidden truncate text-slate-300 sm:inline">
            {organizationLabel}
          </span>
        </>
      )}

      {roleLabel && (
        <>
          <ChevronRightIcon size={14} className="hidden opacity-50 sm:block" />
          <span className="hidden text-slate-300 sm:inline">{roleLabel}</span>
        </>
      )}

      <ChevronRightIcon size={14} className="opacity-50" />

      <a href="#" className="hover:text-white transition-colors">
        {currentModuleLabel}
      </a>

      {currentPage && (
        <>
          <ChevronRightIcon size={14} className="opacity-50" />
          <span className="text-slate-300">{currentPage}</span>
        </>
      )}
    </nav>
  );
};
