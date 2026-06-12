import React from "react";
import { cn } from "@/lib/utils";

interface HighlightItem {
  label: string;
  value: React.ReactNode;
}

interface AuthContextIntroProps {
  badge: string;
  title: string;
  description: string;
  highlights?: HighlightItem[];
  children?: React.ReactNode;
  className?: string;
}

const AuthContextIntro: React.FC<AuthContextIntroProps> = ({
  badge,
  title,
  description,
  highlights = [],
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-xl shadow-purple-500/10",
        className,
      )}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-purple-200">
        {badge}
      </div>
      <h2 className="mt-4 text-3xl font-semibold">{title}</h2>
      <p className="mt-3 leading-relaxed text-slate-300">{description}</p>

      {highlights.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {item.label}
              </p>
              <div className="mt-2 text-sm text-slate-200">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
};

export default AuthContextIntro;
