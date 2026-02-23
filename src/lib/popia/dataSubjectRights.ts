/**
 * POPIA Principle 8: Data Subject Rights Manager
 * src/lib/popia/dataSubjectRights.ts
 *
 * Implements survivor rights:
 * - Right to access personal information
 * - Right to correct inaccuracies
 * - Right to object to processing
 * - Right to be forgotten (erasure)
 * - Right to data portability
 */

import { createClient } from '@supabase/supabase-js';

export interface DataExport {
  survivor: Record<string, unknown>;
  chatSessions: unknown[];
  chatMessages: unknown[];
  exportedAt: Date;
  format: 'json' | 'csv';
}

export interface CorrectionRequest {
  id: string;
  survivor_id: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  requested_at: Date;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export interface ErasureRequest {
  id: string;
  survivor_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  reason: string;
  requested_at: Date;
  processed_at?: Date;
}

export class DataSubjectRightsManager {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY
  );

  /**
   * Grant survivor access to their data (Right to Access)
   */
  async grantDataAccess(survivorId: string): Promise<DataExport> {
    try {
      const survivor = await this.supabase
        .from('survivors')
        .select('*')
        .eq('id', survivorId)
        .single();

      const chatSessions = await this.supabase
        .from('survivor_chat_sessions')
        .select('*')
        .eq('survivor_id', survivorId);

      const chatMessages = await this.supabase
        .from('chat_messages')
        .select('*')
        .in('session_id', chatSessions.data?.map((s) => s.id) || []);

      const dataExport: DataExport = {
        survivor: survivor.data,
        chatSessions: chatSessions.data || [],
        chatMessages: chatMessages.data || [],
        exportedAt: new Date(),
        format: 'json',
      };

      await this.logAccessRequest(survivorId);
      return dataExport;
    } catch (error) {
      throw new Error(`Failed to export data for survivor: ${survivorId}`);
    }
  }

  /**
   * Handle data correction request (Right to Correction)
   */
  async requestDataCorrection(
    survivorId: string,
    field: string,
    newValue: unknown
  ): Promise<CorrectionRequest> {
    try {
      const oldValue = await this.getFieldValue(survivorId, field);

      const request = await this.supabase
        .from('data_correction_requests')
        .insert({
          survivor_id: survivorId,
          field,
          old_value: oldValue,
          new_value: newValue,
          requested_at: new Date().toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      await this.logAccessRequest(survivorId, 'correction_request');
      return request.data as CorrectionRequest;
    } catch (error) {
      throw new Error('Failed to create correction request');
    }
  }

  /**
   * Approve and execute correction request
   */
  async approveCorrectionRequest(requestId: string): Promise<void> {
    try {
      const request = await this.supabase
        .from('data_correction_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!request.data) {
        throw new Error('Correction request not found');
      }

      const correctionData = request.data as CorrectionRequest;

      await this.supabase
        .from('survivors')
        .update({
          [correctionData.field]: correctionData.new_value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', correctionData.survivor_id);

      await this.supabase
        .from('data_correction_requests')
        .update({ status: 'completed' })
        .eq('id', requestId);

      await this.logAccessRequest(
        correctionData.survivor_id,
        'correction_approved'
      );
    } catch (error) {
      throw new Error('Failed to approve correction request');
    }
  }

  /**
   * Handle right to be forgotten (Right to Erasure)
   */
  async requestErasure(survivorId: string, reason: string): Promise<ErasureRequest> {
    try {
      const request = await this.supabase
        .from('data_deletion_requests')
        .insert({
          survivor_id: survivorId,
          status: 'pending',
          reason,
          requested_at: new Date().toISOString(),
        })
        .select()
        .single();

      await this.logAccessRequest(survivorId, 'erasure_requested', reason);
      return request.data as ErasureRequest;
    } catch (error) {
      throw new Error('Failed to create erasure request');
    }
  }

  /**
   * Execute verified erasure request (anonymize instead of delete for audit trail)
   */
  async executeErasure(requestId: string): Promise<void> {
    try {
      const request = await this.supabase
        .from('data_deletion_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!request.data) {
        throw new Error('Erasure request not found');
      }

      const erasureData = request.data as ErasureRequest;

      if (erasureData.status !== 'approved') {
        throw new Error('Erasure request not approved');
      }

      const survivorId = erasureData.survivor_id;
      const anonId = `anon_${crypto.randomUUID()}`;

      await this.supabase
        .from('survivors')
        .update({
          user_id: null,
          anonymous_id: anonId,
          date_of_birth: null,
          region: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', survivorId);

      const sessions = await this.supabase
        .from('survivor_chat_sessions')
        .select('id')
        .eq('survivor_id', survivorId);

      if (sessions.data && sessions.data.length > 0) {
        await this.supabase
          .from('chat_messages')
          .update({
            content: '[DELETED_PER_POPIA]',
            emotion_detected: null,
          })
          .in('session_id', sessions.data.map((s) => s.id));
      }

      await this.supabase
        .from('data_deletion_requests')
        .update({
          status: 'executed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      await this.logAccessRequest(survivorId, 'erasure_executed');
    } catch (error) {
      throw new Error('Failed to execute erasure request');
    }
  }

  /**
   * Export data in portable format (Right to Data Portability)
   */
  async exportDataPortability(
    survivorId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const dataExport = await this.grantDataAccess(survivorId);

      if (format === 'json') {
        return JSON.stringify(dataExport, null, 2);
      } else {
        return this.convertToCSV(dataExport);
      }
    } catch (error) {
      throw new Error('Failed to export portable data');
    }
  }

  /**
   * Get field value from survivor record
   */
  private async getFieldValue(
    survivorId: string,
    field: string
  ): Promise<unknown> {
    try {
      const result = await this.supabase
        .from('survivors')
        .select(field)
        .eq('id', survivorId)
        .single();

      return result.data?.[field];
    } catch {
      return null;
    }
  }

  /**
   * Convert export to CSV format
   */
  private convertToCSV(dataExport: DataExport): string {
    const rows: string[] = [];

    rows.push('SURVIVOR DATA EXPORT');
    rows.push('');
    rows.push('SURVIVOR PROFILE');
    rows.push(...this.objectToCSV(dataExport.survivor));

    if (dataExport.chatSessions.length > 0) {
      rows.push('');
      rows.push('CHAT SESSIONS');
      dataExport.chatSessions.forEach((session) => {
        rows.push(...this.objectToCSV(session));
      });
    }

    if (dataExport.chatMessages.length > 0) {
      rows.push('');
      rows.push('CHAT MESSAGES');
      dataExport.chatMessages.forEach((message) => {
        rows.push(...this.objectToCSV(message));
      });
    }

    return rows.join('\n');
  }

  /**
   * Convert object to CSV rows
   */
  private objectToCSV(obj: unknown): string[] {
    if (typeof obj !== 'object' || obj === null) {
      return [];
    }

    const rows: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      rows.push(`"${key}","${String(value).replace(/"/g, '""')}"`);
    }
    return rows;
  }

  /**
   * Log data subject request to audit trail
   */
  private async logAccessRequest(
    survivorId: string,
    requestType: string,
    details?: unknown
  ): Promise<void> {
    const user = await this.supabase.auth.getUser();

    await this.supabase.from('audit_log').insert({
      table_name: 'data_subject_requests',
      operation: requestType.toUpperCase(),
      record_id: survivorId,
      changed_fields: { type: requestType, details },
      changed_by: user.data.user?.id,
      changed_at: new Date().toISOString(),
    });
  }
}

export const dataSubjectRightsManager = new DataSubjectRightsManager();
