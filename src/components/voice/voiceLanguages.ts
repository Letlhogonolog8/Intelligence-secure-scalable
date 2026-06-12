/**
 * Languages the voice pipeline can target (mirrors the backend's MMS-TTS
 * model map). Shared by the translator and the evidence archive so language
 * codes always render with the same human label.
 */
export const RESPONDER_LANGUAGES: Array<{ code: string; label: string }> = [
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

export const languageLabel = (code: string | null | undefined): string =>
  RESPONDER_LANGUAGES.find((entry) => entry.code === code)?.label ??
  code ??
  "unknown";
