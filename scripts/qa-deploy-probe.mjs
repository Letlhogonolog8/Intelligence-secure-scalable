// Deploy probe: insert a community_mobile case_report, then check whether the
// deployed backend's /api/community/report/:reference returns it.
// Old code (pre-merge) filters report_method=community_web only -> 404.
// New code (808d6b1) accepts community_mobile -> 200.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "C:/Users/mudau/Desktop/New Apps/intelligence-secure-scalable/.env" });

const REF = "CR-QADEPLO1";
const BASE = "https://intelligence-secure-scalable-mwge.onrender.com";
const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const mode = process.argv[2] ?? "check";

if (mode === "setup") {
  const { error } = await admin.from("case_reports").insert({
    description: "QA deploy probe row - safe to delete",
    report_method: "community_mobile",
    reporter_relationship: "concern",
    is_anonymous: true,
    reported_by: null,
    status: "submitted",
    risk_level: "medium",
    priority: "low",
    public_reference: REF,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error && error.code !== "23505") {
    console.error("insert failed:", error.message);
    process.exit(1);
  }
  console.log("probe row ready:", REF);
} else if (mode === "cleanup") {
  const { error } = await admin
    .from("case_reports")
    .delete()
    .eq("public_reference", REF);
  console.log(error ? `cleanup failed: ${error.message}` : "probe row deleted");
} else {
  const res = await fetch(`${BASE}/api/community/report/${REF}`);
  const body = await res.text();
  console.log(`HTTP ${res.status} ${body.slice(0, 200)}`);
  console.log(res.status === 200 ? "NEW CODE DEPLOYED" : "old code still live");
}
