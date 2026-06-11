/**
 * One-time cleanup: remove duplicate governance_models rows that accumulated
 * from earlier non-idempotent seeding. Keeps the EARLIEST row per
 * (name + version + module); deletes the rest. Their fairness_metrics are
 * removed automatically via ON DELETE CASCADE.
 *
 * Usage:
 *   node scripts/dedupe-governance-models.mjs           # dry run (no changes)
 *   node scripts/dedupe-governance-models.mjs --apply   # perform the deletion
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await supabase
  .from("governance_models")
  .select("id, name, version, module")
  .order("id", { ascending: true });

if (error) {
  console.error("Failed to read governance_models:", error.message);
  process.exit(1);
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}  |  ${rows.length} total model rows\n`);

const seen = new Map(); // key -> kept row
const duplicateIds = [];
for (const row of rows) {
  const key = `${row.name}|${row.version}|${row.module}`.toLowerCase().trim();
  if (seen.has(key)) {
    duplicateIds.push(row.id);
    console.log(`DUP    "${row.name}" v${row.version} (${row.module})  id=${row.id}  -> delete (kept ${seen.get(key).id})`);
  } else {
    seen.set(key, row);
  }
}

console.log(`\nUnique models: ${seen.size}   Duplicates to remove: ${duplicateIds.length}`);

if (duplicateIds.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDry run only. Re-run with --apply to delete the duplicates.");
  process.exit(0);
}

const { error: delError, count } = await supabase
  .from("governance_models")
  .delete({ count: "exact" })
  .in("id", duplicateIds);

if (delError) {
  console.error("\nDeletion failed:", delError.message);
  process.exit(1);
}

console.log(`\n✅ Deleted ${count ?? duplicateIds.length} duplicate model rows (fairness_metrics cascaded).`);
