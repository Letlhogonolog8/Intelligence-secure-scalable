-- ============================================================================
-- resources read-policy drift fix
-- ----------------------------------------------------------------------------
-- 002_rls_policies.sql defines "anyone_view_resources" (public help directory:
-- hotlines, shelters, legal aid), but the live database has RLS enabled on
-- resources with no working SELECT policy — survivors and anonymous help
-- seekers saw an empty directory (0 of 54 rows) in the mobile Resources view
-- and any public help page.
--
-- Re-asserts the documented policy. Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_view_resources" ON public.resources;
CREATE POLICY "anyone_view_resources"
  ON public.resources FOR SELECT
  USING (TRUE);

GRANT SELECT ON public.resources TO anon, authenticated;
