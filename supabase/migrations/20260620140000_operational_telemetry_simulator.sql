-- ============================================================================
-- Operational telemetry producer (pg_cron simulator)
-- ----------------------------------------------------------------------------
-- The Admin/Police operational tables created in 20260620120000 are seeded but
-- static. This adds a scheduled producer that nudges their values every minute
-- so the dashboards move in realtime (uptime jitter, gateway latency drift,
-- message volume climbing, partner syncs refreshing, scheduled jobs rolling
-- over, storage growing, consent drift). Each UPDATE broadcasts via the
-- supabase_realtime publication, so subscribed dashboards update live.
--
-- IMPORTANT: this is SIMULATED movement, not measured telemetry — there is no
-- real infrastructure behind these tables yet. When real producers exist
-- (service health checks, storage metering, the actual job scheduler), point
-- them at these tables and disable this simulator:
--     SELECT cron.unschedule('aegis-ops-telemetry');
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.simulate_operational_telemetry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service uptime jitters within a healthy band.
  UPDATE public.platform_services
  SET uptime = LEAST(100, GREATEST(99.5, COALESCE(uptime, 99.95) + (random() - 0.5) * 0.03)),
      updated_at = now();

  -- Gateway latency drifts; 24h message volume climbs.
  UPDATE public.communication_gateways
  SET latency_ms   = GREATEST(60, COALESCE(latency_ms, 100) + (floor((random() - 0.5) * 24))::int),
      messages_24h = COALESCE(messages_24h, 0) + (floor(random() * 60))::int,
      updated_at   = now();

  -- Partner integrations re-sync; occasionally flip to "syncing".
  UPDATE public.partner_integrations
  SET last_sync_at = now() - (floor(random() * 8) || ' minutes')::interval,
      records      = COALESCE(records, 0) + (floor(random() * 25))::int,
      status       = CASE WHEN random() < 0.12 THEN 'syncing' ELSE 'synced' END,
      updated_at   = now();

  -- Scheduled jobs that are due roll over to their next run.
  UPDATE public.scheduled_jobs
  SET last_run_at = now(),
      next_run_at = now() + CASE WHEN frequency ILIKE '%hour%' THEN interval '1 hour' ELSE interval '1 day' END,
      updated_at  = now()
  WHERE next_run_at IS NULL OR next_run_at < now();

  -- Storage grows slowly, capped at total.
  UPDATE public.storage_metrics
  SET used_bytes = LEAST(total_bytes, used_bytes + (floor(random() * 150000000))::bigint),
      updated_at = now();

  -- Consent figures drift gently.
  UPDATE public.consent_metrics
  SET value = GREATEST(0, value + (floor((random() - 0.4) * 25))::int),
      updated_at = now();
  UPDATE public.consent_categories
  SET value = GREATEST(0, value + (floor((random() - 0.4) * 30))::int),
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_operational_telemetry() FROM PUBLIC;

-- Schedule it every minute (idempotent: unschedule any prior job of this name).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aegis-ops-telemetry') THEN
    PERFORM cron.unschedule('aegis-ops-telemetry');
  END IF;
  PERFORM cron.schedule(
    'aegis-ops-telemetry',
    '* * * * *',
    $cron$ SELECT public.simulate_operational_telemetry(); $cron$
  );
END
$$;
