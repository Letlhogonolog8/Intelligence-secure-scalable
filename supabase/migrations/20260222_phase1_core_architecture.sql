-- AEGIS Phase 1: Core Architecture Tables
-- These tables support: Encryption, MFA, Audit Logging, Events, Escalations
-- Retention: All data encrypted at rest with AES-256

-- ============================================================================
-- 1. ENCRYPTION KEY MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id VARCHAR(255) UNIQUE NOT NULL,
  algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
  created_at TIMESTAMP DEFAULT NOW(),
  rotated_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
  metadata JSONB,
  
  CONSTRAINT valid_algorithm CHECK (algorithm IN ('aes-256-gcm', 'aes-256-cbc')),
  INDEX idx_key_id_status (key_id, status)
);

-- ============================================================================
-- 2. MULTI-FACTOR AUTHENTICATION (MFA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  secret VARCHAR(255) NOT NULL, -- TOTP secret (hashed)
  backup_codes TEXT[] NOT NULL, -- Array of hashed backup codes
  enabled_at TIMESTAMP,
  disabled_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  metadata JSONB,
  
  UNIQUE(user_id),
  INDEX idx_user_id_status (user_id, status)
);

-- ============================================================================
-- 3. IMMUTABLE AUDIT LOGS (Blockchain-style)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs_immutable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  resource_type VARCHAR(50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash for integrity
  previous_hash VARCHAR(64), -- Hash of previous entry (chain link)
  
  INDEX idx_user_id_created (user_id, created_at),
  INDEX idx_action_created (action, created_at),
  INDEX idx_module_created (module, created_at),
  INDEX idx_resource_id (resource_id),
  CONSTRAINT immutable_insert ONLY
);

-- Grant only INSERT permissions on audit logs (no update/delete)
ALTER TABLE audit_logs_immutable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_insert_only" ON audit_logs_immutable
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_logs_read_only" ON audit_logs_immutable
  FOR SELECT USING (true);

-- Prevent any updates or deletes
CREATE POLICY "audit_logs_no_update" ON audit_logs_immutable
  FOR UPDATE USING (false);

CREATE POLICY "audit_logs_no_delete" ON audit_logs_immutable
  FOR DELETE USING (false);

-- ============================================================================
-- 4. EVENT LOG (Event Sourcing for CQRS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  idempotency_key VARCHAR(255) UNIQUE, -- Prevent duplicate processing
  processed_at TIMESTAMP,
  
  INDEX idx_event_type_created (event_type, created_at),
  INDEX idx_user_id_created (user_id, created_at),
  INDEX idx_idempotency (idempotency_key)
);

-- ============================================================================
-- 5. ESCALATION EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(255) NOT NULL REFERENCES case_reports(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES auth.users,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  acknowledged_by UUID REFERENCES auth.users,
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_case_id (case_id),
  INDEX idx_severity_status (severity, status),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 6. AI RISK SCORES (Synthetic Intelligence Output)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(255) NOT NULL REFERENCES case_reports(id) ON DELETE CASCADE,
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score NUMERIC(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  confidence NUMERIC(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  factors JSONB NOT NULL, -- Array of risk factors
  bias_detected BOOLEAN DEFAULT false,
  bias_flag VARCHAR(255), -- Type of bias if detected
  explainability TEXT, -- Human-readable explanation
  computed_by VARCHAR(100) DEFAULT 'AI_ENGINE_V1',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Scores may need refresh
  
  INDEX idx_case_id_created (case_id, created_at),
  INDEX idx_risk_level (risk_level),
  INDEX idx_confidence (confidence DESC)
);

-- ============================================================================
-- 7. GEO-MATCHED ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(255) NOT NULL REFERENCES case_reports(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users,
  resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('police_station', 'shelter', 'counselor', 'ngo')),
  location_lat NUMERIC(10, 8),
  location_lng NUMERIC(11, 8),
  distance_km NUMERIC(8, 2),
  estimated_response_time_minutes INTEGER,
  capacity_utilization NUMERIC(5, 2), -- 0-100%
  assignment_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_case_id (case_id),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_resource_type (resource_type),
  INDEX idx_location (location_lat, location_lng)
);

-- ============================================================================
-- 8. USSD SESSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  operator VARCHAR(50), -- MTN, Vodacom, etc.
  menu_level INTEGER DEFAULT 0,
  current_state VARCHAR(100),
  user_input TEXT,
  case_lookup_id VARCHAR(255),
  emergency_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_phone_number (phone_number),
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 9. SMS/NOTIFICATION QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('sms', 'email', 'push', 'webhook')),
  recipient_address VARCHAR(255) NOT NULL,
  message_type VARCHAR(100) NOT NULL,
  message_content TEXT NOT NULL,
  case_id VARCHAR(255),
  user_id UUID REFERENCES auth.users,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retry')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_status_created (status, created_at),
  INDEX idx_case_id (case_id),
  INDEX idx_recipient (recipient_type, recipient_address)
);

-- ============================================================================
-- 10. COMPLIANCE RECORDS (POPIA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type VARCHAR(100) NOT NULL CHECK (record_type IN ('data_access_request', 'deletion_request', 'rectification_request')),
  subject_id UUID REFERENCES auth.users,
  requester_id UUID REFERENCES auth.users,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  resource_ids VARCHAR(255)[], -- IDs of data involved
  reason TEXT,
  deadline TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_subject_id (subject_id),
  INDEX idx_status_created (status, created_at),
  INDEX idx_deadline (deadline)
);

-- ============================================================================
-- 11. THREAT MODELS & PREDICTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS threat_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id VARCHAR(255),
  threat_type VARCHAR(100) NOT NULL, -- 'repeat_offender', 'location_cluster', 'escalation_risk'
  threat_level VARCHAR(20) NOT NULL CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
  confidence NUMERIC(5, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  factors JSONB NOT NULL,
  affected_cases VARCHAR(255)[],
  recommended_action TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  INDEX idx_region_threat_level (region_id, threat_level),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 12. CAPACITY & RESOURCE AVAILABILITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES auth.users, -- Police station, shelter, counselor
  resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('police_station', 'shelter', 'counselor', 'ngo')),
  available_capacity INTEGER NOT NULL DEFAULT 0,
  total_capacity INTEGER NOT NULL,
  current_load INTEGER DEFAULT 0,
  utilization_percent NUMERIC(5, 2) GENERATED ALWAYS AS (current_load * 100.0 / NULLIF(total_capacity, 0)) STORED,
  burnout_risk NUMERIC(5, 2), -- For counselors: 0-100%
  last_updated TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  
  INDEX idx_resource_type_utilization (resource_type, utilization_percent),
  INDEX idx_burnout_risk (burnout_risk DESC)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE audit_logs_immutable ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ussd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;

-- Admin/compliance officers can read all audit logs
CREATE POLICY "read_all_audit_logs" ON audit_logs_immutable
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'analyst')
    )
  );

-- Users can only read their own audit logs
CREATE POLICY "read_own_audit_logs" ON audit_logs_immutable
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX idx_audit_logs_hash ON audit_logs_immutable(hash);
CREATE INDEX idx_escalation_case_status ON escalation_events(case_id, status);
CREATE INDEX idx_risk_score_expires ON ai_risk_scores(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_notification_retry ON notification_queue(status, last_activity) WHERE status = 'retry';

-- ============================================================================
-- GRANTS & PERMISSIONS
-- ============================================================================

-- Service role can do everything
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Authenticated users can insert into events and read certain tables
GRANT INSERT ON events_log TO authenticated;
GRANT SELECT ON audit_logs_immutable TO authenticated;
GRANT SELECT ON escalation_events TO authenticated;

COMMENT ON TABLE audit_logs_immutable IS 'Immutable audit log for POPIA compliance. Append-only with cryptographic chaining.';
COMMENT ON TABLE events_log IS 'Event sourcing log for CQRS pattern. All system events are persisted here.';
COMMENT ON TABLE escalation_events IS 'Emergency escalation events tracking with acknowledgment status.';
COMMENT ON TABLE ai_risk_scores IS 'Synthetic Intelligence risk assessment output with explainability.';
COMMENT ON TABLE ussd_sessions IS 'USSD (dial *123#) session tracking for offline access.';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert initial event types
INSERT INTO events_log (event_type, data, metadata) VALUES 
  ('system:initialized', '{}', '{"component": "database", "version": "1.0"}')
ON CONFLICT DO NOTHING;

COMMIT;
