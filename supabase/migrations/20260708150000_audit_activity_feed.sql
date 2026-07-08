-- ============================================================================
-- Sanitized audit activity feed for responder portals
-- ----------------------------------------------------------------------------
-- Portal "recent activity" panels read the empty audit_logs table while the
-- audit triggers write to audit_log, whose rows carry full old/new values
-- (survivor PII) and are RLS-restricted to admins/own rows. This function
-- exposes ONLY sanitized fields (table, operation, actor role, timestamp) to
-- approved privileged responders so activity panels can show real platform
-- activity without leaking record contents.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recent_audit_activity(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  table_name TEXT,
  operation TEXT,
  user_role TEXT,
  changed_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.table_name, a.operation, a.user_role, a.changed_at
  FROM public.audit_log a
  WHERE public.is_privileged_responder()
  ORDER BY a.changed_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.recent_audit_activity(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_audit_activity(INTEGER) TO authenticated;
