/**
 * AEGIS Multi-Factor Authentication
 * server/security/mfa.ts
 * 
 * Time-based One-Time Password (TOTP) and backup codes for admin/police roles.
 * Implements RFC 6238 TOTP standard.
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

export interface MFASetup {
  userId: string;
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MFAVerification {
  valid: boolean;
  timestamp: Date;
  remainingAttempts?: number;
}

export class MFAService {
  private supabase: SupabaseClient;
  private readonly TOTP_WINDOW = 30; // seconds
  private readonly CODE_LENGTH = 6;
  private readonly BACKUP_CODE_COUNT = 10;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Generate MFA setup for user
   */
  public async generateMFASetup(userId: string, username: string): Promise<MFASetup> {
    const secret = this.generateSecret();
    const backupCodes = this.generateBackupCodes();

    const otpauth = `otpauth://totp/AEGIS:${username}?secret=${secret}&issuer=AEGIS&algorithm=SHA1&digits=6&period=30`;
    const qrCode = await this.generateQRCode(otpauth);

    return {
      userId,
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Enable MFA for user
   */
  public async enableMFA(userId: string, setup: MFASetup, verificationCode: string): Promise<boolean> {
    if (!this.verifyTOTP(setup.secret, verificationCode)) {
      throw new Error('Invalid verification code');
    }

    const hashedSecret = this.hashSecret(setup.secret);
    const hashedBackupCodes = setup.backupCodes.map((code) => this.hashBackupCode(code));

    try {
      const { error } = await this.supabase.from('mfa_credentials').upsert({
        user_id: userId,
        secret: hashedSecret,
        backup_codes: hashedBackupCodes,
        enabled_at: new Date().toISOString(),
        status: 'active',
      });

      if (error) throw error;

      await this.logMFAEvent(userId, 'mfa_enabled');
      console.log(`🔐 MFA enabled for user ${userId}`);

      return true;
    } catch (error) {
      console.error('Failed to enable MFA:', error);
      throw error;
    }
  }

  /**
   * Disable MFA for user
   */
  public async disableMFA(userId: string, password: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('mfa_credentials')
        .update({ status: 'disabled' })
        .eq('user_id', userId);

      if (error) throw error;

      await this.logMFAEvent(userId, 'mfa_disabled');
      console.log(`🔓 MFA disabled for user ${userId}`);

      return true;
    } catch (error) {
      console.error('Failed to disable MFA:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP code
   */
  public verifyTOTP(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const window = 1; // Allow 1 step before/after current time

    for (let i = -window; i <= window; i++) {
      const counter = Math.floor((now + i * this.TOTP_WINDOW) / this.TOTP_WINDOW);
      const computedCode = this.generateHOTP(secret, counter);

      if (computedCode === code) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verify user's MFA code (TOTP or backup)
   */
  public async verifyUserMFA(userId: string, code: string): Promise<MFAVerification> {
    try {
      const { data: mfa, error } = await this.supabase
        .from('mfa_credentials')
        .select('secret, backup_codes')
        .eq('user_id', userId)
        .single();

      if (error || !mfa) {
        return { valid: false, timestamp: new Date() };
      }

      // Try TOTP verification
      if (this.verifyTOTP(mfa.secret, code)) {
        await this.logMFAEvent(userId, 'mfa_verified', { method: 'totp' });
        return { valid: true, timestamp: new Date() };
      }

      // Try backup code verification
      const backupCodeValid = mfa.backup_codes.some((hashedCode: string) =>
        crypto.timingSafeEqual(
          Buffer.from(this.hashBackupCode(code)),
          Buffer.from(hashedCode)
        )
      );

      if (backupCodeValid) {
        // Remove used backup code
        const updatedCodes = mfa.backup_codes.filter(
          (hashedCode: string) =>
            !crypto.timingSafeEqual(
              Buffer.from(this.hashBackupCode(code)),
              Buffer.from(hashedCode)
            )
        );

        await this.supabase
          .from('mfa_credentials')
          .update({ backup_codes: updatedCodes })
          .eq('user_id', userId);

        await this.logMFAEvent(userId, 'mfa_verified', { method: 'backup_code' });
        const remaining = updatedCodes.length;

        if (remaining < 3) {
          console.warn(`⚠️  User ${userId} has only ${remaining} backup codes left`);
        }

        return { valid: true, timestamp: new Date(), remainingAttempts: remaining };
      }

      await this.logMFAEvent(userId, 'mfa_failed', { method: 'invalid' });
      return { valid: false, timestamp: new Date() };
    } catch (error) {
      console.error('MFA verification error:', error);
      return { valid: false, timestamp: new Date() };
    }
  }

  /**
   * Check if user has MFA enabled
   */
  public async isMFAEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('mfa_credentials')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Generate new backup codes
   */
  public async regenerateBackupCodes(userId: string): Promise<string[]> {
    const newCodes = this.generateBackupCodes();
    const hashedCodes = newCodes.map((code) => this.hashBackupCode(code));

    try {
      const { error } = await this.supabase
        .from('mfa_credentials')
        .update({ backup_codes: hashedCodes })
        .eq('user_id', userId);

      if (error) throw error;

      await this.logMFAEvent(userId, 'backup_codes_regenerated');
      console.log(`🔑 Backup codes regenerated for user ${userId}`);

      return newCodes;
    } catch (error) {
      console.error('Failed to regenerate backup codes:', error);
      throw error;
    }
  }

  // Private helper methods

  private generateSecret(): string {
    return crypto.randomBytes(20).toString('base64');
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private generateHOTP(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    for (let i = 7; i >= 0; --i) {
      buffer[i] = counter & 0xff;
      counter = counter >> 8;
    }

    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
    const digest = hmac.update(buffer).digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      (digest[offset] & 0x7f) << 24 |
      (digest[offset + 1] & 0xff) << 16 |
      (digest[offset + 2] & 0xff) << 8 |
      (digest[offset + 3] & 0xff);

    return (code % Math.pow(10, this.CODE_LENGTH)).toString().padStart(this.CODE_LENGTH, '0');
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async generateQRCode(otpauth: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauth);
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw error;
    }
  }

  private async logMFAEvent(userId: string, event: string, metadata?: any): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        user_id: userId,
        action: event,
        module: 'mfa',
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log MFA event:', error);
    }
  }
}

export default MFAService;
