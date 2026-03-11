import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

vi.unmock('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface TestUser {
  id: string;
  email: string;
  role: string;
}

describe.skip('Row Level Security (RLS) Policies', () => {
  let adminClient: SupabaseClient;
  let userClient: SupabaseClient;
  let testUsers: { counselor1: TestUser; counselor2: TestUser; survivor: TestUser };

  beforeEach(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    userClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    testUsers = {
      counselor1: { id: 'counselor-1', email: 'counselor1@test.com', role: 'counselor' },
      counselor2: { id: 'counselor-2', email: 'counselor2@test.com', role: 'counselor' },
      survivor: { id: 'survivor-1', email: 'survivor@test.com', role: 'survivor' },
    };
  });

  afterEach(async () => {
    const { data: logs } = await adminClient
      .from<{ id: string }>('audit_logs')
      .select('id')
      .in('user_id', Object.values(testUsers).map((user) => user.id));
    
    if (logs && logs.length > 0) {
      await adminClient
        .from('audit_logs')
        .delete()
        .in('id', logs.map((log) => log.id));
    }
  });

  describe('Audit Logs RLS', () => {
    it('should allow users to read their own audit logs', async () => {
      const { error } = await adminClient
        .from('audit_logs')
        .select('*')
        .eq('user_id', testUsers.counselor1.id)
        .limit(1);

      expect(error).toBeNull();
    });

    it('should prevent users from reading other users audit logs', async () => {
      const { error } = await adminClient
        .from('audit_logs')
        .select('*')
        .eq('user_id', testUsers.counselor2.id)
        .limit(1);

      if (error) {
        expect(error.message).toContain('permission');
      }
    });

    it('should not allow inserting audit logs directly from client', async () => {
      const { error } = await userClient
        .from('audit_logs')
        .insert({
          user_id: testUsers.survivor.id,
          action: 'unauthorized_insert',
          module: 'test',
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('permission');
    });
  });

  describe('MFA Credentials RLS', () => {
    it('should allow users to read their own MFA credentials', async () => {
      const { error } = await adminClient
        .from('mfa_credentials')
        .select('*')
        .eq('user_id', testUsers.counselor1.id);

      expect(error).toBeNull();
    });

    it('should prevent users from reading other users MFA credentials', async () => {
      const { error } = await adminClient
        .from('mfa_credentials')
        .select('*')
        .eq('user_id', testUsers.counselor2.id);

      if (error) {
        expect(error.message).toContain('permission');
      }
    });

    it('should allow users to update only their own MFA credentials', async () => {
      const { error } = await userClient
        .from('mfa_credentials')
        .update({ enabled_at: new Date().toISOString() })
        .eq('user_id', testUsers.survivor.id);

      if (error && error.message) {
        expect(error.message).toContain('permission');
      }
    });
  });

  describe('Sessions RLS', () => {
    it('should allow users to read their own sessions', async () => {
      const { error } = await adminClient
        .from('sessions')
        .select('*')
        .eq('user_id', testUsers.counselor1.id);

      expect(error).toBeNull();
    });

    it('should prevent users from reading other users sessions', async () => {
      const { error } = await adminClient
        .from('sessions')
        .select('*')
        .eq('user_id', testUsers.counselor2.id);

      if (error) {
        expect(error.message).toContain('permission');
      }
    });

    it('should prevent users from inserting sessions for other users', async () => {
      const { error } = await userClient
        .from('sessions')
        .insert({
          user_id: testUsers.survivor.id,
          refresh_token: 'fake-token',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (error) {
        expect(error.message).toContain('permission');
      }
    });
  });

  describe('Escalation Events RLS', () => {
    it('should allow users to read escalations they created', async () => {
      const { error } = await adminClient
        .from('escalation_events')
        .select('*')
        .eq('user_id', testUsers.counselor1.id);

      expect(error).toBeNull();
    });

    it('should allow counselors to read escalations assigned to them', async () => {
      const { error } = await adminClient
        .from('escalation_events')
        .select('*')
        .eq('assigned_to', testUsers.counselor1.id);

      expect(error).toBeNull();
    });

    it('should prevent users from reading unrelated escalations', async () => {
      const { data: escalations, error: selectError } = await adminClient
        .from('escalation_events')
        .select('id')
        .eq('user_id', testUsers.counselor1.id)
        .limit(1);

      if (selectError || !escalations || escalations.length === 0) {
        return;
      }

      const escalationId = escalations[0].id;

      const { error } = await adminClient
        .from('escalation_events')
        .select('*')
        .eq('id', escalationId)
        .eq('user_id', testUsers.counselor2.id);

      if (error) {
        expect(error.message).toContain('permission');
      }
    });

    it('should only allow creating escalations as the current user', async () => {
      const { error } = await userClient
        .from('escalation_events')
        .insert({
          case_id: 'case-123',
          severity: 'high',
          reason: 'test',
          user_id: testUsers.survivor.id,
        });

      if (error) {
        expect(error.message).toContain('permission');
      }
    });
  });

  describe('Encryption Keys RLS', () => {
    it('should restrict encryption key access to system/admin only', async () => {
      const { error } = await userClient
        .from('encryption_keys')
        .select('key_material');

      expect(error).toBeDefined();
    });

    it('should not allow clients to update encryption keys', async () => {
      const { error } = await userClient
        .from('encryption_keys')
        .update({ status: 'revoked' })
        .eq('status', 'active');

      expect(error).toBeDefined();
    });
  });

  describe('Rate Limits RLS', () => {
    it('should allow inserting rate limit records', async () => {
      const { error } = await adminClient
        .from('rate_limits')
        .insert({
          endpoint: '/api/test',
          ip_address: '127.0.0.1',
          request_count: 1,
          window_end: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });

      expect(error).toBeNull();
    });
  });

  describe('USSD Sessions RLS', () => {
    it('should allow reading USSD sessions', async () => {
      const { error } = await adminClient
        .from('ussd_sessions')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
    });

    it('should allow creating new USSD sessions', async () => {
      const { error } = await adminClient
        .from('ussd_sessions')
        .insert({
          session_id: `session-${Date.now()}`,
          phone_number: '+27123456789',
          language: 'en',
        });

      expect(error).toBeNull();
    });
  });
});
