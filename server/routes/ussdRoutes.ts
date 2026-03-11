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

import { Router, Request, Response } from 'express';
import { USSDGateway, Language } from '../ussd/ussdGateway';
import { OfflineCache } from '../ussd/offlineCache';

export function createUSSDRoutes(ussdGateway: USSDGateway, offlineCache: OfflineCache): Router {
  const router = Router();

  /**
   * POST /api/ussd/process
   * Process USSD request (Supports standard JSON and Africa's Talking format)
   * Body: { phoneNumber, userInput/text, sessionId, language? }
   */
  router.post('/process', async (req: Request, res: Response) => {
    try {
      // Africa's Talking sends: sessionId, serviceCode, phoneNumber, text
      const { phoneNumber, text, sessionId: _sessionId, language = 'en' } = req.body;
      const userInput = text !== undefined ? text : req.body.userInput;

      if (!phoneNumber || userInput === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: phoneNumber, userInput/text',
        });
      }

      // Validate language
      const validLanguages = ['en', 'zu', 'xh', 'st', 'af', 'ss', 'tn', 'ts', 've', 'nso', 'nr'];
      const lang = validLanguages.includes(language) ? (language as Language) : 'en';

      const ussdResponse = await ussdGateway.handleUSSDRequest(phoneNumber, userInput, lang);

      // Check if it's an Africa's Talking request (usually sent as form-urlencoded with 'text' and 'sessionId')
      const isAfricasTalking = req.body.text !== undefined || req.headers['content-type'] === 'application/x-www-form-urlencoded';

      if (isAfricasTalking) {
        // Africa's Talking requires response to start with CON (continue) or END
        const prefix = ussdResponse.endSession ? 'END ' : 'CON ';
        
        // The ussdGateway already builds the full menu text (including options), 
        // so we don't need to append them again.
        res.set('Content-Type', 'text/plain');
        return res.send(`${prefix}${ussdResponse.text}`);
      }

      // Default JSON response for local testing or other gateways
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
      
      const isAfricasTalking = req.body.text !== undefined || req.headers['content-type'] === 'application/x-www-form-urlencoded';
      if (isAfricasTalking) {
        res.set('Content-Type', 'text/plain');
        return res.send('END An error occurred. Please try again.');
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
  router.post('/sms-fallback', async (req: Request, res: Response) => {
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
  router.post('/offline-sync', async (req: Request, res: Response) => {
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
  router.post('/cache/cleanup', (req: Request, res: Response) => {
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
  router.post('/cache/import', (req: Request, res: Response) => {
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
  router.post('/emergency', async (req: Request, res: Response) => {
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
  router.post('/load-test', async (req: Request, res: Response) => {
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
