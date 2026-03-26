import React from "react";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { LucideIcon } from "lucide-react";

interface AuthTopBarProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actionLabel: string;
  onActionClick: () => void;
  emergencyLabel?: string;
  onEmergencyClick?: () => void;
}

const AuthTopBar: React.FC<AuthTopBarProps> = ({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onActionClick,
  emergencyLabel = "Emergency",
  onEmergencyClick,
}) => {
  return (
    <div className="fixed top-0 z-40 w-full border-b border-white/5 bg-[#0a1020]/85 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-slate-700 to-rose-500 shadow-lg shadow-blue-500/30">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-blue-200/70">AEGIS-AI</p>
              <h1 className="text-lg font-semibold">{title}</h1>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <LanguageSwitcher variant="compact" />
            <div className="flex items-center gap-3">
              {onEmergencyClick && (
                <Button
                  variant="outline"
                  className="hidden sm:inline-flex rounded-full border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                  onClick={onEmergencyClick}
                >
                  {emergencyLabel}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onActionClick}
                className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthTopBar;
