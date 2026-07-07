-- ============================================================================
-- Audit coverage for police-portal queue mutations
-- ----------------------------------------------------------------------------
-- 011_audit_triggers.sql introduced audit_changes() and attached it to
-- user_profiles / survivors / chat tables / incidents — but the tables the
-- Police portal actually mutates in an emergency (escalation_events:
-- dispatch / escalate / acknowledge / delete, dispatches, case_reports) were
-- never covered. For accountability in a live GBV response every one of
-- those actions must leave an immutable audit_log row recording who did what.
--
-- Idempotent: safe to re-run. Guards with to_regclass in case a table is
-- absent in a given environment (same pattern 011 uses for optional tables).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.escalation_events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_escalation_events ON public.escalation_events;
    CREATE TRIGGER audit_escalation_events
    AFTER INSERT OR UPDATE OR DELETE ON public.escalation_events
    FOR EACH ROW
    EXECUTE FUNCTION audit_changes();
  END IF;

  IF to_regclass('public.dispatches') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_dispatches ON public.dispatches;
    CREATE TRIGGER audit_dispatches
    AFTER INSERT OR UPDATE OR DELETE ON public.dispatches
    FOR EACH ROW
    EXECUTE FUNCTION audit_changes();
  END IF;

  IF to_regclass('public.case_reports') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_case_reports ON public.case_reports;
    CREATE TRIGGER audit_case_reports
    AFTER INSERT OR UPDATE OR DELETE ON public.case_reports
    FOR EACH ROW
    EXECUTE FUNCTION audit_changes();
  END IF;
END $$;
