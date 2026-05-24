import { createClient, RedisClientType } from "redis";
import { createLogger } from "./logger";

const logger = createLogger("cache-manager");

interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

class CacheManager {
  private client: RedisClientType | null = null;
  private connected = false;
  private readonly DEFAULT_TTL = 300;

  async initialize(): Promise<void> {
    if (this.client) return;

    const redisUrl = this.getRedisUrl();
    if (!redisUrl) {
      logger.warn("Redis not configured, caching disabled");
      return;
    }

    const isDev = process.env.NODE_ENV !== "production";
    const forceConnect = process.env.REDIS_FORCE_CONNECT === "true";
    if (isDev && !forceConnect) {
      logger.info(
        "Redis skipped in development (set REDIS_FORCE_CONNECT=true to enable)",
      );
      return;
    }

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= 5) {
              logger.warn(
                "Redis max reconnect attempts reached, disabling cache",
              );
              this.client = null;
              this.connected = false;
              return false;
            }
            return Math.min(retries * 500, 3000);
          },
        },
      });

      this.client.on("error", (err) => {
        if (this.connected) {
          logger.error("Redis client error", err);
        }
        this.connected = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis cache connected");
        this.connected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error("Failed to initialize Redis cache", error);
      this.client = null;
    }
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.client!.get(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error("Cache get failed", error, { key });
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.DEFAULT_TTL;
      await this.client!.setEx(fullKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error("Cache set failed", error, { key });
      return false;
    }
  }

  async del(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.client!.del(fullKey);
      return true;
    } catch (error) {
      logger.error("Cache delete failed", error, { key });
      return false;
    }
  }

  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    if (!this.isAvailable()) return keys.map(() => null);

    try {
      const fullKeys = keys.map((k) => this.buildKey(k, options?.prefix));
      const values = await this.client!.mGet(fullKeys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      logger.error("Cache mget failed", error);
      return keys.map(() => null);
    }
  }

  async mset<T>(
    entries: Array<{ key: string; value: T }>,
    options?: CacheOptions,
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const ttl = options?.ttl || this.DEFAULT_TTL;
      const pipeline = this.client!.multi();

      entries.forEach(({ key, value }) => {
        const fullKey = this.buildKey(key, options?.prefix);
        pipeline.setEx(fullKey, ttl, JSON.stringify(value));
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error("Cache mset failed", error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const keys: string[] = [];
      let cursor = 0;

      do {
        const result = await this.client!.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      if (keys.length === 0) return 0;
      await this.client!.del(keys);
      return keys.length;
    } catch (error) {
      logger.error("Cache invalidate pattern failed", error, { pattern });
      return 0;
    }
  }

  isAvailable(): boolean {
    return this.connected && this.client !== null;
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private getRedisUrl(): string | null {
    if (process.env.REDIS_URL) return process.env.REDIS_URL;
    if (!process.env.REDIS_HOST) return null;

    const protocol = process.env.REDIS_TLS === "true" ? "rediss" : "redis";
    const credentials = process.env.REDIS_PASSWORD
      ? `:${process.env.REDIS_PASSWORD}@`
      : "";
    const port = process.env.REDIS_PORT || "6379";

    return `${protocol}://${credentials}${process.env.REDIS_HOST}:${port}`;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
      logger.info("Redis cache closed");
    }
  }
}

export const cacheManager = new CacheManager();
