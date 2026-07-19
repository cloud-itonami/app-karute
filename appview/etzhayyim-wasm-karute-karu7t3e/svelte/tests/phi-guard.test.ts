// Smoke-test for the karute-phi-plaintext-guard lint script.
// Spawns node against fixtures to verify the regex correctly flags violations
// and allows encrypted-context / explicit-allow patterns.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(__dirname, '../../../../../..');
const SCRIPT = resolve(ROOT, '70-tools/scripts/lint/karute-phi-plaintext-guard.mjs');
const FIX_DIR = resolve(tmpdir(), `karute-guard-test-${process.pid}`);

beforeAll(() => {
  mkdirSync(FIX_DIR, { recursive: true });
});
afterAll(() => {
  rmSync(FIX_DIR, { recursive: true, force: true });
});

function writeFx(name: string, body: string): string {
  const p = resolve(FIX_DIR, name);
  writeFileSync(p, body, 'utf8');
  return p;
}

function runGuard(...files: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync('node', [SCRIPT, ...files], { encoding: 'utf8' });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('karute-phi-plaintext-guard', () => {
  it('flags direct PDS createRecord for karute inner type', () => {
    const p = writeFx('bad-create.ts', `
      await agent.com.atproto.repo.createRecord({
        collection: "com.etzhayyim.karute.soapNote",
        record: { subjective: "PHI" }
      });
    `);
    const r = runGuard(p);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/plaintext PHI write target/);
  });

  it('flags $type literal with karute inner type', () => {
    const p = writeFx('bad-type.ts', `
      const doc = {
        $type: "com.etzhayyim.karute.patient",
        name: { family: "Y" }
      };
    `);
    const r = runGuard(p);
    expect(r.code).toBe(1);
  });

  it('allows encryptedWrite with innerType', () => {
    const p = writeFx('good-encrypted.ts', `
      await sdk.encryptedWrite({
        innerType: "com.etzhayyim.karute.observation",
        recipients: [],
        record: { code: "8480-6" }
      });
    `);
    const r = runGuard(p);
    expect(r.code).toBe(0);
  });

  it('respects inline allow', () => {
    const p = writeFx('allowed.ts', `
      const x = { collection: "com.etzhayyim.karute.encounter" }; // phi-guard: allow
    `);
    const r = runGuard(p);
    expect(r.code).toBe(0);
  });

  it('passes on files with no karute references', () => {
    const p = writeFx('clean.ts', `
      const x = { foo: 1 };
    `);
    const r = runGuard(p);
    expect(r.code).toBe(0);
  });
});
