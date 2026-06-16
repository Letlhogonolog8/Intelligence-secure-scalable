-- ============================================================================
-- Resources geo columns — enable nearest-first sorting & precise directions
-- ----------------------------------------------------------------------------
-- The canonical schema (001_create_aegis_schema.sql) already defines
-- resources.latitude / resources.longitude, but some live databases were
-- created from an older/legacy resources definition that lacks them (the same
-- drift seen with escalation_events / alerts_feed). The mobile Resources screen
-- now reads coordinates to compute haversine distance and sort by nearest, so
-- heal the table defensively.
--
-- Idempotent & non-destructive: only adds columns when missing.
-- ============================================================================

ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 8);
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
-- Optional human-readable address for display and as a maps fallback.
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS address   TEXT;

-- Helps "services near me" range scans once coordinates are populated.
CREATE INDEX IF NOT EXISTS idx_resources_lat_lng
  ON public.resources (latitude, longitude);

COMMENT ON COLUMN public.resources.latitude IS
  'WGS84 latitude; used by the mobile app for nearest-first distance sorting.';
COMMENT ON COLUMN public.resources.longitude IS
  'WGS84 longitude; used by the mobile app for nearest-first distance sorting.';
