import { createLogger } from './logger';
import { EventEmitter } from 'events';

const logger = createLogger('request-queue');

interface QueuedRequest {
  id: string;
  priority: number;
  timestamp: Date;
  execute: () => Promise<unknown>;
  retries: number;
  maxRetries: number;
  timeout: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface QueueConfig {
  maxSize?: number;
  maxConcurrent?: number;
  defaultTimeout?: number;
  defaultMaxRetries?: number;
  processingDelay?: number;
}

interface QueueStats {
  size: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  maxSize: number;
  maxConcurrent: number;
}

/**
 * Request Queue Manager for Traffic Spike Handling
 * Implements priority queue with concurrency control
 */
export class RequestQueueManager extends EventEmitter {
  private queue: QueuedRequest[] = [];
  private processing = 0;
  private completed = 0;
  private failed = 0;
  private totalProcessingTime = 0;
  private config: Required<QueueConfig>;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: QueueConfig = {}) {
    super();
    this.config = {
      maxSize: config.maxSize || 10000,
      maxConcurrent: config.maxConcurrent || 100,
      defaultTimeout: config.defaultTimeout || 30000,
      defaultMaxRetries: config.defaultMaxRetries || 3,
      processingDelay: config.processingDelay || 10,
    };
  }

  /**
   * Add request to queue
   */
  async enqueue<T, R>(
    data: T,
    processor: (data: T) => Promise<R>,
    options: {
      priority?: number;
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<R> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    return new Promise<R>((resolve, reject) => {
      const request: QueuedRequest = {
        id: this.generateId(),
        priority: options.priority || 0,
        timestamp: new Date(),
        execute: () => processor(data) as Promise<unknown>,
        retries: 0,
        maxRetries: options.maxRetries || this.config.defaultMaxRetries,
        timeout: options.timeout || this.config.defaultTimeout,
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < request.priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.emit('enqueued', { id: request.id, priority: request.priority });
      this.processQueue();
    });
  }

  /**
   * Process queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      while (this.processing < this.config.maxConcurrent && this.queue.length > 0) {
        const request = this.queue.shift();
        if (!request) break;

        this.processing++;
        this.processRequest(request).finally(() => {
          this.processing--;
        });
      }

      // Stop interval if queue is empty and nothing is processing
      if (this.queue.length === 0 && this.processing === 0 && this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
    }, this.config.processingDelay);
  }

  /**
   * Process individual request
   */
  private async processRequest(
    request: QueuedRequest
  ): Promise<void> {
    const start = Date.now();
    const timeoutId = setTimeout(() => {
      request.reject(new Error('Request timeout'));
      this.failed++;
      this.emit('timeout', { id: request.id });
    }, request.timeout);

    try {
      const result = await request.execute();
      clearTimeout(timeoutId);
      
      const duration = Date.now() - start;
      this.totalProcessingTime += duration;
      this.completed++;
      
      request.resolve(result);
      this.emit('completed', { id: request.id, duration });
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Retry logic
      if (request.retries < request.maxRetries) {
        request.retries++;
        this.queue.unshift(request); // Add back to front of queue
        this.emit('retry', { id: request.id, retries: request.retries });
      } else {
        this.failed++;
        request.reject(error as Error);
        this.emit('failed', { id: request.id, error: (error as Error).message });
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      size: this.queue.length,
      processing: this.processing,
      completed: this.completed,
      failed: this.failed,
      avgProcessingTime: this.completed > 0
        ? Math.round(this.totalProcessingTime / this.completed)
        : 0,
      maxSize: this.config.maxSize,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.completed = 0;
    this.failed = 0;
    this.totalProcessingTime = 0;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.emit('cleared');
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.processing === 0;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.config.maxSize;
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown queue manager
   */
  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.clear();
    this.removeAllListeners();
    logger.info('Request queue manager shutdown');
  }
}

// Singleton instance
export const requestQueue = new RequestQueueManager({
  maxSize: 10000,
  maxConcurrent: 100,
  defaultTimeout: 30000,
});
