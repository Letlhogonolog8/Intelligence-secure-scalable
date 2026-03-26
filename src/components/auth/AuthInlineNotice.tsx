import React from "react";
import { cn } from "@/lib/utils";

interface AuthInlineNoticeProps {
  children: React.ReactNode;
  className?: string;
}

const AuthInlineNotice: React.FC<AuthInlineNoticeProps> = ({ children, className }) => {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300", className)}>
      {children}
    </div>
  );
};

export default AuthInlineNotice;
