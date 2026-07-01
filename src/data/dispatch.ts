import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Dispatch data layer: response units and active dispatches for the Police
 * portal. RLS lets responders read and police/admin manage. Both tables are
 * in the realtime publication. See migration 20260701180000_dispatch.sql.
 */

export interface DispatchUnit {
  id: string;
  unitCode: string;
  label: string;
  status: string;
  region: string | null;
  activeOfficers: number;
}

export interface Dispatch {
  id: string;
  unitId: string | null;
  caseReference: string | null;
  priority: string;
  status: string;
  etaMinutes: number | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
}

export const DISPATCH_UNITS_KEY = ["aegis", "dispatchUnits"] as const;
export const DISPATCHES_KEY = ["aegis", "dispatches"] as const;

export const DISPATCH_STATUS_FLOW = [
  "assigned",
  "en_route",
  "on_scene",
  "completed",
] as const;

export function nextDispatchStatus(status: string): string | null {
  const idx = DISPATCH_STATUS_FLOW.indexOf(
    status as (typeof DISPATCH_STATUS_FLOW)[number],
  );
  if (idx < 0 || idx >= DISPATCH_STATUS_FLOW.length - 1) return null;
  return DISPATCH_STATUS_FLOW[idx + 1];
}

export async function fetchDispatchUnits(): Promise<DispatchUnit[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("dispatch_units")
    .select("id,unit_code,label,status,region,active_officers")
    .order("unit_code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    unitCode: r.unit_code,
    label: r.label,
    status: r.status,
    region: r.region,
    activeOfficers: r.active_officers,
  }));
}

export async function fetchDispatches(limit = 100): Promise<Dispatch[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("dispatches")
    .select(
      "id,unit_id,case_reference,priority,status,eta_minutes,location,notes,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    unitId: r.unit_id,
    caseReference: r.case_reference,
    priority: r.priority,
    status: r.status,
    etaMinutes: r.eta_minutes,
    location: r.location,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export async function createDispatch(input: {
  createdBy: string;
  unitId?: string | null;
  caseReference?: string | null;
  priority?: string;
  etaMinutes?: number | null;
  location?: string | null;
}): Promise<void> {
  if (!input.createdBy) throw new Error("Not signed in");
  const { error } = await supabase.from("dispatches").insert({
    created_by: input.createdBy,
    unit_id: input.unitId ?? null,
    case_reference: input.caseReference?.trim() || null,
    priority: input.priority ?? "medium",
    status: "assigned",
    eta_minutes: input.etaMinutes ?? null,
    location: input.location?.trim() || null,
  });
  if (error) throw error;

  // Mark the assigned unit en route (best-effort).
  if (input.unitId) {
    await supabase
      .from("dispatch_units")
      .update({ status: "en_route", updated_at: new Date().toISOString() })
      .eq("id", input.unitId);
  }
}

export async function updateDispatchStatus(
  id: string,
  status: string,
  unitId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("dispatches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  // When a dispatch completes, free its unit.
  if (status === "completed" && unitId) {
    await supabase
      .from("dispatch_units")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", unitId);
  }
}

export async function setUnitStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("dispatch_units")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export const useDispatchUnits = () =>
  useQuery({
    queryKey: DISPATCH_UNITS_KEY,
    queryFn: fetchDispatchUnits,
    enabled: hasSupabase,
    staleTime: 15000,
  });

export const useDispatches = () =>
  useQuery({
    queryKey: DISPATCHES_KEY,
    queryFn: () => fetchDispatches(),
    enabled: hasSupabase,
    staleTime: 10000,
  });
