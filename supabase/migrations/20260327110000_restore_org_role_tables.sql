ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS organization_subtype TEXT,
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS subscription_level TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.police_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL DEFAULT 'district',
  jurisdiction_name TEXT NOT NULL,
  officers_count INTEGER DEFAULT 0,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_police_departments_org ON public.police_departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_police_departments_region ON public.police_departments(region_id);
CREATE INDEX IF NOT EXISTS idx_police_departments_active ON public.police_departments(is_active);

CREATE TABLE IF NOT EXISTS public.ngo_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  focus_areas TEXT[] NOT NULL DEFAULT '{}',
  region_ids UUID[] NOT NULL DEFAULT '{}',
  description TEXT,
  target_beneficiaries TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ngo_programs_org ON public.ngo_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ngo_programs_active ON public.ngo_programs(is_active);

CREATE TABLE IF NOT EXISTS public.organization_coordination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  to_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.justice_cases(id) ON DELETE CASCADE,
  referral_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_org_coordination_from ON public.organization_coordination(from_organization_id);
CREATE INDEX IF NOT EXISTS idx_org_coordination_to ON public.organization_coordination(to_organization_id);
CREATE INDEX IF NOT EXISTS idx_org_coordination_case ON public.organization_coordination(case_id);
CREATE INDEX IF NOT EXISTS idx_org_coordination_status ON public.organization_coordination(status);

ALTER TABLE public.justice_cases
  ADD COLUMN IF NOT EXISTS assigned_police_department_id UUID REFERENCES public.police_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_ngo_program_id UUID REFERENCES public.ngo_programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_justice_cases_police_dept ON public.justice_cases(assigned_police_department_id);
CREATE INDEX IF NOT EXISTS idx_justice_cases_ngo_program ON public.justice_cases(assigned_ngo_program_id);

ALTER TABLE public.police_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngo_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_coordination ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "police_view_own_department" ON public.police_departments;
CREATE POLICY "police_view_own_department"
  ON public.police_departments FOR SELECT
  USING (
    public.is_police()
    AND organization_id = public.current_user_organization_id()
  );

DROP POLICY IF EXISTS "ngo_view_own_programs" ON public.ngo_programs;
CREATE POLICY "ngo_view_own_programs"
  ON public.ngo_programs FOR SELECT
  USING (
    public.is_ngo()
    AND organization_id = public.current_user_organization_id()
  );

DROP POLICY IF EXISTS "org_view_coordination" ON public.organization_coordination;
CREATE POLICY "org_view_coordination"
  ON public.organization_coordination FOR SELECT
  USING (
    from_organization_id = public.current_user_organization_id()
    OR to_organization_id = public.current_user_organization_id()
    OR public.is_admin()
  );

DO $$
BEGIN
  IF to_regclass('public.incidents') IS NOT NULL THEN
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
    AND assigned_to = auth.uid()
    AND region_id IN (
      SELECT region_id
      FROM public.police_departments
      WHERE organization_id = public.current_user_organization_id()
    )
  );

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
