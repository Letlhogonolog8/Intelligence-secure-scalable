# Cloudflare WAF — AEGIS-AI

This directory holds the Terraform module that provisions Cloudflare WAF
rules in front of the API. It is the canonical implementation of the
"Stand up a WAF" item from the operator playbook.

## Layout

| File | Purpose |
|---|---|
| `waf-rules.tf` | Custom rules, rate limits, managed ruleset overrides |
| `apply.sh` | Convenience wrapper around `terraform init/plan/apply` |

## Quick start

```bash
cd cloudflare

# 1. One-time: log in to Cloudflare and capture the zone ID
#    Dashboard → aegis-ai.co.za → Overview → API/Zone ID
export CLOUDFLARE_API_TOKEN=cf_pat_xxx       # WAF:Edit + Zone:Read
export TF_VAR_zone_id=ffe9...

# 2. Optional: override defaults
export TF_VAR_api_hostname=api.aegis-ai.co.za
export TF_VAR_blocked_countries='["KP","SY"]'

# 3. Provision
terraform init
terraform plan
terraform apply
```

## What gets provisioned

| Layer | Rule |
|---|---|
| Custom (firewall) | Block sanctioned countries (opt-in) |
| Custom (firewall) | Managed challenge for higher-risk countries (opt-in) |
| Custom (firewall) | Block scanners hitting `/admin`, `/.env`, `/.git/` |
| Custom (firewall) | Block mutating `/api/*` with no `Origin`/`Referer` (excludes USSD/Twilio webhooks/CSP report) |
| Custom (firewall) | Bot challenge on `/api/auth/*` when bot score < 30 |
| Rate limit | `/api/auth/*` — 10/min/IP |
| Rate limit | `/api/ussd` — 60/min/IP |
| Rate limit | `/api/*` — 600/min/IP |
| Managed | Cloudflare Managed Ruleset (DDoS, common exploits) |
| Managed | OWASP Core Ruleset (CRS) |

## If you do not use Terraform

The same rules can be applied via the dashboard:

* Cloudflare → **Security → WAF**
  * **Custom rules** tab → recreate the four entries above
  * **Rate limiting rules** tab → recreate the three entries above
  * **Managed rules** tab → enable Cloudflare Managed Ruleset + OWASP Core Ruleset
* Cloudflare → **Security → Bots** → enable Bot Fight Mode (free) or Super Bot
  Fight Mode (Pro)

The Terraform path is preferred because it:

* keeps the rules in version control,
* lets you replay them on a new zone (staging vs production),
* prevents drift between operators.

## After applying

1. Run a synthetic request from a country in `blocked_countries` (use a
   VPN) — expect a `403`.
2. Loop `/api/auth/login` 11 times per minute from one IP — expect
   blocks after the 10th attempt.
3. Pull the WAF event log: Cloudflare → **Security → Events** and
   confirm rules fire as expected.
