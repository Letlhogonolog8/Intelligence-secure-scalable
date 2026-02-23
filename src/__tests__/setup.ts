import '@testing-library/jest-dom';
import { expect, afterEach, vi, beforeAll } from 'vitest';
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
          generateKey: async (algorithm: Record<string, unknown>) => {
            return { privateKey: {}, publicKey: {} };
          },
          deriveKey: async (
            algorithm: Record<string, unknown>,
            baseKey: CryptoKey,
            derivedKeyType: Record<string, unknown>
          ) => {
            return {};
          },
          encrypt: async (algorithm: Record<string, unknown>, key: CryptoKey, data: Uint8Array) => {
            return new ArrayBuffer(0);
          },
          decrypt: async (algorithm: Record<string, unknown>, key: CryptoKey, data: Uint8Array) => {
            return new ArrayBuffer(0);
          },
          importKey: async (
            format: string,
            key: Uint8Array,
            algorithm: Record<string, unknown>
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
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
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
