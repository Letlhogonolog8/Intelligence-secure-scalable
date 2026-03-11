import { Request, Response } from 'express';
import client from 'prom-client';

client.collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['query', 'status'],
  buckets: [0.1, 5, 15, 50, 100, 500, 1000],
});

export const dbQueriesTotal = new client.Counter({
  name: 'db_queries_total',
  help: 'Total database queries',
  labelNames: ['query', 'status'],
});

export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'],
});

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type'],
});

export const ussdSessions = new client.Gauge({
  name: 'ussd_sessions_active',
  help: 'Active USSD sessions',
  labelNames: ['provider'],
});

export const escalations = new client.Counter({
  name: 'escalations_total',
  help: 'Total escalations',
  labelNames: ['severity', 'category'],
});

export const mfaAttempts = new client.Counter({
  name: 'mfa_attempts_total',
  help: 'Total MFA attempts',
  labelNames: ['status', 'method'],
});

export const authenticationFailures = new client.Counter({
  name: 'authentication_failures_total',
  help: 'Total authentication failures',
  labelNames: ['reason'],
});

export const encryptionErrors = new client.Counter({
  name: 'encryption_errors_total',
  help: 'Total encryption errors',
  labelNames: ['operation', 'reason'],
});

export const auditLogEntries = new client.Counter({
  name: 'audit_log_entries_total',
  help: 'Total audit log entries',
  labelNames: ['action', 'module', 'status'],
});

export const rateLimitExceeded = new client.Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit exceeded events',
  labelNames: ['endpoint', 'limiter_type'],
});

export const sessionDuration = new client.Histogram({
  name: 'session_duration_ms',
  help: 'Session duration in ms',
  labelNames: ['session_type'],
  buckets: [1000, 5000, 15000, 30000, 60000, 300000, 900000],
});

export const activeSessions = new client.Gauge({
  name: 'active_sessions_total',
  help: 'Total active sessions',
  labelNames: ['session_type'],
});

export const webhookProcessingTime = new client.Histogram({
  name: 'webhook_processing_time_ms',
  help: 'Webhook processing time in ms',
  labelNames: ['provider', 'status'],
  buckets: [10, 50, 100, 500, 1000],
});

export const webhookFailures = new client.Counter({
  name: 'webhook_failures_total',
  help: 'Total webhook failures',
  labelNames: ['provider', 'reason'],
});

export const dataValidationErrors = new client.Counter({
  name: 'data_validation_errors_total',
  help: 'Total data validation errors',
  labelNames: ['schema', 'field'],
});

export const taskQueueSize = new client.Gauge({
  name: 'task_queue_size',
  help: 'Current size of task queue',
  labelNames: ['queue_name'],
});

export const taskProcessingTime = new client.Histogram({
  name: 'task_processing_time_ms',
  help: 'Time to process a task',
  labelNames: ['queue_name', 'status'],
  buckets: [100, 500, 1000, 5000, 10000],
});

export const metricsHandler = async (_req: Request, res: Response) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
};
