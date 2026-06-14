-- ============================================================================
-- Community-member & witness reporting
-- ----------------------------------------------------------------------------
-- Lets anyone (community members, witnesses, bystanders) file a report on
-- behalf of a victim or about a safety concern — without an account. Reports
-- are written server-side (service role, rate-limited) into case_reports with
-- report_method = 'community_web', so this migration only needs to:
--   * add a public tracking reference + the reporter's relationship;
--   * let approved responders READ community reports (survivor-filed reports
--     stay private to their author via the existing owner policy).
-- case_reports is already in the realtime publication (20260609120000), so the
-- responder community-reports panel updates live.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.case_reports
  ADD COLUMN IF NOT EXISTS public_reference TEXT,
  ADD COLUMN IF NOT EXISTS reporter_relationship TEXT;

-- Public tracking reference is unique when present (community reports only).
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_reports_public_reference
  ON public.case_reports (public_reference)
  WHERE public_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_reports_report_method
  ON public.case_reports (report_method);

-- Approved responders can read community/witness reports (not survivor-filed
-- private reports — those remain restricted to their author).
DROP POLICY IF EXISTS "responders_read_community_reports" ON public.case_reports;
CREATE POLICY "responders_read_community_reports"
  ON public.case_reports FOR SELECT
  TO authenticated
  USING (public.is_responder() AND report_method = 'community_web');
