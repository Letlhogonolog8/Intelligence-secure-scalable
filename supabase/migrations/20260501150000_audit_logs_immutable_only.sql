-- =====================================================================
-- audit_logs_immutable — minimal, dependency-free.
-- =====================================================================
--
-- Why a separate migration:
--   The full migration `20260222_phase1_core_architecture.sql` creates
--   12 tables in one transaction, several of which have foreign keys to
--   `case_reports`. On environments where prerequisite migrations have
--   not been applied, that file fails with:
--     ERROR: 42P01: relation "case_reports" does not exist
--   This file extracts only the audit-chain table so the immutable
--   audit log can be deployed independently of the rest of phase 1.
--
-- After running this:
--   * The application's hash-chained audit writes (auditLog.ts) will
--     succeed.
--   * The 6-hourly background job (runAuditChainCheck) will report
--     "Audit chain verification succeeded" instead of being skipped.
--
-- Idempotent: safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs_immutable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  resource_type VARCHAR(50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  hash VARCHAR(64) NOT NULL UNIQUE,
  previous_hash VARCHAR(64)
);

ALTER TABLE public.audit_logs_immutable ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs_immutable'
      AND policyname = 'audit_logs_insert_only'
  ) THEN
    CREATE POLICY "audit_logs_insert_only" ON public.audit_logs_immutable
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs_immutable'
      AND policyname = 'audit_logs_read_own'
  ) THEN
    CREATE POLICY "audit_logs_read_own" ON public.audit_logs_immutable
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs_immutable'
      AND policyname = 'audit_logs_no_update'
  ) THEN
    CREATE POLICY "audit_logs_no_update" ON public.audit_logs_immutable
      FOR UPDATE USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs_immutable'
      AND policyname = 'audit_logs_no_delete'
  ) THEN
    CREATE POLICY "audit_logs_no_delete" ON public.audit_logs_immutable
      FOR DELETE USING (false);
  END IF;
END $$;

-- Optional admin/analyst read-all policy. Only added if a user_profiles
-- table with a role column already exists; otherwise skipped silently
-- so the migration runs on a fresh Supabase too.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_profiles'
      AND column_name  = 'role'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_logs_immutable'
      AND policyname = 'audit_logs_read_admin_analyst'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "audit_logs_read_admin_analyst" ON public.audit_logs_immutable
        FOR SELECT USING (
          auth.uid() IN (
            SELECT id FROM public.user_profiles
            WHERE role IN ('admin', 'analyst')
          )
        )
    $POL$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_user_created
  ON public.audit_logs_immutable(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_action_created
  ON public.audit_logs_immutable(action, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_module_created
  ON public.audit_logs_immutable(module, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_resource_id
  ON public.audit_logs_immutable(resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_hash
  ON public.audit_logs_immutable(hash);

GRANT SELECT ON public.audit_logs_immutable TO authenticated;

COMMENT ON TABLE public.audit_logs_immutable IS
  'Immutable hash-chained audit log for POPIA / GDPR compliance. Append-only.';
