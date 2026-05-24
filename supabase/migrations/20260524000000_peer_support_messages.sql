CREATE TABLE IF NOT EXISTS public.peer_support_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alias      TEXT        NOT NULL CHECK (char_length(alias) <= 100),
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 280),
  flagged    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_peer_support_messages_created_at
  ON public.peer_support_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_peer_support_messages_expires_at
  ON public.peer_support_messages (expires_at);

ALTER TABLE public.peer_support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "peer_support_read"   ON public.peer_support_messages;
DROP POLICY IF EXISTS "peer_support_insert" ON public.peer_support_messages;

CREATE POLICY "peer_support_read"
  ON public.peer_support_messages FOR SELECT
  TO anon, authenticated
  USING (flagged = FALSE);

CREATE POLICY "peer_support_insert"
  ON public.peer_support_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(content) BETWEEN 1 AND 280 AND
    char_length(alias)   BETWEEN 1 AND 100
  );

GRANT SELECT, INSERT ON public.peer_support_messages TO anon, authenticated;
GRANT ALL            ON public.peer_support_messages TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_support_messages;

COMMENT ON TABLE public.peer_support_messages IS
  'Fully anonymous peer support messages — no user_id stored. 7-day TTL. Realtime-enabled.';
