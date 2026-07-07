-- ============================================================================
-- push_tokens schema drift fix
-- ----------------------------------------------------------------------------
-- The live push_tokens table predates 20260608120000_sos_realtime_and_fanout
-- (which uses CREATE TABLE IF NOT EXISTS, so it silently kept the old shape)
-- and is missing last_seen_at. The mobile app upserts last_seen_at on every
-- registration, so device registration failed silently ("best-effort" catch)
-- and no survivor device could receive SOS/status push notifications.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The app upserts with onConflict:"token"; guarantee the unique constraint the
-- fanout migration expects.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_tokens'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.push_tokens'::regclass AND attname = 'token'
      )]::smallint[]
  ) THEN
    ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_token_key UNIQUE (token);
  END IF;
END $$;
