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

  encrypted_data := encrypt(
    plaintext::BYTEA,
    encryption_key::BYTEA,
    'aes'
  );

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

  decrypted_data := decrypt(
    decode(ciphertext, 'hex'),
    encryption_key::BYTEA,
    'aes'
  );

  result := convert(decrypted_data, 'UTF8');

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;
