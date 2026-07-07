// Temporary QA helper: create/reset a disposable police test user for portal QA.
// Mirrors scripts/seed-data/seed.ts ensurePrivilegedTestUsers. Safe to re-run.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const email = "qa-police@aegis.example";
const password = `Qa!${crypto.randomBytes(9).toString("base64url")}`;

const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listErr) throw listErr;
const existing = list.users.find(
  (u) => u.email?.toLowerCase() === email,
);

let userId;
if (existing) {
  userId = existing.id;
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: "QA Police Tester", role: "police" },
  });
  if (error) throw error;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "QA Police Tester", role: "police" },
  });
  if (error) throw error;
  userId = data.user.id;
}

const { data: org } = await supabase
  .from("organizations")
  .select("id,name")
  .ilike("name", "%police%")
  .limit(1)
  .maybeSingle();

const { data: admin } = await supabase
  .from("user_profiles")
  .select("id")
  .eq("role", "admin")
  .limit(1)
  .maybeSingle();

const now = new Date().toISOString();
const { error: profileErr } = await supabase.from("user_profiles").upsert(
  {
    id: userId,
    role: "police",
    full_name: "QA Police Tester",
    phone: "+27700000000",
    lat: -26.2041,
    lng: 28.0473,
    is_active: true,
    is_available: true,
    organization_id: org?.id ?? null,
    approval_status: "approved",
    approved_at: now,
    approved_by: admin?.id ?? userId,
    role_assigned_by: admin?.id ?? userId,
    mfa_enabled: false,
    updated_at: now,
  },
  { onConflict: "id" },
);
if (profileErr) throw profileErr;

console.log(JSON.stringify({ email, password, userId, org: org?.name ?? null }));
