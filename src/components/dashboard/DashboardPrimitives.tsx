import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const DashboardPage = ({
  accent,
  children,
}: {
  accent: "sky" | "rose" | "emerald" | "indigo" | "cyan" | "violet";
  children: ReactNode;
}) => {
  const accentStyles = {
    sky: "bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_90%_12%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    rose: "bg-[radial-gradient(circle_at_10%_14%,rgba(244,63,94,0.18),transparent_42%),radial-gradient(circle_at_88%_10%,rgba(59,130,246,0.18),transparent_44%),linear-gradient(160deg,#040812_0%,#0a1020_56%,#04070f_100%)]",
    emerald:
      "bg-[radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.16),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(6,182,212,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    indigo:
      "bg-[radial-gradient(circle_at_12%_16%,rgba(99,102,241,0.16),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    cyan: "bg-[radial-gradient(circle_at_12%_16%,rgba(8,145,178,0.18),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(99,102,241,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
    violet:
      "bg-[radial-gradient(circle_at_12%_16%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(59,130,246,0.14),transparent_44%),linear-gradient(160deg,#040812_0%,#081120_56%,#04070f_100%)]",
  } as const;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          accentStyles[accent],
        )}
      />
      <div className="pointer-events-none absolute inset-0 opacity-15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:132px_132px]" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        {children}
      </div>
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
  <section className="rounded-3xl border border-white/20 bg-slate-950/75 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur-xl sm:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-4">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-100">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm text-slate-200 sm:text-base">
            {description}
          </p>
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">{badges}</div>
        )}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  </section>
);

export const HeroBadge = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <span
    className={cn(
      "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
      className,
    )}
  >
    {children}
  </span>
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
    slate: "border-white/15 bg-white/[0.08] text-slate-100",
  } as const;

  return (
    <Card className="border-white/20 bg-slate-950/75 p-5 backdrop-blur-xl">
      <div
        className={cn(
          "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
          accents[accent ?? "slate"],
        )}
      >
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
          {helper ? (
            <div className="mt-2 text-sm text-slate-200">{helper}</div>
          ) : null}
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
  <Card
    className={cn(
      "border-white/20 bg-slate-950/75 shadow-xl backdrop-blur-xl",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-300">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </Card>
);

export const ListItemCard = ({
  title,
  subtitle,
  meta,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="rounded-2xl border border-white/15 bg-slate-900/80 p-4 shadow-[0_18px_36px_rgba(2,8,23,0.24)]">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{title}</div>
        {subtitle ? (
          <div className="text-xs text-slate-300">{subtitle}</div>
        ) : null}
      </div>
      {meta ? <div className="text-xs text-slate-200">{meta}</div> : null}
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
  <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.05] p-6 text-center">
    <div className="space-y-2">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-sm text-slate-200">{description}</p>
    </div>
    {guidance.length > 0 ? (
      <div className="mt-4 rounded-2xl border border-white/15 bg-slate-950/65 p-4 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          How to unblock live data
        </p>
        <ul className="mt-3 space-y-2 text-xs text-slate-200">
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
      <Button
        className="mt-4 border-white/20 bg-white/5 text-slate-50 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-300/70"
        variant="outline"
        size="sm"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

export const StatusPill = ({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "sky" | "indigo";
}) => {
  const tones = {
    slate: "border-white/15 bg-white/[0.08] text-slate-100",
    emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    amber: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    rose: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    sky: "border-sky-400/30 bg-sky-500/15 text-sky-100",
    indigo: "border-indigo-400/30 bg-indigo-500/15 text-indigo-100",
  } as const;

  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
};

const TILE_TONES = {
  slate: "border-white/15 bg-white/[0.08] text-slate-100",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
  violet: "border-purple-500/30 bg-purple-500/15 text-purple-300",
} as const;

export type TileTone = keyof typeof TILE_TONES;

/** Compact stat tile used inside sections: uppercase label, large value, optional helper text and icon chip. */
export const StatTile = ({
  label,
  value,
  sub,
  icon,
  tone = "slate",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: TileTone;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-white/10 bg-slate-900/70 p-4",
      className,
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
      </div>
      {icon ? (
        <div className={cn("rounded-2xl border p-3", TILE_TONES[tone])}>
          {icon}
        </div>
      ) : null}
    </div>
  </div>
);

/** Standard framed container for recharts content so every dashboard chart shares one look. */
export const ChartFrame = ({
  label,
  height = 280,
  className,
  children,
}: {
  label?: string;
  height?: number;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-white/10 bg-slate-900/70 p-4",
      className,
    )}
    style={{ height }}
    {...(label ? { role: "img", "aria-label": label } : {})}
  >
    {children}
  </div>
);

/**
 * Lighter glass panel for self-contained dashboard widgets (voice tools, lookup
 * bars). Renders the shared icon-chip header; content goes below.
 */
export const GlassPanel = ({
  icon,
  iconTone = "violet",
  title,
  subtitle,
  action,
  className,
  children,
}: {
  icon?: ReactNode;
  iconTone?: TileTone;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl",
      className,
    )}
  >
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        children ? "mb-4" : null,
      )}
    >
      <div className="flex items-center gap-2.5">
        {icon ? (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border",
              TILE_TONES[iconTone],
            )}
          >
            {icon}
          </div>
        ) : null}
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          {subtitle ? (
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const TAB_ACCENTS = {
  emerald: "border-emerald-500",
  sky: "border-sky-500",
  rose: "border-rose-500",
  indigo: "border-indigo-500",
  cyan: "border-cyan-500",
  violet: "border-purple-500",
} as const;

/** Underline tab strip shared by tabbed dashboards. */
export const TabBar = <T extends string>({
  tabs,
  active,
  onChange,
  accent = "emerald",
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (tab: T) => void;
  accent?: keyof typeof TAB_ACCENTS;
}) => (
  <div className="flex gap-1 border-b border-white/10 pb-1" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={active === tab.id}
        onClick={() => onChange(tab.id)}
        className={cn(
          "rounded-t px-4 py-2 text-sm font-bold capitalize transition-all",
          active === tab.id
            ? cn("border-b-2 text-white", TAB_ACCENTS[accent])
            : "text-slate-400 hover:text-white",
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

const BANNER_TONES = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-300",
} as const;

/** Inline status banner (connectivity, offline queue, transient notices). */
export const NoticeBanner = ({
  tone = "sky",
  icon,
  className,
  children,
}: {
  tone?: keyof typeof BANNER_TONES;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold",
      BANNER_TONES[tone],
      className,
    )}
  >
    {icon}
    <div>{children}</div>
  </div>
);
