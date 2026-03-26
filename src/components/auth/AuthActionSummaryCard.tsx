import React from "react";
import { cn } from "@/lib/utils";

interface AuthActionSummaryCardProps {
  title: string;
  description: string;
  className?: string;
}

const AuthActionSummaryCard: React.FC<AuthActionSummaryCardProps> = ({
  title,
  description,
  className,
}) => {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-4", className)}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
};

export default AuthActionSummaryCard;
