-- ============================================================================
-- Counseling sessions — live data source for the Counselor portal
-- ----------------------------------------------------------------------------
-- The Counselor portal's Sessions workspace (and the NGO Counseling section)
-- previously rendered only MOCK_* sample rows. This table records real
-- scheduled/completed counseling sessions so calendars, KPIs and session
-- actions reflect actual work.
--
-- RLS: responders read; counselors/ngo/admin create and update their own.
-- Realtime: published so calendars update live.
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.counseling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  case_reference TEXT,
  survivor_alias TEXT,
  session_type TEXT NOT NULL DEFAULT 'individual' CHECK (
    session_type IN ('individual', 'group', 'family', 'crisis', 'follow_up')
  ),
  mode TEXT NOT NULL DEFAULT 'virtual' CHECK (
    mode IN ('virtual', 'in_person', 'phone')
  ),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')
  ),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counseling_sessions_counselor
  ON public.counseling_sessions(counselor_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_status
  ON public.counseling_sessions(status, scheduled_at);

ALTER TABLE public.counseling_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_counseling_sessions" ON public.counseling_sessions;
CREATE POLICY "responders_read_counseling_sessions"
  ON public.counseling_sessions FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "counselors_insert_counseling_sessions" ON public.counseling_sessions;
CREATE POLICY "counselors_insert_counseling_sessions"
  ON public.counseling_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_approved_role('counselor')
      OR public.has_approved_role('ngo')
      OR public.is_admin()
    )
    AND counselor_id = auth.uid()
  );

DROP POLICY IF EXISTS "counselors_update_own_counseling_sessions" ON public.counseling_sessions;
CREATE POLICY "counselors_update_own_counseling_sessions"
  ON public.counseling_sessions FOR UPDATE
  TO authenticated
  USING (counselor_id = auth.uid() OR public.is_admin())
  WITH CHECK (counselor_id = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.counseling_sessions TO authenticated;

-- Stream calendar changes to every responder in real time.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'counseling_sessions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_sessions;
    END IF;
  END IF;
END $$;

-- Sessions carry survivor-adjacent context: audit every change.
DROP TRIGGER IF EXISTS audit_counseling_sessions ON public.counseling_sessions;
CREATE TRIGGER audit_counseling_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.counseling_sessions
FOR EACH ROW
EXECUTE FUNCTION audit_changes();
