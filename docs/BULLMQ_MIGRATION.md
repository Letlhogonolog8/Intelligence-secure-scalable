# BullMQ migration plan (notification worker)

## Why

The current notification path polls `notification_queue` from Supabase every
few seconds in a single worker process. That works, but:

- The worker is intentionally pinned to **1 replica** in
  `kubernetes/09-worker-deployment.yaml` because two pollers would dispatch
  the same row twice — there is no row-level lock.
- Throughput is bounded by Supabase round-trip + batch size.
- Retries / backoff are managed by hand inside `TwilioNotificationService`.

BullMQ (Redis-backed) gives us:

- Atomic claim semantics, so we can run **N worker replicas** safely.
- Built-in retries, exponential backoff, dead-letter handling.
- A queue that decouples API throughput from Twilio throughput.

The dependency is already declared in `package.json`. The skeleton lives in
`server/queue/bullmqDispatcher.ts` and is gated behind
`USE_BULLMQ_NOTIFICATIONS=true`.

## High-level shape

```
                                ┌────────────────────────────┐
escalation handler / API ─────► │ enqueueNotificationJob()   │
                                │ (server/queue/bullmq...)   │
                                └────────────┬───────────────┘
                                             ▼
                             ┌─────────────────────────────┐
                             │   Redis: aegis:notifications │
                             └────────────┬─────────────────┘
                                          ▼
                       ┌──────────────────────────────────────┐
                       │  BullMQ Worker (N replicas)          │
                       │  startBullmqNotificationWorker()     │
                       │  └─► TwilioNotificationService.send  │
                       └──────────────────────────────────────┘
```

The Supabase row in `notification_queue` is preserved as an **audit /
fallback** record. It is _no longer_ polled while BullMQ is enabled; it is
written only so failed-state queries, dashboards, and the previous polling
fallback continue to work during cutover.

## Phased migration

### Phase 0 — Skeleton (DONE in this branch)

- `server/queue/bullmqDispatcher.ts` is added. Disabled by default.
- `package.json` already includes `bullmq` and `ioredis`.

### Phase 1 — Dual-write (1 week of staging soak)

1. In all places that currently insert into `notification_queue`
   (`TwilioNotificationService.queueNotification`, `sendBulkSMS`, etc.),
   call `enqueueNotificationJob()` immediately after the insert.
2. Deploy with `USE_BULLMQ_NOTIFICATIONS=true` in **staging only**.
3. Run the worker Deployment with `USE_BULLMQ_NOTIFICATIONS=true` (one
   replica still) and call `startBullmqNotificationWorker()` from
   `server/worker.ts` instead of the polling loop:
   ```ts
   if (process.env.USE_BULLMQ_NOTIFICATIONS === "true") {
     startBullmqNotificationWorker(supabase);
   } else {
     startPollingLoop(supabase); // current behaviour
   }
   ```
4. Watch:
   - Twilio delivery success rate (Datadog dashboard).
   - `aegis:notifications` queue depth (Grafana panel against Redis).
   - Audit-log gap detector (cron added in Phase 0 of the previous PR).
5. Acceptance: zero duplicate sends, < 1% job failure rate over 7 days.

### Phase 2 — Single-source

1. In `kubernetes/09-worker-deployment.yaml`, raise `replicas` from `1` to
   `3`. (Safe under BullMQ — replicas compete via Redis BLPOP / streams.)
2. Set `BULLMQ_NOTIFICATION_CONCURRENCY=10` per replica → effective
   concurrency of 30.
3. Add an HPA targeting CPU on the worker Deployment.
4. Stop reading from Supabase polling: in `TwilioNotificationService`,
   short-circuit `processPendingNotifications` when
   `USE_BULLMQ_NOTIFICATIONS=true`.

### Phase 3 — Full cutover

1. Remove the polling loop in `server/worker.ts`.
2. Optionally drop the Supabase `notification_queue` insert path
   altogether and use only the BullMQ job + an `audit_log` row.
3. Add a Grafana alert on:
   - `aegis:notifications` waiting count > 100 for 5 minutes.
   - Failed jobs count growth > 10/minute.

## Rollback

Each phase is reversible:

- Phase 1 → 0: set `USE_BULLMQ_NOTIFICATIONS=false`. The polling loop in
  `server/worker.ts` resumes immediately; jobs already in Redis stay there
  until either re-enabled or manually drained.
- Phase 2 → 1: scale worker Deployment back to 1 replica.
- Phase 3 → 2: re-enable the polling loop branch and re-deploy.

## Operational notes

- BullMQ requires a **non-clustered** Redis or a Redis Cluster build of
  BullMQ (`bullmq.Cluster`). The current deployment uses a single Redis
  master + replica (`docker-compose.prod.yml` / managed Redis), which is
  fine.
- Always set `maxRetriesPerRequest: null` on the IORedis connection (already
  done in `bullmqDispatcher.ts`) — BullMQ requires it.
- Job IDs use the `notificationId` UUID, which makes the operation
  idempotent: re-enqueueing the same notification yields a single job.
- Failed jobs end up in the BullMQ "failed" set and can be inspected via
  Bull Board (`npm run bullmq:dashboard` — to be added in Phase 2).

## Code-level checklist

- [x] `server/queue/bullmqDispatcher.ts` — producer + worker
- [ ] `server/notifications/twilio.ts` — call
      `enqueueNotificationJob()` after `queueNotification()` (Phase 1)
- [ ] `server/worker.ts` — branch on `USE_BULLMQ_NOTIFICATIONS` (Phase 1)
- [ ] `kubernetes/09-worker-deployment.yaml` — bump `replicas` (Phase 2)
- [ ] HPA for worker Deployment (Phase 2)
- [ ] Bull Board dashboard mounted at `/admin/queues` behind admin auth
      (Phase 2)
- [ ] Remove polling loop (Phase 3)

This document should be updated as each phase ships.
