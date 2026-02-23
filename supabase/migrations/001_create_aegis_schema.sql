-- AEGIS Platform - Core Database Schema
-- This migration creates all essential tables for GBV prevention system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- 1. ORGANIZATIONS & USERS
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  region TEXT,
  type TEXT NOT NULL, -- 'government', 'ngo', 'law_enforcement', 'health'
  description TEXT,
  website TEXT,
  subscription_level TEXT DEFAULT 'Standard',
  is_verified BOOLEAN DEFAULT FALSE,
  contact_email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'analyst', -- 'admin', 'analyst', 'counselor', 'survivor'
  full_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- ============================================================================
-- 2. GEOGRAPHIC REGIONS & INCIDENTS
-- ============================================================================

CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  risk_score DECIMAL(5, 2) DEFAULT 0.0,
  incidents INTEGER DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable', -- 'up', 'down', 'stable'
  trend_percent DECIMAL(5, 2) DEFAULT 0.0,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  population INTEGER,
  active_shelters INTEGER DEFAULT 0,
  active_agents INTEGER DEFAULT 0,
  last_incident_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_regions_country ON regions(country);
CREATE INDEX idx_regions_risk_level ON regions(risk_level);
CREATE INDEX idx_regions_location ON regions(latitude, longitude);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL, -- 'physical', 'sexual', 'emotional', 'economic', 'digital'
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'moderate', -- 'minor', 'moderate', 'severe', 'critical'
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous BOOLEAN DEFAULT TRUE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  incident_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incidents_region ON incidents(region_id);
CREATE INDEX idx_incidents_type ON incidents(incident_type);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_date ON incidents(incident_date);

-- ============================================================================
-- 3. SURVIVOR SUPPORT & CASE MANAGEMENT
-- ============================================================================

CREATE TABLE survivors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT UNIQUE, -- For anonymous interactions
  date_of_birth DATE,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  incident_types TEXT[], -- Array of incident types they've experienced
  current_risk_level TEXT DEFAULT 'low',
  safety_plan_exists BOOLEAN DEFAULT FALSE,
  support_status TEXT DEFAULT 'active', -- 'active', 'archived', 'recovered'
  last_contact TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_survivors_region ON survivors(region_id);
CREATE INDEX idx_survivors_status ON survivors(support_status);

CREATE TABLE survivor_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID REFERENCES survivors(id) ON DELETE CASCADE,
  anonymous BOOLEAN DEFAULT TRUE,
  mood_baseline TEXT DEFAULT 'neutral',
  risk_level_start TEXT,
  risk_level_end TEXT,
  conversation_summary TEXT,
  consent_granted BOOLEAN DEFAULT FALSE,
  consent_granted_at TIMESTAMP WITH TIME ZONE,
  retention_expires_at TIMESTAMP WITH TIME ZONE,
  escalated_to_counselor BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMP WITH TIME ZONE,
  counselor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_chat_sessions_survivor ON survivor_chat_sessions(survivor_id);
CREATE INDEX idx_chat_sessions_counselor ON survivor_chat_sessions(counselor_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES survivor_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  emotion_detected TEXT,
  risk_score DECIMAL(3, 2),
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);

CREATE TABLE safety_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES survivors(id) ON DELETE CASCADE,
  trusted_contacts TEXT[], -- Phone/email contacts
  safe_locations TEXT[], -- Safe places to go
  emergency_resources TEXT[], -- Emergency numbers
  identified_triggers TEXT[], -- Actionable warning signs
  coping_strategies TEXT[], -- Personalized coping techniques
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_safety_plans_survivor ON safety_plans(survivor_id);

CREATE TABLE escalation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES survivor_chat_sessions(id) ON DELETE CASCADE,
  risk_level TEXT,
  emotion_detected TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_escalation_reviews_session ON escalation_reviews(session_id);
CREATE INDEX idx_escalation_reviews_status ON escalation_reviews(status);
CREATE INDEX idx_escalation_reviews_assigned ON escalation_reviews(assigned_to);

CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  survivor_id UUID REFERENCES survivors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT
);

CREATE INDEX idx_deletion_requests_user ON data_deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_status ON data_deletion_requests(status);

CREATE TABLE api_rate_limits (
  identifier TEXT PRIMARY KEY,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. JUSTICE & CASE MANAGEMENT
-- ============================================================================

CREATE TABLE justice_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL,
  case_type TEXT NOT NULL, -- 'domestic_violence', 'sexual_assault', 'harassment', etc.
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'investigation', 'prosecution', 'trial', 'verdict', 'closed'
  stage TEXT, -- 'report', 'investigation', 'charging', 'arraignment', 'trial', 'sentencing', 'appeal'
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  days_open INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_justice_cases_region ON justice_cases(region_id);
CREATE INDEX idx_justice_cases_status ON justice_cases(status);
CREATE INDEX idx_justice_cases_assigned ON justice_cases(assigned_to);

CREATE TABLE case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES justice_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'report', 'investigation', 'charge', 'hearing', 'verdict', 'sentence'
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_case_events_case ON case_events(case_id);
CREATE INDEX idx_case_events_type ON case_events(event_type);

CREATE TABLE convictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES justice_cases(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL, -- 'guilty', 'not_guilty', 'dismissed'
  sentence_type TEXT, -- 'prison', 'probation', 'fine', 'community_service'
  sentence_length TEXT,
  appeal_status TEXT DEFAULT 'none', -- 'none', 'pending', 'approved', 'denied'
  conviction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_convictions_case ON convictions(case_id);

-- ============================================================================
-- 5. RISK PREDICTION & ANALYTICS
-- ============================================================================

CREATE TABLE risk_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  forecast_date TIMESTAMP WITH TIME ZONE NOT NULL,
  predicted_risk_level TEXT NOT NULL,
  predicted_incidents INTEGER,
  confidence DECIMAL(3, 2),
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_predictions_region ON risk_predictions(region_id);
CREATE INDEX idx_risk_predictions_date ON risk_predictions(forecast_date);

CREATE TABLE incident_timeseries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  incident_count INTEGER DEFAULT 0,
  predicted_count INTEGER,
  lower_bound INTEGER,
  upper_bound INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timeseries_region_date ON incident_timeseries(region_id, date);

CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'trend_spike', 'geographic_cluster', 'pattern_anomaly'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT,
  confidence DECIMAL(3, 2),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_anomaly_alerts_region ON anomaly_alerts(region_id);
CREATE INDEX idx_anomaly_alerts_severity ON anomaly_alerts(severity);

-- ============================================================================
-- 6. POLICY SIMULATION
-- ============================================================================

CREATE TABLE policy_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'prevention', 'prosecution', 'support', 'education'
  impact_score DECIMAL(5, 2),
  estimated_cost TEXT,
  timeframe TEXT,
  confidence DECIMAL(3, 2),
  gbv_reduction_percent DECIMAL(5, 2),
  iterations INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policy_scenarios_category ON policy_scenarios(category);

CREATE TABLE simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES policy_scenarios(id) ON DELETE CASCADE,
  gbv_reduction_percent DECIMAL(5, 2),
  confidence DECIMAL(3, 2),
  cost_per_case_prevented TEXT,
  projected_outcomes TEXT, -- JSON
  iterations INTEGER,
  run_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_simulation_results_scenario ON simulation_results(scenario_id);

-- ============================================================================
-- 7. ETHICAL GOVERNANCE & AI OVERSIGHT
-- ============================================================================

CREATE TABLE governance_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  module TEXT NOT NULL, -- 'prediction', 'survivor_support', 'justice', 'policy'
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'deprecated'
  accuracy DECIMAL(3, 2),
  fairness_score DECIMAL(3, 2),
  drift_detected BOOLEAN DEFAULT FALSE,
  last_audit_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_governance_models_module ON governance_models(module);

CREATE TABLE fairness_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES governance_models(id) ON DELETE CASCADE,
  demographic_group TEXT, -- 'gender', 'age', 'region', 'socioeconomic'
  metric_name TEXT, -- 'demographic_parity', 'equalized_odds', 'calibration'
  metric_value DECIMAL(5, 2),
  status TEXT DEFAULT 'pass', -- 'pass', 'warning', 'fail'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fairness_metrics_model ON fairness_metrics(model_id);

CREATE TABLE bias_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES governance_models(id) ON DELETE CASCADE,
  finding TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'pass', 'warning', 'fail'
  recommendation TEXT,
  remediation_status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bias_reports_model ON bias_reports(model_id);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT,
  description TEXT,
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);

CREATE TABLE ethical_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  constraint_code TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  applies_to_modules TEXT[], 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. SYSTEM METRICS & MONITORING
-- ============================================================================

CREATE TABLE system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_incidents INTEGER DEFAULT 0,
  active_alerts INTEGER DEFAULT 0,
  survivors_supported INTEGER DEFAULT 0,
  models_deployed INTEGER DEFAULT 0,
  regions_monitored INTEGER DEFAULT 0,
  countries_active INTEGER DEFAULT 0,
  avg_response_time_seconds DECIMAL(10, 2),
  system_uptime_percent DECIMAL(5, 2),
  cases_processed INTEGER DEFAULT 0,
  conviction_rate DECIMAL(5, 2),
  avg_case_duration_days INTEGER,
  shelter_occupancy_percent DECIMAL(5, 2),
  agents_online INTEGER DEFAULT 0,
  api_requests_today INTEGER DEFAULT 0,
  data_points_processed TEXT,
  encryption_status TEXT DEFAULT 'active',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_metrics_date ON system_metrics(recorded_at);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'shelter', 'hotline', 'counselor', 'legal_aid', 'medical'
  name TEXT NOT NULL,
  description TEXT,
  contact_info TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  available_24_7 BOOLEAN DEFAULT FALSE,
  languages_spoken TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resources_region ON resources(region_id);
CREATE INDEX idx_resources_type ON resources(resource_type);

-- ============================================================================
-- 9. PRIVACY & SECURITY SETTINGS
-- ============================================================================

CREATE TABLE user_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'data_processing', 'analytics', 'third_party_sharing'
  granted BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_consent_user ON user_consent(user_id);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE survivors ENABLE ROW LEVEL SECURITY;
ALTER TABLE survivor_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE justice_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. VIEWS FOR ANALYTICS
-- ============================================================================

CREATE VIEW regional_incident_summary AS
SELECT 
  r.id,
  r.name,
  r.country,
  r.risk_level,
  r.risk_score,
  COUNT(i.id) as total_incidents,
  COUNT(CASE WHEN i.severity = 'critical' THEN 1 END) as critical_incidents,
  MAX(i.incident_date) as last_incident_date
FROM regions r
LEFT JOIN incidents i ON r.id = i.region_id
GROUP BY r.id, r.name, r.country, r.risk_level, r.risk_score;

CREATE VIEW justice_metrics AS
SELECT 
  jc.region_id,
  COUNT(jc.id) as total_cases,
  COUNT(CASE WHEN jc.status = 'closed' THEN 1 END) as closed_cases,
  COUNT(CASE WHEN c.verdict = 'guilty' THEN 1 END) as convictions,
  ROUND(100.0 * COUNT(CASE WHEN c.verdict = 'guilty' THEN 1 END) / NULLIF(COUNT(jc.id), 0), 2) as conviction_rate,
  ROUND(AVG(EXTRACT(DAY FROM (COALESCE(jc.closed_at, CURRENT_TIMESTAMP) - jc.created_at))), 0) as avg_case_duration
FROM justice_cases jc
LEFT JOIN convictions c ON jc.id = c.case_id
GROUP BY jc.region_id;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER) AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_count INTEGER;
BEGIN
  INSERT INTO api_rate_limits (identifier, window_start, request_count, updated_at)
  VALUES (p_identifier, v_now, 1, v_now)
  ON CONFLICT (identifier) DO UPDATE
  SET request_count = CASE
        WHEN api_rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::INTERVAL THEN 1
        ELSE api_rate_limits.request_count + 1
      END,
      window_start = CASE
        WHEN api_rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::INTERVAL THEN v_now
        ELSE api_rate_limits.window_start
      END,
      updated_at = v_now
  RETURNING api_rate_limits.request_count, api_rate_limits.window_start
  INTO v_count, v_window_start;

  allowed := v_count <= p_limit;
  remaining := GREATEST(p_limit - v_count, 0);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION purge_expired_chat_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM survivor_chat_sessions
  WHERE retention_expires_at IS NOT NULL AND retention_expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_deletion_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_request data_deletion_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM data_deletion_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'approved' THEN
    RETURN FALSE;
  END IF;

  IF v_request.survivor_id IS NOT NULL THEN
    DELETE FROM survivors WHERE id = v_request.survivor_id;
  END IF;

  UPDATE data_deletion_requests
  SET status = 'processed', processed_at = CURRENT_TIMESTAMP, processed_by = auth.uid()
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_survivors_updated_at BEFORE UPDATE ON survivors
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_survivor_chat_sessions_updated_at BEFORE UPDATE ON survivor_chat_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_escalation_reviews_updated_at BEFORE UPDATE ON escalation_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_deletion_requests_updated_at BEFORE UPDATE ON data_deletion_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_justice_cases_updated_at BEFORE UPDATE ON justice_cases
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_governance_models_updated_at BEFORE UPDATE ON governance_models
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
