# AEGIS-AI — Ele-vate AI Africa submission dossier

> Source competition page: <https://ele-vate.co.za/>

This document is the structured "judges' walkthrough" of the AEGIS-AI platform for the [Ele-vate AI Africa](https://ele-vate.co.za/) programme. Each section maps an explicit competition theme to the working artefacts in this repository so an evaluator can verify the claim by opening one or two files.

---

## 1 · Competition mandate vs. AEGIS-AI

| Ele-vate AI Africa pillar (verbatim from <https://ele-vate.co.za/>)                   | AEGIS-AI evidence (paths in this repo)                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **"Artificial Intelligence"** — frontier AI for inclusive growth                      | Trauma-informed Groq + Anthropic chat, Hugging Face + Xenova risk scoring, AI fairness audit dashboard, AGI-governance scaffolding. See `supabase/functions/aegis-survivor-chat/`, `server/intelligence/riskScoring.ts`, `src/components/analyst/AIFairnessAudit.tsx`, `server/governance/agiControlFramework.ts`. |
| **"Edge Computing"**                                                                  | Supabase Edge Functions (Deno) for chat, NLP classification, USSD gateway, registration. PWA service worker (`vite-plugin-pwa`) with offline asset shell + `NetworkFirst` API caching. Cloudflare Worker scaffold under `cloudflare/`.                                                                             |
| **"Robotics"**                                                                        | ESP32-C3 BLE **Silent SOS** wearable panic firmware (~USD 5–8 BOM) + Web Bluetooth bridge at `/demo/silent-sos`. See `firmware/silent-sos-esp32/` and `src/pages/SilentSosDemo.tsx`.                                                                                                                               |
| **"Automation"**                                                                      | BullMQ-backed notification + escalation queue, Twilio SMS/voice fallback, idempotent emergency escalation, hash-chained audit cron. See `server/queue/`, `server/workflows/escalationWorkflow.ts`, `server/notifications/twilio.ts`.                                                                               |
| **"Inclusive, context-relevant, online and offline-first"**                           | USSD `*135*1782#` flow on any feature phone (Telkom HMAC-signed), WhatsApp Cloud API channel, 15 SADC + African languages, WCAG 2.1 AA primitives, IndexedDB queue for offline reports. See `server/ussd/`, `server/routes/whatsappRoutes.ts`, `src/lib/i18n/`, `src/hooks/useOfflineSync.ts`.                     |
| **"Underserved communities to Global stages"**                                        | First-class POPIA + South African crisis numerics (10111, 0800 428 428), `af-south-1` data residency, but every component is portable to other LMIC contexts (the language list, the USSD code, and the crisis numbers are environment-driven).                                                                    |
| **"Empowering youth and women … shape the continent's digital future competitively"** | The platform's mission _is_ GBV emergency response — primary beneficiaries are women and girls. Survivor-first design, anonymous reporting, peer-support network, voice incident reporting. See `src/components/survivor/PeerSupportNetwork.tsx`, `src/components/survivor/VoiceIncidentReporter.tsx`.             |
| **"End to end adaptable solutions"**                                                  | Multi-channel ingestion (web/USSD/WhatsApp/BLE) → AI triage → encrypted case → role-aware response (police, NGO, counselor, CHW, analyst) → outcome tracking with auditable handoffs.                                                                                                                              |
| **"Increased operational efficiency"**                                                | Tiered Redis rate limiters, BullMQ queue, supabase timeout wrappers, Prometheus metrics with Grafana dashboards. Police "priority case queue" + workload grid + queue metrics dashboard.                                                                                                                           |
| **"Increased ability to make informed decisions"**                                    | Live impact dashboard with hotspot heatmap, AI fairness audit, policy simulation, justice analytics. See `src/pages/ImpactDashboard.tsx`, `src/components/policy/PolicySimulation.tsx`, `src/components/justice/JusticeAnalytics.tsx`.                                                                             |

---

## 2 · The 60-second pitch

> **For every survivor of gender-based violence in South Africa — including the 40 %+ who do not own a smartphone or cannot afford reliable data — AEGIS-AI is a single national response grid that meets them on whatever channel they have: web, WhatsApp, USSD on any feature phone, voice, or a USD-5 BLE wearable. AI triage classifies risk, encrypted handoffs route the case to the right responder (police, NGO, counselor, CHW), and a hash-chained audit log keeps every step accountable to POPIA. The same grid surfaces real-time policy intelligence to government and civil society so the response improves over time.**

The differentiator is not "another GBV chatbot." It is the **inclusive, edge-aware, multichannel response infrastructure** that judges can verify works on a feature phone with no data — see the USSD smoke test in `npm run ussd:local`.

---

## 3 · Demonstrable artefacts (15-minute judging slot)

| Minute | Demo                                                                                                                                                                          | Path / command                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0–2    | **The grid is real.** `npm run preflight` shows lint + typecheck + 195 unit/integration tests green + production build.                                                       | `npm run preflight`                                                 |
| 2–4    | **Inclusive by default.** Open the landing page, switch language to isiZulu/Setswana/Sesotho/Afrikaans/Amharic.                                                               | `npm run dev:client` → `/`                                          |
| 4–6    | **Offline first.** Run the USSD simulator. Show the same survivor flow on a feature phone code path.                                                                          | `npm run ussd:local`                                                |
| 6–8    | **Trauma-informed AI.** Send a message in isiZulu through the survivor chat — Groq responds in isiZulu, message is AES-256-GCM encrypted at rest in `survivor_chat_messages`. | `src/components/survivor/SurvivorSupport.tsx`                       |
| 8–10   | **Robotics edge.** Press the ESP32 Silent SOS button → web BLE bridge → escalation event in the police dashboard.                                                             | `firmware/silent-sos-esp32/`, `/demo/silent-sos`                    |
| 10–12  | **Accountability.** Show the immutable hash-chained audit log + the 6-hourly verification cron + the public `GET /api/audit/verify` endpoint.                                 | `server/security/auditLog.ts`, `server/index.ts:runAuditChainCheck` |
| 12–14  | **Decision intelligence.** Open the impact dashboard: hotspot heatmap, fairness audit, policy simulation.                                                                     | `/impact`                                                           |
| 14–15  | **Sustainability of the grid.** Show K8s manifests (`kubernetes/`), Prometheus alerts (`config/`), pentest RFP, and the secret-scan pre-commit hook.                          | `SECURITY.md`, `kubernetes/`, `docs/PENTEST_RFP.md`                 |

---

## 4 · Scoring rubric self-assessment

These are AEGIS-AI's self-scored marks against the public-facing Ele-vate AI Africa themes. Each row is auditable — a judge can open the cited file and verify.

| Rubric dimension                          | Self-score   | Evidence                                                                                                                                                                                |
| ----------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Originality of the AI use case            | 9 / 10       | Encrypted, multilingual, trauma-informed GBV triage with explicit refusal to persist plaintext. Combines remote LLM (Groq) with on-device Xenova transformers for offline risk scoring. |
| Edge / offline-first inclusion            | 10 / 10      | USSD on a feature phone, WhatsApp on a 2G data plan, PWA with `NetworkFirst` API cache, IndexedDB offline queue, Cloudflare Worker config.                                              |
| Robotics / hardware contribution          | 8 / 10       | ESP32-C3 BLE wearable, ~USD 5 BOM, open BOM and Arduino sketch in repo, working PWA bridge.                                                                                             |
| Automation depth                          | 9 / 10       | BullMQ queue, idempotent escalation, Twilio fallback, hash-chained audit cron, supabase timeout wrappers, circuit breakers, intrusion detection.                                        |
| Production-readiness                      | 9 / 10       | 195 tests passing, k8s + Render + Docker compose targets, monitoring stack, runbook, pentest RFP, secret-scan pre-commit hook.                                                          |
| Inclusion of underserved communities      | 10 / 10      | 15 African languages, USSD on any feature phone, free crisis numbers, WCAG 2.1 AA, anonymous reporting.                                                                                 |
| Women/youth empowerment                   | 10 / 10      | The product itself is GBV emergency response. Survivor-first UX, peer support network, voice incident reporting.                                                                        |
| POPIA / regulatory compliance             | 10 / 10      | Hash-chained immutable audit, AES-256-GCM at rest, RLS policies, registered DPO, 90-day retention, `delete_data` self-service.                                                          |
| Documentation                             | 9 / 10       | README, ARCHITECTURE, SECURITY, DEPLOYMENT, RUNBOOK, OPERATOR_PLAYBOOK, this dossier, and per-feature READMEs.                                                                          |
| Local economic / value-chain contribution | 8 / 10       | ESP32 BOM is locally sourceable; intervention is locally owned (SA crisis numerics, POPIA registration); architecture portable to any LMIC.                                             |
| **Total**                                 | **92 / 100** |                                                                                                                                                                                         |

---

## 5 · Open improvements before final submission (transparent self-critique)

1. **Live `npm run preflight` script** — added in this submission round so judges can run a single command. Done.
2. **Public health badge** — wire `/health/ready` JSON into a shields.io endpoint badge in the README. (Optional, not blocking.)
3. **Penetration test on file** — RFP exists; an actual report would lift the production-readiness score to 10/10.
4. **DR drill artefact** — `RUNBOOK.md` describes the procedure; the most recent drill log should be appended.
5. **Bilingual landing page hero** — currently English first with an in-page switcher; a server-side language preference cookie is on the roadmap.
6. **Hardware demo video (~30 s)** — `firmware/silent-sos-esp32/README.md` has the script; the recorded clip should be linked from this dossier before final submission.
7. **Anonymous-reporting code path end-to-end test** — currently covered by unit tests; a Playwright run-through would close the loop.

These are listed openly so the panel can verify the scoring is honest and to demonstrate the team's awareness of where the product needs to grow.

---

## 6 · Why AEGIS-AI deserves to win

AEGIS-AI is not just an AI demo. It is **deployable national infrastructure** that:

- meets the most underserved users on the most basic phone,
- treats survivor data with cryptographic and legal seriousness,
- gives every responder role its own dashboard, not a generic admin console,
- closes the loop with policy intelligence, fairness audit, and an immutable audit chain, and
- ships with the operational scaffolding (monitoring, deployment, runbooks, secret-scan, pentest RFP) that turns a hackathon prototype into something a province or a national rollout can actually adopt.

That is the bridge from _"underserved communities"_ to _"global stages"_ — and it's exactly what Ele-vate AI Africa is asking for.
