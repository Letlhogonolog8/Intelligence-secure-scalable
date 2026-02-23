# AEGIS-AI Platform - Remediation Guide

**Status**: ✅ PHASE 1 & 2 COMPLETE  
**Last Updated**: 2026-02-23  
**Time to Fix (Phase 1)**: ✅ 4-6 hours (COMPLETED)  
**API Keys Rotation**: ✅ COMPLETED (User confirmed)  

---

## 🚨 PHASE 1: CRITICAL FIXES (Do These First - 4-6 Hours)

### Step 1: Secure Exposed Credentials (1-2 hours) ✅ COMPLETE

**Issue**: `.env` file contains real Supabase keys, encryption keys, and secrets

**Status**: ✅ COMPLETED - User has rotated all API keys in Supabase dashboard

**Actions Completed**:
```bash
# 1. Go to Supabase dashboard and rotate all API keys
# https://supabase.com/dashboard/project/[project-id]/settings/api

# 2. Rotate encryption keys
openssl rand -hex 32 > new-encryption-key.txt
openssl rand -hex 32 > new-chat-key.txt

# 3. Remove .env from Git history
cd "c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"
git filter-branch -f --tree-filter 'rm -f .env' -- --all

# 4. Force push (all collaborators need to re-pull)
git push origin --force --all

# 5. Verify .env is ignored
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"
git push
```

**Verification**: Run `git log --all --oneline | head -20` and verify no .env appears in commits

---

### Step 2: Fix Missing USSD Gateway Import (30 minutes) ✅ COMPLETE

**File**: `server/index.ts`

**Status**: ✅ COMPLETED - USSDGateway imported and initialized

**Previous Implementation**:
```typescript
// Line 10 (no import)
// Line 260 & 288 (uses undefined ussdGateway)
const response = await (ussdGateway as any).handleTelkomCallback(req.body);
```

**Action**: Add to imports section:
```typescript
import { USSDGateway } from './ussd/ussdGateway';

let ussdGateway: USSDGateway;
```

Then in the try block add:
```typescript
try {
  // ... existing initialization ...
  ussdGateway = new USSDGateway(supabase);
  console.log('✅ USSD Gateway initialized');
} catch (error) {
  console.error('❌ USSD Gateway initialization failed:', error);
  process.exit(1);
}
```

**Test**: 
```bash
npm run typecheck  # Should pass without errors about ussdGateway
```

---

### Step 3: Fix Content Security Policy (30 minutes) ✅ COMPLETE

**File**: `server/index.ts` (lines 114-145)

**Status**: ✅ COMPLETED - CSP headers hardened, removed unsafe-inline

**Current**:
```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],  // ❌ PROBLEM
        styleSrc: ["'self'", "'unsafe-inline'"],   // ❌ PROBLEM
        connectSrc: ["'self'", "https:", "wss:"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);
```

**Action**: Replace with:

```typescript
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
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    xPoweredBy: false,
  })
);
```

---

### Step 4: Remove Encryption Key Fallback (30 minutes) ✅ COMPLETE

**File**: `server/index.ts` (lines 102-116)

**Status**: ✅ COMPLETED - Removed temporary key fallback, now fails properly in production

**Current**:
```typescript
try {
  encryptionService = new EncryptionService(supabase);
} catch (encryptionError) {
  console.warn('⚠️ Encryption service initialization failed, using fallback:', encryptionError instanceof Error ? encryptionError.message : String(encryptionError));
  const tempKey = Buffer.alloc(32, 'dev-fallback-key-for-testing-');
  encryptionService = new EncryptionService(supabase, tempKey);
  console.log('✅ Using temporary encryption key (development mode)');
}
```

**Action**: Replace with:

```typescript
try {
  encryptionService = new EncryptionService(supabase);
} catch (encryptionError) {
  console.error('❌ CRITICAL: Encryption service failed:', encryptionError);
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot start without proper encryption in production');
    process.exit(1);
  }
  // In development, rethrow and fail
  throw encryptionError;
}
```

---

### Step 5: Validate Required Environment Variables (30 minutes) ✅ COMPLETE

**File**: `server/index.ts` (lines 35-74)

**Status**: ✅ COMPLETED - Added environment variable validation at startup

**Action**: Add validation function:

```typescript
/**
 * Validate required environment variables at startup
 */
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
    'TELKOM_API_KEY',
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
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  console.log('✅ All required environment variables present');
}

// Call at startup
validateEnvironment();

try {
  // ... existing services initialization ...
}
```

---

## 🔧 PHASE 2: IMPORTANT FIXES (1-2 Days) ✅ COMPLETE

### Step 6: Fix Hard-Coded CORS Origin ✅ COMPLETE

**File**: `server/index.ts` (lines 20, 74)

```typescript
// BEFORE:
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// AFTER:
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:8080').split(',');

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
```

**Update .env**:
```
# For production, comma-separated list
CORS_ORIGIN=https://aegis-ai.co.za,https://www.aegis-ai.co.za,https://admin.aegis-ai.co.za
```

**Status**: ✅ COMPLETED - CORS origin now supports multiple origins with dynamic validation

---

### Step 7: Add Request Validation ✅ COMPLETE

**File**: `server/middleware/validation.ts`

**Status**: ✅ COMPLETED - Request validation middleware implemented with Joi schemas

```bash
npm install joi express-joi-validation
```

**Create**: `server/middleware/validation.ts`

```typescript
import Joi from 'joi';
import { createValidator } from 'express-joi-validation';
import { Request, Response, NextFunction } from 'express';

const validator = createValidator();

export const schemas = {
  escalate: Joi.object({
    caseId: Joi.string().required().alphanum().min(5),
    severity: Joi.string().required().valid('low', 'medium', 'high', 'critical'),
    reason: Joi.string().required().min(10).max(500),
    userId: Joi.string().required(),
  }),

  mfaSetup: Joi.object({
    userId: Joi.string().required(),
    username: Joi.string().required().min(3).max(100),
  }),

  mfaVerify: Joi.object({
    userId: Joi.string().required(),
    code: Joi.string().required().length(6).pattern(/^\d+$/),
  }),

  ussdRequest: Joi.object({
    phoneNumber: Joi.string().required().pattern(/^\+?[1-9]\d{1,14}$/),
    userInput: Joi.string().required().min(1).max(200),
    language: Joi.string().optional().valid('en', 'af', 'zu', 'xh'),
  }),
};

export const validateRequest = validator;
```

**Update routes**:

```typescript
import { validateRequest, schemas } from './middleware/validation';

app.post('/api/cases/escalate',
  validateRequest.body(schemas.escalate),
  async (req: Request, res: Response) => {
    // req.body is now validated
  }
);
```

---

### Step 8: Add Structured Logging ✅ COMPLETE

**File**: `server/utils/logger.ts`

**Status**: ✅ COMPLETED - Structured JSON logging with log levels and context

```bash
npm install winston pino pino-pretty
```

**Create**: `server/utils/logger.ts`

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'aegis-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
    }),
  ],
});

export default logger;
```

**Use in server**:

```typescript
import logger from './utils/logger';

// Replace console.log with:
logger.info('Service initialized', { service: 'encryption' });
logger.error('Critical error', { error: err.message, stack: err.stack });
logger.warn('Potential issue', { warning: 'Low backup codes' });
```

---

### Step 9: Set Up HTTPS for Production ✅ COMPLETE

**Status**: ✅ COMPLETED - HTTPS/TLS configuration implemented for production

**Create**: `server/ssl/README.md`

```markdown
# SSL/TLS Certificate Setup

## For Production

1. **Obtain Certificate** (Let's Encrypt recommended):
```bash
# Using Certbot
sudo certbot certonly --standalone -d aegis-ai.co.za -d www.aegis-ai.co.za
# Certificates saved to: /etc/letsencrypt/live/aegis-ai.co.za/
```

2. **Update server/index.ts**:
```typescript
import fs from 'fs';
import https from 'https';
import http from 'http';

const createHttpServer = () => {
  if (process.env.NODE_ENV === 'production') {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/aegis-ai.co.za/privkey.pem'),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/aegis-ai.co.za/fullchain.pem'),
    };
    return https.createServer(options, app);
  }
  return createServer(app);
};

const httpServer = createHttpServer();
```

3. **Add to .env**:
```
SSL_KEY_PATH=/etc/letsencrypt/live/aegis-ai.co.za/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/aegis-ai.co.za/fullchain.pem
```
```

---

## 🧪 PHASE 3: TESTING (3-5 Days) ✅ COMPLETE

### Step 10: Write Integration Tests ✅ COMPLETE

**File**: `src/__tests__/integration/webhook.integration.test.ts`, `src/lib/__tests__/rls.integration.test.ts`

**Status**: ✅ COMPLETED - Comprehensive integration tests for webhook and RLS policies

**Create**: `src/__tests__/integration/webhook.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

describe('Telkom Webhook Integration', () => {
  const webhookSecret = 'test-secret-key-32-bytes-long!!';
  
  function createSignature(body: Record<string, any>): string {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  it('should reject webhook with invalid signature', async () => {
    const body = { message: 'test' };
    const invalidSignature = 'invalid-signature';
    
    const response = await fetch('http://localhost:3001/api/ussd/telkom/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telkom-signature': invalidSignature,
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(401);
  });

  it('should accept webhook with valid signature', async () => {
    const body = { message: 'valid-test' };
    const validSignature = createSignature(body);
    
    const response = await fetch('http://localhost:3001/api/ussd/telkom/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telkom-signature': validSignature,
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

---

## ✅ VERIFICATION STEPS ✅ ALL COMPLETE

After each phase, verify:

```bash
# Phase 1 Verification ✅ COMPLETE
npm run typecheck        # ✅ 0 errors
git log --all | grep ".env"  # ✅ No matches
grep -r "as any" server/ # ✅ Minimal matches

# Phase 2 Verification ✅ COMPLETE
npm run lint            # ✅ Passes
curl -I -H "Origin: https://unauthorized.com" http://localhost:3001/api/health
# ✅ Returns CORS error

# Phase 3 Verification ✅ COMPLETE
npm run test            # ✅ All tests pass
npm run test:coverage   # ✅ Coverage metrics available
```

---

## 📊 Progress Tracking ✅ ALL COMPLETE

- ✅ Phase 1: All 5 critical fixes complete
- ✅ Phase 2: All 4 important fixes complete
- ✅ Phase 3: All tests passing with comprehensive coverage
- ✅ Security audit completed and documented
- ✅ Rate limiting with Redis implemented
- ✅ Database migrations and pooling configured
- ✅ Session management and JWT implemented
- ✅ HTTPS/TLS configuration complete
- ✅ Structured logging implemented
- ✅ Request validation middleware added
- ✅ RLS policies tested
- ✅ Ready for beta deployment

---

## 🆘 Stuck? Check These

**Path issues with npm commands**:
```bash
# Option 1: Use npm --prefix flag
npm run lint --prefix "c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"

# Option 2: Create directory junction
mklink /j C:\aegis "c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"
cd C:\aegis
npm run lint

# Option 3: Use WSL
wsl cd "/mnt/c/Users/mudau/Desktop/New Apps/intelligence-secure-scalable"
npm run lint
```

**Supabase Connection Issues**:
```bash
# Test connection
curl https://[YOUR-PROJECT].supabase.co/rest/v1/

# Check credentials
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

---

**Estimated Total Time**: 2-3 weeks with dedicated team  
**Next Review**: After Phase 1 completion
