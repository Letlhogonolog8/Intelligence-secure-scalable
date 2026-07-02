-- ============================================================================
-- Survivor-initiated "message my case team" conversation
-- ----------------------------------------------------------------------------
-- Survivors don't know (and shouldn't pick) responder user ids. This RPC lets a
-- survivor open a secure conversation seeded with themselves + the officers who
-- have engaged their incidents (escalation_events.acknowledged_by). Runs as
-- SECURITY DEFINER so it can add participants the survivor can't enumerate.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_survivor_case_team_conversation(
  p_subject TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_uid UUID := auth.uid();
  v_officer UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.secure_conversations (subject, created_by)
  VALUES (NULLIF(p_subject, ''), v_uid)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.secure_conversation_participants (conversation_id, user_id, role)
  VALUES (
    v_conversation_id,
    v_uid,
    (SELECT role FROM public.user_profiles WHERE id = v_uid)
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Seed with the responders who acknowledged this survivor's incidents.
  FOR v_officer IN
    SELECT DISTINCT ee.acknowledged_by
    FROM public.escalation_events ee
    WHERE ee.user_id = v_uid
      AND ee.acknowledged_by IS NOT NULL
  LOOP
    INSERT INTO public.secure_conversation_participants (conversation_id, user_id, role)
    VALUES (
      v_conversation_id,
      v_officer,
      (SELECT role FROM public.user_profiles WHERE id = v_officer)
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_survivor_case_team_conversation(TEXT)
  TO authenticated;
