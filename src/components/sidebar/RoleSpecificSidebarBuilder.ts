/**
 * Role-Specific Sidebar Builder
 * src/components/sidebar/RoleSpecificSidebarBuilder.ts
 *
 * Generates dynamic, role-specific navigation structures for each user role.
 * Ensures enterprise-grade separation of concerns and scalability.
 */

import { ModuleType } from "@/data/aegisData";
import { UserRole } from "@/lib/roleConfig";

export interface SidebarSection {
  id: string;
  title: string;
  icon?: string;
  modules: ModuleType[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface RoleSpecificSidebarConfig {
  role: UserRole;
  sections: SidebarSection[];
  quickActions?: ModuleType[];
  allowSearch: boolean;
  allowFavorites: boolean;
  allowRecents: boolean;
  maxRecentItems: number;
  maxFavoriteItems: number;
  collapsedByDefault: boolean;
  mobileCollapsedByDefault: boolean;
  /** Per-role display names that override the global module label (e.g. the
   * police role shows the shared `justice` module as "Cases"). */
  labelOverrides?: Partial<Record<ModuleType, string>>;
  /** When false, the per-module status dot (online/updating indicator) is
   * hidden for this role — useful for a clean operational nav. */
  showModuleStatus?: boolean;
}

const SURVIVOR_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "survivor",
  sections: [
    {
      id: "primary",
      title: "My Support",
      modules: [
        "personal_dashboard",
        "safety_plan",
        "appointments",
        "support_requests",
        "secure_messages",
      ],
      collapsible: false,
    },
    {
      id: "resources",
      title: "Resources",
      modules: [
        "trusted_contacts",
        "document_vault",
        "dashboard",
        "survivor_support",
      ],
      collapsible: true,
      defaultExpanded: true,
    },
  ],
  quickActions: ["support_requests", "secure_messages", "survivor_support"],
  allowSearch: true,
  allowFavorites: true,
  allowRecents: true,
  maxRecentItems: 3,
  maxFavoriteItems: 2,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const COUNSELOR_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "counselor",
  sections: [
    {
      id: "operations",
      title: "Case Management",
      modules: ["dashboard", "justice", "survivor_support"],
      collapsible: false,
    },
    {
      id: "analytics",
      title: "Insights & Analysis",
      modules: ["governance"],
      collapsible: true,
      defaultExpanded: false,
    },
  ],
  quickActions: ["justice", "survivor_support"],
  allowSearch: true,
  allowFavorites: true,
  allowRecents: true,
  maxRecentItems: 5,
  maxFavoriteItems: 3,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const NGO_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "ngo",
  sections: [
    {
      id: "operations",
      title: "Program Operations",
      modules: ["dashboard", "justice", "survivor_support"],
      collapsible: false,
    },
    {
      id: "coordination",
      title: "Agency Coordination",
      modules: ["reporting"],
      collapsible: true,
      defaultExpanded: true,
    },
    {
      id: "planning",
      title: "Strategy & Planning",
      modules: ["policy", "governance"],
      collapsible: true,
      defaultExpanded: false,
    },
  ],
  quickActions: ["justice", "reporting"],
  allowSearch: true,
  allowFavorites: true,
  allowRecents: true,
  maxRecentItems: 5,
  maxFavoriteItems: 4,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const POLICE_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "police",
  // A single clean command-centre nav: a flat 11-item list in operational
  // order, no group headers, no search/recents/favourites chrome.
  sections: [
    {
      id: "command",
      title: "",
      modules: [
        "dashboard",
        "police_queue",
        "police_incidents",
        "justice",
        "command_center",
        "police_evidence",
        "secure_messages",
        "police_analytics",
        "reporting",
        "police_officers",
        "governance",
      ],
      collapsible: false,
    },
  ],
  // Police-context names for the shared modules reused by this nav.
  labelOverrides: {
    dashboard: "Overview",
    justice: "Cases",
    command_center: "Dispatch Center",
    secure_messages: "Messages",
    reporting: "Reports",
    governance: "Settings",
  },
  showModuleStatus: false,
  allowSearch: false,
  allowFavorites: false,
  allowRecents: false,
  maxRecentItems: 0,
  maxFavoriteItems: 0,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const ANALYST_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "analyst",
  sections: [
    {
      id: "analytics",
      title: "Analytics & Reporting",
      modules: ["dashboard", "reporting"],
      collapsible: false,
    },
    {
      id: "intelligence",
      title: "Predictive Intelligence",
      modules: ["prediction", "policy"],
      collapsible: true,
      defaultExpanded: true,
    },
    {
      id: "governance",
      title: "Governance & Compliance",
      modules: ["governance", "justice"],
      collapsible: true,
      defaultExpanded: false,
    },
  ],
  quickActions: ["reporting", "prediction"],
  allowSearch: true,
  allowFavorites: true,
  allowRecents: true,
  maxRecentItems: 5,
  maxFavoriteItems: 4,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const ADMIN_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "admin",
  // The Admin Portal (admin_console) is the hub — it now contains the full
  // 10-section admin experience. The remaining standalone modules are kept in a
  // collapsed secondary group so nothing is lost, but the sidebar stays clean.
  sections: [
    {
      id: "administration",
      title: "Administration",
      modules: ["admin_console"],
      collapsible: false,
    },
    {
      id: "platform",
      title: "Platform Modules",
      modules: [
        "dashboard",
        "command_center",
        "reporting",
        "prediction",
        "justice",
        "policy",
        "governance",
        "survivor_support",
      ],
      collapsible: true,
      defaultExpanded: false,
    },
  ],
  quickActions: ["admin_console"],
  allowSearch: true,
  allowFavorites: true,
  allowRecents: true,
  maxRecentItems: 8,
  maxFavoriteItems: 5,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const CHW_SIDEBAR: RoleSpecificSidebarConfig = {
  role: "chw",
  sections: [
    {
      id: "field",
      title: "Field Operations",
      modules: ["dashboard", "survivor_support"],
      collapsible: false,
    },
    {
      id: "reporting",
      title: "Referrals & Reporting",
      modules: ["reporting"],
      collapsible: true,
      defaultExpanded: true,
    },
  ],
  quickActions: ["survivor_support", "reporting"],
  allowSearch: true,
  allowFavorites: true,
  allowRecents: true,
  maxRecentItems: 4,
  maxFavoriteItems: 3,
  collapsedByDefault: false,
  mobileCollapsedByDefault: true,
};

const ROLE_SIDEBAR_MAP: Record<UserRole, RoleSpecificSidebarConfig> = {
  survivor: SURVIVOR_SIDEBAR,
  counselor: COUNSELOR_SIDEBAR,
  ngo: NGO_SIDEBAR,
  police: POLICE_SIDEBAR,
  analyst: ANALYST_SIDEBAR,
  admin: ADMIN_SIDEBAR,
  chw: CHW_SIDEBAR,
};

/**
 * Get role-specific sidebar configuration
 * @param role - User role
 * @returns Role-specific sidebar configuration
 */
export function getRoleSpecificSidebarConfig(
  role: UserRole,
): RoleSpecificSidebarConfig {
  return ROLE_SIDEBAR_MAP[role];
}

/**
 * Get all modules for a specific role
 * @param role - User role
 * @returns Flat array of all modules accessible to the role
 */
export function getAllowedModulesForRole(role: UserRole): ModuleType[] {
  const config = getRoleSpecificSidebarConfig(role);
  const modules = new Set<ModuleType>();

  config.sections.forEach((section) => {
    section.modules.forEach((mod) => modules.add(mod));
  });

  return Array.from(modules);
}

/**
 * Filter modules by visibility based on role and query
 * @param role - User role
 * @param query - Search query
 * @param moduleMetadata - Module metadata for searching
 * @returns Filtered modules
 */
export function filterModulesByQuery(
  role: UserRole,
  query: string,
  moduleMetadata: Record<ModuleType, { label: string; description: string }>,
): ModuleType[] {
  const allowedModules = getAllowedModulesForRole(role);
  const lowerQuery = query.toLowerCase();

  return allowedModules.filter((mod) => {
    const meta = moduleMetadata[mod];
    return (
      meta.label.toLowerCase().includes(lowerQuery) ||
      meta.description.toLowerCase().includes(lowerQuery)
    );
  });
}
