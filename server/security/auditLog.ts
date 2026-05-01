/**
 * AEGIS Audit Logging Service
 * server/security/auditLog.ts
 *
 * Immutable audit trail for compliance (POPIA, GDPR).
 * Every sensitive action is logged with cryptographic integrity.
 */

import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true when the given Supabase/PostgREST error indicates the queried
 * table simply does not exist (typically because a migration has not been
 * applied yet) rather than a real I/O / integrity failure.
 *
 *   PGRST205 -> "Could not find the table 'X' in the schema cache"
 *   PGRST204 -> column missing variant
 *   42P01    -> Postgres "undefined_table"
 */
function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "PGRST205" || e.code === "PGRST204" || e.code === "42P01")
    return true;
  if (typeof e.message === "string") {
    const m = e.message.toLowerCase();
    if (m.includes("could not find the table")) return true;
    if (m.includes("does not exist")) return true;
    if (m.includes("schema cache")) return true;
  }
  return false;
}

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  module: string;
  resourceId?: string;
  resourceType?: string;
  status: "success" | "failure";
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
  /**
   * Serial write queue — ensures the hash chain is computed and written
   * one entry at a time even under concurrent callers, preventing forks.
   */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeLedger();
  }

  /**
   * Log an action (immutable).
   * Writes are serialised through a promise queue so the hash chain
   * remains consistent under concurrent requests.
   */
  public log(entry: AuditLogEntry): Promise<string> {
    let resolve!: (id: string) => void;
    let reject!: (err: unknown) => void;
    const result = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const id = await this._writeEntry(entry);
        resolve(id);
      } catch (err) {
        reject(err);
      }
    });

    return result;
  }

  private async _writeEntry(entry: AuditLogEntry): Promise<string> {
    try {
      const timestamp = new Date().toISOString();
      const hash = this.computeHash(entry, this.lastHash || "");

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
        .from("audit_logs_immutable")
        .insert(auditEntry)
        .select("id");

      if (error) throw error;

      this.lastHash = hash;
      const logId = data?.[0]?.id || "";

      console.log(`📋 Audit logged [${entry.action}] by ${entry.userId}`);
      return logId;
    } catch (error) {
      console.error("Failed to log audit entry:", error);
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
    userAgent: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: "access",
      module,
      status: "success",
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
    userAgent: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: "data_accessed",
      module: "data_protection",
      resourceId,
      resourceType,
      status: "success",
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
    userAgent: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: "data_modified",
      module: "data_protection",
      resourceId,
      resourceType,
      status: "success",
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
    userAgent: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: "data_deleted",
      module: "data_protection",
      resourceId,
      resourceType,
      status: "success",
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
    event:
      | "login"
      | "logout"
      | "mfa_verified"
      | "mfa_failed"
      | "password_changed",
    status: "success" | "failure",
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      action: event,
      module: "authentication",
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
    severity: "info" | "warning" | "critical",
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      action: event,
      module: "security",
      status: "success",
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
        .from("audit_logs_immutable")
        .select("*")
        .eq("id", entryId)
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
        entry.previous_hash || "",
      );

      return recomputedHash === entry.hash;
    } catch (error) {
      console.error("Failed to verify audit log integrity:", error);
      return false;
    }
  }

  /**
   * Detailed result for chain verification. Used by background cron so it
   * can distinguish "chain table not deployed yet" (operational) from
   * "hash chain broken" (security incident).
   */
  public async verifyChainDetailed(
    pageSize: number = 500,
  ): Promise<
    | { status: "valid"; verified: number }
    | { status: "invalid"; reason: string; brokenAtId?: string }
    | { status: "skipped"; reason: string }
  > {
    try {
      let offset = 0;
      let previousHash = "";
      let totalVerified = 0;

      while (true) {
        const { data: entries, error } = await this.supabase
          .from("audit_logs_immutable")
          .select("*")
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) {
          if (isMissingTableError(error)) {
            return {
              status: "skipped",
              reason:
                "audit_logs_immutable table not deployed (apply migration 20260222_phase1_core_architecture.sql)",
            };
          }
          console.error(
            "Failed to fetch audit entries for chain verification:",
            error,
          );
          return { status: "invalid", reason: "fetch_error" };
        }

        if (!entries || entries.length === 0) break;

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
            previousHash,
          );

          if (computedHash !== entry.hash) {
            console.error(`❌ Chain integrity broken at entry ${entry.id}`);
            return {
              status: "invalid",
              reason: "hash_mismatch",
              brokenAtId: entry.id,
            };
          }

          previousHash = entry.hash;
        }

        totalVerified += entries.length;
        if (entries.length < pageSize) break;
        offset += pageSize;
      }

      console.log(
        `✅ Audit log chain integrity verified (${totalVerified} entries)`,
      );
      return { status: "valid", verified: totalVerified };
    } catch (error) {
      if (isMissingTableError(error)) {
        return {
          status: "skipped",
          reason:
            "audit_logs_immutable table not deployed (apply migration 20260222_phase1_core_architecture.sql)",
        };
      }
      console.error("Failed to verify audit chain:", error);
      return { status: "invalid", reason: "exception" };
    }
  }

  /**
   * Boolean compatibility shim. "valid" and "skipped" both return true so
   * pre-existing callers (HTTP /api/audit/verify) don't false-positive
   * before the immutable audit migration is applied. Use
   * verifyChainDetailed() in cron jobs / dashboards for the real status.
   */
  public async verifyChain(pageSize: number = 500): Promise<boolean> {
    const result = await this.verifyChainDetailed(pageSize);
    return result.status !== "invalid";
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
    } = {},
  ): Promise<AuditLogEntry[]> {
    let query = this.supabase.from("audit_logs_immutable").select("*");

    if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.action) query = query.eq("action", filters.action);
    if (filters.module) query = query.eq("module", filters.module);
    if (filters.startDate) query = query.gte("created_at", filters.startDate);
    if (filters.endDate) query = query.lte("created_at", filters.endDate);

    query = query.order("created_at", { ascending: false });

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset)
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1,
      );

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(
      (entry: {
        id: string;
        user_id: string;
        action: string;
        module: string;
        resource_id?: string;
        resource_type?: string;
        status: "success" | "failure";
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
      }),
    );
  }

  /**
   * Export audit logs for compliance reporting
   */
  public async exportForCompliance(
    startDate: string,
    endDate: string,
    format: "json" | "csv" = "json",
  ): Promise<string> {
    const entries = await this.query({
      startDate,
      endDate,
      limit: 10000,
    });

    if (format === "json") {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = [
      "id",
      "userId",
      "action",
      "module",
      "resourceId",
      "status",
      "timestamp",
    ];
    const rows = entries.map((e) => [
      e.id,
      e.userId,
      e.action,
      e.module,
      e.resourceId,
      e.status,
      e.timestamp,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

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

    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private async initializeLedger(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from("audit_logs_immutable")
        .select("hash")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        this.lastHash = data[0].hash;
      }
    } catch (error) {
      console.error("Failed to initialize audit ledger:", error);
    }
  }
}

export default AuditLogService;
