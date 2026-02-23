/**
 * Data utility functions for standardizing property access across the app
 */

export interface UserProfile {
  id?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string;
  organizationId?: string;
  isActive?: boolean;
}

/**
 * Get the display name from a user profile, handling multiple property name variations
 */
export const getDisplayName = (profile?: UserProfile | null): string => {
  if (!profile) return "User";
  return profile.full_name || profile.fullName || profile.name || profile.email?.split("@")[0] || "User";
};

/**
 * Get the user's role from a profile
 */
export const getUserRole = (profile?: UserProfile | null): string => {
  return profile?.role || "analyst";
};

/**
 * Check if a profile is active
 */
export const isProfileActive = (profile?: UserProfile | null): boolean => {
  return profile?.isActive !== false;
};

/**
 * Get organization ID from profile
 */
export const getOrganizationId = (profile?: UserProfile | null): string | null => {
  return profile?.organizationId || null;
};
