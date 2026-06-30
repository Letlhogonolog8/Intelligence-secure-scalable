import React, { Suspense, lazy, useCallback, useEffect, useMemo } from "react";
import { ModuleType, MODULE_LIST, useUserProfile } from "@/data/aegisData";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_DEFINITIONS, UserRole } from "@/lib/roleConfig";
import { useOrganizationContext } from "@/contexts/organizationContext";
import SurvivorAppRedirect from "@/components/auth/SurvivorAppRedirect";

const CommandCenter = lazy(
  () => import("@/components/dashboard/CommandCenter"),
);
const SurvivorSupport = lazy(
  () => import("@/components/survivor/SurvivorSupport"),
);
const RiskPrediction = lazy(
  () => import("@/components/prediction/RiskPrediction"),
);
const JusticeAnalytics = lazy(
  () => import("@/components/justice/JusticeAnalytics"),
);
const PolicySimulation = lazy(
  () => import("@/components/policy/PolicySimulation"),
);
const EthicalGovernance = lazy(
  () => import("@/components/governance/EthicalGovernance"),
);
const CHWDashboard = lazy(() => import("@/components/dashboard/CHWDashboard"));
const PersonalDashboard = lazy(
  () => import("@/components/survivor/PersonalDashboard"),
);
const SurvivorFeatureWorkspace = lazy(
  () => import("@/components/survivor/SurvivorFeatureWorkspace"),
);
const ReportingCenter = lazy(
  () => import("@/components/reporting/ReportingCenter"),
);
const AdminConsole = lazy(() => import("@/components/admin/AdminConsole"));
const AnalystPortal = lazy(() => import("@/components/analyst/AnalystPortal"));
const AdminPortal = lazy(() => import("@/components/admin/AdminPortal"));
const NgoPortal = lazy(() => import("@/components/ngo/NgoPortal"));
const PolicePortal = lazy(() => import("@/components/police/PolicePortal"));
const CounselorPortal = lazy(
  () => import("@/components/counselor/CounselorPortal"),
);

const AppLayout: React.FC = () => {
  const moduleIds = useMemo<ModuleType[]>(() => MODULE_LIST, []);

  const { user, signOut } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const { organizationId, organizationName } = useOrganizationContext();
  const role = (profile?.role ?? null) as UserRole | null;
  const roleDefinition = role ? ROLE_DEFINITIONS[role] : null;
  const allowedModules = roleDefinition?.modules ?? moduleIds;
  const defaultModule = roleDefinition?.defaultModule ?? "command_center";

  const {
    activeModule,
    sidebarCollapsed,
    mobileSidebarOpen,
    setActiveModule,
    toggleSidebar,
    setMobileSidebarOpen,
    addRecentModule,
    setModuleStatus,
    setOrganizationContext,
    syncSessionContext,
  } = useAppStore();

  useEffect(() => {
    syncSessionContext(user?.id ?? null, defaultModule);
  }, [defaultModule, syncSessionContext, user?.id]);

  useEffect(() => {
    if (!allowedModules.includes(activeModule)) {
      setActiveModule(defaultModule);
      return;
    }
    addRecentModule(activeModule);
    setModuleStatus(activeModule, "online", 0);
  }, [
    activeModule,
    allowedModules,
    defaultModule,
    setActiveModule,
    addRecentModule,
    setModuleStatus,
  ]);

  useEffect(() => {
    setOrganizationContext(organizationId ?? null, organizationName);
  }, [organizationId, organizationName, setOrganizationContext]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setMobileSidebarOpen]);

  const handleModuleChange = useCallback(
    (mod: ModuleType) => {
      setActiveModule(mod);
      setMobileSidebarOpen(false);
    },
    [setActiveModule, setMobileSidebarOpen],
  );

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const handleToggleMobile = useCallback(() => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const renderModule = useMemo(() => {
    // Only the CHW role still reaches this shared shell; every other
    // professional role early-returns to its dedicated full-screen Portal
    // below, and survivors are redirected to the mobile app.
    if (activeModule === "dashboard") {
      return <CHWDashboard />;
    }
    switch (activeModule) {
      case "personal_dashboard":
        return <PersonalDashboard />;
      case "safety_plan":
      case "appointments":
      case "trusted_contacts":
      case "document_vault":
      case "support_requests":
      case "secure_messages":
        return <SurvivorFeatureWorkspace module={activeModule} />;
      case "reporting":
        return <ReportingCenter />;
      case "admin_console":
        return <AdminConsole />;
      case "command_center":
        return <CommandCenter />;
      case "survivor_support":
        return <SurvivorSupport />;
      case "prediction":
        return <RiskPrediction />;
      case "justice":
        return <JusticeAnalytics />;
      case "policy":
        return <PolicySimulation />;
      case "governance":
        return <EthicalGovernance />;
      default:
        return <CommandCenter />;
    }
  }, [activeModule]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div
          className="flex flex-col items-center gap-3 text-slate-400"
          role="status"
          aria-live="polite"
        >
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <span className="text-xs tracking-widest uppercase">
            Loading profile
          </span>
        </div>
      </div>
    );
  }

  if (!roleDefinition) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <ErrorState
            variant="card"
            title="Profile not initialized"
            message="Your account does not have a role assigned yet. Please contact an administrator."
          />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // The web app is the PROFESSIONAL portal. Survivors have a dedicated mobile
  // app (more private, with quick-exit and offline SOS), so route them there.
  if (role === "survivor") {
    return <SurvivorAppRedirect />;
  }

  // Community Health Worker is no longer offered on the web portal. Existing
  // CHW accounts are shown a clear notice rather than the retired dashboard.
  if (role === "chw") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <ErrorState
            variant="card"
            title="Community Health Worker access has moved"
            message="The web portal no longer hosts the Community Health Worker workspace. Please contact your administrator if you need access to another role."
          />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Analysts get a dedicated full-screen intelligence portal with its own
  // sidebar/topbar, so it bypasses the shared shell entirely.
  if (role === "analyst") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#070b18]" />}>
        <AnalystPortal />
      </Suspense>
    );
  }

  // Admins get the dedicated full-screen Admin Portal (own sidebar/topbar).
  if (role === "admin") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#070b18]" />}>
        <AdminPortal />
      </Suspense>
    );
  }

  // NGO partners get the dedicated full-screen NGO Portal.
  if (role === "ngo") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#070b18]" />}>
        <NgoPortal />
      </Suspense>
    );
  }

  // Police get the dedicated full-screen Police Response Portal.
  if (role === "police") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#070b18]" />}>
        <PolicePortal />
      </Suspense>
    );
  }

  // Counselors get the dedicated full-screen Counselor Portal.
  if (role === "counselor") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#070b18]" />}>
        <CounselorPortal />
      </Suspense>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop */}
      <div className="hidden lg:flex flex-shrink-0 z-20">
        <Sidebar
          activeModule={activeModule}
          onModuleChange={handleModuleChange}
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          allowedModules={allowedModules}
          roleLabel={roleDefinition.label}
          organizationLabel={organizationName}
          userRole={role ?? undefined}
        />
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-40 lg:hidden transform transition-transform duration-300 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          activeModule={activeModule}
          onModuleChange={handleModuleChange}
          collapsed={false}
          onToggle={() => setMobileSidebarOpen(false)}
          allowedModules={allowedModules}
          roleLabel={roleDefinition.label}
          organizationLabel={organizationName}
          userRole={role ?? undefined}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeModule={activeModule}
          onToggleSidebar={handleToggleMobile}
        />
        {/* Breadcrumb */}
        <div className="flex-shrink-0 border-b border-slate-800/50 bg-slate-950/50 px-3 py-2 sm:px-4 sm:py-3 lg:px-6">
          <Breadcrumb
            currentModule={activeModule}
            roleLabel={roleDefinition.label}
            organizationLabel={organizationName}
          />
        </div>
        <main className="flex-1 overflow-auto">
          <Suspense
            fallback={
              <div className="h-full w-full p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <Skeleton className="h-6 w-1/3 bg-slate-800/50" />
                    <Skeleton className="h-52 w-full bg-slate-800/50" />
                    <Skeleton className="h-32 w-full bg-slate-800/50" />
                    <Skeleton className="h-40 w-full bg-slate-800/50" />
                  </div>
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-1/2 bg-slate-800/50" />
                    <Skeleton className="h-32 w-full bg-slate-800/50" />
                    <Skeleton className="h-32 w-full bg-slate-800/50" />
                    <Skeleton className="h-24 w-full bg-slate-800/50" />
                  </div>
                </div>
              </div>
            }
          >
            {renderModule}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
