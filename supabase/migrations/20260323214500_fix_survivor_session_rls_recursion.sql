CREATE OR REPLACE FUNCTION public.current_user_survivor_id()
RETURNS UUID AS $$
DECLARE
  survivor_uuid UUID;
BEGIN
  SELECT id INTO survivor_uuid
  FROM public.survivors
  WHERE user_id = auth.uid()
  LIMIT 1;

  RETURN survivor_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF to_regclass('public.survivor_chat_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "survivors_view_own_sessions" ON public.survivor_chat_sessions;
    CREATE POLICY "survivors_view_own_sessions"
      ON public.survivor_chat_sessions FOR SELECT
      USING (survivor_id = public.current_user_survivor_id());
  END IF;
END $$;
