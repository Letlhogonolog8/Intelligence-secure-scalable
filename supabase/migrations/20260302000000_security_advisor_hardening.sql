DO $$
BEGIN
  IF to_regprocedure('public.encrypt_text(text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.encrypt_text(TEXT, TEXT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.decrypt_text(text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.decrypt_text(TEXT, TEXT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.encrypt_user_profile_pii()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.encrypt_user_profile_pii() SET search_path = public';
  END IF;

  IF to_regprocedure('public.encrypt_survivor_pii()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.encrypt_survivor_pii() SET search_path = public';
  END IF;

  IF to_regprocedure('public.get_audit_trail(uuid,text,integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_audit_trail(UUID, TEXT, INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.get_user_activity(uuid,integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_user_activity(UUID, INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.get_table_activity(text,timestamp with time zone,integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_table_activity(TEXT, TIMESTAMPTZ, INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.cleanup_old_audit_logs(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_old_audit_logs(INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.cleanup_old_chat_messages(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_old_chat_messages(INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.cleanup_old_incidents(integer,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_old_incidents(INT, TEXT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.cleanup_old_case_assignments(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_old_case_assignments(INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.cleanup_old_logs(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_old_logs(INT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.execute_retention_cleanup()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.execute_retention_cleanup() SET search_path = public';
  END IF;

  IF to_regprocedure('public.anonymize_survivor_data(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.anonymize_survivor_data(UUID) SET search_path = public';
  END IF;

  IF to_regprocedure('public.delete_survivor_data(uuid,boolean)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.delete_survivor_data(UUID, BOOLEAN) SET search_path = public';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'user_profiles_decrypted'
  ) THEN
    EXECUTE 'ALTER VIEW public.user_profiles_decrypted SET (security_invoker = true)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'retention_policies'
  ) THEN
    ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS retention_policies_service_role_all ON public.retention_policies;
    CREATE POLICY retention_policies_service_role_all ON public.retention_policies
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);
  END IF;
END $$;