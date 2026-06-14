/**
 * Unified notification fan-out.
 *
 * One call enqueues an event across multiple channels so SOS / reports /
 * escalations reach responders consistently instead of each call site
 * hand-rolling a single-channel insert:
 *   - in-app   → alerts_feed row (web responder dashboards read this live)
 *   - push     → one notification_queue 'push' row per active responder device
 *   - email    → one notification_queue 'email' row per active responder address
 *
 * The notification worker (TwilioNotificationService.processPendingNotifications)
 * delivers the queued push/email rows. Every channel is best-effort: one
 * failing channel never blocks the others or the caller.
 */

import { SupabaseClient } from "@supabase/supabase-js";

/** Roles that receive responder fan-out (mirrors the escalation bridge). */
export const RESPONDER_FANOUT_ROLES = [
  "police",
  "counselor",
  "ngo",
  "chw",
  "admin",
] as const;

export interface FanoutParams {
  eventType: string;
  title: string;
  message: string;
  severity?: string;
  module?: string;
  caseId?: string;
  channels: {
    inApp?: boolean;
    pushResponders?: boolean;
    emailResponders?: boolean;
  };
}

export interface FanoutResult {
  inApp: boolean;
  push: number;
  email: number;
}

interface ResponderRow {
  id: string;
  email: string | null;
}

interface PushTokenRow {
  token: string;
  user_id: string;
}

export async function fanOut(
  supabase: SupabaseClient,
  params: FanoutParams,
): Promise<FanoutResult> {
  const result: FanoutResult = { inApp: false, push: 0, email: 0 };
  const { channels } = params;

  // (1) In-app alert for the web responder dashboards.
  if (channels.inApp) {
    try {
      const { error } = await supabase.from("alerts_feed").insert({
        time: new Date().toISOString().slice(0, 16).replace("T", " "),
        type: params.eventType,
        message: params.message,
        module: params.module ?? "police",
        severity: params.severity ?? "medium",
        status: "pending",
        created_at: new Date().toISOString(),
      });
      result.inApp = !error;
    } catch {
      // best-effort
    }
  }

  // (2) Push — one queue row per active responder device.
  if (channels.pushResponders) {
    try {
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, user_id, user_profiles!inner(role, is_active)")
        .eq("is_active", true)
        .eq("user_profiles.is_active", true)
        .in("user_profiles.role", RESPONDER_FANOUT_ROLES as unknown as string[])
        .returns<PushTokenRow[]>();

      const rows = (tokens ?? []).map((t) => ({
        recipient_type: "push",
        recipient_address: t.token,
        message_type: params.eventType,
        message_content: params.message,
        case_id: params.caseId ?? null,
        user_id: t.user_id,
        status: "pending",
        attempt_count: 0,
        max_attempts: 5,
        created_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        const { error } = await supabase
          .from("notification_queue")
          .insert(rows);
        if (!error) result.push = rows.length;
      }
    } catch {
      // best-effort
    }
  }

  // (3) Email — one queue row per active responder address.
  if (channels.emailResponders) {
    try {
      const { data: responders } = await supabase
        .from("user_profiles")
        .select("id, email")
        .eq("is_active", true)
        .in("role", RESPONDER_FANOUT_ROLES as unknown as string[])
        .not("email", "is", null)
        .returns<ResponderRow[]>();

      const rows = (responders ?? [])
        .filter((r) => r.email)
        .map((r) => ({
          recipient_type: "email",
          recipient_address: r.email as string,
          message_type: params.eventType,
          message_content: params.message,
          case_id: params.caseId ?? null,
          user_id: r.id,
          status: "pending",
          attempt_count: 0,
          max_attempts: 3,
          created_at: new Date().toISOString(),
        }));
      if (rows.length > 0) {
        const { error } = await supabase
          .from("notification_queue")
          .insert(rows);
        if (!error) result.email = rows.length;
      }
    } catch {
      // best-effort
    }
  }

  return result;
}
