-- ============================================================================
-- Voice evidence archive
-- ----------------------------------------------------------------------------
-- Persists survivor voice notes processed by /api/ai/voice-translate so a
-- translated note becomes durable evidence instead of a one-off display:
--   * a private `voice-evidence` storage bucket holds the original audio,
--     namespaced by uploader (<auth.uid>/<file>);
--   * `public.voice_evidence` holds the transcript, detected language,
--     translation, and an optional free-text case reference (cases are
--     referenced by number/id across case_reports / justice_cases / cases,
--     so a hard FK is deliberately avoided);
--   * a generated tsvector column makes transcripts full-text searchable
--     ('simple' config — transcripts span 10+ languages, so no stemming).
--
-- Access model: approved responders (police, ngo, counselor, chw, admin)
-- share the archive read-only; only the uploader can amend the case link,
-- and only the uploader or an admin can delete. Survivors have no access —
-- their own evidence vault (the `evidence` bucket) is separate.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_responder()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_approved_role('police')
    OR public.has_approved_role('ngo')
    OR public.has_approved_role('counselor')
    OR public.has_approved_role('chw')
    OR public.has_approved_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.voice_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_reference TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  original_text TEXT NOT NULL,
  detected_language TEXT,
  translated_text TEXT,
  target_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_tsv TSVECTOR GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      COALESCE(original_text, '') || ' ' ||
      COALESCE(translated_text, '') || ' ' ||
      COALESCE(case_reference, '') || ' ' ||
      COALESCE(file_name, '')
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_voice_evidence_search
  ON public.voice_evidence USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_voice_evidence_created_at
  ON public.voice_evidence (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_evidence_case_reference
  ON public.voice_evidence (case_reference);
CREATE INDEX IF NOT EXISTS idx_voice_evidence_uploaded_by
  ON public.voice_evidence (uploaded_by);

ALTER TABLE public.voice_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_voice_evidence" ON public.voice_evidence;
CREATE POLICY "responders_read_voice_evidence"
  ON public.voice_evidence FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_insert_own_voice_evidence" ON public.voice_evidence;
CREATE POLICY "responders_insert_own_voice_evidence"
  ON public.voice_evidence FOR INSERT
  TO authenticated
  WITH CHECK (public.is_responder() AND uploaded_by = auth.uid());

-- The uploader may amend the case link after the fact; nothing else changes.
DROP POLICY IF EXISTS "uploader_update_own_voice_evidence" ON public.voice_evidence;
CREATE POLICY "uploader_update_own_voice_evidence"
  ON public.voice_evidence FOR UPDATE
  TO authenticated
  USING (public.is_responder() AND uploaded_by = auth.uid())
  WITH CHECK (public.is_responder() AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "uploader_or_admin_delete_voice_evidence" ON public.voice_evidence;
CREATE POLICY "uploader_or_admin_delete_voice_evidence"
  ON public.voice_evidence FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_evidence TO authenticated;

-- ----------------------------------------------------------------------------
-- Private storage bucket for the original audio files.
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-evidence', 'voice-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "voice_evidence_responder_read" ON storage.objects;
CREATE POLICY "voice_evidence_responder_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-evidence' AND public.is_responder());

DROP POLICY IF EXISTS "voice_evidence_responder_insert" ON storage.objects;
CREATE POLICY "voice_evidence_responder_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-evidence'
    AND public.is_responder()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "voice_evidence_owner_or_admin_delete" ON storage.objects;
CREATE POLICY "voice_evidence_owner_or_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );
