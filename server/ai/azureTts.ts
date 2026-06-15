/**
 * Server-side text-to-speech via Azure AI Speech.
 *
 * Replaces the dead Hugging Face MMS-TTS leg of the voice pipeline with real,
 * consistent neural audio that sounds the same on every device and works for
 * stored-evidence playback. Graceful by design: with no AZURE_SPEECH_KEY /
 * AZURE_SPEECH_REGION (or for a language Azure doesn't voice), synthesizeSpeech
 * returns null and callers fall back to the browser's device voice.
 *
 * Setup (see README / deploy notes):
 *   AZURE_SPEECH_KEY=<key>     AZURE_SPEECH_REGION=<e.g. southafricanorth>
 */

/**
 * Azure neural voice per app language. Only languages Azure actually voices are
 * listed; anything absent (xh, st, ts, ve, ss, nso, nr, tn, yo, ha, ig…) is
 * intentionally omitted so callers fall back to the device voice rather than
 * shipping a wrong-accent reading.
 */
const AZURE_VOICES: Record<string, string> = {
  // South African
  en: "en-ZA-LeahNeural",
  af: "af-ZA-AdriNeural",
  zu: "zu-ZA-ThandoNeural",
  // Broader global set (the platform's wider language list)
  fr: "fr-FR-DeniseNeural",
  es: "es-ES-ElviraNeural",
  pt: "pt-PT-RaquelNeural",
  de: "de-DE-KatjaNeural",
  it: "it-IT-ElsaNeural",
  ru: "ru-RU-SvetlanaNeural",
  tr: "tr-TR-EmelNeural",
  ar: "ar-EG-SalmaNeural",
  hi: "hi-IN-SwaraNeural",
  zh: "zh-CN-XiaoxiaoNeural",
  id: "id-ID-GadisNeural",
  sw: "sw-KE-ZuriNeural",
  am: "am-ET-MekdesNeural",
};

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
}

export function isTtsConfigured(): boolean {
  return Boolean(
    process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION,
  );
}

/** The Azure voice name for a language, or null when unsupported. */
export function ttsVoiceFor(language: string): string | null {
  return AZURE_VOICES[language?.toLowerCase()?.split("-")[0]] ?? null;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Synthesize speech for `text` in `language`. Returns base64 MP3 + mime type,
 * or null when TTS isn't configured, the language is unsupported, or the
 * provider call fails (all non-fatal — callers degrade to the device voice).
 */
export async function synthesizeSpeech(
  text: string,
  language: string,
): Promise<TtsResult | null> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const voice = ttsVoiceFor(language);
  const trimmed = (text ?? "").trim();
  if (!key || !region || !voice || !trimmed) return null;

  const locale = voice.split("-").slice(0, 2).join("-");
  const ssml =
    `<speak version='1.0' xml:lang='${locale}'>` +
    `<voice name='${voice}'>${escapeXml(trimmed.slice(0, 800))}</voice>` +
    `</speak>`;

  try {
    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "aegis-ai",
        },
        body: ssml,
      },
    );
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;
    return { audioBase64: buffer.toString("base64"), mimeType: "audio/mpeg" };
  } catch {
    return null;
  }
}
