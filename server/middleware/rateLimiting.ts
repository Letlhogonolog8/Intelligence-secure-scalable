import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request, RequestHandler } from 'express';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;
let redisInitError: string | null = null;
let initialized = false;

export type RateLimitStoreStatus = {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  store: 'redis' | 'memory';
  reason: 'connected' | 'not_configured' | 'disabled_outside_production' | 'connection_failed';
  error: string | null;
};

const hasRedisConfiguration = () => Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

const shouldUseRedisForRateLimiting = () => hasRedisConfiguration() && process.env.NODE_ENV === 'production';

const initializeRedis = async () => {
  if (shouldUseRedisForRateLimiting()) {
    try {
      const redisUrl = process.env.REDIS_URL || (process.env.REDIS_PASSWORD
        ? `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`
        : `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`);
      redisClient = createClient({ url: redisUrl });
      redisInitError = null;

      redisClient.on('error', (err) => {
        console.error('Redis client error:', err);
        redisConnected = false;
        redisInitError = err instanceof Error ? err.message : String(err);
      });

      await redisClient.connect();
      redisConnected = true;
      redisInitError = null;
      console.log('Redis client connected for rate limiting');
    } catch (error) {
      console.warn('Redis connection failed, using in-memory rate limiting:', error);
      redisConnected = false;
      redisInitError = error instanceof Error ? error.message : String(error);
    }
  } else if (hasRedisConfiguration()) {
    redisInitError = null;
    console.log('Redis is configured but rate limiting stays in-memory outside production');
  } else {
    redisInitError = null;
    console.log('Redis not configured, using in-memory rate limiting');
  }
};

const createRedisStore = () => {
  if (!redisClient || !redisConnected) {
    return undefined;
  }

  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
  });
};

const createLimiter = (options: Parameters<typeof rateLimit>[0]) => rateLimit({
  ...options,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRedisStore(),
});

type LimiterHandlers = {
  defaultLimiter: RequestHandler;
  authLimiter: RequestHandler;
  apiLimiter: RequestHandler;
  strictLimiter: RequestHandler;
  escalationLimiter: RequestHandler;
  mfaLimiter: RequestHandler;
};

const buildLimiters = (): LimiterHandlers => ({
  defaultLimiter: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req: Request) => ['/api/health', '/health', '/health/live', '/health/ready'].includes(req.path),
  }),
  authLimiter: createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true,
  }),
  apiLimiter: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),
  strictLimiter: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many requests, please slow down.',
  }),
  escalationLimiter: createLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many escalation requests, please wait before creating another.',
  }),
  mfaLimiter: createLimiter({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: 'Too many MFA attempts, please try again later.',
    skipSuccessfulRequests: true,
  }),
});

let limiterHandlers: LimiterHandlers = buildLimiters();

const delegateTo = (key: keyof LimiterHandlers): RequestHandler => (req, res, next) => limiterHandlers[key](req, res, next);

export const defaultLimiter: RequestHandler = delegateTo('defaultLimiter');
export const authLimiter: RequestHandler = delegateTo('authLimiter');
export const apiLimiter: RequestHandler = delegateTo('apiLimiter');
export const strictLimiter: RequestHandler = delegateTo('strictLimiter');
export const escalationLimiter: RequestHandler = delegateTo('escalationLimiter');
export const mfaLimiter: RequestHandler = delegateTo('mfaLimiter');

export const initializeRateLimiting = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  initialized = true;
  await initializeRedis();
  limiterHandlers = buildLimiters();
};

export const getRedisClient = () => redisClient;

export const getRateLimitStoreStatus = (): RateLimitStoreStatus => {
  if (redisConnected && redisClient?.isOpen) {
    return {
      configured: hasRedisConfiguration(),
      enabled: true,
      connected: true,
      store: 'redis',
      reason: 'connected',
      error: null,
    };
  }

  if (!hasRedisConfiguration()) {
    return {
      configured: false,
      enabled: false,
      connected: false,
      store: 'memory',
      reason: 'not_configured',
      error: null,
    };
  }

  if (!shouldUseRedisForRateLimiting()) {
    return {
      configured: true,
      enabled: false,
      connected: false,
      store: 'memory',
      reason: 'disabled_outside_production',
      error: null,
    };
  }

  return {
    configured: true,
    enabled: true,
    connected: false,
    store: 'memory',
    reason: 'connection_failed',
    error: redisInitError,
  };
};

export const closeRedisClient = async () => {
  if (redisClient && redisConnected) {
    try {
      await redisClient.quit();
      console.log('Redis client closed');
      redisConnected = false;
    } catch (error) {
      console.error('Error closing Redis client:', error);
    }
  }
};
