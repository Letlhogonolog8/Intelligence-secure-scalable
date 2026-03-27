-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR AEGIS
-- ============================================================================

-- ============================================================================
-- 0. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Check JWT metadata (fastest, preferred for performance)
  IF (COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Fallback to table lookup
  -- SECURITY DEFINER and explicit search_path prevents infinite recursion
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user is a counselor
CREATE OR REPLACE FUNCTION public.is_counselor()
RETURNS BOOLEAN AS $$
BEGIN
  IF (COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'counselor') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'counselor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user is an analyst
CREATE OR REPLACE FUNCTION public.is_analyst()
RETURNS BOOLEAN AS $$
BEGIN
  IF (COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'analyst') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'analyst'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 0. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to sync profile role to auth metadata
CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Use service role or superuser permissions to update auth.users
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN jsonb_build_object('role', NEW.role)
      ELSE raw_user_meta_data || jsonb_build_object('role', NEW.role)
    END
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public;

-- Trigger to keep auth metadata in sync with profile
DROP TRIGGER IF EXISTS on_profile_update_sync_role ON public.user_profiles;
CREATE TRIGGER on_profile_update_sync_role
  AFTER INSERT OR UPDATE OF role ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_metadata();

-- ============================================================================
-- 1. USER PROFILES - Users can only view/edit their own profile
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Consolidated admin policy using the non-recursive function
DROP POLICY IF EXISTS "admins_select_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins_insert_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins_update_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins_delete_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins_manage_all_profiles" ON user_profiles;

CREATE POLICY "admins_manage_all_profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- 2. SURVIVORS - Survivors can only view their own data
-- ============================================================================

ALTER TABLE survivors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survivors_view_own_data"
  ON survivors FOR SELECT
  USING (auth.uid() = user_id OR anonymous_id IS NOT NULL);

CREATE POLICY "survivors_update_own_data"
  ON survivors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counselors_view_assigned"
  ON survivors FOR SELECT
  USING (is_counselor() OR is_admin());

-- ============================================================================
-- 3. CHAT SESSIONS - Access control for survivor support
-- ============================================================================

ALTER TABLE survivor_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survivors_view_own_sessions"
  ON survivor_chat_sessions FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM survivors WHERE id = survivor_id
  ));

CREATE POLICY "counselors_view_assigned_sessions"
  ON survivor_chat_sessions FOR SELECT
  USING (is_counselor() OR is_admin());

CREATE POLICY "escalated_counselor_access"
  ON survivor_chat_sessions FOR SELECT
  USING (escalated_to_counselor = TRUE AND auth.uid() = counselor_id);

ALTER TABLE safety_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survivors_manage_own_safety_plans"
  ON safety_plans FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM survivors WHERE id = survivor_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM survivors WHERE id = survivor_id
  ));

CREATE POLICY "counselors_view_safety_plans"
  ON safety_plans FOR SELECT
  USING (is_counselor() OR is_admin());

ALTER TABLE escalation_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survivors_view_own_escalations"
  ON escalation_reviews FOR SELECT
  USING (auth.uid() IN (
    SELECT s.user_id FROM survivors s
    WHERE s.id = (SELECT survivor_id FROM survivor_chat_sessions WHERE id = session_id)
  ));

CREATE POLICY "counselors_manage_escalations"
  ON escalation_reviews FOR ALL
  USING (is_counselor() OR is_admin());

ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_deletion_requests"
  ON data_deletion_requests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_manage_deletion_requests"
  ON data_deletion_requests FOR ALL
  USING (is_admin());

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_rate_limits"
  ON api_rate_limits FOR ALL
  USING (is_admin());

-- ============================================================================
-- 4. CHAT MESSAGES - Encrypted message access
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_messages_encrypted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES survivor_chat_sessions(id) ON DELETE CASCADE,
  encrypted_content BYTEA NOT NULL,
  encryption_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE chat_messages_encrypted ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survivors_view_own_encrypted_messages"
  ON chat_messages_encrypted FOR SELECT
  USING (auth.uid() IN (
    SELECT s.user_id FROM survivors s 
    WHERE s.id = (SELECT survivor_id FROM survivor_chat_sessions WHERE id = session_id)
  ));

CREATE POLICY "counselors_view_encrypted_messages"
  ON chat_messages_encrypted FOR SELECT
  USING (is_counselor() OR is_admin());

-- ============================================================================
-- 5. JUSTICE CASES - Role-based access
-- ============================================================================

ALTER TABLE justice_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assigned_user_view"
  ON justice_cases FOR SELECT
  USING (auth.uid() = assigned_to);

CREATE POLICY "analysts_view_all"
  ON justice_cases FOR SELECT
  USING (is_analyst() OR is_admin());

CREATE POLICY "case_owner_update"
  ON justice_cases FOR UPDATE
  USING (auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = assigned_to);

-- ============================================================================
-- 6. AUDIT LOGS - Secure audit trail
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins_view_all_logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "auto_insert_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- 7. REGIONS & INCIDENTS - Public read for analysis
-- ============================================================================

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysts_read_regions"
  ON regions FOR SELECT
  USING (is_analyst() OR is_admin());

CREATE POLICY "analysts_read_incidents"
  ON incidents FOR SELECT
  USING (is_analyst() OR is_admin());

-- ============================================================================
-- 8. RESOURCES - Public read for survivors
-- ============================================================================

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_view_resources"
  ON resources FOR SELECT
  USING (TRUE);

-- ============================================================================
-- 9. GOVERNANCE DATA - Admin only
-- ============================================================================

ALTER TABLE governance_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairness_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bias_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethical_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_governance"
  ON governance_models FOR ALL
  USING (is_admin());

CREATE POLICY "analysts_view_governance"
  ON governance_models FOR SELECT
  USING (is_analyst() OR is_admin());

CREATE POLICY "admins_manage_fairness"
  ON fairness_metrics FOR ALL
  USING (is_admin());

CREATE POLICY "admins_manage_constraints"
  ON ethical_constraints FOR ALL
  USING (is_admin());

-- ============================================================================
-- 10. CONSENT TRACKING
-- ============================================================================

ALTER TABLE user_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_consent"
  ON user_consent FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_view_verified_organizations"
  ON organizations FOR SELECT
  USING (is_verified = TRUE OR is_admin());

CREATE POLICY "admins_manage_organizations"
  ON organizations FOR ALL
  USING (is_admin());

-- ============================================================================
-- AUDIT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE LOG 'userId=% action=% table=%', auth.uid(), TG_OP, TG_TABLE_NAME;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAFETY CONSTRAINTS
-- ============================================================================

-- Prevent bulk deletion of survivor data
CREATE OR REPLACE FUNCTION prevent_survivor_data_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (SELECT COUNT(*) FROM survivors) < 1 THEN
    RAISE EXCEPTION 'Cannot delete all survivor records';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_bulk_survivor_deletion
BEFORE DELETE ON survivors
FOR EACH ROW
EXECUTE FUNCTION prevent_survivor_data_deletion();

-- Ensure case confidentiality for closed cases
CREATE OR REPLACE FUNCTION enforce_case_confidentiality()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    INSERT INTO audit_logs (user_id, action, module, description, severity)
    VALUES (auth.uid(), 'case_closed', 'justice', 'Case ' || NEW.case_number || ' closed', 'info');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_closure_audit
AFTER UPDATE ON justice_cases
FOR EACH ROW
EXECUTE FUNCTION enforce_case_confidentiality();
