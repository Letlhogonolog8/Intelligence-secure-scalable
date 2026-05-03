# AEGIS-AI Operations Runbook

Practical procedures for the on-call engineer. Pair this with `SECURITY.md`
(secrets / incident handling) and `DEPLOYMENT.md` (canonical deployment
target).

## Service map

| Service               | Where                                                                         | Health check              |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| API                   | Render `aegis-backend` / K8s Deployment `aegis-api`                           | `GET /health/ready`       |
| Frontend              | Render static site `aegis-frontend` / K8s Deployment `aegis-frontend` (nginx) | `GET /`                   |
| Notification worker   | Render separate service / K8s Deployment `aegis-worker`                       | logs only — no HTTP probe |
| Supabase              | Managed                                                                       | Supabase status page      |
| Redis                 | Render Redis / K8s `redis-service`                                            | TCP probe                 |
| Postgres (cache only) | K8s `postgres-service`                                                        | `pg_isready`              |

> ⚠ The notification worker is the **only** component that may run
> `NOTIFICATION_WORKER_ENABLED=true`. API replicas must keep it `false` to
> avoid duplicate Twilio dispatches. Verified by `kubernetes/05-api-deployment.yaml`
> and `docker-compose.prod.yml`.

## Daily checks

- `GET /health/ready` returns 200 and every service shows `ready`.
- `aegis_backend_p95_request_duration_seconds` < 0.5s.
- Sentry: no new fatal events in the last 24h.
- Audit chain: most recent log entry contains `Audit chain verification succeeded`.
- Notification queue depth (`SELECT count(*) FROM notification_queue WHERE status='pending'`) < 100.

## Common incidents

### 1. API replicas crash-looping

1. `kubectl logs -n aegis -l app=aegis-api --tail=200`.
2. Check `/health/ready` from a working replica — which service shows `unavailable`?
3. If Redis is the cause, verify `REDIS_URL` is set and Redis is reachable.
4. If Supabase is the cause, check Supabase status; the readiness probe is
   tolerant of a missing `notification_queue` table but not of auth failures.
5. Roll back: `kubectl rollout undo deployment/aegis-api -n aegis`.

### 2. Twilio messages duplicated

Almost always caused by more than one process having
`NOTIFICATION_WORKER_ENABLED=true`. Verify:

```bash
kubectl get deployment -n aegis -o yaml | grep -A2 NOTIFICATION_WORKER_ENABLED
```

Only `aegis-worker` should report `true`.

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

### 5. WebSocket fan-out broken across instances

Symptom: emergency escalations only reach users connected to the same pod
as the originating request.

1. Check `/health/ready` → `services.websocket.adapter` should be `redis`
   in production. If it's `local`, the Redis adapter failed to connect.
2. Inspect API logs for `WebSocket Redis adapter enabled` on startup.
3. Restart the affected pods so they re-attempt adapter init.

### 6. Rate-limit store fell back to memory

Symptom: `/health/ready` shows `services.rateLimiting.store = memory`
in production.

1. Check `REDIS_URL` env var on the deployment.
2. Inspect `services.rateLimiting.error` for the connection error.
3. Restart pods after Redis is reachable; the limiter rebuilds itself on
   `initializeRateLimiting()`.

## Disaster recovery

### Supabase database loss

1. Restore from Supabase PITR — choose a point-in-time prior to the
   incident.
2. Verify the audit chain (`GET /api/audit/verify`) and any business
   invariants (`SELECT count(*) FROM survivors`).
3. Replay any `notification_queue` rows from the new snapshot:
   `UPDATE notification_queue SET status='pending' WHERE status='processing'`.
4. Bring traffic back gradually (canary 5% → 25% → 100%).

### Region failover

Currently single-region (`af-south-1`). For a regional outage:

1. Spin up a fresh Render service in `af-south-2` from the same Git tag.
2. Point DNS at the new backend (`api.aegis-ai.co.za`) — TTL is 300s.
3. Wait for `health/ready` to be green.
4. Communicate via the status page.

## Rotation procedures

### Encryption keys

Encryption keys rotate via dual-key support:

1. Generate a new key with `openssl rand -hex 32`.
2. Add it as `ENCRYPTION_KEY_NEXT` (the encryption module recognises it for
   decryption only).
3. After 14 days, swap `ENCRYPTION_KEY_NEXT` → `ENCRYPTION_KEY` and remove
   `ENCRYPTION_KEY_OLD` only after a re-encryption job confirms no rows are
   still keyed against the old value.

### JWT secrets

Rotation invalidates all active sessions. Execute during a low-traffic
window:

1. Update `JWT_SECRET` and `REFRESH_TOKEN_SECRET` in the platform secret
   store.
2. Trigger a rolling restart of the API (`kubectl rollout restart`).
3. Notify users via in-app banner that re-login is required.

### Database password

1. Rotate via Supabase Dashboard / managed Postgres console.
2. Update `DB_PASSWORD` in the platform secret store.
3. Rolling restart of API + worker pods.

## Useful commands

```bash
# Audit chain status (one-shot)
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.aegis-ai.co.za/api/audit/verify

# Rate-limit store status
curl https://api.aegis-ai.co.za/health/ready | jq .services.rateLimiting

# Inspect WebSocket cluster
curl https://api.aegis-ai.co.za/health/ready | jq .services.websocket

# Force a notification cycle (worker)
kubectl exec -n aegis deployment/aegis-worker -- node -e "console.log('worker alive')"
```

## Escalation contacts

| Role                    | Channel                                                |
| ----------------------- | ------------------------------------------------------ |
| On-call engineer        | PagerDuty: `aegis-api`                                 |
| Security lead           | `security@aegis-ai.co.za`                              |
| Data Protection Officer | `dpo@aegis-ai.co.za`                                   |
| Twilio account          | Twilio support → reference SID `${TWILIO_ACCOUNT_SID}` |
| Supabase                | Supabase support — share project ref only              |
