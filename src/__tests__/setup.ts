import '@testing-library/jest-dom';
import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// ============================================================================
// GLOBAL TEST SETUP
// ============================================================================

beforeAll(() => {
  if (typeof global !== 'undefined' && !global.crypto) {
    Object.defineProperty(global, 'crypto', {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        },
        subtle: {
          generateKey: async (_algorithm: Record<string, unknown>) => {
            return { privateKey: {}, publicKey: {} };
          },
          deriveKey: async (
            _algorithm: Record<string, unknown>,
            _baseKey: CryptoKey,
            _derivedKeyType: Record<string, unknown>
          ) => {
            return {};
          },
          encrypt: async (_algorithm: Record<string, unknown>, _key: CryptoKey, _data: Uint8Array) => {
            return new ArrayBuffer(0);
          },
          decrypt: async (_algorithm: Record<string, unknown>, _key: CryptoKey, _data: Uint8Array) => {
            return new ArrayBuffer(0);
          },
          importKey: async (
            _format: string,
            _key: Uint8Array,
            _algorithm: Record<string, unknown>
          ) => {
            return {};
          },
        },
      },
    });
  }
});

// ============================================================================
// AUTOMATIC CLEANUP AFTER EACH TEST
// ============================================================================

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================================
// MOCK ENVIRONMENT VARIABLES
// ============================================================================

Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:3000/api',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_KEY: 'test-anon-key',
    VITE_DATADOG_VERSION: '1.0.0',
  },
});

// ============================================================================
// MOCK SUPABASE CLIENT
// ============================================================================

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => {
      type MockSupabaseResult = { data: Record<string, unknown> | []; error: null };
      type MockSupabaseBuilder = {
        select: () => MockSupabaseBuilder;
        insert: () => MockSupabaseBuilder;
        update: () => MockSupabaseBuilder;
        delete: () => MockSupabaseBuilder;
        eq: () => MockSupabaseBuilder;
        neq: () => MockSupabaseBuilder;
        in: () => MockSupabaseBuilder;
        limit: () => MockSupabaseBuilder;
        order: () => MockSupabaseBuilder;
        single: () => Promise<MockSupabaseResult>;
        then: (resolve: (val: MockSupabaseResult) => void) => void;
      };

      const builder: MockSupabaseBuilder = {
        select: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        order: vi.fn(() => builder),
        single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        then: (resolve: (val: MockSupabaseResult) => void) => resolve({ data: [], error: null }),
      };
      return builder;
    }),
  })),
}));

// ============================================================================
// MOCK AXIOS
// ============================================================================

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    })),
  },
}));

// ============================================================================
// GLOBAL TEST UTILITIES
// ============================================================================

export const mockSessionStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };
};

export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };
};

// ============================================================================
// SUPPRESS CONSOLE ERRORS IN TESTS (for cleaner output)
// ============================================================================

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Error: connect ECONNREFUSED'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});
