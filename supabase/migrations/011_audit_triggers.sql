-- Audit Logging System
-- supabase/migrations/011_audit_triggers.sql
--
-- Implements comprehensive audit logging for sensitive tables
-- Tracks all changes (INSERT, UPDATE, DELETE) with full context

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  
  -- How it changed
  old_values JSONB,
  new_values JSONB,
  changed_fields JSONB,
  
  -- Who changed it
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role TEXT,
  
  -- When & context
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  
  -- Additional context
  session_id TEXT,
  request_id UUID,
  notes TEXT
);

COMMENT ON COLUMN audit_log.changed_fields IS 'Array of changed field names';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_table_date 
ON audit_log (table_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_record_date 
ON audit_log (record_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user 
ON audit_log (changed_by, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_operation 
ON audit_log (operation);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp 
ON audit_log (changed_at DESC);

-- ============================================================================
-- AUDIT LOG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields JSONB;
  old_record JSONB;
  new_record JSONB;
BEGIN
  -- Convert records to JSONB
  old_record := CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END;
  new_record := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END;
  
  -- Calculate changed fields for UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    changed_fields := (
      SELECT jsonb_object_agg(key, jsonb_build_object('old', old_record->key, 'new', new_record->key))
      FROM jsonb_object_keys(old_record) key
      WHERE old_record->key IS DISTINCT FROM new_record->key
    );
  ELSE
    changed_fields := NULL;
  END IF;
  
  -- Insert audit record
  INSERT INTO audit_log (
    table_name,
    record_id,
    operation,
    old_values,
    new_values,
    changed_fields,
    changed_by,
    user_role,
    session_id,
    request_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_record,
    new_record,
    changed_fields,
    auth.uid(),
    (auth.jwt() ->> 'role')::TEXT,
    (current_setting('app.session_id', TRUE))::TEXT,
    (current_setting('app.request_id', TRUE))::UUID
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- AUDIT TRIGGERS ON SENSITIVE TABLES
-- ============================================================================

-- Audit user_profiles
DROP TRIGGER IF EXISTS audit_user_profiles ON user_profiles;
CREATE TRIGGER audit_user_profiles
AFTER INSERT OR UPDATE OR DELETE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION audit_changes();

-- Audit survivors
DROP TRIGGER IF EXISTS audit_survivors ON survivors;
CREATE TRIGGER audit_survivors
AFTER INSERT OR UPDATE OR DELETE ON survivors
FOR EACH ROW
EXECUTE FUNCTION audit_changes();

-- Audit survivor_chat_sessions
DROP TRIGGER IF EXISTS audit_survivor_chat_sessions ON survivor_chat_sessions;
CREATE TRIGGER audit_survivor_chat_sessions
AFTER INSERT OR UPDATE OR DELETE ON survivor_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION audit_changes();

-- Audit chat_messages
DROP TRIGGER IF EXISTS audit_chat_messages ON chat_messages;
CREATE TRIGGER audit_chat_messages
AFTER INSERT OR UPDATE OR DELETE ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION audit_changes();

-- Audit incidents
DROP TRIGGER IF EXISTS audit_incidents ON incidents;
CREATE TRIGGER audit_incidents
AFTER INSERT OR UPDATE OR DELETE ON incidents
FOR EACH ROW
EXECUTE FUNCTION audit_changes();

-- Audit case_assignments (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_assignments') THEN
    DROP TRIGGER IF EXISTS audit_case_assignments ON case_assignments;
    CREATE TRIGGER audit_case_assignments
    AFTER INSERT OR UPDATE OR DELETE ON case_assignments
    FOR EACH ROW
    EXECUTE FUNCTION audit_changes();
  END IF;
END $$;

-- Audit organization_roles (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_roles') THEN
    DROP TRIGGER IF EXISTS audit_organization_roles ON organization_roles;
    CREATE TRIGGER audit_organization_roles
    AFTER INSERT OR UPDATE OR DELETE ON organization_roles
    FOR EACH ROW
    EXECUTE FUNCTION audit_changes();
  END IF;
END $$;

-- ============================================================================
-- AUDIT REPORTING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_audit_trail(
  p_record_id UUID,
  p_table_name TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  operation TEXT,
  changed_at TIMESTAMP WITH TIME ZONE,
  changed_by UUID,
  user_role TEXT,
  changes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.operation,
    al.changed_at,
    al.changed_by,
    al.user_role,
    al.changed_fields
  FROM audit_log al
  WHERE al.record_id = p_record_id
    AND (p_table_name IS NULL OR al.table_name = p_table_name)
  ORDER BY al.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  table_name TEXT,
  operation TEXT,
  record_id UUID,
  changed_at TIMESTAMP WITH TIME ZONE,
  changes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.table_name,
    al.operation,
    al.record_id,
    al.changed_at,
    al.changed_fields
  FROM audit_log al
  WHERE al.changed_by = p_user_id
  ORDER BY al.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION get_table_activity(
  p_table_name TEXT,
  p_since TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INT DEFAULT 1000
)
RETURNS TABLE (
  operation TEXT,
  record_id UUID,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE,
  changes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.operation,
    al.record_id,
    al.changed_by,
    al.changed_at,
    al.changed_fields
  FROM audit_log al
  WHERE al.table_name = p_table_name
    AND (p_since IS NULL OR al.changed_at >= p_since)
  ORDER BY al.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================================
-- AUDIT LOG CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  p_retention_days INT DEFAULT 90
)
RETURNS TABLE (
  deleted_count INT
) AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM audit_log
  WHERE changed_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Schedule cleanup of old audit logs (requires pg_cron extension)
-- Runs daily at 2 AM UTC, keeps last 90 days
-- SELECT cron.schedule('cleanup_audit_logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs(90)');

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON audit_log TO service_role;
GRANT SELECT ON audit_log TO authenticated;

GRANT EXECUTE ON FUNCTION audit_changes TO service_role;
GRANT EXECUTE ON FUNCTION get_audit_trail TO service_role;
GRANT EXECUTE ON FUNCTION get_audit_trail TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO service_role;
GRANT EXECUTE ON FUNCTION get_table_activity TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs TO service_role;

-- ============================================================================
-- ROW LEVEL SECURITY FOR AUDIT LOG
-- ============================================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "audit_log_admin_view" ON audit_log
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'admin'
  OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
);

-- Users can view their own activity
CREATE POLICY "audit_log_user_view_own" ON audit_log
FOR SELECT
USING (changed_by = auth.uid());

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE audit_log IS 
'Comprehensive audit trail for sensitive tables. Tracks all INSERT, UPDATE, DELETE operations.';

COMMENT ON FUNCTION audit_changes IS 
'Trigger function that logs changes to audit_log table. Automatically called by audit triggers.';

COMMENT ON FUNCTION get_audit_trail IS 
'Retrieve complete audit history for a specific record.';

COMMENT ON FUNCTION get_user_activity IS 
'Retrieve all changes made by a specific user.';

COMMENT ON FUNCTION cleanup_old_audit_logs IS 
'Remove audit logs older than specified retention period (default 90 days).';
