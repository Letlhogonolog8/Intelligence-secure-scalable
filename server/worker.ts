import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { TwilioNotificationService } from './notifications/twilio';
import { createLogger } from './utils/logger';

dotenv.config();

const logger = createLogger('notification-worker');

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isWorkerEnabled(): boolean {
  return process.env.NOTIFICATION_WORKER_ENABLED !== 'false';
}

const supabase = createClient(
  getRequiredEnv('VITE_SUPABASE_URL'),
  getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
);

const notificationService = new TwilioNotificationService(supabase);

let workerInterval: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

async function runCycle(): Promise<void> {
  if (inFlight) {
    return;
  }

  inFlight = true;

  try {
    const batchSize = Math.max(1, Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE || 25));
    const processed = await notificationService.processPendingNotifications(batchSize);

    if (processed > 0) {
      logger.info('Notification queue processed', { processed, batchSize });
    }
  } catch (error) {
    logger.error('Notification worker cycle failed', error);
  } finally {
    inFlight = false;
  }
}

function startWorker(): void {
  if (!isWorkerEnabled()) {
    logger.warn('Notification worker disabled by configuration');
    return;
  }

  const intervalMs = Math.max(5000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 15000));

  workerInterval = setInterval(() => {
    void runCycle();
  }, intervalMs);

  workerInterval.unref?.();
  void runCycle();

  logger.info('Notification worker started', {
    intervalMs,
    batchSize: Math.max(1, Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE || 25)),
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down notification worker...`);

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  while (inFlight) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  logger.info('Notification worker shutdown complete');
  process.exit(0);
}

startWorker();

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
