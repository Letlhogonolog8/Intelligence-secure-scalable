CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.survivors
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS survivor_code TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survivors_survivor_code_key'
      AND conrelid = 'public.survivors'::regclass
  ) THEN
    ALTER TABLE public.survivors
      ADD CONSTRAINT survivors_survivor_code_key UNIQUE (survivor_code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.survivor_location_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES public.survivors(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT DEFAULT 'v1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.survivor_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES public.survivors(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL,
  risk_score DECIMAL(5, 2) NOT NULL,
  factors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_survivor_location_records_survivor
  ON public.survivor_location_records(survivor_id);

CREATE INDEX IF NOT EXISTS idx_survivor_risk_profiles_survivor
  ON public.survivor_risk_profiles(survivor_id);
