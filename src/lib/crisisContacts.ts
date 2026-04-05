/**
 * Crisis line defaults align with other survivor surfaces (WhatsApp, Impact, Peer Support).
 * Override via VITE_CRISIS_LINE_DISPLAY and VITE_CRISIS_LINE_TEL for other regions.
 */
const DEFAULT_DISPLAY = "0800 428 428";
const DEFAULT_TEL = "tel:0800428428";

function normalizeTelUri(input: string): string {
  const s = input.trim();
  if (s.toLowerCase().startsWith("tel:")) return s;
  const digits = s.replace(/\D/g, "");
  return digits.length > 0 ? `tel:${digits}` : DEFAULT_TEL;
}

const envDisplay = (import.meta.env.VITE_CRISIS_LINE_DISPLAY as string | undefined)?.trim();
const envTel = (import.meta.env.VITE_CRISIS_LINE_TEL as string | undefined)?.trim();

export const CRISIS_LINE_DISPLAY = envDisplay && envDisplay.length > 0 ? envDisplay : DEFAULT_DISPLAY;
export const CRISIS_LINE_TEL = envTel && envTel.length > 0 ? normalizeTelUri(envTel) : DEFAULT_TEL;

/** @deprecated Use CRISIS_LINE_DISPLAY — kept for existing imports */
export const GBV_CRISIS_LINE_DISPLAY = CRISIS_LINE_DISPLAY;
/** @deprecated Use CRISIS_LINE_TEL — kept for existing imports */
export const GBV_CRISIS_LINE_TEL = CRISIS_LINE_TEL;
