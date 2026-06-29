-- =============================================================================
-- Case category aggregation for the Data Analyst Portal.
-- A live view that rolls incidents up by category (incident_type). Uses
-- security_invoker so the querying analyst's existing RLS on `incidents`
-- applies — no data is exposed that the analyst could not already read.
-- Returns nothing when `incidents` is empty, in which case the portal falls
-- back to its sample breakdown.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'incident_type'
  ) THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.case_category_totals
      WITH (security_invoker = on) AS
      SELECT
        COALESCE(NULLIF(TRIM(incident_type), ''), 'Other') AS category,
        COUNT(*)::bigint AS total
      FROM public.incidents
      GROUP BY 1
      ORDER BY 2 DESC;
    $v$;
    GRANT SELECT ON public.case_category_totals TO authenticated;
  END IF;
END $$;
