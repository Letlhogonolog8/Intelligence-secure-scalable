-- ============================================================================
-- Multi-agency coordination center: handoff write access
-- ----------------------------------------------------------------------------
-- organization_coordination already has a SELECT policy (a party org or admin
-- can read) and is in the realtime publication, but nothing could WRITE to it
-- from the app. This adds INSERT + UPDATE so responders can run a shared
-- cross-org handoff board:
--   * INSERT — a responder refers a case FROM their own organisation;
--   * UPDATE — either party (sending or receiving org) advances the status.
--
-- The live table's column names vary by deployment age (from_organization /
-- from_org_id / from_organization_id), so — like 20260323212500 — we detect
-- the actual columns and build the policies dynamically.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DO $$
DECLARE
  from_col TEXT;
  to_col TEXT;
BEGIN
  IF to_regclass('public.organization_coordination') IS NULL THEN
    RAISE NOTICE 'organization_coordination missing; skipping handoff RLS';
    RETURN;
  END IF;

  SELECT c.column_name INTO from_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'organization_coordination'
    AND c.column_name IN ('from_organization_id', 'from_organization', 'from_org_id')
  ORDER BY array_position(
    ARRAY['from_organization_id', 'from_organization', 'from_org_id'], c.column_name
  )
  LIMIT 1;

  SELECT c.column_name INTO to_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'organization_coordination'
    AND c.column_name IN ('to_organization_id', 'to_organization', 'to_org_id')
  ORDER BY array_position(
    ARRAY['to_organization_id', 'to_organization', 'to_org_id'], c.column_name
  )
  LIMIT 1;

  IF from_col IS NULL OR to_col IS NULL THEN
    RAISE NOTICE 'organization_coordination org columns not found; skipping handoff RLS';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "responder_create_org_handoff" ON public.organization_coordination';
  EXECUTE format(
    'CREATE POLICY "responder_create_org_handoff" ON public.organization_coordination '
    || 'FOR INSERT TO authenticated '
    || 'WITH CHECK (public.is_responder() AND %I = public.current_user_organization_id())',
    from_col
  );

  EXECUTE 'DROP POLICY IF EXISTS "party_update_org_handoff" ON public.organization_coordination';
  EXECUTE format(
    'CREATE POLICY "party_update_org_handoff" ON public.organization_coordination '
    || 'FOR UPDATE TO authenticated '
    || 'USING (public.is_responder() AND (%I = public.current_user_organization_id() '
    || 'OR %I = public.current_user_organization_id())) '
    || 'WITH CHECK (public.is_responder() AND (%I = public.current_user_organization_id() '
    || 'OR %I = public.current_user_organization_id()))',
    from_col, to_col, from_col, to_col
  );
END $$;

GRANT SELECT, INSERT, UPDATE ON public.organization_coordination TO authenticated;
