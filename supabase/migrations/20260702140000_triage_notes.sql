-- ============================================================================
-- Live triage notes (Emergency Queue)
-- ----------------------------------------------------------------------------
-- Shared, persisted triage notes that responders add while working the queue.
-- Readable by all responders; each responder inserts their own. Realtime so a
-- note added by one officer streams to every open queue.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.triage_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triage_notes_created
  ON public.triage_notes(created_at DESC);

ALTER TABLE public.triage_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_triage_notes" ON public.triage_notes;
CREATE POLICY "responders_read_triage_notes"
  ON public.triage_notes FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_insert_own_triage_notes" ON public.triage_notes;
CREATE POLICY "responders_insert_own_triage_notes"
  ON public.triage_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_responder() AND author_id = auth.uid());

GRANT SELECT, INSERT ON public.triage_notes TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'triage_notes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.triage_notes;
    END IF;
  END IF;
END $$;
