import { Queue, Worker, Job } from 'bullmq';
import { createClient } from 'redis';
import { createLogger } from '../utils/logger';

const logger = createLogger('notification-queue');

const connection = createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
});

connection.on('error', (err) => {
  logger.error('Redis connection error for queue', err);
});

export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

export interface NotificationJobData {
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  recipient: string;
  message: string;
  metadata?: Record<string, unknown>;
  priority?: number;
}

export async function queueNotification(data: NotificationJobData): Promise<string> {
  const job = await notificationQueue.add('send-notification', data, {
    priority: data.priority || 5,
  });
  logger.info('Notification queued', { jobId: job.id, type: data.type });
  return job.id!;
}

export async function queueBulkNotifications(notifications: NotificationJobData[]): Promise<string[]> {
  const jobs = await notificationQueue.addBulk(
    notifications.map((data) => ({
      name: 'send-notification',
      data,
      opts: {
        priority: data.priority || 5,
      },
    }))
  );
  logger.info('Bulk notifications queued', { count: jobs.length });
  return jobs.map((j) => j.id!);
}

export function createNotificationWorker(
  processor: (job: Job<NotificationJobData>) => Promise<void>
): Worker {
  const worker = new Worker<NotificationJobData>(
    'notifications',
    async (job) => {
      logger.info('Processing notification', { jobId: job.id, type: job.data.type });
      await processor(job);
    },
    {
      connection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info('Notification sent', { jobId: job.id, type: job.data.type });
  });

  worker.on('failed', (job, err) => {
    logger.error('Notification failed', err, {
      jobId: job?.id,
      type: job?.data.type,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', err);
  });

  return worker;
}

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  };
}

export async function closeQueue(): Promise<void> {
  await notificationQueue.close();
  await connection.quit();
  logger.info('Notification queue closed');
}
