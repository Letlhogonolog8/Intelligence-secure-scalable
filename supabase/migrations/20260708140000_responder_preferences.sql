-- ============================================================================
-- responder_settings.preferences — free-form per-user portal preferences
-- ----------------------------------------------------------------------------
-- The counselor portal's Settings page has richer toggles (email/SMS/push
-- notifications, translation support, high-contrast, session defaults) than
-- the fixed columns responder_settings was created with for the police
-- portal. Store them in a JSONB blob so each portal can persist its own
-- preference set without a schema change per toggle. RLS remains own-row
-- (policies from 20260701160000).
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.responder_settings
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
