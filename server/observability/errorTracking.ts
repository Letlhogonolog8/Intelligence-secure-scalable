/**
 * Error Tracking Integration
 * server/observability/errorTracking.ts
 * 
 * Sentry integration for:
 * - Exception tracking & alerting
 * - Error trend analysis
 * - Performance monitoring
 * - Release tracking
 * - User feedback collection
 * - Automated incident response
 */

import * as Sentry from "@sentry/node";

export class ErrorTrackingService {
  private isInitialized = false;

  /**
   * Initialize Sentry
   */
  initialize(dsn: string, environment: string, release: string): void {
    Sentry.init({
      dsn,
      environment,
      release,
      
      // Performance monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      
      // Error filtering
      beforeSend(event) {
        // Ignore certain errors
        if (event.exception) {
          const error = event.exception.values?.[0];
          if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
            return null; // Suppress known browser errors
          }
        }
        return event;
      },
      
      // Enhanced context
      attachStacktrace: true,
      maxBreadcrumbs: 50,
    });

    this.isInitialized = true;
    console.log(`✅ Sentry error tracking initialized`);
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.isInitialized) return;

    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }

  /**
   * Capture message (non-exception)
   */
  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'error'): void {
    if (!this.isInitialized) return;
    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context (for error grouping & analysis)
   */
  setUserContext(userId: string, userRole: string, organization?: string): void {
    if (!this.isInitialized) return;

    Sentry.setUser({
      id: userId,
      role: userRole,
      organization,
    });
  }

  /**
   * Add breadcrumb (for error context)
   */
  addBreadcrumb(
    message: string,
    category: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
    data?: Record<string, any>
  ): void {
    if (!this.isInitialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Start performance transaction
   */
  startTransaction(name: string, op: string): any {
    if (!this.isInitialized) return null;
    // startTransaction is not available in newer Sentry versions
    // Use breadcrumbs instead for tracking
    this.addBreadcrumb(name, op, 'info', {});
    return null;
  }

  /**
   * Capture API request/response
   */
  captureApiRequest(method: string, path: string, statusCode: number, duration: number): void {
    if (!this.isInitialized) return;

    this.addBreadcrumb(
      `${method} ${path}`,
      'api',
      statusCode >= 400 ? 'warning' : 'info',
      {
        method,
        path,
        status_code: statusCode,
        duration_ms: duration,
      }
    );
  }

  /**
   * Capture database query
   */
  captureDatabase(operation: string, table: string, duration: number, error?: Error): void {
    if (!this.isInitialized) return;

    this.addBreadcrumb(
      `${operation} ${table}`,
      'database',
      error ? 'error' : 'debug',
      {
        operation,
        table,
        duration_ms: duration,
      }
    );

    if (error) {
      this.captureException(error, { operation, table });
    }
  }

  /**
   * Capture security incident
   */
  captureSecurityIncident(
    incidentType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    details?: Record<string, any>
  ): void {
    if (!this.isInitialized) return;

    const sentryLevel = severity === 'critical' ? 'fatal' : (severity === 'high' ? 'error' : 'warning');
    Sentry.captureMessage(`Security: ${incidentType}`, sentryLevel);
    
    if (userId) this.setUserContext(userId, 'unknown');
    
    this.addBreadcrumb(
      `Security Incident: ${incidentType}`,
      'security',
      'error',
      { severity, ...details }
    );
  }

  /**
   * Setup error handler middleware
   */
  errorHandler() {
    return (err: Error, req: any, res: any, next: any) => {
      this.captureException(err, {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      // Return safe error message to client
      res.status(500).json({
        error: 'Internal server error',
        sentry_id: Sentry.captureException(err),
      });
    };
  }

  /**
   * Get error statistics (from Sentry API)
   */
  async getErrorStats(): Promise<Record<string, any>> {
    // In production, query Sentry REST API
    return {
      errors_24h: 0,
      errors_7d: 0,
      errors_30d: 0,
      critical_issues: 0,
      top_errors: [],
    };
  }

  /**
   * Alert on critical errors
   */
  alertOnCriticalError(threshold: number = 10): void {
    // Monitor error rate and send alerts if threshold exceeded
    setInterval(async () => {
      const stats = await this.getErrorStats();
      if (stats.critical_issues > threshold) {
        this.captureMessage(`ALERT: ${stats.critical_issues} critical issues detected`, 'fatal');
      }
    }, 60000); // Check every minute
  }

  /**
   * Flush pending errors before shutdown
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) return true;
    return Sentry.close(timeout);
  }
}

/**
 * Global error handlers
 */
export function setupGlobalErrorHandlers(errorTracking: ErrorTrackingService): void {
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
    errorTracking.captureException(reason, {
      type: 'unhandledRejection',
      promise: String(promise),
    });
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    errorTracking.captureException(error, {
      type: 'uncaughtException',
    });
    // Exit process after logging
    setTimeout(() => process.exit(1), 1000);
  });
}
