-- ============================================================================
-- Evidence Vault storage bucket
-- ----------------------------------------------------------------------------
-- A private bucket where a survivor can store photos/documents tied to their
-- case. Files are namespaced by user id (evidence/<auth.uid>/<file>), and RLS on
-- storage.objects restricts every operation to the owning user's own folder.
--
-- Idempotent: safe to re-run.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-scoped access: the first path segment must equal the user's id.
DROP POLICY IF EXISTS "evidence_owner_read" ON storage.objects;
CREATE POLICY "evidence_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "evidence_owner_insert" ON storage.objects;
CREATE POLICY "evidence_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "evidence_owner_delete" ON storage.objects;
CREATE POLICY "evidence_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
