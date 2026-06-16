-- ============================================================================
-- Close the alerts_feed public-read leak
-- ----------------------------------------------------------------------------
-- alerts_feed carries SOS alerts whose message text can include a survivor's
-- GPS coordinates and a maps link. Two over-permissive SELECT policies allowed
-- ANY anon/authenticated client to read every alert:
--     read_alerts_anon  (TO anon,          USING true)
--     read_alerts_auth  (TO authenticated, USING true)
-- Since the Supabase anon key ships in the web bundle, that exposed survivor
-- SOS locations publicly.
--
-- Drop both. Reads are still served to actual responders by the existing
-- scoped policy `alerts_feed_select_frontline` (USING is_frontline_role()),
-- and management stays under `responders_manage_alerts`. Survivors track their
-- own SOS via escalation_events, not alerts_feed, so nothing legitimate breaks.
--
-- Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS "read_alerts_anon" ON public.alerts_feed;
DROP POLICY IF EXISTS "read_alerts_auth" ON public.alerts_feed;
