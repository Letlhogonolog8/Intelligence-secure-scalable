import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  changeAppLanguage,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "@/i18n";
import { persistPreferredLanguage } from "@/lib/languageSync";

interface LanguageSwitcherProps {
  variant?: "landing" | "compact";
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = "compact",
}) => {
  const { i18n, t } = useTranslation();
  const current =
    (i18n.resolvedLanguage || i18n.language || "en").split("-")[0] || "en";

  const handleChange = async (code: SupportedLanguage) => {
    await changeAppLanguage(code);
    // Sync to the signed-in profile so other devices pick it up on login.
    void persistPreferredLanguage(code);
  };

  if (variant === "landing") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 max-w-[90vw] justify-center">
        <Globe className="h-4 w-4 text-slate-400 flex-shrink-0 hidden md:block" />
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => void handleChange(lang.code)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
              current === lang.code
                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
            }`}
          >
            {lang.nativeLabel}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => void handleChange(e.target.value as SupportedLanguage)}
        aria-label={t("common.selectLanguage", "Select language")}
        className="appearance-none bg-slate-900/60 border border-white/10 text-slate-300 text-xs rounded px-7 py-1.5 focus:outline-none focus:border-purple-500/40 cursor-pointer"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel}
          </option>
        ))}
      </select>
      <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
};

export default LanguageSwitcher;
