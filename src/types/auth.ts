/**
 * Enterprise Authentication Types
 * Defines core authentication and authorization types for the system
 */

export type UserRole = "admin" | "counselor" | "survivor" | "ngo" | "police" | "analyst" | "chw";

export type AuthMethod = "otp" | "credential" | "biometric";

export interface AuthCredential {
  username: string;
  password: string;
  roleId: UserRole;
  requiresBiometric?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  legalDesignation?: string;
  commsChannel?: string;
  systemAlias: string;
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  organizationId?: string;
  requiresBiometric: boolean;
  sessionToken?: string;
  sessionExpiresAt?: Date;
}

export interface RoleAuthPolicy {
  role: UserRole;
  allowSelfRegistration: boolean;
  requiresApproval: boolean;
  requiresCredentials: boolean;
  allowedAuthMethods: AuthMethod[];
  restrictedCredentials?: string[];
  sessionTimeout: number; // in minutes
  maxConcurrentSessions: number;
  requiresMFA: boolean;
  requiresBiometric: boolean;
}

export interface AuthSession {
  id: string;
  userId: string;
  userRole: UserRole;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
  isValid: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginAttempt {
  username: string;
  timestamp: Date;
  success: boolean;
  roleAttempted: UserRole;
  ipAddress: string;
}

export interface SecurityAudit {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  status: "success" | "failure";
  details: Record<string, unknown>;
  timestamp: Date;
  ipAddress: string;
}
