#!/usr/bin/env bash
# Generates cryptographic secrets for AEGIS-AI deployment.
# Output is a series of KEY=value lines suitable for piping into a secret manager.
#
# Usage:
#   ./scripts/generate-keys.sh                  # human-readable output
#   ./scripts/generate-keys.sh --env > .env.new # .env-style output
#   ./scripts/generate-keys.sh --json           # JSON for secret managers

set -euo pipefail

mode="human"
case "${1:-}" in
  --env)  mode="env" ;;
  --json) mode="json" ;;
  -h|--help)
    sed -n '2,12p' "$0"
    exit 0
    ;;
esac

hex32() { openssl rand -hex 32; }
hex16() { openssl rand -hex 16; }

ENCRYPTION_KEY="$(hex32)"
CHAT_ENCRYPTION_KEY="$(hex32)"
JWT_SECRET="$(hex32)"
REFRESH_TOKEN_SECRET="$(hex32)"
METRICS_TOKEN="$(hex32)"
TELKOM_WEBHOOK_SECRET="$(hex32)"
SCAN_PRECOMMIT_TOKEN="$(hex16)"

if [[ "$mode" == "json" ]]; then
  cat <<JSON
{
  "ENCRYPTION_KEY": "$ENCRYPTION_KEY",
  "CHAT_ENCRYPTION_KEY": "$CHAT_ENCRYPTION_KEY",
  "JWT_SECRET": "$JWT_SECRET",
  "REFRESH_TOKEN_SECRET": "$REFRESH_TOKEN_SECRET",
  "METRICS_TOKEN": "$METRICS_TOKEN",
  "TELKOM_WEBHOOK_SECRET": "$TELKOM_WEBHOOK_SECRET",
  "SCAN_PRECOMMIT_TOKEN": "$SCAN_PRECOMMIT_TOKEN"
}
JSON
  exit 0
fi

if [[ "$mode" == "env" ]]; then
  cat <<ENV
ENCRYPTION_KEY=$ENCRYPTION_KEY
CHAT_ENCRYPTION_KEY=$CHAT_ENCRYPTION_KEY
JWT_SECRET=$JWT_SECRET
REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET
METRICS_TOKEN=$METRICS_TOKEN
TELKOM_WEBHOOK_SECRET=$TELKOM_WEBHOOK_SECRET
SCAN_PRECOMMIT_TOKEN=$SCAN_PRECOMMIT_TOKEN
ENV
  exit 0
fi

cat <<HUMAN

AEGIS-AI cryptographic secrets
==============================
Treat these as production credentials. Do NOT paste them into chat, email, or commit them.

ENCRYPTION_KEY        = $ENCRYPTION_KEY
CHAT_ENCRYPTION_KEY   = $CHAT_ENCRYPTION_KEY
JWT_SECRET            = $JWT_SECRET
REFRESH_TOKEN_SECRET  = $REFRESH_TOKEN_SECRET
METRICS_TOKEN         = $METRICS_TOKEN
TELKOM_WEBHOOK_SECRET = $TELKOM_WEBHOOK_SECRET
SCAN_PRECOMMIT_TOKEN  = $SCAN_PRECOMMIT_TOKEN

Next steps:
  1. Paste each value into your platform's secret store (Render env group, K8s Secret, etc.).
  2. NEVER reuse values across staging/production/dev.
  3. Document the rotation date in SECURITY.md (Rotation cadence section).
HUMAN
