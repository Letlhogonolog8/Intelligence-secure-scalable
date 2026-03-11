import { describe, it, expect, vi, beforeEach } from 'vitest';
import { USSDGateway } from '../../../server/ussd/ussdGateway';
import { SupabaseClient } from '@supabase/supabase-js';

type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

describe('USSDGateway', () => {
  let mockSupabase: MockSupabaseClient;
  let gateway: USSDGateway;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    };
    
    // Setting up the mock returns for getOrCreateSession
    mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Not found') });
    mockSupabase.insert.mockResolvedValue({ data: null, error: null });

    gateway = new USSDGateway(mockSupabase as unknown as SupabaseClient);
    
    // Mock the sendTelkomResponse since it makes an external fetch call
    gateway.sendTelkomResponse = vi.fn().mockResolvedValue(true);
  });

  describe('handleUSSDRequest', () => {
    it('should create a new session and return the main menu on first interaction', async () => {
      const response = await gateway.handleUSSDRequest('27821234567', '');
      
      expect(response).toBeDefined();
      expect(response.menu).toBe('main');
      expect(response.text).toContain('AEGIS GBV Support');
      expect(response.endSession).toBe(false);
      
      // Verify session was created
      expect(mockSupabase.from).toHaveBeenCalledWith('ussd_sessions');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should navigate to report incident menu when "1" is pressed', async () => {
      // Mock existing session at main menu
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          session_id: 'session_123',
          phone_number: '27821234567',
          language: 'en',
          current_menu: 'main',
          state: {}
        }
      });
      
      const response = await gateway.handleUSSDRequest('27821234567', '1');
      
      expect(response.menu).toBe('report_details');
      expect(response.text).toContain('Describe incident');
    });

    it('should handle report submission correctly', async () => {
      // Mock existing session at report_details menu
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          session_id: 'session_123',
          phone_number: '27821234567',
          language: 'en',
          current_menu: 'report_details',
          state: {}
        }
      });
      
      const response = await gateway.handleUSSDRequest('27821234567', 'Test incident description');
      
      expect(response.menu).toBe('confirmation');
      expect(response.text).toContain('Case reported');
      expect(response.endSession).toBe(true);
      
      // Verify case was inserted
      expect(mockSupabase.from).toHaveBeenCalledWith('cases');
    });

    it('should handle emergency request correctly', async () => {
      // Mock existing session at menu_2
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          session_id: 'session_123',
          phone_number: '27821234567',
          language: 'en',
          current_menu: 'help_details',
          state: {}
        }
      });
      
      const response = await gateway.handleUSSDRequest('27821234567', '1');
      
      expect(response.menu).toBe('help_confirmation');
      expect(response.text).toContain('Help received');
      expect(response.endSession).toBe(true);
      
      // Verify emergency request was inserted
      expect(mockSupabase.from).toHaveBeenCalledWith('emergency_requests');
    });

    it('should return case status if case exists', async () => {
      // Mock existing session at case_reference
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          session_id: 'session_123',
          phone_number: '27821234567',
          language: 'en',
          current_menu: 'case_reference',
          state: {}
        }
      });
      
      // Mock case query response
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'CASE123',
          status: 'investigating',
          risk_level: 'high',
          updated_at: new Date().toISOString()
        }
      });
      
      const response = await gateway.handleUSSDRequest('27821234567', 'CASE123');
      
      expect(response.menu).toBe('case_status_result');
      expect(response.text).toContain('Case CASE123: investigating (Risk: high)');
      expect(response.endSession).toBe(false);
    });

    it('should return not found if case does not exist', async () => {
      // Mock existing session at case_reference
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          session_id: 'session_123',
          phone_number: '27821234567',
          language: 'en',
          current_menu: 'case_reference',
          state: {}
        }
      });
      
      // Mock case query response (not found)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found')
      });
      
      const response = await gateway.handleUSSDRequest('27821234567', 'INVALID');
      
      expect(response.menu).toBe('case_not_found');
      expect(response.text).toContain('Case not found');
    });
  });

  describe('handleTelkomCallback', () => {
    it('should process webhook payload and call sendTelkomResponse', async () => {
      const payload = {
        subscriber: '27821234567',
        input: '',
        sessionId: 'telkom_session_1',
        language: 'en'
      };
      
      const response = await gateway.handleTelkomCallback(payload);
      
      expect(response).toBeDefined();
      expect(response.menu).toBe('main');
      
      // Verify audit logging
      expect(mockSupabase.from).toHaveBeenCalledWith('ussd_callbacks');
      
      // Verify response sent back
      expect(gateway.sendTelkomResponse).toHaveBeenCalledWith('27821234567', expect.any(String), false);
    });
  });
});
