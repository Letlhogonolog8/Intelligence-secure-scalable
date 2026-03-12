CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION encrypt_text(
  plaintext TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  encrypted_data BYTEA;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  encrypted_data := pgp_sym_encrypt(
    plaintext,
    encryption_key,
    'cipher-algo=aes256,compress-algo=0'
  );

  RETURN encode(encrypted_data, 'base64');
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_text(
  ciphertext TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  decoded_data BYTEA;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    decoded_data := decode(ciphertext, 'base64');
    RETURN pgp_sym_decrypt(decoded_data, encryption_key);
  EXCEPTION
    WHEN OTHERS THEN
      decoded_data := decode(ciphertext, 'hex');
      RETURN pgp_sym_decrypt(decoded_data, encryption_key);
  END;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
