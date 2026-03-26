ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status ON public.user_profiles(approval_status);

UPDATE public.user_profiles
SET approval_status = CASE
  WHEN role = 'survivor' THEN 'approved'
  ELSE 'approved'
END
WHERE approval_status IS NULL;

UPDATE public.user_profiles
SET mfa_enabled = FALSE
WHERE mfa_enabled IS NULL;

UPDATE public.user_profiles
SET approved_at = COALESCE(approved_at, updated_at, created_at, CURRENT_TIMESTAMP)
WHERE approval_status = 'approved' AND approved_at IS NULL;

CREATE OR REPLACE FUNCTION public.has_approved_role(target_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_role TEXT;
BEGIN
  -- 1. Check JWT metadata first (fastest, avoids table lookup)
  current_role := auth.jwt() -> 'user_metadata' ->> 'role';
  IF current_role = target_role THEN
    RETURN TRUE;
  END IF;

  -- 2. Fallback to direct table lookup bypassing RLS
  -- We use SECURITY DEFINER and a direct table reference to avoid recursion
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = target_role
      AND COALESCE(is_active, TRUE) = TRUE
      AND (
        target_role = 'survivor'
        OR COALESCE(approval_status, 'pending') = 'approved'
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_approved_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_counselor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_approved_role('counselor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_analyst()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_approved_role('analyst');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_ngo()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_approved_role('ngo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_police()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_approved_role('police');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF to_regclass('public.survivors') IS NOT NULL
    AND to_regclass('public.survivor_chat_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ngo_view_org_survivors" ON public.survivors;
    CREATE POLICY "ngo_view_org_survivors"
      ON public.survivors FOR SELECT
      USING (
        public.is_ngo()
        AND EXISTS (
          SELECT 1
          FROM public.survivor_chat_sessions scs
          JOIN public.user_profiles counselor_up ON counselor_up.id = scs.counselor_id
          WHERE scs.survivor_id = survivors.id
          AND counselor_up.organization_id = public.current_user_organization_id()
        )
      );

    DROP POLICY IF EXISTS "ngo_view_assigned_survivors" ON public.survivors;
    CREATE POLICY "ngo_view_assigned_survivors"
      ON public.survivors FOR SELECT
      USING (
        public.is_ngo()
        AND public.current_user_organization_id() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.survivor_chat_sessions scs
          JOIN public.user_profiles counselor_up ON counselor_up.id = scs.counselor_id
          WHERE scs.survivor_id = survivors.id
          AND counselor_up.organization_id = public.current_user_organization_id()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.incidents') IS NOT NULL
    AND to_regclass('public.police_departments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "police_view_jurisdiction_incidents" ON public.incidents;
    CREATE POLICY "police_view_jurisdiction_incidents"
      ON public.incidents FOR SELECT
      USING (
        public.is_police()
        AND region_id IN (
          SELECT region_id FROM public.police_departments
          WHERE organization_id = public.current_user_organization_id()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.justice_cases') IS NOT NULL
    AND to_regclass('public.police_departments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "police_view_jurisdiction_cases" ON public.justice_cases;
    CREATE POLICY "police_view_jurisdiction_cases"
      ON public.justice_cases FOR SELECT
      USING (
        public.is_police()
        AND region_id IN (
          SELECT region_id FROM public.police_departments
          WHERE organization_id = public.current_user_organization_id()
        )
      );

    DROP POLICY IF EXISTS "police_update_assigned_cases" ON public.justice_cases;
    CREATE POLICY "police_update_assigned_cases"
      ON public.justice_cases FOR UPDATE
      USING (
        public.is_police()
        AND assigned_officer_id = auth.uid()
        AND region_id IN (
          SELECT region_id FROM public.police_departments
          WHERE organization_id = public.current_user_organization_id()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.police_departments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "police_view_own_department" ON public.police_departments;
    CREATE POLICY "police_view_own_department"
      ON public.police_departments FOR SELECT
      USING (
        public.is_police()
        AND organization_id = public.current_user_organization_id()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.ngo_programs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ngo_view_own_programs" ON public.ngo_programs;
    CREATE POLICY "ngo_view_own_programs"
      ON public.ngo_programs FOR SELECT
      USING (
        public.is_ngo()
        AND organization_id = public.current_user_organization_id()
      );
  END IF;
END $$;
