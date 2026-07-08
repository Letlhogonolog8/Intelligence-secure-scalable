// Diagnose the SOS -> notification_queue fanout: insert an escalation as a
// throwaway survivor, inspect queue rows (all statuses), then clean up.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const survivor = createClient(url, process.env.VITE_SUPABASE_KEY);

const { data: su, error: suErr } = await survivor.auth.signUp({
  email: `qa-fanout-${crypto.randomBytes(3).toString("hex")}@aegis.example`,
  password: `Qa!${crypto.randomBytes(9).toString("base64url")}`,
  options: { data: { full_name: "QA Fanout Diag", role: "survivor" } },
});
if (suErr) throw suErr;
const uid = su.user.id;
await survivor.functions.invoke("ensure_user_profile", { body: {} });

const { data: sos, error: sosErr } = await survivor
  .from("escalation_events")
  .insert({
    user_id: uid,
    escalation_type: "panic_button",
    severity: "critical",
    location: { lat: -26.2041, lng: 28.0473 },
    status: "triggered",
    triggered_at: new Date().toISOString(),
  })
  .select("id")
  .single();
if (sosErr) throw sosErr;
console.log("sos:", sos.id);

await new Promise((r) => setTimeout(r, 4000));

const { data: rows, error: qErr, count } = await admin
  .from("notification_queue")
  .select("id,recipient_type,status,last_error,created_at", { count: "exact" })
  .eq("escalation_id", sos.id);
console.log("query error:", qErr ? JSON.stringify(qErr) : "none");
console.log("count:", count);
for (const r of rows ?? []) {
  console.log(`  ${r.recipient_type} ${r.status} ${r.last_error ?? ""}`);
}

// how many responder devices should have been fanned out to?
const { count: tokenCount } = await admin
  .from("push_tokens")
  .select("*", { count: "exact", head: true })
  .eq("is_active", true);
console.log("active push tokens (all users):", tokenCount);

// cleanup
await admin.from("notification_queue").delete().eq("escalation_id", sos.id);
await admin.from("escalation_events").delete().eq("id", sos.id);
await admin.auth.admin.deleteUser(uid);
console.log("cleanup done");
