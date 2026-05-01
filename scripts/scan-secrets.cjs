#!/usr/bin/env node
/**
 * Pre-commit secret scanner.
 *
 * Scans staged files for high-entropy strings and known secret patterns.
 * Exits non-zero (blocking the commit) when a likely secret is detected.
 *
 * Patterns covered:
 *   - Supabase keys (sb_publishable_*, sb_secret_*, eyJ... service role JWTs)
 *   - Twilio Account SIDs (AC + 32 hex chars) and auth tokens
 *   - Generic 32/64-byte hex blobs (treated as encryption / JWT secrets)
 *   - Telkom-style HMAC secrets (TELKOM_WEBHOOK_SECRET)
 *   - AWS access keys (AKIA / ASIA + 16 alnum)
 *   - Google API keys (AIza + 35 chars)
 *   - Generic .env-style assignments containing literal API tokens
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ALLOW_PATHS = [
  '.env.example',
  'scripts/scan-secrets.cjs',
  'SECURITY.md',
  'RUNBOOK.md',
  // Self-test for the scanner: contains intentional fake secrets used as
  // assertion fixtures. Excluded so the scanner does not flag itself.
  'src/__tests__/server/scanSecrets.test.ts',
];

const SKIP_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.lock',
  '.tsbuildinfo',
]);

const PATTERNS = [
  {
    id: 'supabase-publishable-key',
    regex: /sb_publishable_[A-Za-z0-9_\-]{20,}/g,
  },
  {
    id: 'supabase-service-role-key',
    regex: /sb_secret_[A-Za-z0-9_\-]{20,}/g,
  },
  {
    id: 'jwt-token',
    regex: /eyJ[A-Za-z0-9_\-]{20,}\.eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/g,
  },
  {
    id: 'twilio-account-sid',
    regex: /\bAC[a-f0-9]{32}\b/g,
  },
  {
    id: 'twilio-auth-token',
    regex: /\b[a-f0-9]{32}\b/g,
    contextHint: /(twilio|auth.?token)/i,
  },
  {
    id: 'aws-access-key',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    id: 'google-api-key',
    regex: /AIza[0-9A-Za-z_\-]{35}/g,
  },
  {
    id: 'high-entropy-hex',
    regex: /\b[a-fA-F0-9]{64}\b/g,
    contextHint: /(KEY|SECRET|TOKEN|PASSWORD)\s*=/,
  },
  {
    id: 'high-entropy-hex-32',
    regex: /\b[a-fA-F0-9]{32}\b/g,
    contextHint: /(KEY|SECRET|TOKEN|PASSWORD)\s*=/,
  },
];

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function shouldSkip(file) {
  if (ALLOW_PATHS.includes(file)) return true;
  const ext = path.extname(file).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return true;
  if (file.startsWith('node_modules/')) return true;
  if (file.startsWith('dist/')) return true;
  if (file.startsWith('coverage/')) return true;
  if (file.startsWith('test-results/')) return true;
  if (file.startsWith('dev-dist/')) return true;
  if (file.startsWith('.playwright-mcp/')) return true;
  return false;
}

function scanFile(file) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');
  const findings = [];

  for (const { id, regex, contextHint } of PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const value = match[0];
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);

      if (contextHint && !contextHint.test(line)) continue;
      if (line.includes('replace-with-')) continue;
      if (line.includes('your-')) continue;
      if (line.includes('YOUR-')) continue;
      if (line.includes('example')) continue;
      if (/[a-f]{32,}/i.test(value) && /^[a-f]{32,}$/i.test(value) === false) continue;

      findings.push({ id, value: redact(value), line: line.trim().slice(0, 200) });
    }
  }

  return findings;
}

function redact(value) {
  if (value.length <= 12) return '***';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function main() {
  const files = getStagedFiles();
  const matches = [];

  for (const file of files) {
    if (shouldSkip(file)) continue;
    const findings = scanFile(file);
    for (const finding of findings) {
      matches.push({ file, ...finding });
    }
  }

  if (matches.length > 0) {
    console.error('\n[secret-scan] Possible secrets found in staged files:\n');
    for (const m of matches) {
      console.error(`  - ${m.file}  [${m.id}]  ${m.value}`);
      console.error(`      → ${m.line}`);
    }
    console.error(
      '\nRefuse to commit. Move the value to a secret manager and replace it with a placeholder before committing.'
    );
    console.error('Override with `git commit --no-verify` only when you are sure.\n');
    process.exit(1);
  }
}

main();
