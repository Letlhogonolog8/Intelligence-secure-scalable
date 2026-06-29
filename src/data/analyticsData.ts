/**
 * Analyst Intelligence data hooks — back the Data Analyst Portal panels that
 * are powered by the `analyst_intelligence_tables` migration. Every fetcher
 * degrades gracefully (returns an empty result) when Supabase is unconfigured
 * or the table has not been migrated yet, so the portal renders its sample
 * fallback rather than erroring.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

type Row = Record<string, unknown>;

const num = (v: unknown, d = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || d;
const str = (v: unknown, d = "") =>
  typeof v === "string" ? v : v == null ? d : String(v);

/** Run a select, returning [] on any error / missing table / no Supabase. */
const safeSelect = async (
  table: string,
  columns: string,
  order?: { column: string; ascending?: boolean },
): Promise<Row[]> => {
  if (!hasSupabase) return [];
  try {
    let query = supabase.from(table).select(columns);
    if (order)
      query = query.order(order.column, { ascending: order.ascending ?? true });
    const { data, error } = await query;
    if (error) return [];
    return (data as Row[]) ?? [];
  } catch {
    return [];
  }
};

const listOptions = {
  staleTime: 30000,
  refetchInterval: 60000,
} as const;

const useAnalytics = <T>(key: string, fn: () => Promise<T>, enabled = true) =>
  useQuery({
    queryKey: ["aegis", "analytics", key],
    queryFn: fn,
    enabled,
    ...listOptions,
  });

/* ------------------------------ Age groups ------------------------------ */
export interface AgeGroupRow {
  label: string;
  value: number;
}
export const useIncidentAgeGroups = () =>
  useAnalytics<AgeGroupRow[]>("ageGroups", async () =>
    (
      await safeSelect("incident_age_groups", "label,value,sort_order", {
        column: "sort_order",
      })
    ).map((r) => ({ label: str(r.label), value: num(r.value) })),
  );

/* --------------------------- Reporting channels --------------------------- */
export interface ChannelRow {
  name: string;
  value: number;
  pct: number;
  color: string;
}
export const useReportingChannels = () =>
  useAnalytics<ChannelRow[]>("channels", async () =>
    (
      await safeSelect(
        "reporting_channels",
        "channel,value,pct,color,sort_order",
        { column: "sort_order" },
      )
    ).map((r) => ({
      name: str(r.channel),
      value: num(r.value),
      pct: num(r.pct),
      color: str(r.color, "#64748b"),
    })),
  );

/* --------------------------- Hotspot emergence --------------------------- */
export interface EmergenceRow {
  d: string;
  newH: number;
  esc: number;
  deesc: number;
}
export const useHotspotEmergence = () =>
  useAnalytics<EmergenceRow[]>("emergence", async () =>
    (
      await safeSelect(
        "hotspot_emergence",
        "bucket_label,new_hotspots,escalated,deescalated,sort_order",
        { column: "sort_order" },
      )
    ).map((r) => ({
      d: str(r.bucket_label),
      newH: num(r.new_hotspots),
      esc: num(r.escalated),
      deesc: num(r.deescalated),
    })),
  );

/* ---------------------------- Forecast metrics ---------------------------- */
export interface ForecastMetrics {
  accuracy: number;
  growth: number;
  highRiskRegions: number;
  projectedDemand: number;
  modelConfidence: number;
}
export const useForecastMetrics = () =>
  useAnalytics<ForecastMetrics | null>("forecastMetrics", async () => {
    const rows = await safeSelect(
      "forecast_metrics",
      "forecast_accuracy,expected_growth,high_risk_regions,projected_demand,model_confidence",
    );
    const r = rows[0];
    if (!r) return null;
    return {
      accuracy: num(r.forecast_accuracy),
      growth: num(r.expected_growth),
      highRiskRegions: num(r.high_risk_regions),
      projectedDemand: num(r.projected_demand),
      modelConfidence: num(r.model_confidence),
    };
  });

/* --------------------------- Forecast scenarios --------------------------- */
export interface ScenarioRow {
  name: string;
  totalCases: number;
  changePct: number | null;
  confidence: number;
  color: string;
}
export const useForecastScenarios = () =>
  useAnalytics<ScenarioRow[]>("scenarios", async () =>
    (
      await safeSelect(
        "forecast_scenarios",
        "name,total_cases,change_pct,confidence,color,sort_order",
        { column: "sort_order" },
      )
    ).map((r) => ({
      name: str(r.name),
      totalCases: num(r.total_cases),
      changePct: r.change_pct == null ? null : num(r.change_pct),
      confidence: num(r.confidence),
      color: str(r.color, "#a855f7"),
    })),
  );

/* --------------------------- Forecast variables --------------------------- */
export interface VariableRow {
  name: string;
  impact: string;
}
export const useForecastVariables = () =>
  useAnalytics<VariableRow[]>("variables", async () =>
    (
      await safeSelect("forecast_variables", "name,impact,sort_order", {
        column: "sort_order",
      })
    ).map((r) => ({ name: str(r.name), impact: str(r.impact, "Medium") })),
  );

/* ----------------------------- Analyst reports ----------------------------- */
export interface ReportRow {
  id: string;
  name: string;
  type: string;
  region: string;
  status: string;
  owner: string;
  scheduled: boolean;
  frequency: string;
  recipients: number;
  generatedAt: string;
  nextDelivery: string;
}
export const useAnalystReports = () =>
  useAnalytics<ReportRow[]>("reports", async () =>
    (
      await safeSelect(
        "analyst_reports",
        "id,name,type,region,status,owner,scheduled,frequency,recipients,generated_at,next_delivery",
        { column: "generated_at", ascending: false },
      )
    ).map((r) => ({
      id: str(r.id),
      name: str(r.name),
      type: str(r.type),
      region: str(r.region),
      status: str(r.status),
      owner: str(r.owner),
      scheduled: Boolean(r.scheduled),
      frequency: str(r.frequency),
      recipients: num(r.recipients),
      generatedAt: str(r.generated_at),
      nextDelivery: str(r.next_delivery),
    })),
  );

/* ----------------------------- Dataset catalog ----------------------------- */
export interface DatasetRow {
  name: string;
  description: string;
  source: string;
  region: string;
  records: number;
  freshnessMinutes: number;
  quality: number;
  status: string;
  connector: string;
  schema: string;
}
export const useDatasetCatalog = () =>
  useAnalytics<DatasetRow[]>("datasets", async () =>
    (
      await safeSelect(
        "dataset_catalog",
        "name,description,source,region,records,freshness_minutes,quality_score,status,connector_status,schema_status,sort_order",
        { column: "sort_order" },
      )
    ).map((r) => ({
      name: str(r.name),
      description: str(r.description),
      source: str(r.source),
      region: str(r.region, "All Regions"),
      records: num(r.records),
      freshnessMinutes: num(r.freshness_minutes),
      quality: num(r.quality_score),
      status: str(r.status, "Live"),
      connector: str(r.connector_status, "Connected"),
      schema: str(r.schema_status, "Up to date"),
    })),
  );

/* -------------------------- Data quality alerts -------------------------- */
export interface DqAlertRow {
  name: string;
  description: string;
  severity: string;
}
export const useDataQualityAlerts = () =>
  useAnalytics<DqAlertRow[]>("dqAlerts", async () =>
    (
      await safeSelect(
        "data_quality_alerts",
        "dataset_name,description,severity",
        { column: "created_at", ascending: false },
      )
    ).map((r) => ({
      name: str(r.dataset_name),
      description: str(r.description),
      severity: str(r.severity, "Low"),
    })),
  );

/* --------------------------- Case categories --------------------------- */
const CATEGORY_COLORS = [
  "#a855f7",
  "#3b82f6",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#64748b",
];
export interface CategoryRow {
  name: string;
  value: number;
  pct: number;
  color: string;
}
/** Live category breakdown aggregated from `incidents` via case_category_totals. */
export const useCaseCategories = () =>
  useAnalytics<CategoryRow[]>("caseCategories", async () => {
    const rows = await safeSelect("case_category_totals", "category,total", {
      column: "total",
      ascending: false,
    });
    const total = rows.reduce((s, r) => s + num(r.total), 0) || 1;
    return rows.map((r, i) => ({
      name: str(r.category),
      value: num(r.total),
      pct: Math.round((num(r.total) / total) * 1000) / 10,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  });

/* ---------------------------- Analyst settings ---------------------------- */
export type AnalystSettings = Record<string, unknown>;

export const useAnalystSettings = (userId?: string | null) =>
  useQuery({
    queryKey: ["aegis", "analytics", "settings", userId ?? "anon"],
    enabled: Boolean(userId) && hasSupabase,
    staleTime: 30000,
    queryFn: async (): Promise<AnalystSettings> => {
      if (!hasSupabase || !userId) return {};
      try {
        const { data, error } = await supabase
          .from("analyst_settings")
          .select("settings")
          .eq("user_id", userId)
          .maybeSingle();
        if (error || !data) return {};
        return ((data as Row).settings as AnalystSettings) ?? {};
      } catch {
        return {};
      }
    },
  });

export const saveAnalystSettings = async (
  userId: string,
  settings: AnalystSettings,
): Promise<{ error: unknown }> => {
  if (!hasSupabase || !userId)
    return { error: new Error("Settings persistence unavailable") };
  try {
    const table = supabase.from("analyst_settings") as unknown as {
      upsert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
    const { error } = await table.upsert({
      user_id: userId,
      settings,
      updated_at: new Date().toISOString(),
    });
    return { error: error ?? null };
  } catch (error) {
    return { error };
  }
};

export const freshnessLabel = (mins: number) =>
  mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} hr ago`;
