/**
 * AEGIS Encryption Module
 * server/security/encryption.ts
 * 
 * AES-256-GCM encryption for sensitive data at rest and in transit.
 * Implements key rotation and secure key management.
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: string;
}

export interface KeyInfo {
  id: string;
  key: Buffer;
  createdAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'rotated' | 'revoked';
}

export class EncryptionService {
  private supabase: SupabaseClient;
  private activeKey: KeyInfo;
  private keyCache: Map<string, KeyInfo> = new Map();
  private algorithm = 'aes-256-gcm';

  constructor(supabase: SupabaseClient, masterKey?: Buffer) {
    this.supabase = supabase;

    if (!masterKey && !process.env.ENCRYPTION_KEY) {
      throw new Error('Encryption key required. Set ENCRYPTION_KEY environment variable.');
    }

    const keyBuffer = masterKey || Buffer.from(process.env.ENCRYPTION_KEY!.trim(), 'hex');

    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes for AES-256');
    }

    this.activeKey = {
      id: 'primary',
      key: keyBuffer,
      createdAt: new Date(),
      status: 'active',
    };
  }

  /**
   * Encrypt sensitive data
   */
  public encrypt(plaintext: string | Record<string, unknown>): EncryptedData {
    const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.algorithm, this.activeKey.key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as crypto.CipherGCM).getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
    };
  }

  /**
   * Decrypt sensitive data
   */
  public decrypt(encryptedData: EncryptedData, keyId: string = 'primary'): string {
    const key = this.keyCache.get(keyId) || this.activeKey;

    if (!key) {
      throw new Error(`Encryption key ${keyId} not found`);
    }

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key.key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Decrypt and parse JSON
   */
  public decryptJSON<T>(encryptedData: EncryptedData, keyId?: string): T {
    const decrypted = this.decrypt(encryptedData, keyId);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Hash sensitive data for comparison using HMAC-SHA256 with the active key.
   * Keyed hash prevents rainbow-table attacks on leaked values.
   * An optional per-value salt can be prepended for additional uniqueness.
   */
  public hash(data: string, salt?: string): string {
    const payload = salt ? `${salt}:${data}` : data;
    return crypto
      .createHmac('sha256', this.activeKey.key)
      .update(payload)
      .digest('hex');
  }

  /**
   * Generate secure random token
   */
  public generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Rotate encryption key
   */
  public async rotateKey(): Promise<KeyInfo> {
    const newKey = crypto.randomBytes(32);
    const newKeyInfo: KeyInfo = {
      id: `key-${Date.now()}`,
      key: newKey,
      createdAt: new Date(),
      status: 'active',
    };

    try {
      await this.supabase.from('encryption_keys').insert({
        key_id: newKeyInfo.id,
        algorithm: this.algorithm,
        created_at: newKeyInfo.createdAt,
        status: 'active',
      });

      this.activeKey.rotatedAt = new Date();
      this.activeKey.status = 'rotated';
      this.keyCache.set(newKeyInfo.id, newKeyInfo);
      this.activeKey = newKeyInfo;

      console.log(`🔑 Encryption key rotated: ${newKeyInfo.id}`);
      return newKeyInfo;
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Load key by ID (for decrypting old data)
   */
  public async loadKey(keyId: string): Promise<KeyInfo> {
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    const { data, error } = await this.supabase
      .from('encryption_keys')
      .select('key_id, key_material, created_at, rotated_at, status')
      .eq('key_id', keyId)
      .single();

    if (error || !data) {
      throw new Error(`Encryption key ${keyId} not found`);
    }

    if (!data.key_material) {
      throw new Error(`Encryption key material for ${keyId} is missing`);
    }

    const keyInfo: KeyInfo = {
      id: data.key_id,
      key: Buffer.from(data.key_material, 'hex'),
      createdAt: new Date(data.created_at),
      rotatedAt: data.rotated_at ? new Date(data.rotated_at) : undefined,
      status: data.status,
    };

    if (keyInfo.key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes for AES-256');
    }

    this.keyCache.set(keyId, keyInfo);
    return keyInfo;
  }

  /**
   * Verify data integrity with HMAC
   */
  public generateHMAC(data: string): string {
    return crypto
      .createHmac('sha256', this.activeKey.key)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  public verifyHMAC(data: string, signature: string): boolean {
    const computed = this.generateHMAC(data);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }
}

export default EncryptionService;
