-- ============================================================================
-- Secure cross-role messaging (police, survivors, NGOs, counselors, admin)
-- ----------------------------------------------------------------------------
-- Real-time participant-scoped conversations. Access is governed by RLS; a
-- SECURITY DEFINER membership helper avoids recursive policy evaluation, and a
-- SECURITY DEFINER RPC bootstraps a conversation + its participants atomically
-- (side-stepping the create-then-add-self chicken-and-egg problem).
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.secure_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  case_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.secure_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.secure_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.secure_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.secure_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secure_participants_user
  ON public.secure_conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_secure_participants_conversation
  ON public.secure_conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_secure_messages_conversation
  ON public.secure_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_secure_conversations_last_message
  ON public.secure_conversations(last_message_at DESC);

-- Membership helper. SECURITY DEFINER so policies can call it without the
-- participants table's own RLS recursing back into itself.
CREATE OR REPLACE FUNCTION public.is_secure_conversation_participant(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.secure_conversation_participants p
    WHERE p.conversation_id = p_conversation_id
      AND p.user_id = auth.uid()
  );
$$;

ALTER TABLE public.secure_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: readable by participants; created via RPC (below).
DROP POLICY IF EXISTS "secure_conversations_select" ON public.secure_conversations;
CREATE POLICY "secure_conversations_select" ON public.secure_conversations
  FOR SELECT TO authenticated
  USING (public.is_secure_conversation_participant(id));

DROP POLICY IF EXISTS "secure_conversations_insert" ON public.secure_conversations;
CREATE POLICY "secure_conversations_insert" ON public.secure_conversations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Participants: visible to co-participants; an existing participant may add more.
DROP POLICY IF EXISTS "secure_participants_select"
  ON public.secure_conversation_participants;
CREATE POLICY "secure_participants_select"
  ON public.secure_conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_secure_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "secure_participants_insert"
  ON public.secure_conversation_participants;
CREATE POLICY "secure_participants_insert"
  ON public.secure_conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_secure_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "secure_participants_update_own"
  ON public.secure_conversation_participants;
CREATE POLICY "secure_participants_update_own"
  ON public.secure_conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages: readable and writable only by conversation participants.
DROP POLICY IF EXISTS "secure_messages_select" ON public.secure_messages;
CREATE POLICY "secure_messages_select" ON public.secure_messages
  FOR SELECT TO authenticated
  USING (public.is_secure_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "secure_messages_insert" ON public.secure_messages;
CREATE POLICY "secure_messages_insert" ON public.secure_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_secure_conversation_participant(conversation_id)
  );

-- Bump conversation activity on each new message (drives thread ordering).
CREATE OR REPLACE FUNCTION public.touch_secure_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.secure_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_secure_conversation ON public.secure_messages;
CREATE TRIGGER trg_touch_secure_conversation
  AFTER INSERT ON public.secure_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_secure_conversation();

-- Atomic conversation bootstrap: create the conversation and seed the creator
-- plus the given participants in one privileged step.
CREATE OR REPLACE FUNCTION public.start_secure_conversation(
  p_subject TEXT,
  p_case_id TEXT,
  p_participants UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_uid UUID := auth.uid();
  v_participant UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.secure_conversations (subject, case_id, created_by)
  VALUES (NULLIF(p_subject, ''), NULLIF(p_case_id, ''), v_uid)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.secure_conversation_participants (conversation_id, user_id, role)
  VALUES (
    v_conversation_id,
    v_uid,
    (SELECT role FROM public.user_profiles WHERE id = v_uid)
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  IF p_participants IS NOT NULL THEN
    FOREACH v_participant IN ARRAY p_participants LOOP
      IF v_participant IS NOT NULL AND v_participant <> v_uid THEN
        INSERT INTO public.secure_conversation_participants (conversation_id, user_id, role)
        VALUES (
          v_conversation_id,
          v_participant,
          (SELECT role FROM public.user_profiles WHERE id = v_participant)
        )
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_conversation_id;
END;
$$;

GRANT SELECT, INSERT ON public.secure_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.secure_conversation_participants TO authenticated;
GRANT SELECT, INSERT ON public.secure_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_secure_conversation(TEXT, TEXT, UUID[]) TO authenticated;

-- Realtime for live message delivery.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'secure_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.secure_messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'secure_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.secure_conversations;
    END IF;
  END IF;
END $$;
