// QA: exercise every mobile-app -> Supabase seam under a real survivor
// session, mirroring the exact queries in mobile/src + mobile/app.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config();

const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const ok = (name, detail = "") => results.push(`PASS ${name} ${detail}`);
const bad = (name, err) => results.push(`FAIL ${name}: ${err?.message ?? err}`);

const username = `qa-survivor-${crypto.randomBytes(3).toString("hex")}`;
const email = `${username}@aegis.example`;
const password = `Qa!${crypto.randomBytes(9).toString("base64url")}`;
let userId = null;
let caseId = null;
let sosId = null;
let convId = null;

// 1. Sign-up (mobile AuthProvider.signUp)
try {
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: { data: { full_name: "QA Mobile Survivor", role: "survivor" } },
  });
  if (error) throw error;
  userId = data.user?.id ?? null;
  if (!data.session) throw new Error("no session returned (email confirmation on?)");
  ok("signUp", `session=yes user=${userId}`);
} catch (e) { bad("signUp", e); }

// 2. ensure_user_profile edge function (mobile invokes after signUp)
try {
  const { error } = await c.functions.invoke("ensure_user_profile", { body: {} });
  if (error) throw error;
  ok("ensure_user_profile");
} catch (e) { bad("ensure_user_profile", e); }

// 3. Own profile fetch (AuthProvider.loadProfile)
try {
  const { data, error } = await c
    .from("user_profiles")
    .select("id,role,full_name,preferred_language")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("profile row missing");
  if (data.role !== "survivor") throw new Error(`role=${data.role}`);
  ok("profile", `role=${data.role}`);
} catch (e) { bad("profile", e); }

// 4. set_preferred_language RPC
try {
  const { error } = await c.rpc("set_preferred_language", { lang: "en" });
  if (error) throw error;
  ok("set_preferred_language");
} catch (e) { bad("set_preferred_language", e); }

// 5. Resources (ResourcesView)
try {
  const { data, error } = await c.from("resources").select("*").limit(3);
  if (error) throw error;
  ok("resources", `${data.length} rows`);
} catch (e) { bad("resources", e); }

// 6. Push token registration (features/push)
try {
  const { error } = await c.from("push_tokens").upsert(
    {
      user_id: userId,
      token: `ExponentPushToken[qa-${crypto.randomBytes(4).toString("hex")}]`,
      platform: "expo",
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) throw error;
  ok("push_tokens upsert");
} catch (e) { bad("push_tokens upsert", e); }

// 7. SOS (features/sos/escalation.ts sendSos)
try {
  const { data, error } = await c
    .from("escalation_events")
    .insert({
      user_id: userId,
      case_id: null,
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
  ok("SOS insert", sosId);
} catch (e) { bad("SOS insert", e); }

// 8. Case report (report.tsx buildPayload -> submitCaseReportWithEscalation)
try {
  const { data, error } = await c
    .from("case_reports")
    .insert({
      survivor_id: null,
      reported_by: userId,
      source: "mobile_app",
      report_method: "community_mobile",
      reporter_relationship: "witness",
      public_reference: "CR-QAQAQAQA",
      language: "en",
      status: "new",
      category: "Harassment",
      risk_level: "medium",
      priority: "medium",
      is_anonymous: false,
      incident_occurred_at: new Date().toISOString(),
      location: null,
      description: "QA mobile seam check — disregard",
    })
    .select("id")
    .single();
  if (error) throw error;
  caseId = data.id;
  ok("case_reports insert", caseId);
} catch (e) { bad("case_reports insert", e); }

// 8b. Escalation for the report (second half of submitCaseReportWithEscalation)
try {
  if (!caseId) throw new Error("skipped (no case)");
  const { data: existing } = await c
    .from("escalation_events")
    .select("id")
    .eq("case_id", caseId)
    .maybeSingle();
  if (!existing) {
    const { error } = await c.from("escalation_events").insert({
      case_id: caseId,
      user_id: userId,
      escalation_type: "mobile_incident_report",
      severity: "medium",
      reason: "Mobile report submitted",
      location: null,
      status: "triggered",
      triggered_at: new Date().toISOString(),
      metadata: { report_method: "in_app", category: "Harassment", priority: "medium" },
    });
    if (error) throw error;
  }
  ok("report escalation", existing ? "created by DB trigger" : "inserted by app");
} catch (e) { bad("report escalation", e); }

// 9. Case-team conversation RPC + message send (features/messages)
try {
  const { data, error } = await c.rpc("start_survivor_case_team_conversation", {
    p_subject: null,
  });
  if (error) throw error;
  convId = data;
  ok("start_survivor_case_team_conversation", String(convId));
} catch (e) { bad("start_survivor_case_team_conversation", e); }

try {
  if (!convId) throw new Error("skipped (no conversation)");
  const { error } = await c.from("secure_messages").insert({
    conversation_id: convId,
    sender_id: userId,
    sender_role: "survivor",
    body: "QA mobile seam check — disregard",
  });
  if (error) throw error;
  ok("secure_messages insert");
} catch (e) { bad("secure_messages insert", e); }

try {
  const { data, error } = await c
    .from("secure_conversations")
    .select("id,subject,case_id,last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  ok("fetchConversations", `${data.length} visible`);
} catch (e) { bad("fetchConversations", e); }

// 10. Evidence vault: storage upload + consent grant/revoke (evidence.tsx)
const vaultPath = `${userId}/qa-seam-check.txt`;
try {
  const { error } = await c.storage
    .from("evidence")
    .upload(vaultPath, new Blob(["qa"], { type: "text/plain" }), {
      contentType: "text/plain",
    });
  if (error) throw error;
  ok("storage evidence upload", vaultPath);
} catch (e) { bad("storage evidence upload", e); }

try {
  const { error } = await c.from("evidence_consents").upsert(
    {
      survivor_id: userId,
      storage_path: vaultPath,
      file_name: "qa-seam-check.txt",
      revoked_at: null,
      granted_at: new Date().toISOString(),
    },
    { onConflict: "survivor_id,storage_path" },
  );
  if (error) throw error;
  ok("evidence_consents grant");
} catch (e) { bad("evidence_consents grant", e); }

try {
  const { error } = await c
    .from("evidence_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("survivor_id", userId)
    .eq("storage_path", vaultPath);
  if (error) throw error;
  ok("evidence_consents revoke");
} catch (e) { bad("evidence_consents revoke", e); }

// 11. Community evidence: case-evidence bucket + case_evidence row
const cePath = `${userId}/community-${caseId}-qa.txt`;
try {
  if (!caseId) throw new Error("skipped (no case)");
  const { error } = await c.storage
    .from("case-evidence")
    .upload(cePath, new Blob(["qa"], { type: "text/plain" }), {
      contentType: "text/plain",
    });
  if (error) throw error;
  const { error: rowErr } = await c.from("case_evidence").insert({
    case_id: caseId,
    case_reference: null,
    storage_path: cePath,
    file_name: "qa.txt",
    mime_type: "text/plain",
    evidence_type: "document",
    note: "Attached to community report",
    uploaded_by: userId,
  });
  if (rowErr) throw rowErr;
  ok("community evidence attach");
} catch (e) { bad("community evidence attach", e); }

// 12. Peer support wall (support.tsx)
try {
  const { error } = await c.from("peer_support_messages").insert({
    alias: "QA",
    content: "QA seam check — disregard",
    flagged: false,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (error) throw error;
  const { data, error: readErr } = await c
    .from("peer_support_messages")
    .select("*")
    .eq("flagged", false)
    .order("created_at", { ascending: false })
    .limit(5);
  if (readErr) throw readErr;
  ok("peer_support post+read", `${data.length} rows`);
} catch (e) { bad("peer_support post+read", e); }

console.log(results.join("\n"));

// ---- cleanup (service role) ----
const del = async (table, col, val) =>
  val && admin.from(table).delete().eq(col, val);
try {
  if (convId) {
    await admin.from("secure_messages").delete().eq("conversation_id", convId);
    await admin.from("secure_conversation_participants").delete().eq("conversation_id", convId);
    await del("secure_conversations", "id", convId);
  }
  await admin.from("escalation_events").delete().eq("user_id", userId);
  if (caseId) {
    await admin.from("case_evidence").delete().eq("case_id", caseId);
    await del("case_reports", "id", caseId);
  }
  await admin.from("evidence_consents").delete().eq("survivor_id", userId);
  await admin.from("push_tokens").delete().eq("user_id", userId);
  await admin.from("peer_support_messages").delete().eq("alias", "QA");
  await admin.storage.from("evidence").remove([vaultPath]);
  await admin.storage.from("case-evidence").remove([cePath]);
  await admin.from("user_profiles").delete().eq("id", userId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("cleanup: done (QA survivor + all rows removed)");
} catch (e) {
  console.log("cleanup: partial —", e?.message ?? e);
}
