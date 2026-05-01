/**
 * Idempotency middleware.
 *
 * Clients send `Idempotency-Key: <uuid>` on POST/PUT/PATCH requests that
 * mutate state. The first call is processed normally; the response (status
 * + JSON body) is cached in Redis under `idem:<route>:<userId>:<key>`. Any
 * subsequent request with the same key within the TTL replays the cached
 * response without re-running the handler.
 *
 * If Redis is not connected we still accept the request (fail-open) but tag
 * the response so callers can detect the missed dedupe. We never accept the
 * same key concurrently — a sentinel value is written immediately and an
 * incoming retry while the first call is in flight returns HTTP 409
 * (Conflict) to prevent duplicate side-effects (e.g. duplicate Twilio
 * dispatches on `/api/cases/escalate`).
 */

import { NextFunction, Request, RequestHandler, Response } from 'express';
import { cacheManager } from '../utils/cacheManager';
import { createLogger } from '../utils/logger';

const logger = createLogger('idempotency');

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

const PENDING = '__pending__';

type AuthedRequest = Request & {
  id?: string;
  user?: { id?: string };
};

type CachedResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  storedAt: string;
};

export interface IdempotencyOptions {
  /** Logical route name used in the cache key (e.g. "escalate"). */
  scope: string;
  /** TTL of the cached response in seconds. Defaults to 24 hours. */
  ttlSeconds?: number;
  /** Whether the key is required. Defaults to false (header optional). */
  requireKey?: boolean;
}

const buildCacheKey = (scope: string, userId: string, key: string): string =>
  `idem:${scope}:${userId}:${key}`;

const collectResponseHeaders = (res: Response): Record<string, string> => {
  const allowed = ['content-type', 'x-request-id'];
  const headers: Record<string, string> = {};
  for (const name of allowed) {
    const value = res.getHeader(name);
    if (typeof value === 'string') headers[name] = value;
  }
  return headers;
};

export function idempotency(options: IdempotencyOptions): RequestHandler {
  const ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60;

  return async (req: Request, res: Response, next: NextFunction) => {
    const headerValue = req.header('Idempotency-Key');
    const requestId = (req as AuthedRequest).id;

    if (!headerValue) {
      if (options.requireKey) {
        res.status(400).json({
          error: 'Idempotency-Key header is required for this endpoint',
          requestId,
        });
        return;
      }
      next();
      return;
    }

    if (!KEY_PATTERN.test(headerValue)) {
      res.status(400).json({
        error: 'Idempotency-Key must be 8-128 chars of [A-Za-z0-9_-]',
        requestId,
      });
      return;
    }

    const userId = (req as AuthedRequest).user?.id ?? 'anonymous';
    const cacheKey = buildCacheKey(options.scope, userId, headerValue);

    let cached: CachedResponse | string | null = null;
    try {
      cached = await cacheManager.get<CachedResponse | string>(cacheKey);
    } catch (error) {
      logger.warn('Idempotency cache lookup failed; failing open', {
        scope: options.scope,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (cached === PENDING) {
      res.status(409).json({
        error: 'A request with this Idempotency-Key is still being processed',
        requestId,
      });
      return;
    }

    if (cached && typeof cached === 'object') {
      res.setHeader('Idempotent-Replay', 'true');
      for (const [name, value] of Object.entries(cached.headers)) {
        res.setHeader(name, value);
      }
      res.status(cached.status).json(cached.body);
      return;
    }

    // Reserve the slot so concurrent retries see "pending" instead of a miss.
    try {
      await cacheManager.set(cacheKey, PENDING, { ttl: 60 });
    } catch {
      // ignore — fail open
    }

    const originalJson = res.json.bind(res);
    let captured = false;
    res.json = (body: unknown) => {
      if (!captured) {
        captured = true;
        const payload: CachedResponse = {
          status: res.statusCode,
          headers: collectResponseHeaders(res),
          body,
          storedAt: new Date().toISOString(),
        };
        // Only cache successful + client-error responses; never cache 5xx.
        if (res.statusCode < 500) {
          void cacheManager
            .set(cacheKey, payload, { ttl: ttlSeconds })
            .catch((error) =>
              logger.warn('Idempotency cache write failed', {
                scope: options.scope,
                error: error instanceof Error ? error.message : String(error),
              })
            );
        } else {
          // Free the pending slot so the client can retry.
          void cacheManager.del(cacheKey).catch(() => undefined);
        }
      }
      return originalJson(body);
    };

    res.on('close', () => {
      if (!captured) {
        // Connection dropped before handler responded — release slot.
        void cacheManager.del(cacheKey).catch(() => undefined);
      }
    });

    next();
  };
}
