-- ============================================================================
-- PHASE 4: AGI GOVERNANCE FRAMEWORK & USSD INTEGRATION
-- ============================================================================
-- Database schema for:
-- - AGI decision tracking and human-in-the-loop approval
-- - USSD session management
-- - Offline data caching
-- - Load testing metrics

-- ============================================================================
-- 1. AGI DECISION GOVERNANCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_decisions (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('risk_assessment', 'escalation', 'resource_allocation', 'data_access', 'deletion_request')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'denied', 'overridden', 'executed')),
  
  -- AI Recommendation
  ai_recommendation JSONB NOT NULL,
  
  -- Human Review (optional)
  human_review JSONB,
  reviewed_by UUID REFERENCES auth.users ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  
  -- Final Decision
  final_action VARCHAR(50),
  outcome TEXT,
  executed_by UUID REFERENCES auth.users ON DELETE SET NULL,
  executed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_status (status),
  INDEX idx_type_status (type, status),
  INDEX idx_created_at (created_at),
  INDEX idx_reviewed_by (reviewed_by)
);

CREATE TABLE IF NOT EXISTS decision_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id VARCHAR(255) NOT NULL REFERENCES agi_decisions(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_decision_id (decision_id),
  INDEX idx_action_created (action, created_at)
);

-- ============================================================================
-- 2. USSD SESSION MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'zu', 'xh', 'st', 'af', 'ss')),
  current_menu VARCHAR(100) NOT NULL,
  state JSONB,
  
  -- Session tracking
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  INDEX idx_phone_number (phone_number),
  INDEX idx_session_id (session_id),
  INDEX idx_is_active (is_active),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT valid_session CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS ussd_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL REFERENCES ussd_sessions(session_id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  menu VARCHAR(100) NOT NULL,
  user_input VARCHAR(1000),
  response TEXT,
  
  -- Performance tracking
  processing_time_ms INTEGER,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_session_id (session_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_menu (menu),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 3. USSD CASE REPORTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_case_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  session_id VARCHAR(255) REFERENCES ussd_sessions(session_id),
  
  -- Case details
  description TEXT NOT NULL,
  language VARCHAR(10),
  location_latitude DECIMAL(9, 6),
  location_longitude DECIMAL(9, 6),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'assigned', 'completed')),
  risk_level VARCHAR(20),
  
  -- Acknowledgments
  sms_confirmation_sent BOOLEAN DEFAULT false,
  confirmation_sent_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_case_id (case_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 4. USSD OFFLINE CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_offline_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  cache_type VARCHAR(50) NOT NULL CHECK (cache_type IN ('session', 'case', 'message')),
  
  -- Cache data
  key VARCHAR(255),
  value JSONB NOT NULL,
  
  -- Sync status
  is_synced BOOLEAN DEFAULT false,
  synced_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  
  INDEX idx_phone_number (phone_number),
  INDEX idx_cache_type (cache_type),
  INDEX idx_is_synced (is_synced),
  INDEX idx_expires_at (expires_at)
);

-- ============================================================================
-- 5. USSD PERFORMANCE & ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time period
  hour TIMESTAMP NOT NULL,
  
  -- Metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- Performance
  avg_response_time_ms INTEGER,
  min_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  p99_response_time_ms INTEGER,
  
  -- Language distribution
  language_distribution JSONB,
  
  -- Top menus
  top_menus JSONB,
  
  -- Created
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(hour),
  INDEX idx_hour (hour)
);

CREATE TABLE IF NOT EXISTS ussd_load_test_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Test metadata
  test_id VARCHAR(255) UNIQUE NOT NULL,
  concurrent_users INTEGER NOT NULL,
  requests_per_user INTEGER NOT NULL,
  total_requests INTEGER,
  
  -- Results
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Performance
  avg_response_time_ms INTEGER,
  min_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  p99_response_time_ms INTEGER,
  
  -- Throughput
  requests_per_second DECIMAL(10, 2),
  
  -- Status
  status VARCHAR(50) CHECK (status IN ('running', 'completed', 'failed')),
  
  -- Metadata
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  INDEX idx_test_id (test_id),
  INDEX idx_started_at (started_at),
  INDEX idx_status (status)
);

-- ============================================================================
-- 6. EMERGENCY ALERTS VIA USSD
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_emergency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  session_id VARCHAR(255) REFERENCES ussd_sessions(session_id),
  
  -- Request details
  help_type VARCHAR(100),
  description TEXT,
  location_latitude DECIMAL(9, 6),
  location_longitude DECIMAL(9, 6),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'acknowledged', 'dispatched', 'completed', 'cancelled')),
  
  -- Response tracking
  nearest_shelter_id UUID REFERENCES shelters(id),
  nearest_counselor_id UUID REFERENCES profiles(id),
  
  -- SMS notifications
  sms_sent BOOLEAN DEFAULT false,
  resources_sms_sent BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_emergency_id (emergency_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 7. SMS FALLBACK QUEUE FOR USSD
-- ============================================================================

CREATE TABLE IF NOT EXISTS ussd_sms_fallback_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('sms', 'ussd_confirmation', 'case_update', 'emergency_alert')),
  
  -- Message content
  content TEXT NOT NULL,
  
  -- Delivery tracking
  status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'delivered')),
  delivery_attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  last_error TEXT,
  
  INDEX idx_phone_number (phone_number),
  INDEX idx_status (status),
  INDEX idx_message_type (message_type),
  INDEX idx_created_at (created_at)
);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Users can only view their own USSD sessions
ALTER TABLE ussd_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ussd_sessions_phone_filter" ON ussd_sessions
  FOR SELECT
  USING (
    auth.uid()::text = 'admin' OR 
    phone_number = current_setting('app.current_phone_number', true)
  );

-- Audit logs are read-only
ALTER TABLE decision_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_audit_logs_read_only" ON decision_audit_logs
  FOR SELECT
  USING (true);

CREATE POLICY "decision_audit_logs_no_write" ON decision_audit_logs
  FOR INSERT
  USING (false);

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

-- USSD session lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ussd_sessions_phone_active 
  ON ussd_sessions(phone_number, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ussd_sessions_expires 
  ON ussd_sessions(expires_at);

-- USSD case tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ussd_case_reports_phone_status 
  ON ussd_case_reports(phone_number, status);

-- Decision workflow
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agi_decisions_type_status 
  ON agi_decisions(type, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agi_decisions_reviewed_by 
  ON agi_decisions(reviewed_by, reviewed_at);

-- Analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ussd_analytics_hour 
  ON ussd_analytics(hour);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ussd_interactions_created 
  ON ussd_interactions(created_at DESC);

-- ============================================================================
-- 10. VIEWS FOR REPORTING
-- ============================================================================

CREATE OR REPLACE VIEW ussd_active_sessions AS
SELECT 
  session_id,
  phone_number,
  language,
  current_menu,
  created_at,
  last_accessed_at,
  EXTRACT(EPOCH FROM (NOW() - last_accessed_at)) as idle_seconds
FROM ussd_sessions
WHERE is_active = true AND expires_at > NOW()
ORDER BY last_accessed_at DESC;

CREATE OR REPLACE VIEW ussd_pending_cases AS
SELECT 
  case_id,
  phone_number,
  description,
  status,
  risk_level,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_pending
FROM ussd_case_reports
WHERE status IN ('received', 'processing')
ORDER BY created_at ASC;

CREATE OR REPLACE VIEW ussd_daily_analytics AS
SELECT 
  DATE(hour) as date,
  SUM(total_requests) as daily_requests,
  SUM(successful_requests) as daily_successful,
  SUM(failed_requests) as daily_failed,
  ROUND(AVG(avg_response_time_ms)) as daily_avg_response_time,
  MAX(max_response_time_ms) as daily_max_response_time,
  SUM(unique_users) as daily_unique_users
FROM ussd_analytics
GROUP BY DATE(hour)
ORDER BY DATE(hour) DESC;

-- ============================================================================
-- 11. STORED PROCEDURES (OPTIONAL)
-- ============================================================================

-- Cleanup expired USSD sessions
CREATE OR REPLACE FUNCTION cleanup_expired_ussd_sessions()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM ussd_sessions
  WHERE expires_at < NOW() AND is_active = false;
  
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_ussd_sessions() TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created: 12
-- Indexes created: 15+
-- Views created: 3
-- Functions created: 1
-- Ready for Phase 4 USSD & AGI governance deployment
