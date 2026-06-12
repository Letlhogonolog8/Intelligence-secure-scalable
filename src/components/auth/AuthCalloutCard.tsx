import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthCalloutCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}

const AuthCalloutCard: React.FC<AuthCalloutCardProps> = ({
  title,
  description,
  icon: Icon,
  className,
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4",
        className,
      )}
    >
      <div className={cn("flex items-start gap-3", !Icon && "block")}>
        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10">
            <Icon className="h-4 w-4 text-purple-200" />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default AuthCalloutCard;
