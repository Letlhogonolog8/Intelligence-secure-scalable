import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../server/utils/circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 5000,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should execute function successfully when circuit is closed', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const fallback = vi.fn().mockReturnValue('fallback');

    const result = await breaker.execute(mockFn, fallback);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should use fallback when function fails', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
    const fallback = vi.fn().mockReturnValue('fallback');

    const result = await breaker.execute(mockFn, fallback);

    expect(result).toBe('fallback');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('should open circuit after threshold failures', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
    const fallback = vi.fn().mockReturnValue('fallback');

    // Trigger failures to reach threshold
    await breaker.execute(mockFn, fallback);
    await breaker.execute(mockFn, fallback);
    await breaker.execute(mockFn, fallback);

    expect(breaker.getState()).toBe('OPEN');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should use fallback immediately when circuit is open', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
    const fallback = vi.fn().mockReturnValue('fallback');

    // Open the circuit
    await breaker.execute(mockFn, fallback);
    await breaker.execute(mockFn, fallback);
    await breaker.execute(mockFn, fallback);

    mockFn.mockClear();
    fallback.mockClear();

    // Next call should use fallback without calling mockFn
    const result = await breaker.execute(mockFn, fallback);

    expect(result).toBe('fallback');
    expect(mockFn).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('should transition to half-open after reset timeout', async () => {
    vi.useFakeTimers();

    const mockFn = vi.fn().mockRejectedValue(new Error('failure'));
    const fallback = vi.fn().mockReturnValue('fallback');

    // Open the circuit
    await breaker.execute(mockFn, fallback);
    await breaker.execute(mockFn, fallback);
    await breaker.execute(mockFn, fallback);

    expect(breaker.getState()).toBe('OPEN');

    // Advance time past reset timeout
    vi.advanceTimersByTime(1100);

    mockFn.mockResolvedValue('success');

    // Should attempt to execute again
    const result = await breaker.execute(mockFn, fallback);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');

    vi.useRealTimers();
  });

  it('should return correct stats', () => {
    const stats = breaker.getStats();

    expect(stats).toHaveProperty('name', 'test-breaker');
    expect(stats).toHaveProperty('state', 'CLOSED');
    expect(stats).toHaveProperty('failureCount', 0);
    expect(stats).toHaveProperty('lastFailureTime');
    expect(stats).toHaveProperty('nextAttemptTime');
  });
});
