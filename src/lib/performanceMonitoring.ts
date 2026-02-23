/**
 * Performance Monitoring Module
 * src/lib/performanceMonitoring.ts
 * 
 * Real-time performance monitoring, bottleneck detection, and optimization suggestions
 * for enterprise-grade application monitoring.
 */

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, string>;
  error?: boolean;
}

export interface PerformanceStats {
  count: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private readonly maxMetricsPerName = 1000;

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricsArray = this.metrics.get(metric.name)!;
    metricsArray.push(metric);

    // Keep only last N metrics to prevent memory bloat
    if (metricsArray.length > this.maxMetricsPerName) {
      metricsArray.shift();
    }
  }

  /**
   * Measure execution time of a function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        tags,
        error: false,
      });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        tags,
        error: true,
      });
      throw error;
    }
  }

  /**
   * Measure execution time of a synchronous function
   */
  measure<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        tags,
        error: false,
      });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        tags,
        error: true,
      });
      throw error;
    }
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(metricName: string): PerformanceStats | null {
    const metricsArray = this.metrics.get(metricName);
    if (!metricsArray || metricsArray.length === 0) {
      return null;
    }

    const durations = metricsArray.map((m) => m.duration).sort((a, b) => a - b);
    const errorCount = metricsArray.filter((m) => m.error).length;

    return {
      count: metricsArray.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
      errorRate: (errorCount / metricsArray.length) * 100,
    };
  }

  /**
   * Get all metrics statistics
   */
  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {};

    this.metrics.forEach((_, metricName) => {
      const metricStats = this.getStats(metricName);
      if (metricStats) {
        stats[metricName] = metricStats;
      }
    });

    return stats;
  }

  /**
   * Get slow operations (metrics exceeding threshold)
   */
  getSlowOperations(thresholdMs: number = 1000): PerformanceMetric[] {
    const slow: PerformanceMetric[] = [];

    this.metrics.forEach((metricsArray) => {
      metricsArray.forEach((metric) => {
        if (metric.duration > thresholdMs) {
          slow.push(metric);
        }
      });
    });

    return slow.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): PerformanceMetric[] {
    const failed: PerformanceMetric[] = [];

    this.metrics.forEach((metricsArray) => {
      metricsArray.forEach((metric) => {
        if (metric.error) {
          failed.push(metric);
        }
      });
    });

    return failed;
  }

  /**
   * Clear metrics for a specific name
   */
  clearMetrics(metricName?: string): void {
    if (metricName) {
      this.metrics.delete(metricName);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Export metrics as JSON
   */
  export(): Record<string, PerformanceMetric[]> {
    const exported: Record<string, PerformanceMetric[]> = {};
    this.metrics.forEach((metrics, name) => {
      exported[name] = [...metrics];
    });
    return exported;
  }
}

// ============================================================================
// WEB VITALS TRACKING
// ============================================================================

export interface WebVitals {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  fcp?: number; // First Contentful Paint
}

export class WebVitalsTracker {
  private vitals: WebVitals = {};

  /**
   * Initialize Web Vitals tracking
   */
  init(): void {
    if (!window.PerformanceObserver) {
      console.warn("PerformanceObserver not supported");
      return;
    }

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
    } catch (e) {
      console.debug("LCP tracking unavailable");
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.vitals.fid = (entry as PerformanceEntry & { processingDuration?: number }).processingDuration ?? 0;
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
    } catch (e) {
      console.debug("FID tracking unavailable");
    }

    // Cumulative Layout Shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const layoutEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutEntry.hadRecentInput && layoutEntry.value) {
            this.vitals.cls = (this.vitals.cls || 0) + layoutEntry.value;
          }
        });
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });
    } catch (e) {
      console.debug("CLS tracking unavailable");
    }

    // Navigation Timing
    window.addEventListener("load", () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        this.vitals.ttfb = nav.responseStart - nav.fetchStart;
        this.vitals.fcp = nav.domContentLoadedEventEnd - nav.fetchStart;
      }
    });
  }

  /**
   * Get current Web Vitals
   */
  getVitals(): WebVitals {
    return { ...this.vitals };
  }

  /**
   * Check if vitals meet thresholds
   */
  meetsThresholds(): {
    lcp: boolean;
    fid: boolean;
    cls: boolean;
    overall: boolean;
  } {
    return {
      lcp: !this.vitals.lcp || this.vitals.lcp < 2500,
      fid: !this.vitals.fid || this.vitals.fid < 100,
      cls: !this.vitals.cls || this.vitals.cls < 0.1,
      overall:
        (!this.vitals.lcp || this.vitals.lcp < 2500) &&
        (!this.vitals.fid || this.vitals.fid < 100) &&
        (!this.vitals.cls || this.vitals.cls < 0.1),
    };
  }
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

export interface ErrorMetric {
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  fingerprint?: string;
}

export class ErrorTracker {
  private errors: ErrorMetric[] = [];
  private readonly maxErrors = 500;
  private errorGrouping: Map<string, ErrorMetric[]> = new Map();

  /**
   * Record an error
   */
  recordError(
    error: Error | string,
    severity: "low" | "medium" | "high" | "critical" = "high",
    context?: Record<string, unknown>
  ): void {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorStack = error instanceof Error ? error.stack : undefined;
    const fingerprint = this.generateFingerprint(errorMessage);

    const metric: ErrorMetric = {
      message: errorMessage,
      stack: errorStack,
      timestamp: Date.now(),
      context,
      severity,
      fingerprint,
    };

    this.errors.push(metric);

    // Group errors by fingerprint
    if (!this.errorGrouping.has(fingerprint)) {
      this.errorGrouping.set(fingerprint, []);
    }
    this.errorGrouping.get(fingerprint)!.push(metric);

    // Limit stored errors
    if (this.errors.length > this.maxErrors) {
      const removed = this.errors.shift();
      if (removed?.fingerprint) {
        const grouped = this.errorGrouping.get(removed.fingerprint)!;
        grouped.shift();
        if (grouped.length === 0) {
          this.errorGrouping.delete(removed.fingerprint);
        }
      }
    }
  }

  /**
   * Get all recorded errors
   */
  getErrors(): ErrorMetric[] {
    return [...this.errors];
  }

  /**
   * Get error groups with frequency
   */
  getErrorGroups(): Array<{ fingerprint: string; count: number; firstError: ErrorMetric; lastError: ErrorMetric }> {
    const groups: Array<{ fingerprint: string; count: number; firstError: ErrorMetric; lastError: ErrorMetric }> = [];

    this.errorGrouping.forEach((errors, fingerprint) => {
      if (errors.length > 0) {
        groups.push({
          fingerprint,
          count: errors.length,
          firstError: errors[0],
          lastError: errors[errors.length - 1],
        });
      }
    });

    return groups.sort((a, b) => b.count - a.count);
  }

  /**
   * Get critical errors
   */
  getCriticalErrors(): ErrorMetric[] {
    return this.errors.filter((e) => e.severity === "critical");
  }

  /**
   * Clear error history
   */
  clear(): void {
    this.errors = [];
    this.errorGrouping.clear();
  }

  private generateFingerprint(message: string): string {
    // Simple fingerprint generation
    return `${message.split("\n")[0]}`.toLowerCase().substring(0, 100);
  }
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

export const performanceMonitor = new PerformanceMonitor();
export const webVitalsTracker = new WebVitalsTracker();
export const errorTracker = new ErrorTracker();

// Initialize Web Vitals tracking
if (typeof window !== "undefined") {
  webVitalsTracker.init();
}
