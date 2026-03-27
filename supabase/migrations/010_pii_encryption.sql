-- PII Encryption at Rest
-- supabase/migrations/010_pii_encryption.sql
--
-- Implements transparent encryption/decryption for personally identifiable information
-- Uses pgcrypto extension for AES encryption

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENCRYPTION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION encrypt_text(
  plaintext TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  encrypted_data BYTEA;
  encoded_result TEXT;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Encrypt using AES-256
  encrypted_data := pgcrypto.encrypt(
    plaintext::BYTEA,
    encryption_key::BYTEA,
    'aes'
  );
  
  -- Encode as hex for storage
  encoded_result := encode(encrypted_data, 'hex');
  
  RETURN encoded_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_text(
  ciphertext TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  decrypted_data BYTEA;
  result TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Decode from hex and decrypt
  decrypted_data := pgcrypto.decrypt(
    decode(ciphertext, 'hex'),
    encryption_key::BYTEA,
    'aes'
  );
  
  -- Convert back to text
  result := convert(decrypted_data, 'UTF8');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- ============================================================================
-- ADD ENCRYPTED COLUMNS TO TABLES
-- ============================================================================

-- Alter user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS full_name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS alternate_email_encrypted TEXT;

-- Alter survivors table
ALTER TABLE survivors
ADD COLUMN IF NOT EXISTS legal_name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS contact_phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_encrypted TEXT;

-- Alter chat_messages table
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS encrypted_content TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INT DEFAULT 2;

-- ============================================================================
-- MIGRATION: ENCRYPT EXISTING DATA (Example - Uncomment as needed)
-- ============================================================================
-- WARNING: This must be done carefully with proper key management
-- The encryption key should be stored in environment variables

-- Example migration (commented out - must be run manually with proper key):
/*
DO $$ 
DECLARE
  encryption_key TEXT := current_setting('app.encryption_key');
BEGIN
  -- Encrypt user_profiles data
  UPDATE user_profiles
  SET full_name_encrypted = encrypt_text(full_name, encryption_key)
  WHERE full_name IS NOT NULL AND full_name_encrypted IS NULL;

  UPDATE user_profiles
  SET phone_encrypted = encrypt_text(phone, encryption_key)
  WHERE phone IS NOT NULL AND phone_encrypted IS NULL;

  -- Encrypt survivors data
  UPDATE survivors
  SET legal_name_encrypted = encrypt_text(legal_name, encryption_key)
  WHERE legal_name IS NOT NULL AND legal_name_encrypted IS NULL;

  UPDATE survivors
  SET contact_phone_encrypted = encrypt_text(contact_phone, encryption_key)
  WHERE contact_phone IS NOT NULL AND contact_phone_encrypted IS NULL;
END $$;
*/

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC ENCRYPTION
-- ============================================================================

CREATE OR REPLACE FUNCTION encrypt_user_profile_pii()
RETURNS TRIGGER AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from environment (set in application)
  encryption_key := COALESCE(
    current_setting('app.encryption_key', TRUE),
    current_setting('app.default_key', TRUE),
    'default-dev-key'
  );
  
  -- Encrypt new/modified PII before storing
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name_encrypted := encrypt_text(NEW.full_name, encryption_key);
  END IF;
  
  IF NEW.phone IS NOT NULL THEN
    NEW.phone_encrypted := encrypt_text(NEW.phone, encryption_key);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS encrypt_user_profile_pii_trigger ON user_profiles;
CREATE TRIGGER encrypt_user_profile_pii_trigger
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION encrypt_user_profile_pii();

-- Trigger for survivors table
CREATE OR REPLACE FUNCTION encrypt_survivor_pii()
RETURNS TRIGGER AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := COALESCE(
    current_setting('app.encryption_key', TRUE),
    current_setting('app.default_key', TRUE),
    'default-dev-key'
  );
  
  IF NEW.legal_name IS NOT NULL THEN
    NEW.legal_name_encrypted := encrypt_text(NEW.legal_name, encryption_key);
  END IF;
  
  IF NEW.contact_phone IS NOT NULL THEN
    NEW.contact_phone_encrypted := encrypt_text(NEW.contact_phone, encryption_key);
  END IF;
  
  IF NEW.emergency_contact IS NOT NULL THEN
    NEW.emergency_contact_encrypted := encrypt_text(NEW.emergency_contact, encryption_key);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS encrypt_survivor_pii_trigger ON survivors;
CREATE TRIGGER encrypt_survivor_pii_trigger
BEFORE INSERT OR UPDATE ON survivors
FOR EACH ROW
EXECUTE FUNCTION encrypt_survivor_pii();

-- ============================================================================
-- VIEWS FOR TRANSPARENT DECRYPTION
-- ============================================================================

CREATE OR REPLACE VIEW user_profiles_decrypted
WITH (security_invoker = true) AS
SELECT
  id,
  organization_id,
  role,
  -- Decrypt PII on read (consider performance for large tables)
  CASE 
    WHEN full_name_encrypted IS NOT NULL 
    THEN decrypt_text(full_name_encrypted, COALESCE(current_setting('app.encryption_key', TRUE), current_setting('app.default_key', TRUE), 'default-dev-key'))
    ELSE NULL
  END as full_name,
  CASE 
    WHEN phone_encrypted IS NOT NULL 
    THEN decrypt_text(phone_encrypted, COALESCE(current_setting('app.encryption_key', TRUE), current_setting('app.default_key', TRUE), 'default-dev-key'))
    ELSE NULL
  END as phone,
  is_active,
  created_at,
  updated_at
FROM user_profiles;

-- ============================================================================
-- INDEXES FOR ENCRYPTED COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_encrypted 
ON user_profiles (full_name_encrypted);

CREATE INDEX IF NOT EXISTS idx_survivors_legal_name_encrypted 
ON survivors (legal_name_encrypted);

CREATE INDEX IF NOT EXISTS idx_chat_messages_encryption_version 
ON chat_messages (encryption_version);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION encrypt_text TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_text TO service_role;
GRANT EXECUTE ON FUNCTION encrypt_user_profile_pii TO service_role;
GRANT EXECUTE ON FUNCTION encrypt_survivor_pii TO service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION encrypt_text IS 
'Encrypts text using AES-256. Encryption key should be managed securely.';

COMMENT ON FUNCTION decrypt_text IS 
'Decrypts text encrypted with encrypt_text. Key must match encryption key.';

COMMENT ON COLUMN user_profiles.full_name_encrypted IS 
'Encrypted full name. Do not query directly - use user_profiles_decrypted view.';

COMMENT ON COLUMN survivors.legal_name_encrypted IS 
'Encrypted legal name. Do not query directly - use application decryption.';
