/**
 * Spoken playback for the voice pipeline.
 *
 * Preferred path: server-side Azure neural TTS (consistent across devices,
 * better SA-language voices) via /api/ai/tts. When that's unavailable (no
 * provider key, or a language Azure doesn't voice) callers fall back to the
 * Web Speech API: zero-cost, offline-capable, device-dependent voice quality.
 */

/** Best-effort BCP-47 hints so devices pick a regionally-correct voice. */
const SPEECH_LOCALES: Record<string, string> = {
  en: "en-ZA",
  af: "af-ZA",
  zu: "zu-ZA",
  xh: "xh-ZA",
  st: "st-ZA",
  tn: "tn-ZA",
  ts: "ts-ZA",
  ve: "ve-ZA",
  ss: "ss-ZA",
  nso: "nso-ZA",
  nr: "nr-ZA",
  sw: "sw-KE",
  fr: "fr-FR",
  am: "am-ET",
  yo: "yo-NG",
  ha: "ha-NG",
};

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak `text` in `language`, cancelling anything already speaking. */
export function speakText(
  text: string,
  language: string,
  onEnd?: () => void,
): boolean {
  if (!canSpeak() || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LOCALES[language] ?? language;
  const voice = window.speechSynthesis
    .getVoices()
    .find((entry) =>
      entry.lang?.toLowerCase().startsWith(language.toLowerCase()),
    );
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/**
 * Request server-side (Azure) TTS audio for `text` in `language`. Returns a
 * playable data URL, or null when the server has no TTS provider configured or
 * the language is unsupported — callers then fall back to speakText().
 */
export async function fetchServerTts(
  text: string,
  language: string,
): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    const base = (
      import.meta.env.VITE_API_URL || "http://localhost:3001/api"
    ).replace(/\/+$/, "");
    const response = await fetch(`${base}/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      audioBase64?: string;
      audioMimeType?: string;
    };
    if (!data.audioBase64) return null;
    return `data:${data.audioMimeType || "audio/mpeg"};base64,${data.audioBase64}`;
  } catch {
    return null;
  }
}
