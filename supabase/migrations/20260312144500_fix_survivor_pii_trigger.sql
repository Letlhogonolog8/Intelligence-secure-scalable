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

  IF NEW.full_name IS NOT NULL THEN
    NEW.legal_name_encrypted := encrypt_text(NEW.full_name, encryption_key);
  END IF;

  IF NEW.phone_number IS NOT NULL THEN
    NEW.contact_phone_encrypted := encrypt_text(NEW.phone_number, encryption_key);
  END IF;

  IF NEW.emergency_contact IS NOT NULL THEN
    NEW.emergency_contact_encrypted := encrypt_text(NEW.emergency_contact, encryption_key);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
