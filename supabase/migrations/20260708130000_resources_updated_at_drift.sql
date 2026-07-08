-- ============================================================================
-- resources.updated_at drift fix
-- ----------------------------------------------------------------------------
-- The live resources table predates the repo schema and lacks updated_at
-- (001_create_aegis_schema.sql expects it and even attaches an
-- update_resources_updated_at trigger). fetchLiveResources selects the
-- column, PostgREST returned 42703, the error was swallowed as a
-- missing-table condition, and every live resources panel silently rendered
-- empty/sample data.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_resources_updated_at'
      AND tgrelid = 'public.resources'::regclass
  ) THEN
    CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
