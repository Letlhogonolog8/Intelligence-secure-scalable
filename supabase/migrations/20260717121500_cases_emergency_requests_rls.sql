-- ============================================================================
-- Enable RLS on cases and emergency_requests
-- ----------------------------------------------------------------------------
-- Both tables were created in 20260321193000_harden_ussd_runtime_schema.sql
-- with no RLS at all. That was safe only by accident: the only current
-- consumer (server/ussd/ussdGateway.ts) connects with the Supabase
-- service-role key, which bypasses RLS unconditionally. Any future code path
-- using the anon/authenticated client — a dashboard query, a new endpoint —
-- would read or write every survivor's case and SOS data with zero
-- restriction. This closes that gap the same way every other case-adjacent
-- table (justice_cases, case_reports, case_evidence) already is: responders
-- (police/ngo/counselor/chw/admin, via public.is_responder()) can read and
-- update; only the service role can insert (case creation is a server-side
-- USSD/WhatsApp/dispatch action, not a direct client write).
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_cases" ON public.cases;
CREATE POLICY "responders_read_cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_update_cases" ON public.cases;
CREATE POLICY "responders_update_cases"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (public.is_responder())
  WITH CHECK (public.is_responder());

DROP POLICY IF EXISTS "responders_read_emergency_requests" ON public.emergency_requests;
CREATE POLICY "responders_read_emergency_requests"
  ON public.emergency_requests FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_update_emergency_requests" ON public.emergency_requests;
CREATE POLICY "responders_update_emergency_requests"
  ON public.emergency_requests FOR UPDATE
  TO authenticated
  USING (public.is_responder())
  WITH CHECK (public.is_responder());

-- No INSERT/DELETE policy for authenticated/anon: rows are created exclusively
-- by the USSD/WhatsApp gateways via the service-role key, which bypasses RLS.
GRANT SELECT, UPDATE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
GRANT SELECT, UPDATE ON public.emergency_requests TO authenticated;
GRANT ALL ON public.emergency_requests TO service_role;
