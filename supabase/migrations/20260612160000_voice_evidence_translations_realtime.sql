-- ============================================================================
-- Global language engine: per-stakeholder voice evidence translations
-- ----------------------------------------------------------------------------
-- A survivor records once; every stakeholder reads/hears the note in their own
-- language. Translations are cached per (evidence, language) so each language
-- is generated once and then shared by everyone who prefers it. The original
-- transcript and audio on public.voice_evidence are never modified, preserving
-- evidential integrity.
--
-- Also enables Supabase Realtime for the archive tables so responder
-- dashboards update the moment a note or translation is saved — no refresh.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voice_evidence_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES public.voice_evidence(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  translated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evidence_id, language)
);

CREATE INDEX IF NOT EXISTS idx_voice_evidence_translations_evidence
  ON public.voice_evidence_translations (evidence_id);

ALTER TABLE public.voice_evidence_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_voice_evidence_translations"
  ON public.voice_evidence_translations;
CREATE POLICY "responders_read_voice_evidence_translations"
  ON public.voice_evidence_translations FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_insert_voice_evidence_translations"
  ON public.voice_evidence_translations;
CREATE POLICY "responders_insert_voice_evidence_translations"
  ON public.voice_evidence_translations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_responder()
    AND (translated_by IS NULL OR translated_by = auth.uid())
  );

-- Translations are immutable once cached (no UPDATE policy); they disappear
-- with their evidence via ON DELETE CASCADE, and an admin can prune directly.
DROP POLICY IF EXISTS "admin_delete_voice_evidence_translations"
  ON public.voice_evidence_translations;
CREATE POLICY "admin_delete_voice_evidence_translations"
  ON public.voice_evidence_translations FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, DELETE ON public.voice_evidence_translations TO authenticated;

-- ----------------------------------------------------------------------------
-- Realtime for the archive (same pattern as 20260609120000).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  candidate_tables TEXT[] := ARRAY['voice_evidence', 'voice_evidence_translations'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY candidate_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END
$$;
