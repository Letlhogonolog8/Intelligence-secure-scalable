import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request } from 'express';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;

const initializeRedis = async () => {
  if ((process.env.REDIS_URL || process.env.REDIS_HOST) && process.env.NODE_ENV === 'production') {
    try {
      const redisUrl = process.env.REDIS_URL || (process.env.REDIS_PASSWORD
        ? `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`
        : `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`);
      redisClient = createClient({ url: redisUrl });

      redisClient.on('error', (err) => {
        console.error('❌ Redis client error:', err);
        redisConnected = false;
      });

      await redisClient.connect();
      redisConnected = true;
      console.log('✅ Redis client connected for rate limiting');
    } catch (error) {
      console.warn('⚠️ Redis connection failed, using in-memory rate limiting:', error);
      redisConnected = false;
    }
  } else {
    console.log('ℹ️ Redis not configured, using in-memory rate limiting');
  }
};

// Initialize Redis asynchronously
initializeRedis().catch(err => {
  console.error('Failed to initialize Redis:', err);
});

const createRedisStore = () => {
  if (!redisClient) {
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

export const defaultLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req: Request) => req.path === '/api/health',
});

export const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

export const strictLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests, please slow down.',
});

export const escalationLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many escalation requests, please wait before creating another.',
});

export const mfaLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Too many MFA attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const getRedisClient = () => redisClient;

export const closeRedisClient = async () => {
  if (redisClient && redisConnected) {
    try {
      await redisClient.quit();
      console.log('✅ Redis client closed');
      redisConnected = false;
    } catch (error) {
      console.error('Error closing Redis client:', error);
    }
  }
};
