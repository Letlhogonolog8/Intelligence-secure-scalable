-- ============================================================================
-- Dispatch: response units + dispatches
-- ----------------------------------------------------------------------------
-- Real dispatch operations for the Police portal. Responders see units and
-- active dispatches; police/admin create and advance dispatches and toggle
-- unit availability. Both tables stream via realtime.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dispatch_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  region TEXT,
  active_officers INTEGER NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.dispatch_units(id) ON DELETE SET NULL,
  case_reference TEXT,
  escalation_id UUID,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'assigned',
  eta_minutes INTEGER,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatches_status
  ON public.dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_created
  ON public.dispatches(created_at DESC);

ALTER TABLE public.dispatch_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;

-- Units: responders read; police/admin manage.
DROP POLICY IF EXISTS "responders_read_units" ON public.dispatch_units;
CREATE POLICY "responders_read_units"
  ON public.dispatch_units FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "police_manage_units" ON public.dispatch_units;
CREATE POLICY "police_manage_units"
  ON public.dispatch_units FOR UPDATE
  TO authenticated
  USING (public.has_approved_role('police') OR public.is_admin())
  WITH CHECK (public.has_approved_role('police') OR public.is_admin());

-- Dispatches: responders read; police/admin insert + update.
DROP POLICY IF EXISTS "responders_read_dispatches" ON public.dispatches;
CREATE POLICY "responders_read_dispatches"
  ON public.dispatches FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "police_insert_dispatches" ON public.dispatches;
CREATE POLICY "police_insert_dispatches"
  ON public.dispatches FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_approved_role('police') OR public.is_admin())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "police_update_dispatches" ON public.dispatches;
CREATE POLICY "police_update_dispatches"
  ON public.dispatches FOR UPDATE
  TO authenticated
  USING (public.has_approved_role('police') OR public.is_admin())
  WITH CHECK (public.has_approved_role('police') OR public.is_admin());

GRANT SELECT, UPDATE ON public.dispatch_units TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dispatches TO authenticated;

-- A small fleet so the board is operable out of the box.
INSERT INTO public.dispatch_units (unit_code, label, status, region, active_officers)
VALUES
  ('G47', 'Unit G47', 'available', 'Gauteng', 2),
  ('WC12', 'Unit WC12', 'available', 'Western Cape', 2),
  ('KZN08', 'Unit KZN08', 'available', 'KwaZulu-Natal', 2),
  ('LP15', 'Unit LP15', 'offline', 'Limpopo', 0),
  ('MP03', 'Unit MP03', 'available', 'Mpumalanga', 2),
  ('FS21', 'Unit FS21', 'available', 'Free State', 2)
ON CONFLICT (unit_code) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'dispatches'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatches;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'dispatch_units'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_units;
    END IF;
  END IF;
END $$;
