-- ============================================================================
-- Evidence Vault metadata (survivor-uploaded, self-service evidence)
-- ----------------------------------------------------------------------------
-- src/components/survivor/EvidenceVault.tsx lets a survivor upload files to the
-- private `evidence` bucket (provisioned in 20260609140000_evidence_storage.sql)
-- and generates a per-file access code. This table is the metadata register for
-- those uploads — it was referenced in the app's TypeScript schema types
-- (src/lib/supabase.ts) but never had a backing migration, so every upload was
-- silently failing and falling back to local-only offline storage.
--
-- `storage_path` matches storage.objects.name in the `evidence` bucket
-- (`<survivor_uid>/<file>`), consistent with evidence_consents (20260614120000).
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evidence_vault (
  id TEXT PRIMARY KEY,
  survivor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  access_code TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_vault_survivor
  ON public.evidence_vault (survivor_id);
CREATE INDEX IF NOT EXISTS idx_evidence_vault_uploaded
  ON public.evidence_vault (uploaded_at DESC);

ALTER TABLE public.evidence_vault ENABLE ROW LEVEL SECURITY;

-- Owner-only: a survivor can only see, insert, and delete their own vault rows.
-- Anonymous (unauthenticated) uploads have no auth.uid() to scope by, so they
-- are intentionally rejected here — the client already falls back to local,
-- offline-queued storage when this insert fails (see EvidenceVault.tsx).
DROP POLICY IF EXISTS "survivor_select_own_evidence_vault" ON public.evidence_vault;
CREATE POLICY "survivor_select_own_evidence_vault"
  ON public.evidence_vault FOR SELECT
  TO authenticated
  USING (survivor_id = auth.uid());

DROP POLICY IF EXISTS "survivor_insert_own_evidence_vault" ON public.evidence_vault;
CREATE POLICY "survivor_insert_own_evidence_vault"
  ON public.evidence_vault FOR INSERT
  TO authenticated
  WITH CHECK (survivor_id = auth.uid());

DROP POLICY IF EXISTS "survivor_delete_own_evidence_vault" ON public.evidence_vault;
CREATE POLICY "survivor_delete_own_evidence_vault"
  ON public.evidence_vault FOR DELETE
  TO authenticated
  USING (survivor_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.evidence_vault TO authenticated;
GRANT ALL ON public.evidence_vault TO service_role;
