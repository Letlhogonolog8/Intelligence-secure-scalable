import React from "react";
import { cn } from "@/lib/utils";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({ children, className }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a1020] text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_18%,rgba(30,64,175,0.32),transparent_46%),radial-gradient(circle_at_85%_14%,rgba(225,29,72,0.2),transparent_55%),radial-gradient(circle_at_30%_88%,rgba(148,163,184,0.18),transparent_46%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(145deg,rgba(7,11,22,0.96),rgba(5,9,18,0.98))]" />
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:120px_120px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-12 pt-24">
        <div className={cn("w-full max-w-6xl", className)}>{children}</div>
      </div>
    </div>
  );
};

export default AuthSplitLayout;
