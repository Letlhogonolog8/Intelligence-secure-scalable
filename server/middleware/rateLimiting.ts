import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { Request } from 'express';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;

const initializeRedis = async () => {
  if (process.env.REDIS_HOST && process.env.NODE_ENV === 'production') {
    try {
      redisClient = createClient({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      });

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

export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req: Request) => req.path === '/api/health',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const escalationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many escalation requests, please wait before creating another.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Too many MFA attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
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
