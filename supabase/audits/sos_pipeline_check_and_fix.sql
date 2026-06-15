-- ============================================================================
-- SOS pipeline — diagnose & fix
-- ----------------------------------------------------------------------------
-- Symptom: a survivor triggers SOS (or files a report) but it never shows in
-- the Police "Realtime alert queue" / Command Center "Live Alert Feed".
--
-- Flow that must work end-to-end, all on the SAME Supabase project the web app
-- points at:
--   escalation_events INSERT  ->  trigger  ->  alerts_feed INSERT  ->  feed read
--
-- PART 1 is READ-ONLY (diagnose). PART 2 MUTATES (fix) and is idempotent.
-- Run PART 1 first; only run PART 2 if PART 1 shows a broken link.
-- ============================================================================


-- ============================== PART 1 — DIAGNOSE ===========================

-- 1a-i. What columns does the LIVE escalation_events table actually have?
--       (The app/types expect: id, case_id, triggered_by, user_id,
--       escalation_type, severity, reason, location, status, triggered_at,
--       created_at, ... — if any are MISSING, the live DB is behind the
--       migrations and the SOS trigger / CHW visit feature will misbehave.)
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'escalation_events'
ORDER  BY ordinal_position;

-- 1a-ii. Did the SOS actually land in this database? (SELECT * = column-agnostic)
--        If EMPTY: the SOS insert never reached THIS project — check the
--        mobile/web app's SUPABASE_URL points here, and that escalation_events
--        RLS/migrations are applied (INSERT policy needs user_id = auth.uid()).
SELECT * FROM public.escalation_events LIMIT 5;

-- 1b. Did the bridge create a feed row for it?
--     If 1a-ii has rows but this is EMPTY: the bridge trigger is missing or
--     failed -> run PART 2.
SELECT * FROM public.alerts_feed WHERE type = 'sos_alert' LIMIT 5;

-- 1c. Does the bridge trigger exist on escalation_events?
--     If EMPTY: the trigger was never created -> run PART 2.
SELECT t.tgname        AS trigger_name,
       p.proname       AS function_name,
       t.tgenabled     AS enabled  -- 'O' = enabled
FROM   pg_trigger t
JOIN   pg_class  c ON c.oid = t.tgrelid
JOIN   pg_namespace n ON n.oid = c.relnamespace
JOIN   pg_proc   p ON p.oid = t.tgfoid
WHERE  n.nspname = 'public'
  AND  c.relname = 'escalation_events'
  AND  NOT t.tgisinternal;

-- 1d. Are the two feed tables in the realtime publication?
--     If in_realtime = false: the feed only updates when you click Refresh /
--     on the poll timer, not instantly -> PART 2 enables live.
SELECT x.tablename,
       (pt.tablename IS NOT NULL) AS in_realtime
FROM  (VALUES ('escalation_events'), ('alerts_feed')) AS x(tablename)
LEFT  JOIN pg_publication_tables pt
       ON pt.pubname='supabase_realtime' AND pt.schemaname='public'
      AND pt.tablename = x.tablename;


-- ============================== PART 2 — FIX (idempotent) ===================
-- Safe to re-run. Mirrors migration 20260609100000 (bridge) +
-- 20260609120000 (realtime). Run this if PART 1 showed a missing trigger
-- and/or in_realtime = false.

-- 2a-0. PREREQUISITE — heal drifted feed schema.
--       Some DBs were created from an older alerts_feed definition missing
--       `severity`/`status`. Because the bridge's INSERT is wrapped in
--       EXCEPTION WHEN OTHERS (best-effort), that missing column made every SOS
--       alert insert fail SILENTLY — the trigger fired but no row appeared.
--       Add any missing columns so the bridge + backfill below actually work.
ALTER TABLE public.alerts_feed ADD COLUMN IF NOT EXISTS severity        TEXT DEFAULT 'medium';
ALTER TABLE public.alerts_feed ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'pending';
ALTER TABLE public.alerts_feed ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.alerts_feed ADD COLUMN IF NOT EXISTS acknowledged_by UUID;
ALTER TABLE public.alerts_feed ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now();

-- 2a. (Re)create the bridge: every new escalation writes an alerts_feed row
--     (SECURITY DEFINER so it bypasses RLS) and fans out push jobs.
CREATE OR REPLACE FUNCTION public.enqueue_escalation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_ref TEXT;
  v_severity TEXT;
  v_body TEXT;
  v_lat TEXT;
  v_lng TEXT;
  v_location_text TEXT;
  v_map_link TEXT;
  v_alert_message TEXT;
BEGIN
  v_case_ref := COALESCE(NEW.case_id::TEXT, 'unknown');
  v_severity := COALESCE(NEW.severity, 'critical');

  v_lat := NEW.location->>'lat';
  v_lng := NEW.location->>'lng';
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    v_location_text := format('Location: %s, %s', v_lat, v_lng);
    v_map_link := format('https://maps.google.com/?q=%s,%s', v_lat, v_lng);
  END IF;

  v_alert_message := CASE
    WHEN v_location_text IS NOT NULL
      THEN format('A survivor triggered an emergency SOS from the mobile app. %s — %s',
                  v_location_text, v_map_link)
    ELSE 'A survivor triggered an emergency SOS from the mobile app (no GPS location captured).'
  END;

  v_body := format('AEGIS SOS (%s): emergency escalation on case %s. %s Open the portal to respond.',
                   UPPER(v_severity), v_case_ref, COALESCE(v_map_link || ' ', ''));

  BEGIN
    INSERT INTO public.alerts_feed (time, type, message, module, severity, status, created_at)
    VALUES (to_char(timezone('UTC', NOW()), 'YYYY-MM-DD HH24:MI'),
            'sos_alert', v_alert_message, 'police', v_severity, 'pending', NOW());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'escalation -> alerts_feed bridge failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.notification_queue (
      recipient_type, recipient_address, message_type, message_content,
      case_id, user_id, status, attempt_count, max_attempts, created_at)
    SELECT 'push', pt.token, 'escalation', v_body, v_case_ref, pt.user_id,
           'pending', 0, 5, NOW()
    FROM public.push_tokens pt
    JOIN public.user_profiles up ON up.id = pt.user_id
    WHERE pt.is_active AND up.is_active
      AND up.role IN ('police', 'counselor', 'ngo', 'chw', 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'escalation notification fan-out failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_escalation_notifications ON public.escalation_events;
CREATE TRIGGER trg_enqueue_escalation_notifications
  AFTER INSERT ON public.escalation_events
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_escalation_notifications();

-- 2b. Enable realtime + full row images on both feed tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  EXECUTE 'ALTER TABLE public.escalation_events REPLICA IDENTITY FULL';
  EXECUTE 'ALTER TABLE public.alerts_feed       REPLICA IDENTITY FULL';
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public'
                   AND tablename='escalation_events') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.escalation_events';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public'
                   AND tablename='alerts_feed') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts_feed';
  END IF;
END $$;

-- 2c. Backfill: create feed rows for any recent SOS that predates the trigger,
--     so existing escalations show up too (last 7 days, not already bridged).
INSERT INTO public.alerts_feed (time, type, message, module, severity, status, created_at)
SELECT to_char(timezone('UTC', e.created_at), 'YYYY-MM-DD HH24:MI'),
       'sos_alert',
       'A survivor triggered an emergency SOS from the mobile app.',
       'police',
       COALESCE(e.severity, 'critical'),
       'pending',
       e.created_at
FROM   public.escalation_events e
WHERE  e.created_at > NOW() - INTERVAL '7 days'
  AND  NOT EXISTS (
        SELECT 1 FROM public.alerts_feed a
        WHERE a.type='sos_alert' AND a.created_at = e.created_at);

-- After PART 2: re-run PART 1 (1b should now show rows) and click Refresh on
-- the Police dashboard. New SOS events will appear live from here on.
