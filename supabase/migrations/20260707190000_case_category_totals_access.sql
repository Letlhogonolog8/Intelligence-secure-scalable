-- ============================================================================
-- case_category_totals: make the aggregate readable by analysts
-- ----------------------------------------------------------------------------
-- 20260619123000 defined case_category_totals as a security_invoker view over
-- public.incidents. Analysts (and every non-police responder) have no SELECT
-- policy on incidents, so the view returned 0 rows for exactly the portal it
-- was built for — the Analytics section silently fell back to sample data.
--
-- Fix: compute the aggregate in a SECURITY DEFINER function (it exposes only
-- category names and counts — no row-level or survivor data) gated to
-- approved privileged responders, and point the view at it so the client
-- query (.from("case_category_totals")) keeps working unchanged.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incidents'
      AND column_name = 'incident_type'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.case_category_totals_fn()
      RETURNS TABLE (category TEXT, total BIGINT)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT
          COALESCE(NULLIF(TRIM(incident_type), ''), 'Other') AS category,
          COUNT(*)::bigint AS total
        FROM public.incidents
        WHERE public.is_privileged_responder()
        GROUP BY 1
        ORDER BY 2 DESC;
      $body$;
    $f$;

    REVOKE ALL ON FUNCTION public.case_category_totals_fn() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.case_category_totals_fn() TO authenticated;

    EXECUTE 'DROP VIEW IF EXISTS public.case_category_totals';
    EXECUTE $v$
      CREATE VIEW public.case_category_totals
      WITH (security_invoker = on) AS
      SELECT * FROM public.case_category_totals_fn();
    $v$;
    EXECUTE 'GRANT SELECT ON public.case_category_totals TO authenticated';
  END IF;
END $$;
