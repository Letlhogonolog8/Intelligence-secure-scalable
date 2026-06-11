import * as Location from "expo-location";

import { supabase } from "@/lib/supabase";
import {
  ESCALATION_TYPE_PANIC,
  SEVERITY_CRITICAL,
  STATUS_TRIGGERED,
} from "@/shared/constants";

export interface Coords {
  lat: number;
  lng: number;
}

/** Request permission and capture a single fix. Null if unavailable/declined. */
export async function getLocationSafe(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Send an emergency escalation. Mirrors the web PanicButton:
 * inserts a `panic_button` / `critical` row into `escalation_events`.
 * Returns the new escalation id. Throws on failure so the UI can show the
 * direct-line fallback (never fails silently — spec §13.2).
 */
export async function sendSos(userId: string | undefined): Promise<string> {
  const location = await getLocationSafe();
  const { data, error } = await supabase
    .from("escalation_events")
    .insert({
      user_id: userId ?? null,
      case_id: null,
      escalation_type: ESCALATION_TYPE_PANIC,
      severity: SEVERITY_CRITICAL,
      location: location ? { lat: location.lat, lng: location.lng } : null,
      status: STATUS_TRIGGERED,
      triggered_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function acknowledgeSos(id: string): Promise<void> {
  await supabase.from("escalation_events").update({ status: "acknowledged" }).eq("id", id);
}
