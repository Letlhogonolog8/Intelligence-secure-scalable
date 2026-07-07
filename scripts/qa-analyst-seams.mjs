// QA: verify every table the Data Analyst portal reads is visible to an
// analyst session, comparing analyst-visible counts vs service-role truth.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const c = createClient(url, process.env.VITE_SUPABASE_KEY);
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

const email = process.env.QA_ANALYST_EMAIL ?? "qa-analyst@aegis.example";
const password = process.env.QA_ANALYST_PASSWORD;
if (!password) {
  console.error("Set QA_ANALYST_PASSWORD (from qa-create-police-user.mjs analyst)");
  process.exit(1);
}
const { error: authErr } = await c.auth.signInWithPassword({ email, password });
if (authErr) { console.error("auth:", authErr.message); process.exit(1); }

const TABLES = [
  // analyticsData.ts intelligence tables
  "incident_age_groups", "reporting_channels", "hotspot_emergence",
  "forecast_metrics", "forecast_scenarios", "forecast_variables",
  "dataset_catalog", "data_quality_alerts", "analyst_reports",
  "case_category_totals", "analyst_settings",
  // aegisData.ts hooks the portal uses
  "system_metrics", "regions", "audit_logs", "anomaly_alerts",
  "incident_timeseries", "case_reports", "escalation_events", "user_profiles",
];

const count = async (client, table) => {
  const { count: n, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  return error ? `ERR(${error.code ?? error.message.slice(0, 60)})` : n;
};

for (const t of TABLES) {
  const [asAnalyst, asAdmin] = await Promise.all([count(c, t), count(admin, t)]);
  const flag =
    String(asAnalyst).startsWith("ERR") || (asAdmin > 0 && asAnalyst === 0)
      ? "  <-- PROBLEM"
      : "";
  console.log(`${t.padEnd(24)} analyst=${asAnalyst}  truth=${asAdmin}${flag}`);
}

// analyst_settings write path (SettingsSection persists here)
try {
  const { data: me } = await c.auth.getUser();
  const { error } = await c.from("analyst_settings").upsert(
    { user_id: me.user.id, settings: { qa: true }, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  console.log("analyst_settings upsert:", error ? `ERR ${error.message}` : "ok");
  await admin.from("analyst_settings").delete().eq("user_id", me.user.id);
} catch (e) {
  console.log("analyst_settings upsert: ERR", e?.message ?? e);
}
await c.auth.signOut();
