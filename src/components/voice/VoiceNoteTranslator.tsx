import { useRef, useState } from "react";
import { Languages, Loader2, Play, Upload, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Voice evidence translator for responder dashboards.
 *
 * A responder uploads (or receives) a survivor voice note in ANY language and
 * gets back: the original transcript, a translation in the responder's
 * preferred language, and synthesized audio of that translation — powered by
 * the backend /api/ai/voice-translate pipeline (Whisper STT → LLM detect +
 * translate → MMS text-to-speech).
 *
 * The language preference persists per browser so each official hears
 * evidence in their own language regardless of what the survivor spoke.
 */

const RESPONDER_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "zu", label: "isiZulu" },
  { code: "xh", label: "isiXhosa" },
  { code: "tn", label: "Setswana" },
  { code: "st", label: "Sesotho" },
  { code: "ts", label: "Xitsonga" },
  { code: "ve", label: "Tshivenda" },
  { code: "ss", label: "siSwati" },
  { code: "nso", label: "Sepedi" },
];

const LANG_PREF_KEY = "aegis.responder.lang";

interface TranslateResult {
  originalText: string;
  detectedLanguage: string | null;
  translatedText: string;
  targetLanguage: string;
  audioBase64: string | null;
}

const VoiceNoteTranslator: React.FC<{ className?: string }> = ({
  className,
}) => {
  const [lang, setLang] = useState(
    () => localStorage.getItem(LANG_PREF_KEY) || "en",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const updateLang = (code: string) => {
    setLang(code);
    localStorage.setItem(LANG_PREF_KEY, code);
  };

  const translate = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const apiBaseUrl = (
        import.meta.env.VITE_API_URL || "http://localhost:3001/api"
      ).replace(/\/+$/, "");
      const response = await fetch(
        `${apiBaseUrl}/ai/voice-translate?target=${encodeURIComponent(lang)}`,
        {
          method: "POST",
          headers: { "Content-Type": file.type || "audio/m4a" },
          body: file,
        },
      );
      if (!response.ok)
        throw new Error(`Translation failed (${response.status})`);
      const data = (await response.json()) as TranslateResult;
      if (!data.originalText) {
        setError(
          "Couldn't transcribe that recording — it may be silent or too noisy.",
        );
        return;
      }
      setResult(data);
    } catch {
      setError(
        "Voice translation is unavailable right now. Please try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  };

  const playTranslation = () => {
    if (!result?.audioBase64) return;
    audioRef.current?.pause();
    // MMS-TTS returns FLAC; browsers play it natively via the audio element.
    const audio = new Audio(`data:audio/flac;base64,${result.audioBase64}`);
    audioRef.current = audio;
    void audio.play();
  };

  const languageLabel = (code: string | null) =>
    RESPONDER_LANGUAGES.find((entry) => entry.code === code)?.label ??
    code ??
    "unknown";

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl ${className ?? ""}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/15">
            <Languages className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              Voice evidence translator
            </p>
            <p className="text-[11px] text-slate-400">
              Hear survivor voice notes in your language — any language in, your
              language out
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          My language
          <select
            value={lang}
            onChange={(event) => updateLang(event.target.value)}
            className="rounded-md border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs font-semibold text-white focus:border-purple-500/50 focus:outline-none"
            aria-label="Preferred playback language"
          >
            {RESPONDER_LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void translate(file);
          event.target.value = "";
        }}
      />

      <Button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        variant="outline"
        className="h-11 w-full border-white/10 bg-white/5 text-xs font-black uppercase tracking-widest"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transcribing &
            translating…
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Upload voice note
          </>
        )}
      </Button>

      {error && (
        <p className="mt-3 text-xs font-medium text-rose-400">{error}</p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Original · {languageLabel(result.detectedLanguage)}
              {fileName ? ` · ${fileName}` : ""}
            </p>
            <p className="text-sm leading-relaxed text-slate-200">
              {result.originalText}
            </p>
          </div>
          <div className="rounded-lg border border-purple-500/25 bg-purple-500/10 p-3">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-purple-300">
              Translation · {languageLabel(result.targetLanguage)}
            </p>
            <p className="text-sm leading-relaxed text-white">
              {result.translatedText}
            </p>
            {result.audioBase64 ? (
              <Button
                onClick={playTranslation}
                size="sm"
                className="mt-3 h-9 bg-purple-600 text-xs font-bold hover:bg-purple-500"
              >
                <Play className="mr-1.5 h-3.5 w-3.5" /> Play in{" "}
                {languageLabel(result.targetLanguage)}
              </Button>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                <Volume2 className="h-3.5 w-3.5" /> Audio playback unavailable
                for this language — transcript above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceNoteTranslator;
