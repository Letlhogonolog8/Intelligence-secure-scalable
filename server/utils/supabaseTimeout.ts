/**
 * Supabase / async-call timeout helpers.
 *
 * Most Supabase calls in the API have no timeout. A hung connection blocks
 * an Express worker until the load balancer kills the request, which under
 * load can cascade to all workers. These helpers wrap a promise with an
 * AbortController-like timer so callers can recover.
 *
 * Usage:
 *   const result = await withTimeout(
 *     supabase.from('cases').select('*').eq('id', id),
 *     5000,
 *     'cases.select'
 *   );
 */

import { createLogger } from './logger';

const logger = createLogger('supabase-timeout');

export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<T>([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          logger.warn('Supabase call timed out', { operation, timeoutMs });
          reject(new TimeoutError(operation, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Default timeouts per call category. Kept small because every blocking
 * Supabase call holds an Express worker.
 */
export const SupabaseTimeouts = {
  read: 5_000,
  write: 8_000,
  rpc: 10_000,
  auth: 5_000,
  cron: 30_000,
} as const;
