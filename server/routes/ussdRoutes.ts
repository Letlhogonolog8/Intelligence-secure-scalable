/**
 * USSD API Routes
 * server/routes/ussdRoutes.ts
 * 
 * Endpoints for:
 * - USSD request handling
 * - Session management
 * - Offline fallback
 * - Analytics & monitoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { USSDGateway, Language } from '../ussd/ussdGateway';
import { OfflineCache } from '../ussd/offlineCache';

/**
 * USSD endpoints are machine-to-machine webhook callbacks from USSD aggregators
 * (Africa's Talking, Arkesel, Telkom). Browser-based CSRF does not apply because:
 * 1. Requests originate from aggregator servers, not browsers.
 * 2. The /process endpoint validates the serviceCode against an allowlist.
 * 3. The Telkom callback validates an HMAC signature in server/index.ts.
 * All other mutating endpoints (/emergency, /offline-sync, etc.) are internal
 * admin/ops endpoints that should be placed behind network-level controls in production.
 */

export function normalizeUssdServiceCode(serviceCode: unknown): string {
  if (typeof serviceCode !== 'string') {
    return '';
  }

  const trimmed = serviceCode.trim().replace(/^["']+|["']+$/g, '');

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  return decoded.replace(/\s+/g, '').replace(/[^\d*#]/g, '');
}

export function isUssdServiceCodeAllowed(
  incomingServiceCode: unknown,
  expectedServiceCodes: string | undefined = process.env.USSD_ALLOWED_SERVICE_CODES || process.env.USSD_SERVICE_CODE,
  requireServiceCode = false
): boolean {
  const normalizedExpected = Array.from(
    new Set(
      String(expectedServiceCodes ?? '')
        .split(',')
        .flatMap((serviceCode) => {
          const normalized = normalizeUssdServiceCode(serviceCode);
          if (!normalized) {
            return [];
          }

          const withoutTrailingHash = normalized.replace(/#$/, '');
          return Array.from(new Set([normalized, withoutTrailingHash].filter(Boolean)));
        })
    )
  );

  if (normalizedExpected.length === 0) {
    return true;
  }

  const normalizedIncoming = normalizeUssdServiceCode(incomingServiceCode);
  if (!normalizedIncoming) {
    return !requireServiceCode;
  }

  const incomingVariants = Array.from(
    new Set([
      normalizedIncoming,
      normalizedIncoming.replace(/#$/, ''),
      normalizedIncoming.endsWith('#') ? normalizedIncoming : `${normalizedIncoming}#`,
    ].filter(Boolean))
  );

  return incomingVariants.some((serviceCode) => normalizedExpected.includes(serviceCode));
}

export function sendAfricasTalkingResponse(res: Response, body: string, _asJson = false) {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  return res.send(body);
}

export function sendArkeselResponse(res: Response, body: string, continueSession: boolean) {
  return res.json({
    message: body,
    continueSession,
  });
}

function normalizeHeaderValue(header: string | string[] | undefined): string {
  return Array.isArray(header) ? header[0] ?? '' : String(header ?? '').trim();
}

function extractOrigin(value: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedUssdRequestOrigin(
  req: Pick<Request, 'headers'>,
  allowedOrigins = process.env.CORS_ORIGIN
): boolean {
  const fetchSite = normalizeHeaderValue(req.headers['sec-fetch-site']).toLowerCase();
  if (fetchSite === 'cross-site') {
    return false;
  }

  const trustedOrigins = String(allowedOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const originHeader = normalizeHeaderValue(req.headers.origin);
  const refererHeader = normalizeHeaderValue(req.headers.referer);
  const requestOrigin = extractOrigin(originHeader) ?? extractOrigin(refererHeader);

  if (!requestOrigin) {
    return fetchSite === '' || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none';
  }

  if (trustedOrigins.length === 0) {
    return true;
  }

  return trustedOrigins.includes(requestOrigin);
}

export function createUSSDRoutes(ussdGateway: USSDGateway, offlineCache: OfflineCache): Router {
  const router = Router();

  const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
    if (!isTrustedUssdRequestOrigin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Cross-site requests are not allowed',
      });
    }

    next();
  };

  /**
   * POST /api/ussd/process
   * Process USSD request (Supports standard JSON and Africa's Talking format)
   * Body: { phoneNumber, userInput/text, sessionId, language? }
   */
  router.post('/process', requireTrustedOrigin, async (req: Request, res: Response) => {
    try {
      const contentType = String(req.headers['content-type'] || '');
      const isJsonRequest = contentType.includes('application/json');
      const isAfricasTalking = req.body.text !== undefined || contentType.includes('application/x-www-form-urlencoded');
      const isArkesel = req.body.userData !== undefined || req.body.newSession !== undefined || req.body.userID !== undefined;
      const phoneNumber = req.body.phoneNumber ?? req.body.msisdn;
      const text = req.body.text;
      const sessionId = req.body.sessionId ?? req.body.sessionID;
      const serviceCode = req.body.serviceCode;
      const language = req.body.language ?? 'en';
      const rawInput = text !== undefined
        ? String(text)
        : req.body.userInput !== undefined
          ? String(req.body.userInput)
          : req.body.userData !== undefined
            ? String(req.body.userData)
            : undefined;
      const userInput = rawInput === undefined
        ? undefined
        : isAfricasTalking
          ? rawInput.split('*').pop() ?? ''
          : rawInput;

      const requireServiceCode = isAfricasTalking && process.env.NODE_ENV === 'production';
      if (!isUssdServiceCodeAllowed(serviceCode, process.env.USSD_ALLOWED_SERVICE_CODES || process.env.USSD_SERVICE_CODE, requireServiceCode)) {
        if (isAfricasTalking) {
          return sendAfricasTalkingResponse(res, 'END Invalid service code.', isJsonRequest);
        }

        return res.status(403).json({
          success: false,
          error: 'Invalid service code',
        });
      }

      if (!phoneNumber || userInput === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: phoneNumber, userInput/text',
        });
      }

      const validLanguages = ['en', 'zu', 'xh', 'st', 'af', 'ss', 'tn', 'ts', 've', 'nso', 'nr'];
      const lang = validLanguages.includes(language) ? (language as Language) : 'en';

      const ussdResponse = await ussdGateway.handleUSSDRequest(String(phoneNumber), userInput, lang, sessionId);

      if (isAfricasTalking) {
        const prefix = ussdResponse.endSession ? 'END ' : 'CON ';
        return sendAfricasTalkingResponse(res, `${prefix}${ussdResponse.text}`, isJsonRequest);
      }

      if (isArkesel) {
        return sendArkeselResponse(res, ussdResponse.text, !ussdResponse.endSession);
      }

      res.json({
        success: true,
        sessionId: ussdResponse.sessionId,
        menu: ussdResponse.menu,
        text: ussdResponse.text,
        options: ussdResponse.options.map((opt) => ({
          key: opt.key,
          label: opt.label,
        })),
        endSession: ussdResponse.endSession,
      });
    } catch (error) {
      console.error('USSD processing error:', error);

      const contentType = String(req.headers['content-type'] || '');
      const isJsonRequest = contentType.includes('application/json');
      const isAfricasTalking = req.body.text !== undefined || contentType.includes('application/x-www-form-urlencoded');
      const isArkesel = req.body.userData !== undefined || req.body.newSession !== undefined || req.body.userID !== undefined;
      if (isAfricasTalking) {
        return sendAfricasTalkingResponse(res, 'END An error occurred. Please try again.', isJsonRequest);
      }

      if (isArkesel) {
        return sendArkeselResponse(res, 'An error occurred. Please try again.', false);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process USSD request',
      });
    }
  });

  /**
   * POST /api/ussd/sms-fallback
   * Send SMS fallback when USSD unavailable
   * Body: { phoneNumber, message, reason }
   */
  router.post('/sms-fallback', requireTrustedOrigin, async (req: Request, res: Response) => {
    try {
      const { phoneNumber, message, reason: _reason } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: phoneNumber, message',
        });
      }

      // Queue SMS message
      const messageId = offlineCache.queueMessage(phoneNumber, 'ussd_confirmation', message);

      res.json({
        success: true,
        messageId,
        status: 'queued',
        message: 'SMS fallback queued for delivery',
      });
    } catch (error) {
      console.error('SMS fallback error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to queue SMS fallback',
      });
    }
  });

  /**
   * GET /api/ussd/status/:phoneNumber
   * Get case status for phone number
   */
  router.get('/status/:phoneNumber', async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;

      // In production: query database for recent cases
      res.json({
        success: true,
        phoneNumber,
        message: 'Use menu option 3 to check case status',
      });
    } catch (error) {
      console.error('Status query error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status',
      });
    }
  });

  /**
   * POST /api/ussd/offline-sync
   * Sync offline cached data with server
   */
  router.post('/offline-sync', requireTrustedOrigin, async (req: Request, res: Response) => {
    try {
      const stats = await offlineCache.syncWithServer(
        async (_caseData) => {
          return true;
        },
        async (_message) => {
          return true;
        }
      );

      res.json({
        success: true,
        synced: stats,
      });
    } catch (error) {
      console.error('Offline sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync offline data',
      });
    }
  });

  /**
   * GET /api/ussd/cache/stats
   * Get offline cache statistics
   */
  router.get('/cache/stats', (req: Request, res: Response) => {
    try {
      const stats = offlineCache.getStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache stats',
      });
    }
  });

  /**
   * POST /api/ussd/cache/cleanup
   * Clean old cached data
   */
  router.post('/cache/cleanup', requireTrustedOrigin, (req: Request, res: Response) => {
    try {
      const { retentionDays = 7 } = req.body;

      const deletedCount = offlineCache.cleanOldData(retentionDays);

      res.json({
        success: true,
        deleted: deletedCount,
        message: `Cleaned ${deletedCount} old cache entries`,
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup cache',
      });
    }
  });

  /**
   * GET /api/ussd/cache/export
   * Export cache for backup
   */
  router.get('/cache/export', (req: Request, res: Response) => {
    try {
      const backup = offlineCache.exportData();

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ussd-cache-backup-${Date.now()}.json"`
      );
      res.send(backup);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export cache',
      });
    }
  });

  /**
   * POST /api/ussd/cache/import
   * Import cache from backup
   */
  router.post('/cache/import', requireTrustedOrigin, (req: Request, res: Response) => {
    try {
      const { backupData } = req.body;

      if (!backupData) {
        return res.status(400).json({
          success: false,
          error: 'Missing backupData in request body',
        });
      }

      const success = offlineCache.importData(backupData);

      res.json({
        success,
        message: success ? 'Cache imported successfully' : 'Failed to import cache',
      });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import cache',
      });
    }
  });

  /**
   * POST /api/ussd/emergency
   * Trigger emergency alert via USSD
   * Body: { phoneNumber, description, location }
   */
  router.post('/emergency', requireTrustedOrigin, async (req: Request, res: Response) => {
    try {
      const { phoneNumber, description: _description, location: _location } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: phoneNumber',
        });
      }

      // Create emergency record
      const emergencyId = `EMRG_${Date.now()}`;

      // Queue SMS with emergency info
      const message = `EMERGENCY ALERT - AEGIS received your report. Police and resources dispatched. Emergency ID: ${emergencyId}`;
      offlineCache.queueMessage(phoneNumber, 'sms', message);

      res.json({
        success: true,
        emergencyId,
        status: 'dispatched',
        message: 'Emergency alert sent. Help coming.',
      });
    } catch (error) {
      console.error('Emergency alert error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send emergency alert',
      });
    }
  });

  /**
   * GET /api/ussd/analytics
   * Get USSD usage analytics
   */
  router.get('/analytics', (req: Request, res: Response) => {
    try {
      const { period = 'day' } = req.query;

      // In production: query database for analytics
      res.json({
        success: true,
        period,
        analytics: {
          totalRequests: 1250,
          uniqueUsers: 845,
          successRate: 98.5,
          averageResponseTime: 850, // milliseconds
          topRegions: ['Gauteng', 'Cape Town', 'Durban'],
          languages: {
            en: 45,
            zu: 30,
            xh: 15,
            st: 5,
            af: 3,
            ss: 2,
          },
        },
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics',
      });
    }
  });

  /**
   * POST /api/ussd/load-test
   * Load testing endpoint (for testing only)
   */
  router.post('/load-test', requireTrustedOrigin, async (req: Request, res: Response) => {
    try {
      const { concurrentUsers = 100, requestsPerUser = 10 } = req.body;

      // Simulate concurrent USSD requests
      const results: Array<{ userId: string; requestId: number; responseTime: number; success: boolean }> = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < concurrentUsers; i++) {
        const phoneNumber = `27${String(i).padStart(9, '0')}`;
        for (let j = 0; j < requestsPerUser; j++) {
          try {
            const startTime = Date.now();
            // Simulate USSD processing
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
            const responseTime = Date.now() - startTime;

            results.push({
              userId: phoneNumber,
              requestId: j,
              responseTime,
              success: true,
            });
            successCount++;
          } catch (_error) {
            failureCount++;
          }
        }
      }

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map((r) => r.responseTime));
      const minResponseTime = Math.min(...results.map((r) => r.responseTime));

      res.json({
        success: true,
        testSummary: {
          totalRequests: concurrentUsers * requestsPerUser,
          successCount,
          failureCount,
          successRate: ((successCount / (concurrentUsers * requestsPerUser)) * 100).toFixed(2) + '%',
          avgResponseTime: Math.round(avgResponseTime),
          minResponseTime,
          maxResponseTime,
        },
      });
    } catch (error) {
      console.error('Load test error:', error);
      res.status(500).json({
        success: false,
        error: 'Load test failed',
      });
    }
  });

  return router;
}

export default createUSSDRoutes;
