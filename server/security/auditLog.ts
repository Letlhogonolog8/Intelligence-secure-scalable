/**
 * AEGIS Audit Logging Service
 * server/security/auditLog.ts
 * 
 * Immutable audit trail for compliance (POPIA, GDPR).
 * Every sensitive action is logged with cryptographic integrity.
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  module: string;
  resourceId?: string;
  resourceType?: string;
  status: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  hash?: string;
  previousHash?: string;
}

export class AuditLogService {
  private supabase: SupabaseClient;
  private lastHash: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeLedger();
  }

  /**
   * Log an action (immutable)
   */
  public async log(entry: AuditLogEntry): Promise<string> {
    try {
      const timestamp = new Date().toISOString();
      const hash = this.computeHash(entry, this.lastHash || '');

      const auditEntry = {
        user_id: entry.userId,
        action: entry.action,
        module: entry.module,
        resource_id: entry.resourceId,
        resource_type: entry.resourceType,
        status: entry.status,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        metadata: entry.metadata,
        created_at: timestamp,
        hash,
        previous_hash: this.lastHash,
      };

      const { data, error } = await this.supabase
        .from('audit_logs_immutable')
        .insert(auditEntry)
        .select('id');

      if (error) throw error;

      this.lastHash = hash;
      const logId = data?.[0]?.id || '';

      console.log(`📋 Audit logged [${entry.action}] by ${entry.userId}`);
      return logId;
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      throw error;
    }
  }

  /**
   * Log user access
   */
  public async logAccess(
    userId: string,
    module: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'access',
      module,
      status: 'success',
      ipAddress,
      userAgent,
      metadata: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log data access (POPIA compliance)
   */
  public async logDataAccess(
    userId: string,
    resourceId: string,
    resourceType: string,
    fields: string[],
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'data_accessed',
      module: 'data_protection',
      resourceId,
      resourceType,
      status: 'success',
      ipAddress,
      userAgent,
      metadata: { fields, accessedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log data modification
   */
  public async logDataModification(
    userId: string,
    resourceId: string,
    resourceType: string,
    changes: Record<string, unknown>,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'data_modified',
      module: 'data_protection',
      resourceId,
      resourceType,
      status: 'success',
      ipAddress,
      userAgent,
      metadata: { changes, modifiedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log data deletion (POPIA right to be forgotten)
   */
  public async logDataDeletion(
    userId: string,
    resourceId: string,
    resourceType: string,
    reason: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'data_deleted',
      module: 'data_protection',
      resourceId,
      resourceType,
      status: 'success',
      ipAddress,
      userAgent,
      metadata: { reason, deletedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log authentication events
   */
  public async logAuthenticationEvent(
    userId: string,
    event: 'login' | 'logout' | 'mfa_verified' | 'mfa_failed' | 'password_changed',
    status: 'success' | 'failure',
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action: event,
      module: 'authentication',
      status,
      ipAddress,
      userAgent,
      metadata: { event, ...metadata },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log security events
   */
  public async logSecurityEvent(
    userId: string,
    event: string,
    severity: 'info' | 'warning' | 'critical',
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action: event,
      module: 'security',
      status: 'success',
      ipAddress,
      userAgent,
      metadata: { severity, ...metadata },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Verify audit log integrity
   */
  public async verifyIntegrity(entryId: string): Promise<boolean> {
    try {
      const { data: entry, error } = await this.supabase
        .from('audit_logs_immutable')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error || !entry) {
        return false;
      }

      // Recompute hash
      const recomputedHash = this.computeHash(
        {
          userId: entry.user_id,
          action: entry.action,
          module: entry.module,
          resourceId: entry.resource_id,
          resourceType: entry.resource_type,
          status: entry.status,
          ipAddress: entry.ip_address,
          userAgent: entry.user_agent,
          metadata: entry.metadata,
          timestamp: entry.created_at,
        },
        entry.previous_hash || ''
      );

      return recomputedHash === entry.hash;
    } catch (error) {
      console.error('Failed to verify audit log integrity:', error);
      return false;
    }
  }

  /**
   * Verify full chain integrity
   */
  public async verifyChain(): Promise<boolean> {
    try {
      const { data: entries, error } = await this.supabase
        .from('audit_logs_immutable')
        .select('*')
        .order('created_at', { ascending: true });

      if (error || !entries) {
        return false;
      }

      let previousHash = '';
      for (const entry of entries) {
        const computedHash = this.computeHash(
          {
            userId: entry.user_id,
            action: entry.action,
            module: entry.module,
            resourceId: entry.resource_id,
            resourceType: entry.resource_type,
            status: entry.status,
            ipAddress: entry.ip_address,
            userAgent: entry.user_agent,
            metadata: entry.metadata,
            timestamp: entry.created_at,
          },
          previousHash
        );

        if (computedHash !== entry.hash) {
          console.error(`❌ Chain integrity broken at entry ${entry.id}`);
          return false;
        }

        previousHash = entry.hash;
      }

      console.log(`✅ Audit log chain integrity verified (${entries.length} entries)`);
      return true;
    } catch (error) {
      console.error('Failed to verify audit chain:', error);
      return false;
    }
  }

  /**
   * Query audit logs with filters
   */
  public async query(
    filters: {
      userId?: string;
      action?: string;
      module?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    let query = this.supabase.from('audit_logs_immutable').select('*');

    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.module) query = query.eq('module', filters.module);
    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate) query = query.lte('created_at', filters.endDate);

    query = query.order('created_at', { ascending: false });

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((entry: {
      id: string;
      user_id: string;
      action: string;
      module: string;
      resource_id?: string;
      resource_type?: string;
      status: 'success' | 'failure';
      ip_address: string;
      user_agent: string;
      metadata?: Record<string, unknown>;
      created_at: string;
      hash?: string;
      previous_hash?: string;
    }) => ({
      id: entry.id,
      userId: entry.user_id,
      action: entry.action,
      module: entry.module,
      resourceId: entry.resource_id,
      resourceType: entry.resource_type,
      status: entry.status,
      ipAddress: entry.ip_address,
      userAgent: entry.user_agent,
      metadata: entry.metadata,
      timestamp: entry.created_at,
      hash: entry.hash,
      previousHash: entry.previous_hash,
    }));
  }

  /**
   * Export audit logs for compliance reporting
   */
  public async exportForCompliance(
    startDate: string,
    endDate: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const entries = await this.query({
      startDate,
      endDate,
      limit: 10000,
    });

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = ['id', 'userId', 'action', 'module', 'resourceId', 'status', 'timestamp'];
    const rows = entries.map((e) => [e.id, e.userId, e.action, e.module, e.resourceId, e.status, e.timestamp]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }

  // Private methods

  private computeHash(entry: AuditLogEntry, previousHash: string): string {
    const data = JSON.stringify({
      userId: entry.userId,
      action: entry.action,
      module: entry.module,
      resourceId: entry.resourceId,
      resourceType: entry.resourceType,
      status: entry.status,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata,
      timestamp: entry.timestamp,
      previousHash,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async initializeLedger(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('audit_logs_immutable')
        .select('hash')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        this.lastHash = data[0].hash;
      }
    } catch (error) {
      console.error('Failed to initialize audit ledger:', error);
    }
  }
}

export default AuditLogService;
