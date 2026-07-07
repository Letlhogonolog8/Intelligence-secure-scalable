-- ============================================================================
-- analyst_reports: let analysts generate reports
-- ----------------------------------------------------------------------------
-- 20260619120000 made analyst_reports admin-write-only, which left the
-- portal's "Generate Report" / "Create Template" actions unable to persist
-- anything for the very role the library serves. Analysts may add rows;
-- updates and deletes remain admin-only.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "analyst_insert_analyst_reports" ON public.analyst_reports;
CREATE POLICY "analyst_insert_analyst_reports"
  ON public.analyst_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.is_analyst() OR public.is_admin());

GRANT INSERT ON public.analyst_reports TO authenticated;
