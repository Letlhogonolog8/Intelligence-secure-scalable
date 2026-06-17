import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ModuleType } from "@/data/aegisData";

export type ModuleStatus = "online" | "loading" | "error" | "updating";

type ModuleActivity = {
  moduleId: ModuleType;
  status: ModuleStatus;
  lastUpdated: number;
  notificationCount: number;
  description: string;
};

type AppState = {
  activeModule: ModuleType;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  sidebarSearchQuery: string;
  recentModules: ModuleType[];
  favoriteModules: ModuleType[];
  moduleActivities: Record<ModuleType, ModuleActivity>;
  organizationId: string | null;
  organizationName: string;
  sessionUserId: string | null;
  setActiveModule: (module: ModuleType) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setSidebarSearchQuery: (query: string) => void;
  addRecentModule: (module: ModuleType) => void;
  toggleFavoriteModule: (module: ModuleType) => void;
  setModuleStatus: (
    module: ModuleType,
    status: ModuleStatus,
    notificationCount?: number,
  ) => void;
  setOrganizationContext: (
    organizationId: string | null,
    organizationName: string,
  ) => void;
  syncSessionContext: (
    userId: string | null,
    defaultModule?: ModuleType,
  ) => void;
  resetSessionContext: () => void;
};

const createInitialSessionState = (activeModule: ModuleType = "dashboard") => ({
  activeModule,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  sidebarSearchQuery: "",
  recentModules: [activeModule],
  favoriteModules: [],
  organizationId: null as string | null,
  organizationName: "Independent",
  sessionUserId: null as string | null,
});

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...createInitialSessionState(),
      moduleActivities: {
        dashboard: {
          moduleId: "dashboard",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Role-specific overview and daily priorities",
        },
        personal_dashboard: {
          moduleId: "personal_dashboard",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Personal safety plans, appointments, and documents",
        },
        safety_plan: {
          moduleId: "safety_plan",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Personal safety planning, trusted contacts, and safe actions",
        },
        appointments: {
          moduleId: "appointments",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Counseling, legal, and support follow-up appointments",
        },
        trusted_contacts: {
          moduleId: "trusted_contacts",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Manage trusted contacts and emergency outreach options",
        },
        document_vault: {
          moduleId: "document_vault",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Encrypted personal and case-related files",
        },
        support_requests: {
          moduleId: "support_requests",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Requests for survivor support and follow-up services",
        },
        secure_messages: {
          moduleId: "secure_messages",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Private messages and communication history",
        },
        reporting: {
          moduleId: "reporting",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Organization reports, exports, and impact summaries",
        },
        admin_console: {
          moduleId: "admin_console",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Organization management, users, and system settings",
        },
        command_center: {
          moduleId: "command_center",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Continental Operations Overview - Real-time incident monitoring and system health",
        },
        survivor_support: {
          moduleId: "survivor_support",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Trauma-Informed AI Assistant - Confidential support and safety planning",
        },
        prediction: {
          moduleId: "prediction",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Spatio-Temporal Intelligence - Predictive risk analytics and forecasting",
        },
        justice: {
          moduleId: "justice",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Institutional Optimization - Case tracking and justice system analytics",
        },
        policy: {
          moduleId: "policy",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Multi-Agent Foresight Engine - Policy simulation and impact analysis",
        },
        governance: {
          moduleId: "governance",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Fairness & Compliance Core - Ethical AI governance and auditing",
        },
        police_queue: {
          moduleId: "police_queue",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Live emergency queue triaged by risk for rapid dispatch",
        },
        police_incidents: {
          moduleId: "police_incidents",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Incoming incident reports filtered by category and risk",
        },
        police_evidence: {
          moduleId: "police_evidence",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Shared evidence, voice archives, and AI case tools",
        },
        police_analytics: {
          moduleId: "police_analytics",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description:
            "Predictive triage, officer workload, and response trends",
        },
        police_officers: {
          moduleId: "police_officers",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Unit roster with on/off-duty status and caseloads",
        },
      },
      setActiveModule: (module) =>
        set((state) => ({
          activeModule: module,
          recentModules: [
            module,
            ...state.recentModules.filter((m) => m !== module),
          ].slice(0, 5),
        })),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),
      addRecentModule: (module) =>
        set((state) => ({
          recentModules: [
            module,
            ...state.recentModules.filter((m) => m !== module),
          ].slice(0, 5),
        })),
      toggleFavoriteModule: (module) =>
        set((state) => ({
          favoriteModules: state.favoriteModules.includes(module)
            ? state.favoriteModules.filter((m) => m !== module)
            : [...state.favoriteModules, module].slice(0, 5),
        })),
      setModuleStatus: (module, status, notificationCount = 0) =>
        set((state) => ({
          moduleActivities: {
            ...state.moduleActivities,
            [module]: {
              ...state.moduleActivities[module],
              status,
              notificationCount,
              lastUpdated: Date.now(),
            },
          },
        })),
      setOrganizationContext: (organizationId, organizationName) =>
        set({ organizationId, organizationName }),
      syncSessionContext: (userId, defaultModule = "dashboard") =>
        set((state) => {
          if (!userId) {
            return {
              ...createInitialSessionState(),
              moduleActivities: state.moduleActivities,
            };
          }

          if (state.sessionUserId === userId) {
            return { sessionUserId: userId };
          }

          return {
            ...createInitialSessionState(defaultModule),
            sessionUserId: userId,
            moduleActivities: state.moduleActivities,
          };
        }),
      resetSessionContext: () =>
        set((state) => ({
          ...createInitialSessionState(),
          moduleActivities: state.moduleActivities,
        })),
    }),
    {
      name: "aegis-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeModule: state.activeModule,
        sidebarCollapsed: state.sidebarCollapsed,
        mobileSidebarOpen: state.mobileSidebarOpen,
        recentModules: state.recentModules,
        favoriteModules: state.favoriteModules,
        organizationId: state.organizationId,
        organizationName: state.organizationName,
        sessionUserId: state.sessionUserId,
      }),
    },
  ),
);

export const resetAppSessionState = () => {
  useAppStore.getState().resetSessionContext();
};
