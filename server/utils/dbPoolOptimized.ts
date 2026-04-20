import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createLogger } from './logger';

const logger = createLogger('db-pool');

interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
  active: number;
}

class DatabasePool {
  private pool: Pool | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000;
  private readonly MAX_HEALTH_CHECK_INTERVAL = 300000;
  private consecutiveFailures = 0;
  private healthCheckTimeout: NodeJS.Timeout | null = null;

  private hasRequiredConfiguration(): boolean {
    return Boolean(process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD);
  }

  initialize(): void {
    if (this.pool) return;
    if (!this.hasRequiredConfiguration()) {
      logger.warn('Direct PostgreSQL pool disabled: missing DB_NAME, DB_USER, or DB_PASSWORD');
      return;
    }

    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '2000'),
      application_name: 'aegis-ai-backend',
      statement_timeout: 10000,
      query_timeout: 10000,
    };

    this.pool = new Pool(config);

    this.pool.on('error', (err) => {
      logger.error('Unexpected pool error', err);
    });

    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });

    this.pool.on('remove', () => {
      logger.info('Database connection removed from pool');
    });

    this.startHealthCheck();
    logger.info('Database pool initialized', { config: { ...config, password: '***' } });
  }

  private scheduleHealthCheck(delayMs: number): void {
    if (this.healthCheckTimeout) clearTimeout(this.healthCheckTimeout);
    this.healthCheckTimeout = setTimeout(async () => {
      try {
        await this.query('SELECT 1');
        if (this.consecutiveFailures > 0) {
          logger.info('Database connection restored');
          this.consecutiveFailures = 0;
        }
        this.scheduleHealthCheck(this.HEALTH_CHECK_INTERVAL);
      } catch (error) {
        this.consecutiveFailures++;
        const nextDelay = Math.min(
          this.HEALTH_CHECK_INTERVAL * Math.pow(2, this.consecutiveFailures - 1),
          this.MAX_HEALTH_CHECK_INTERVAL
        );
        if (this.consecutiveFailures === 1 || this.consecutiveFailures % 5 === 0) {
          logger.warn('Database health check failed', {
            consecutiveFailures: this.consecutiveFailures,
            nextRetryMs: nextDelay,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        this.scheduleHealthCheck(nextDelay);
      }
    }, delayMs);
  }

  private startHealthCheck(): void {
    this.scheduleHealthCheck(this.HEALTH_CHECK_INTERVAL);
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('Pool not initialized. Configure DB_NAME, DB_USER, and DB_PASSWORD to enable direct PostgreSQL access.');
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      logger.debug('Query executed', { duration, rows: result.rowCount });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', error, { duration, query: text });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) throw new Error('Pool not initialized');
    return await this.pool.connect();
  }

  getStats(): PoolStats | null {
    if (!this.pool) return null;
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      active: this.pool.totalCount - this.pool.idleCount,
    };
  }

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.healthCheckTimeout) {
      clearTimeout(this.healthCheckTimeout);
      this.healthCheckTimeout = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database pool closed');
    }
  }
}

export const dbPool = new DatabasePool();
