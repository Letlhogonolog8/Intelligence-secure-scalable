-- ============================================================================
-- AEGIS — Production-readiness audit (READ-ONLY)
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (or psql) against the LIVE database to
-- verify what actually applied, vs. what the migration files intend. It makes
-- NO changes. Work top-to-bottom; anything flagged ⛔ is a launch blocker.
--
-- HOW TO RUN: the Supabase SQL editor only shows the LAST statement's result.
-- So run ONE section at a time — highlight just that section's query (down to
-- its semicolon) and press Ctrl/Cmd+Enter. Each section is numbered below.
--
-- Why this exists: migration files describe intent, but this project has
-- already hit a "marked-applied-but-never-run" case, so live state must be
-- confirmed directly before going to real-time production with real PII.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS ENABLED?  ⛔ Any sensitive table with rls_enabled = false is a leak.
-- ----------------------------------------------------------------------------
SELECT c.relname              AS table_name,
       c.relrowsecurity       AS rls_enabled,
       c.relforcerowsecurity  AS rls_forced
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  c.relkind = 'r'
  AND  c.relname IN (
        'survivors','case_reports','escalation_events','survivor_chat_sessions',
        'survivor_chat_messages','safety_plans','escalation_reviews','evidence_consents',
        'voice_evidence','voice_evidence_translations','justice_cases',
        'organization_coordination','audit_logs','audit_logs_immutable',
        'user_profiles','organizations','push_tokens','notification_queue',
        'data_deletion_requests','peer_support_messages')
ORDER  BY rls_enabled, table_name;

-- ----------------------------------------------------------------------------
-- 2. OVER-PERMISSIVE POLICIES  ⛔ qual='true' / no role restriction on a
--    sensitive table = everyone who can reach the API can read those rows.
--    Pay special attention to: survivors, audit_logs_immutable, case_reports.
-- ----------------------------------------------------------------------------
SELECT p.tablename,
       p.policyname,
       p.cmd                              AS command,
       p.roles                            AS granted_to,
       p.qual                             AS using_expression,
       p.with_check                       AS check_expression
FROM   pg_policies p
WHERE  p.schemaname = 'public'
  AND  p.tablename IN (
        'survivors','case_reports','escalation_events','survivor_chat_sessions',
        'survivor_chat_messages','safety_plans','escalation_reviews','evidence_consents',
        'voice_evidence','justice_cases','organization_coordination',
        'audit_logs','audit_logs_immutable','user_profiles','organizations')
ORDER  BY p.tablename, p.cmd, p.policyname;

-- 2a. KNOWN SUSPECTS — these two showed up in the static migration audit.
--     If either returns a row, treat as a blocker and tighten before launch.

-- (i) survivors: the base policy "survivors_view_own_data" uses
--     `OR anonymous_id IS NOT NULL`, which lets ANY authenticated user read
--     every survivor row that has an anonymous_id. Expect this to appear:
SELECT 'survivors leak?' AS check, policyname, qual
FROM   pg_policies
WHERE  schemaname='public' AND tablename='survivors'
  AND  qual ILIKE '%anonymous_id is not null%';

-- (ii) audit_logs_immutable: phase-1 created "audit_logs_read_only USING(true)";
--      the hardening migration added a scoped policy but did NOT drop the old
--      one. If the USING(true) policy is still present, all audit logs are
--      world-readable to any authenticated user:
SELECT 'audit world-readable?' AS check, policyname, qual
FROM   pg_policies
WHERE  schemaname='public' AND tablename='audit_logs_immutable'
  AND  cmd='SELECT' AND (qual = 'true' OR qual IS NULL);

-- ----------------------------------------------------------------------------
-- 3. TABLES WITH RLS ENABLED BUT *NO* POLICIES  (deny-all — breaks features,
--    not a leak, but explains "empty dashboard / stuck skeleton" symptoms).
-- ----------------------------------------------------------------------------
SELECT c.relname AS table_name_rls_on_but_no_policies
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
  AND  NOT EXISTS (SELECT 1 FROM pg_policies p
                   WHERE p.schemaname='public' AND p.tablename=c.relname)
ORDER  BY 1;

-- ----------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION  — which app-subscribed tables actually emit live
--    events. Missing here = that dashboard silently degrades to polling.
-- ----------------------------------------------------------------------------
WITH expected(tablename) AS (
  VALUES ('regions'),('system_metrics'),('alerts_feed'),('continental_stats'),
         ('incident_timeseries'),('incidents'),('risk_predictions'),
         ('anomaly_alerts'),('region_incident_types'),('region_forecasts'),
         ('fairness_metrics'),('governance_models'),('justice_cases'),
         ('justice_convictions'),('justice_bottlenecks'),('case_reports'),
         ('escalation_events'),('organization_coordination'),
         ('survivor_chat_sessions'),('safety_plans'),('resources'),
         ('user_profiles'),('peer_support_messages'),('voice_evidence')
)
SELECT e.tablename,
       (pt.tablename IS NOT NULL) AS in_supabase_realtime
FROM   expected e
LEFT   JOIN pg_publication_tables pt
       ON pt.pubname='supabase_realtime'
      AND pt.schemaname='public'
      AND pt.tablename=e.tablename
ORDER  BY in_supabase_realtime, e.tablename;

-- ----------------------------------------------------------------------------
-- 5. REPLICA IDENTITY  — UPDATE/DELETE realtime events need FULL (or a unique
--    index) to carry row data. 'd' (default) on a published table = thin events.
-- ----------------------------------------------------------------------------
SELECT c.relname AS table_name,
       CASE c.relreplident WHEN 'f' THEN 'FULL'
                           WHEN 'd' THEN 'default'
                           WHEN 'i' THEN 'index'
                           WHEN 'n' THEN 'nothing' END AS replica_identity
FROM   pg_class c
JOIN   pg_namespace n ON n.oid=c.relnamespace
WHERE  n.nspname='public' AND c.relkind='r'
  AND  c.relname IN (SELECT tablename FROM pg_publication_tables
                     WHERE pubname='supabase_realtime' AND schemaname='public')
ORDER  BY replica_identity, table_name;

-- ----------------------------------------------------------------------------
-- 6. ROW COUNTS  — is the dashboard data real, or just seeded demo rows?
--    EXACT counts (planner estimates show -1 for never-analyzed tables, which
--    looks empty but isn't). Check escalation_events / alerts_feed here to
--    confirm your SOS test actually landed and was bridged.
-- ----------------------------------------------------------------------------
SELECT 'regions'                AS table_name, count(*) AS rows FROM public.regions
UNION ALL SELECT 'incidents',               count(*) FROM public.incidents
UNION ALL SELECT 'incident_timeseries',     count(*) FROM public.incident_timeseries
UNION ALL SELECT 'continental_stats',       count(*) FROM public.continental_stats
UNION ALL SELECT 'justice_cases',           count(*) FROM public.justice_cases
UNION ALL SELECT 'justice_convictions',     count(*) FROM public.justice_convictions
UNION ALL SELECT 'justice_bottlenecks',     count(*) FROM public.justice_bottlenecks
UNION ALL SELECT 'case_reports',            count(*) FROM public.case_reports
UNION ALL SELECT 'escalation_events',       count(*) FROM public.escalation_events
UNION ALL SELECT 'alerts_feed',             count(*) FROM public.alerts_feed
UNION ALL SELECT 'survivors',               count(*) FROM public.survivors
UNION ALL SELECT 'survivor_chat_sessions',  count(*) FROM public.survivor_chat_sessions
UNION ALL SELECT 'anomaly_alerts',          count(*) FROM public.anomaly_alerts
UNION ALL SELECT 'governance_models',       count(*) FROM public.governance_models
UNION ALL SELECT 'fairness_metrics',        count(*) FROM public.fairness_metrics
UNION ALL SELECT 'region_forecasts',        count(*) FROM public.region_forecasts
UNION ALL SELECT 'risk_predictions',        count(*) FROM public.risk_predictions
ORDER BY rows DESC, table_name;
