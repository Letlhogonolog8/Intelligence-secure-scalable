-- ============================================================================
-- Multi-agency coordination center: complete the handoff table + write access
-- ----------------------------------------------------------------------------
-- The live organization_coordination table is a stub (id, referral_type,
-- status, created_at, updated_at) — the original full-schema migration was
-- marked applied during history repair but never actually ran here, so the
-- from/to organisation, case, notes and completed_at columns are missing.
-- The earlier 20260614170000 RLS migration consequently skipped (columns not
-- found). This migration backfills the columns and (re)creates the full RLS:
--   * SELECT  — a party org (sender/receiver) or an admin;
--   * INSERT  — a responder referring a case FROM their own organisation;
--   * UPDATE  — either party advancing the status.
--
-- case_id is TEXT (holds a justice_cases id, case number, or community
-- reference) to stay flexible across the platform's several case identifiers.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.organization_coordination
  ADD COLUMN IF NOT EXISTS from_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS to_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS case_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_org_coordination_from
  ON public.organization_coordination (from_organization_id);
CREATE INDEX IF NOT EXISTS idx_org_coordination_to
  ON public.organization_coordination (to_organization_id);
CREATE INDEX IF NOT EXISTS idx_org_coordination_status
  ON public.organization_coordination (status);

ALTER TABLE public.organization_coordination ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_view_coordination" ON public.organization_coordination;
CREATE POLICY "org_view_coordination"
  ON public.organization_coordination FOR SELECT
  TO authenticated
  USING (
    from_organization_id = public.current_user_organization_id()
    OR to_organization_id = public.current_user_organization_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "responder_create_org_handoff" ON public.organization_coordination;
CREATE POLICY "responder_create_org_handoff"
  ON public.organization_coordination FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_responder()
    AND from_organization_id = public.current_user_organization_id()
  );

DROP POLICY IF EXISTS "party_update_org_handoff" ON public.organization_coordination;
CREATE POLICY "party_update_org_handoff"
  ON public.organization_coordination FOR UPDATE
  TO authenticated
  USING (
    public.is_responder()
    AND (
      from_organization_id = public.current_user_organization_id()
      OR to_organization_id = public.current_user_organization_id()
    )
  )
  WITH CHECK (
    public.is_responder()
    AND (
      from_organization_id = public.current_user_organization_id()
      OR to_organization_id = public.current_user_organization_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.organization_coordination TO authenticated;
