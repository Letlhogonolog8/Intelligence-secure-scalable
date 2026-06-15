import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en";

/**
 * Languages a user can select. The first block has a fully human-translated UI
 * bundle (see loadLanguageResource); the rest are "engine" languages — the
 * global language engine (LLM translation, Azure TTS where available, and the
 * synced preferred-language target) serves them, while the interface chrome
 * falls back to English until a vetted locale bundle is added. This is how the
 * platform supports 50+ languages for survivor↔responder communication without
 * shipping unreviewed UI translations for safety-critical text.
 */
export const SUPPORTED_LANGUAGES = [
  // --- Fully localized UI (bundled translations) ---
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "sw", label: "Swahili", nativeLabel: "Kiswahili" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "am", label: "Amharic", nativeLabel: "አማርኛ" },
  { code: "yo", label: "Yoruba", nativeLabel: "Yorùbá" },
  { code: "ha", label: "Hausa", nativeLabel: "Hausa" },
  { code: "zu", label: "isiZulu", nativeLabel: "isiZulu" },
  { code: "af", label: "Afrikaans", nativeLabel: "Afrikaans" },
  { code: "xh", label: "isiXhosa", nativeLabel: "isiXhosa" },
  { code: "st", label: "Sesotho", nativeLabel: "Sesotho" },
  { code: "tn", label: "Setswana", nativeLabel: "Setswana" },
  { code: "ts", label: "Xitsonga", nativeLabel: "Xitsonga" },
  { code: "ve", label: "Tshivenda", nativeLabel: "Tshivenda" },
  { code: "nso", label: "Sepedi", nativeLabel: "Sepedi" },
  { code: "nr", label: "isiNdebele", nativeLabel: "isiNdebele" },
  { code: "ss", label: "SiSwati", nativeLabel: "SiSwati" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  // --- Additional African languages (engine) ---
  { code: "ig", label: "Igbo", nativeLabel: "Igbo" },
  { code: "so", label: "Somali", nativeLabel: "Soomaali" },
  { code: "sn", label: "Shona", nativeLabel: "chiShona" },
  { code: "lg", label: "Luganda", nativeLabel: "Luganda" },
  { code: "wo", label: "Wolof", nativeLabel: "Wolof" },
  // --- European (engine) ---
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
  { code: "uk", label: "Ukrainian", nativeLabel: "Українська" },
  { code: "pl", label: "Polish", nativeLabel: "Polski" },
  { code: "sv", label: "Swedish", nativeLabel: "Svenska" },
  { code: "no", label: "Norwegian", nativeLabel: "Norsk" },
  { code: "da", label: "Danish", nativeLabel: "Dansk" },
  { code: "fi", label: "Finnish", nativeLabel: "Suomi" },
  { code: "el", label: "Greek", nativeLabel: "Ελληνικά" },
  // --- Middle Eastern (engine) ---
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "fa", label: "Persian", nativeLabel: "فارسی" },
  { code: "he", label: "Hebrew", nativeLabel: "עברית" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { code: "ku", label: "Kurdish", nativeLabel: "Kurdî" },
  // --- Asian (engine) ---
  { code: "yue", label: "Cantonese", nativeLabel: "粵語" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "th", label: "Thai", nativeLabel: "ไทย" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { code: "tl", label: "Filipino", nativeLabel: "Filipino" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];
type TranslationResource = typeof en;

const supportedLanguageCodes = SUPPORTED_LANGUAGES.map(
  (language) => language.code,
);
const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === "string" &&
  supportedLanguageCodes.includes(value as SupportedLanguage);

const loadLanguageResource = async (
  language: SupportedLanguage,
): Promise<TranslationResource> => {
  switch (language) {
    case "en":
      return en;
    case "sw":
      return (await import("./locales/sw")).default as TranslationResource;
    case "fr":
      return (await import("./locales/fr")).default as TranslationResource;
    case "am":
      return (await import("./locales/am")).default as TranslationResource;
    case "yo":
      return (await import("./locales/yo")).default as TranslationResource;
    case "ha":
      return (await import("./locales/ha")).default as TranslationResource;
    case "zu":
      return (await import("./locales/zu")).default as TranslationResource;
    case "af":
      return (await import("./locales/af")).default as TranslationResource;
    case "xh":
      return (await import("./locales/xh")).default as TranslationResource;
    case "st":
      return (await import("./locales/st")).default as TranslationResource;
    case "tn":
      return (await import("./locales/tn")).default as TranslationResource;
    case "ts":
      return (await import("./locales/ts")).default as TranslationResource;
    case "ve":
      return (await import("./locales/ve")).default as TranslationResource;
    case "nso":
      return (await import("./locales/nso")).default as TranslationResource;
    case "nr":
      return (await import("./locales/nr")).default as TranslationResource;
    case "ss":
      return (await import("./locales/ss")).default as TranslationResource;
    case "es":
      return (await import("./locales/es")).default as TranslationResource;
    case "pt":
      return (await import("./locales/pt")).default as TranslationResource;
    case "zh":
      return (await import("./locales/zh")).default as TranslationResource;
    case "hi":
      return (await import("./locales/hi")).default as TranslationResource;
    default:
      return en;
  }
};

const resolveInitialLanguage = (): SupportedLanguage => {
  const localStorageLanguage =
    typeof window !== "undefined"
      ? window.localStorage.getItem("aegis_language")
      : null;
  const navigatorLanguage =
    typeof navigator !== "undefined" ? navigator.language?.split("-")[0] : null;

  if (isSupportedLanguage(localStorageLanguage)) {
    return localStorageLanguage;
  }

  if (isSupportedLanguage(navigatorLanguage)) {
    return navigatorLanguage;
  }

  return "en";
};

const suppressLocizeNotice = () => {
  const shouldSuppress = (value: unknown) =>
    typeof value === "string" &&
    value.includes("i18next is maintained with support from Locize");

  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalLog = console.log.bind(console);

  console.info = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) {
      return;
    }
    originalInfo(...args);
  };

  console.warn = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) {
      return;
    }
    originalWarn(...args);
  };

  console.log = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) {
      return;
    }
    originalLog(...args);
  };

  return () => {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.log = originalLog;
  };
};

const ensureLanguageResource = async (language: string) => {
  const languageCode = language.split("-")[0];
  if (
    !isSupportedLanguage(languageCode) ||
    i18n.hasResourceBundle(languageCode, "translation")
  ) {
    return;
  }

  const translation = await loadLanguageResource(languageCode);
  i18n.addResourceBundle(languageCode, "translation", translation, true, true);
};

export const initializeI18n = async () => {
  const restoreConsole = suppressLocizeNotice();
  const initialLanguage = resolveInitialLanguage();
  const initialResources: Partial<
    Record<SupportedLanguage, { translation: TranslationResource }>
  > = {
    en: { translation: en },
  };

  if (initialLanguage !== "en") {
    initialResources[initialLanguage] = {
      translation: await loadLanguageResource(initialLanguage),
    };
  }

  i18n.on("languageChanged", async (language) => {
    await ensureLanguageResource(language);
  });

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: initialResources,
      lng: initialLanguage,
      fallbackLng: "en",
      supportedLngs: supportedLanguageCodes,
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "aegis_language",
      },
      interpolation: { escapeValue: false },
    });

  setTimeout(restoreConsole, 0);
};

export const changeAppLanguage = async (language: SupportedLanguage) => {
  await ensureLanguageResource(language);
  await i18n.changeLanguage(language);
};

export default i18n;
