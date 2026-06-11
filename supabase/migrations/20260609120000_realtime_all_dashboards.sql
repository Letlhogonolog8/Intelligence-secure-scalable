-- ============================================================================
-- Enable Supabase Realtime for every dashboard table
-- ----------------------------------------------------------------------------
-- The web data layer already subscribes to postgres_changes for these tables
-- (useRealtimeQuery in src/data/aegisData.ts and the useLive* hooks in
-- src/data/liveDashboardData.ts). But a subscription only receives events if the
-- table is in the `supabase_realtime` publication — otherwise the hooks fall
-- back to interval polling. This adds each dashboard table to the publication
-- and sets REPLICA IDENTITY FULL (so UPDATE/DELETE carry old-row values), making
-- every dashboard update in real time instead of on a 15–30s timer.
--
-- Safe: only real base tables that exist are touched; views, missing tables, and
-- tables already published are skipped. Realtime still honours RLS, so each
-- client only receives rows it is permitted to SELECT. Idempotent.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  candidate_tables TEXT[] := ARRAY[
    -- analytics / command center
    'regions', 'system_metrics', 'alerts_feed', 'continental_stats',
    'incident_timeseries', 'risk_trend_data', 'incidents', 'risk_predictions',
    'anomaly_alerts', 'region_incident_types', 'region_forecasts',
    -- governance / analyst
    'policy_scenarios', 'fairness_metrics', 'governance_models', 'audit_logs',
    'bias_reports', 'ethical_constraints', 'justice_convictions',
    'justice_bottlenecks', 'data_deletion_requests',
    -- casework / responders
    'justice_cases', 'case_reports', 'escalation_reviews', 'organization_coordination',
    'survivor_chat_sessions', 'safety_plans', 'resources',
    -- directory / org
    'user_profiles', 'organizations', 'survivors', 'police_departments',
    'ngo_programs',
    -- notifications / devices
    'notification_queue', 'push_tokens'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY candidate_tables LOOP
    -- Only real base tables (relkind 'r') in the public schema can be published.
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        RAISE NOTICE 'Realtime enabled for public.%', t;
      END IF;
    END IF;
  END LOOP;
END
$$;
