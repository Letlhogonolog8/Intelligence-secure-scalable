import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.join(__dirname, '../../../scripts/scan-secrets.cjs');

function runScannerOver(file: string): { code: number; stdout: string; stderr: string } {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-secrets-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tmpRepo });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpRepo });
    spawnSync('git', ['config', 'user.name', 'test'], { cwd: tmpRepo });
    const target = path.join(tmpRepo, 'sample.env');
    fs.writeFileSync(target, file);
    spawnSync('git', ['add', 'sample.env'], { cwd: tmpRepo });

    const result = spawnSync('node', [SCRIPT], { cwd: tmpRepo, encoding: 'utf8' });
    return {
      code: result.status ?? 0,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }
}

describe('scan-secrets pre-commit hook', () => {
  it('flags Supabase service role key', () => {
    const { code, stderr } = runScannerOver(
      'SUPABASE_SERVICE_ROLE_KEY=sb_secret_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890\n'
    );
    expect(code).toBe(1);
    expect(stderr).toMatch(/supabase-service-role-key/);
  });

  it('flags 64-byte hex encryption keys', () => {
    const hex = 'a'.repeat(64);
    const { code, stderr } = runScannerOver(`ENCRYPTION_KEY=${hex}\n`);
    expect(code).toBe(1);
    expect(stderr).toMatch(/high-entropy-hex/);
  });

  it('does not flag .env.example placeholders', () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-secrets-'));
    try {
      spawnSync('git', ['init', '-q'], { cwd: tmpRepo });
      spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpRepo });
      spawnSync('git', ['config', 'user.name', 'test'], { cwd: tmpRepo });
      const target = path.join(tmpRepo, '.env.example');
      fs.writeFileSync(
        target,
        'SUPABASE_SERVICE_ROLE_KEY=[replace-with-service-role-key]\nENCRYPTION_KEY=your-key\n'
      );
      spawnSync('git', ['add', '.env.example'], { cwd: tmpRepo });
      const result = spawnSync('node', [SCRIPT], { cwd: tmpRepo, encoding: 'utf8' });
      expect(result.status ?? 0).toBe(0);
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  it('passes when no secrets are present', () => {
    const { code } = runScannerOver('PORT=3000\nLOG_LEVEL=info\n');
    expect(code).toBe(0);
  });
});
