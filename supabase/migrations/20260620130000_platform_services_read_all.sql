-- ============================================================================
-- Broaden read access on platform_services.
-- ----------------------------------------------------------------------------
-- The Admin "System Health/Service Control" panels AND the Police "AEGIS System
-- Operations" panel both read public.platform_services. The original policy
-- restricted reads to admins (public.is_admin()), which left the Police panel
-- empty for non-admin responders. Service-health rows contain no survivor data,
-- so this adds an authenticated-read policy (RLS policies are OR-ed, so the
-- existing admin policy is unaffected). Writes remain service-role only.
-- Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_read_platform_services" ON public.platform_services;
CREATE POLICY "authenticated_read_platform_services"
  ON public.platform_services FOR SELECT
  TO authenticated
  USING (true);
