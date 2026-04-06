/**
 * Enhanced Encryption Module with PBKDF2 Key Derivation
 * src/lib/secureEncryption.ts
 * 
 * Replaces weak padding-based key derivation with industry-standard PBKDF2.
 * Uses AES-256-GCM for authenticated encryption.
 */

export interface EncryptionResult {
  ciphertext: string;
  salt: string;
}

export class SecureEncryption {
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly PBKDF2_DIGEST = 'SHA-256';
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;

  /**
   * Derive a cryptographic key from a password using PBKDF2
   * @param password - User password or key material
   * @param salt - Optional salt (generated if not provided)
   * @returns Object with derived key and salt
   */
  static async deriveKey(
    password: string,
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    const normalizedSalt = salt
      ? Uint8Array.from(salt)
      : crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: this.PBKDF2_DIGEST,
        salt: normalizedSalt,
        iterations: this.PBKDF2_ITERATIONS,
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return { key, salt: normalizedSalt };
  }

  /**
   * Encrypt plaintext using AES-256-GCM with PBKDF2-derived key
   * @param plaintext - Data to encrypt
   * @param password - Encryption password
   * @returns Base64-encoded result containing salt + IV + ciphertext
   */
  static async encrypt(plaintext: string, password: string): Promise<string> {
    try {
      const { key, salt } = await this.deriveKey(password);
      const encoder = new TextEncoder();
      const plaintextData = encoder.encode(plaintext);

      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintextData
      );

      const combined = new Uint8Array(
        salt.length + iv.length + encryptedData.byteLength
      );
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

      return this.toBase64(combined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Encryption failed: ${message}`);
    }
  }

  /**
   * Decrypt ciphertext encrypted with SecureEncryption.encrypt()
   * @param encryptedBase64 - Base64-encoded encrypted data
   * @param password - Decryption password
   * @returns Decrypted plaintext
   */
  static async decrypt(encryptedBase64: string, password: string): Promise<string> {
    try {
      const combined = this.fromBase64(encryptedBase64);

      if (combined.length < this.SALT_LENGTH + this.IV_LENGTH) {
        throw new Error('Invalid encrypted data format');
      }

      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const encryptedData = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);

      const { key } = await this.deriveKey(password, salt);

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Decryption failed: ${message}`);
    }
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private static toBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private static fromBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

export default SecureEncryption;
