-- Data Retention Policies
-- supabase/migrations/012_data_retention.sql
--
-- Implements automatic data cleanup and retention policies
-- Ensures compliance with data retention requirements

-- ============================================================================
-- DATA RETENTION CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  retention_days INT NOT NULL DEFAULT 90,
  cleanup_condition TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN retention_policies.cleanup_condition IS 'SQL WHERE clause for identifying old records';

-- ============================================================================
-- DATA CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_chat_messages(
  p_retention_days INT DEFAULT 90
)
RETURNS TABLE (
  deleted_count INT,
  execution_time TEXT
) AS $$
DECLARE
  v_deleted_count INT;
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_start_time := CURRENT_TIMESTAMP;
  
  -- Delete chat messages older than retention period that are not escalated
  DELETE FROM chat_messages
  WHERE created_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL
    AND session_id IN (
      SELECT id FROM survivor_chat_sessions
      WHERE NOT escalated_to_counselor
        AND created_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL
    );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete old chat sessions (unescalated only)
  DELETE FROM survivor_chat_sessions
  WHERE created_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL
    AND NOT escalated_to_counselor;
  
  v_end_time := CURRENT_TIMESTAMP;
  
  RETURN QUERY SELECT
    v_deleted_count,
    (v_end_time - v_start_time)::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_incidents(
  p_retention_days INT DEFAULT 180,
  p_status TEXT DEFAULT 'closed'
)
RETURNS TABLE (
  deleted_count INT,
  execution_time TEXT
) AS $$
DECLARE
  v_deleted_count INT;
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_start_time := CURRENT_TIMESTAMP;
  
  -- Delete closed incidents older than retention period
  DELETE FROM incidents
  WHERE created_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL
    AND status = p_status;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_end_time := CURRENT_TIMESTAMP;
  
  RETURN QUERY SELECT
    v_deleted_count,
    (v_end_time - v_start_time)::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_case_assignments(
  p_retention_days INT DEFAULT 365
)
RETURNS TABLE (
  deleted_count INT,
  execution_time TEXT
) AS $$
DECLARE
  v_deleted_count INT;
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_start_time := CURRENT_TIMESTAMP;
  
  -- Delete old case assignments (keep active ones)
  DELETE FROM case_assignments
  WHERE closed_at IS NOT NULL
    AND closed_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_end_time := CURRENT_TIMESTAMP;
  
  RETURN QUERY SELECT
    v_deleted_count,
    (v_end_time - v_start_time)::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_logs(
  p_retention_days INT DEFAULT 90
)
RETURNS TABLE (
  deleted_count INT,
  execution_time TEXT
) AS $$
DECLARE
  v_deleted_count INT;
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_start_time := CURRENT_TIMESTAMP;
  
  -- Delete old application logs
  DELETE FROM activity_logs
  WHERE created_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_end_time := CURRENT_TIMESTAMP;
  
  RETURN QUERY SELECT
    v_deleted_count,
    (v_end_time - v_start_time)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MASTER CLEANUP ORCHESTRATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_retention_cleanup()
RETURNS TABLE (
  task_name TEXT,
  deleted_count INT,
  execution_time TEXT,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_chat_deleted INT;
  v_chat_exec_time TEXT;
  v_incident_deleted INT;
  v_incident_exec_time TEXT;
  v_assignment_deleted INT;
  v_assignment_exec_time TEXT;
  v_logs_deleted INT;
  v_logs_exec_time TEXT;
BEGIN
  -- Cleanup chat data (90 days)
  SELECT deleted_count, execution_time INTO v_chat_deleted, v_chat_exec_time
  FROM cleanup_old_chat_messages(90);
  
  RETURN QUERY SELECT
    'cleanup_old_chat_messages'::TEXT,
    v_chat_deleted,
    v_chat_exec_time,
    CURRENT_TIMESTAMP;
  
  -- Cleanup incidents (180 days)
  SELECT deleted_count, execution_time INTO v_incident_deleted, v_incident_exec_time
  FROM cleanup_old_incidents(180, 'closed');
  
  RETURN QUERY SELECT
    'cleanup_old_incidents'::TEXT,
    v_incident_deleted,
    v_incident_exec_time,
    CURRENT_TIMESTAMP;
  
  -- Cleanup case assignments (365 days)
  SELECT deleted_count, execution_time INTO v_assignment_deleted, v_assignment_exec_time
  FROM cleanup_old_case_assignments(365);
  
  RETURN QUERY SELECT
    'cleanup_old_case_assignments'::TEXT,
    v_assignment_deleted,
    v_assignment_exec_time,
    CURRENT_TIMESTAMP;
  
  -- Cleanup logs (90 days)
  SELECT deleted_count, execution_time INTO v_logs_deleted, v_logs_exec_time
  FROM cleanup_old_logs(90);
  
  RETURN QUERY SELECT
    'cleanup_old_logs'::TEXT,
    v_logs_deleted,
    v_logs_exec_time,
    CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANONYMIZATION FUNCTION (FOR GDPR/POPIA COMPLIANCE)
-- ============================================================================

CREATE OR REPLACE FUNCTION anonymize_survivor_data(
  p_survivor_id UUID
)
RETURNS TABLE (
  anonymized BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  v_encryption_key := current_setting('app.encryption_key', TRUE)
    OR current_setting('app.default_key', TRUE)
    OR 'default-dev-key';
  
  -- Anonymize survivor profile
  UPDATE survivors
  SET
    legal_name_encrypted = encrypt_text('[ANONYMIZED]', v_encryption_key),
    contact_phone_encrypted = encrypt_text('[REDACTED]', v_encryption_key),
    emergency_contact_encrypted = encrypt_text('[REDACTED]', v_encryption_key),
    address = '[ANONYMIZED]',
    age_range = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_survivor_id;
  
  -- Anonymize related chat messages
  UPDATE chat_messages
  SET
    encrypted_content = encrypt_text('[MESSAGE ANONYMIZED]', v_encryption_key),
    updated_at = CURRENT_TIMESTAMP
  WHERE session_id IN (
    SELECT id FROM survivor_chat_sessions WHERE survivor_id = p_survivor_id
  );
  
  -- Anonymize incidents
  UPDATE incidents
  SET
    description = '[INCIDENT ANONYMIZED]',
    location = '[LOCATION ANONYMIZED]',
    updated_at = CURRENT_TIMESTAMP
  WHERE survivor_id = p_survivor_id;
  
  RETURN QUERY SELECT TRUE, 'Survivor data anonymized successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA DELETION FUNCTION (FOR DATA SUBJECT RIGHTS)
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_survivor_data(
  p_survivor_id UUID,
  p_keep_audit_trail BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  deleted BOOLEAN,
  message TEXT,
  records_deleted INT
) AS $$
DECLARE
  v_count INT DEFAULT 0;
BEGIN
  -- Soft delete: mark as deleted instead of removing
  UPDATE survivors
  SET
    is_active = FALSE,
    deleted_at = CURRENT_TIMESTAMP
  WHERE id = p_survivor_id;
  
  -- Delete related chat sessions and messages (unless keeping for compliance)
  IF NOT p_keep_audit_trail THEN
    DELETE FROM chat_messages
    WHERE session_id IN (
      SELECT id FROM survivor_chat_sessions WHERE survivor_id = p_survivor_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    DELETE FROM survivor_chat_sessions
    WHERE survivor_id = p_survivor_id;
  END IF;
  
  RETURN QUERY SELECT
    TRUE,
    'Survivor data deletion initiated'::TEXT,
    v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION cleanup_old_chat_messages TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_incidents TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_case_assignments TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_logs TO service_role;
GRANT EXECUTE ON FUNCTION execute_retention_cleanup TO service_role;
GRANT EXECUTE ON FUNCTION anonymize_survivor_data TO service_role;
GRANT EXECUTE ON FUNCTION delete_survivor_data TO service_role;

-- ============================================================================
-- PG_CRON SCHEDULES (Requires pg_cron extension)
-- ============================================================================

-- Uncomment and configure based on your retention policy:
-- Note: These require pg_cron extension to be enabled

/*
-- Daily cleanup at 2 AM UTC
SELECT cron.schedule(
  'cleanup_old_chat_data',
  '0 2 * * *',
  'SELECT execute_retention_cleanup()'
);

-- Weekly review of retention policies
SELECT cron.schedule(
  'review_retention_policies',
  '0 3 * * 0',
  'SELECT * FROM retention_policies WHERE is_active = TRUE'
);
*/

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION cleanup_old_chat_messages IS 
'Removes unescalated chat messages and sessions older than retention period.';

COMMENT ON FUNCTION cleanup_old_incidents IS 
'Removes closed incidents older than retention period (default 180 days).';

COMMENT ON FUNCTION execute_retention_cleanup IS 
'Master function that executes all cleanup tasks. Should be scheduled with pg_cron.';

COMMENT ON FUNCTION anonymize_survivor_data IS 
'Anonymizes all PII for a survivor (GDPR/POPIA compliance).';

COMMENT ON FUNCTION delete_survivor_data IS 
'Soft-delete survivor data (marks as deleted, preserves audit trail).';

COMMENT ON TABLE retention_policies IS 
'Configuration for data retention policies. Customize retention_days per requirements.';
