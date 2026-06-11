-- ============================================================================
-- Bridge: escalation_events -> alerts_feed
-- ----------------------------------------------------------------------------
-- The mobile app and web PanicButton write SOS rows to escalation_events, but
-- the web responder dashboards (Police, Command Center) read their alert feed
-- from alerts_feed. Without a bridge, a real SOS never appears on the web.
--
-- This redefines the escalation trigger function to ALSO insert an alerts_feed
-- row on each new escalation, so the SOS flows into the existing web feeds and
-- the useEscalationRealtime hook surfaces it instantly. The push fan-out is
-- preserved. Each side-effect is best-effort so it can never block the SOS.
--
-- Idempotent: safe to re-run.
-- ============================================================================

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

  -- Extract GPS from the jsonb location ({ "lat": .., "lng": .. }) if present.
  v_lat := NEW.location->>'lat';
  v_lng := NEW.location->>'lng';
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    v_location_text := format('Location: %s, %s', v_lat, v_lng);
    v_map_link := format('https://maps.google.com/?q=%s,%s', v_lat, v_lng);
  END IF;

  v_alert_message := CASE
    WHEN v_location_text IS NOT NULL
      THEN format(
        'A survivor triggered an emergency SOS from the mobile app. %s — %s',
        v_location_text, v_map_link
      )
    ELSE 'A survivor triggered an emergency SOS from the mobile app (no GPS location captured).'
  END;

  v_body := format(
    'AEGIS SOS (%s): emergency escalation on case %s. %s Open the portal to respond.',
    UPPER(v_severity),
    v_case_ref,
    COALESCE(v_map_link || ' ', '')
  );

  -- (1) Surface on the web responder feed (Police / Command Center read this).
  BEGIN
    INSERT INTO public.alerts_feed (time, type, message, module, severity, status, created_at)
    VALUES (
      to_char(timezone('UTC', NOW()), 'YYYY-MM-DD HH24:MI'),
      'sos_alert',
      v_alert_message,
      'police',
      v_severity,
      'pending',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'escalation -> alerts_feed bridge failed: %', SQLERRM;
  END;

  -- (2) Out-of-app fan-out: one push job per active responder device.
  BEGIN
    INSERT INTO public.notification_queue (
      recipient_type, recipient_address, message_type, message_content,
      case_id, user_id, status, attempt_count, max_attempts, created_at
    )
    SELECT
      'push',
      pt.token,
      'escalation',
      v_body,
      v_case_ref,
      pt.user_id,
      'pending',
      0,
      5,
      NOW()
    FROM public.push_tokens pt
    JOIN public.user_profiles up ON up.id = pt.user_id
    WHERE pt.is_active
      AND up.is_active
      AND up.role IN ('police', 'counselor', 'ngo', 'chw', 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'escalation notification fan-out failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger already exists from the prior migration; re-assert idempotently.
DROP TRIGGER IF EXISTS trg_enqueue_escalation_notifications ON public.escalation_events;
CREATE TRIGGER trg_enqueue_escalation_notifications
  AFTER INSERT ON public.escalation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_escalation_notifications();

COMMENT ON FUNCTION public.enqueue_escalation_notifications() IS
  'On new escalation: writes an alerts_feed row for the web responder dashboards and enqueues one push job per active responder device. Both side-effects are best-effort.';
