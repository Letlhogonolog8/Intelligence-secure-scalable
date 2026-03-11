import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en";
import zu from "./locales/zu";
import af from "./locales/af";
import xh from "./locales/xh";
import st from "./locales/st";
import tn from "./locales/tn";
import ts from "./locales/ts";
import ve from "./locales/ve";
import nso from "./locales/nso";
import nr from "./locales/nr";
import ss from "./locales/ss";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
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
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const suppressLocizeNotice = () => {
  const shouldSuppress = (value: unknown) =>
    typeof value === "string" && value.includes("i18next is maintained with support from Locize")

  const originalInfo = console.info.bind(console)
  const originalWarn = console.warn.bind(console)
  const originalLog = console.log.bind(console)

  console.info = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) {
      return
    }
    originalInfo(...args)
  }

  console.warn = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) {
      return
    }
    originalWarn(...args)
  }

  console.log = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) {
      return
    }
    originalLog(...args)
  }

  return () => {
    console.info = originalInfo
    console.warn = originalWarn
    console.log = originalLog
  }
}

const restoreConsole = suppressLocizeNotice()

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zu: { translation: zu },
      af: { translation: af },
      xh: { translation: xh },
      st: { translation: st },
      tn: { translation: tn },
      ts: { translation: ts },
      ve: { translation: ve },
      nso: { translation: nso },
      nr: { translation: nr },
      ss: { translation: ss },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "zu", "af", "xh", "st", "tn", "ts", "ve", "nso", "nr", "ss"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "aegis_language",
    },
    interpolation: { escapeValue: false },
  });

setTimeout(restoreConsole, 0)

export default i18n;
