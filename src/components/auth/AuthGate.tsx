import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/data/aegisData";
import { hasSupabase } from "@/lib/env";
import { requiresMfaForRole } from "@/lib/roleAuthPolicy";
import { fetchMfaAssurance } from "@/lib/supabase";
import type { UserRole } from "@/types/auth";

interface AuthGateProps {
  children: ReactNode
  requiredRoles?: UserRole[]
  loginRole?: UserRole
  unauthorizedRedirect?: string
}

export const AuthGate = ({ children, requiredRoles, loginRole, unauthorizedRedirect }: AuthGateProps) => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const profileRole = profile?.role as UserRole | undefined;
  const requiresMfa = profileRole ? requiresMfaForRole(profileRole) : false;
  const { data: assurance, isLoading: assuranceLoading, isError: assuranceError } = useQuery({
    queryKey: ["auth-mfa-assurance", user?.id],
    queryFn: async () => {
      const result = await fetchMfaAssurance();
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(user && profileRole && profileRole !== "survivor" && requiresMfa),
    retry: false,
    staleTime: 15000,
  });

  const authRedirect = loginRole ? `/auth/verify?role=${loginRole}` : "/auth"
  const deniedRedirect = unauthorizedRedirect ?? "/app"

  if (!hasSupabase) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-slate-400" role="status" aria-live="polite">
          <span className="text-xs tracking-widest uppercase">Authentication unavailable</span>
        </div>
      </div>
    );
  }

  if (loading || (user && profileLoading) || (requiresMfa && assuranceLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-slate-400" role="status" aria-live="polite">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <span className="text-xs tracking-widest uppercase">Checking access</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
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
