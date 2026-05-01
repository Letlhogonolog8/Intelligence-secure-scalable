import { describe, expect, it } from 'vitest';
import { TimeoutError, withTimeout } from '../../../server/utils/supabaseTimeout';

describe('withTimeout', () => {
  it('resolves with the underlying promise when it finishes in time', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 100, 'test.fast');
    expect(result).toBe('ok');
  });

  it('rejects with a TimeoutError when the underlying promise hangs', async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 200);
    });
    await expect(withTimeout(slow, 50, 'test.slow')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propagates underlying rejection unchanged', async () => {
    const fail = Promise.reject(new Error('database down'));
    await expect(withTimeout(fail, 100, 'test.fail')).rejects.toThrow('database down');
  });

  it('does not leak timers when the promise wins the race', async () => {
    // We can only assert behaviourally: no unhandled rejection warnings.
    const value = await withTimeout(Promise.resolve(42), 50, 'test.cleanup');
    expect(value).toBe(42);
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
});
