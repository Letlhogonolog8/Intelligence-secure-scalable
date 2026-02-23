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

const CommandCenter = lazy(() => import('@/components/dashboard/CommandCenter'));
const SurvivorSupport = lazy(() => import('@/components/survivor/SurvivorSupport'));
const RiskPrediction = lazy(() => import('@/components/prediction/RiskPrediction'));
const JusticeAnalytics = lazy(() => import('@/components/justice/JusticeAnalytics'));
const PolicySimulation = lazy(() => import('@/components/policy/PolicySimulation'));
const EthicalGovernance = lazy(() => import('@/components/governance/EthicalGovernance'));
const SurvivorDashboard = lazy(() => import('@/components/dashboard/SurvivorDashboard'));
const CounselorDashboard = lazy(() => import('@/components/dashboard/CounselorDashboard'));
const AdminDashboard = lazy(() => import('@/components/dashboard/AdminDashboard'));
const NgoDashboard = lazy(() => import('@/components/dashboard/NgoDashboard'));
const PoliceDashboard = lazy(() => import('@/components/dashboard/PoliceDashboard'));
const AnalystDashboard = lazy(() => import('@/components/dashboard/AnalystDashboard'));
const PersonalDashboard = lazy(() => import('@/components/survivor/PersonalDashboard'));
const ReportingCenter = lazy(() => import('@/components/reporting/ReportingCenter'));
const AdminConsole = lazy(() => import('@/components/admin/AdminConsole'));

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
  } = useAppStore();

  useEffect(() => {
    if (!allowedModules.includes(activeModule)) {
      setActiveModule(defaultModule);
      return;
    }
    addRecentModule(activeModule);
    setModuleStatus(activeModule, "online", 0);
  }, [activeModule, allowedModules, defaultModule, setActiveModule, addRecentModule, setModuleStatus]);

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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobileSidebarOpen]);

  const handleModuleChange = useCallback((mod: ModuleType) => {
    setActiveModule(mod);
    setMobileSidebarOpen(false);
  }, [setActiveModule, setMobileSidebarOpen]);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const handleToggleMobile = useCallback(() => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const renderModule = useMemo(() => {
    if (activeModule === "dashboard") {
      switch (roleDefinition?.dashboardType) {
        case "survivor_dashboard":
          return <SurvivorDashboard />;
        case "counselor_dashboard":
          return <CounselorDashboard />;
        case "ngo_dashboard":
          return <NgoDashboard />;
        case "police_dashboard":
          return <PoliceDashboard />;
        case "analyst_dashboard":
          return <AnalystDashboard />;
        case "admin_dashboard":
        default:
          return <AdminDashboard />;
      }
    }
    switch (activeModule) {
      case 'personal_dashboard':
        return <PersonalDashboard />;
      case 'reporting':
        return <ReportingCenter />;
      case 'admin_console':
        return <AdminConsole />;
      case 'command_center':
        return <CommandCenter />;
      case 'survivor_support':
        return <SurvivorSupport />;
      case 'prediction':
        return <RiskPrediction />;
      case 'justice':
        return <JusticeAnalytics />;
      case 'policy':
        return <PolicySimulation />;
      case 'governance':
        return <EthicalGovernance />;
      default:
        return <CommandCenter />;
    }
  }, [activeModule, roleDefinition?.dashboardType]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400" role="status" aria-live="polite">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <span className="text-xs tracking-widest uppercase">Loading profile</span>
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
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
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

      <div className={`fixed inset-y-0 left-0 z-40 lg:hidden transform transition-transform duration-300 ${
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
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
        <div className="px-4 lg:px-6 py-3 border-b border-slate-800/50 bg-slate-950/50 flex-shrink-0">
          <Breadcrumb currentModule={activeModule} roleLabel={roleDefinition.label} organizationLabel={organizationName} />
        </div>
        <main className="flex-1 overflow-auto">
          <Suspense
            fallback={(
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
            )}
          >
            {renderModule}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
