import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  Activity,
  Database,
  Server,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) || "/api"
).replace(/\/+$/, "");

interface HealthResult {
  ok: boolean;
  latencyMs: number;
  timestamp: string | null;
}

async function pingHealth(): Promise<HealthResult> {
  const started = performance.now();
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Math.round(performance.now() - started);
    const body = (await res.json().catch(() => ({}))) as {
      timestamp?: string;
    };
    return { ok: res.ok, latencyMs, timestamp: body.timestamp ?? null };
  } catch {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      timestamp: null,
    };
  }
}

const SERVICES = [
  "Authentication Service",
  "Messaging Service",
  "Translation Service",
  "Notification Service",
  "USSD Gateway",
  "WhatsApp Gateway",
  "AI Engine",
];

function Kpi({
  label,
  value,
  sub,
  tone = "sky",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "sky" | "emerald" | "amber" | "rose" | "slate";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones: Record<string, string> = {
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    slate: "border-white/10 bg-white/5 text-slate-300",
  };
  return (
    <Card className="border-white/10 bg-slate-900/40 p-5 backdrop-blur-md">
      <div
        className={`mb-3 inline-flex rounded-xl border p-2.5 ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}

export default function SystemMonitoring({
  totalUsers,
  activeUsers,
  totalOrganizations,
  sosToday,
}: {
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  sosToday?: number | null;
}) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: pingHealth,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const apiUp = data?.ok ?? false;
  const overall = isLoading ? "Checking…" : apiUp ? "Operational" : "Degraded";

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="API Health"
          value={isLoading ? "…" : apiUp ? "Healthy" : "Down"}
          sub={data ? `${data.latencyMs} ms` : "Probing"}
          tone={apiUp ? "emerald" : "rose"}
          icon={Server}
        />
        <Kpi
          label="System Status"
          value={overall}
          sub={data?.timestamp ? "Live check" : "—"}
          tone={apiUp ? "emerald" : "amber"}
          icon={Activity}
        />
        <Kpi
          label="Database"
          value={apiUp ? "Reachable" : "Unknown"}
          sub="Via API health"
          tone={apiUp ? "emerald" : "slate"}
          icon={Database}
        />
        <Kpi
          label="Active Users"
          value={String(activeUsers)}
          sub={`${totalUsers} total`}
          tone="sky"
          icon={Wifi}
        />
        <Kpi
          label="Organizations"
          value={String(totalOrganizations)}
          sub="Partner network"
          tone="sky"
          icon={Server}
        />
        <Kpi
          label="SOS Today"
          value={sosToday == null ? "—" : String(sosToday)}
          sub={sosToday == null ? "No live feed" : "Emergency alerts"}
          tone={sosToday && sosToday > 0 ? "rose" : "slate"}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Service health */}
        <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Service health</h2>
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
          <div className="space-y-2.5">
            {SERVICES.map((svc) => (
              <div
                key={svc}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-200">
                  {svc}
                </span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-bold ${
                    isLoading
                      ? "text-slate-400"
                      : apiUp
                        ? "text-emerald-300"
                        : "text-rose-300"
                  }`}
                >
                  {isLoading ? (
                    "Checking…"
                  ) : apiUp ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" /> Unreachable
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Status reflects the live backend health check (one probe to the
            shared API). Per-service probes use the readiness endpoint when
            exposed to the portal.
          </p>
        </Card>

        {/* Live traffic */}
        <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-black text-white">Live traffic</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Registered users" value={String(totalUsers)} />
            <Stat label="Active users" value={String(activeUsers)} />
            <Stat label="Organizations" value={String(totalOrganizations)} />
            <Stat
              label="SOS today"
              value={sosToday == null ? "—" : String(sosToday)}
            />
            <Stat
              label="Messages / min"
              value="—"
              hint="Requires metrics feed"
            />
            <Stat
              label="Realtime conns"
              value="—"
              hint="Requires metrics feed"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
