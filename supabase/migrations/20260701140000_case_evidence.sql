-- ============================================================================
-- Case evidence register (responder-uploaded evidence)
-- ----------------------------------------------------------------------------
-- Responders attach evidence (photos, documents, audio, video) to a case from
-- the portals. Files live in the private `case-evidence` bucket (namespaced by
-- uploader); metadata lives in public.case_evidence. Complements survivor-
-- shared evidence (evidence_consents) and the voice archive (voice_evidence).
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.case_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  evidence_type TEXT,
  note TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_evidence_created
  ON public.case_evidence(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_evidence_case
  ON public.case_evidence(case_reference);

ALTER TABLE public.case_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_case_evidence" ON public.case_evidence;
CREATE POLICY "responders_read_case_evidence"
  ON public.case_evidence FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_insert_own_case_evidence" ON public.case_evidence;
CREATE POLICY "responders_insert_own_case_evidence"
  ON public.case_evidence FOR INSERT
  TO authenticated
  WITH CHECK (public.is_responder() AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "uploader_update_case_evidence" ON public.case_evidence;
CREATE POLICY "uploader_update_case_evidence"
  ON public.case_evidence FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "uploader_or_admin_delete_case_evidence" ON public.case_evidence;
CREATE POLICY "uploader_or_admin_delete_case_evidence"
  ON public.case_evidence FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_evidence TO authenticated;

-- Private bucket for the evidence files themselves.
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-evidence', 'case-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "case_evidence_responder_read" ON storage.objects;
CREATE POLICY "case_evidence_responder_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'case-evidence' AND public.is_responder());

DROP POLICY IF EXISTS "case_evidence_responder_insert" ON storage.objects;
CREATE POLICY "case_evidence_responder_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'case-evidence'
    AND public.is_responder()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "case_evidence_owner_or_admin_delete" ON storage.objects;
CREATE POLICY "case_evidence_owner_or_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'case-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- Realtime so a new upload appears on every responder's Evidence register.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'case_evidence'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.case_evidence;
    END IF;
  END IF;
END $$;
