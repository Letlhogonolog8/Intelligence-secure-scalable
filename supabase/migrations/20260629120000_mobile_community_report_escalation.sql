-- ============================================================================
-- Mobile community reports -> escalation pipeline
-- ----------------------------------------------------------------------------
-- Community members can file reports from the mobile app using
-- report_method = 'community_mobile'. This makes those reports visible to the
-- responder community-report queue and creates an escalation_events row so the
-- existing alerts_feed/push fan-out bridge notifies responders.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.case_reports
  ADD COLUMN IF NOT EXISTS reporter_relationship TEXT;

DROP POLICY IF EXISTS "responders_read_community_reports" ON public.case_reports;
CREATE POLICY "responders_read_community_reports"
  ON public.case_reports FOR SELECT
  TO authenticated
  USING (
    public.is_responder()
    AND report_method IN ('community_web', 'community_mobile')
  );

CREATE OR REPLACE FUNCTION public.escalate_mobile_case_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_severity TEXT;
  v_type TEXT;
BEGIN
  IF NEW.report_method NOT IN ('in_app', 'community_mobile') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.escalation_events ee
    WHERE ee.case_id = NEW.id
      AND ee.escalation_type IN ('mobile_incident_report', 'community_mobile_report')
  ) THEN
    RETURN NEW;
  END IF;

  v_severity := lower(COALESCE(NEW.risk_level, NEW.priority, 'medium'));
  IF v_severity NOT IN ('critical', 'high', 'medium', 'low') THEN
    v_severity := 'medium';
  END IF;

  v_type := CASE
    WHEN NEW.report_method = 'community_mobile' THEN 'community_mobile_report'
    ELSE 'mobile_incident_report'
  END;

  INSERT INTO public.escalation_events (
    case_id,
    user_id,
    escalation_type,
    severity,
    reason,
    location,
    status,
    triggered_at,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.reported_by,
    v_type,
    v_severity,
    format('Mobile report submitted%s', COALESCE(' (' || NEW.reporter_relationship || ')', '')),
    NEW.location,
    'triggered',
    NOW(),
    jsonb_build_object(
      'report_method', NEW.report_method,
      'reporter_relationship', NEW.reporter_relationship,
      'category', NEW.category,
      'priority', NEW.priority
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escalate_mobile_case_report ON public.case_reports;
CREATE TRIGGER trg_escalate_mobile_case_report
  AFTER INSERT ON public.case_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.escalate_mobile_case_report();

COMMENT ON FUNCTION public.escalate_mobile_case_report() IS
  'On mobile case report insert, creates an escalation_events row so responder alerts/push fan-out run.';
