-- ============================================================================
-- Partner referrals — live data source for Police portal Partner Coordination
-- ----------------------------------------------------------------------------
-- The Partner Coordination board (KPIs, referral table, pending actions)
-- previously rendered only MOCK_* sample rows. This table records real
-- referrals from responders to partner organizations (NGO, counselor,
-- shelter, hospital, legal) so the board reflects actual coordination work.
--
-- RLS: responders read; police/ngo/counselor/admin create and update.
-- Realtime: published so boards update live across responders.
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference TEXT,
  partner_type TEXT NOT NULL CHECK (
    partner_type IN ('ngo', 'counselor', 'shelter', 'hospital', 'legal')
  ),
  organization_name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  service_requested TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'in_progress', 'completed', 'declined')
  ),
  next_action TEXT,
  due_at TIMESTAMPTZ,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_status
  ON public.partner_referrals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_type
  ON public.partner_referrals(partner_type);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responders_read_partner_referrals" ON public.partner_referrals;
CREATE POLICY "responders_read_partner_referrals"
  ON public.partner_referrals FOR SELECT
  TO authenticated
  USING (public.is_responder());

DROP POLICY IF EXISTS "responders_insert_partner_referrals" ON public.partner_referrals;
CREATE POLICY "responders_insert_partner_referrals"
  ON public.partner_referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_approved_role('police')
      OR public.has_approved_role('ngo')
      OR public.has_approved_role('counselor')
      OR public.is_admin()
    )
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "responders_update_partner_referrals" ON public.partner_referrals;
CREATE POLICY "responders_update_partner_referrals"
  ON public.partner_referrals FOR UPDATE
  TO authenticated
  USING (
    public.has_approved_role('police')
    OR public.has_approved_role('ngo')
    OR public.has_approved_role('counselor')
    OR public.is_admin()
  )
  WITH CHECK (
    public.has_approved_role('police')
    OR public.has_approved_role('ngo')
    OR public.has_approved_role('counselor')
    OR public.is_admin()
  );

GRANT SELECT, INSERT, UPDATE ON public.partner_referrals TO authenticated;

-- Stream board changes to every responder in real time.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'partner_referrals'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_referrals;
    END IF;
  END IF;
END $$;

-- Referrals carry survivor-adjacent case context: audit every change.
DROP TRIGGER IF EXISTS audit_partner_referrals ON public.partner_referrals;
CREATE TRIGGER audit_partner_referrals
AFTER INSERT OR UPDATE OR DELETE ON public.partner_referrals
FOR EACH ROW
EXECUTE FUNCTION audit_changes();
