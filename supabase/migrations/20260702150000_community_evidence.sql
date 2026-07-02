-- ============================================================================
-- Community-report evidence
-- ----------------------------------------------------------------------------
-- Lets a community/witness reporter attach photos or documents to a report
-- they filed on the mobile app (report_method = 'community_mobile'). Evidence
-- reuses the responder `case_evidence` table + `case-evidence` bucket so it
-- shows up in the existing Case Evidence Register, linked to the new case via
-- case_id. Gated tightly: only the authenticated reporter who filed the case
-- may attach, and only into their own storage folder. Anonymous reports
-- (reported_by NULL) cannot attach — there is no owner to authorize against.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- Link evidence to a specific case (responder uploads keep using case_reference).
ALTER TABLE public.case_evidence
  ADD COLUMN IF NOT EXISTS case_id UUID
  REFERENCES public.case_reports(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_case_evidence_case_id
  ON public.case_evidence(case_id);

-- Metadata insert: a reporter may register evidence only for their own
-- community_mobile case.
DROP POLICY IF EXISTS "community_reporter_insert_case_evidence" ON public.case_evidence;
CREATE POLICY "community_reporter_insert_case_evidence"
  ON public.case_evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND case_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.case_reports cr
      WHERE cr.id = case_evidence.case_id
        AND cr.reported_by = auth.uid()
        AND cr.report_method = 'community_mobile'
    )
  );

-- Storage insert: a reporter who has filed a community_mobile report may upload
-- into their own uploader-id folder in the private case-evidence bucket.
DROP POLICY IF EXISTS "case_evidence_community_insert" ON storage.objects;
CREATE POLICY "case_evidence_community_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'case-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.case_reports cr
      WHERE cr.reported_by = auth.uid()
        AND cr.report_method = 'community_mobile'
    )
  );
