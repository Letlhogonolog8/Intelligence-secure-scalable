/**
 * WhatsApp bot session persistence — Redis when configured, else in-process Map.
 * Survives API restarts and horizontal scale when REDIS_URL / REDIS_HOST is set.
 */

import IORedis from 'ioredis';
import { createLogger } from './logger';

const logger = createLogger('whatsapp-sessions');

const SESSION_TTL_SEC = 30 * 60;
const REDIS_KEY_PREFIX = 'aegis:wa:session:';

export type WATier = 'report' | 'help' | 'status' | 'ai_chat' | 'main';

export interface WASession {
  phoneNumber: string;
  tier: WATier;
  language: string;
  incidentData: Record<string, string>;
  aiHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivity: number;
}

function resolveRedisUrl(): string | null {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (!process.env.REDIS_HOST) return null;
  const port = process.env.REDIS_PORT || '6379';
  if (process.env.REDIS_PASSWORD) {
    return `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD)}@${process.env.REDIS_HOST}:${port}`;
  }
  return `redis://${process.env.REDIS_HOST}:${port}`;
}

let redisClient: IORedis | null | undefined;
let loggedMemoryFallback = false;

function getRedis(): IORedis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }
  const url = resolveRedisUrl();
  if (!url) {
    redisClient = null;
    if (!loggedMemoryFallback) {
      loggedMemoryFallback = true;
      logger.info('WhatsApp sessions: using in-memory store (Redis not configured)');
    }
    return null;
  }
  const client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 8000,
  });
  client.on('error', (err) => {
    logger.warn('Redis error for WhatsApp sessions', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
  redisClient = client;
  return client;
}

const memorySessions = new Map<string, WASession>();

/** Proactive cleanup for in-memory fallback only */
setInterval(() => {
  if (getRedis()) return;
  const now = Date.now();
  for (const [key, session] of memorySessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL_SEC * 1000) {
      memorySessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function loadSession(phone: string): Promise<WASession | null> {
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(`${REDIS_KEY_PREFIX}${phone}`);
      if (raw) {
        return JSON.parse(raw) as WASession;
      }
    } catch (e) {
      logger.warn('Redis GET failed for WhatsApp session; trying memory', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return memorySessions.get(phone) ?? null;
}

export async function saveSession(phone: string, session: WASession): Promise<void> {
  session.lastActivity = Date.now();
  const r = getRedis();
  if (r) {
    try {
      await r.set(`${REDIS_KEY_PREFIX}${phone}`, JSON.stringify(session), 'EX', SESSION_TTL_SEC);
      memorySessions.delete(phone);
      return;
    } catch (e) {
      logger.warn('Redis SET failed for WhatsApp session; persisting in memory', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  memorySessions.set(phone, session);
}
