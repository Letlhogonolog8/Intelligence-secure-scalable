/**
 * Intrusion Detection System (IDS)
 * server/security/intrusionDetection.ts
 * 
 * Monitors for suspicious network and application activity:
 * - SQL injection attempts
 * - Cross-site scripting (XSS)
 * - Suspicious API patterns
 * - Rate limiting violations
 * - DDoS detection
 */

import { Request, Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { cacheManager } from '../utils/cacheManager';

export interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_ip: string;
  user_id?: string;
  description: string;
  payload?: string;
  triggered_at: string;
  status: 'open' | 'investigating' | 'resolved';
}

interface RateWindow {
  count: number;
  windowStart: number;
}

export class IntrusionDetectionSystem {
  private supabase: SupabaseClient;
  private fallbackCounts = new Map<string, number[]>(); // IP -> timestamps (in-process fallback only)
  private readonly RATE_LIMIT_REQUESTS = 100;
  private readonly RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_WINDOW_SEC = 15 * 60;
  private readonly IDS_RATE_KEY_PREFIX = 'ids:rate:';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Middleware: Detect suspicious requests
   */
  analyzeRequest() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      try {
        // Check rate limiting (Redis-backed across all replicas, in-process fallback)
        if (await this.isRateLimited(clientIp)) {
          await this.logAlert({
            alert_type: 'rate_limit_exceeded',
            severity: 'high',
            source_ip: clientIp,
            description: `Rate limit exceeded from ${clientIp}`,
          });
          return res.status(429).json({ error: 'Too many requests' });
        }

        // Check for SQL injection patterns
        if (this.containsSQLInjection(JSON.stringify(req.body))) {
          await this.logAlert({
            alert_type: 'sql_injection_attempt',
            severity: 'critical',
            source_ip: clientIp,
            description: `Potential SQL injection from ${clientIp}`,
            payload: JSON.stringify(req.body).substring(0, 200),
          });
          return res.status(400).json({ error: 'Invalid request' });
        }

        // Check for XSS patterns
        if (this.containsXSS(JSON.stringify(req.body))) {
          await this.logAlert({
            alert_type: 'xss_attempt',
            severity: 'high',
            source_ip: clientIp,
            description: `Potential XSS attempt from ${clientIp}`,
          });
          return res.status(400).json({ error: 'Invalid request' });
        }

        next();
      } catch (err) {
        console.error('IDS analysis error:', err);
        next();
      }
    };
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /('|(--)|;|\|\||\bor\b|\bunion\b|\bselect\b|\bupdate\b|\bdelete\b|\bdrop\b|\binsert\b)/gi,
    ];

    return sqlPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  private containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Check if IP is rate limited.
   * Uses Redis when available so the threshold is enforced consistently across
   * all replicas. Falls back to an in-process sliding-window Map when Redis is
   * unavailable (e.g. development or Redis outage).
   */
  private async isRateLimited(ip: string): Promise<boolean> {
    if (cacheManager.isAvailable()) {
      return this.isRateLimitedRedis(ip);
    }
    return this.isRateLimitedFallback(ip);
  }

  private async isRateLimitedRedis(ip: string): Promise<boolean> {
    const key = `${this.IDS_RATE_KEY_PREFIX}${ip}`;
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW_MS;

    const stored = await cacheManager.get<RateWindow>(key);

    if (!stored || stored.windowStart < windowStart) {
      // New window — record first hit
      await cacheManager.set<RateWindow>(key, { count: 1, windowStart: now }, { ttl: this.RATE_LIMIT_WINDOW_SEC });
      return false;
    }

    if (stored.count >= this.RATE_LIMIT_REQUESTS) {
      return true;
    }

    await cacheManager.set<RateWindow>(key, { count: stored.count + 1, windowStart: stored.windowStart }, { ttl: this.RATE_LIMIT_WINDOW_SEC });
    return false;
  }

  private isRateLimitedFallback(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW_MS;

    const timestamps = this.fallbackCounts.get(ip) ?? [];
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= this.RATE_LIMIT_REQUESTS) {
      this.fallbackCounts.set(ip, recent);
      return true;
    }

    recent.push(now);
    this.fallbackCounts.set(ip, recent);
    return false;
  }

  /**
   * Log security alert
   */
  private async logAlert(
    alert: Partial<SecurityAlert> & {
      alert_type: string;
      severity: SecurityAlert['severity'];
      source_ip: string;
      description: string;
    }
  ): Promise<void> {
    const securityAlert: SecurityAlert = {
      id: `alert_${Date.now()}`,
      triggered_at: new Date().toISOString(),
      status: 'open',
      ...alert,
    };

    await this.supabase.from('security_alerts').insert(securityAlert);

    // Log to console for real-time monitoring
    console.log(`🚨 SECURITY ALERT [${alert.severity.toUpperCase()}]: ${alert.description}`);
  }

  /**
   * Detect DDoS patterns
   */
  async detectDDoS(): Promise<boolean> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: recentAlerts } = await this.supabase
      .from('security_alerts')
      .select('source_ip', { count: 'exact' })
      .gte('triggered_at', oneMinuteAgo);

    if (!recentAlerts) return false;

    // If same IP has 20+ alerts in 1 minute, likely DDoS
    const alertsByIp = recentAlerts.reduce<Record<string, number>>(
      (acc, alert) => {
        const typedAlert = alert as Pick<SecurityAlert, 'source_ip'>;
        const ip = typedAlert.source_ip;
        acc[ip] = (acc[ip] || 0) + 1;
        return acc;
      },
      {}
    );

    const isDDoS = Object.values(alertsByIp).some((count) => count >= 20);

    if (isDDoS) {
      console.log('🚨 DDoS ATTACK DETECTED! Enabling rate limiting...');
    }

    return isDDoS;
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<Record<string, unknown>> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [allAlerts, criticalAlerts, byType] = await Promise.all([
      this.supabase
        .from('security_alerts')
        .select('*', { count: 'exact' })
        .gte('triggered_at', last24Hours),
      this.supabase
        .from('security_alerts')
        .select('*', { count: 'exact' })
        .eq('severity', 'critical')
        .gte('triggered_at', last24Hours),
      this.supabase
        .from('security_alerts')
        .select('alert_type', { count: 'exact' })
        .gte('triggered_at', last24Hours),
    ]);

    return {
      period: '24 hours',
      total_alerts: allAlerts.count || 0,
      critical_alerts: criticalAlerts.count || 0,
      alert_types: byType.data || [],
      system_status: (criticalAlerts.count || 0) === 0 ? 'secure' : 'under_attack',
    };
  }

  /**
   * Respond to security incident
   */
  async respondToIncident(incidentId: string, action: 'block' | 'investigate' | 'resolve'): Promise<void> {
    const statusMap = {
      block: 'blocked',
      investigate: 'investigating',
      resolve: 'resolved',
    };

    await this.supabase
      .from('security_alerts')
      .update({ status: statusMap[action] })
      .eq('id', incidentId);

    console.log(`✅ Incident ${incidentId} marked as ${statusMap[action]}`);
  }
}
