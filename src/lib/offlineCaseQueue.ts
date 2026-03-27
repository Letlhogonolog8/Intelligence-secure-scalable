import { supabase } from "@/lib/supabase";

export interface OfflineCaseDraft {
  id: string;
  description: string;
  reportMethod: "voice" | "text";
  language: string;
  survivorId: string | null;
  createdAt: string;
}

const STORAGE_KEY = "aegis_offline_case_queue";

function readQueue(): OfflineCaseDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineCaseDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineCaseDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getOfflineQueueCount(): number {
  return readQueue().length;
}

export function enqueueOfflineCase(draft: OfflineCaseDraft): void {
  const queue = readQueue();
  queue.push(draft);
  writeQueue(queue);
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining: OfflineCaseDraft[] = [];
  let synced = 0;

  for (const draft of queue) {
    const { error } = await supabase.from("case_reports").insert({
      id: draft.id,
      description: draft.description,
      report_method: draft.reportMethod,
      language: draft.language,
      status: "open",
      risk_level: "pending",
      priority: "normal",
      survivor_id: draft.survivorId,
      created_at: draft.createdAt,
      updated_at: new Date().toISOString(),
    });

    const missingCaseReports = Boolean(error) && (
      (error as { code?: string; message?: string }).code === "42P01" ||
      ((error as { message?: string }).message ?? "").toLowerCase().includes("case_reports")
    );

    if (missingCaseReports) {
      const { error: fallbackError } = await supabase.from("justice_cases").insert({
        case_number: draft.id,
        case_type: "gbv_report",
        status: "open",
        stage: "report",
        priority: "medium",
        days_open: 0,
        created_at: draft.createdAt,
        updated_at: new Date().toISOString(),
      });

      if (fallbackError) {
        remaining.push(draft);
      } else {
        synced += 1;
      }
      continue;
    }

    if (error) {
      remaining.push(draft);
    } else {
      synced += 1;
    }
  }

  writeQueue(remaining);
  return { synced, failed: remaining.length };
}
