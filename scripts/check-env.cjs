#!/usr/bin/env node
/**
 * Production environment validator.
 *
 * Reads either process.env or a file passed via --file <path>, and verifies
 * every variable required for a production AEGIS-AI deployment is present
 * and non-placeholder. Exits non-zero with a list of issues if anything is
 * missing or still set to a stub value.
 *
 * Usage:
 *   node scripts/check-env.cjs                         # checks current env
 *   node scripts/check-env.cjs --file .env.production  # checks a file
 *   node scripts/check-env.cjs --json                  # machine-readable
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const argValue = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
};

const filePath = argValue('--file');
const asJson = flag('--json');

let env = process.env;
if (filePath) {
  const abs = path.resolve(filePath);
  const content = fs.readFileSync(abs, 'utf8');
  env = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
}

const PLACEHOLDER_HINTS = [
  /\[replace-with/i,
  /\byour[-_]/i,
  /^changeme$/i,
  /^example$/i,
  /^todo$/i,
  /\byour_/i,
];

const REQUIREMENTS = [
  // Core
  { key: 'NODE_ENV', expected: ['production', 'staging'] },
  { key: 'PORT' },
  { key: 'CORS_ORIGIN', mustStartWith: 'https://' },

  // Supabase
  { key: 'VITE_SUPABASE_URL', mustStartWith: 'https://' },
  { key: 'VITE_SUPABASE_KEY', minLength: 20 },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', minLength: 20 },

  // Encryption / auth
  { key: 'ENCRYPTION_KEY', hexLength: 64 },
  { key: 'CHAT_ENCRYPTION_KEY', hexLength: 64 },
  { key: 'JWT_SECRET', minLength: 32 },
  { key: 'REFRESH_TOKEN_SECRET', minLength: 32 },

  // Metrics protection
  { key: 'METRICS_TOKEN', minLength: 32, optional: true },

  // Webhooks
  { key: 'TELKOM_WEBHOOK_SECRET', minLength: 32, productionOnly: true },

  // POPIA / DPO (Section 2 of operator playbook)
  { key: 'VITE_POPIA_REGISTRATION_ID', minLength: 3 },
  { key: 'VITE_DPO_NAME', minLength: 2 },
  { key: 'VITE_DPO_EMAIL', mustMatch: /@/ },
  { key: 'VITE_DPO_PHONE', minLength: 5 },

  // Notification worker (one of API or worker must set)
  { key: 'NOTIFICATION_WORKER_ENABLED', expected: ['true', 'false'] },

  // Observability (recommended)
  { key: 'SENTRY_DSN', optional: true, mustStartWith: 'https://' },
  { key: 'CSP_REPORT_URI', optional: true, mustStartWith: 'https://' },

  // Audit cron (recommended)
  { key: 'AUDIT_CHAIN_CRON_ENABLED', optional: true, expected: ['true', 'false'] },

  // Redis
  { key: 'REDIS_URL', optional: true },
];

const findings = [];

const isPlaceholder = (value) =>
  typeof value === 'string' && PLACEHOLDER_HINTS.some((rx) => rx.test(value));

const inProduction = (env.NODE_ENV || '').toLowerCase() === 'production';

for (const req of REQUIREMENTS) {
  const value = env[req.key];
  const present = typeof value === 'string' && value.length > 0;

  if (!present) {
    if (req.optional) continue;
    if (req.productionOnly && !inProduction) continue;
    findings.push({ severity: 'error', key: req.key, reason: 'missing' });
    continue;
  }

  if (isPlaceholder(value)) {
    findings.push({ severity: 'error', key: req.key, reason: 'placeholder' });
    continue;
  }

  if (req.expected && !req.expected.includes(value)) {
    findings.push({
      severity: 'error',
      key: req.key,
      reason: `expected one of ${req.expected.join(' | ')}, got "${value}"`,
    });
    continue;
  }

  if (req.mustStartWith && !value.startsWith(req.mustStartWith)) {
    findings.push({
      severity: 'error',
      key: req.key,
      reason: `must start with "${req.mustStartWith}"`,
    });
    continue;
  }

  if (req.mustMatch && !req.mustMatch.test(value)) {
    findings.push({ severity: 'error', key: req.key, reason: `must match ${req.mustMatch}` });
    continue;
  }

  if (req.minLength && value.length < req.minLength) {
    findings.push({
      severity: 'error',
      key: req.key,
      reason: `must be at least ${req.minLength} chars (was ${value.length})`,
    });
    continue;
  }

  if (req.hexLength && (value.length !== req.hexLength || !/^[0-9a-fA-F]+$/.test(value))) {
    findings.push({
      severity: 'error',
      key: req.key,
      reason: `must be ${req.hexLength}-char hex (was ${value.length} chars)`,
    });
    continue;
  }
}

const errorCount = findings.filter((f) => f.severity === 'error').length;

if (asJson) {
  console.log(
    JSON.stringify(
      { ok: errorCount === 0, environment: env.NODE_ENV || 'unknown', findings },
      null,
      2
    )
  );
  process.exit(errorCount === 0 ? 0 : 1);
}

if (errorCount === 0) {
  console.log(`[check-env] OK — all required variables present (NODE_ENV=${env.NODE_ENV})`);
  process.exit(0);
}

console.error(`[check-env] ${errorCount} issue(s) in environment (NODE_ENV=${env.NODE_ENV || 'unset'}):\n`);
for (const f of findings) {
  console.error(`  - ${f.key}: ${f.reason}`);
}
console.error(
  '\nFix the issues above before deploying. See OPERATOR_PLAYBOOK.md → "Pre-flight environment check".'
);
process.exit(1);
