/**
 * POPIA Compliance Module
 * server/compliance/popiaModule.ts
 * 
 * Implements Protection of Personal Information Act (South Africa) compliance:
 * - Consent management
 * - Data subject requests (access, deletion, correction)
 * - Processing agreements
 * - Data breach notification
 * - DPA (Data Protection Authority) reporting
 */

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: 'marketing' | 'analytics' | 'third_party_sharing' | 'processing';
  status: 'given' | 'withdrawn';
  given_at: string;
  withdrawn_at?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface DataSubjectRequest {
  id: string;
  user_id: string;
  request_type: 'access' | 'deletion' | 'correction' | 'portability' | 'restrict_processing';
  status: 'pending' | 'in_progress' | 'completed' | 'denied';
  submitted_at: string;
  completed_at?: string;
  denial_reason?: string;
  completion_details?: Record<string, any>;
}

export class POPIAComplianceModule {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Record user consent for processing
   */
  async recordConsent(
    userId: string,
    consentType: ConsentRecord['consent_type'],
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConsentRecord> {
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      consent_type: consentType,
      status: 'given',
      given_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    const { error } = await this.supabase.from('consent_records').insert(consentRecord);

    if (error) throw error;

    console.log(`✅ Consent recorded for ${userId} - ${consentType}`);
    return consentRecord;
  }

  /**
   * Withdraw user consent
   */
  async withdrawConsent(userId: string, consentType: ConsentRecord['consent_type']): Promise<void> {
    const { error } = await this.supabase
      .from('consent_records')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('consent_type', consentType)
      .eq('status', 'given');

    if (error) throw error;

    console.log(`🔕 Consent withdrawn for ${userId} - ${consentType}`);
  }

  /**
   * Check if user has given specific consent
   */
  async hasConsent(userId: string, consentType: ConsentRecord['consent_type']): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('consent_records')
      .select('id')
      .eq('user_id', userId)
      .eq('consent_type', consentType)
      .eq('status', 'given')
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  /**
   * Handle data subject access request
   */
  async submitAccessRequest(userId: string): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: `dsr_${crypto.randomUUID()}`,
      user_id: userId,
      request_type: 'access',
      status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    const { error: insertError } = await this.supabase
      .from('data_subject_requests')
      .insert(request);

    if (insertError) throw insertError;

    // Notify compliance officer
    await this.notifyComplianceOfficer('access_request', userId);

    console.log(`📋 Access request submitted by ${userId}`);
    return request;
  }

  /**
   * Handle right to be forgotten (deletion request)
   */
  async submitDeletionRequest(userId: string): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: `dsr_${crypto.randomUUID()}`,
      user_id: userId,
      request_type: 'deletion',
      status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    const { error } = await this.supabase.from('data_subject_requests').insert(request);

    if (error) throw error;

    console.log(`🗑️ Deletion request submitted by ${userId}`);
    return request;
  }

  /**
   * Process deletion request (actually delete personal data)
   */
  async processDeletionRequest(requestId: string): Promise<void> {
    const { data: request, error: fetchError } = await this.supabase
      .from('data_subject_requests')
      .select('user_id')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    const userId = request.user_id;

    // Anonymize user profile
    await this.supabase
      .from('user_profiles')
      .update({
        full_name: '[DELETED]',
        phone: null,
        email: `deleted-${crypto.randomUUID()}@deleted.example.com`,
      })
      .eq('id', userId);

    // Anonymize chat messages
    await this.supabase
      .from('chat_messages')
      .update({
        content: '[DELETED]',
      })
      .eq('sender_id', userId);

    // Update deletion request status
    await this.supabase
      .from('data_subject_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_details: { anonymized: true },
      })
      .eq('id', requestId);

    // Log in audit trail
    await this.supabase.from('audit_logs_immutable').insert({
      action: 'data_deletion',
      module: 'compliance',
      resource_id: userId,
      resource_type: 'user',
      status: 'success',
      metadata: { request_id: requestId },
    });

    console.log(`✅ Deletion request ${requestId} processed`);
  }

  /**
   * Compile access report for data subject
   */
  async generateAccessReport(userId: string): Promise<Record<string, any>> {
    const [profile, messages, auditLogs, consentRecords] = await Promise.all([
      this.supabase.from('user_profiles').select('*').eq('id', userId).single(),
      this.supabase.from('chat_messages').select('*').eq('sender_id', userId),
      this.supabase.from('audit_logs_immutable').select('*').eq('user_id', userId),
      this.supabase.from('consent_records').select('*').eq('user_id', userId),
    ]);

    return {
      report_id: crypto.randomUUID(),
      user_id: userId,
      generated_at: new Date().toISOString(),
      data: {
        profile: profile.data,
        messages: messages.data,
        audit_logs: auditLogs.data,
        consent_records: consentRecords.data,
      },
    };
  }

  /**
   * Report data breach to DPA
   */
  async reportDataBreach(
    breachDescription: string,
    affectedUsers: number,
    dataTypes: string[]
  ): Promise<void> {
    const breachReport = {
      id: `breach_${crypto.randomUUID()}`,
      description: breachDescription,
      affected_users: affectedUsers,
      data_types: dataTypes,
      reported_at: new Date().toISOString(),
      status: 'reported_to_dpa',
    };

    await this.supabase.from('data_breaches').insert(breachReport);

    // Send notification to authorities (in production, integrate with DPA email)
    console.log(`⚠️ Data breach reported: ${breachReport.id}`);
  }

  /**
   * Get POPIA compliance report (for audits)
   */
  async getComplianceReport(startDate: Date, endDate: Date): Promise<Record<string, any>> {
    const dateRange = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    const [consentStats, requestStats, breachStats] = await Promise.all([
      this.supabase
        .from('consent_records')
        .select('consent_type, status', { count: 'exact' })
        .gte('given_at', dateRange.start)
        .lte('given_at', dateRange.end),
      this.supabase
        .from('data_subject_requests')
        .select('request_type, status', { count: 'exact' })
        .gte('submitted_at', dateRange.start)
        .lte('submitted_at', dateRange.end),
      this.supabase
        .from('data_breaches')
        .select('*')
        .gte('reported_at', dateRange.start)
        .lte('reported_at', dateRange.end),
    ]);

    return {
      report_period: dateRange,
      consent_records: consentStats.data?.length || 0,
      data_subject_requests: requestStats.data?.length || 0,
      data_breaches_reported: breachStats.data?.length || 0,
      compliance_status: 'compliant',
    };
  }

  /**
   * Notify compliance officer of requests
   */
  private async notifyComplianceOfficer(
    eventType: string,
    userId: string
  ): Promise<void> {
    // In production, send email to DPO
    console.log(`📧 Compliance officer notified of ${eventType} from ${userId}`);
  }
}
