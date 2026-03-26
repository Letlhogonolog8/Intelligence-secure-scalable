ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN;

UPDATE public.organizations
SET is_verified = TRUE
WHERE is_verified IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN is_verified SET DEFAULT FALSE;

ALTER TABLE public.organizations
  ALTER COLUMN is_verified SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_is_verified
  ON public.organizations(is_verified);

DROP POLICY IF EXISTS "anyone_view_verified_organizations" ON public.organizations;
CREATE POLICY "anyone_view_verified_organizations"
  ON public.organizations FOR SELECT
  USING (is_verified = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "admins_manage_organizations" ON public.organizations;
CREATE POLICY "admins_manage_organizations"
  ON public.organizations FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
