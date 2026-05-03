# AEGIS-AI — National GBV Response Grid

> **Inclusive, edge-aware, trauma-informed AI for gender-based violence response in South Africa and across the continent.**

AEGIS-AI is a single-repository, full-stack platform that unifies **survivors, NGOs, counselors, police, and policy analysts** on one secure, real-time response grid. It runs **online in the browser**, **offline-first via USSD `*123*456#`**, **on WhatsApp**, and **on a low-cost ESP32 BLE wearable panic button** — a genuine omnichannel safety net for communities where smartphones, data, or both are unreliable.

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml) [![POPIA](https://img.shields.io/badge/POPIA-aligned-blue)](SECURITY.md) [![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](LICENSE) [![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20Supabase-0ea5e9)](ARCHITECTURE.md) [![Edge](https://img.shields.io/badge/edge-Supabase%20Functions-000000)](supabase/functions) [![Robotics](https://img.shields.io/badge/robotics-ESP32--C3%20BLE-purple)](firmware/silent-sos-esp32)

---

## Why AEGIS-AI

South Africa records one of the **highest rates of gender-based violence in the world**. Survivors face fragmented services, broken referral pathways, and digital tools that assume always-on smartphones — which excludes the **rural, low-income, and feature-phone-only** users who most need help. AEGIS-AI is built **inclusively, context-relevantly, online and offline-first**, so the grid reaches everyone — not only those with data.

This is the exact mandate of [Ele-vate AI Africa](https://ele-vate.co.za/): _"At the frontier of Artificial Intelligence, Edge Computing, Robotics, and Automation, we create inclusive, context-relevant, online and offline-first tech based solutions that transform lives and livelihoods from underserved communities to Global stages."_ AEGIS-AI delivers on each of those four frontiers — see [`docs/ELEVATE_AI_AFRICA.md`](docs/ELEVATE_AI_AFRICA.md) for the competition-fit dossier.

---

## Capabilities at a glance

| Pillar               | What ships in this repo                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI**               | Trauma-informed Groq LLM chat, Anthropic Haiku triage, Hugging Face + Xenova transformers risk scoring, AI fairness audit dashboard, agentic governance hooks                                      |
| **Edge computing**   | Supabase Edge Functions (`aegis-survivor-chat`, `nlp-classify`, `vda-chat`, `ussd-gateway`), Cloudflare Workers config, PWA service worker with `NetworkFirst` API caching and offline asset shell |
| **Robotics / IoT**   | ESP32-C3 BLE Silent SOS firmware (~USD 5–8 BOM) + Web Bluetooth bridge at `/demo/silent-sos`                                                                                                       |
| **Automation**       | BullMQ-backed notification + escalation queue, Twilio SMS/voice fallback, idempotent emergency escalation, hash-chained audit cron                                                                 |
| **Inclusion**        | 15 SADC + African languages (en, zu, af, xh, st, tn, ts, ve, nso, nr, ss, sw, fr, am, ar), USSD `*123*456#` flow for any feature phone, WhatsApp Cloud channel, WCAG 2.1 AA-tested UI              |
| **Security & POPIA** | AES-256-GCM at rest, HMAC-signed Telkom callbacks, hash-chained immutable audit log, MFA TOTP, Supabase RLS hardening, intrusion detection, secret-scan pre-commit hook                            |
| **Observability**    | Prometheus metrics, Grafana provisioning, Sentry + Datadog wiring, k8s-ready readiness/liveness, hash-chain integrity cron                                                                         |

A deeper architectural map lives in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Quickstart

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
#   Fill VITE_SUPABASE_URL, VITE_SUPABASE_KEY,
#        SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY,
#        CHAT_ENCRYPTION_KEY (32-byte base64 or 64-char hex),
#        ANTHROPIC_API_KEY (optional), GROQ_API_KEY (optional).
#   See SECURITY.md for rotation cadence.

# 3. Run
npm run dev          # frontend (8080) + backend (3001)
npm run dev:all      # +ngrok tunnel for USSD / WhatsApp callbacks
npm run ussd:local   # local USSD smoke test (no Telkom)

# 4. Quality gates
npm run preflight    # lint + typecheck + test + build (all must pass)
```

---

## Channels

| Channel          | Entry point                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Web (PWA)        | `npm run dev:client` → http://localhost:8080                                                          |
| Backend API      | `npm run dev:server` → http://localhost:3001                                                          |
| USSD (offline)   | `*123*456#` (Telkom callback verified by HMAC) — local sim: `npm run ussd:local`                      |
| WhatsApp         | Meta WhatsApp Cloud API → `POST /api/whatsapp/webhook`, sessions in Redis (`aegis:wa:session:<E164>`) |
| Voice (web)      | `VoiceIncidentReporter.tsx` (Web Speech API, falls back to text)                                      |
| Silent SOS (BLE) | ESP32-C3 wearable → Web Bluetooth → `/demo/silent-sos` → `POST /api/cases/escalate`                   |

---

## Trust, safety, and compliance

- **POPIA-first**: hash-chained immutable audit log (`audit_logs_immutable`), per-user `delete_data` self-service through the survivor chat edge function, registered DPO contact, 90-day default chat retention with explicit `expires_at`.
- **Encryption**: AES-256-GCM for survivor chat, location PII, and clinical notes. The chat edge function refuses to persist messages if the encryption key is malformed or missing — **never falls back to plaintext**.
- **Hardened HTTP**: Helmet CSP without `unsafe-inline`, explicit `connect-src` allowlist, HSTS preload, immutable headers.
- **Rate limiting**: tiered Redis-backed limiters (default / api / strict / auth / mfa / escalation) with idempotency-key support on `POST /api/cases/escalate`.
- **Webhook signatures**: Telkom HMAC-SHA256 with `crypto.timingSafeEqual`, mandatory in production.
- **MFA**: TOTP via Supabase, strongly recommended for admin / police roles.

The full security policy, rotation cadence, and disclosure pipeline is in [`SECURITY.md`](SECURITY.md). Penetration test RFP is in [`docs/PENTEST_RFP.md`](docs/PENTEST_RFP.md).

---

## Deployment

| Target            | File                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Render            | [`render.yaml`](render.yaml)                                                                                                |
| Railway           | [`railway.toml`](railway.toml)                                                                                              |
| Docker (dev)      | [`docker-compose.yml`](docker-compose.yml)                                                                                  |
| Docker (prod)     | [`docker-compose.prod.yml`](docker-compose.prod.yml)                                                                        |
| Monitoring        | [`docker-compose.monitoring.yml`](docker-compose.monitoring.yml) (Prom + Grafana + Alertmanager + node-exporter + cAdvisor) |
| Kubernetes        | [`kubernetes/`](kubernetes) (read-only root FS, drop all caps, runs as UID 1000, ExternalSecrets-ready)                     |
| Cloudflare Worker | [`cloudflare/`](cloudflare)                                                                                                 |

Detailed playbook: [`DEPLOYMENT.md`](DEPLOYMENT.md), [`OPERATOR_PLAYBOOK.md`](OPERATOR_PLAYBOOK.md), [`RUNBOOK.md`](RUNBOOK.md).

---

## Repository map

```
src/         React + Vite PWA, role-aware dashboards, i18n, voice, BLE bridge
server/      Express API, security/, middleware/, routes/, queue/, intelligence/
supabase/    Edge Functions (Deno) + 30 SQL migrations (RLS + audit chain + PII pgcrypto)
firmware/    ESP32-C3 BLE Silent SOS sketch + flashing notes
config/      Prometheus rules, Grafana provisioning, Alertmanager
kubernetes/  Manifests (Deployment, Ingress, ExternalSecrets, NetworkPolicy)
cloudflare/  Worker entry + wrangler config
scripts/     Seed data, USSD smoke, secret-scan
docs/        Pentest RFP, BullMQ migration plan, Elevate AI Africa pitch
```

---

## Contributing

Pre-commit runs `lint-staged + typecheck` and a custom **secret scanner** (`scripts/scan-secrets.cjs`) that refuses to commit Supabase service-role keys, Twilio tokens, AWS access keys, JWTs, or generic 32/64-byte hex blobs assigned to `*KEY|*SECRET|*TOKEN|*PASSWORD` variables. Override only with `--no-verify` for known-safe placeholders — and explain why in the commit message.

---

## License

Currently `UNLICENSED` — this is an active competition submission. Reach the maintainers at `security@aegis-ai.co.za` (or the configured `VITE_DPO_EMAIL`) for evaluation access.
