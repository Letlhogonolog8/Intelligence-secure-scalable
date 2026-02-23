/**
 * Session Anomaly Detection Engine
 * server/security/sessionAnomalyDetector.ts
 * 
 * Detects suspicious login patterns and session anomalies:
 * - Impossible travel (geographic distance violations)
 * - Unusual time patterns
 * - Device fingerprint changes
 * - Suspicious IP addresses
 * - Brute force attempts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface SessionFingerprint {
  user_id: string;
  session_id: string;
  ip_address: string;
  user_agent: string;
  device_fingerprint: string;
  latitude?: number;
  longitude?: number;
  country: string;
  login_time: string;
  is_suspicious: boolean;
  anomaly_reason?: string;
}

export class SessionAnomalyDetector {
  private supabase: SupabaseClient;
  private readonly IMPOSSIBLE_TRAVEL_SPEED_KMH = 900; // Faster than commercial flight
  private readonly LOGIN_HISTORY_DAYS = 30;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Register new session and check for anomalies
   */
  async analyzeNewSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    latitude?: number,
    longitude?: number,
    country?: string
  ): Promise<SessionFingerprint> {
    const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
    const sessionId = `session_${Date.now()}`;

    // Get previous sessions for comparison
    const { data: previousSessions } = await this.supabase
      .from('session_fingerprints')
      .select('*')
      .eq('user_id', userId)
      .order('login_time', { ascending: false })
      .limit(10);

    let isSuspicious = false;
    let anomalyReason: string | undefined;

    if (previousSessions && previousSessions.length > 0) {
      const lastSession = previousSessions[0];

      // Check for impossible travel
      if (latitude && longitude && lastSession.latitude && lastSession.longitude) {
        const distance = this.calculateDistance(
          lastSession.latitude,
          lastSession.longitude,
          latitude,
          longitude
        );
        const timeDiffMinutes = this.getMinutesDifference(lastSession.login_time);

        if (this.isImpossibleTravel(distance, timeDiffMinutes)) {
          isSuspicious = true;
          anomalyReason = `Impossible travel: ${distance}km in ${timeDiffMinutes}min`;
        }
      }

      // Check for unusual time pattern
      if (!isSuspicious && this.isUnusualTimePattern(previousSessions, new Date())) {
        isSuspicious = true;
        anomalyReason = 'Unusual login time detected';
      }

      // Check for device fingerprint change
      if (!isSuspicious && deviceFingerprint !== lastSession.device_fingerprint) {
        isSuspicious = true;
        anomalyReason = 'Device fingerprint mismatch';
      }

      // Check for IP address change (if country changed dramatically)
      if (!isSuspicious && lastSession.country && country && lastSession.country !== country) {
        isSuspicious = true;
        anomalyReason = `Location changed: ${lastSession.country} → ${country}`;
      }
    }

    const fingerprint: SessionFingerprint = {
      user_id: userId,
      session_id: sessionId,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_fingerprint: deviceFingerprint,
      latitude,
      longitude,
      country: country || 'Unknown',
      login_time: new Date().toISOString(),
      is_suspicious: isSuspicious,
      anomaly_reason: anomalyReason,
    };

    // Store session
    await this.supabase.from('session_fingerprints').insert(fingerprint);

    // If suspicious, log alert
    if (isSuspicious) {
      await this.logSuspiciousActivity(userId, anomalyReason || 'Unknown');
    }

    return fingerprint;
  }

  /**
   * Detect brute force login attempts
   */
  async checkBruteForce(userId: string): Promise<{ isBruteForce: boolean; attempts: number }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: failedAttempts, error } = await this.supabase
      .from('failed_login_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('attempted_at', fiveMinutesAgo);

    if (error) throw error;

    const attempts = failedAttempts?.length || 0;
    const isBruteForce = attempts >= 5; // 5+ failures in 5 minutes

    if (isBruteForce) {
      // Lock account temporarily
      await this.temporarilyLockAccount(userId, 15); // 15 minute lock
      await this.logSuspiciousActivity(userId, `Brute force attempt (${attempts} failed logins)`);
    }

    return { isBruteForce, attempts };
  }

  /**
   * Track failed login attempt
   */
  async logFailedLogin(userId: string, ipAddress: string, reason: string): Promise<void> {
    await this.supabase.from('failed_login_attempts').insert({
      user_id: userId,
      ip_address: ipAddress,
      reason,
      attempted_at: new Date().toISOString(),
    });
  }

  /**
   * Verify user identity for suspicious session
   */
  async requireAdditionalVerification(userId: string, sessionId: string): Promise<void> {
    await this.supabase
      .from('sessions')
      .update({ mfa_required: true, verified: false })
      .eq('id', sessionId)
      .eq('user_id', userId);

    // Notify user
    console.log(`🔐 Additional verification required for user ${userId}`);
  }

  /**
   * Helper: Calculate distance between two coordinates (Haversine)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Helper: Check if travel speed is impossible
   */
  private isImpossibleTravel(distanceKm: number, minutesElapsed: number): boolean {
    const speedKmH = (distanceKm / minutesElapsed) * 60;
    return speedKmH > this.IMPOSSIBLE_TRAVEL_SPEED_KMH;
  }

  /**
   * Helper: Check for unusual time pattern
   */
  private isUnusualTimePattern(previousSessions: any[], newLoginTime: Date): boolean {
    if (previousSessions.length < 5) return false;

    // Calculate average login hour
    const hours = previousSessions.map((s) => new Date(s.login_time).getHours());
    const avgHour = hours.reduce((a, b) => a + b) / hours.length;
    const newHour = newLoginTime.getHours();

    // Flag if login is >4 hours outside typical pattern
    const hourDifference = Math.abs(newHour - avgHour);
    return hourDifference > 4;
  }

  /**
   * Helper: Generate device fingerprint
   */
  private generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}:${ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Helper: Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Helper: Get minutes difference from last session
   */
  private getMinutesDifference(lastLoginTime: string): number {
    const lastLogin = new Date(lastLoginTime);
    const now = new Date();
    return Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60));
  }

  /**
   * Helper: Log suspicious activity
   */
  private async logSuspiciousActivity(userId: string, reason: string): Promise<void> {
    await this.supabase.from('security_alerts').insert({
      user_id: userId,
      alert_type: 'anomalous_session',
      severity: 'high',
      description: reason,
      triggered_at: new Date().toISOString(),
      status: 'open',
    });
  }

  /**
   * Helper: Temporarily lock account
   */
  private async temporarilyLockAccount(userId: string, minutesToLock: number): Promise<void> {
    const unlockTime = new Date(Date.now() + minutesToLock * 60 * 1000);
    await this.supabase
      .from('user_profiles')
      .update({ account_locked_until: unlockTime.toISOString() })
      .eq('id', userId);
  }
}
