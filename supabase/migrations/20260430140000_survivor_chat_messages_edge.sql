-- Encrypted survivor chat rows written by the aegis-survivor-chat Edge Function
-- (separate from legacy chat_messages tied to survivor_chat_sessions UUIDs).

CREATE TABLE IF NOT EXISTS public.survivor_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_encrypted TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  risk_level TEXT,
  emotion_detected TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_survivor_chat_messages_user_id
  ON public.survivor_chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_survivor_chat_messages_session_id
  ON public.survivor_chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_survivor_chat_messages_expires_at
  ON public.survivor_chat_messages(expires_at);

ALTER TABLE public.survivor_chat_messages ENABLE ROW LEVEL SECURITY;

-- Survivors can delete their own edge-stored chat history (POPIA erasure via API).
DROP POLICY IF EXISTS "survivor_chat_messages_owner_delete" ON public.survivor_chat_messages;
CREATE POLICY "survivor_chat_messages_owner_delete"
  ON public.survivor_chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "survivor_chat_messages_owner_select" ON public.survivor_chat_messages;
CREATE POLICY "survivor_chat_messages_owner_select"
  ON public.survivor_chat_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, DELETE ON public.survivor_chat_messages TO authenticated;
GRANT ALL ON public.survivor_chat_messages TO service_role;

COMMENT ON TABLE public.survivor_chat_messages IS
  'AES-GCM ciphertext chunks from aegis-survivor-chat; service_role inserts, users may SELECT/DELETE own rows.';
