import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export interface DatabasePoolConfig extends PoolConfig {
  enabled: boolean;
}

export function initializePool(config: DatabasePoolConfig): Pool {
  if (pool) {
    return pool;
  }

  if (!config.enabled) {
    throw new Error('Database connection pooling is disabled in configuration');
  }

  const poolConfig: PoolConfig = {
    host: config.host || process.env.DB_HOST || 'localhost',
    port: config.port || parseInt(process.env.DB_PORT || '5432'),
    database: config.database || process.env.DB_NAME,
    user: config.user || process.env.DB_USER,
    password: config.password || process.env.DB_PASSWORD,
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    application_name: 'aegis-ai-backend',
    statement_cache_size: 0,
  };

  pool = new Pool(poolConfig);

  pool.on('error', (error: Error) => {
    console.error('Unexpected error on idle client', error);
  });

  pool.on('connect', () => {
    console.log('New database connection established');
  });

  pool.on('remove', () => {
    console.log('Database connection removed from pool');
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

export async function getPoolStats() {
  if (!pool) {
    return null;
  }
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export async function executeQuery(query: string, params?: any[]) {
  const client = await getPool().connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release();
  }
}

export async function beginTransaction() {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    return {
      query: (query: string, params?: any[]) => client.query(query, params),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release(),
    };
  } catch (error) {
    client.release();
    throw error;
  }
}
