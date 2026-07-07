import { useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile, type UserProfile } from "@/data/aegisData";
import { hasSupabase } from "@/lib/env";
import { requiresMfaForRole, ROLE_AUTH_POLICIES } from "@/lib/roleAuthPolicy";
import { fetchMfaAssurance } from "@/lib/supabase";
import type { UserRole } from "@/types/auth";

interface AuthGateProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
  loginRole?: UserRole;
  unauthorizedRedirect?: string;
}

export const AuthGate = ({
  children,
  requiredRoles,
  loginRole,
  unauthorizedRedirect,
}: AuthGateProps) => {
  const { user, loading, signOut } = useAuth();
  const {
    data: fetchedProfile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useUserProfile(user?.id);

  // A transient profile-read failure (network blip, token-rotation window
  // where RLS briefly returns no rows) must not bounce a signed-in responder
  // back to /auth mid-shift. Remember the last profile successfully loaded
  // for this user and keep serving it while the session is still valid; the
  // next successful refetch re-applies real approval/active checks.
  const lastGoodProfile = useRef<{
    userId: string;
    profile: UserProfile;
  } | null>(null);
  if (user && fetchedProfile) {
    lastGoodProfile.current = { userId: user.id, profile: fetchedProfile };
  }
  const profile =
    fetchedProfile ??
    (user && lastGoodProfile.current?.userId === user.id
      ? lastGoodProfile.current.profile
      : fetchedProfile);
  const profileRole = profile?.role as UserRole | undefined;
  const requiresMfa = profileRole ? requiresMfaForRole(profileRole) : false;
  const {
    data: assurance,
    isLoading: assuranceLoading,
    isError: assuranceError,
  } = useQuery({
    queryKey: ["auth-mfa-assurance", user?.id],
    queryFn: async () => {
      const result = await fetchMfaAssurance();
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(
      user && profileRole && profileRole !== "survivor" && requiresMfa,
    ),
    retry: false,
    staleTime: 15000,
  });

  // Enforce the role's absolute session lifetime (ROLE_AUTH_POLICIES
  // sessionTimeout was previously displayed at sign-in but never enforced).
  // Measured from Supabase's last_sign_in_at so a page refresh or token
  // rotation does not extend the session.
  useEffect(() => {
    if (!user || !profileRole) return;
    const timeoutMinutes = ROLE_AUTH_POLICIES[profileRole]?.sessionTimeout;
    if (!timeoutMinutes) return;
    const signedInAt = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).getTime()
      : NaN;
    if (Number.isNaN(signedInAt)) return;

    const expire = () => {
      toast.warning("Your session has expired — please sign in again.");
      void signOut();
    };
    const msLeft = signedInAt + timeoutMinutes * 60_000 - Date.now();
    if (msLeft <= 0) {
      expire();
      return;
    }
    const id = window.setTimeout(expire, msLeft);
    return () => window.clearTimeout(id);
  }, [user, profileRole, signOut]);

  const authRedirect = loginRole ? `/auth/verify?role=${loginRole}` : "/auth";
  const deniedRedirect = unauthorizedRedirect ?? "/app";

  if (!hasSupabase) {
    return (
      <div
        className="min-h-screen bg-slate-950 text-white flex items-center justify-center"
        aria-busy="true"
      >
        <div
          className="flex flex-col items-center gap-3 text-slate-400"
          role="status"
          aria-live="polite"
        >
          <span className="text-xs tracking-widest uppercase">
            Authentication unavailable
          </span>
        </div>
      </div>
    );
  }

  if (
    loading ||
    (user && profileLoading) ||
    (requiresMfa && assuranceLoading)
  ) {
    return (
      <div
        className="min-h-screen bg-slate-950 text-white flex items-center justify-center"
        aria-busy="true"
      >
        <div
          className="flex flex-col items-center gap-3 text-slate-400"
          role="status"
          aria-live="polite"
        >
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <span className="text-xs tracking-widest uppercase">
            Checking access
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={authRedirect} replace />;
  }

  if (!profile) {
    // Signed in but the profile read failed (as opposed to a definitive
    // "no profile row" result): offer a retry instead of ejecting the user.
    if (profileError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div
            className="flex flex-col items-center gap-4 text-slate-400"
            role="alert"
          >
            <span className="text-xs tracking-widest uppercase">
              Connection interrupted — couldn't verify your access
            </span>
            <button
              type="button"
              onClick={() => void refetchProfile()}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <Navigate to={authRedirect} replace />;
  }

  const isPrivilegedRole = profile.role !== "survivor";
  const isApproved = !isPrivilegedRole || profile.approvalStatus === "approved";

  if (!profile.isActive || !isApproved) {
    return <Navigate to={authRedirect} replace />;
  }

  if (requiredRoles && !requiredRoles.includes(profile.role as UserRole)) {
    return <Navigate to={deniedRedirect} replace />;
  }

  if (requiresMfa) {
    if (assuranceError) {
      return <Navigate to={authRedirect} replace />;
    }

    if (assurance?.currentLevel !== "aal2") {
      return <Navigate to={`/auth/verify?role=${profile.role}`} replace />;
    }
  }

  return <>{children}</>;
};
