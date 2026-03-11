-- Supabase Migration: Add NGO and Police Roles
-- Version: 20260216_add_ngo_police_roles.sql

-- ============================================================================
-- 1. UPDATE ROLE CONSTRAINT
-- ============================================================================

-- Drop the old check if it exists (be careful with this in production)
-- ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS valid_role CASCADE;

-- Add the updated constraint that includes 'ngo' and 'police'
ALTER TABLE user_profiles
ADD CONSTRAINT valid_role CHECK (
  role IN ('admin', 'counselor', 'survivor', 'ngo', 'police', 'analyst')
);

-- ============================================================================
-- 2. CREATE POLICE DEPARTMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS police_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL DEFAULT 'district', -- 'national', 'regional', 'district', 'local'
  jurisdiction_name TEXT NOT NULL,
  officers_count INTEGER DEFAULT 0,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_police_departments_org ON police_departments(organization_id);
CREATE INDEX idx_police_departments_region ON police_departments(region_id);
CREATE INDEX idx_police_departments_active ON police_departments(is_active);

-- ============================================================================
-- 3. CREATE NGO PROGRAMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ngo_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL, -- 'counseling', 'legal_aid', 'shelter', 'advocacy', 'research'
  focus_areas TEXT[] NOT NULL, -- ['prevention', 'response', 'recovery', 'advocacy']
  region_ids UUID[] NOT NULL, -- Array of regions served
  description TEXT,
  target_beneficiaries TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ngo_programs_org ON ngo_programs(organization_id);
CREATE INDEX idx_ngo_programs_active ON ngo_programs(is_active);

-- ============================================================================
-- 4. ADD ORGANIZATION METADATA FIELDS
-- ============================================================================

-- Add fields to track organization type more explicitly
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS organization_subtype TEXT, -- for NGO: 'local_ngo', 'international_ngo', 'advocacy', etc.
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS subscription_level TEXT DEFAULT 'standard', -- 'free', 'standard', 'premium', 'enterprise'
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 5. UPDATE RLS POLICIES FOR NEW ROLES
-- ============================================================================

-- NGO Role: View survivors in their organization
DROP POLICY IF EXISTS "ngo_view_org_survivors" ON survivors;
CREATE POLICY "ngo_view_org_survivors"
  ON survivors FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ngo'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN survivor_chat_sessions scs ON true
      WHERE up.id = auth.uid()
      AND up.organization_id = (
        SELECT organization_id FROM user_profiles 
        WHERE id IN (SELECT counselor_id FROM survivor_chat_sessions WHERE survivor_id = survivors.id)
        LIMIT 1
      )
    )
  );

-- Police Role: View incidents and cases in their jurisdiction
DROP POLICY IF EXISTS "police_view_jurisdiction_incidents" ON incidents;
CREATE POLICY "police_view_jurisdiction_incidents"
  ON incidents FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'police'
    AND region_id IN (
      SELECT region_id FROM police_departments
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- Police Role: View justice cases in their jurisdiction
DROP POLICY IF EXISTS "police_view_jurisdiction_cases" ON justice_cases;
CREATE POLICY "police_view_jurisdiction_cases"
  ON justice_cases FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'police'
    AND region_id IN (
      SELECT region_id FROM police_departments
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- Police Role: Update assigned cases
DROP POLICY IF EXISTS "police_update_assigned_cases" ON justice_cases;
CREATE POLICY "police_update_assigned_cases"
  ON justice_cases FOR UPDATE
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'police'
    AND assigned_officer_id = auth.uid()
    AND region_id IN (
      SELECT region_id FROM police_departments
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- NGO Role: View organization survivors
DROP POLICY IF EXISTS "ngo_view_assigned_survivors" ON survivors;
CREATE POLICY "ngo_view_assigned_survivors"
  ON survivors FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ngo'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM survivor_chat_sessions scs
        JOIN user_profiles counselor_up ON counselor_up.id = scs.counselor_id
        WHERE scs.survivor_id = survivors.id
        AND counselor_up.organization_id = up.organization_id
      )
    )
  );

-- ============================================================================
-- 6. CREATE ORGANIZATION COORDINATION TABLE
-- ============================================================================

-- Track inter-organization referrals and coordination
CREATE TABLE IF NOT EXISTS organization_coordination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_organization_id UUID NOT NULL REFERENCES organizations(id),
  to_organization_id UUID NOT NULL REFERENCES organizations(id),
  case_id UUID NOT NULL REFERENCES justice_cases(id),
  referral_type TEXT NOT NULL, -- 'legal_aid', 'health_services', 'shelter', 'counseling'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'completed', 'rejected'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_org_coordination_from ON organization_coordination(from_organization_id);
CREATE INDEX idx_org_coordination_to ON organization_coordination(to_organization_id);
CREATE INDEX idx_org_coordination_case ON organization_coordination(case_id);
CREATE INDEX idx_org_coordination_status ON organization_coordination(status);

-- ============================================================================
-- 7. ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE police_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_coordination ENABLE ROW LEVEL SECURITY;

-- Police can view their own department
CREATE POLICY "police_view_own_department"
  ON police_departments FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'police'
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

-- NGO can view their own programs
CREATE POLICY "ngo_view_own_programs"
  ON ngo_programs FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ngo'
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

-- Organizations can view coordination referrals to/from them
CREATE POLICY "org_view_coordination"
  ON organization_coordination FOR SELECT
  USING (
    from_organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    OR to_organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- 8. ADD DEPARTMENT/PROGRAM ASSIGNMENT TO JUSTICE CASES
-- ============================================================================

-- Link justice cases to police departments and NGO programs
ALTER TABLE justice_cases
ADD COLUMN IF NOT EXISTS assigned_police_department_id UUID REFERENCES police_departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_ngo_program_id UUID REFERENCES ngo_programs(id) ON DELETE SET NULL;

CREATE INDEX idx_justice_cases_police_dept ON justice_cases(assigned_police_department_id);
CREATE INDEX idx_justice_cases_ngo_program ON justice_cases(assigned_ngo_program_id);

-- ============================================================================
-- MIGRATION VERIFICATION QUERIES
-- ============================================================================

-- Verification: Check new roles exist
-- SELECT DISTINCT role FROM user_profiles WHERE role IN ('ngo', 'police');

-- Verification: Check police departments created
-- SELECT COUNT(*) as police_departments FROM police_departments;

-- Verification: Check NGO programs created
-- SELECT COUNT(*) as ngo_programs FROM ngo_programs;

-- Verification: Check RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('police_departments', 'ngo_programs', 'organization_coordination')
-- AND schemaname = 'public';
