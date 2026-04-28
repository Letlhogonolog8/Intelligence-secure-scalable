import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';

import { WebSocketManager } from './websocket';
import { EventBus } from './events/eventEmitter';
import { EncryptionService } from './security/encryption';
import { MFAService } from './security/mfa';
import { AuditLogService } from './security/auditLog';
import { USSDGateway } from './ussd/ussdGateway';
import { OfflineCache } from './ussd/offlineCache';
import createUSSDRoutes from './routes/ussdRoutes';
import { createEscalationRoutes } from './routes/escalationRoutes';
import { createIntelligenceRoutes } from './routes/intelligenceRoutes';
import { validationMiddleware } from './middleware/validation';
import whatsappRoutes from './routes/whatsappRoutes';
import { createLogger } from './utils/logger';
import { metricsHandler, httpRequestDuration, httpRequestsTotal } from './utils/prometheus';
import { EscalationWorkflow } from './workflows/escalationWorkflow';
import { TwilioNotificationService } from './notifications/twilio';
import { RiskScoringEngine } from './intelligence/riskScoring';
import { GeoMatchingEngine } from './intelligence/geoMatching';
import { dbPool } from './utils/dbPoolOptimized';
import { cacheManager } from './utils/cacheManager';
import { loadBalancer } from './utils/loadBalancer';
import { 
  defaultLimiter, 
  escalationLimiter, 
  mfaLimiter,
  closeRedisClient,
  getRateLimitStoreStatus,
  initializeRateLimiting,
  getRedisClient
} from './middleware/rateLimiting';
import { ErrorTrackingService, setupGlobalErrorHandlers } from './observability/errorTracking';
import { closeDatadog, initializeDatadog, trackTiming } from './utils/datadog';
import { ADMIN_DASHBOARD_CONFIG } from './config/adminDashboardConfig';
import { IntrusionDetectionSystem } from './security/intrusionDetection';

dotenv.config();
const rateLimitingInitialization = initializeRateLimiting();

const logger = createLogger('aegis-api');
const errorTracking = new ErrorTrackingService();

async function initializeServices() {
  await cacheManager.initialize();
  dbPool.initialize();
  
  // Initialize load balancer if multiple instances configured
  const instanceUrls = process.env.INSTANCE_URLS?.split(',').filter(Boolean) || [];
  if (instanceUrls.length > 0) {
    instanceUrls.forEach((url, idx) => {
      loadBalancer.addServer(`instance-${idx}`, url.trim());
    });
    loadBalancer.startHealthChecks();
    logger.info('Load balancer initialized', { instances: instanceUrls.length });
  }
  
  logger.info('Cache and database pool initialized');
}

if (process.env.SENTRY_DSN) {
  errorTracking.initialize(
    process.env.SENTRY_DSN,
    process.env.NODE_ENV || 'development',
    process.env.npm_package_version || '0.0.0'
  );
  setupGlobalErrorHandlers(errorTracking);
}

initializeDatadog();

function validateEnvironment(): void {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_KEY',
    'CHAT_ENCRYPTION_KEY',
    'NODE_ENV',
    'PORT',
    'CORS_ORIGIN',
  ];

  const productionOnlyVars = [
    'TELKOM_WEBHOOK_SECRET',
  ];

  const missing: string[] = [];

  requiredVars.forEach(v => {
    if (!process.env[v]) {
      missing.push(v);
    }
  });

  if (process.env.NODE_ENV === 'production') {
    productionOnlyVars.forEach(v => {
      if (!process.env[v]) {
        missing.push(v);
      }
    });
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables', new Error(missing.join(', ')), {
      missing,
    });
    process.exit(1);
  }

  logger.info('All required environment variables present');
}

validateEnvironment();

const app: Express = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:8080').split(',').map(o => o.trim());

type AuthenticatedUser = {
  id: string;
  role?: string;
  organizationId?: string;
};

type AppRequest = Request & {
  id?: string;
  user?: AuthenticatedUser;
};

let supabase: SupabaseClient;
let wsManager: WebSocketManager;
let eventBus: EventBus;
let _encryptionService: EncryptionService;
let mfaService: MFAService;
let auditLogService: AuditLogService;
let ussdGateway: USSDGateway;
let offlineCache: OfflineCache;
let escalationWorkflow: EscalationWorkflow;
let twilioNotificationService: TwilioNotificationService;
let ids: IntrusionDetectionSystem;
let notificationWorkerInterval: ReturnType<typeof setInterval> | null = null;
let notificationWorkerInFlight = false;

try {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  wsManager = new WebSocketManager(httpServer, supabase);
  eventBus = new EventBus(supabase);
  
  try {
    _encryptionService = new EncryptionService(supabase);
    logger.info('Encryption service initialized');
  } catch (encryptionError) {
    logger.error('CRITICAL: Encryption service failed', encryptionError);
    if (process.env.NODE_ENV === 'production') {
      logger.error('Cannot start without proper encryption in production', encryptionError);
      process.exit(1);
    }
    throw encryptionError;
  }
  
  mfaService = new MFAService(supabase);
  auditLogService = new AuditLogService(supabase);
  ussdGateway = new USSDGateway(supabase);
  offlineCache = new OfflineCache();
  ids = new IntrusionDetectionSystem(supabase);

  const riskScoringEngine = new RiskScoringEngine(supabase);
  const geoMatchingEngine = new GeoMatchingEngine(supabase);
  twilioNotificationService = new TwilioNotificationService(supabase);
  escalationWorkflow = new EscalationWorkflow(
    supabase,
    riskScoringEngine,
    geoMatchingEngine,
    twilioNotificationService,
    auditLogService,
    eventBus
  );

  logger.info('All services initialized successfully');
} catch (error) {
  logger.error('Service initialization failed', error);
  process.exit(1);
}

function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function isNotificationWorkerEnabled(): boolean {
  return process.env.NOTIFICATION_WORKER_ENABLED !== 'false';
}

function resolveTelkomCallbackUrl(): string {
  const explicitCallback = process.env.TELKOM_CALLBACK_URL?.trim();
  if (explicitCallback) {
    return explicitCallback;
  }

  const publicBackendUrl = process.env.BACKEND_PUBLIC_URL?.trim() || process.env.APP_BASE_URL?.trim();
  if (!publicBackendUrl) {
    return '';
  }

  return `${publicBackendUrl.replace(/\/+$/, '')}/api/ussd/telkom/callback`;
}

function isTelkomConfigured(): boolean {
  return Boolean(
    process.env.TELKOM_API_KEY &&
    process.env.TELKOM_API_URL &&
    process.env.TELKOM_USSD_CODE &&
    resolveTelkomCallbackUrl()
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function isMissingNotificationQueueError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';

  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('notification_queue')
      && (message.includes('Could not find the table') || message.includes('does not exist')));
}

async function ensureNotificationQueueAvailable(): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      (async () => await supabase.from('notification_queue').select('id').limit(1))(),
      5000,
      'Notification queue availability check timed out'
    );

    if (error) {
      throw error;
    }

    if (!twilioNotificationService.isQueueAvailable()) {
      twilioNotificationService.setQueueAvailable(true);
      logger.info('Notification queue restored');
    }

    return true;
  } catch (error) {
    if (isMissingNotificationQueueError(error)) {
      return false;
    }

    throw error;
  }
}

async function runNotificationWorkerCycle(): Promise<void> {
  if (notificationWorkerInFlight) {
    return;
  }

  notificationWorkerInFlight = true;

  try {
    const queueAvailable = twilioNotificationService.isQueueAvailable() || await ensureNotificationQueueAvailable();

    if (!queueAvailable) {
      return;
    }

    const processed = await twilioNotificationService.processPendingNotifications(25);

    if (processed > 0) {
      logger.info('Notification queue processed', { processed });
    }
  } catch (error) {
    logger.error('Notification worker cycle failed', error);
  } finally {
    notificationWorkerInFlight = false;
  }
}

function startNotificationWorker(): void {
  if (!isNotificationWorkerEnabled()) {
    logger.info('In-process notification worker disabled by configuration');
    return;
  }

  if (notificationWorkerInterval) {
    return;
  }

  const intervalMs = Math.max(5000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 15000));
  notificationWorkerInterval = setInterval(() => {
    void runNotificationWorkerCycle();
  }, intervalMs);
  notificationWorkerInterval.unref?.();
  void runNotificationWorkerCycle();

  logger.info('Notification worker started', { intervalMs });
}

async function stopNotificationWorker(): Promise<void> {
  if (notificationWorkerInterval) {
    clearInterval(notificationWorkerInterval);
    notificationWorkerInterval = null;
  }

  while (notificationWorkerInFlight) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function getReadinessStatus(): Promise<{
  ready: boolean;
  services: Record<string, unknown>;
}> {
  const services: Record<string, unknown> = {};
  let ready = true;

  try {
    const { error } = await withTimeout(
      (async () => await supabase.from('notification_queue').select('id').limit(1))(),
      5000,
      'Supabase readiness check timed out'
    );

    if (error) {
      throw error;
    }

    services.supabase = 'ready';
    services.notificationQueue = 'ready';
    twilioNotificationService.setQueueAvailable(true);
  } catch (error) {
    if (isMissingNotificationQueueError(error)) {
      services.supabase = 'ready';
      services.notificationQueue = 'not_migrated';
    } else {
      ready = false;
      services.supabase = {
        status: 'unavailable',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const websocketStatus = wsManager.getHealthStatus();
  const rateLimitStatus = getRateLimitStoreStatus();

  services.redis = {
    configured: isRedisConfigured(),
    websocket: websocketStatus.redisConfigured
      ? (websocketStatus.adapterReady ? 'ready' : 'unavailable')
      : 'not_configured',
    rateLimiting: rateLimitStatus,
  };
  services.websocket = websocketStatus;
  services.rateLimiting = rateLimitStatus;

  if (websocketStatus.redisConfigured && !websocketStatus.adapterReady) {
    ready = false;
  }

  if (rateLimitStatus.enabled && !rateLimitStatus.connected) {
    ready = false;
  }

  services.twilio = twilioNotificationService.getHealthStatus();
  services.telkom = {
    configured: isTelkomConfigured(),
    callbackUrlConfigured: Boolean(resolveTelkomCallbackUrl()),
  };
  services.notificationWorker = {
    enabled: isNotificationWorkerEnabled(),
    running: Boolean(notificationWorkerInterval),
    busy: notificationWorkerInFlight,
  };

  return { ready, services };
}

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "https:", "data:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    xPoweredBy: false,
  })
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS request from unauthorized origin', { origin });
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
  optionsSuccessStatus: 200,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = uuid();
  (req as AppRequest).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const requestId = (req as AppRequest).id;
    const route = req.route?.path || req.path;

    logger.logRequest(req, res, duration, requestId);
    errorTracking.captureApiRequest(req.method, req.path, res.statusCode, duration);
    trackTiming('api.request.duration_ms', duration, [
      `method:${req.method}`,
      `route:${req.path}`,
      `status_code:${res.statusCode}`,
    ]);

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  next();
});

app.use('/api/', defaultLimiter);

app.use(ids.analyzeRequest());

const METRICS_TOKEN = process.env.METRICS_TOKEN;
const METRICS_ALLOWED_IPS = (process.env.METRICS_ALLOWED_IPS || '127.0.0.1,::1,::ffff:127.0.0.1')
  .split(',')
  .map((s) => s.trim());

app.get(
  '/metrics',
  (req: Request, res: Response, next: NextFunction) => {
    if (METRICS_TOKEN) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${METRICS_TOKEN}`) {
        res.status(403).end();
        return;
      }
    } else {
      const clientIP = req.ip || '';
      if (!METRICS_ALLOWED_IPS.some((ip) => clientIP === ip || clientIP.endsWith(ip))) {
        res.status(403).end();
        return;
      }
    }
    next();
  },
  metricsHandler
);

function verifyTelkomSignature(
  body: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  try {
    const payload = JSON.stringify(body);
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(computedHmac),
      Buffer.from(signature)
    );
  } catch (error) {
    logger.error('Signature verification error', error);
    return false;
  }
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  return authHeader.slice('Bearer '.length).trim() || undefined;
}

const AUTH_CACHE_TTL_SECONDS = 30;

async function resolveAuthenticatedUser(token: string): Promise<AuthenticatedUser | null> {
  const redisClient = getRedisClient();
  const cacheKey = `auth:user:${crypto.createHash('sha256').update(token).digest('hex')}`;

  if (redisClient?.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as AuthenticatedUser;
      }
    } catch {
      // Cache read failure is non-fatal — fall through to Supabase
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const authUser: AuthenticatedUser = {
    id: user.id,
    role: profile?.role,
    organizationId: profile?.organization_id,
  };

  if (redisClient?.isOpen) {
    try {
      await redisClient.setEx(cacheKey, AUTH_CACHE_TTL_SECONDS, JSON.stringify(authUser));
    } catch {
      // Cache write failure is non-fatal
    }
  }

  return authUser;
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestId = (req as AppRequest).id;
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401).json({ error: 'Authorization token required', requestId });
      return;
    }

    const user = await resolveAuthenticatedUser(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid token', requestId });
      return;
    }

    (req as AppRequest).user = user;
    next();
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Authentication middleware failed', error, {}, requestId);
    res.status(500).json({ error: 'Authentication failed', requestId });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as AppRequest).id;
  const role = (req as AppRequest).user?.role?.toLowerCase();

  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin access required', requestId });
    return;
  }

  next();
}

function requirePoliceAccess(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as AppRequest).id;
  const role = (req as AppRequest).user?.role?.toLowerCase();

  if (!role || !['police', 'admin'].includes(role)) {
    res.status(403).json({ error: 'Police access required', requestId });
    return;
  }

  next();
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  const readiness = await getReadinessStatus();

  res.status(readiness.ready ? 200 : 503).json({
    status: readiness.ready ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    services: readiness.services,
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/verify', async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const token = extractBearerToken(req);
    if (!token) {
      logger.warn('Auth verify: No token provided', { ip: req.ip }, requestId);
      return res.status(401).json({ error: 'No token provided', requestId });
    }

    const user = await resolveAuthenticatedUser(token);
    if (!user) {
      logger.warn('Auth verify: Invalid token', { ip: req.ip }, requestId);
      return res.status(401).json({ error: 'Invalid token', requestId });
    }

    res.json({ user });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Auth verify failed', error, {}, requestId);
    res.status(500).json({ error: 'Verification failed', requestId });
  }
});

app.post('/api/auth/mfa/setup', requireAuth, mfaLimiter, validationMiddleware.mfaSetup, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AppRequest).user!.id;
    const { username } = req.body;
    const setup = await mfaService.generateMFASetup(userId, username || userId);
    res.json({ setup });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('MFA setup failed', error, {}, requestId);
    res.status(500).json({ error: 'MFA setup failed', requestId });
  }
});

app.post('/api/auth/mfa/verify', requireAuth, mfaLimiter, validationMiddleware.mfaVerify, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const userId = (req as AppRequest).user!.id;
    const { code } = req.body;
    const result = await mfaService.verifyUserMFA(userId, code);
    if (!result.valid) {
      logger.warn('MFA verification failed', { userId }, requestId);
      res.status(401).json({ error: 'Invalid code', requestId });
      return;
    }
    res.json(result);
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('MFA verification error', error, {}, requestId);
    res.status(500).json({ error: 'Verification failed', requestId });
  }
});

app.post('/api/cases/escalate', requireAuth, escalationLimiter, validationMiddleware.escalate, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const authenticatedUserId = (req as AppRequest).user!.id;
    const { caseId, severity, reason } = req.body;

    const { data: escalation, error } = await supabase
      .from('escalation_events')
      .insert({
        case_id: caseId,
        severity,
        reason,
        user_id: authenticatedUserId,
        status: 'triggered',
        triggered_at: new Date().toISOString(),
      })
      .select();

    if (error) throw error;

    await eventBus.emitAsync('escalation_triggered', {
      caseId,
      severity,
      reason,
      userId: authenticatedUserId,
      escalationId: escalation[0].id,
    });

    wsManager.broadcastEmergencyEscalation({
      caseId,
      severity,
      reason,
      escalationId: escalation[0].id,
    });

    await auditLogService.log({
      userId: authenticatedUserId,
      action: 'escalation_triggered',
      module: 'escalation',
      resourceId: caseId,
      resourceType: 'case',
      status: 'success',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      metadata: { severity, reason, requestId },
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Emergency escalation triggered', escalationId: escalation[0].id, requestId });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Escalation failed', error, {}, requestId);
    res.status(500).json({ error: 'Escalation failed', requestId });
  }
});

app.get('/api/audit/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AppRequest).user?.id;
    const { action, module, limit = 100 } = req.query;

    const logs = await auditLogService.query({
      userId: userId as string,
      action: action as string,
      module: module as string,
      limit: parseInt(limit as string),
    });

    res.json(logs);
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Failed to retrieve audit logs', error instanceof Error ? error : undefined, { requestId });
    res.status(500).json({ error: 'Failed to retrieve audit logs', requestId });
  }
});

app.get('/api/audit/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const isValid = await auditLogService.verifyChain();
    res.json({ valid: isValid, message: isValid ? 'Audit log chain is intact' : 'Chain integrity compromised', requestId });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Audit chain verification failed', error instanceof Error ? error : undefined, { requestId });
    res.status(500).json({ error: 'Verification failed', requestId });
  }
});

app.get('/api/admin/dashboard-config', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const requestId = (req as AppRequest).id;

  res.json({
    ...ADMIN_DASHBOARD_CONFIG,
    generatedAt: new Date().toISOString(),
    requestId,
  });
});

app.get('/api/police/alerts', requireAuth, requirePoliceAccess, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '12'), 10) || 12, 1), 50);

    const { data, error } = await supabase
      .from('alerts_feed')
      .select('id,time,type,message,module,status,created_at,acknowledged_at,acknowledged_by')
      .neq('status', 'acknowledged')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    res.json({
      alerts: data ?? [],
      requestId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Failed to retrieve police alerts', error, {}, requestId);
    res.status(500).json({ error: 'Failed to retrieve police alerts', requestId });
  }
});

app.post('/api/police/alerts/:alertId/acknowledge', requireAuth, requirePoliceAccess, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const userId = (req as AppRequest).user!.id;
    const { alertId } = req.params;

    const { data, error } = await supabase
      .from('alerts_feed')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId)
      .select('id,message,module,type,status')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      res.status(404).json({ error: 'Alert not found', requestId });
      return;
    }

    await auditLogService.log({
      userId,
      action: 'police_alert_acknowledged',
      module: 'police_operations',
      resourceId: alertId,
      resourceType: 'alert',
      status: 'success',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      metadata: {
        alertType: data.type,
        alertModule: data.module,
        alertMessage: data.message,
        requestId,
      },
      timestamp: new Date().toISOString(),
    });

    res.json({ alert: data, requestId });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Failed to acknowledge police alert', error, {}, requestId);
    res.status(500).json({ error: 'Failed to acknowledge police alert', requestId });
  }
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as AppRequest).id;
  errorTracking.captureException(err, {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  logger.error('Unhandled error', err, {}, requestId);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    requestId,
  });
});

app.post('/api/auth/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const userId = (req as AppRequest).user?.id;

    await auditLogService.log({
      userId: userId || 'anonymous',
      action: 'user_logout',
      module: 'auth',
      resourceType: 'session',
      status: 'success',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString(),
    });

    logger.info('User logged out', { userId }, requestId);
    res.json({ message: 'Logged out successfully', requestId });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('Logout failed', error, {}, requestId);
    res.status(500).json({ error: 'Logout failed', requestId });
  }
});

app.use('/api/escalation', createEscalationRoutes(supabase, escalationWorkflow, auditLogService, wsManager));
app.use('/api/intelligence', createIntelligenceRoutes(supabase, auditLogService));
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ussd', createUSSDRoutes(ussdGateway, offlineCache));

// ============================================================================
// AI SURVIVOR CHAT ENDPOINT
// ============================================================================

app.post('/api/ai/survivor-chat', defaultLimiter, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as AppRequest).id;
  try {
    const { systemPrompt, messages } = req.body as {
      systemPrompt?: string;
      messages?: Array<{ role: string; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required', requestId });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const lastUser = messages.filter(m => m.role === 'user').at(-1)?.content ?? '';
      const fallback = /danger|hurt|kill|die|attack|emergency/i.test(lastUser)
        ? 'CRISIS ALERT: Please call Police: 10111 or Crisis Line: 0800 428 428 immediately. Dial *123*456# from any phone — no internet needed. You are not alone.'
        : 'I hear you, and I\'m glad you reached out. You are safe here. Can you share a little more so I can help guide you?';
      res.json({ content: fallback });
      return;
    }

    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey });

    const validMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: systemPrompt ?? 'You are a compassionate, trauma-informed GBV support companion. Respond with empathy. If user is in immediate danger include CRISIS ALERT: and provide Police: 10111, Crisis line: 0800 428 428.',
      messages: validMessages,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ content });
  } catch (error) {
    logger.error('AI survivor chat failed', error, {}, requestId);
    res.json({ content: 'I\'m here with you. Can you tell me a little more about what\'s happening right now?' });
  }
});

// ============================================================================
// TELKOM USSD WEBHOOK
// ============================================================================

app.post('/api/ussd/telkom/callback', validationMiddleware.ussdCallback, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    
    // Skip signature verification in development
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers['x-telkom-signature'] as string;
      const telkomSecret = process.env.TELKOM_WEBHOOK_SECRET;

      if (!signature || !telkomSecret) {
        logger.error('Missing signature or webhook secret', new Error('Missing credentials'), {}, requestId);
        return res.status(401).json({
          success: false,
          error: 'Signature verification failed',
          requestId,
        });
      }

      if (!verifyTelkomSignature(req.body, signature, telkomSecret)) {
        logger.warn('Invalid signature from IP', { ip: req.ip }, requestId);
        
        await auditLogService.log({
          userId: 'system',
          action: 'webhook_signature_failed',
          module: 'ussd',
          resourceId: 'telkom-callback',
          resourceType: 'webhook',
          status: 'failure',
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          metadata: { reason: 'Invalid HMAC signature', requestId },
          timestamp: new Date().toISOString(),
        });
        
        return res.status(401).json({
          success: false,
          error: 'Invalid signature',
          requestId,
        });
      }
    }

    const response = await ussdGateway.handleTelkomCallback(req.body);
    
    res.json({
      success: true,
      message: 'USSD callback processed',
      response,
      requestId,
    });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('USSD Telkom callback failed', error, {}, requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to process USSD callback',
      requestId,
    });
  }
});

// ============================================================================
// MANUAL USSD TEST ENDPOINT
// ============================================================================

app.post('/api/ussd/test', validationMiddleware.ussdTest, async (req: Request, res: Response) => {
  try {
    const requestId = (req as AppRequest).id;
    const { phoneNumber, userInput, language = 'en', sessionId } = req.body;

    if (!phoneNumber || userInput === undefined) {
      return res.status(400).json({ error: 'Missing phoneNumber or userInput', requestId });
    }

    const response = await ussdGateway.handleUSSDRequest(phoneNumber, userInput, language, sessionId);
    
    res.json({
      success: true,
      response,
      requestId,
    });
  } catch (error) {
    const requestId = (req as AppRequest).id;
    logger.error('USSD test failed', error, {}, requestId);
    res.status(500).json({
      success: false,
      error: 'Failed to process USSD request',
      requestId,
    });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

let server: ReturnType<typeof createServer> | https.Server;

if (process.env.NODE_ENV === 'production' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  try {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    };
    server = https.createServer(options, app);
    logger.info('HTTPS server configured');
  } catch (error) {
    logger.error(
      'CRITICAL: Failed to load SSL certificates in production. Refusing to start without TLS.',
      error instanceof Error ? { error: error.message } : undefined
    );
    process.exit(1);
  }
} else {
  server = httpServer;
}

async function startServer(): Promise<void> {
  await initializeServices();
  await rateLimitingInitialization;
  await wsManager.initializeScaling();
  startNotificationWorker();

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off('error', handleError);
      reject(error);
    };

    server.once('error', handleError);
    server.listen(PORT, () => {
      server.off('error', handleError);
      const protocol = server instanceof https.Server ? 'HTTPS' : 'HTTP';
      const websocketStatus = wsManager.getHealthStatus();
      const rateLimitStatus = getRateLimitStoreStatus();
      logger.info('AEGIS-AI server startup', {
        port: PORT,
        protocol,
        environment: process.env.NODE_ENV,
        features: {
          encryption: 'AES-256-GCM',
          mfa: 'TOTP + Backup codes',
          auditLogging: 'Immutable blockchain-style',
          eventBus: 'Active',
          webSocket: websocketStatus.adapter === 'redis' ? 'Redis adapter enabled' : 'Local adapter enabled',
          rateLimiting: rateLimitStatus.store === 'redis' ? 'Redis-backed' : 'In-memory',
          rateLimitingReason: rateLimitStatus.reason,
          sessionManagement: 'JWT with refresh tokens',
          notificationWorker: isNotificationWorkerEnabled() ? 'In-process' : 'External/disabled',
        },
      });
      resolve();
    });
  });
}

void startServer().catch((error) => {
  logger.error('AEGIS-AI server startup failed', error);
  process.exit(1);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await stopNotificationWorker();
      logger.info('Notification worker stopped');
    } catch (error) {
      logger.error('Error stopping notification worker', error);
    }

    try {
      await wsManager.shutdown();
      logger.info('WebSocket connections closed');
    } catch (error) {
      logger.error('Error closing WebSocket', error);
    }

    try {
      await loadBalancer.shutdown();
      logger.info('Load balancer shutdown');
    } catch (error) {
      logger.error('Error shutting down load balancer', error);
    }

    try {
      await cacheManager.close();
      logger.info('Cache manager closed');
    } catch (error) {
      logger.error('Error closing cache manager', error);
    }

    try {
      await dbPool.close();
      logger.info('Database pool closed');
    } catch (error) {
      logger.error('Error closing database pool', error);
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      await supabase.auth.signOut();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', error);
    }

    try {
      await closeRedisClient();
      logger.info('Redis client closed');
    } catch (error) {
      logger.error('Error closing Redis client', error);
    }

    try {
      await closeDatadog();
      logger.info('Datadog client closed');
    } catch (error) {
      logger.error('Error closing Datadog client', error);
    }

    try {
      await errorTracking.flush();
      logger.info('Error tracking flushed');
    } catch (error) {
      logger.error('Error flushing error tracking', error);
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after 30 seconds timeout', new Error('Shutdown timeout'));
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
