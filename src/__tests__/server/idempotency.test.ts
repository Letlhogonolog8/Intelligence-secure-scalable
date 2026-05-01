import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../../server/utils/cacheManager', () => {
  const store = new Map<string, unknown>();
  return {
    cacheManager: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
        return true;
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return true;
      }),
      __reset: () => store.clear(),
      __store: store,
    },
  };
});

import { idempotency } from '../../../server/middleware/idempotency';
import { cacheManager } from '../../../server/utils/cacheManager';

type ReqShape = Partial<Request> & { user?: { id: string }; id?: string };

const buildReq = (overrides: Partial<ReqShape> = {}): Request => {
  const headers: Record<string, string> = (overrides.headers as Record<string, string>) || {};
  return {
    header: (name: string) => headers[name.toLowerCase()] || headers[name],
    user: { id: 'user-1' },
    id: 'req-abc',
    ...overrides,
    headers,
  } as unknown as Request;
};

const buildRes = () => {
  const res: {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    listeners: Map<string, Array<() => void>>;
    status: (code: number) => typeof res;
    json: (body: unknown) => typeof res;
    setHeader: (name: string, value: string) => void;
    getHeader: (name: string) => string | undefined;
    on: (event: string, fn: () => void) => void;
  } = {
    statusCode: 200,
    body: undefined,
    headers: {},
    listeners: new Map(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
    on(event: string, fn: () => void) {
      const list = this.listeners.get(event) || [];
      list.push(fn);
      this.listeners.set(event, list);
    },
  };
  return res;
};

describe('idempotency middleware', () => {
  beforeEach(() => {
    (cacheManager as unknown as { __reset: () => void }).__reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through when no Idempotency-Key header is present', async () => {
    const next = vi.fn();
    const req = buildReq();
    const res = buildRes();
    await idempotency({ scope: 'test' })(req, res as unknown as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when key is required but missing', async () => {
    const next = vi.fn();
    const req = buildReq();
    const res = buildRes();
    await idempotency({ scope: 'test', requireKey: true })(
      req,
      res as unknown as Response,
      next as unknown as NextFunction
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('rejects malformed keys with 400', async () => {
    const next = vi.fn();
    const req = buildReq({ headers: { 'idempotency-key': '!!bad!!' } });
    const res = buildRes();
    await idempotency({ scope: 'test' })(req, res as unknown as Response, next as unknown as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('replays cached response on second call with same key', async () => {
    const middleware = idempotency({ scope: 'escalate' });

    const req1 = buildReq({ headers: { 'idempotency-key': 'abcd1234EFGH' } });
    const res1 = buildRes();
    const next1 = vi.fn(() => {
      res1.status(201).json({ ok: true, escalationId: 'esc-1' });
    });

    await middleware(req1, res1 as unknown as Response, next1 as unknown as NextFunction);
    expect(next1).toHaveBeenCalledOnce();
    expect(res1.statusCode).toBe(201);

    const req2 = buildReq({ headers: { 'idempotency-key': 'abcd1234EFGH' } });
    const res2 = buildRes();
    const next2 = vi.fn();

    await middleware(req2, res2 as unknown as Response, next2 as unknown as NextFunction);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(201);
    expect(res2.body).toEqual({ ok: true, escalationId: 'esc-1' });
    expect(res2.headers['idempotent-replay']).toBe('true');
  });

  it('returns 409 while an in-flight request holds the slot', async () => {
    const middleware = idempotency({ scope: 'escalate' });
    const headers = { 'idempotency-key': 'pending00000000' };

    const req1 = buildReq({ headers });
    const res1 = buildRes();
    const next1 = vi.fn();
    await middleware(req1, res1 as unknown as Response, next1 as unknown as NextFunction);
    expect(next1).toHaveBeenCalledOnce();
    // res1 hasn't called res.json yet -> slot is "pending"

    const req2 = buildReq({ headers });
    const res2 = buildRes();
    const next2 = vi.fn();
    await middleware(req2, res2 as unknown as Response, next2 as unknown as NextFunction);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(409);
  });

  it('does not cache 5xx responses (allows retry)', async () => {
    const middleware = idempotency({ scope: 'escalate' });
    const headers = { 'idempotency-key': 'serverErr00000' };

    const req1 = buildReq({ headers });
    const res1 = buildRes();
    const next1 = vi.fn(() => {
      res1.status(500).json({ error: 'boom' });
    });
    await middleware(req1, res1 as unknown as Response, next1 as unknown as NextFunction);

    const req2 = buildReq({ headers });
    const res2 = buildRes();
    const next2 = vi.fn(() => {
      res2.status(200).json({ ok: true });
    });
    await middleware(req2, res2 as unknown as Response, next2 as unknown as NextFunction);

    // Second call should run the handler again, not replay the 500.
    expect(next2).toHaveBeenCalledOnce();
    expect(res2.statusCode).toBe(200);
  });

  it('isolates by user id', async () => {
    const middleware = idempotency({ scope: 'escalate' });
    const key = 'sharedkey1234567';

    const req1 = buildReq({
      headers: { 'idempotency-key': key },
      user: { id: 'user-A' },
    });
    const res1 = buildRes();
    const next1 = vi.fn(() => {
      res1.status(200).json({ ok: 'A' });
    });
    await middleware(req1, res1 as unknown as Response, next1 as unknown as NextFunction);

    const req2 = buildReq({
      headers: { 'idempotency-key': key },
      user: { id: 'user-B' },
    });
    const res2 = buildRes();
    const next2 = vi.fn(() => {
      res2.status(200).json({ ok: 'B' });
    });
    await middleware(req2, res2 as unknown as Response, next2 as unknown as NextFunction);

    expect(next2).toHaveBeenCalledOnce();
    expect(res2.body).toEqual({ ok: 'B' });
  });
});
