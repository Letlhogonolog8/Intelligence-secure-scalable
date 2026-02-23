import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ModuleType } from "@/data/aegisData"

export type ModuleStatus = "online" | "loading" | "error" | "updating"

type ModuleActivity = {
  moduleId: ModuleType
  status: ModuleStatus
  lastUpdated: number
  notificationCount: number
  description: string
}

type AppState = {
  activeModule: ModuleType
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  sidebarSearchQuery: string
  recentModules: ModuleType[]
  favoriteModules: ModuleType[]
  moduleActivities: Record<ModuleType, ModuleActivity>
  organizationId: string | null
  organizationName: string
  setActiveModule: (module: ModuleType) => void
  toggleSidebar: () => void
  setMobileSidebarOpen: (open: boolean) => void
  setSidebarSearchQuery: (query: string) => void
  addRecentModule: (module: ModuleType) => void
  toggleFavoriteModule: (module: ModuleType) => void
  setModuleStatus: (module: ModuleType, status: ModuleStatus, notificationCount?: number) => void
  setOrganizationContext: (organizationId: string | null, organizationName: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeModule: "dashboard",
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      sidebarSearchQuery: "",
      recentModules: ["dashboard"],
      favoriteModules: [],
      organizationId: null,
      organizationName: "Independent",
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
          description: "Trauma-Informed AI Assistant - Confidential support and safety planning",
        },
        prediction: {
          moduleId: "prediction",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Spatio-Temporal Intelligence - Predictive risk analytics and forecasting",
        },
        justice: {
          moduleId: "justice",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Institutional Optimization - Case tracking and justice system analytics",
        },
        policy: {
          moduleId: "policy",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Multi-Agent Foresight Engine - Policy simulation and impact analysis",
        },
        governance: {
          moduleId: "governance",
          status: "online",
          lastUpdated: Date.now(),
          notificationCount: 0,
          description: "Fairness & Compliance Core - Ethical AI governance and auditing",
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
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
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
      }),
    }
  )
)
