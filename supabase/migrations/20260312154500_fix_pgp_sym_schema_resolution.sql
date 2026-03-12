CREATE OR REPLACE FUNCTION encrypt_text(
  plaintext TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  encrypted_data BYTEA;
  encryption_options TEXT := 'cipher-algo=aes256,compress-algo=0';
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  IF to_regprocedure('extensions.pgp_sym_encrypt(text,text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT extensions.pgp_sym_encrypt($1, $2, $3)' INTO encrypted_data
    USING plaintext, encryption_key, encryption_options;
  ELSIF to_regprocedure('extensions.pgp_sym_encrypt(text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT extensions.pgp_sym_encrypt($1, $2)' INTO encrypted_data
    USING plaintext, encryption_key;
  ELSIF to_regprocedure('public.pgp_sym_encrypt(text,text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.pgp_sym_encrypt($1, $2, $3)' INTO encrypted_data
    USING plaintext, encryption_key, encryption_options;
  ELSIF to_regprocedure('public.pgp_sym_encrypt(text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.pgp_sym_encrypt($1, $2)' INTO encrypted_data
    USING plaintext, encryption_key;
  ELSE
    encrypted_data := pgp_sym_encrypt(plaintext, encryption_key, encryption_options);
  END IF;

  RETURN encode(encrypted_data, 'base64');
END;
$$ LANGUAGE plpgsql SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION decrypt_text(
  ciphertext TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  decoded_data BYTEA;
  decrypted_text TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    decoded_data := decode(ciphertext, 'base64');
  EXCEPTION
    WHEN OTHERS THEN
      decoded_data := decode(ciphertext, 'hex');
  END;

  IF to_regprocedure('extensions.pgp_sym_decrypt(bytea,text)') IS NOT NULL THEN
    EXECUTE 'SELECT extensions.pgp_sym_decrypt($1, $2)' INTO decrypted_text
    USING decoded_data, encryption_key;
  ELSIF to_regprocedure('public.pgp_sym_decrypt(bytea,text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.pgp_sym_decrypt($1, $2)' INTO decrypted_text
    USING decoded_data, encryption_key;
  ELSE
    decrypted_text := pgp_sym_decrypt(decoded_data, encryption_key);
  END IF;

  RETURN decrypted_text;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, extensions;
