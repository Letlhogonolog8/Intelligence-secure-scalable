import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";

import { registerExtraTranslations } from "@/i18n/extras";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { pt } from "@/i18n/pt";
import { fr } from "@/i18n/fr";
import { de } from "@/i18n/de";
import { sw } from "@/i18n/sw";
import { af } from "@/i18n/af";
import { ar } from "@/i18n/ar";
import { zu } from "@/i18n/zu";
import { hi } from "@/i18n/hi";
import { zh } from "@/i18n/zh";
import { ru } from "@/i18n/ru";
import { it } from "@/i18n/it";
import { tr } from "@/i18n/tr";
import { id } from "@/i18n/id";

/**
 * Supported languages. GBV is a worldwide challenge, so the app ships fully
 * translated bundles spanning the Americas, Europe, the Middle East and Africa.
 * Every entry below has a complete, human-readable translation (no silent
 * English fallback) — add a new locale file and one line here to extend it.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "sw", label: "Kiswahili" },
  { code: "zu", label: "isiZulu" },
  { code: "af", label: "Afrikaans" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

/** Languages that render right-to-left. */
export const RTL_LANGUAGES: LanguageCode[] = ["ar"];
export function isRTLLanguage(code: string): boolean {
  return RTL_LANGUAGES.includes(code as LanguageCode);
}

const LANG_KEY = "aegis.lang";

const resources = {
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  tr: { translation: tr },
  ru: { translation: ru },
  ar: { translation: ar },
  hi: { translation: hi },
  zh: { translation: zh },
  id: { translation: id },
  sw: { translation: sw },
  zu: { translation: zu },
  af: { translation: af },
} as const;

export function deviceLanguage(): LanguageCode {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
    const code = String(locale).split("-")[0];
    return (SUPPORTED_LANGUAGES.find((l) => l.code === code)?.code ??
      "en") as LanguageCode;
  } catch {
    return "en";
  }
}

/**
 * Apply layout direction for the chosen language. Note: React Native only
 * mirrors the whole layout after an app reload, so we flip the flag here and
 * the change takes effect on next launch. Text inside <Text> already aligns
 * correctly for RTL scripts immediately.
 */
function applyDirection(code: string): void {
  try {
    I18nManager.allowRTL(true);
    const rtl = isRTLLanguage(code);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
    }
  } catch {
    // I18nManager may be unavailable in some contexts; ignore.
  }
}

/**
 * Initialize i18n SYNCHRONOUSLY at module import. All resources are inline, so
 * `init` completes immediately and `useTranslation` works on the first render —
 * nothing in the startup path awaits i18n (keeps the launch screen from hanging).
 */
if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: "en",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnNull: false,
      react: { useSuspense: false },
    })
    .then(() => registerExtraTranslations(i18n));
}

export async function getStoredLanguage(): Promise<LanguageCode | null> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return (stored as LanguageCode | null) ?? null;
  } catch {
    return null;
  }
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch {
    // best-effort persistence; language still changes for this session
  }
  await i18n.changeLanguage(code);
  applyDirection(code);
  void persistLanguageToProfile(code);
}

/**
 * Cross-device sync: store the choice on user_profiles.preferred_language so
 * the web portal (and any other device) picks it up on next login. Lazy-loads
 * the supabase client to keep i18n's synchronous module init dependency-free.
 */
async function persistLanguageToProfile(code: LanguageCode): Promise<void> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.rpc("set_preferred_language", { lang: code });
  } catch {
    // Best-effort: AsyncStorage persistence already happened.
  }
}

/**
 * Apply the language stored on the user's profile (set from any device).
 * Used after login; skips codes this app doesn't ship translations for and
 * does NOT write back to the profile.
 */
export async function applyRemotePreferredLanguage(
  code: string | null | undefined,
): Promise<void> {
  if (!code) return;
  const supported = SUPPORTED_LANGUAGES.find((l) => l.code === code)?.code as
    | LanguageCode
    | undefined;
  if (!supported || supported === i18n.language) return;
  try {
    await AsyncStorage.setItem(LANG_KEY, supported);
  } catch {
    // non-fatal
  }
  await i18n.changeLanguage(supported);
  applyDirection(supported);
}

/** Apply the user's saved language after mount (non-blocking). */
export async function applyStoredLanguage(): Promise<void> {
  const stored = await getStoredLanguage();
  if (stored && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }
  applyDirection(stored ?? i18n.language);
}

export default i18n;
