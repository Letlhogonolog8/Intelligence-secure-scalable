-- ============================================================================
-- SOS real-time delivery + out-of-app fan-out
-- ----------------------------------------------------------------------------
-- Makes an emergency SOS reach the right responders whether or not their
-- dashboard is open:
--   0. Ensures escalation_events exists with the columns the app actually writes
--      (user_id, escalation_type, location, severity, status, triggered_at) —
--      healing schema drift across earlier migrations. Columns are added
--      defensively so a pre-existing variant is upgraded in place.
--   1. escalation_events is published to Supabase Realtime so open dashboards
--      update instantly (no more polling-only path).
--   2. RLS scopes access: a survivor inserts/reads their own SOS; responders
--      read + acknowledge. Realtime only broadcasts rows a client may SELECT.
--   3. push_tokens stores device tokens for out-of-app delivery.
--   4. An AFTER INSERT trigger fans each new escalation out into
--      notification_queue as one push job per active responder device. The
--      notification worker drains the queue (Expo push + SMS), so an SOS is
--      delivered even when no browser tab is open.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Ensure escalation_events exists and matches what the app writes
-- ----------------------------------------------------------------------------
-- case_id is intentionally nullable with no FK: a panic SOS is raised before any
-- case exists. The web PanicButton and mobile sendSos both insert case_id = null.
CREATE TABLE IF NOT EXISTS public.escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  case_id UUID,
  escalation_type TEXT,
  severity TEXT NOT NULL DEFAULT 'critical',
  reason TEXT,
  location JSONB,
  status TEXT NOT NULL DEFAULT 'triggered',
  assigned_to UUID,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heal drifted/legacy variants: add any column the feature relies on if missing.
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS escalation_type TEXT;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS acknowledged_by UUID;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.escalation_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_escalation_events_user ON public.escalation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_status ON public.escalation_events(status);
CREATE INDEX IF NOT EXISTS idx_escalation_events_triggered_at ON public.escalation_events(triggered_at);

-- ----------------------------------------------------------------------------
-- 1. Realtime publication
-- ----------------------------------------------------------------------------
-- REPLICA IDENTITY FULL lets Realtime emit old-row values on UPDATE/DELETE,
-- which clients need to filter acknowledged/resolved transitions.
ALTER TABLE public.escalation_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Create the publication if this project predates Supabase's default one.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'escalation_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escalation_events;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. RLS — who may read/insert/update an escalation (drives Realtime scoping)
-- ----------------------------------------------------------------------------
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

-- A survivor may raise their own SOS (required: without an INSERT policy, RLS
-- would block the PanicButton/sendSos insert entirely).
DROP POLICY IF EXISTS "users_create_own_escalations" ON public.escalation_events;
CREATE POLICY "users_create_own_escalations"
  ON public.escalation_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- The survivor who triggered the SOS can follow its status.
DROP POLICY IF EXISTS "survivors_view_own_escalation_events" ON public.escalation_events;
CREATE POLICY "survivors_view_own_escalation_events"
  ON public.escalation_events FOR SELECT
  USING (user_id = auth.uid());

-- Responding roles see all open escalations (jurisdiction filtering is layered
-- on later once responder region columns are standardised across the schema).
DROP POLICY IF EXISTS "responders_view_escalations" ON public.escalation_events;
CREATE POLICY "responders_view_escalations"
  ON public.escalation_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active
        AND up.role IN ('police', 'counselor', 'ngo', 'chw', 'admin', 'analyst')
    )
  );

-- Responders can acknowledge/resolve.
DROP POLICY IF EXISTS "responders_update_escalations" ON public.escalation_events;
CREATE POLICY "responders_update_escalations"
  ON public.escalation_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active
        AND up.role IN ('police', 'counselor', 'ngo', 'chw', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.escalation_events TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. push_tokens — device registry for out-of-app delivery
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'expo'
    CHECK (platform IN ('expo', 'ios', 'android', 'web')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- A user manages only their own device tokens; the worker uses the service role
-- (which bypasses RLS) to read every responder's tokens for fan-out.
DROP POLICY IF EXISTS "users_manage_own_push_tokens" ON public.push_tokens;
CREATE POLICY "users_manage_own_push_tokens"
  ON public.push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Fan-out trigger: new escalation -> one push job per responder device
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_escalation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_ref TEXT;
  v_body TEXT;
BEGIN
  v_case_ref := COALESCE(NEW.case_id::TEXT, 'unknown');
  v_body := format(
    'AEGIS SOS (%s): emergency escalation on case %s. Open the portal to respond.',
    UPPER(COALESCE(NEW.severity, 'critical')),
    v_case_ref
  );

  -- One queue row per active responder device. recipient_type 'push' is drained
  -- by the notification worker via the Expo push API. Fan-out failures must
  -- never block the SOS itself, so the enqueue is best-effort.
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

DROP TRIGGER IF EXISTS trg_enqueue_escalation_notifications ON public.escalation_events;
CREATE TRIGGER trg_enqueue_escalation_notifications
  AFTER INSERT ON public.escalation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_escalation_notifications();

COMMENT ON FUNCTION public.enqueue_escalation_notifications() IS
  'Fans a new escalation_events row out into notification_queue as one push job per active responder device for out-of-app SOS delivery.';
