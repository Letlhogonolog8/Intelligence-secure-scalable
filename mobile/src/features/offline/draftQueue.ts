import AsyncStorage from "@react-native-async-storage/async-storage";

import { submitCaseReportWithEscalation } from "@/features/reports/submitCaseReport";

/**
 * Offline-safe queue for non-emergency incident reports (spec §13.2).
 * Drafts are persisted locally and flushed to `case_reports` when back online.
 * Emergency SOS is never queued — it always surfaces a direct-line fallback.
 */
const KEY = "aegis.report.drafts";

export type ReportDraft = Record<string, unknown>;

export async function getDrafts(): Promise<ReportDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReportDraft[]) : [];
  } catch {
    return [];
  }
}

export async function saveDraft(draft: ReportDraft): Promise<void> {
  const drafts = await getDrafts();
  drafts.push({ ...draft, _queuedAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(drafts));
}

export async function clearDrafts(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Attempt to submit all queued drafts. Returns the number successfully sent. */
export async function flushDrafts(): Promise<number> {
  const drafts = await getDrafts();
  if (drafts.length === 0) return 0;

  const remaining: ReportDraft[] = [];
  let sent = 0;
  for (const draft of drafts) {
    const { _queuedAt, ...payload } = draft as ReportDraft & {
      _queuedAt?: string;
    };
    try {
      await submitCaseReportWithEscalation(payload);
      sent += 1;
    } catch {
      remaining.push(draft);
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  return sent;
}
