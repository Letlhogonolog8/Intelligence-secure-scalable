-- =============================================================================
-- Analyst Intelligence tables
-- Backs the Data Analyst Portal panels that previously had no data source:
-- demographics, reporting channels, hotspot emergence, forecast metadata,
-- report library/schedule, dataset catalog + quality, and per-user settings.
-- Readable by analysts and admins; writes restricted to admins/service role.
-- Seed data mirrors the approved mock-up so panels populate immediately.
-- =============================================================================

-- Helper guards (no-ops if the role helpers already exist from earlier migrations).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_analyst') THEN
    CREATE FUNCTION public.is_analyst() RETURNS boolean LANGUAGE sql STABLE AS
      $fn$ SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'analyst' $fn$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS
      $fn$ SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin' $fn$;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. incident_age_groups — age / risk-group distribution
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_age_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. reporting_channels — how incidents are reported
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. hotspot_emergence — new / escalated / de-escalated hotspots over time
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotspot_emergence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_label TEXT NOT NULL,
  period_start DATE,
  new_hotspots INTEGER NOT NULL DEFAULT 0,
  escalated INTEGER NOT NULL DEFAULT 0,
  deescalated INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 4. forecast_metrics — single-row forecast KPI snapshot
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_metrics (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  forecast_accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  expected_growth NUMERIC(5,2) NOT NULL DEFAULT 0,
  high_risk_regions INTEGER NOT NULL DEFAULT 0,
  projected_demand INTEGER NOT NULL DEFAULT 0,
  model_confidence INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. forecast_scenarios — scenario comparison
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_cases INTEGER NOT NULL DEFAULT 0,
  change_pct NUMERIC(6,2),
  confidence INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 6. forecast_variables — top influential model variables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  impact TEXT NOT NULL DEFAULT 'Medium',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 7. analyst_reports — report library + scheduled deliveries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analyst_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'Completed',
  owner TEXT,
  scheduled BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT,
  recipients INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  next_delivery DATE
);

-- ----------------------------------------------------------------------------
-- 8. dataset_catalog — connected datasets, freshness, quality, schema
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dataset_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  source TEXT,
  region TEXT DEFAULT 'All Regions',
  records BIGINT NOT NULL DEFAULT 0,
  freshness_minutes INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Live',
  connector_status TEXT NOT NULL DEFAULT 'Connected',
  schema_status TEXT NOT NULL DEFAULT 'Up to date',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. data_quality_alerts — flagged dataset issues
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_quality_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'Low',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 10. analyst_settings — per-user analyst preferences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analyst_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Row-level security
-- =============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'incident_age_groups','reporting_channels','hotspot_emergence',
    'forecast_metrics','forecast_scenarios','forecast_variables',
    'analyst_reports','dataset_catalog','data_quality_alerts'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "analyst_admin_read_%1$s" ON public.%1$I;', t);
    EXECUTE format(
      'CREATE POLICY "analyst_admin_read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_analyst() OR public.is_admin());',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "admin_write_%1$s" ON public.%1$I;', t);
    EXECUTE format(
      'CREATE POLICY "admin_write_%1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());',
      t
    );
  END LOOP;
END $$;

ALTER TABLE public.analyst_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_rw_analyst_settings" ON public.analyst_settings;
CREATE POLICY "owner_rw_analyst_settings" ON public.analyst_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- Realtime (best-effort; ignore if already published)
-- =============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'incident_age_groups','reporting_channels','hotspot_emergence',
    'forecast_metrics','forecast_scenarios','forecast_variables',
    'analyst_reports','dataset_catalog','data_quality_alerts'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

-- =============================================================================
-- Seed data (idempotent — only seeds a table when it is empty)
-- =============================================================================
INSERT INTO public.incident_age_groups (label, value, sort_order)
SELECT * FROM (VALUES
  ('0-17',1142,1),('18-24',2316,2),('25-34',2684,3),
  ('35-44',1876,4),('45-54',1021,5),('55+',623,6)
) v(label,value,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.incident_age_groups);

INSERT INTO public.reporting_channels (channel, value, pct, color, sort_order)
SELECT * FROM (VALUES
  ('Hotline',3667,42,'#a855f7',1),('Mobile App',2094,24,'#06b6d4',2),
  ('In-Person',1396,16,'#ec4899',3),('Web Portal',872,10,'#f59e0b',4),
  ('Community Report',523,6,'#10b981',5),('Other',190,2,'#64748b',6)
) v(channel,value,pct,color,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.reporting_channels);

INSERT INTO public.hotspot_emergence (bucket_label, new_hotspots, escalated, deescalated, sort_order)
SELECT 'W'||g, 22 + (g % 7), 14 - (g % 4), 8 + (g % 3), g
FROM generate_series(1,13) g
WHERE NOT EXISTS (SELECT 1 FROM public.hotspot_emergence);

INSERT INTO public.forecast_metrics (id, forecast_accuracy, expected_growth, high_risk_regions, projected_demand, model_confidence)
SELECT 1, 87, 18.7, 23, 12640, 82
WHERE NOT EXISTS (SELECT 1 FROM public.forecast_metrics);

INSERT INTO public.forecast_scenarios (name, total_cases, change_pct, confidence, color, is_current, sort_order)
SELECT * FROM (VALUES
  ('Baseline (Current Trend)',2150,NULL::numeric,82,'#a855f7',TRUE,1),
  ('Improved Response Capacity',1720,-20.0,78,'#06b6d4',FALSE,2),
  ('Increased Community Outreach',1810,-15.8,76,'#10b981',FALSE,3),
  ('Deteriorating Conditions',2720,26.5,75,'#f43f5e',FALSE,4)
) v(name,total_cases,change_pct,confidence,color,is_current,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.forecast_scenarios);

INSERT INTO public.forecast_variables (name, impact, sort_order)
SELECT * FROM (VALUES
  ('Weekend / Holiday Indicator','High',1),('Economic Hardship Index','High',2),
  ('Previous 4-Week Incidents','High',3),('School Term Calendar','Medium',4),
  ('Sexual Violence Reports','Medium',5),('Weather Extremes','Low',6)
) v(name,impact,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.forecast_variables);

INSERT INTO public.analyst_reports (name, type, region, status, owner, scheduled, frequency, recipients, generated_at, next_delivery)
SELECT * FROM (VALUES
  ('GBV Incident Report – May 2024','Incident Report','East Africa','Completed','Naledi M.',FALSE,NULL,NULL,now() - interval '2 hours',NULL::date),
  ('High-Risk Hotspots – April 2024','Hotspot Report','West Africa','Completed','James K.',FALSE,NULL,NULL,now() - interval '1 day',NULL),
  ('GBV Risk Forecast – Q2 2024','Forecast Report','Multi-Region','In Progress','Amina H.',FALSE,NULL,NULL,now() - interval '1 day',NULL),
  ('Executive Summary – April 2024','Executive Summary','Southern Africa','Completed','Naledi M.',FALSE,NULL,NULL,now() - interval '2 days',NULL),
  ('NGO/Police Briefing – Kinshasa','NGO/Police Briefing','DRC','Completed','Patrick L.',FALSE,NULL,NULL,now() - interval '2 days',NULL),
  ('GBV Incident Report','Incident Report','East Africa','Active','System',TRUE,'Weekly',12,now(),CURRENT_DATE + 3),
  ('High-Risk Hotspots','Hotspot Report','West Africa','Active','System',TRUE,'Weekly',18,now(),CURRENT_DATE + 3),
  ('GBV Risk Forecast','Forecast Report','Multi-Region','Active','System',TRUE,'Monthly',15,now(),CURRENT_DATE + 14),
  ('Executive Summary','Executive Summary','Southern Africa','Active','System',TRUE,'Monthly',22,now(),CURRENT_DATE + 14),
  ('NGO/Police Briefing','NGO/Police Briefing','DRC','Active','System',TRUE,'Bi-Weekly',10,now(),CURRENT_DATE + 5)
) v(name,type,region,status,owner,scheduled,frequency,recipients,generated_at,next_delivery)
WHERE NOT EXISTS (SELECT 1 FROM public.analyst_reports);

INSERT INTO public.dataset_catalog (name, description, source, records, freshness_minutes, quality_score, status, connector_status, schema_status, sort_order)
SELECT * FROM (VALUES
  ('Incident Reports','GBV incidents and survivor reports','Case Management System',128742,10,95,'Live','Connected','Up to date',1),
  ('Shelter Referrals','Shelter intake and referral data','Shelter Management System',45316,25,91,'Live','Connected','Up to date',2),
  ('Counseling Sessions','Psychosocial support sessions','MHPSS Platform',67892,35,93,'Live','Connected','Up to date',3),
  ('Police Intake','Police reports and intake data','Police MIS',33417,60,86,'Live','Connected','Schema change',4),
  ('Community Reports','Community feedback and alerts','Community Reporting App',21903,120,78,'Live','Connected','Up to date',5),
  ('Hotline Data','Helpline calls and case logs','Hotline System',58884,180,88,'Live','Connected','Up to date',6)
) v(name,description,source,records,freshness_minutes,quality_score,status,connector_status,schema_status,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.dataset_catalog);

INSERT INTO public.data_quality_alerts (dataset_name, description, severity)
SELECT * FROM (VALUES
  ('Police Intake','Missing values in 3 critical fields','High'),
  ('Community Reports','Duplicate records detected','Medium'),
  ('Hotline Data','Old records exceeding freshness SLA','Medium'),
  ('Shelter Referrals','Invalid referral outcome codes','Low')
) v(dataset_name,description,severity)
WHERE NOT EXISTS (SELECT 1 FROM public.data_quality_alerts);
