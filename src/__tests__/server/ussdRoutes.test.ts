import { describe, expect, it, vi } from 'vitest';
import { isTrustedUssdRequestOrigin, isUssdServiceCodeAllowed, normalizeUssdServiceCode, sendAfricasTalkingResponse, sendArkeselResponse } from '../../../server/routes/ussdRoutes';

describe('ussd route service code validation', () => {
  it('normalizes service codes before comparison', () => {
    expect(normalizeUssdServiceCode(' *384*30933# ')).toBe('*384*30933#');
  });

  it('normalizes quoted and percent-encoded service codes', () => {
    expect(normalizeUssdServiceCode('"*384*30933%23"')).toBe('*384*30933#');
  });

  it('allows requests when no expected service code is configured', () => {
    expect(isUssdServiceCodeAllowed('*384*30933#', '')).toBe(true);
  });

  it('allows a matching service code', () => {
    expect(isUssdServiceCodeAllowed('*384*30933#', '*384*30933#', true)).toBe(true);
  });

  it('allows a matching service code from a comma-separated allow list', () => {
    expect(isUssdServiceCodeAllowed('*721#', '*384*30933#,*721#', true)).toBe(true);
  });

  it('allows the current configured service code from an encoded request payload', () => {
    expect(isUssdServiceCodeAllowed('"*384*30933%23"', '*384*30933#,*721#', true)).toBe(true);
  });

  it('treats service codes with and without a trailing hash as equivalent', () => {
    expect(isUssdServiceCodeAllowed('*384*30933', '*384*30933#,*721#', true)).toBe(true);
  });

  it('rejects a mismatched service code', () => {
    expect(isUssdServiceCodeAllowed('*384*00000#', '*384*30933#', true)).toBe(false);
  });

  it('rejects a service code that is not present in the allow list', () => {
    expect(isUssdServiceCodeAllowed('*123#', '*384*30933#,*721#', true)).toBe(false);
  });

  it('rejects a missing service code when one is required', () => {
    expect(isUssdServiceCodeAllowed(undefined, '*384*30933#', true)).toBe(false);
  });

  it('allows a missing service code when one is not required', () => {
    expect(isUssdServiceCodeAllowed(undefined, '*384*30933#', false)).toBe(true);
  });

  it('allows a missing service code for development-style simulator requests', () => {
    expect(isUssdServiceCodeAllowed(undefined, '*384*30933#,*721#', false)).toBe(true);
  });
});

describe('ussd request origin validation', () => {
  it('allows server-to-server requests without browser headers', () => {
    expect(isTrustedUssdRequestOrigin({ headers: {} } as never, 'https://app.example.com')).toBe(true);
  });

  it('allows requests from trusted origins', () => {
    expect(
      isTrustedUssdRequestOrigin(
        {
          headers: {
            origin: 'https://app.example.com',
            'sec-fetch-site': 'same-origin',
          },
        } as never,
        'https://app.example.com,https://admin.example.com'
      )
    ).toBe(true);
  });

  it('allows requests whose referer matches a trusted origin', () => {
    expect(
      isTrustedUssdRequestOrigin(
        {
          headers: {
            referer: 'https://admin.example.com/dashboard',
          },
        } as never,
        'https://app.example.com,https://admin.example.com'
      )
    ).toBe(true);
  });

  it('rejects explicit cross-site browser requests', () => {
    expect(
      isTrustedUssdRequestOrigin(
        {
          headers: {
            origin: 'https://evil.example.com',
            'sec-fetch-site': 'cross-site',
          },
        } as never,
        'https://app.example.com'
      )
    ).toBe(false);
  });

  it('rejects requests from untrusted origins even without sec-fetch-site', () => {
    expect(
      isTrustedUssdRequestOrigin(
        {
          headers: {
            origin: 'https://evil.example.com',
          },
        } as never,
        'https://app.example.com'
      )
    ).toBe(false);
  });
});

describe('sendAfricasTalkingResponse', () => {
  it('sends plain text for form-encoded aggregator requests', () => {
    const res = {
      set: vi.fn(),
      send: vi.fn(),
      json: vi.fn(),
    } as unknown as Parameters<typeof sendAfricasTalkingResponse>[0];

    sendAfricasTalkingResponse(res, 'CON Hello', false);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith('CON Hello');
    expect(res.json).not.toHaveBeenCalled();
  });

  it('sends plain text for JSON-based simulator requests to avoid escaped menu strings', () => {
    const res = {
      set: vi.fn(),
      send: vi.fn(),
      json: vi.fn(),
    } as unknown as Parameters<typeof sendAfricasTalkingResponse>[0];

    sendAfricasTalkingResponse(res, 'CON Hello\n1. Option', true);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith('CON Hello\n1. Option');
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('sendArkeselResponse', () => {
  it('sends the Arkesel simulator response shape', () => {
    const res = {
      json: vi.fn(),
    } as unknown as Parameters<typeof sendArkeselResponse>[0];

    sendArkeselResponse(res, 'Hello', true);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Hello',
      continueSession: true,
    });
  });
});
