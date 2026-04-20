import { createLogger } from './logger';

const logger = createLogger('circuit-breaker');

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      resetTimeout: config?.resetTimeout || 60000,
      monitoringPeriod: config?.monitoringPeriod || 10000,
    };
  }

  async execute<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        logger.warn(`Circuit breaker ${this.name} is OPEN, using fallback`);
        return fallback();
      }
      this.state = CircuitState.HALF_OPEN;
      logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      logger.warn(`Circuit breaker ${this.name} failure, using fallback`, { error });
      return fallback();
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      logger.info(`Circuit breaker ${this.name} recovered, closing circuit`);
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.lastFailureTime = null;
      this.nextAttemptTime = null;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      logger.error(`Circuit breaker ${this.name} OPENED after ${this.failureCount} failures`);
    }

    if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.config.monitoringPeriod) {
      this.failureCount = 1;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }
}
