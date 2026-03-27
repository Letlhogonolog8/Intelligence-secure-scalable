import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const DashboardPage = ({ accent, children }: { accent: "sky" | "rose" | "emerald" | "indigo" | "cyan" | "violet"; children: ReactNode }) => {
  const accentStyles = {
    sky: "bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_90%_12%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    rose: "bg-[radial-gradient(circle_at_10%_14%,rgba(244,63,94,0.18),transparent_42%),radial-gradient(circle_at_88%_10%,rgba(59,130,246,0.18),transparent_44%),linear-gradient(160deg,#040812_0%,#0a1020_56%,#04070f_100%)]",
    emerald: "bg-[radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.16),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(6,182,212,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    indigo: "bg-[radial-gradient(circle_at_12%_16%,rgba(99,102,241,0.16),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    cyan: "bg-[radial-gradient(circle_at_12%_16%,rgba(8,145,178,0.18),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(99,102,241,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    violet: "bg-[radial-gradient(circle_at_12%_16%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(59,130,246,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
  } as const;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className={cn("pointer-events-none absolute inset-0", accentStyles[accent])} />
      <div className="pointer-events-none absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:132px_132px]" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
    </div>
  );
};

export const DashboardHero = ({
  eyebrow,
  title,
  description,
  badges = [],
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode[];
  actions?: ReactNode;
}) => (
  <section className="rounded-3xl border border-white/15 bg-slate-950/65 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur-xl sm:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-4">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-200">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">{description}</p>
        </div>
        {badges.length > 0 && <div className="flex flex-wrap gap-2">{badges}</div>}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  </section>
);

export const HeroBadge = ({ className, children }: { className?: string; children: ReactNode }) => (
  <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", className)}>{children}</span>
);

export const MetricCard = ({
  label,
  value,
  helper,
  accent,
  loading,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  accent?: "sky" | "rose" | "emerald" | "indigo" | "amber" | "slate";
  loading?: boolean;
}) => {
  const accents = {
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-200",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    slate: "border-white/10 bg-white/[0.03] text-slate-200",
  } as const;

  return (
    <Card className="border-white/15 bg-slate-950/65 p-5 backdrop-blur-xl">
      <div className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]", accents[accent ?? "slate"])}>
        {label}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-8 w-24 bg-white/10" />
          {helper ? <Skeleton className="mt-3 h-4 w-32 bg-white/10" /> : null}
        </>
      ) : (
        <>
          <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
          {helper ? <div className="mt-2 text-sm text-slate-300">{helper}</div> : null}
        </>
      )}
    </Card>
  );
};

export const SectionCard = ({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <Card className={cn("border-white/15 bg-slate-950/65 shadow-xl backdrop-blur-xl", className)}>
    <div className="flex items-start justify-between gap-4 border-b border-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </Card>
);

export const ListItemCard = ({ title, subtitle, meta, action }: { title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; action?: ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{title}</div>
        {subtitle ? <div className="text-xs text-slate-400">{subtitle}</div> : null}
      </div>
      {meta ? <div className="text-xs text-slate-300">{meta}</div> : null}
    </div>
    {action ? <div className="mt-3 flex justify-end">{action}</div> : null}
  </div>
);

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
  guidance = [],
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  guidance?: string[];
}) => (
  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
    <div className="space-y-2">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
    {guidance.length > 0 ? (
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">How to unblock live data</p>
        <ul className="mt-3 space-y-2 text-xs text-slate-300">
          {guidance.map((entry) => (
            <li key={entry} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
    {actionLabel && onAction ? (
      <Button className="mt-4" variant="outline" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

export const StatusPill = ({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo" }) => {
  const tones = {
    slate: "border-white/10 bg-white/[0.03] text-slate-200",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-200",
    indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
  } as const;

  return <span className={cn("rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]", tones[tone])}>{children}</span>;
};
