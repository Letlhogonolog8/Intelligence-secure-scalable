# AEGIS-AI Canonical Deployment

The repository historically contains `render.yaml`, `railway.toml`,
`kubernetes/`, `docker-compose.yml` and
`docker-compose.prod.yml`. This document declares which targets are
**canonical** and which are kept for reference only, so deployments don't
drift.

## Target matrix

| Environment | Frontend | Backend | Worker | Notes |
|---|---|---|---|---|
| Local dev | Vite (`npm run dev`) | tsx (`npm run dev`) | not run | `.env.local` |
| Local container parity | `Dockerfile.frontend.nginx` | `Dockerfile.backend` | `Dockerfile.backend` (worker.js) | `docker-compose.prod.yml` |
| Staging / competition demo | **Render — `aegis-frontend` static** | **Render — `aegis-backend`** | **Render — `aegis-worker`** | `render.yaml` (single source of truth) |
| Production | **Render — `aegis-frontend` static** | **Render — `aegis-backend`** | **Render — `aegis-worker`** | Set production env vars in Render dashboard |
| Kubernetes | reference only | reference only | reference only | `kubernetes/*.yaml` retained for future self-hosting |
| Railway | not used | not used | not used | `railway.toml` retained for the Ele-vate AI competition demo only |

## Frontend container

**Always use `Dockerfile.frontend.nginx`** in CI and `docker-compose.prod.yml`.
`Dockerfile.frontend` (http-server) exists for local debugging only; it is
not appropriate for production traffic. CI (`.github/workflows/ci-cd.yml`)
builds the nginx variant.

## Notification worker placement

The notification worker uses `setInterval` and a process-local in-flight
flag. **Only one replica** of the worker may run at a time. To enforce:

- API deployments: `NOTIFICATION_WORKER_ENABLED=false`
  (set in `render.yaml`, `kubernetes/05-api-deployment.yaml`,
  `docker-compose.prod.yml`).
- Worker deployment: `NOTIFICATION_WORKER_ENABLED=true`,
  `replicas: 1` only (`kubernetes/09-worker-deployment.yaml`,
  `docker-compose.prod.yml` `worker` service).

To horizontally scale notification dispatch, migrate to BullMQ workers
backed by Redis (the `bullmq` dependency is already declared but not yet
the active code path).

## Environment variables

`.env.example` is the contract. Every key listed there must be set in the
deployment target's secret store. Server boot fails fast if any of the
required variables are missing (`server/index.ts` → `validateEnvironment`).

Production-only required variables (enforced by `validateEnvironment` when
`NODE_ENV=production`):

- `TELKOM_WEBHOOK_SECRET`

Strongly recommended but not enforced:

- `SENTRY_DSN`
- `DATADOG_API_KEY`
- `METRICS_TOKEN` (otherwise `/metrics` is IP-allowlisted only)
- `AUDIT_CHAIN_CRON_ENABLED=true`
- `AUTH_CACHE_TTL_SECONDS=60`
- `CSP_REPORT_URI=https://api.aegis-ai.co.za/api/csp-report`
- `VITE_POPIA_REGISTRATION_ID`, `VITE_DPO_NAME`, `VITE_DPO_EMAIL`,
  `VITE_DPO_PHONE`

## Deploy procedure

### Render (staging)

```bash
git push origin develop
# Render auto-deploys both services from render.yaml on push.
# Watch the deploy log; verify GET https://aegis-backend-zhv3.onrender.com/health/ready returns 200.
```

Set the backend `CORS_ORIGIN` Render environment variable to the **actual
Render frontend URL** shown in the Render dashboard (not a Vercel URL).
The default backend API base is:

```text
https://aegis-backend-zhv3.onrender.com/api
```

### Kubernetes (production)

```bash
# 1) Build and push images via CI (push a tag matching v*).
# 2) Apply the manifests (idempotent).
kubectl apply -f kubernetes/01-namespace.yaml
kubectl apply -f kubernetes/02-configmap-secrets.yaml   # use ExternalSecret in prod
kubectl apply -f kubernetes/03-postgres-statefulset.yaml
kubectl apply -f kubernetes/04-redis-statefulset.yaml
kubectl apply -f kubernetes/05-api-deployment.yaml
kubectl apply -f kubernetes/06-frontend-deployment.yaml
kubectl apply -f kubernetes/07-ingress.yaml
kubectl apply -f kubernetes/08-rbac.yaml
kubectl apply -f kubernetes/09-worker-deployment.yaml

kubectl rollout status deployment/aegis-api      -n aegis --timeout=5m
kubectl rollout status deployment/aegis-worker   -n aegis --timeout=5m
kubectl rollout status deployment/aegis-frontend -n aegis --timeout=5m

# 3) Smoke tests
curl -f https://api.aegis-ai.co.za/health/ready
curl -f https://aegis-ai.co.za
```

### Rollback

```bash
kubectl rollout undo deployment/aegis-api -n aegis
kubectl rollout undo deployment/aegis-worker -n aegis
kubectl rollout undo deployment/aegis-frontend -n aegis
```

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR:
`npm ci → lint → test → build`.

`.github/workflows/ci-cd.yml` adds typecheck, npm audit (advisory),
container build & push, kubectl rollout to staging on `develop`, and to
production on tagged commits matching `v*`.

`.github/workflows/security-ci.yml` runs the dedicated security scans.
