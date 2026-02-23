import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { hasSupabase } from "@/lib/env";

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (!hasSupabase) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-slate-400" role="status" aria-live="polite">
          <span className="text-xs tracking-widest uppercase">Authentication unavailable</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-slate-400" role="status" aria-live="polite">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <span className="text-xs tracking-widest uppercase">Checking access</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return <Navigate to="/auth" replace />;
};
