-- ============================================================================
-- Allow police/admin to delete escalation events (queue cleanup)
-- ----------------------------------------------------------------------------
-- Responders can already acknowledge/update escalations; this adds a DELETE
-- policy so police/admin can clear out old or test incidents from the queue.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "police_delete_escalations" ON public.escalation_events;
CREATE POLICY "police_delete_escalations"
  ON public.escalation_events FOR DELETE
  TO authenticated
  USING (public.has_approved_role('police') OR public.is_admin());

GRANT DELETE ON public.escalation_events TO authenticated;
