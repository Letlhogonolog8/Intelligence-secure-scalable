-- AEGIS-AI Platform Initial Schema
-- This migration creates the foundational tables for the application

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Audit logs table (immutable/append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  resource_id TEXT,
  resource_type TEXT,
  status TEXT DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  hash TEXT,
  previous_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);

-- MFA credentials table
CREATE TABLE IF NOT EXISTS mfa_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] NOT NULL,
  enabled_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'inactive',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mfa_credentials_user_id ON mfa_credentials(user_id);
CREATE INDEX idx_mfa_credentials_status ON mfa_credentials(status);

-- Encryption keys table
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_id TEXT NOT NULL UNIQUE,
  key_material TEXT NOT NULL,
  algorithm TEXT DEFAULT 'aes-256-gcm',
  key_size INTEGER DEFAULT 256,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_encryption_keys_key_id ON encryption_keys(key_id);
CREATE INDEX idx_encryption_keys_status ON encryption_keys(status);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Rate limiting table (for Redis fallback)
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint TEXT NOT NULL,
  ip_address INET NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rate_limits_endpoint_ip ON rate_limits(endpoint, ip_address);
CREATE INDEX idx_rate_limits_window_end ON rate_limits(window_end);

-- USSD sessions table
CREATE TABLE IF NOT EXISTS ussd_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  current_state TEXT,
  context JSONB,
  language TEXT DEFAULT 'en',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ussd_sessions_phone_number ON ussd_sessions(phone_number);
CREATE INDEX idx_ussd_sessions_session_id ON ussd_sessions(session_id);
CREATE INDEX idx_ussd_sessions_last_activity ON ussd_sessions(last_activity);

-- Escalation events table
CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'open',
  assigned_to UUID,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escalation_events_case_id ON escalation_events(case_id);
CREATE INDEX idx_escalation_events_severity ON escalation_events(severity);
CREATE INDEX idx_escalation_events_user_id ON escalation_events(user_id);
CREATE INDEX idx_escalation_events_status ON escalation_events(status);
CREATE INDEX idx_escalation_events_triggered_at ON escalation_events(triggered_at);

-- Enable Row Level Security on critical tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;

-- Create policies for audit logs (read-only for authorized users)
CREATE POLICY audit_logs_read_policy ON audit_logs
  FOR SELECT
  USING (auth.uid()::text = user_id OR current_user = 'authenticated');

-- Create policies for MFA credentials
CREATE POLICY mfa_credentials_read_policy ON mfa_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY mfa_credentials_update_policy ON mfa_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policies for sessions
CREATE POLICY sessions_read_policy ON sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY sessions_insert_policy ON sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_update_policy ON sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policies for escalation events
CREATE POLICY escalation_events_read_policy ON escalation_events
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = assigned_to);

CREATE POLICY escalation_events_insert_policy ON escalation_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mfa_credentials_updated_at
  BEFORE UPDATE ON mfa_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to compute HMAC for audit log chain verification
CREATE OR REPLACE FUNCTION compute_audit_log_hash(log_id UUID)
RETURNS TEXT AS $$
DECLARE
  prev_hash TEXT;
  current_log RECORD;
BEGIN
  SELECT hash INTO prev_hash
  FROM audit_logs
  WHERE id < log_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT INTO current_log
    encode(
      hmac(
        COALESCE(prev_hash, '') || 
        log_id::TEXT || 
        user_id || 
        action || 
        COALESCE(module, '') ||
        created_at::TEXT,
        'audit-log-secret',
        'sha256'
      ), 'hex'
    ) as hash
  FROM audit_logs
  WHERE id = log_id;

  RETURN current_log.hash;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE audit_logs IS 'Immutable append-only audit log table for compliance';
COMMENT ON TABLE mfa_credentials IS 'Multi-factor authentication credentials storage';
COMMENT ON TABLE encryption_keys IS 'Encryption key management and rotation';
COMMENT ON TABLE sessions IS 'User session and refresh token management';
COMMENT ON TABLE escalation_events IS 'Case escalation event tracking';
