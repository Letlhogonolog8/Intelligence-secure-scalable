import { createClient, RedisClientType } from 'redis';
import { createLogger } from './logger';
import { LRUCache } from 'lru-cache';

const logger = createLogger('cache-manager-enhanced');

interface CacheOptions {
  ttl?: number;
  prefix?: string;
  useMemoryCache?: boolean;
}

interface CacheStats {
  redis: {
    connected: boolean;
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };
  memory: {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
  };
}

/**
 * Enhanced Multi-Tier Cache Manager
 * - L1: In-memory LRU cache (fast, limited size)
 * - L2: Redis cache (distributed, persistent)
 * - Automatic fallback and promotion
 */
class EnhancedCacheManager {
  private redisClient: RedisClientType | null = null;
  private memoryCache: LRUCache<string, string>;
  private connected = false;
  private readonly DEFAULT_TTL = 300;
  private readonly MEMORY_CACHE_MAX = 1000;
  private readonly MEMORY_CACHE_TTL = 60000; // 1 minute

  // Statistics
  private stats = {
    redis: { hits: 0, misses: 0, sets: 0, deletes: 0 },
    memory: { hits: 0, misses: 0 },
  };

  constructor() {
    // Initialize L1 memory cache
    this.memoryCache = new LRUCache<string, string>({
      max: this.MEMORY_CACHE_MAX,
      ttl: this.MEMORY_CACHE_TTL,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  async initialize(): Promise<void> {
    if (this.redisClient) return;

    const redisUrl = this.getRedisUrl();
    if (!redisUrl) {
      logger.warn('Redis not configured, using memory cache only');
      return;
    }

    try {
      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
          connectTimeout: 5000,
        },
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis client error', err);
        this.connected = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis cache connected');
        this.connected = true;
      });

      this.redisClient.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      await this.redisClient.connect();
      logger.info('Enhanced cache manager initialized with Redis + Memory');
    } catch (error) {
      logger.error('Failed to initialize Redis cache', error);
      this.redisClient = null;
      logger.info('Falling back to memory-only cache');
    }
  }

  /**
   * Get value from cache (L1 -> L2)
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = this.buildKey(key, options?.prefix);

    // Try L1 (memory) first
    if (options?.useMemoryCache !== false) {
      const memValue = this.memoryCache.get(fullKey);
      if (memValue) {
        this.stats.memory.hits++;
        return JSON.parse(memValue);
      }
      this.stats.memory.misses++;
    }

    // Try L2 (Redis)
    if (!this.isRedisAvailable()) return null;

    try {
      const value = await this.redisClient!.get(fullKey);
      if (value) {
        this.stats.redis.hits++;
        // Promote to L1
        if (options?.useMemoryCache !== false) {
          this.memoryCache.set(fullKey, value);
        }
        return JSON.parse(value);
      }
      this.stats.redis.misses++;
      return null;
    } catch (error) {
      logger.error('Cache get failed', error, { key });
      return null;
    }
  }

  /**
   * Set value in cache (L1 + L2)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);
    const serialized = JSON.stringify(value);
    const ttl = options?.ttl || this.DEFAULT_TTL;

    // Set in L1 (memory)
    if (options?.useMemoryCache !== false) {
      this.memoryCache.set(fullKey, serialized);
    }

    // Set in L2 (Redis)
    if (!this.isRedisAvailable()) return true; // Memory cache succeeded

    try {
      await this.redisClient!.setEx(fullKey, ttl, serialized);
      this.stats.redis.sets++;
      return true;
    } catch (error) {
      logger.error('Cache set failed', error, { key });
      return false;
    }
  }

  /**
   * Delete from cache (L1 + L2)
   */
  async del(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);

    // Delete from L1
    this.memoryCache.delete(fullKey);

    // Delete from L2
    if (!this.isRedisAvailable()) return true;

    try {
      await this.redisClient!.del(fullKey);
      this.stats.redis.deletes++;
      return true;
    } catch (error) {
      logger.error('Cache delete failed', error, { key });
      return false;
    }
  }

  /**
   * Get multiple values (batch operation)
   */
  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    if (!this.isRedisAvailable()) {
      // Fallback to memory cache
      return keys.map(key => {
        const fullKey = this.buildKey(key, options?.prefix);
        const value = this.memoryCache.get(fullKey);
        return value ? JSON.parse(value) : null;
      });
    }

    try {
      const fullKeys = keys.map(k => this.buildKey(k, options?.prefix));
      const values = await this.redisClient!.mGet(fullKeys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      logger.error('Cache mget failed', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values (batch operation)
   */
  async mset<T>(entries: Array<{ key: string; value: T }>, options?: CacheOptions): Promise<boolean> {
    const ttl = options?.ttl || this.DEFAULT_TTL;

    // Set in memory cache
    entries.forEach(({ key, value }) => {
      const fullKey = this.buildKey(key, options?.prefix);
      this.memoryCache.set(fullKey, JSON.stringify(value));
    });

    if (!this.isRedisAvailable()) return true;

    try {
      const pipeline = this.redisClient!.multi();
      
      entries.forEach(({ key, value }) => {
        const fullKey = this.buildKey(key, options?.prefix);
        pipeline.setEx(fullKey, ttl, JSON.stringify(value));
      });

      await pipeline.exec();
      this.stats.redis.sets += entries.length;
      return true;
    } catch (error) {
      logger.error('Cache mset failed', error);
      return false;
    }
  }

  /**
   * Invalidate by pattern (Redis only)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    // Clear memory cache
    this.memoryCache.clear();

    if (!this.isRedisAvailable()) return 0;

    try {
      const keys = await this.redisClient!.keys(pattern);
      if (keys.length === 0) return 0;
      await this.redisClient!.del(keys);
      this.stats.redis.deletes += keys.length;
      return keys.length;
    } catch (error) {
      logger.error('Cache invalidate pattern failed', error, { pattern });
      return 0;
    }
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Warm up cache with data
   */
  async warmUp<T>(entries: Array<{ key: string; value: T }>, options?: CacheOptions): Promise<void> {
    logger.info('Warming up cache', { count: entries.length });
    await this.mset(entries, options);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      redis: {
        connected: this.connected,
        ...this.stats.redis,
      },
      memory: {
        size: this.memoryCache.size,
        maxSize: this.MEMORY_CACHE_MAX,
        ...this.stats.memory,
      },
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      redis: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      memory: { hits: 0, misses: 0 },
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (this.isRedisAvailable()) {
      await this.redisClient!.flushDb();
    }
    logger.info('All caches cleared');
  }

  isRedisAvailable(): boolean {
    return this.connected && this.redisClient !== null;
  }

  isAvailable(): boolean {
    return true; // Always available (memory fallback)
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private getRedisUrl(): string | null {
    if (process.env.REDIS_URL) return process.env.REDIS_URL;
    if (!process.env.REDIS_HOST) return null;

    const protocol = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
    const credentials = process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : '';
    const port = process.env.REDIS_PORT || '6379';

    return `${protocol}://${credentials}${process.env.REDIS_HOST}:${port}`;
  }

  async close(): Promise<void> {
    this.memoryCache.clear();
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
      this.connected = false;
      logger.info('Enhanced cache manager closed');
    }
  }
}

export const enhancedCacheManager = new EnhancedCacheManager();
