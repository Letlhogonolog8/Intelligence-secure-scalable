/**
 * Offline-safe emergency contacts and service directory bundled with the app
 * (spec §13.1). These must remain available with no network. Numbers are
 * South African national GBV/emergency services used across the web app.
 */

export interface EmergencyContact {
  id: string;
  label: string;
  number: string;
  dial: string; // tel: target
  note?: string;
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: "police", label: "Police (SAPS)", number: "10111", dial: "10111", note: "Immediate danger" },
  { id: "gbv", label: "GBV Command Centre", number: "0800 428 428", dial: "0800428428", note: "24/7 counselling & referral" },
  { id: "ambulance", label: "Ambulance", number: "10177", dial: "10177" },
  { id: "childline", label: "Childline", number: "116", dial: "116" },
  { id: "suicide", label: "Suicide Crisis Line", number: "0800 567 567", dial: "0800567567" },
];

export const USSD_FALLBACK = "*134*7355#";

/**
 * Universal safety guides. The text is localized via i18n (`guides.<id>.*`) so
 * it shows in the survivor's language; the numbers they reference live in the
 * per-country emergency config (src/shared/emergencyNumbers.ts).
 */
export type GuideId = "safetyPlan" | "shelter" | "medical" | "legal" | "reporting";

export interface Guide {
  id: GuideId;
  category: "shelter" | "legal" | "medical" | "police" | "ngo";
}

export const GUIDES: Guide[] = [
  { id: "safetyPlan", category: "ngo" },
  { id: "shelter", category: "shelter" },
  { id: "medical", category: "medical" },
  { id: "legal", category: "legal" },
  { id: "reporting", category: "police" },
];

export const ESCALATION_TYPE_PANIC = "panic_button";
export const SEVERITY_CRITICAL = "critical";
export const STATUS_TRIGGERED = "triggered";
