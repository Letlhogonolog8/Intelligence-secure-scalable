-- ============================================================================
-- Reliable manage policy for alerts_feed (acknowledge / delete)
-- ----------------------------------------------------------------------------
-- The original `police_manage_alerts` policy authorizes via the JWT
-- `user_metadata.role` claim, which is frequently unset in this app — roles are
-- the source of truth in public.user_profiles. That made the Live Alert Feed's
-- delete/acknowledge silently fail under RLS.
--
-- This adds a policy that authorizes ALL writes from active responder roles
-- looked up in user_profiles. Policies are OR'd, so the legacy policy still
-- applies; this simply makes management work for the roles that see the feed.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.alerts_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_manage_alerts" ON public.alerts_feed;
CREATE POLICY "responders_manage_alerts"
  ON public.alerts_feed FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active
        AND up.role IN ('police', 'admin', 'analyst', 'counselor', 'ngo', 'chw')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active
        AND up.role IN ('police', 'admin', 'analyst', 'counselor', 'ngo', 'chw')
    )
  );
