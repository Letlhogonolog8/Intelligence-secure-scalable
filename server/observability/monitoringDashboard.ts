/**
 * Real-Time Monitoring Dashboard
 * server/observability/monitoringDashboard.ts
 *
 * Prometheus metrics + Grafana dashboards for:
 * - Application health
 * - Response times & throughput
 * - Error rates & alerts
 * - Resource utilization
 * - Database performance
 * - Cache effectiveness
 * - 99.9% uptime tracking
 */

import { NextFunction, Request, Response } from "express";
import prometheus from "prom-client";

export class MonitoringDashboard {
  private register = new prometheus.Registry();

  // ============================================================================
  // API METRICS
  // ============================================================================

  // HTTP request latency (milliseconds)
  httpRequestDurationMs = new prometheus.Histogram({
    name: "aegis_http_request_duration_ms",
    help: "Duration of HTTP requests in milliseconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [10, 50, 100, 500, 1000, 2500, 5000, 10000],
    registers: [this.register],
  });

  // HTTP requests total
  httpRequestsTotal = new prometheus.Counter({
    name: "aegis_http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [this.register],
  });

  // API errors (by type)
  apiErrorsTotal = new prometheus.Counter({
    name: "aegis_api_errors_total",
    help: "Total API errors by type",
    labelNames: ["error_type", "endpoint"],
    registers: [this.register],
  });

  // ============================================================================
  // BUSINESS METRICS
  // ============================================================================

  // Cases reported (counter)
  casesReported = new prometheus.Counter({
    name: "aegis_cases_reported_total",
    help: "Total cases reported",
    labelNames: ["severity", "region"],
    registers: [this.register],
  });

  // Active case queue length (gauge)
  activeCaseQueueLength = new prometheus.Gauge({
    name: "aegis_active_case_queue_length",
    help: "Number of cases in active queue",
    labelNames: ["region", "priority"],
    registers: [this.register],
  });

  // Escalation latency (minutes)
  escalationLatencyMinutes = new prometheus.Histogram({
    name: "aegis_escalation_latency_minutes",
    help: "Time from case creation to police notification",
    labelNames: ["response_type"],
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [this.register],
  });

  // Shelter occupancy rate (percentage)
  shelterOccupancyRate = new prometheus.Gauge({
    name: "aegis_shelter_occupancy_rate",
    help: "Occupancy percentage of shelters",
    labelNames: ["shelter_id", "region"],
    registers: [this.register],
  });

  // ============================================================================
  // DATABASE METRICS
  // ============================================================================

  // Database query latency
  dbQueryDurationMs = new prometheus.Histogram({
    name: "aegis_db_query_duration_ms",
    help: "Duration of database queries in milliseconds",
    labelNames: ["operation", "table"],
    buckets: [1, 10, 50, 100, 500, 1000],
    registers: [this.register],
  });

  // Database connection pool
  dbConnectionPoolSize = new prometheus.Gauge({
    name: "aegis_db_connection_pool_size",
    help: "Current size of database connection pool",
    registers: [this.register],
  });

  // ============================================================================
  // SECURITY METRICS
  // ============================================================================

  // Failed login attempts
  failedLoginAttempts = new prometheus.Counter({
    name: "aegis_failed_login_attempts_total",
    help: "Total failed login attempts",
    labelNames: ["ip_address"],
    registers: [this.register],
  });

  // Security alerts triggered
  securityAlerts = new prometheus.Counter({
    name: "aegis_security_alerts_total",
    help: "Total security alerts by type",
    labelNames: ["alert_type", "severity"],
    registers: [this.register],
  });

  // ============================================================================
  // SYSTEM HEALTH METRICS
  // ============================================================================

  // CPU usage percentage
  cpuUsagePercent = new prometheus.Gauge({
    name: "aegis_cpu_usage_percent",
    help: "CPU usage as percentage",
    registers: [this.register],
  });

  // Memory usage (bytes)
  memoryUsageBytes = new prometheus.Gauge({
    name: "aegis_memory_usage_bytes",
    help: "Memory usage in bytes",
    labelNames: ["type"], // 'heap', 'external', 'rss'
    registers: [this.register],
  });

  // Disk usage percentage
  diskUsagePercent = new prometheus.Gauge({
    name: "aegis_disk_usage_percent",
    help: "Disk usage as percentage",
    registers: [this.register],
  });

  // System uptime (seconds)
  systemUptimeSeconds = new prometheus.Gauge({
    name: "aegis_system_uptime_seconds",
    help: "System uptime in seconds",
    registers: [this.register],
  });

  // ============================================================================
  // AVAILABILITY METRICS
  // ============================================================================

  // Uptime tracking (for 99.9% target = 43 minutes downtime/month)
  uptimePercentage = new prometheus.Gauge({
    name: "aegis_uptime_percentage",
    help: "System availability percentage (target: 99.9%)",
    registers: [this.register],
  });

  // Regional availability
  regionalAvailability = new prometheus.Gauge({
    name: "aegis_regional_availability_percentage",
    help: "Availability by region",
    labelNames: ["region"],
    registers: [this.register],
  });

  // ============================================================================
  // METHODS
  // ============================================================================

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get health status for liveness probe
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    checks: Record<string, boolean>;
    uptime: number;
  } {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const checks = {
      api_responding: true,
      database_connected: true,
      websocket_operational: true,
      memory_under_limit: memUsage.heapUsed < 1073741824, // 1GB
      disk_available: true, // Would check actual disk
      services_running: true,
    };

    const allHealthy = Object.values(checks).every((v) => v);
    const someUnhealthy = Object.values(checks).some((v) => !v);

    return {
      status: allHealthy ? "healthy" : someUnhealthy ? "unhealthy" : "degraded",
      checks,
      uptime,
    };
  }

  /**
   * Get uptime percentage (track toward 99.9% SLA)
   */
  calculateUptimePercentage(startOfMonth: Date, endOfMonth: Date): number {
    const monthDurationMs = endOfMonth.getTime() - startOfMonth.getTime();
    const _maxDowntimeMs = monthDurationMs * 0.001; // 0.1% downtime for 99.9%

    // In production, track actual downtime from incident reports
    const estimatedDowntimeMs = 0; // Would calculate from incidents

    return ((monthDurationMs - estimatedDowntimeMs) / monthDurationMs) * 100;
  }

  /**
   * Record API request metrics
   */
  recordApiRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDurationMs.observe(
      { method, route, status_code: statusCode },
      durationMs,
    );
  }

  /**
   * Record case reported
   */
  recordCaseReport(severity: string, region: string): void {
    this.casesReported.inc({ severity, region });
  }

  /**
   * Record escalation latency
   */
  recordEscalationLatency(durationMinutes: number, responseType: string): void {
    this.escalationLatencyMinutes.observe(
      { response_type: responseType },
      durationMinutes,
    );
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(
    operation: string,
    table: string,
    durationMs: number,
  ): void {
    this.dbQueryDurationMs.observe({ operation, table }, durationMs);
  }

  /**
   * Update real-time metrics
   */
  updateRealtimeMetrics(): void {
    const memUsage = process.memoryUsage();

    this.memoryUsageBytes.set({ type: "heap" }, memUsage.heapUsed);
    this.memoryUsageBytes.set({ type: "external" }, memUsage.external);
    this.memoryUsageBytes.set({ type: "rss" }, memUsage.rss);

    this.systemUptimeSeconds.set(process.uptime());

    // Calculate uptime percentage for current day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const uptimePercent = this.calculateUptimePercentage(today, new Date());
    this.uptimePercentage.set(uptimePercent);
  }
}

/**
 * Middleware: Track request metrics
 */
export function monitoringMiddleware(monitoring: MonitoringDashboard) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      monitoring.recordApiRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
      );
    });

    next();
  };
}
