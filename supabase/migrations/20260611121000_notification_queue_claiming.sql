-- ============================================================================
-- Notification queue: atomic row claiming
-- ----------------------------------------------------------------------------
-- processPendingNotifications used to SELECT pending rows and only update
-- status after sending. With the in-process API worker and the standalone
-- worker (or multiple replicas) running together, two workers could pick up
-- the same row and a responder would receive the same SOS SMS/push twice.
--
-- Adds a 'processing' status + claimed_at so a worker atomically claims a row
-- (UPDATE ... WHERE status IN ('pending','retry')) before sending. Claims
-- abandoned by a crashed worker are recovered after 5 minutes by the drain
-- loop (see TwilioNotificationService.processPendingNotifications).
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_status_check;

ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'retry'));

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;

COMMENT ON COLUMN public.notification_queue.claimed_at IS
  'When a worker claimed this row (status=processing). Stale claims (>5 min) are reset to retry.';
