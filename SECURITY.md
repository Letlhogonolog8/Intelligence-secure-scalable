# AEGIS-AI Security Policy

This document is the canonical reference for how the AEGIS-AI platform handles
secrets, credentials, vulnerabilities and incident response. Read it before
deploying to any environment that touches real user data.

## Reporting a vulnerability

Email `security@aegis-ai.co.za` (or the project's `VITE_DPO_EMAIL` if that
mailbox is not yet provisioned). Include:

- A description of the vulnerability and the affected endpoint/file/version.
- Reproduction steps (curl commands, payloads, screenshots).
- The impact you observed and the impact you believe is possible.

Please do **not** open public GitHub issues for security findings. We commit to
acknowledging reports within 2 business days and providing a remediation plan
within 7 business days for high/critical issues.

## Secret management

### Never commit secrets

The `.gitignore` blocks `.env*`, `*.key`, `*.pem`, `*.p12` and `.vault-token`.
A pre-commit secret scanner (`scripts/scan-secrets.cjs`, wired through
`.husky/pre-commit`) refuses commits that contain Supabase keys, Twilio
tokens, AWS access keys, JWTs or generic 32/64-byte hex blobs assigned to
`*KEY|*SECRET|*TOKEN|*PASSWORD` keys. Override only with `--no-verify` and
only for known-safe placeholders.

### Storage

| Environment         | Secret store                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local development   | `.env.local` (gitignored), copied from `.env.example`                                                                                                                          |
| Render (staging)    | Render → Environment Group, all values marked `sync: false`                                                                                                                    |
| Render (production) | same, separate environment group                                                                                                                                               |
| Kubernetes          | `Secret/aegis-secrets` (see `kubernetes/02-configmap-secrets.yaml`); production should use ExternalSecrets / sealed-secrets pointing at AWS Secrets Manager or HashiCorp Vault |
| GitHub Actions      | Repository or Environment secrets, never hardcoded in workflows                                                                                                                |

### Rotation cadence

| Secret                                   | Rotation                                 | Notes                                                                                                                           |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`              | Quarterly + on suspected compromise      | Regenerate in Supabase Dashboard → Settings → API                                                                               |
| `VITE_SUPABASE_KEY` (anon)               | Quarterly                                | Public, but rotate alongside the service role key                                                                               |
| `ENCRYPTION_KEY` / `CHAT_ENCRYPTION_KEY` | Every 6 months                           | Coordinated key rotation procedure required; new key encrypts new data, old key remains accessible until re-encryption finishes |
| `JWT_SECRET` / `REFRESH_TOKEN_SECRET`    | Every 6 months                           | Rotation invalidates active sessions                                                                                            |
| `TELKOM_WEBHOOK_SECRET`                  | On supplier change + every 12 months     |                                                                                                                                 |
| `TWILIO_AUTH_TOKEN`                      | Every 6 months + on suspected compromise |                                                                                                                                 |
| `METRICS_TOKEN`                          | Quarterly                                |                                                                                                                                 |
| Database password (`DB_PASSWORD`)        | Every 90 days                            | If running self-managed Postgres                                                                                                |

### What to do if a secret is leaked

1. **Revoke / regenerate** the credential at its source (Supabase, Twilio,
   Telkom, etc.) immediately.
2. **Update** all environments (Render, K8s, GitHub Actions, local dev).
3. **Audit** access logs from the time-of-leak forwards (Supabase Auth logs,
   Twilio usage logs, audit_logs_immutable).
4. **Document** the incident in the runbook and notify the DPO if it touched
   personal data (POPIA notification clock starts when you become aware).

## Hardening summary

- HTTP: Helmet with strict CSP (no `unsafe-inline`), explicit `connect-src`
  allowlist for Supabase / Datadog / Sentry, HSTS preload, frameSrc `none`,
  formAction `self`. CSP violations are reported to `/api/csp-report` and
  forwarded to Sentry.
- Body limits: 256 KB default, 64 KB on USSD callbacks, 128 KB on AI chat,
  32 KB on CSP reports. Override per-route only when justified.
- Auth: Supabase JWT + Redis-backed cache (TTL configurable via
  `AUTH_CACHE_TTL_SECONDS`, default 60s) + `auth:revoke` Redis pub/sub on
  logout for cluster-wide invalidation.
- Idempotency: `Idempotency-Key` header on `POST /api/cases/escalate`
  (Redis-backed, 24h TTL). Concurrent retries get HTTP 409.
- Rate limiting: tiered limiters (default / api / strict / auth / mfa /
  escalation), Redis-backed in production.
- MFA: TOTP via Supabase Auth (`enrollTotpFactor`, `challengeAndVerify`).
  Strongly recommended for admin/police roles.
- Encryption: AES-256-GCM for sensitive fields and chat messages
  (`server/security/encryption.ts`). Refuses to start in production if the
  key is missing or malformed.
- Audit: Hash-chained `audit_logs_immutable` table; chain integrity
  verified periodically by the API server (configurable via
  `AUDIT_CHAIN_CRON_INTERVAL_MS`, default 6 hours) and on demand via
  `GET /api/audit/verify`.
- Webhook signatures: Telkom callback uses HMAC-SHA256 with
  `crypto.timingSafeEqual`. Signature verification is mandatory in
  production.
- Intrusion detection: `IntrusionDetectionSystem` analyzes every request
  before routes; pair with a CDN-level WAF (Cloudflare / AWS WAF /
  CloudArmor) in production.
- Secrets at rest: server filesystem is `readOnlyRootFilesystem: true` in
  K8s; container drops all capabilities and runs as non-root user 1000.

## Backup & DR

See `RUNBOOK.md` → "Disaster recovery" for the canonical procedure. At a
minimum:

1. Supabase: enable PITR (>=7 days), schedule weekly logical backups to a
   separate cloud account.
2. Redis: persistence is ephemeral by design (cache + pub/sub only); no
   special backup needed beyond rebuilding state on failover.
3. Audit logs: immutable by RLS; replicate to cold storage on a daily
   schedule for legal hold (POPIA s. 14).

## Compliance

- **POPIA**: registration ID and DPO contact must be set in the deployment
  environment (`VITE_POPIA_REGISTRATION_ID`, `VITE_DPO_NAME`,
  `VITE_DPO_EMAIL`, `VITE_DPO_PHONE`).
- **WCAG 2.1 AA**: enforced at component level; tests exist for keyboard,
  screen-reader and contrast (`@axe-core/react`).
- **Data residency**: South Africa (`af-south-1`); cross-region replication
  must remain inside the country unless an authorised cross-border data
  transfer agreement is in place.

## Pre-deployment security checklist

- [ ] All secrets rotated and stored in the platform's secret manager only.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
      all pass on the deployment branch.
- [ ] `node scripts/scan-secrets.cjs` passes against the staged tree.
- [ ] HTTPS terminated at the load balancer / CDN; HSTS preload enabled.
- [ ] CSP report endpoint reachable and ingesting events.
- [ ] Audit-chain cron is enabled (`AUDIT_CHAIN_CRON_ENABLED=true`).
- [ ] WAF in front of the API and the static frontend.
- [ ] Penetration test report on file (renew every 12 months).
- [ ] POPIA registration on file; DPO assigned.
- [ ] DR drill executed within the last 90 days.
