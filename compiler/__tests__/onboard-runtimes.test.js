/**
 * onboard Step 4.5 (per-runtime agent config + hooks) stays in sync with the
 * hooks installer: every `rune hooks install --platform X` it tells users to
 * run must exist, and every hooks platform must be documented.
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLATFORM_KEYS } from '../adapters/hooks/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skill = readFileSync(path.join(ROOT, 'skills/onboard/SKILL.md'), 'utf-8');
const ref = readFileSync(path.join(ROOT, 'skills/onboard/references/runtime-configs.md'), 'utf-8');

describe('onboard per-runtime setup (Step 4.5)', () => {
  test('SKILL.md has Step 4.5 and points to the reference', () => {
    assert.match(skill, /### Step 4\.5 — Per-Runtime Agent Config \+ Hooks/);
    assert.match(skill, /\(references\/runtime-configs\.md\)/);
    assert.match(skill, /\/rune onboard --runtimes/);
  });

  test('every --platform named in the reference is a real hooks platform', () => {
    const named = [...ref.matchAll(/hooks install --platform ([a-z]+)/g)].map((m) => m[1]);
    assert.ok(named.length >= 5);
    for (const p of named) assert.ok(PLATFORM_KEYS.includes(p), `unknown hooks platform ${p}`);
  });

  test('every hooks platform is documented in the reference', () => {
    for (const p of PLATFORM_KEYS) {
      assert.match(ref, new RegExp(`--platform ${p}\\b`), `${p} missing from runtime-configs.md`);
    }
  });

  test('canonical-file rule: CLAUDE.md imports AGENTS.md; Gemini uses context.fileName', () => {
    for (const text of [skill, ref]) {
      assert.match(text, /@AGENTS\.md/);
      assert.match(text, /context\.fileName/);
    }
  });
});
