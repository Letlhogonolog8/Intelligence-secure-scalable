-- ============================================================================
-- Peer-support message flagging
-- ----------------------------------------------------------------------------
-- peer_support_messages only grants SELECT/INSERT to clients, so the mobile
-- "flag" action (UPDATE flagged = true) was silently rejected by RLS and
-- moderation reports went nowhere. Rather than granting broad UPDATE (which
-- would let any client edit message content), expose a SECURITY DEFINER
-- function that can do exactly one thing: mark a message as flagged.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.flag_peer_support_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.peer_support_messages
     SET flagged = TRUE
   WHERE id = p_message_id
     AND flagged = FALSE
  RETURNING TRUE;
$$;

REVOKE ALL ON FUNCTION public.flag_peer_support_message(UUID) FROM PUBLIC;
-- Peer support is intentionally anonymous (no user_id), so anon may flag too —
-- the same audience that may read and post.
GRANT EXECUTE ON FUNCTION public.flag_peer_support_message(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.flag_peer_support_message(UUID) IS
  'Marks one peer_support_messages row as flagged (moderation). Narrow SECURITY DEFINER instead of a broad UPDATE grant so clients cannot edit message content.';
