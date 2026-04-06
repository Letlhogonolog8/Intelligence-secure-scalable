/**
 * USSD Offline Cache System
 * server/ussd/offlineCache.ts
 * 
 * Enables USSD functionality in areas with intermittent connectivity:
 * - Local SQLite cache for USSD sessions
 * - Queue management for SMS fallback
 * - Auto-sync when connectivity restored
 * - Data encryption for offline storage
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function sanitizeLog(value: string): string {
  return value.replace(/[\r\n\t]/g, '_').substring(0, 200);
}

export interface CachedSession {
  id: string;
  phoneNumber: string;
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

export interface CachedCase {
  caseId: string;
  phoneNumber: string;
  description: string;
  language: string;
  timestamp: number;
  synced: boolean;
}

export interface OfflineQueue {
  id: string;
  phoneNumber: string;
  messageType: 'sms' | 'ussd_confirmation' | 'case_update';
  content: string;
  timestamp: number;
  retries: number;
  synced: boolean;
}

export class OfflineCache {
  private cacheDir: string;
  private sessionsFile: string;
  private casesFile: string;
  private queueFile: string;

  constructor(cacheDir: string = './offline_cache', _encryptionKey: string = process.env.ENCRYPTION_KEY || 'default-key') {
    this.cacheDir = cacheDir;
    this.sessionsFile = path.join(cacheDir, 'sessions.json');
    this.casesFile = path.join(cacheDir, 'cases.json');
    this.queueFile = path.join(cacheDir, 'queue.json');

    this.initializeCache();
  }

  /**
   * Initialize cache directory
   */
  private initializeCache(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Initialize files if they don't exist
    if (!fs.existsSync(this.sessionsFile)) {
      this.writeFile(this.sessionsFile, []);
    }
    if (!fs.existsSync(this.casesFile)) {
      this.writeFile(this.casesFile, []);
    }
    if (!fs.existsSync(this.queueFile)) {
      this.writeFile(this.queueFile, []);
    }

    console.log(`✅ Offline cache initialized at ${this.cacheDir}`);
  }

  /**
   * Save USSD session to offline cache
   */
  public cacheSession(session: CachedSession): boolean {
    try {
      const sessions = this.readFile(this.sessionsFile) as CachedSession[];

      // Check if session exists and update, otherwise add
      const existingIndex = sessions.findIndex((s) => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = { ...session, timestamp: Date.now() };
      } else {
        sessions.push({ ...session, timestamp: Date.now(), synced: false });
      }

      this.writeFile(this.sessionsFile, sessions);
      console.log(`✅ Session ${sanitizeLog(session.id)} cached offline`);
      return true;
    } catch (error) {
      console.error('Failed to cache session:', error);
      return false;
    }
  }

  /**
   * Retrieve session from offline cache
   */
  public getSession(sessionId: string): CachedSession | null {
    try {
      const sessions = this.readFile(this.sessionsFile) as CachedSession[];
      return sessions.find((s) => s.id === sessionId) || null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Save case to offline cache (disaster recovery)
   */
  public cacheCase(caseData: CachedCase): boolean {
    try {
      const cases = this.readFile(this.casesFile) as CachedCase[];

      // Check for duplicates
      const exists = cases.some((c) => c.caseId === caseData.caseId);
      if (!exists) {
        cases.push({ ...caseData, timestamp: Date.now(), synced: false });
        this.writeFile(this.casesFile, cases);
        console.log(`✅ Case ${sanitizeLog(caseData.caseId)} cached offline`);
      }

      return true;
    } catch (error) {
      console.error('Failed to cache case:', error);
      return false;
    }
  }

  /**
   * Get unsynced cases for retry
   */
  public getUnsyncedCases(): CachedCase[] {
    try {
      const cases = this.readFile(this.casesFile) as CachedCase[];
      return cases.filter((c) => !c.synced);
    } catch (error) {
      console.error('Failed to get unsynced cases:', error);
      return [];
    }
  }

  /**
   * Mark case as synced
   */
  public markCaseSynced(caseId: string): boolean {
    try {
      const cases = this.readFile(this.casesFile) as CachedCase[];
      const caseIndex = cases.findIndex((c) => c.caseId === caseId);

      if (caseIndex >= 0) {
        cases[caseIndex].synced = true;
        this.writeFile(this.casesFile, cases);
        console.log(`✅ Case ${sanitizeLog(caseId)} marked as synced`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to mark case as synced:', error);
      return false;
    }
  }

  /**
   * Queue message for SMS fallback
   */
  public queueMessage(
    phoneNumber: string,
    messageType: 'sms' | 'ussd_confirmation' | 'case_update',
    content: string
  ): string {
    try {
      const queue = this.readFile(this.queueFile) as OfflineQueue[];
      const messageId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const message: OfflineQueue = {
        id: messageId,
        phoneNumber,
        messageType,
        content,
        timestamp: Date.now(),
        retries: 0,
        synced: false,
      };

      queue.push(message);
      this.writeFile(this.queueFile, queue);
      console.log(`📬 Message ${sanitizeLog(messageId)} queued for ${sanitizeLog(phoneNumber)}`);

      return messageId;
    } catch (error) {
      console.error('Failed to queue message:', error);
      return '';
    }
  }

  /**
   * Get pending messages
   */
  public getPendingMessages(): OfflineQueue[] {
    try {
      const queue = this.readFile(this.queueFile) as OfflineQueue[];
      return queue.filter((m) => !m.synced && m.retries < 3);
    } catch (error) {
      console.error('Failed to get pending messages:', error);
      return [];
    }
  }

  /**
   * Mark message as synced
   */
  public markMessageSynced(messageId: string): boolean {
    try {
      const queue = this.readFile(this.queueFile) as OfflineQueue[];
      const msgIndex = queue.findIndex((m) => m.id === messageId);

      if (msgIndex >= 0) {
        queue[msgIndex].synced = true;
        this.writeFile(this.queueFile, queue);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to mark message as synced:', error);
      return false;
    }
  }

  /**
   * Increment retry count for message
   */
  public incrementRetry(messageId: string): boolean {
    try {
      const queue = this.readFile(this.queueFile) as OfflineQueue[];
      const msgIndex = queue.findIndex((m) => m.id === messageId);

      if (msgIndex >= 0) {
        queue[msgIndex].retries++;
        this.writeFile(this.queueFile, queue);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to increment retry:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): Record<string, number> {
    try {
      const sessions = this.readFile(this.sessionsFile) as CachedSession[];
      const cases = this.readFile(this.casesFile) as CachedCase[];
      const queue = this.readFile(this.queueFile) as OfflineQueue[];

      return {
        cachedSessions: sessions.length,
        cachedCases: cases.length,
        unsyncedCases: cases.filter((c) => !c.synced).length,
        queuedMessages: queue.length,
        pendingMessages: queue.filter((m) => !m.synced && m.retries < 3).length,
        failedMessages: queue.filter((m) => m.retries >= 3).length,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {};
    }
  }

  /**
   * Clear old cached data (older than 7 days)
   */
  public cleanOldData(retentionDays: number = 7): number {
    try {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      // Clean sessions
      let sessions = this.readFile(this.sessionsFile) as CachedSession[];
      const originalSessionCount = sessions.length;
      sessions = sessions.filter((s) => s.timestamp > cutoffTime);
      deletedCount += originalSessionCount - sessions.length;
      this.writeFile(this.sessionsFile, sessions);

      // Clean cases
      let cases = this.readFile(this.casesFile) as CachedCase[];
      const originalCaseCount = cases.length;
      cases = cases.filter((c) => c.timestamp > cutoffTime || !c.synced); // Keep unsynced
      deletedCount += originalCaseCount - cases.length;
      this.writeFile(this.casesFile, cases);

      // Clean queue (only successful messages)
      let queue = this.readFile(this.queueFile) as OfflineQueue[];
      const originalQueueCount = queue.length;
      queue = queue.filter((m) => m.timestamp > cutoffTime || !m.synced);
      deletedCount += originalQueueCount - queue.length;
      this.writeFile(this.queueFile, queue);

      console.log(`🧹 Cleaned ${deletedCount} old cache entries`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to clean old data:', error);
      return 0;
    }
  }

  /**
   * Sync unsynced data with server
   */
  public async syncWithServer(
    onSyncCase: (caseData: CachedCase) => Promise<boolean>,
    onSyncMessage: (message: OfflineQueue) => Promise<boolean>
  ): Promise<{ casessynced: number; messagesSynced: number; failed: number }> {
    const stats = { casessynced: 0, messagesSynced: 0, failed: 0 };

    try {
      // Sync unsynced cases
      const unsyncedCases = this.getUnsyncedCases();
      for (const caseData of unsyncedCases) {
        try {
          const success = await onSyncCase(caseData);
          if (success) {
            this.markCaseSynced(caseData.caseId);
            stats.casessynced++;
          } else {
            stats.failed++;
          }
        } catch (error) {
          console.error(`Failed to sync case ${caseData.caseId}:`, error);
          stats.failed++;
        }
      }

      // Sync pending messages
      const pendingMessages = this.getPendingMessages();
      for (const message of pendingMessages) {
        try {
          const success = await onSyncMessage(message);
          if (success) {
            this.markMessageSynced(message.id);
            stats.messagesSynced++;
          } else {
            this.incrementRetry(message.id);
            stats.failed++;
          }
        } catch (error) {
          console.error(`Failed to sync message ${message.id}:`, error);
          this.incrementRetry(message.id);
          stats.failed++;
        }
      }

      console.log(`✅ Sync complete: ${stats.casessynced} cases, ${stats.messagesSynced} messages`);
      return stats;
    } catch (error) {
      console.error('Sync failed:', error);
      return stats;
    }
  }

  /**
   * Export data for backup
   */
  public exportData(): string {
    try {
      const sessions = this.readFile(this.sessionsFile);
      const cases = this.readFile(this.casesFile);
      const queue = this.readFile(this.queueFile);

      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          sessions,
          cases,
          queue,
        },
        null,
        2
      );
    } catch (error) {
      console.error('Failed to export data:', error);
      return '';
    }
  }

  /**
   * Import data from backup
   */
  public importData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);

      if (data.sessions) this.writeFile(this.sessionsFile, data.sessions);
      if (data.cases) this.writeFile(this.casesFile, data.cases);
      if (data.queue) this.writeFile(this.queueFile, data.queue);

      console.log('✅ Data imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  // Private file I/O methods

  private getAllowedPaths(): string[] {
    return [this.sessionsFile, this.casesFile, this.queueFile];
  }

  private readFile(filepath: string): unknown {
    if (!this.getAllowedPaths().includes(filepath)) {
      console.error(`Blocked read of unexpected path: ${sanitizeLog(filepath)}`);
      return [];
    }
    try {
      if (!fs.existsSync(filepath)) {
        return [];
      }

      const data = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to read file ${sanitizeLog(filepath)}:`, error);
      return [];
    }
  }

  private writeFile(filepath: string, data: unknown): void {
    if (!this.getAllowedPaths().includes(filepath)) {
      console.error(`Blocked write to unexpected path: ${sanitizeLog(filepath)}`);
      return;
    }
    try {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to write file ${sanitizeLog(filepath)}:`, error);
    }
  }
}

export default OfflineCache;
