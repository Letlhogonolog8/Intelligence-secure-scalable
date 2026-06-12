-- ============================================================================
-- Cross-device preferred language sync
-- ----------------------------------------------------------------------------
-- Stores the user's preferred UI language on their profile so the web portal
-- and the mobile app pick it up on login, whichever device set it last.
--
-- Writes go through a SECURITY DEFINER RPC rather than a broad UPDATE policy:
-- user_profiles carries privileged columns (role, approval_status) that must
-- stay out of reach of self-service updates.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT;

CREATE OR REPLACE FUNCTION public.set_preferred_language(lang TEXT)
RETURNS VOID AS $$
BEGIN
  IF lang IS NULL OR lang !~ '^[a-z]{2,3}$' THEN
    RAISE EXCEPTION 'invalid language code';
  END IF;

  UPDATE public.user_profiles
  SET preferred_language = lang,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.set_preferred_language(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_preferred_language(TEXT) TO authenticated;
