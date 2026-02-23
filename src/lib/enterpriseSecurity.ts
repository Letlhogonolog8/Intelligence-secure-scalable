/**
 * Enterprise Security Module
 * src/lib/enterpriseSecurity.ts
 * 
 * Comprehensive security hardening for enterprise-grade deployment:
 * - API rate limiting and throttling
 * - DDoS protection mechanisms
 * - Data encryption and key management
 * - Request validation and sanitization
 * - Audit logging
 */

import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/logger";

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  keyGenerator: (context: Record<string, unknown>) => string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isAllowed(context: Record<string, unknown>): boolean {
    const key = this.config.keyGenerator(context);
    const now = Date.now();

    if (!this.store[key]) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.config.windowMs,
      };
      return true;
    }

    const { count, resetTime } = this.store[key];

    if (now > resetTime) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.config.windowMs,
      };
      return true;
    }

    if (count < this.config.maxRequests) {
      this.store[key].count++;
      return true;
    }

    return false;
  }

  getRemainingRequests(context: Record<string, unknown>): number {
    const key = this.config.keyGenerator(context);
    if (!this.store[key]) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - this.store[key].count);
  }

  getResetTime(context: Record<string, unknown>): number {
    const key = this.config.keyGenerator(context);
    if (!this.store[key]) {
      return 0;
    }
    return this.store[key].resetTime;
  }

  cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }
}

// ============================================================================
// DDOS PROTECTION
// ============================================================================

interface DDoSConfig {
  maxRequestsPerIP: number;
  maxRequestsPerSession: number;
  windowMs: number;
  banDurationMs: number;
  ipWhitelist?: string[];
  ipBlacklist?: string[];
}

export class DDoSProtection {
  private ipRequests: Map<string, number[]> = new Map();
  private bannedIPs: Set<string> = new Set();
  private config: DDoSConfig;

  constructor(config: DDoSConfig) {
    this.config = config;
    this.startCleanupInterval();
  }

  isIPBanned(ip: string): boolean {
    return this.bannedIPs.has(ip);
  }

  checkRequest(ip: string): boolean {
    // Check whitelist
    if (this.config.ipWhitelist?.includes(ip)) {
      return true;
    }

    // Check blacklist
    if (this.config.ipBlacklist?.includes(ip)) {
      this.banIP(ip);
      return false;
    }

    // Check if already banned
    if (this.isIPBanned(ip)) {
      return false;
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let requests = this.ipRequests.get(ip) || [];
    requests = requests.filter((time) => time > windowStart);

    if (requests.length >= this.config.maxRequestsPerIP) {
      this.banIP(ip);
      return false;
    }

    requests.push(now);
    this.ipRequests.set(ip, requests);
    return true;
  }

  private banIP(ip: string): void {
    this.bannedIPs.add(ip);
    setTimeout(() => {
      this.bannedIPs.delete(ip);
    }, this.config.banDurationMs);
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      this.ipRequests.forEach((requests, ip) => {
        const filtered = requests.filter((time) => time > windowStart);
        if (filtered.length === 0) {
          this.ipRequests.delete(ip);
        } else {
          this.ipRequests.set(ip, filtered);
        }
      });
    }, 60000); // Cleanup every minute
  }
}

// ============================================================================
// DATA ENCRYPTION
// ============================================================================

export class DataEncryption {
  /**
   * Encrypt sensitive data using SubtleCrypto API
   * Note: For production, use a proper key management system
   */
  static async encryptData(data: string, keyMaterial: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate a key from the key material
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(keyMaterial.padEnd(32).substring(0, 32)),
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt
      const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Return as base64
      return btoa(String.fromCharCode.apply(null, Array.from(combined) as number[]));
    } catch (error) {
      throw new Error(`Encryption failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Decrypt data encrypted with encryptData
   */
  static async decryptData(encryptedData: string, keyMaterial: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const combined = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map((char) => char.charCodeAt(0))
      );

      // Extract IV and data
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      // Generate key
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(keyMaterial.padEnd(32).substring(0, 32)),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${getErrorMessage(error)}`);
    }
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: "success" | "failure";
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export class AuditLogger {
  static async log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    try {
      await supabase.from("audit_logs").insert({
        user_id: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resource_id: entry.resourceId,
        status: entry.status,
        details: entry.details,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Failed to log audit entry: ${getErrorMessage(error)}`);
    }
  }

  static async getLogs(
    userId?: string,
    action?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      let query = supabase.from("audit_logs").select("*");

      if (userId) {
        query = query.eq("user_id", userId);
      }

      if (action) {
        query = query.eq("action", action);
      }

      const { data, error } = await query
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.user_id),
        action: String(row.action),
        resource: String(row.resource),
        resourceId: row.resource_id ? String(row.resource_id) : undefined,
        status: String(row.status) as "success" | "failure",
        details: row.details as Record<string, unknown>,
        ipAddress: String(row.ip_address),
        userAgent: String(row.user_agent),
        timestamp: String(row.timestamp),
      }));
    } catch (error) {
      console.error(`Failed to retrieve audit logs: ${getErrorMessage(error)}`);
      return [];
    }
  }
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

export class RequestValidator {
  /**
   * Validate and sanitize user input
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>"'`]/g, "")
      .trim()
      .substring(0, 1000);
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate object against schema
   */
  static validateSchema(
    obj: Record<string, unknown>,
    schema: Record<string, { type: string; required?: boolean; maxLength?: number }>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    Object.entries(schema).forEach(([field, rules]) => {
      const value = obj[field];

      if (rules.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} is required`);
        return;
      }

      if (value !== undefined && value !== null) {
        if (typeof value !== rules.type) {
          errors.push(`${field} must be a ${rules.type}`);
        }

        if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
          errors.push(`${field} must not exceed ${rules.maxLength} characters`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

export const SECURITY_HEADERS = {
  "Content-Security-Policy": 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://js.supabase.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://jtohnfeqztmiamqmaiod.supabase.co https://js.supabase.com wss:",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
} as const;
