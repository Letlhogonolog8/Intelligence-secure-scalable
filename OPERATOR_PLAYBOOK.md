# AEGIS-AI — Operator Playbook

This playbook converts the eight remaining operator-action items from the
production-readiness audit into concrete, sequenced steps with
verifications. Work top-to-bottom: items 1, 2 and 4 are pre-launch
blockers; the rest can be done in parallel with the launch.

| #   | Item                                          | Pre-launch?                   | Owner          | Est. effort     |
| --- | --------------------------------------------- | ----------------------------- | -------------- | --------------- |
| 1   | Rotate every credential in `.env`             | yes                           | Platform owner | 2–3 h           |
| 2   | Set POPIA / DPO env vars                      | yes                           | DPO + Platform | 30 min          |
| 3   | Stand up a WAF                                | yes                           | Platform owner | 2 h             |
| 4   | Move secrets into a secret manager            | yes                           | Platform owner | 3–4 h           |
| 5   | Engage a third-party penetration tester       | yes (start now)               | DPO            | 4–8 weeks lead  |
| 6   | Migrate the notification worker to BullMQ     | post-launch                   | Backend team   | 1–2 sprints     |
| 7   | Supabase PITR + off-site backups + DR drill   | yes (PITR), quarterly (drill) | Platform owner | 4 h + recurring |
| 8   | Un-skip RLS / edge-function integration tests | yes (CI)                      | Backend team   | 2 h             |

There is also a **pre-flight check** at the bottom of this document
(`scripts/check-env.cjs`) you should run before every deploy.

---

## 1. Rotate every credential currently in `.env`

A live `.env` was discovered in the repo working tree during the audit.
Even though it is git-ignored, anything that ever sat on a developer
workstation should be considered exposed. Every credential below must be
issued **fresh** from the upstream provider and the old values revoked.

### 1.1 Pre-flight

```powershell
# From the repo root, on Windows PowerShell:
mkdir secrets-temp -Force
cd secrets-temp
```

Generate the four secrets that AEGIS-AI mints itself (encryption,
chat-encryption, JWT, refresh-token, metrics, Telkom-webhook):

```powershell
..\scripts\generate-keys.ps1 | Out-File -Encoding utf8 .\new-secrets.txt
notepad .\new-secrets.txt   # copy into your password manager, then delete
```

(The Bash equivalent is `./scripts/generate-keys.sh` on macOS/Linux.)

Each line is a `KEY = value` pair. **Treat the file as a live secret** —
move into your secret manager immediately and shred:

```powershell
Remove-Item .\new-secrets.txt -Force
```

### 1.2 Provider-specific rotation

Do these in order — they are listed from least-disruptive (you can
re-issue without downtime) to most-disruptive (forces every user to
re-authenticate).

#### Supabase — `VITE_SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, JWT secret

1. Supabase Dashboard → your project → **Settings → API**.
2. Under **Project API keys**, click **Reset** next to:

- `anon` (this becomes the new `VITE_SUPABASE_KEY`)
- `service_role` (this becomes the new `SUPABASE_SERVICE_ROLE_KEY`)

3. Under **JWT Settings**, click **Generate a new JWT secret**.
   _Effect: every existing access token is immediately invalid; users
   will be logged out._ Plan a maintenance window or do this just before
   step 1.6 below.
4. Copy each new value into your secret manager (entry name: `aegis/production`).
5. **Confirm old keys are dead**: in a clean shell,

```bash
 curl -H "apikey: <OLD_ANON_KEY>" https://<ref>.supabase.co/rest/v1/profiles
 # expected: {"message":"Invalid API key"}
```

#### Supabase — database password

1. Supabase Dashboard → **Settings → Database → Connection string**.
2. Click **Reset database password**, copy the new value as
   `DB_PASSWORD`. Update the value in your secret manager.
3. Restart any service that holds long-lived Postgres connections (the
   API). In Kubernetes:

#### Twilio — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

1. Twilio Console → **Account → API keys & tokens**.
2. Under **Auth tokens**, click **Create new** to generate a secondary
   token, then **Promote** it. Wait until production is using the new
   token, then **Revoke** the old one.
3. The Account SID does not change; copy the new auth token into your
   secret manager as `TWILIO_AUTH_TOKEN`.
4. Verify by sending a synthetic SMS via the staging API and confirming
   the message lands in Twilio's logs with the new SID-prefixed message
   ID.

#### Telkom — `TELKOM_API_KEY`, `TELKOM_WEBHOOK_SECRET`

1. Log in to the Telkom developer portal (`https://developer.telkom.co.za`).
2. Open the AEGIS-AI app → **API keys** → click **Rotate**. Copy the new
   key into your secret manager as `TELKOM_API_KEY`.
3. The `TELKOM_WEBHOOK_SECRET` is **AEGIS-side**, not Telkom-side. Use the
   value generated in step 1.1, but you must re-share it with Telkom so
   they sign incoming webhook requests with the same secret. Telkom
   typically expects this via an HMAC `X-Telkom-Signature` header — see
   `server/routes/telkomWebhook.ts` for the current verification logic.
4. Verify by sending a signed test webhook from Telkom's portal and
   confirming `200 OK` from `/api/telkom-webhook`. A `401` means the
   secrets are out of sync.

#### JWT, refresh, encryption, metrics, webhook secrets

All of these are AEGIS-minted. You already generated them in step 1.1.
Push them into your secret manager:

| Variable                | Source                 |
| ----------------------- | ---------------------- |
| `ENCRYPTION_KEY`        | `generate-keys` output |
| `CHAT_ENCRYPTION_KEY`   | `generate-keys` output |
| `JWT_SECRET`            | `generate-keys` output |
| `REFRESH_TOKEN_SECRET`  | `generate-keys` output |
| `METRICS_TOKEN`         | `generate-keys` output |
| `TELKOM_WEBHOOK_SECRET` | `generate-keys` output |

> ⚠️ `**ENCRYPTION_KEY` and `CHAT_ENCRYPTION_KEY` need a re-encryption
> migration if any data was already encrypted with the old keys.\*\* If
> this is a fresh deployment, skip ahead. If you have existing data,
> open `server/security/encryptionService.ts` and follow the
> `rotateActiveKey()` procedure (it dual-decrypts during the rotation
> window).

### 1.3 Push the new values into your platform

- **Render**: Dashboard → service → **Environment** → bulk-edit, paste
  the lines.
- **Kubernetes** (preferred, see Section 4): values are read from AWS
  Secrets Manager / Vault via External Secrets Operator. Update the
  upstream secret only.
- **Docker Compose**: edit `/etc/aegis-ai/aegis-ai.env`, then
  `docker compose -f docker-compose.prod.yml up -d`.

### 1.4 Verify

```powershell
# From your CI shell (or a workstation with the new env exported):
node scripts/check-env.cjs
# expected: [check-env] OK — all required variables present (NODE_ENV=production)
```

Boot the stack and confirm:

```bash
curl -fsS https://api.aegis-ai.co.za/healthz
# expected: {"status":"ok",...}
curl -fsS https://api.aegis-ai.co.za/metrics \
  -H "Authorization: Bearer $METRICS_TOKEN" | head -n 5
# expected: prom-client output
```

### 1.5 Document the rotation

Add an entry to `SECURITY.md` → "Rotation cadence" with date, operator,
and which secrets were rotated. Set a calendar reminder for the next
rotation:

| Secret                       | Cadence   |
| ---------------------------- | --------- |
| Encryption / chat-encryption | annual    |
| JWT / refresh / metrics      | quarterly |
| Twilio auth token            | annual    |
| DB password                  | annual    |
| Telkom API key               | annual    |
| Webhook secrets              | annual    |

### 1.6 Forced re-authentication

After the JWT secret rotation in 1.2, every user is logged out. Send a
maintenance-window notice via the in-app banner (`MaintenanceBanner.tsx`)
24 h ahead so survivors are not surprised.

---

## 2. Set POPIA / DPO env vars

The frontend reads four POPIA-related variables from `import.meta.env`.
They render the consent footer, the DPO contact card, and the data-
subject-access-request form. They are **not** secrets, but they are
legally required.

### 2.1 Decide the values

| Variable                     | Source                                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_POPIA_REGISTRATION_ID` | The Information Regulator's portal at [https://inforegulator.org.za/](https://inforegulator.org.za/) issues a registration ID once your responsible party / DPO is registered. Format is typically `IR-YYYY-NNNNNN`. |
| `VITE_DPO_NAME`              | Full name of the registered Data Protection Officer.                                                                                                                                                                 |
| `VITE_DPO_EMAIL`             | A monitored mailbox; do **not** use a personal alias. Suggested: `dpo@aegis-ai.co.za`.                                                                                                                               |
| `VITE_DPO_PHONE`             | Direct number, including country code, e.g. `+27 11 555 0100`.                                                                                                                                                       |

### 2.2 Register if you have not

1. Go to [https://inforegulator.org.za/](https://inforegulator.org.za/).
2. Complete the **Section 55** registration of an Information Officer /
   DPO (free, but takes 4–8 weeks).
3. While the registration is pending, set
   `VITE_POPIA_REGISTRATION_ID="PENDING-<applicant-reference>"` so the
   UI does not render an empty placeholder.

### 2.3 Apply the values

These are **build-time** variables (Vite inlines them into the bundle),
so they must be set in the **frontend** build step, not just at API
runtime.

- **GitHub Actions**: add the four variables as repository secrets and
  reference them in `.github/workflows/ci-cd.yml` under
  `frontend-image` build step → `build-args`. The `Dockerfile.frontend.nginx`
  already accepts them.
- **Local Vite build**: put them in `.env.production.local` (which is
  git-ignored).

### 2.4 Verify

After the next deploy, the registration ID and DPO contact must be
visible at:

- `/privacy-policy` → "Information Regulator registration" line
- `/contact-dpo` → contact card
- HTML `<head>` of every page → `<meta name="aegis:popia-id" content="…">`

You can also assert it from the command line:

```bash
curl -s https://aegis-ai.co.za | grep 'aegis:popia-id'
```

The `scripts/check-env.cjs` validator (see pre-flight check below) will
fail the build if these are missing or still set to placeholders.

---

## 3. Stand up a WAF in front of the API

The API is currently exposed directly to the internet. Adding a WAF
adds: rate-limit-at-edge, OWASP-CRS protection, country/bot blocks, and
TLS termination if you also let it terminate TLS. Cloudflare is the
fastest path; AWS WAF and Google Cloud Armor are documented as
alternatives.

### 3.1 Path A — Cloudflare (recommended, fastest)

1. **Add the domain** to Cloudflare:

- Dashboard → **Add a Site** → enter `aegis-ai.co.za`.
- Copy the two NS records Cloudflare gives you and update your
  registrar (Hetzner, GoDaddy, …).
- Wait for the zone status to flip to **Active** (5 min – 24 h).

2. **Proxy the API**:

- **DNS** tab → ensure the `api` record (CNAME or A) is set to
  **Proxied** (orange cloud).

3. **Apply the WAF rules**: this repo ships
   `cloudflare/waf-rules.tf` with the canonical rule set. Run:
   This creates: custom firewall rules (admin-path block, scanner
   block, Origin/Referer requirement on mutating `/api/`_, bot
   challenge on `/api/auth/`_), three rate-limit rules, and enables
   Cloudflare Managed + OWASP Core rulesets.
4. **Lock down the origin**: edit your ingress / load balancer to only
   accept connections from Cloudflare IPs. Cloudflare publishes the
   list at [https://www.cloudflare.com/ips/](https://www.cloudflare.com/ips/). Example NGINX:
   For Kubernetes, add a `NetworkPolicy` that only permits ingress
   from those CIDRs.

### 3.2 Path B — AWS WAF

1. **WebACL**: AWS Console → **WAF & Shield → Web ACLs → Create
   web ACL** in the same region as your ALB.
2. **Managed rule groups** to add:

- AWS-AWSManagedRulesCommonRuleSet
- AWS-AWSManagedRulesAmazonIpReputationList
- AWS-AWSManagedRulesKnownBadInputsRuleSet

3. **Custom rules**: replicate the four custom rules from
   `cloudflare/waf-rules.tf` (admin path block, scanner block,
   Origin/Referer requirement, auth bot challenge). Use AWS WAF's
   "Rate-based" rules for the three rate-limit rules.
4. **Associate** the WebACL with the ALB / API Gateway that fronts
   the API.
5. **Enable logging** to a Kinesis Firehose → S3 bucket; ingest into
   Datadog or Athena.

### 3.3 Path C — Google Cloud Armor

1. Cloud Console → **Network Security → Cloud Armor → Create policy**.
2. Enable the OWASP CRS preconfigured rules at sensitivity 1.
3. Add custom rules mirroring the Cloudflare definitions.
4. Attach to the backend service that fronts the API.

### 3.4 Verify (any path)

- Run a synthetic from a country in `blocked_countries` (use a VPN); the
  WAF should return `403`.
- Loop `/api/auth/login` 11×/min from one IP — expect blocks after the
  10th attempt.
- Send `GET /admin` — expect `403`.
- Pull the WAF event log; confirm rules fire.
- Confirm the in-app rate limiter (Redis-based) only kicks in for
  authenticated users — the WAF should be catching unauthenticated
  abuse before it reaches the API.

---

## 4. Move secrets into a secret manager

`kubernetes/02-configmap-secrets.yaml` currently ships placeholder
values. They must be replaced via your platform's secret-injection
mechanism, **never committed**. The recommended path is the [External
Secrets Operator (ESO)](https://external-secrets.io/) backed by AWS
Secrets Manager (or HashiCorp Vault if you already run one).

This repo includes the manifests at
`[kubernetes/external-secrets/](kubernetes/external-secrets/README.md)`.

### 4.1 One-time install (cluster-wide)

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace
kubectl get pods -n external-secrets   # all Running
```

### 4.2 Stage the secret

#### AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name /aegis/production \
  --description "AEGIS-AI runtime secrets" \
  --secret-string file://aegis-prod.json
```

`aegis-prod.json` must contain a JSON object with **all** the keys
listed in `kubernetes/external-secrets/02-external-secret-aegis.yaml`.
Confirm with:

```bash
aws secretsmanager get-secret-value --secret-id /aegis/production \
  --query SecretString --output text | jq .
```

#### HashiCorp Vault (alternative)

```bash
vault kv put kv/aegis/production @aegis-prod.json
vault kv get -format=json kv/aegis/production | jq .
```

### 4.3 Apply ESO manifests

Pick **one** backend.

```bash
# AWS path:
kubectl apply -f kubernetes/external-secrets/01-secret-store-aws.yaml
kubectl apply -f kubernetes/external-secrets/02-external-secret-aegis.yaml

# OR Vault path:
kubectl apply -f kubernetes/external-secrets/03-vault-alternative.yaml
```

Verify:

```bash
kubectl get externalsecret -n aegis aegis-secrets
# NAME            STORE              REFRESH INTERVAL   STATUS
# aegis-secrets   aegis-aws-secrets  30m                SecretSynced
kubectl get secret -n aegis aegis-secrets -o jsonpath='{.data}' | jq '.|keys'
```

### 4.4 Switch the Deployments

The API and worker Deployments already reference `aegis-secrets` (see
`kubernetes/05-api-deployment.yaml` and `09-worker-deployment.yaml`).
Once ESO has projected the live values into that Secret, restart the
pods so they pick up env from the new source:

```bash
kubectl rollout restart deployment/aegis-api    -n aegis
kubectl rollout restart deployment/aegis-worker -n aegis
```

### 4.5 Decommission the placeholder

Edit `kubernetes/02-configmap-secrets.yaml` and **remove** the inline
`Secret/aegis-secrets` block (the ConfigMap above it can stay — it
contains non-secret tunables). Commit the change with a message like
`chore(k8s): remove inline secret placeholders, ESO is now source of truth`.

### 4.6 Rotation

After this point, you rotate values **in AWS Secrets Manager / Vault
only**. ESO syncs every 30 min. To force-sync:

```bash
kubectl annotate externalsecret aegis-secrets -n aegis \
  force-sync=$(date +%s) --overwrite
kubectl rollout restart deployment/aegis-api    -n aegis
kubectl rollout restart deployment/aegis-worker -n aegis
```

---

## 5. Engage a third-party penetration tester

This is a 4–8 week lead-time activity; start it the day before launch
even if you have not finished items 1–4.

### 5.1 Procurement

1. Use `[docs/PENTEST_RFP.md](docs/PENTEST_RFP.md)` — it is
   pre-scoped to AEGIS-AI's architecture (USSD, Twilio, Supabase RLS,
   Kubernetes RBAC, Cloudflare WAF, encrypted-at-rest fields).
2. Send to **at least three** vendors. Suggested South-African options:

- MWR / SensePost
- Cyanre / DDPro
- Galix
- Performanta
  International: NCC Group, Bishop Fox, Trail of Bits.

3. Insist on CREST or OSCP-credentialled testers. Reject CV-light
   responses.
4. Sign NDA + Statement of Work. Set fee ≤ R 250 000 for a 5-day
   grey-box engagement; budget a re-test (≤ R 60 000) into the SoW.

### 5.2 Pre-test prep

Before the test starts:

- Provision a dedicated **staging** environment that mirrors prod
  (same SKUs, same WAF). The tester will touch this — never prod.
- Issue test accounts for each role (counsellor, CHW, admin, super-admin,
  survivor) and document the credentials in the tester's secure share.
- Provide a code drop: tag the commit they will test (`pentest-2026-Q2`),
  generate a Git bundle, and ship it under NDA.
- Share `SECURITY.md`, `RUNBOOK.md`, `DEPLOYMENT.md`, and the threat
  model.
- Pre-create a Slack channel `#pentest-2026Q2` with the tester for fast
  back-and-forth.

### 5.3 During the test

- Daily 15-minute stand-up with the tester.
- Engineering on-call available for "this looks like an outage, am I
  causing it?" questions.
- Audit-log retention bumped to ≥ 90 days for the duration.

### 5.4 After the test

- Triage findings within 5 business days. CVSS ≥ 7 fixed before launch.
- Schedule the contracted re-test 2–3 weeks after report delivery.
- On clean re-test, vendor issues a **Letter of Attestation** — file it
  in the compliance pack.

---

## 6. Migrate the notification worker to BullMQ

Codeable but invasive: I have shipped the **scaffold** in
`server/queue/bullmqDispatcher.ts` and the migration plan in
`docs/BULLMQ_MIGRATION.md`. The default path remains the Supabase
polling worker, gated behind `USE_BULLMQ_NOTIFICATIONS=true`. Below is
the operator-facing rollout.

### 6.1 Phase 1 — staging soak (1 week)

1. Set `USE_BULLMQ_NOTIFICATIONS=true` in **staging** secret manager.
2. Pick up `server/queue/bullmqDispatcher.ts` (already on main).
3. Engineering implements the dual-write step (insert into
   `notification_queue` AND call `enqueueNotificationJob()`) — see
   `docs/BULLMQ_MIGRATION.md` Phase 1.
4. Deploy. Watch:

- Twilio delivery success rate (Datadog dashboard `Notifications`)
- Redis `aegis:notifications` queue depth (Grafana panel — add via
  `kubectl apply -f config/grafana/dashboards/bullmq.json`)
- Audit-log gap detector (already running in cron).

5. Acceptance criteria:

- No duplicate sends over 7 days.
- Job failure rate < 1%.
- P99 send latency unchanged or improved.

### 6.2 Phase 2 — single-source

1. Bump `kubernetes/09-worker-deployment.yaml` `replicas` from 1 → 3.
2. Set `BULLMQ_NOTIFICATION_CONCURRENCY=10` per replica.
3. Add an HPA targeting CPU on the worker Deployment.
4. Stop polling: in `TwilioNotificationService.processPendingNotifications`,
   short-circuit when `USE_BULLMQ_NOTIFICATIONS=true`.

### 6.3 Phase 3 — full cutover (production)

1. Set `USE_BULLMQ_NOTIFICATIONS=true` in production secret manager.
2. Deploy. Watch the dashboards for 24 hours.
3. After 1 week of clean signal, remove the polling-loop branch from
   `server/worker.ts`. Squash-merge.

### 6.4 Rollback (any phase)

Set `USE_BULLMQ_NOTIFICATIONS=false`, force-sync ESO, restart the
worker Deployment. The polling loop resumes.

---

## 7. Supabase PITR + off-site backups + quarterly DR drill

The audit found Supabase backups enabled, but no PITR (Point-in-Time
Recovery) and no off-site copy. Both must be in place before launch.

### 7.1 Enable PITR

1. Supabase Dashboard → your project → **Settings → Database → Backups**.
2. Toggle **Point-in-Time Recovery** ON. PITR is a **paid** add-on
   (≈ $40/mo at the time of writing); confirm billing.
3. Set **PITR retention** to **14 days** (default 7).

### 7.2 Schedule logical off-site backups

Supabase backups live on Supabase infrastructure; if a Supabase region
fails, you also lose the backup. Mirror them off-site daily.

```bash
# scripts/backup-supabase.sh — add this to a CronJob
DATE=$(date +%Y%m%d-%H%M)
docker run --rm -v $PWD:/work postgres:16-alpine \
  pg_dump "$SUPABASE_PG_URL" \
  --format=custom \
  --no-owner \
  --file /work/aegis-$DATE.dump

aws s3 cp aegis-$DATE.dump s3://aegis-backups-offsite/$DATE/ \
  --sse aws:kms --sse-kms-key-id alias/aegis-backups
```

Apply as a Kubernetes CronJob (1 replica, 02:00 UTC daily). The S3
bucket should:

- Live in a **different region** from Supabase.
- Have **versioning** + **object lock** enabled for compliance.
- Have a 90-day **lifecycle rule** to Glacier Deep Archive.

### 7.3 Quarterly DR drill

Run `scripts/dr-drill.ps1` once per quarter. It walks you through the
full procedure (announce → restore Supabase to fresh project → verify
schema, audit-chain, encryption → bring up API/worker against DR project
→ E2E smoke → tear down → lessons learned) and produces a JSON report.

```powershell
./scripts/dr-drill.ps1 -OutputDir ./reports
# Saves to reports/dr-drill-YYYYMMDD-HHMMSS.json
```

Attach the JSON report to your quarterly compliance pack.

### 7.4 Verify

- Restore a backup to a fresh Supabase project today (do not skip this —
  untested backups are not backups). The DR drill script enforces this.
- Confirm the audit-log integrity chain still verifies after restore.
- Confirm encrypted-at-rest fields decrypt with the rotated keys.

---

## 8. Un-skip RLS / edge-function integration tests

The two integration suites under `src/lib/__tests__/` are now
**conditionally skipped** rather than hard-skipped. They auto-run when
`VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, and stay
skipped locally for everyone else.

This change is already on disk:

- `src/lib/__tests__/rls.integration.test.ts` — uses `describe.skipIf(!shouldRun)`.
- `src/lib/__tests__/edge-function.integration.test.ts` — already used
  the same pattern.

### 8.1 Provision the test Supabase project

1. Supabase Dashboard → **New project** → name `aegis-integration-tests`,
   region: same as production, plan: **Free**.
2. Run the migrations against it:

```bash
 supabase link --project-ref <integration-ref>
 supabase db push
```

3. Seed minimum fixture data (the integration tests create what they
   need; nothing extra required).
4. Capture the three secrets:

- `INTEGRATION_SUPABASE_URL`
- `INTEGRATION_SUPABASE_ANON_KEY`
- `INTEGRATION_SUPABASE_SERVICE_KEY`

### 8.2 Wire into CI

A workflow is already shipped at
`.github/workflows/integration-tests.yml`. It triggers nightly at
03:00 UTC and on `workflow_dispatch`. Configure the three GitHub
secrets (Settings → Secrets and variables → Actions) with the values
from 8.1.

Trigger it manually once to confirm:

```bash
gh workflow run integration-tests
gh run watch
```

Acceptance: green run within 5 minutes, JUnit + coverage artifacts
attached.

### 8.3 Run locally (optional)

```powershell
$env:VITE_SUPABASE_URL = "<integration-url>"
$env:VITE_SUPABASE_KEY = "<anon-key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-key>"
npx vitest run src/lib/__tests__/rls.integration.test.ts
npx vitest run src/lib/__tests__/edge-function.integration.test.ts
Remove-Item Env:\VITE_SUPABASE_URL, Env:\VITE_SUPABASE_KEY, Env:\SUPABASE_SERVICE_ROLE_KEY
```

### 8.4 Cleanup hygiene

The RLS tests insert rows into `audit_logs`, `mfa_credentials`,
`sessions`, `escalation_events`, `rate_limits`, and `ussd_sessions`.
The `afterEach` block already deletes audit logs; extend it to clean
up the others if the integration project starts to balloon.

---

## Pre-flight environment check

Before every production deploy, run:

```bash
node scripts/check-env.cjs --file .env.production
# or in CI, against the projected env:
node scripts/check-env.cjs
```

It validates that **every** required variable is present, non-placeholder,
correctly formatted (URL/hex/length), and that production-only secrets
(e.g. `TELKOM_WEBHOOK_SECRET`) are set when `NODE_ENV=production`. Wire
it into your deploy gate:

```yaml
# .github/workflows/ci-cd.yml — add before the deploy step
- name: Validate production env
  run: node scripts/check-env.cjs --file .env.production
  if: github.ref == 'refs/heads/main'
```

---

## Tracking template

Copy this into your project tracker and tick off each row:

```
[ ] 1. Credentials rotated — Supabase keys, JWT secret, DB password,
       Twilio, Telkom, ENCRYPTION/CHAT/JWT/REFRESH/METRICS/WEBHOOK secrets
[ ] 2. POPIA / DPO env vars set in build-time secret store
[ ] 3. WAF live (Cloudflare / AWS / GCP), origin locked to WAF IPs
[ ] 4. Secret manager (AWS SM / Vault) projecting via External Secrets
       Operator; placeholder Secret deleted from kubernetes/02-...
[ ] 5. Pentest vendor selected, SoW signed, kickoff date booked
[ ] 6. BullMQ Phase 1 in staging, success criteria met
[ ] 7. Supabase PITR enabled, off-site backup CronJob green for 7 days,
       quarterly DR drill scheduled
[ ] 8. Integration test Supabase project live, GH secrets configured,
       integration-tests workflow green
```
