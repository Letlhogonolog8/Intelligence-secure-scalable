/**
 * Browser text-to-speech fallback for the voice pipeline.
 *
 * The hosted MMS-TTS leg of /api/ai/voice-translate is unreliable on the
 * serverless tier, so translated playback falls back to the Web Speech API:
 * zero-cost, offline-capable, and available in every modern browser. Voice
 * coverage varies per device — the browser picks the closest voice for the
 * requested language, falling back to its default voice.
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
