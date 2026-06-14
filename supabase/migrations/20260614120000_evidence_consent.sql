-- ============================================================================
-- Survivor consent workflow: sharing evidence-vault items with the case team
-- ----------------------------------------------------------------------------
-- The `evidence` bucket is owner-scoped — only the survivor can read their own
-- files. This adds an explicit, revocable consent so a survivor can choose to
-- share specific vault items with their case team (approved responders).
--
-- Privacy by design / informed consent:
--   * consent is PER FILE and opt-in (nothing is shared by default);
--   * the survivor can revoke at any time (revoked_at), which immediately
--     removes responder read access — the file is never copied or moved;
--   * an audit row persists across revoke/re-share for accountability.
--
-- `evidence_consents.storage_path` is the full object name in the `evidence`
-- bucket (`<survivor_uid>/<file>`), matching storage.objects.name.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evidence_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  note TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (survivor_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_evidence_consents_active
  ON public.evidence_consents (granted_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_consents_survivor
  ON public.evidence_consents (survivor_id);

ALTER TABLE public.evidence_consents ENABLE ROW LEVEL SECURITY;

-- Survivor owns their consent records outright.
DROP POLICY IF EXISTS "survivor_select_own_consents" ON public.evidence_consents;
CREATE POLICY "survivor_select_own_consents"
  ON public.evidence_consents FOR SELECT
  TO authenticated
  USING (survivor_id = auth.uid());

DROP POLICY IF EXISTS "survivor_insert_own_consents" ON public.evidence_consents;
CREATE POLICY "survivor_insert_own_consents"
  ON public.evidence_consents FOR INSERT
  TO authenticated
  WITH CHECK (survivor_id = auth.uid());

DROP POLICY IF EXISTS "survivor_update_own_consents" ON public.evidence_consents;
CREATE POLICY "survivor_update_own_consents"
  ON public.evidence_consents FOR UPDATE
  TO authenticated
  USING (survivor_id = auth.uid())
  WITH CHECK (survivor_id = auth.uid());

DROP POLICY IF EXISTS "survivor_delete_own_consents" ON public.evidence_consents;
CREATE POLICY "survivor_delete_own_consents"
  ON public.evidence_consents FOR DELETE
  TO authenticated
  USING (survivor_id = auth.uid());

-- Approved responders can see ACTIVE consents (the shared-evidence inbox).
DROP POLICY IF EXISTS "responders_read_active_consents" ON public.evidence_consents;
CREATE POLICY "responders_read_active_consents"
  ON public.evidence_consents FOR SELECT
  TO authenticated
  USING (public.is_responder() AND revoked_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_consents TO authenticated;

-- ----------------------------------------------------------------------------
-- Storage grant: responders may read an `evidence` object only while an active
-- consent exists for it. SECURITY DEFINER avoids RLS recursion into
-- evidence_consents from the storage policy.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evidence_is_shared(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.evidence_consents
    WHERE storage_path = object_name
      AND revoked_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.evidence_is_shared(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evidence_is_shared(TEXT) TO authenticated;

-- The owner-read policy from 20260609140000 stays; RLS policies are OR-ed, so
-- this adds responder read for consented files without touching survivor access.
DROP POLICY IF EXISTS "evidence_consented_responder_read" ON storage.objects;
CREATE POLICY "evidence_consented_responder_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence'
    AND public.is_responder()
    AND public.evidence_is_shared(name)
  );

-- ----------------------------------------------------------------------------
-- Realtime so the responder shared-evidence inbox updates the moment a
-- survivor shares or revoke (same pattern as 20260609120000).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence_consents' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'ALTER TABLE public.evidence_consents REPLICA IDENTITY FULL';
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'evidence_consents'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.evidence_consents';
    END IF;
  END IF;
END
$$;
