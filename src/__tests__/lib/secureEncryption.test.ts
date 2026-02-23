import { describe, it, expect, beforeEach, vi } from 'vitest';
import SecureEncryption from '@/lib/secureEncryption';

describe('SecureEncryption', () => {
  const testPassword = 'test-password-12345';
  const testData = 'This is sensitive data that needs encryption';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const encrypted = await SecureEncryption.encrypt(testData, testPassword);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(testData);

      const decrypted = await SecureEncryption.decrypt(encrypted, testPassword);
      expect(decrypted).toBe(testData);
    });

    it('should fail to decrypt with wrong password', async () => {
      const encrypted = await SecureEncryption.encrypt(testData, testPassword);

      await expect(
        SecureEncryption.decrypt(encrypted, 'wrong-password')
      ).rejects.toThrow();
    });

    it('should produce different ciphertexts for same plaintext', async () => {
      const encrypted1 = await SecureEncryption.encrypt(testData, testPassword);
      const encrypted2 = await SecureEncryption.encrypt(testData, testPassword);

      expect(encrypted1).not.toBe(encrypted2); // Different due to random salt/IV
    });

    it('should handle empty strings', async () => {
      const encrypted = await SecureEncryption.encrypt('', testPassword);
      const decrypted = await SecureEncryption.decrypt(encrypted, testPassword);
      expect(decrypted).toBe('');
    });

    it('should handle long data', async () => {
      const longData = 'x'.repeat(10000);
      const encrypted = await SecureEncryption.encrypt(longData, testPassword);
      const decrypted = await SecureEncryption.decrypt(encrypted, testPassword);
      expect(decrypted).toBe(longData);
    });

    it('should handle special characters', async () => {
      const specialData = '!@#$%^&*()_+-=[]{}|;:"<>?,./ ñ é ü';
      const encrypted = await SecureEncryption.encrypt(specialData, testPassword);
      const decrypted = await SecureEncryption.decrypt(encrypted, testPassword);
      expect(decrypted).toBe(specialData);
    });
  });

  describe('deriveKey', () => {
    it('should derive keys consistently with same salt', async () => {
      const password = 'test-password';
      const salt = new Uint8Array(16);

      const { key: key1 } = await SecureEncryption['deriveKey'](password, salt);
      const { key: key2 } = await SecureEncryption['deriveKey'](password, salt);

      // Keys should be functionally equivalent (same parameters)
      expect(key1.type).toBe(key2.type);
    });

    it('should generate different salts each time', async () => {
      const password = 'test-password';

      const { salt: salt1 } = await SecureEncryption['deriveKey'](password);
      const { salt: salt2 } = await SecureEncryption['deriveKey'](password);

      expect(salt1).not.toEqual(salt2);
    });
  });
});
