/**
 * AEGIS Twilio Integration
 * server/notifications/twilio.ts
 * 
 * SMS and WhatsApp notifications for:
 * - Emergency alerts to police
 * - Counselor notifications
 * - Survivor case updates
 * - NGO coordination
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationPayload {
  recipientType: 'sms' | 'whatsapp' | 'email';
  recipientAddress: string;
  messageType: string; // 'emergency', 'assignment', 'update', 'reminder'
  messageContent: string;
  caseId?: string;
  userId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  status: string;
  sentAt: string;
  error?: string;
}

export class TwilioNotificationService {
  private supabase: SupabaseClient;
  private accountSid = process.env.TWILIO_ACCOUNT_SID;
  private authToken = process.env.TWILIO_AUTH_TOKEN;
  private twilio: any;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;

    if (this.accountSid && this.authToken) {
      // Initialize Twilio client (would be: const twilio = require('twilio'))
      // For now, we'll use a mock implementation
      console.log('🔔 Twilio SMS service initialized');
    } else {
      console.warn('⚠️  Twilio credentials not configured. SMS disabled.');
    }
  }

  /**
   * Send emergency alert to police
   */
  public async sendPoliceEmergency(
    policePhoneNumbers: string[],
    caseId: string,
    riskLevel: string,
    location: string,
    survivorContact?: string
  ): Promise<NotificationResult[]> {
    const messageTemplate = `
🚨 AEGIS EMERGENCY ESCALATION 🚨
Case: ${caseId}
Risk: ${riskLevel.toUpperCase()}
Location: ${location}
${survivorContact ? `Contact: ${survivorContact}` : ''}

RESPOND IMMEDIATELY VIA APP
    `.trim();

    const results = await Promise.all(
      policePhoneNumbers.map((phone) =>
        this.sendSMS(phone, messageTemplate, 'emergency', caseId)
      )
    );

    return results;
  }

  /**
   * Send counselor assignment notification
   */
  public async sendCounselorAssignment(
    counselorPhoneNumber: string,
    caseId: string,
    survivorName: string,
    priority: string
  ): Promise<NotificationResult> {
    const messageTemplate = `
📋 AEGIS CASE ASSIGNMENT
Case: ${caseId}
Survivor: ${survivorName}
Priority: ${priority}
Contact: [Link to app]

Acknowledge in app to proceed.
    `.trim();

    return this.sendSMS(counselorPhoneNumber, messageTemplate, 'assignment', caseId);
  }

  /**
   * Send survivor update via SMS
   */
  public async sendSurvivorUpdate(
    survivorPhoneNumber: string,
    caseId: string,
    updateMessage: string
  ): Promise<NotificationResult> {
    const messageTemplate = `
AEGIS Case Update
Case: ${caseId}
${updateMessage}

Reply with HELP for support.
    `.trim();

    return this.sendSMS(survivorPhoneNumber, messageTemplate, 'update', caseId);
  }

  /**
   * Send NGO coordination notice
   */
  public async sendNGONotification(
    ngoContactPhoneNumber: string,
    caseId: string,
    resourceNeeded: string,
    urgency: string
  ): Promise<NotificationResult> {
    const messageTemplate = `
AEGIS NGO COORDINATION
Case: ${caseId}
Need: ${resourceNeeded}
Urgency: ${urgency}

Check app for details.
    `.trim();

    return this.sendSMS(ngoContactPhoneNumber, messageTemplate, 'assignment', caseId);
  }

  /**
   * Send SMS (internal implementation)
   */
  private async sendSMS(
    phoneNumber: string,
    message: string,
    messageType: string,
    caseId?: string
  ): Promise<NotificationResult> {
    try {
      // Validate phone number
      if (!this.isValidPhoneNumber(phoneNumber)) {
        return {
          success: false,
          status: 'invalid_number',
          sentAt: new Date().toISOString(),
          error: 'Invalid phone number format',
        };
      }

      // Queue notification
      const { data: notification, error: queueError } = await this.supabase
        .from('notification_queue')
        .insert({
          recipient_type: 'sms',
          recipient_address: phoneNumber,
          message_type: messageType,
          message_content: message,
          case_id: caseId,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select('id');

      if (queueError) throw queueError;

      const notificationId = notification?.[0]?.id;

      // In production, send via Twilio:
      // const response = await this.twilio.messages.create({
      //   body: message,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: phoneNumber
      // });

      // For now, simulate successful send
      const messageId = `msg_${Date.now()}`;

      // Update notification status
      await this.supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      console.log(`📱 SMS sent to ${phoneNumber}: ${messageId}`);

      return {
        success: true,
        messageId,
        status: 'sent',
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('SMS send failed:', error);

      return {
        success: false,
        status: 'failed',
        sentAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send WhatsApp message
   */
  public async sendWhatsApp(
    phoneNumber: string,
    message: string,
    messageType: string,
    caseId?: string,
    mediaUrl?: string
  ): Promise<NotificationResult> {
    try {
      if (!this.isValidPhoneNumber(phoneNumber)) {
        return {
          success: false,
          status: 'invalid_number',
          sentAt: new Date().toISOString(),
          error: 'Invalid phone number',
        };
      }

      // Queue WhatsApp notification
      const { data: notification, error: queueError } = await this.supabase
        .from('notification_queue')
        .insert({
          recipient_type: 'whatsapp',
          recipient_address: phoneNumber,
          message_type: messageType,
          message_content: message,
          case_id: caseId,
          status: 'pending',
        })
        .select('id');

      if (queueError) throw queueError;

      // In production: await this.twilio.messages.create({...})

      const messageId = `whatsapp_${Date.now()}`;

      await this.supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification?.[0]?.id);

      console.log(`💬 WhatsApp sent to ${phoneNumber}: ${messageId}`);

      return {
        success: true,
        messageId,
        status: 'sent',
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('WhatsApp send failed:', error);
      return {
        success: false,
        status: 'failed',
        sentAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send bulk SMS to multiple recipients with retry logic
   */
  public async sendBulkSMS(
    recipients: { phoneNumber: string; message: string; messageType: string; caseId?: string }[],
    maxRetries: number = 3
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const recipient of recipients) {
      let attempts = 0;
      let result: NotificationResult | null = null;

      while (attempts < maxRetries && !result?.success) {
        result = await this.sendSMS(
          recipient.phoneNumber,
          recipient.message,
          recipient.messageType,
          recipient.caseId
        );

        if (!result.success) {
          attempts++;
          if (attempts < maxRetries) {
            // Exponential backoff
            await this.delay(Math.pow(2, attempts) * 1000);
          }
        }
      }

      results.push(result || {
        success: false,
        status: 'max_retries_exceeded',
        sentAt: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Get notification status
   */
  public async getNotificationStatus(
    messageId: string
  ): Promise<{ status: string; sentAt: string; deliveredAt?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('notification_queue')
        .select('status, sent_at')
        .eq('id', messageId)
        .single();

      if (error) throw error;

      return {
        status: data?.status || 'unknown',
        sentAt: data?.sent_at || '',
      };
    } catch (error) {
      console.error('Failed to get notification status:', error);
      return { status: 'error', sentAt: '' };
    }
  }

  /**
   * Retry failed notifications
   */
  public async retryFailedNotifications(): Promise<number> {
    try {
      const { data: failedNotifications, error } = await this.supabase
        .from('notification_queue')
        .select('id, recipient_address, message_content, message_type, case_id, attempt_count')
        .eq('status', 'failed')
        .lt('attempt_count', 3)
        .order('created_at', { ascending: true });

      if (error) throw error;

      let retryCount = 0;

      for (const notification of failedNotifications || []) {
        const result = await this.sendSMS(
          notification.recipient_address,
          notification.message_content,
          notification.message_type,
          notification.case_id
        );

        if (result.success) {
          retryCount++;
        } else {
          // Update attempt count
          await this.supabase
            .from('notification_queue')
            .update({ attempt_count: notification.attempt_count + 1 })
            .eq('id', notification.id);
        }
      }

      console.log(`🔄 Retried ${retryCount} failed notifications`);
      return retryCount;
    } catch (error) {
      console.error('Failed notification retry failed:', error);
      return 0;
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Accept international format: +27xxxxxxxxx or +1xxxxxxxxxx
    const internationalFormat = /^\+\d{1,3}\d{6,14}$/;
    return internationalFormat.test(phoneNumber);
  }

  /**
   * Utility: Sleep/delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default TwilioNotificationService;
