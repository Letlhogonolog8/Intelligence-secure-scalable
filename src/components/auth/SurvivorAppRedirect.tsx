import React from "react";
import { Smartphone, ShieldCheck, ArrowUpRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { env } from "@/lib/env";

/**
 * Shown when a survivor signs in to the WEB portal. The web app is the
 * professional portal (counsellor, NGO, police, analyst, admin, CHW); survivors
 * have a dedicated, more private mobile app. Both share the same backend, so the
 * survivor's account, cases and messages are identical across web and app.
 */
export const SurvivorAppRedirect: React.FC = () => {
  const { signOut } = useAuth();
  const appUrl = env.VITE_MOBILE_APP_URL;

  return (
    <main className="min-h-screen bg-[#070d17] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-600/30">
          <Smartphone className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold">AEGIS Support is a mobile app</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          For your privacy and safety, survivor support lives in the dedicated AEGIS
          mobile app — with a calm, discreet design, quick-exit, offline access, and
          an emergency SOS. This website is the portal for support professionals.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <p className="text-xs text-slate-300">
            Your account is the same on both. Sign in on the app with the same username
            and passphrase — your cases and messages are already there.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {appUrl ? (
            <Button
              className="h-11 bg-gradient-to-r from-sky-500 to-blue-600 font-semibold"
              onClick={() => window.open(appUrl, "_blank", "noopener,noreferrer")}
            >
              Get the AEGIS Support app
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <p className="text-xs text-slate-400">
              Ask your support worker or coordinator how to install the AEGIS Support app.
            </p>
          )}
          <Button variant="outline" className="h-11 border-white/20 bg-white/5" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
};

export default SurvivorAppRedirect;
