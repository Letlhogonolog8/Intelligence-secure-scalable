/**
 * Centralized access to public runtime configuration.
 * Only EXPO_PUBLIC_* vars are available in the bundle — never put secrets here.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
// Professional web portal — where staff (counsellor, NGO, police, analyst, admin)
// sign in. The mobile app and the portal share the same Supabase + API backend.
const WEB_PORTAL_URL = (
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL ??
  "https://intelligence-secure-scalable-1-fjm8.onrender.com"
).replace(/\/+$/, "");

// The live USSD short-code (must match what is provisioned with the
// aggregator, e.g. Africa's Talking). Used for the on-device dial action.
const USSD_CODE = (process.env.EXPO_PUBLIC_USSD_CODE ?? "*135*1782#").trim();

export const env = {
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  apiUrl: API_URL,
  webPortalUrl: WEB_PORTAL_URL,
  ussdCode: USSD_CODE,
};

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const hasApi = Boolean(API_URL);
