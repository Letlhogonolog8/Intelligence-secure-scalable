/**
 * BullMQ notification dispatcher (skeleton).
 *
 * Status: parallel implementation, gated behind `USE_BULLMQ_NOTIFICATIONS=true`.
 * Default path remains the Supabase polling worker in `server/worker.ts` so
 * that this can be enabled gradually per environment.
 *
 * Design:
 *   - Producer side: server code (e.g. escalation handler) calls
 *     enqueueNotification(payload). It (a) inserts a row into
 *     notification_queue with status='pending' as today, AND (b) pushes
 *     a BullMQ job referencing that row's ID. (Dual-write keeps the
 *     polling fallback usable during cutover.)
 *   - Consumer side: a BullMQ Worker (see startBullmqNotificationWorker)
 *     picks the job up, calls TwilioNotificationService for the actual
 *     send, and updates the Supabase row.
 *
 * After full cutover (BullMQ stable in production for >= 1 week):
 *   - Remove the Supabase polling fallback in server/worker.ts.
 *   - Remove the Supabase insert in enqueueNotification (or keep it as
 *     an audit-only row).
 *
 * See docs/BULLMQ_MIGRATION.md for the full migration plan.
 */

import { Queue, QueueEvents, Worker, type Job } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TwilioNotificationService } from '../notifications/twilio.js';

export interface NotificationJobData {
  notificationId: string;
  channel: 'sms' | 'whatsapp';
  recipient: string;
  body: string;
  messageType: string;
  caseId?: string;
  attempt: number;
}

const QUEUE_NAME = 'aegis:notifications';

let connection: Redis | null = null;
let queue: Queue<NotificationJobData> | null = null;
let queueEvents: QueueEvents | null = null;
let worker: Worker<NotificationJobData> | null = null;

const isEnabled = (): boolean => process.env.USE_BULLMQ_NOTIFICATIONS === 'true';

const getConnection = (): Redis => {
  if (connection) return connection;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('USE_BULLMQ_NOTIFICATIONS=true requires REDIS_URL to be set');
  }
  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return connection;
};

export const getNotificationsQueue = (): Queue<NotificationJobData> | null => {
  if (!isEnabled()) return null;
  if (queue) return queue;
  queue = new Queue<NotificationJobData>(QUEUE_NAME, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 1_000, age: 24 * 60 * 60 },
      removeOnFail: { count: 5_000, age: 7 * 24 * 60 * 60 },
    },
  });
  queueEvents = new QueueEvents(QUEUE_NAME, { connection: getConnection() });
  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[bullmq] notification job ${jobId} failed: ${failedReason}`);
  });
  return queue;
};

/**
 * Enqueue a notification job.
 *
 * Returns true if the job was queued, false if BullMQ is disabled and
 * the caller should fall back to the existing polling path.
 */
export async function enqueueNotificationJob(data: NotificationJobData): Promise<boolean> {
  const q = getNotificationsQueue();
  if (!q) return false;
  await q.add('send', data, { jobId: data.notificationId });
  return true;
}

/**
 * Start the BullMQ worker. Call this from server/worker.ts entry point
 * when USE_BULLMQ_NOTIFICATIONS=true.
 *
 * The handler delegates to TwilioNotificationService so the actual
 * provider logic, retry backoff and audit-log integration stay unchanged.
 */
export function startBullmqNotificationWorker(supabase: SupabaseClient): Worker<NotificationJobData> | null {
  if (!isEnabled()) return null;
  if (worker) return worker;

  const twilio = new TwilioNotificationService(supabase);

  worker = new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job: Job<NotificationJobData>) => {
      const { channel, recipient, body, messageType, caseId } = job.data;

      const result = channel === 'whatsapp'
        ? await twilio.sendWhatsApp(recipient, body, messageType, caseId)
        : await twilio.sendSMS(recipient, body, messageType, caseId);

      if (!result.success) {
        throw new Error(result.error || `Twilio dispatch failed (${result.status})`);
      }

      return result;
    },
    {
      connection: getConnection(),
      concurrency: Number(process.env.BULLMQ_NOTIFICATION_CONCURRENCY || 10),
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[bullmq] notification ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`[bullmq] notification ${job.id} delivered`);
  });

  return worker;
}

export async function stopBullmqNotificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

// Internal hooks for tests.
export const __INTERNAL = {
  resetForTests(): void {
    queue = null;
    queueEvents = null;
    worker = null;
    connection = null;
  },
};
