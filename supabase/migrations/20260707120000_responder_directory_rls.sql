-- Responder professional directory visibility.
--
-- user_profiles RLS previously allowed SELECT only on the caller's own row
-- (002_rls_policies.sql "users_view_own_profile") plus admins. That silently
-- breaks every professional-facing picker in production:
--   * Police portal "New secure conversation" shows no recipients.
--   * "Assign Officer" cannot list officers.
--   * Officer/counselor name enrichment renders blank.
--
-- This policy lets APPROVED, ACTIVE privileged responders (police, ngo,
-- counselor, analyst, admin) see the professional directory: other approved,
-- active, NON-survivor profiles. Survivor profiles stay private — survivor
-- contact continues to flow through case-team conversations only.

CREATE OR REPLACE FUNCTION public.is_privileged_responder()
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER + explicit search_path prevents RLS recursion on
  -- user_profiles (same pattern as public.is_admin()).
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('police', 'ngo', 'counselor', 'analyst', 'admin')
      AND COALESCE(is_active, TRUE)
      AND COALESCE(approval_status, 'approved') = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_privileged_responder() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_privileged_responder() TO authenticated;

DROP POLICY IF EXISTS "responders_view_professional_directory" ON public.user_profiles;
CREATE POLICY "responders_view_professional_directory"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    public.is_privileged_responder()
    AND role IN ('police', 'ngo', 'counselor', 'analyst', 'admin')
    AND COALESCE(is_active, TRUE)
    AND COALESCE(approval_status, 'approved') = 'approved'
  );
