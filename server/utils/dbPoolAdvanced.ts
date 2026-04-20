import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createLogger } from './logger';

const logger = createLogger('db-pool-advanced');

interface PoolStats {
  primary: {
    total: number;
    idle: number;
    waiting: number;
    active: number;
  };
  replica?: {
    total: number;
    idle: number;
    waiting: number;
    active: number;
  };
  queries: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  };
}

interface QueryOptions {
  useReplica?: boolean;
  timeout?: number;
  retries?: number;
}

/**
 * Advanced Database Pool with Read Replicas and Query Optimization
 */
class AdvancedDatabasePool {
  private primaryPool: Pool | null = null;
  private replicaPool: Pool | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000;
  private readonly DEFAULT_QUERY_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;

  // Query statistics
  private queryStats = {
    total: 0,
    successful: 0,
    failed: 0,
    totalDuration: 0,
  };

  initialize(): void {
    if (this.primaryPool) return;

    // Primary pool configuration
    const primaryConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '2000'),
      application_name: 'aegis-ai-primary',
      statement_timeout: this.DEFAULT_QUERY_TIMEOUT,
      query_timeout: this.DEFAULT_QUERY_TIMEOUT,
      // Connection pool optimization
      allowExitOnIdle: false,
      maxUses: 7500, // Recycle connections after 7500 uses
    };

    this.primaryPool = new Pool(primaryConfig);
    this.setupPoolEvents(this.primaryPool, 'primary');

    // Read replica pool (if configured)
    if (process.env.DB_REPLICA_HOST) {
      const replicaConfig = {
        ...primaryConfig,
        host: process.env.DB_REPLICA_HOST,
        port: parseInt(process.env.DB_REPLICA_PORT || process.env.DB_PORT || '5432'),
        max: parseInt(process.env.DB_REPLICA_POOL_MAX || '30'), // More connections for reads
        application_name: 'aegis-ai-replica',
      };

      this.replicaPool = new Pool(replicaConfig);
      this.setupPoolEvents(this.replicaPool, 'replica');
      logger.info('Read replica pool initialized');
    }

    this.startHealthCheck();
    logger.info('Advanced database pool initialized', {
      primary: { ...primaryConfig, password: '***' },
      replica: !!this.replicaPool,
    });
  }

  private setupPoolEvents(pool: Pool, name: string): void {
    pool.on('error', (err) => {
      logger.error(`Unexpected ${name} pool error`, err);
    });

    pool.on('connect', (client) => {
      logger.debug(`New ${name} connection established`);
      // Set session parameters for optimization
      client.query('SET statement_timeout = 10000').catch(() => {});
      client.query('SET idle_in_transaction_session_timeout = 30000').catch(() => {});
    });

    pool.on('remove', () => {
      logger.debug(`${name} connection removed from pool`);
    });

    pool.on('acquire', () => {
      logger.debug(`${name} connection acquired`);
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.query('SELECT 1 AS health_check');
        if (this.replicaPool) {
          await this.query('SELECT 1 AS health_check', [], { useReplica: true });
        }
      } catch (error) {
        logger.error('Database health check failed', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Execute query with automatic retry and replica routing
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const useReplica = options?.useReplica && this.isReadQuery(text) && this.replicaPool;
    const pool = useReplica ? this.replicaPool! : this.primaryPool!;
    const timeout = options?.timeout || this.DEFAULT_QUERY_TIMEOUT;
    const maxRetries = options?.retries || this.MAX_RETRIES;

    if (!pool) throw new Error('Pool not initialized');

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      try {
        // Set statement timeout for this query
        const timeoutQuery = `SET LOCAL statement_timeout = ${timeout}`;
        await pool.query(timeoutQuery);

        const result = await pool.query<T>(text, params);
        const duration = Date.now() - start;

        // Update statistics
        this.queryStats.total++;
        this.queryStats.successful++;
        this.queryStats.totalDuration += duration;

        logger.debug('Query executed', {
          duration,
          rows: result.rowCount,
          pool: useReplica ? 'replica' : 'primary',
          attempt: attempt + 1,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        lastError = error as Error;

        this.queryStats.total++;
        this.queryStats.failed++;

        logger.warn('Query failed', {
          error: lastError.message,
          duration,
          attempt: attempt + 1,
          maxRetries,
          query: text.substring(0, 100),
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await this.sleep(Math.min(100 * Math.pow(2, attempt), 1000));
        }
      }
    }

    logger.error('Query failed after retries', lastError, { query: text });
    throw lastError;
  }

  /**
   * Execute query in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.primaryPool) throw new Error('Pool not initialized');

    const client = await this.primaryPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute batch queries efficiently
   */
  async batchQuery<T extends QueryResultRow = QueryResultRow>(
    queries: Array<{ text: string; params?: unknown[] }>,
    options?: QueryOptions
  ): Promise<QueryResult<T>[]> {
    const useReplica = options?.useReplica && queries.every(q => this.isReadQuery(q.text)) && this.replicaPool;
    const pool = useReplica ? this.replicaPool! : this.primaryPool!;

    if (!pool) throw new Error('Pool not initialized');

    const client = await pool.connect();
    try {
      const results: QueryResult<T>[] = [];
      for (const query of queries) {
        const result = await client.query<T>(query.text, query.params);
        results.push(result);
      }
      return results;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client for manual connection management
   */
  async getClient(useReplica = false): Promise<PoolClient> {
    const pool = useReplica && this.replicaPool ? this.replicaPool : this.primaryPool;
    if (!pool) throw new Error('Pool not initialized');
    return await pool.connect();
  }

  /**
   * Execute prepared statement
   */
  async executePrepared<T extends QueryResultRow = QueryResultRow>(
    name: string,
    text: string,
    params: unknown[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const useReplica = options?.useReplica && this.isReadQuery(text) && this.replicaPool;
    const pool = useReplica ? this.replicaPool! : this.primaryPool!;

    if (!pool) throw new Error('Pool not initialized');

    const client = await pool.connect();
    try {
      // Prepare statement if not exists
      await client.query(`PREPARE ${name} AS ${text}`).catch(() => {
        // Statement might already exist
      });

      // Execute prepared statement
      return await client.query<T>(`EXECUTE ${name}`, params);
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const stats: PoolStats = {
      primary: {
        total: 0,
        idle: 0,
        waiting: 0,
        active: 0,
      },
      queries: {
        total: this.queryStats.total,
        successful: this.queryStats.successful,
        failed: this.queryStats.failed,
        avgDuration: this.queryStats.total > 0
          ? Math.round(this.queryStats.totalDuration / this.queryStats.total)
          : 0,
      },
    };

    if (this.primaryPool) {
      stats.primary = {
        total: this.primaryPool.totalCount,
        idle: this.primaryPool.idleCount,
        waiting: this.primaryPool.waitingCount,
        active: this.primaryPool.totalCount - this.primaryPool.idleCount,
      };
    }

    if (this.replicaPool) {
      stats.replica = {
        total: this.replicaPool.totalCount,
        idle: this.replicaPool.idleCount,
        waiting: this.replicaPool.waitingCount,
        active: this.replicaPool.totalCount - this.replicaPool.idleCount,
      };
    }

    return stats;
  }

  /**
   * Reset query statistics
   */
  resetStats(): void {
    this.queryStats = {
      total: 0,
      successful: 0,
      failed: 0,
      totalDuration: 0,
    };
  }

  /**
   * Check if query is a read operation
   */
  private isReadQuery(text: string): boolean {
    const normalized = text.trim().toUpperCase();
    return normalized.startsWith('SELECT') ||
           normalized.startsWith('WITH') ||
           normalized.startsWith('SHOW') ||
           normalized.startsWith('EXPLAIN');
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('syntax error') ||
           message.includes('permission denied') ||
           message.includes('does not exist') ||
           message.includes('duplicate key') ||
           message.includes('foreign key');
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close all pools
   */
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.primaryPool) {
      await this.primaryPool.end();
      this.primaryPool = null;
      logger.info('Primary database pool closed');
    }

    if (this.replicaPool) {
      await this.replicaPool.end();
      this.replicaPool = null;
      logger.info('Replica database pool closed');
    }
  }
}

export const advancedDbPool = new AdvancedDatabasePool();
