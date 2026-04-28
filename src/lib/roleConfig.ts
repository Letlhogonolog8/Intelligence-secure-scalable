/**
 * Role Configuration and Type Definitions
 * src/lib/roleConfig.ts
 * 
 * This file centralizes all role definitions, permissions, and module access.
 * Serves as the single source of truth for role-based access control (RBAC).
 */

import { ModuleType } from "@/data/aegisData";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type UserRole = "admin" | "counselor" | "survivor" | "ngo" | "police" | "analyst" | "chw";

export type DashboardType = 
  | "survivor_dashboard"
  | "counselor_dashboard" 
  | "admin_dashboard"
  | "ngo_dashboard"
  | "police_dashboard"
  | "analyst_dashboard"
  | "chw_dashboard";

export interface RoleDefinition {
  id: UserRole;
  label: string;
  description: string;
  icon: string;
  modules: ModuleType[];
  defaultModule: ModuleType;
  dashboardType: DashboardType;
  color: string;
  backgroundColor: string;
}

export interface PermissionSet {
  canViewAllData: boolean;
  canViewOrgData: boolean;
  canViewOwnData: boolean;
  canCreateUsers: boolean;
  canModifyRoles: boolean;
  canAccessAnalytics: boolean;
  canDeleteData: boolean;
  canViewAuditLogs: boolean;
  organizationScoped: boolean;
  jurisdictionScoped: boolean;
}

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  admin: {
    id: "admin",
    label: "Administrator",
    description: "System administrator with full platform access",
    icon: "ShieldIcon",
    modules: ["dashboard", "admin_console", "reporting", "command_center", "survivor_support", "prediction", "justice", "policy", "governance"],
    defaultModule: "dashboard",
    dashboardType: "admin_dashboard",
    color: "text-red-500",
    backgroundColor: "bg-red-500/10",
  },

  counselor: {
    id: "counselor",
    label: "Counselor",
    description: "Direct care provider managing survivors",
    icon: "MessageCircleIcon",
    modules: ["dashboard", "survivor_support", "justice", "governance"],
    defaultModule: "dashboard",
    dashboardType: "counselor_dashboard",
    color: "text-pink-500",
    backgroundColor: "bg-pink-500/10",
  },

  survivor: {
    id: "survivor",
    label: "Survivor",
    description: "Support seeker accessing personal support resources",
    icon: "UserIcon",
    modules: ["dashboard", "personal_dashboard", "safety_plan", "appointments", "trusted_contacts", "document_vault", "support_requests", "secure_messages", "survivor_support"],
    defaultModule: "personal_dashboard",
    dashboardType: "survivor_dashboard",
    color: "text-purple-500",
    backgroundColor: "bg-purple-500/10",
  },

  ngo: {
    id: "ngo",
    label: "NGO Staff",
    description: "Non-governmental organization program coordinator",
    icon: "GlobeIcon",
    modules: ["dashboard", "reporting", "survivor_support", "justice", "governance", "policy"],
    defaultModule: "dashboard",
    dashboardType: "ngo_dashboard",
    color: "text-blue-500",
    backgroundColor: "bg-blue-500/10",
  },

  police: {
    id: "police",
    label: "Law Enforcement",
    description: "Police officer involved in case investigation",
    icon: "ShieldIcon",
    modules: ["dashboard", "justice", "command_center", "prediction", "policy", "governance", "reporting"],
    defaultModule: "dashboard",
    dashboardType: "police_dashboard",
    color: "text-amber-500",
    backgroundColor: "bg-amber-500/10",
  },

  analyst: {
    id: "analyst",
    label: "Institutional Analyst",
    description: "Analyst with access to aggregated data and institutional insights",
    icon: "BarChartIcon",
    modules: ["dashboard", "reporting", "command_center", "prediction", "justice", "policy", "governance"],
    defaultModule: "dashboard",
    dashboardType: "analyst_dashboard",
    color: "text-indigo-500",
    backgroundColor: "bg-indigo-500/10",
  },

  chw: {
    id: "chw",
    label: "Community Health Worker",
    description: "Field worker conducting rural outreach, referrals, and survivor follow-up",
    icon: "HeartIcon",
    modules: ["dashboard", "survivor_support", "reporting"],
    defaultModule: "dashboard",
    dashboardType: "chw_dashboard",
    color: "text-emerald-500",
    backgroundColor: "bg-emerald-500/10",
  },
};

// ============================================================================
// PERMISSIONS MATRIX
// ============================================================================

export const PERMISSIONS: Record<UserRole, PermissionSet> = {
  admin: {
    canViewAllData: true,
    canViewOrgData: true,
    canViewOwnData: true,
    canCreateUsers: true,
    canModifyRoles: true,
    canAccessAnalytics: true,
    canDeleteData: true,
    canViewAuditLogs: true,
    organizationScoped: false,
    jurisdictionScoped: false,
  },

  counselor: {
    canViewAllData: false,
    canViewOrgData: true,
    canViewOwnData: true,
    canCreateUsers: false,
    canModifyRoles: false,
    canAccessAnalytics: false,
    canDeleteData: false,
    canViewAuditLogs: false,
    organizationScoped: true,
    jurisdictionScoped: false,
  },

  survivor: {
    canViewAllData: false,
    canViewOrgData: false,
    canViewOwnData: true,
    canCreateUsers: false,
    canModifyRoles: false,
    canAccessAnalytics: false,
    canDeleteData: false,
    canViewAuditLogs: false,
    organizationScoped: false,
    jurisdictionScoped: false,
  },

  ngo: {
    canViewAllData: false,
    canViewOrgData: true,
    canViewOwnData: true,
    canCreateUsers: true,
    canModifyRoles: false,
    canAccessAnalytics: true,
    canDeleteData: false,
    canViewAuditLogs: false,
    organizationScoped: true,
    jurisdictionScoped: false,
  },

  police: {
    canViewAllData: false,
    canViewOrgData: true,
    canViewOwnData: true,
    canCreateUsers: true,
    canModifyRoles: false,
    canAccessAnalytics: true,
    canDeleteData: false,
    canViewAuditLogs: false,
    organizationScoped: true,
    jurisdictionScoped: true,
  },

  analyst: {
    canViewAllData: true,
    canViewOrgData: true,
    canViewOwnData: true,
    canCreateUsers: false,
    canModifyRoles: false,
    canAccessAnalytics: true,
    canDeleteData: false,
    canViewAuditLogs: false,
    organizationScoped: false,
    jurisdictionScoped: false,
  },

  chw: {
    canViewAllData: false,
    canViewOrgData: false,
    canViewOwnData: true,
    canCreateUsers: false,
    canModifyRoles: false,
    canAccessAnalytics: false,
    canDeleteData: false,
    canViewAuditLogs: false,
    organizationScoped: true,
    jurisdictionScoped: true,
  },
};

// ============================================================================
// MODULE ACCESS MATRIX
// ============================================================================

export const MODULE_ACCESS: Record<UserRole, Record<ModuleType, "full" | "limited" | "readonly" | "none">> = {
  admin: {
    dashboard: "full",
    personal_dashboard: "none",
    safety_plan: "none",
    appointments: "none",
    trusted_contacts: "none",
    document_vault: "none",
    support_requests: "none",
    secure_messages: "none",
    reporting: "full",
    admin_console: "full",
    command_center: "full",
    survivor_support: "full",
    prediction: "full",
    justice: "full",
    policy: "full",
    governance: "full",
  },

  counselor: {
    dashboard: "full",
    personal_dashboard: "none",
    safety_plan: "none",
    appointments: "none",
    trusted_contacts: "none",
    document_vault: "none",
    support_requests: "none",
    secure_messages: "none",
    reporting: "none",
    admin_console: "none",
    command_center: "none",
    survivor_support: "full",
    prediction: "none",
    justice: "limited", // assigned cases only
    policy: "none",
    governance: "readonly",
  },

  survivor: {
    dashboard: "full",
    personal_dashboard: "full",
    safety_plan: "full",
    appointments: "full",
    trusted_contacts: "full",
    document_vault: "full",
    support_requests: "full",
    secure_messages: "full",
    reporting: "none",
    admin_console: "none",
    command_center: "none",
    survivor_support: "full",
    prediction: "none",
    justice: "none",
    policy: "none",
    governance: "none",
  },

  ngo: {
    dashboard: "full",
    personal_dashboard: "none",
    safety_plan: "none",
    appointments: "none",
    trusted_contacts: "none",
    document_vault: "none",
    support_requests: "none",
    secure_messages: "none",
    reporting: "full",
    admin_console: "none",
    command_center: "none",
    survivor_support: "limited", // organization's survivors
    prediction: "none",
    justice: "limited", // organization's cases
    policy: "readonly",
    governance: "readonly",
  },

  police: {
    dashboard: "full",
    personal_dashboard: "none",
    safety_plan: "none",
    appointments: "none",
    trusted_contacts: "none",
    document_vault: "none",
    support_requests: "none",
    secure_messages: "none",
    reporting: "none",
    admin_console: "none",
    command_center: "limited", // jurisdiction only
    survivor_support: "none",
    prediction: "limited", // jurisdiction only
    justice: "limited", // jurisdiction only
    policy: "readonly",
    governance: "readonly",
  },

  analyst: {
    dashboard: "full",
    personal_dashboard: "none",
    safety_plan: "none",
    appointments: "none",
    trusted_contacts: "none",
    document_vault: "none",
    support_requests: "none",
    secure_messages: "none",
    reporting: "readonly",
    admin_console: "none",
    command_center: "readonly",
    survivor_support: "none",
    prediction: "readonly",
    justice: "readonly",
    policy: "readonly",
    governance: "readonly",
  },

  chw: {
    dashboard: "full",
    personal_dashboard: "none",
    safety_plan: "none",
    appointments: "none",
    trusted_contacts: "none",
    document_vault: "none",
    support_requests: "none",
    secure_messages: "none",
    reporting: "limited",
    admin_console: "none",
    command_center: "none",
    survivor_support: "limited",
    prediction: "none",
    justice: "none",
    policy: "none",
    governance: "none",
  },
};

// ============================================================================
// FEATURE FLAGS PER ROLE
// ============================================================================

export const FEATURE_FLAGS: Record<UserRole, Record<string, boolean>> = {
  admin: {
    can_create_users: true,
    can_delete_users: true,
    can_manage_roles: true,
    can_view_audit_logs: true,
    can_export_data: true,
    can_configure_system: true,
    can_manage_organizations: true,
    can_override_access: true,
    can_view_all_chats: true,
    can_modify_policies: true,
  },

  counselor: {
    can_create_users: false,
    can_delete_users: false,
    can_manage_roles: false,
    can_view_audit_logs: false,
    can_export_data: true,
    can_configure_system: false,
    can_manage_organizations: false,
    can_override_access: false,
    can_view_all_chats: false,
    can_modify_policies: false,
    can_escalate_cases: true,
    can_create_safety_plans: true,
    can_record_case_notes: true,
    can_schedule_followups: true,
  },

  survivor: {
    can_create_users: false,
    can_delete_users: false,
    can_manage_roles: false,
    can_view_audit_logs: false,
    can_export_data: true, // own data only
    can_configure_system: false,
    can_manage_organizations: false,
    can_override_access: false,
    can_view_all_chats: false,
    can_modify_policies: false,
    can_provide_feedback: true,
    can_manage_privacy_settings: true,
    can_request_data_export: true,
  },

  ngo: {
    can_create_users: true, // organization staff only
    can_delete_users: false,
    can_manage_roles: false,
    can_view_audit_logs: false,
    can_export_data: true,
    can_configure_system: false,
    can_manage_organizations: true, // own org only
    can_override_access: false,
    can_view_all_chats: false,
    can_modify_policies: false,
    can_generate_reports: true,
    can_track_impact_metrics: true,
    can_manage_partnerships: true,
    can_coordinate_referrals: true,
  },

  police: {
    can_create_users: true, // department staff only
    can_delete_users: false,
    can_manage_roles: false,
    can_view_audit_logs: false,
    can_export_data: true,
    can_configure_system: false,
    can_manage_organizations: true, // own department only
    can_override_access: false,
    can_view_all_chats: false,
    can_modify_policies: false,
    can_file_cases: true,
    can_assign_officers: true,
    can_document_evidence: true,
    can_coordinate_with_ngo: true,
    can_update_prosecution_status: true,
  },

  analyst: {
    can_create_users: false,
    can_delete_users: false,
    can_manage_roles: false,
    can_view_audit_logs: true,
    can_export_data: true,
    can_configure_system: false,
    can_manage_organizations: false,
    can_override_access: false,
    can_view_all_chats: false,
    can_modify_policies: false,
    can_create_custom_reports: true,
    can_access_ml_models: true,
    can_run_predictions: true,
  },

  chw: {
    can_create_users: false,
    can_delete_users: false,
    can_manage_roles: false,
    can_view_audit_logs: false,
    can_export_data: false,
    can_configure_system: false,
    can_manage_organizations: false,
    can_override_access: false,
    can_view_all_chats: false,
    can_modify_policies: false,
    can_log_field_visits: true,
    can_create_referrals: true,
    can_use_offline_mode: true,
    can_view_survivor_codes: true,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the role definition for a given role
 */
export function getRoleDefinition(role: UserRole): RoleDefinition {
  return ROLE_DEFINITIONS[role];
}

/**
 * Check if a role has permission for a module
 */
export function hasModuleAccess(
  role: UserRole,
  module: ModuleType,
  accessLevel: "full" | "limited" | "readonly" = "full"
): boolean {
  const moduleAccess = MODULE_ACCESS[role]?.[module];
  if (!moduleAccess || moduleAccess === "none") return false;

  if (accessLevel === "full") {
    return moduleAccess === "full";
  } else if (accessLevel === "limited") {
    return moduleAccess === "full" || moduleAccess === "limited";
  } else if (accessLevel === "readonly") {
    return moduleAccess === "full" || moduleAccess === "limited" || moduleAccess === "readonly";
  }
  return false;
}

/**
 * Check if a role has a specific feature flag enabled
 */
export function hasFeatureFlag(role: UserRole, flag: string): boolean {
  return FEATURE_FLAGS[role]?.[flag] ?? false;
}

/**
 * Get all modules accessible by a role
 */
export function getAccessibleModules(role: UserRole): ModuleType[] {
  return ROLE_DEFINITIONS[role]?.modules ?? [];
}

/**
 * Get the default module for a role
 */
export function getDefaultModule(role: UserRole): ModuleType {
  return ROLE_DEFINITIONS[role]?.defaultModule ?? "command_center";
}

/**
 * Get the dashboard type for a role
 */
export function getDashboardType(role: UserRole): DashboardType {
  return ROLE_DEFINITIONS[role]?.dashboardType ?? "admin_dashboard";
}
