import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const DB_NAME = "aegis-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-reports";

export interface OfflineReport {
  id: string;
  type: "case_report" | "evidence" | "escalation";
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineReport(report: Omit<OfflineReport, "retries">): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ ...report, retries: 0 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // indexedDB unavailable — silently drop
  }
}

async function getAllPending(): Promise<OfflineReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineReport[]);
    req.onerror = () => reject(req.error);
  });
}

async function deleteRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateRetry(report: OfflineReport): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...report, retries: report.retries + 1 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushPendingReports(): Promise<{ synced: number; failed: number }> {
  const pending = await getAllPending();
  let synced = 0;
  let failed = 0;

  for (const report of pending) {
    if (report.retries >= 5) {
      await deleteRecord(report.id);
      continue;
    }
    try {
      if (report.type === "case_report") {
        const { error } = await supabase.from("case_reports").upsert(report.payload as never);
        if (error) throw error;
      } else if (report.type === "escalation") {
        const { error } = await supabase.from("escalation_events").upsert(report.payload as never);
        if (error) throw error;
      }
      await deleteRecord(report.id);
      synced++;
    } catch {
      await updateRetry(report);
      failed++;
    }
  }

  return { synced, failed };
}

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const syncRef = useRef(false);

  const refreshCount = async () => {
    try {
      const pending = await getAllPending();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  };

  const syncNow = async () => {
    if (syncRef.current || !navigator.onLine) return;
    syncRef.current = true;
    setIsSyncing(true);
    try {
      await flushPendingReports();
      setLastSyncAt(new Date());
      await refreshCount();
    } finally {
      setIsSyncing(false);
      syncRef.current = false;
    }
  };

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);
    const handleStorage = () => refreshCount();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, 60_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow };
}
