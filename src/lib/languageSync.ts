import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import i18n, {
  changeAppLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";

/**
 * Cross-device language sync. The preferred language lives on
 * user_profiles.preferred_language (written via the set_preferred_language
 * RPC); whichever device set it last wins on the next login. Both directions
 * are best-effort — language switching must never break on a flaky network.
 */

const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === "string" &&
  SUPPORTED_LANGUAGES.some((entry) => entry.code === value);

/** Persist the chosen language to the signed-in user's profile (no-op when signed out). */
export async function persistPreferredLanguage(
  language: string,
): Promise<void> {
  if (!hasSupabase || !isSupportedLanguage(language)) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.rpc("set_preferred_language", { lang: language });
  } catch {
    // Best-effort: local persistence (localStorage) already happened.
  }
}

/** Apply the profile's preferred language after login, if it differs and is supported here. */
export async function applyProfilePreferredLanguage(
  userId: string,
): Promise<void> {
  if (!hasSupabase) return;
  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("preferred_language")
      .eq("id", userId)
      .maybeSingle();
    const preferred = data?.preferred_language;
    if (!isSupportedLanguage(preferred)) return;
    const current = (i18n.resolvedLanguage || i18n.language || "en").split(
      "-",
    )[0];
    if (current !== preferred) {
      await changeAppLanguage(preferred);
    }
  } catch {
    // Best-effort: fall back to the locally detected language.
  }
}
