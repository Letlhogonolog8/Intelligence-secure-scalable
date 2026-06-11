-- ============================================================================
-- Enrich case_reports for the improved incident report
-- ----------------------------------------------------------------------------
-- The mobile/web incident report needs fields the base table lacks
-- (report_method, language, category, incident date, anonymous flag, GPS,
-- reporter id). Adds them defensively and provides an INSERT policy so an
-- authenticated survivor can file their own report under RLS.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS report_method TEXT;
ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS incident_occurred_at TIMESTAMPTZ;
ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS location JSONB;
-- Reporter's auth.users id (survivor_id FKs the survivors table, which is a
-- different key; this captures who filed it without violating that FK).
ALTER TABLE public.case_reports ADD COLUMN IF NOT EXISTS reported_by UUID;

CREATE INDEX IF NOT EXISTS idx_case_reports_reported_by ON public.case_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_case_reports_created_at ON public.case_reports(created_at);

ALTER TABLE public.case_reports ENABLE ROW LEVEL SECURITY;

-- A signed-in survivor can file a report (anonymous reports set reported_by null).
DROP POLICY IF EXISTS "users_create_own_case_reports" ON public.case_reports;
CREATE POLICY "users_create_own_case_reports"
  ON public.case_reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid() OR reported_by IS NULL);

-- A reporter can read back their own (non-anonymous) reports for case status.
DROP POLICY IF EXISTS "users_view_own_case_reports" ON public.case_reports;
CREATE POLICY "users_view_own_case_reports"
  ON public.case_reports FOR SELECT
  TO authenticated
  USING (reported_by = auth.uid());

GRANT SELECT, INSERT ON public.case_reports TO authenticated;
