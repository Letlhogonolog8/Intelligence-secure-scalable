-- ============================================================================
-- Responder settings (portal preferences)
-- ----------------------------------------------------------------------------
-- Per-user notification toggles and availability for responder portals. One
-- row per user, managed only by that user. Language preference continues to
-- live on user_profiles.preferred_language via set_preferred_language.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.responder_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  critical_push BOOLEAN NOT NULL DEFAULT TRUE,
  case_assignment_push BOOLEAN NOT NULL DEFAULT TRUE,
  audit_visibility BOOLEAN NOT NULL DEFAULT TRUE,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.responder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responder_settings_select_own" ON public.responder_settings;
CREATE POLICY "responder_settings_select_own"
  ON public.responder_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "responder_settings_insert_own" ON public.responder_settings;
CREATE POLICY "responder_settings_insert_own"
  ON public.responder_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "responder_settings_update_own" ON public.responder_settings;
CREATE POLICY "responder_settings_update_own"
  ON public.responder_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.responder_settings TO authenticated;
