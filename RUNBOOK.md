# AEGIS-AI Operations Runbook

Practical procedures for the on-call engineer. Pair this with `SECURITY.md`
(secrets / incident handling) and `DEPLOYMENT.md` (canonical deployment
target).

> ⚠ **The live deployment is Render.** `kubernetes/*.yaml` is retained for a
> possible future self-hosted deployment but is not running anywhere today —
> do not run `kubectl` against it expecting to affect production. See
> `DEPLOYMENT.md`'s target matrix for the full picture.

## Service map

| Service                   | Where                                                                                               | Health check                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| API + notification worker | Render web service `aegis-backend` (worker runs **in-process**, `NOTIFICATION_WORKER_ENABLED=true`) | `GET /health/ready`                                    |
| Frontend                  | Render static site `aegis-frontend`                                                                 | `GET /`                                                |
| Supabase                  | Managed                                                                                             | Supabase status page                                   |
| Redis                     | External managed instance (`REDIS_URL` secret) — not deployed by this repo                          | TCP probe / `services.rateLimiting` in `/health/ready` |

> ⚠ There is **no separate worker service on Render** — `aegis-backend` runs
> both the API and the notification-queue poller in one process. The
> `docker-compose.prod.yml` / `kubernetes/09-worker-deployment.yaml`
> separate-worker topology is the reference/self-hosted design only; it is
> not what's live today. Because of that, **`aegis-backend` must stay at a
> single instance** on Render — scaling it to multiple instances would run
> the in-process worker multiple times and duplicate Twilio dispatches (see
> incident #2 below).

## Daily checks

- `GET /health/ready` returns 200 and every service shows `ready`.
- `aegis_backend_p95_request_duration_seconds` < 0.5s.
- Sentry: no new fatal events in the last 24h.
- Audit chain: most recent log entry contains `Audit chain verification succeeded`.
- Notification queue depth (`SELECT count(*) FROM notification_queue WHERE status='pending'`) < 100.
- Render dashboard → `aegis-backend` → **Metrics**: instance count is exactly
  1 (see the single-instance note above).

## Common incidents

### 1. API crash-looping / failing health checks

1. Render dashboard → `aegis-backend` → **Logs** (or `render logs -r aegis-backend --tail` if the Render CLI is installed locally) — look for the crash stack trace near the last restart.
2. Hit `/health/ready` directly and check which `services.*` entry is not `ready`.
3. If Redis is the cause, verify the `REDIS_URL` env var in Render → `aegis-backend` → **Environment** and confirm the Redis provider is reachable.
4. If Supabase is the cause, check the Supabase status page; the readiness probe tolerates a missing `notification_queue` table but not auth failures.
5. Roll back: Render dashboard → `aegis-backend` → **Deploys** → find the last known-good deploy → **Rollback to this deploy**. (Render deploys from source per `render.yaml`, so there is no separate image to re-tag — rollback replays a prior commit's build.)

### 2. Twilio messages duplicated

On Render this almost always means `aegis-backend` was scaled to more than
one instance (each instance runs its own in-process notification worker).

1. Render dashboard → `aegis-backend` → **Settings** → confirm **Instance
   Count** is 1.
2. If it was scaled up deliberately for API throughput, that's the bug: the
   in-process worker isn't horizontally safe. Scale back down to 1, or first
   move notification dispatch to the BullMQ path (`server/queue/`) if that
   work has since been completed — check whether `notificationQueue.ts` or a
   BullMQ-backed dispatcher is the current live path before assuming either.
3. If running self-hosted on Kubernetes instead (reference deployment only),
   confirm only `aegis-worker` reports `NOTIFICATION_WORKER_ENABLED=true`:
   `kubectl get deployment -n aegis -o yaml | grep -A2 NOTIFICATION_WORKER_ENABLED`.

### 3. Idempotency replay collisions

If users see HTTP 409 on `/api/cases/escalate`:

1. Confirm the client is _not_ reusing the same key for two distinct user
   actions. (`Idempotency-Key` should be regenerated for each escalation.)
2. Check Redis: `KEYS idem:escalate:*` to inspect cached reservations.
3. Replays beyond 24 hours fall through naturally.

### 4. Audit chain integrity broken

The cron will log `Audit chain verification FAILED` and Sentry will receive
a `fatal` event.

1. **Stop** writes to `audit_logs_immutable` (set the table to RLS-deny in
   Supabase or revoke the writer role).
2. Run `GET /api/audit/verify` to confirm.
3. Engage the DPO. POPIA may require breach notification within 72 hours.
4. Investigate using Supabase Auth logs (who modified the table?) and
   Postgres WAL.
5. Restore from backup; do **not** repair entries in place.

### 5. Rate-limit store fell back to memory

Symptom: `/health/ready` shows `services.rateLimiting.store = memory`
in production.

1. Check the `REDIS_URL` env var on `aegis-backend` (Render → Environment).
2. Inspect `services.rateLimiting.error` for the connection error.
3. Restart: Render dashboard → `aegis-backend` → **Manual Deploy** →
   **Deploy latest commit** (or **Restart service** if only a process
   restart is needed, no new code) after Redis is reachable; the limiter
   rebuilds itself on `initializeRateLimiting()`.

### 6. Live updates not reaching a client

Real-time updates (case status, new messages, presence) are carried
entirely by Supabase Realtime (`postgres_changes` subscriptions), not a
custom WebSocket server.

1. Check the Supabase status page — Realtime is a managed Supabase service.
2. Confirm the affected table has `ALTER PUBLICATION supabase_realtime ADD
TABLE ...` applied (check the relevant migration) and RLS policies that
   permit the subscribing user to read the row.
3. Client-side: confirm the browser/app's Supabase client reconnected after
   any network interruption — check for repeated `CHANNEL_ERROR` in the
   client console/logs.

## Disaster recovery

### Supabase database loss

1. Restore from Supabase PITR — choose a point-in-time prior to the
   incident.
2. Verify the audit chain (`GET /api/audit/verify`) and any business
   invariants (`SELECT count(*) FROM survivors`).
3. Replay any `notification_queue` rows from the new snapshot:
   `UPDATE notification_queue SET status='pending' WHERE status='processing'`.
4. Bring traffic back gradually; Render doesn't support native canary
   percentages on the starter plan, so this means monitoring closely
   immediately after the restore rather than a staged rollout.

### Region failover

Render `aegis-backend`/`aegis-frontend` are single-region. For a regional
outage:

1. Spin up a fresh Render service from the same repo/branch in an available
   region (Render → **New Web Service**, point at this repo).
2. Point DNS at the new backend — TTL is 300s.
3. Wait for `/health/ready` to be green.
4. Communicate via the status page.

## Rotation procedures

### Encryption keys

Encryption keys rotate via dual-key support:

1. Generate a new key with `openssl rand -hex 32`.
2. Add it as `ENCRYPTION_KEY_NEXT` in Render → `aegis-backend` →
   **Environment** (the encryption module recognises it for decryption
   only).
3. After 14 days, swap `ENCRYPTION_KEY_NEXT` → `ENCRYPTION_KEY` and remove
   `ENCRYPTION_KEY_OLD` only after a re-encryption job confirms no rows are
   still keyed against the old value.

### JWT secrets

Rotation invalidates all active sessions. Execute during a low-traffic
window:

1. Update `JWT_SECRET` and `REFRESH_TOKEN_SECRET` in Render → `aegis-backend`
   → **Environment**.
2. Saving env vars triggers an automatic redeploy on Render; confirm it
   completes via the **Deploys** tab (or trigger **Manual Deploy** if it
   doesn't restart automatically).
3. Notify users via in-app banner that re-login is required.

### Database password

1. Rotate via Supabase Dashboard / managed Postgres console.
2. Update `DB_PASSWORD` in Render → `aegis-backend` → **Environment**.
3. Confirm the resulting redeploy completes (see JWT rotation above).

## Useful commands

```bash
# Audit chain status (one-shot)
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://intelligence-secure-scalable-mwge.onrender.com/api/audit/verify

# Rate-limit store status
curl https://intelligence-secure-scalable-mwge.onrender.com/health/ready | jq .services.rateLimiting

# Confirm the in-process notification worker is alive (no separate process to
# exec into on Render — check logs for its periodic poll instead):
# Render dashboard → aegis-backend → Logs → filter for "notification" or
# check that `notification_queue` pending rows are draining:
#   SELECT count(*) FROM notification_queue WHERE status = 'pending';
```

## Escalation contacts

| Role                    | Channel                                                |
| ----------------------- | ------------------------------------------------------ |
| On-call engineer        | PagerDuty: `aegis-api`                                 |
| Security lead           | `security@aegis-ai.co.za`                              |
| Data Protection Officer | `dpo@aegis-ai.co.za`                                   |
| Twilio account          | Twilio support → reference SID `${TWILIO_ACCOUNT_SID}` |
| Supabase                | Supabase support — share project ref only              |
