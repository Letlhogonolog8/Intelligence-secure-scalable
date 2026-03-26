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

DO $$
BEGIN
  IF to_regclass('public.survivors') IS NOT NULL
    AND to_regclass('public.survivor_chat_sessions') IS NOT NULL
    AND to_regclass('public.user_profiles') IS NOT NULL THEN
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
          SELECT 1
          FROM public.survivor_chat_sessions scs
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
          SELECT region_id
          FROM public.police_departments
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
          SELECT region_id
          FROM public.police_departments
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
          SELECT region_id
          FROM public.police_departments
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

DO $$
DECLARE
  from_col TEXT;
  to_col TEXT;
BEGIN
  IF to_regclass('public.organization_coordination') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_coordination'
        AND column_name = 'from_organization_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_coordination'
        AND column_name = 'to_organization_id'
    ) THEN
      from_col := 'from_organization_id';
      to_col := 'to_organization_id';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_coordination'
        AND column_name = 'from_organization'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_coordination'
        AND column_name = 'to_organization'
    ) THEN
      from_col := 'from_organization';
      to_col := 'to_organization';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_coordination'
        AND column_name = 'from_org_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_coordination'
        AND column_name = 'to_org_id'
    ) THEN
      from_col := 'from_org_id';
      to_col := 'to_org_id';
    END IF;

    IF from_col IS NOT NULL AND to_col IS NOT NULL THEN
      DROP POLICY IF EXISTS "org_view_coordination" ON public.organization_coordination;
      EXECUTE format(
        'CREATE POLICY "org_view_coordination" ON public.organization_coordination FOR SELECT USING (%I = public.current_user_organization_id() OR %I = public.current_user_organization_id())',
        from_col,
        to_col
      );
    END IF;
  END IF;
END $$;
