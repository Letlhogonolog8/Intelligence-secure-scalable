import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';

import { WebSocketManager } from './websocket';
import { EventBus, EventType } from './events/eventEmitter';
import { EncryptionService } from './security/encryption';
import { MFAService } from './security/mfa';
import { AuditLogService } from './security/auditLog';
import { USSDGateway } from './ussd/ussdGateway';
import { validationMiddleware } from './middleware/validation';
import { createLogger } from './utils/logger';
import { metricsHandler, httpRequestDuration, httpRequestsTotal } from './utils/prometheus';
import { 
  defaultLimiter, 
  authLimiter, 
  apiLimiter, 
  strictLimiter, 
  escalationLimiter, 
  mfaLimiter,
  closeRedisClient
} from './middleware/rateLimiting';

dotenv.config();

const logger = createLogger('aegis-api');

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

let supabase: SupabaseClient;
let wsManager: WebSocketManager;
let eventBus: EventBus;
let encryptionService: EncryptionService;
let mfaService: MFAService;
let auditLogService: AuditLogService;
let ussdGateway: USSDGateway;

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
    encryptionService = new EncryptionService(supabase);
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

  logger.info('All services initialized successfully');
} catch (error) {
  logger.error('Service initialization failed', error);
  process.exit(1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "https:", "data:"],
        connectSrc: ["'self'", "https://", "wss://"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
      reportUri: process.env.CSP_REPORT_URI,
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
      console.warn(`CORS request from unauthorized origin: ${origin}`);
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
  (req as any).id = uuid();
  res.setHeader('X-Request-ID', (req as any).id);
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration, (req as any).id);
  });
  next();
});

app.use('/api/', defaultLimiter);

app.get('/metrics', metricsHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
});

function verifyTelkomSignature(
  body: Record<string, any>,
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
    console.error('Signature verification error:', error);
    return false;
  }
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/verify', async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      console.warn(`[${requestId}] Auth verify: No token provided from ${req.ip}`);
      return res.status(401).json({ error: 'No token provided', requestId });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.warn(`[${requestId}] Auth verify: Invalid token from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid token', requestId });
    }

    res.json({ user });
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] Auth verify failed:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Verification failed', requestId });
  }
});

app.post('/api/auth/mfa/setup', mfaLimiter, validationMiddleware.mfaSetup, async (req: Request, res: Response): Promise<void> => {
  try {
    const requestId = (req as any).id;
    const { userId, username } = req.body;
    const setup = await mfaService.generateMFASetup(userId, username || userId);
    res.json({ setup });
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] MFA setup failed:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'MFA setup failed', requestId });
  }
});

app.post('/api/auth/mfa/verify', mfaLimiter, validationMiddleware.mfaVerify, async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const { userId, code } = req.body;
    const result = await mfaService.verifyUserMFA(userId, code);
    if (!result.valid) {
      console.warn(`[${requestId}] MFA verification failed for user ${userId}`);
      res.status(401).json({ error: 'Invalid code', requestId });
      return;
    }
    res.json(result);
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] MFA verification error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Verification failed', requestId });
  }
});

app.post('/api/cases/escalate', escalationLimiter, validationMiddleware.escalate, async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const { caseId, severity, reason, userId } = req.body;

    const { data: escalation, error } = await supabase
      .from('escalation_events')
      .insert({
        case_id: caseId,
        severity,
        reason,
        user_id: userId,
        status: 'triggered',
        triggered_at: new Date().toISOString(),
      })
      .select();

    if (error) throw error;

    await eventBus.emitAsync('escalation_triggered', {
      caseId,
      severity,
      reason,
      userId,
      escalationId: escalation[0].id,
    });

    wsManager.broadcastEmergencyEscalation({
      caseId,
      severity,
      reason,
      escalationId: escalation[0].id,
    });

    await auditLogService.log({
      userId,
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
    const requestId = (req as any).id;
    console.error(`[${requestId}] Escalation failed:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Escalation failed', requestId });
  }
});

app.get('/api/audit/logs', async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const userId = (req as any).user?.id;
    const { action, module, limit = 100 } = req.query;

    const logs = await auditLogService.query({
      userId: userId as string,
      action: action as string,
      module: module as string,
      limit: parseInt(limit as string),
    });

    res.json(logs);
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] Failed to retrieve audit logs:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to retrieve audit logs', requestId });
  }
});

app.get('/api/audit/verify', async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const isValid = await auditLogService.verifyChain();
    res.json({ valid: isValid, message: isValid ? 'Audit log chain is intact' : 'Chain integrity compromised', requestId });
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] Audit chain verification failed:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Verification failed', requestId });
  }
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as any).id;
  logger.error('Unhandled error', err, {}, requestId);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    requestId,
  });
});

const jwtSecret = (() => {
  if (!process.env.JWT_SECRET) {
    logger.warn('JWT_SECRET not provided, generating temporary key for development');
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: JWT_SECRET required in production', new Error('Missing JWT_SECRET'));
      process.exit(1);
    }
    return crypto.randomBytes(32).toString('hex');
  }
  return process.env.JWT_SECRET;
})();

const refreshTokenSecret = (() => {
  if (!process.env.REFRESH_TOKEN_SECRET) {
    logger.warn('REFRESH_TOKEN_SECRET not provided, generating temporary key for development');
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: REFRESH_TOKEN_SECRET required in production', new Error('Missing REFRESH_TOKEN_SECRET'));
      process.exit(1);
    }
    return crypto.randomBytes(32).toString('hex');
  }
  return process.env.REFRESH_TOKEN_SECRET;
})();

interface SessionData {
  userId: string;
  refreshToken: string;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionData>();

function createAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRY || '15m' }
  );
}

function createRefreshToken(userId: string): string {
  const token = jwt.sign(
    { userId, type: 'refresh' },
    refreshTokenSecret,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
  );
  
  const session: SessionData = {
    userId,
    refreshToken: token,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
  };
  
  activeSessions.set(token, session);
  return token;
}

app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      logger.warn('Refresh token missing', {}, requestId);
      return res.status(401).json({ error: 'Refresh token required', requestId });
    }
    
    const session = activeSessions.get(refreshToken);
    if (!session || session.expiresAt < Date.now()) {
      logger.warn('Invalid or expired refresh token', { userId: session?.userId }, requestId);
      activeSessions.delete(refreshToken);
      return res.status(401).json({ error: 'Invalid or expired token', requestId });
    }
    
    try {
      jwt.verify(refreshToken, refreshTokenSecret);
    } catch (error) {
      logger.error('Refresh token verification failed', error, { userId: session.userId }, requestId);
      return res.status(401).json({ error: 'Invalid token', requestId });
    }
    
    activeSessions.delete(refreshToken);
    
    const newAccessToken = createAccessToken(session.userId);
    const newRefreshToken = createRefreshToken(session.userId);
    
    logger.info('Token refreshed', { userId: session.userId }, requestId);
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: '15m',
      requestId,
    });
  } catch (error) {
    const requestId = (req as any).id;
    logger.error('Token refresh failed', error, {}, requestId);
    res.status(500).json({ error: 'Failed to refresh token', requestId });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const { refreshToken } = req.body;
    const userId = (req as any).user?.id;
    
    if (refreshToken) {
      activeSessions.delete(refreshToken);
      logger.info('User logged out', { userId }, requestId);
    }
    
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
    
    res.json({ message: 'Logged out successfully', requestId });
  } catch (error) {
    const requestId = (req as any).id;
    logger.error('Logout failed', error, {}, requestId);
    res.status(500).json({ error: 'Logout failed', requestId });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

let server: any;

if (process.env.NODE_ENV === 'production' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  try {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    };
    server = https.createServer(options, app);
    logger.info('HTTPS server configured');
  } catch (error) {
    logger.warn('Failed to load SSL certificates, falling back to HTTP', error);
    server = httpServer;
  }
} else {
  server = httpServer;
}

server.listen(PORT, () => {
  const protocol = server instanceof https.Server ? 'HTTPS' : 'HTTP';
  logger.info('AEGIS-AI server startup', {
    port: PORT,
    protocol,
    environment: process.env.NODE_ENV,
    features: {
      encryption: 'AES-256-GCM',
      mfa: 'TOTP + Backup codes',
      auditLogging: 'Immutable blockchain-style',
      eventBus: 'Active',
      webSocket: 'Ready',
      rateLimiting: 'Redis-backed',
      sessionManagement: 'JWT with refresh tokens',
    },
  });
});

// ============================================================================
// TELKOM USSD WEBHOOK
// ============================================================================

app.post('/api/ussd/telkom/callback', validationMiddleware.ussdCallback, async (req: Request, res: Response) => {
  try {
    const requestId = (req as any).id;
    const signature = req.headers['x-telkom-signature'] as string;
    const telkomSecret = process.env.TELKOM_WEBHOOK_SECRET;

    if (!signature || !telkomSecret) {
      console.error(`[${requestId}] Missing signature or webhook secret`);
      return res.status(401).json({
        success: false,
        error: 'Signature verification failed',
        requestId,
      });
    }

    if (!verifyTelkomSignature(req.body, signature, telkomSecret)) {
      console.warn(`[${requestId}] Invalid signature from IP:`, req.ip);
      
      await auditLogService.log({
        userId: 'system',
        action: 'webhook_signature_failed',
        module: 'ussd',
        resourceId: 'telkom-callback',
        resourceType: 'webhook',
        status: 'failed',
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

    const response = await ussdGateway.handleTelkomCallback(req.body);
    
    res.json({
      success: true,
      message: 'USSD callback processed',
      response,
      requestId,
    });
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] USSD Telkom callback failed:`, error instanceof Error ? error.message : String(error));
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
    const requestId = (req as any).id;
    const { phoneNumber, userInput, language = 'en' } = req.body;

    if (!phoneNumber || !userInput) {
      return res.status(400).json({ error: 'Missing phoneNumber or userInput', requestId });
    }

    const response = await ussdGateway.handleUSSDRequest(phoneNumber, userInput, language);
    
    res.json({
      success: true,
      response,
      requestId,
    });
  } catch (error) {
    const requestId = (req as any).id;
    console.error(`[${requestId}] USSD test failed:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: 'Failed to process USSD request',
      requestId,
    });
  }
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      wsManager.close();
      logger.info('WebSocket connections closed');
    } catch (error) {
      logger.error('Error closing WebSocket', error);
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
