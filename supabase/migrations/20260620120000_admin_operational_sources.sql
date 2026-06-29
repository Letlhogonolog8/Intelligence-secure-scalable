-- ============================================================================
-- Admin Portal operational data sources
-- ----------------------------------------------------------------------------
-- The Admin portal's operational panels (Service Control, Communications
-- Gateway, Partner Sync, Scheduled Jobs, Storage & Usage, Compliance Standards,
-- Consent Management) had no backing tables — they rendered sample data. This
-- creates real tables for them so the panels run on live, realtime data like
-- the rest of the platform.
--
-- These are platform-operations rows (no survivor data). Read access is
-- restricted to admins via public.is_admin(); writes are service-role only
-- (a telemetry producer / cron populates them — see note at the bottom).
-- Each table is added to the supabase_realtime publication with REPLICA
-- IDENTITY FULL so the dashboards update the moment a row changes.
--
-- Idempotent: safe to re-run. Seed rows only insert when a table is empty.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. platform_services  (Service Control + System Health)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'healthy',
  uptime NUMERIC(6,3),
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_services (name, description, icon, status, uptime, sort)
SELECT v.name, v.description, v.icon, v.status, v.uptime, v.sort
FROM (VALUES
  ('Authentication Service', 'User authentication & authorization', 'ShieldCheck', 'healthy', 99.98, 1),
  ('Notification Service', 'Alerts, emails & push notifications', 'Bell', 'healthy', 99.95, 2),
  ('AI Engine', 'AI processing & inference', 'Brain', 'healthy', 99.96, 3),
  ('Translation Service', 'Language translation & processing', 'Globe', 'healthy', 99.94, 4),
  ('File Storage', 'File storage & asset management', 'HardDrive', 'healthy', 99.97, 5),
  ('Real-Time Engine', 'Real-time data & event streaming', 'Activity', 'healthy', 99.96, 6)
) AS v(name, description, icon, status, uptime, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_services);

-- ---------------------------------------------------------------------------
-- 2. communication_gateways  (Communications Gateway)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'operational',
  latency_ms INT,
  messages_24h INT,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.communication_gateways (name, description, icon, status, latency_ms, messages_24h, sort)
SELECT v.name, v.description, v.icon, v.status, v.latency_ms, v.messages_24h, v.sort
FROM (VALUES
  ('SMS Connector', 'Twilio SMS Gateway', 'MessageSquare', 'operational', 120, 12842, 1),
  ('WhatsApp Connector', 'Meta WhatsApp Business API', 'MessageSquare', 'operational', 98, 8421, 2),
  ('USSD Connector', 'Africa''s Talking USSD', 'Smartphone', 'operational', 150, 3210, 3),
  ('Email Connector', 'SMTP Email Service', 'Mail', 'operational', 110, 9156, 4)
) AS v(name, description, icon, status, latency_ms, messages_24h, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.communication_gateways);

-- ---------------------------------------------------------------------------
-- 3. partner_integrations  (Partner Sync Status)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'synced',
  last_sync_at TIMESTAMPTZ,
  records INT,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.partner_integrations (name, description, status, last_sync_at, records, sort)
SELECT v.name, v.description, v.status, NOW() - (v.mins || ' minutes')::interval, v.records, v.sort
FROM (VALUES
  ('Home Affairs', 'Identity Verification', 'synced', 2, 4821, 1),
  ('Banks API', 'Financial Data', 'synced', 5, 12410, 2),
  ('Telco Providers', 'Subscriber Data', 'synced', 7, 18593, 3),
  ('Credit Bureaus', 'Credit Reporting', 'syncing', 12, 6231, 4),
  ('Law Enforcement', 'Watchlist Data', 'synced', 15, 2114, 5)
) AS v(name, description, status, mins, records, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.partner_integrations);

-- ---------------------------------------------------------------------------
-- 4. scheduled_jobs  (Scheduled Jobs / Maintenance Tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  job_type TEXT,
  frequency TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.scheduled_jobs (name, job_type, frequency, next_run_at, last_run_at, status, sort)
SELECT v.name, v.job_type, v.frequency, NOW() + (v.next_h || ' hours')::interval, NOW() - (v.last_h || ' hours')::interval, 'scheduled', v.sort
FROM (VALUES
  ('User Session Cleanup', 'Maintenance', 'Every 1 hour', 1, 1, 1),
  ('Database Backup', 'Backup', 'Daily', 3, 12, 2),
  ('Audit Log Rotation', 'Maintenance', 'Daily', 4, 12, 3),
  ('Analytics Data Aggregation', 'Processing', 'Daily', 5, 12, 4),
  ('System Health Report', 'Report', 'Daily', 6, 12, 5)
) AS v(name, job_type, frequency, next_h, last_h, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.scheduled_jobs);

-- ---------------------------------------------------------------------------
-- 5. storage_metrics  (Storage & Usage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.storage_metrics (label, used_bytes, total_bytes, sort)
SELECT v.label, v.used, v.total, v.sort
FROM (VALUES
  ('Total Storage Used', 2694881279180, 10995116277760, 1),
  ('File Storage', 1451355348173, 5497558138880, 2),
  ('Database Storage', 1242846493901, 5497558138880, 3)
) AS v(label, used, total, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.storage_metrics);

-- ---------------------------------------------------------------------------
-- 6. compliance_standards  (Compliance Standards + Compliance Overview)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  score INT,
  status TEXT NOT NULL DEFAULT 'compliant',
  color TEXT,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.compliance_standards (name, description, score, status, color, sort)
SELECT v.name, v.description, v.score, v.status, v.color, v.sort
FROM (VALUES
  ('POPIA Compliance', 'Protection of Personal Information Act', 96, 'compliant', '#8b5cf6', 1),
  ('GDPR Compliance', 'General Data Protection Regulation', 94, 'compliant', '#3b82f6', 2),
  ('ISO 27001', 'Information Security Management', 88, 'compliant', '#f59e0b', 3),
  ('Audit Readiness', 'Internal Audit Preparedness', 82, 'in_progress', '#10b981', 4)
) AS v(name, description, score, status, color, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_standards);

-- ---------------------------------------------------------------------------
-- 7. consent_metrics  (Consent Management status breakdown)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value INT NOT NULL DEFAULT 0,
  color TEXT,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.consent_metrics (name, value, color, sort)
SELECT v.name, v.value, v.color, v.sort
FROM (VALUES
  ('Active Consent', 32145, '#10b981', 1),
  ('Expired Consent', 7842, '#f59e0b', 2),
  ('Withdrawn Consent', 5231, '#f97316', 3),
  ('Pending Consent', 2319, '#ec4899', 4),
  ('No Consent Record', 700, '#64748b', 5)
) AS v(name, value, color, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.consent_metrics);

-- ---------------------------------------------------------------------------
-- 8. consent_categories  (Top Consent Categories)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value INT NOT NULL DEFAULT 0,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.consent_categories (name, value, sort)
SELECT v.name, v.value, v.sort
FROM (VALUES
  ('Marketing Communications', 18432, 1),
  ('Service Personalization', 12876, 2),
  ('Analytics & Insights', 8345, 3),
  ('Third-Party Sharing', 4721, 4),
  ('Product Improvement', 3263, 5)
) AS v(name, value, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.consent_categories);

-- ---------------------------------------------------------------------------
-- RLS: admins read; writes are service-role only (bypasses RLS).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'platform_services', 'communication_gateways', 'partner_integrations',
    'scheduled_jobs', 'storage_metrics', 'compliance_standards',
    'consent_metrics', 'consent_categories'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin_read_%1$s" ON public.%1$s', t);
    EXECUTE format(
      'CREATE POLICY "admin_read_%1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_admin())',
      t
    );
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);

    -- Realtime: REPLICA IDENTITY FULL + add to publication (idempotent).
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

-- ============================================================================
-- NOTE: these tables are seeded with representative values so the panels work
-- immediately and update in realtime when rows change. To make them reflect
-- *live* telemetry over time, a producer (edge function / cron) should UPDATE
-- them on a schedule (service uptime, gateway latency, storage usage, job runs,
-- partner sync timestamps). The data layer + realtime are ready for that.
-- ============================================================================
