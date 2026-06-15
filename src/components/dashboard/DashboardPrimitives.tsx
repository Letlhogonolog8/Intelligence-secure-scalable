import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Per-accent aurora glow blobs layered over the shared midnight base. */
const AURORA_ACCENTS = {
  sky: "bg-[radial-gradient(60%_55%_at_8%_0%,rgba(56,189,248,0.22),transparent_60%),radial-gradient(55%_50%_at_100%_0%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(70%_60%_at_50%_120%,rgba(99,102,241,0.16),transparent_60%)]",
  rose: "bg-[radial-gradient(60%_55%_at_8%_0%,rgba(244,63,94,0.24),transparent_60%),radial-gradient(55%_50%_at_100%_0%,rgba(217,70,239,0.18),transparent_60%),radial-gradient(70%_60%_at_50%_120%,rgba(129,140,248,0.16),transparent_60%)]",
  emerald:
    "bg-[radial-gradient(60%_55%_at_8%_0%,rgba(16,185,129,0.22),transparent_60%),radial-gradient(55%_50%_at_100%_0%,rgba(45,212,191,0.18),transparent_60%),radial-gradient(70%_60%_at_50%_120%,rgba(34,211,238,0.16),transparent_60%)]",
  indigo:
    "bg-[radial-gradient(60%_55%_at_8%_0%,rgba(129,140,248,0.24),transparent_60%),radial-gradient(55%_50%_at_100%_0%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(70%_60%_at_50%_120%,rgba(168,85,247,0.16),transparent_60%)]",
  cyan: "bg-[radial-gradient(60%_55%_at_8%_0%,rgba(34,211,238,0.22),transparent_60%),radial-gradient(55%_50%_at_100%_0%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(70%_60%_at_50%_120%,rgba(56,189,248,0.16),transparent_60%)]",
  violet:
    "bg-[radial-gradient(60%_55%_at_8%_0%,rgba(168,85,247,0.24),transparent_60%),radial-gradient(55%_50%_at_100%_0%,rgba(236,72,153,0.18),transparent_60%),radial-gradient(70%_60%_at_50%_120%,rgba(99,102,241,0.16),transparent_60%)]",
} as const;

export const DashboardPage = ({
  accent,
  children,
}: {
  accent: keyof typeof AURORA_ACCENTS;
  children: ReactNode;
}) => (
  <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(165deg,#0A0A1F_0%,#0D0A22_45%,#070510_100%)] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
    {/* Aurora glow layer (per role accent) */}
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-90 blur-[2px]",
        AURORA_ACCENTS[accent],
      )}
    />
    {/* Fine grid texture, kept faint for breathing room */}
    <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.9)_1px,transparent_1px)] bg-[size:148px_148px]" />
    <div className="relative z-10 mx-auto flex w-full max-w-[1800px] flex-col gap-7">
      {children}
    </div>
  </div>
);

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
  <div className="rounded-[30px] bg-gradient-to-br from-violet-500/40 via-fuchsia-500/15 to-cyan-400/40 p-px shadow-[0_30px_90px_-30px_rgba(124,58,237,0.55)]">
    <section className="relative overflow-hidden rounded-[29px] bg-[#0B0A1A]/92 p-6 backdrop-blur-2xl sm:p-9">
      {/* aurora glow accent */}
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-violet-100">
            {eyebrow}
          </div>
          <div className="space-y-3">
            <h1 className="bg-gradient-to-r from-white via-white to-violet-200/90 bg-clip-text text-4xl font-light leading-[1.1] tracking-tight text-transparent sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
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
  </div>
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

  const accentBars = {
    sky: "from-sky-400 to-cyan-300",
    rose: "from-rose-400 to-fuchsia-400",
    emerald: "from-emerald-400 to-teal-300",
    indigo: "from-indigo-400 to-violet-400",
    amber: "from-amber-400 to-orange-300",
    slate: "from-slate-400 to-slate-300",
  } as const;

  return (
    <Card className="group relative overflow-hidden rounded-3xl border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.015] p-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_28px_70px_-22px_rgba(124,58,237,0.45)]">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80",
          accentBars[accent ?? "slate"],
        )}
      />
      <div
        className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
          accents[accent ?? "slate"],
        )}
      >
        {label}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-9 w-24 bg-white/10" />
          {helper ? <Skeleton className="mt-3 h-4 w-32 bg-white/10" /> : null}
        </>
      ) : (
        <>
          <div className="mt-4 text-4xl font-light tracking-tight text-white">
            {value}
          </div>
          {helper ? (
            <div className="mt-2 text-sm text-slate-300">{helper}</div>
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
      "overflow-hidden rounded-3xl border-white/10 bg-slate-950/55 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.85)] backdrop-blur-xl",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
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
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{title}</div>
        {subtitle ? (
          <div className="text-xs text-slate-400">{subtitle}</div>
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
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
    {actionLabel && onAction ? (
      <Button
        className="mt-4 border-white/20 bg-white/5 text-slate-50 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-300/70"
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
      "rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors duration-200 hover:border-white/20",
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
      "rounded-2xl border border-white/10 bg-white/[0.02] p-4",
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
      "rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl",
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
  emerald: "border-emerald-400",
  sky: "border-sky-400",
  rose: "border-rose-400",
  indigo: "border-indigo-400",
  cyan: "border-cyan-400",
  violet: "border-purple-400",
} as const;

const TAB_ACTIVE_FILL = {
  emerald: "from-emerald-500/20 to-teal-400/5",
  sky: "from-sky-500/20 to-cyan-400/5",
  rose: "from-rose-500/20 to-fuchsia-400/5",
  indigo: "from-indigo-500/20 to-violet-400/5",
  cyan: "from-cyan-500/20 to-sky-400/5",
  violet: "from-violet-500/20 to-fuchsia-400/5",
} as const;

/**
 * Underline tab strip shared by tabbed dashboards. Implements the WAI-ARIA
 * tabs pattern: roving tabindex plus Arrow/Home/End keyboard navigation with
 * automatic activation. Scrolls horizontally rather than wrapping on narrow
 * viewports.
 */
export const TabBar = <T extends string>({
  tabs,
  active,
  onChange,
  accent = "emerald",
  ariaLabel = "Dashboard sections",
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (tab: T) => void;
  accent?: keyof typeof TAB_ACCENTS;
  ariaLabel?: string;
}) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === active);
    if (current < 0) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        activate(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        activate(current - 1);
        break;
      case "Home":
        event.preventDefault();
        activate(0);
        break;
      case "End":
        event.preventDefault();
        activate(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-white/10 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-t-xl border-b-2 px-4 py-2.5 text-sm font-semibold capitalize outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/40",
              isActive
                ? cn(
                    "bg-gradient-to-b text-white",
                    TAB_ACTIVE_FILL[accent],
                    TAB_ACCENTS[accent],
                  )
                : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

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
