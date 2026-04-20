import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createLogger } from '../utils/logger';

const logger = createLogger('notification-queue');

function resolveRedisUrl(): string | null {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (!process.env.REDIS_HOST) return null;
  return `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
}

function createConnection(): IORedis | null {
  const url = resolveRedisUrl();
  if (!url) {
    logger.warn('Redis not configured — notification queue is disabled');
    return null;
  }

  const client = new IORedis(url, { maxRetriesPerRequest: null, lazyConnect: true });

  client.on('error', (err) => {
    logger.error('Redis connection error for queue', err);
  });

  client.on('connect', () => {
    logger.info('Notification queue Redis connected');
  });

  return client;
}

let _connection: IORedis | null = null;
let _queue: Queue | null = null;

function getConnection(): IORedis | null {
  if (_connection === null) {
    _connection = createConnection();
  }
  return _connection;
}

function getQueue(): Queue | null {
  if (_queue) return _queue;

  const conn = getConnection();
  if (!conn) return null;

  _queue = new Queue('notifications', {
    connection: conn,
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

  return _queue;
}

export const notificationQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const q = getQueue();
    if (!q) {
      throw new Error(`Notification queue unavailable: Redis is not configured (accessing .${String(prop)})`);
    }
    return typeof (q as unknown as Record<string | symbol, unknown>)[prop] === 'function'
      ? (q as unknown as Record<string | symbol, unknown>)[prop]
      : (q as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export interface NotificationJobData {
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  recipient: string;
  message: string;
  metadata?: Record<string, unknown>;
  priority?: number;
}

export async function queueNotification(data: NotificationJobData): Promise<string | null> {
  const q = getQueue();
  if (!q) {
    logger.warn('Notification queue unavailable — skipping job', { type: data.type, recipient: data.recipient });
    return null;
  }
  const job = await q.add('send-notification', data, {
    priority: data.priority || 5,
  });
  logger.info('Notification queued', { jobId: job.id, type: data.type });
  return job.id!;
}

export async function queueBulkNotifications(notifications: NotificationJobData[]): Promise<(string | null)[]> {
  const q = getQueue();
  if (!q) {
    logger.warn('Notification queue unavailable — skipping bulk jobs', { count: notifications.length });
    return notifications.map(() => null);
  }
  const jobs = await q.addBulk(
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
): Worker | null {
  const conn = getConnection();
  if (!conn) {
    logger.warn('Notification worker not started — Redis is not configured');
    return null;
  }

  const worker = new Worker<NotificationJobData>(
    'notifications',
    async (job) => {
      logger.info('Processing notification', { jobId: job.id, type: job.data.type });
      await processor(job);
    },
    {
      connection: conn,
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

export async function getQueueStats(): Promise<Record<string, number> | null> {
  const q = getQueue();
  if (!q) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
    q.getDelayedCount(),
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
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
  logger.info('Notification queue closed');
}
