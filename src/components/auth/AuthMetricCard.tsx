import React from "react";
import { cn } from "@/lib/utils";

interface AuthMetricCardProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

const AuthMetricCard: React.FC<AuthMetricCardProps> = ({ label, value, className }) => {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-4", className)}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
};

export default AuthMetricCard;
