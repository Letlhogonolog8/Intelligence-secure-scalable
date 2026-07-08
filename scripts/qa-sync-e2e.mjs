// End-to-end web<->mobile synchronization test against the live backend:
//   1. survivor (mobile path) registers a push token and sends an SOS
//   2. the DB fanout trigger queues push notifications for responders
//   3. a police account (web path) sees the escalation and acknowledges it
//   4. the survivor sees the acknowledged status (mobile SOS status view)
//   5. survivor sends a case-team message; police reads it, replies;
//      survivor receives the reply
// Cleans up everything it created.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const ok = (n, d = "") => results.push(`PASS ${n} ${d}`);
const bad = (n, e) => results.push(`FAIL ${n}: ${e?.message ?? e}`);

const POLICE_EMAIL = "qa-police@aegis.example";
const POLICE_PASSWORD = process.env.QA_POLICE_PASSWORD;
if (!POLICE_PASSWORD) {
  console.error("Set QA_POLICE_PASSWORD");
  process.exit(1);
}

// --- survivor client (mobile app path) ---
const survivor = createClient(url, anon);
const username = `qa-sync-${crypto.randomBytes(3).toString("hex")}`;
let survivorId = null;
let sosId = null;
let convId = null;

try {
  const { data, error } = await survivor.auth.signUp({
    email: `${username}@aegis.example`,
    password: `Qa!${crypto.randomBytes(9).toString("base64url")}`,
    options: { data: { full_name: "QA Sync Survivor", role: "survivor" } },
  });
  if (error) throw error;
  survivorId = data.user.id;
  await survivor.functions.invoke("ensure_user_profile", { body: {} });
  ok("survivor signup (mobile path)");
} catch (e) { bad("survivor signup", e); }

try {
  const { error } = await survivor.from("push_tokens").upsert(
    {
      user_id: survivorId,
      token: `ExponentPushToken[qa-sync-${crypto.randomBytes(4).toString("hex")}]`,
      platform: "expo",
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) throw error;
  ok("push token registered");
} catch (e) { bad("push token registered", e); }

// --- police client (web path) — signed in before the SOS so a responder
// device exists for the fanout trigger to target ---
const police = createClient(url, anon);
const policeToken = `ExponentPushToken[qa-sync-police-${crypto.randomBytes(4).toString("hex")}]`;
try {
  const { error } = await police.auth.signInWithPassword({
    email: POLICE_EMAIL,
    password: POLICE_PASSWORD,
  });
  if (error) throw error;
  const { data: me } = await police.auth.getUser();
  const { error: tokErr } = await police.from("push_tokens").upsert(
    {
      user_id: me.user.id,
      token: policeToken,
      platform: "expo",
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (tokErr) throw tokErr;
  ok("police signed in + responder device registered");
} catch (e) { bad("police sign-in/device", e); }

try {
  const { data, error } = await survivor
    .from("escalation_events")
    .insert({
      user_id: survivorId,
      escalation_type: "panic_button",
      severity: "critical",
      location: { lat: -26.2041, lng: 28.0473 },
      status: "triggered",
      triggered_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  sosId = data.id;
  ok("SOS sent from mobile path", sosId.slice(0, 8));
} catch (e) { bad("SOS sent", e); }

// --- fanout trigger: responder devices queued ---
// The fanout trigger targets ACTIVE RESPONDER push tokens and tags rows with
// the escalation's case_id (text), not an escalation_id column. Assert on
// rows addressed to the police token we registered — precise and race-free.
try {
  await new Promise((r) => setTimeout(r, 3000));
  const { data: rows, error } = await admin
    .from("notification_queue")
    .select("id,recipient_type,status")
    .eq("recipient_address", policeToken);
  if (error) throw error;
  if (!rows?.length)
    throw new Error("no notification_queue row for the responder device");
  ok("push fanout queued", `${rows.length} device notification(s)`);
} catch (e) { bad("push fanout queued", e); }

// --- deployed worker drains the push row (prod pipeline proof) ---
try {
  let row = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const { data } = await admin
      .from("notification_queue")
      .select("status,last_error")
      .eq("recipient_address", policeToken)
      .maybeSingle();
    row = data;
    if (row && !["pending", "queued"].includes(row.status)) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!row) throw new Error("queue row disappeared");
  if (row.last_error?.includes("Unsupported recipient type"))
    throw new Error(`worker rejected push channel: ${row.last_error}`);
  if (["pending", "queued"].includes(row.status))
    throw new Error("row still pending after 90s — worker not draining");
  ok(
    "worker drained push row",
    `status=${row.status}${row.last_error ? ` (${row.last_error.slice(0, 80)})` : ""}`,
  );
} catch (e) { bad("worker drained push row", e); }

try {
  const { data, error: readErr } = await police
    .from("escalation_events")
    .select("id,severity,status")
    .eq("id", sosId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!data) throw new Error("police cannot see the survivor's SOS");
  ok("police sees the SOS (web path)", data.severity);
} catch (e) { bad("police sees the SOS", e); }

try {
  const { data: me } = await police.auth.getUser();
  const { error } = await police
    .from("escalation_events")
    .update({
      status: "acknowledged",
      acknowledged_by: me.user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", sosId);
  if (error) throw error;
  ok("police acknowledges the SOS");
} catch (e) { bad("police acknowledges", e); }

try {
  const { data, error } = await survivor
    .from("escalation_events")
    .select("status")
    .eq("id", sosId)
    .maybeSingle();
  if (error) throw error;
  if (data?.status !== "acknowledged")
    throw new Error(`survivor sees status "${data?.status}"`);
  ok("survivor sees acknowledgement (sync back)");
} catch (e) { bad("survivor sees acknowledgement", e); }

// --- secure messaging round trip ---
try {
  const { data, error } = await survivor.rpc(
    "start_survivor_case_team_conversation",
    { p_subject: "QA sync check" },
  );
  if (error) throw error;
  convId = data;
  const { error: msgErr } = await survivor.from("secure_messages").insert({
    conversation_id: convId,
    sender_id: survivorId,
    sender_role: "survivor",
    body: "QA sync — survivor message",
  });
  if (msgErr) throw msgErr;
  ok("survivor starts case-team thread + message");
} catch (e) { bad("survivor case-team message", e); }

try {
  const { data: me } = await police.auth.getUser();
  const { data: visible, error } = await police
    .from("secure_messages")
    .select("id,body")
    .eq("conversation_id", convId);
  if (error) throw error;
  if (!visible?.length) throw new Error("police cannot read the thread");
  const { error: replyErr } = await police.from("secure_messages").insert({
    conversation_id: convId,
    sender_id: me.user.id,
    sender_role: "police",
    body: "QA sync — police reply",
  });
  if (replyErr) throw replyErr;
  const { data: back } = await survivor
    .from("secure_messages")
    .select("body")
    .eq("conversation_id", convId);
  if (!back?.some((m) => m.body.includes("police reply")))
    throw new Error("survivor did not receive the reply");
  ok("message round trip survivor <-> police", `${back.length} messages`);
} catch (e) { bad("message round trip", e); }

console.log(results.join("\n"));

// --- cleanup ---
try {
  if (convId) {
    await admin.from("secure_messages").delete().eq("conversation_id", convId);
    await admin
      .from("secure_conversation_participants")
      .delete()
      .eq("conversation_id", convId);
    await admin.from("secure_conversations").delete().eq("id", convId);
  }
  await admin
    .from("notification_queue")
    .delete()
    .eq("recipient_address", policeToken);
  await admin.from("push_tokens").delete().eq("token", policeToken);
  if (sosId) {
    await admin.from("escalation_events").delete().eq("id", sosId);
  }
  await admin.from("push_tokens").delete().eq("user_id", survivorId);
  await admin.from("user_profiles").delete().eq("id", survivorId);
  if (survivorId) await admin.auth.admin.deleteUser(survivorId);
  console.log("cleanup: done");
} catch (e) {
  console.log("cleanup: partial —", e?.message ?? e);
}
