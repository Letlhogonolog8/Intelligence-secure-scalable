CREATE TABLE survivor_location_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES survivors(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT DEFAULT 'v1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE case_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID REFERENCES survivors(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  risk_level TEXT NOT NULL DEFAULT 'low',
  risk_score DECIMAL(5, 2) DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  description TEXT,
  encrypted_location TEXT,
  location_iv TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES case_reports(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL,
  risk_score DECIMAL(5, 2) NOT NULL,
  factors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE coordination_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES case_reports(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notified_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE survivor_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES survivors(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL,
  risk_score DECIMAL(5, 2) NOT NULL,
  factors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ussd_sessions (
  session_id TEXT PRIMARY KEY,
  phone_number TEXT,
  state TEXT,
  last_input TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE survivors
  ADD COLUMN full_name TEXT,
  ADD COLUMN survivor_code TEXT UNIQUE,
  ADD COLUMN phone_number TEXT,
  ADD COLUMN email TEXT,
  ADD COLUMN emergency_contact TEXT,
  ADD COLUMN consent_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN consented_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_case_reports_survivor ON case_reports(survivor_id);
CREATE INDEX idx_case_reports_status ON case_reports(status);
CREATE INDEX idx_case_reports_risk ON case_reports(risk_level);
CREATE INDEX idx_risk_assessments_case ON risk_assessments(case_id);
CREATE INDEX idx_coordination_events_case ON coordination_events(case_id);
CREATE INDEX idx_survivor_risk_profiles_survivor ON survivor_risk_profiles(survivor_id);
CREATE INDEX idx_ussd_sessions_phone ON ussd_sessions(phone_number);
CREATE INDEX idx_survivor_location_records_survivor ON survivor_location_records(survivor_id);
