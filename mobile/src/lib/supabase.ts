import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Supabase client for React Native. Mirrors the web client
 * (src/lib/supabase.ts) but persists the session in AsyncStorage and
 * disables URL session detection (no browser redirect flow on mobile).
 *
 * Intentionally untyped at the client level: row shapes are applied at each
 * call site via `@/shared/types` casts. This avoids brittle coupling to the
 * generated PostgREST generics across supabase-js versions while keeping
 * read results strongly typed where it matters.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
