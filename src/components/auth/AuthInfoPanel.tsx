import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthInfoPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

const AuthInfoPanel: React.FC<AuthInfoPanelProps> = ({
  icon: Icon,
  title,
  description,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-slate-900/60 p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/40 bg-purple-500/10">
          <Icon className="h-5 w-5 text-purple-200" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
};

export default AuthInfoPanel;
