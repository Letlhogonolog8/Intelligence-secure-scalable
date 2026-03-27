ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  current_menu VARCHAR(50) NOT NULL DEFAULT 'main',
  current_state VARCHAR(50),
  menu_level INTEGER DEFAULT 0,
  user_input TEXT DEFAULT '',
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cases (
  id TEXT PRIMARY KEY,
  case_number TEXT UNIQUE,
  phone_number VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'ussd',
  status TEXT NOT NULL DEFAULT 'submitted',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  source_session_id VARCHAR(255) REFERENCES public.ussd_sessions(session_id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_phone_number ON public.cases(phone_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id TEXT PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  help_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'ussd',
  status TEXT NOT NULL DEFAULT 'received',
  source_session_id VARCHAR(255) REFERENCES public.ussd_sessions(session_id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_phone_number ON public.emergency_requests(phone_number);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON public.emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_created_at ON public.emergency_requests(created_at DESC);

ALTER TABLE public.ussd_sessions
  ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS current_menu VARCHAR(50) NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone_number ON public.ussd_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_is_active ON public.ussd_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_session_id ON public.ussd_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_last_accessed_at ON public.ussd_sessions(last_accessed_at DESC);

DO $$
DECLARE
  state_data_type TEXT;
BEGIN
  SELECT data_type
  INTO state_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'ussd_sessions'
    AND column_name = 'state';

  IF state_data_type IS NOT NULL AND state_data_type <> 'jsonb' THEN
    EXECUTE $sql$
      ALTER TABLE public.ussd_sessions
      ALTER COLUMN state TYPE JSONB
      USING CASE
        WHEN state IS NULL OR BTRIM(state::text, '"') = '' THEN '{}'::jsonb
        WHEN LEFT(BTRIM(state::text, '"'), 1) IN ('{', '[') THEN BTRIM(state::text, '"')::jsonb
        ELSE jsonb_build_object('value', state::text)
      END
    $sql$;
  END IF;
END $$;

DO $$
DECLARE
  has_current_state BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ussd_sessions' AND column_name = 'current_state'
  ) INTO has_current_state;

  IF has_current_state THEN
    EXECUTE $sql$
      UPDATE public.ussd_sessions
      SET current_menu = COALESCE(NULLIF(current_menu, ''), current_state, 'main'),
          state = COALESCE(state, metadata, '{}'::jsonb),
          last_accessed_at = COALESCE(last_accessed_at, last_activity, updated_at, created_at, NOW()),
          language = COALESCE(NULLIF(language, ''), 'en')
    $sql$;
  ELSE
    UPDATE public.ussd_sessions
    SET current_menu = COALESCE(NULLIF(current_menu, ''), 'main'),
        state = COALESCE(state, metadata, '{}'::jsonb),
        last_accessed_at = COALESCE(last_accessed_at, last_activity, updated_at, created_at, NOW()),
        language = COALESCE(NULLIF(language, ''), 'en');
  END IF;
END $$;

CREATE OR REPLACE VIEW public.profiles
WITH (security_invoker = true) AS
SELECT
  id,
  organization_id,
  role,
  full_name,
  phone,
  is_active,
  COALESCE(is_available, true) AS is_available,
  lat,
  lng,
  created_at,
  updated_at
FROM public.user_profiles;

DO $$
DECLARE
  has_available_24_7 BOOLEAN;
  has_languages_spoken BOOLEAN;
  has_updated_at BOOLEAN;
  shelters_sql TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'available_24_7'
  ) INTO has_available_24_7;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'languages_spoken'
  ) INTO has_languages_spoken;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'updated_at'
  ) INTO has_updated_at;

  shelters_sql := 'CREATE OR REPLACE VIEW public.shelters WITH (security_invoker = true) AS '
    || 'SELECT '
    || 'r.id, '
    || 'r.name, '
    || 'r.contact_info AS phone, '
    || 'COALESCE(r.description, rg.name, ''Available shelter resource'') AS location, '
    || 'r.latitude AS lat, '
    || 'r.longitude AS lng, '
    || 'COALESCE(rg.name, ''Unknown region'') AS region, '
    || 'r.region_id, '
    || CASE WHEN has_available_24_7 THEN 'r.available_24_7' ELSE 'false' END || ' AS available_24_7, '
    || CASE WHEN has_languages_spoken THEN 'r.languages_spoken' ELSE 'ARRAY[]::text[]' END || ' AS languages_spoken, '
    || 'r.created_at, '
    || CASE WHEN has_updated_at THEN 'r.updated_at' ELSE 'r.created_at' END || ' AS updated_at '
    || 'FROM public.resources r '
    || 'LEFT JOIN public.regions rg ON rg.id = r.region_id '
    || 'WHERE r.resource_type = ''shelter''';

  EXECUTE shelters_sql;
END $$;

CREATE OR REPLACE FUNCTION public.sync_case_defaults()
RETURNS TRIGGER AS $$
BEGIN
  NEW.case_number := COALESCE(NULLIF(NEW.case_number, ''), NEW.id);
  NEW.updated_at := COALESCE(NEW.updated_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_case_defaults ON public.cases;
CREATE TRIGGER trg_sync_case_defaults
BEFORE INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.sync_case_defaults();

CREATE OR REPLACE FUNCTION public.touch_emergency_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_emergency_request_updated_at ON public.emergency_requests;
CREATE TRIGGER trg_touch_emergency_request_updated_at
BEFORE UPDATE ON public.emergency_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_emergency_request_updated_at();
