/**
 * Enterprise Role Authorization Configuration
 * Defines role-based access policies, credential requirements, and security constraints
 */

import { RoleAuthPolicy, UserRole } from "@/types/auth";

/**
 * Role-based authentication and authorization policies
 * Defines who can register, what authentication methods are allowed, and session constraints
 */
export const ROLE_AUTH_POLICIES: Record<UserRole, RoleAuthPolicy> = {
  survivor: {
    role: "survivor",
    allowSelfRegistration: true,
    requiresApproval: false,
    requiresCredentials: false,
    allowedAuthMethods: ["credential"],
    sessionTimeout: 120, // 2 hours
    maxConcurrentSessions: 2,
    requiresMFA: false,
    requiresBiometric: false,
  },

  counselor: {
    role: "counselor",
    allowSelfRegistration: false,
    requiresApproval: true,
    requiresCredentials: true,
    allowedAuthMethods: ["credential"],
    sessionTimeout: 480, // 8 hours
    maxConcurrentSessions: 1,
    requiresMFA: true,
    requiresBiometric: true,
  },

  ngo: {
    role: "ngo",
    allowSelfRegistration: false,
    requiresApproval: true,
    requiresCredentials: true,
    allowedAuthMethods: ["credential"],
    restrictedCredentials: ["police_admin", "officer_unit", "system.admin"],
    sessionTimeout: 480, // 8 hours
    maxConcurrentSessions: 1,
    requiresMFA: true,
    requiresBiometric: false,
  },

  police: {
    role: "police",
    allowSelfRegistration: false,
    requiresApproval: true,
    requiresCredentials: true,
    allowedAuthMethods: ["credential"],
    restrictedCredentials: ["ngo_director", "coordinator", "system.admin"],
    sessionTimeout: 240, // 4 hours
    maxConcurrentSessions: 1,
    requiresMFA: true,
    requiresBiometric: true,
  },

  analyst: {
    role: "analyst",
    allowSelfRegistration: false,
    requiresApproval: true,
    requiresCredentials: true,
    allowedAuthMethods: ["credential"],
    sessionTimeout: 480, // 8 hours
    maxConcurrentSessions: 2,
    requiresMFA: true,
    requiresBiometric: false,
  },

  admin: {
    role: "admin",
    allowSelfRegistration: false,
    requiresApproval: true,
    requiresCredentials: true,
    allowedAuthMethods: ["credential"],
    sessionTimeout: 240, // 4 hours
    maxConcurrentSessions: 1,
    requiresMFA: true,
    requiresBiometric: true,
  },
};

/**
 * Determines if a role allows self-registration
 */
export function canSelfRegister(role: UserRole): boolean {
  const policy = ROLE_AUTH_POLICIES[role];
  return policy?.allowSelfRegistration ?? false;
}

/**
 * Determines if a role requires admin approval
 */
export function requiresAdminApproval(role: UserRole): boolean {
  const policy = ROLE_AUTH_POLICIES[role];
  return policy?.requiresApproval ?? false;
}

/**
 * Gets authentication policy for a role
 */
export function getAuthPolicy(role: UserRole): RoleAuthPolicy | null {
  return ROLE_AUTH_POLICIES[role] ?? null;
}

/**
 * Checks if restricted credentials are being used for unauthorized role
 */
export function isRestrictedCredential(
  username: string,
  requestedRole: UserRole,
): boolean {
  const policy = ROLE_AUTH_POLICIES[requestedRole];

  if (!policy?.restrictedCredentials) {
    return false;
  }

  return policy.restrictedCredentials.some((restricted) =>
    username.toLowerCase().includes(restricted.toLowerCase()),
  );
}

