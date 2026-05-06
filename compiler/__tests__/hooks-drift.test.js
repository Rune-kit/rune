import assert from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { checkHookDrift, formatHookDriftResult } from '../commands/hooks/drift.js';
import { buildPreset, SETTINGS_REL_PATH } from '../commands/hooks/presets.js';

let tmpRoot;

async function seedClaude(root, settings) {
  await mkdir(path.join(root, '.claude'), { recursive: true });
  if (settings) {
    await writeFile(path.join(root, SETTINGS_REL_PATH), `${JSON.stringify(settings, null, 2)}\n`);
  }
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'rune-drift-'));
});

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

describe('checkHookDrift', () => {
  test('returns empty findings when settings.json matches canonical gentle preset', async () => {
    await seedClaude(tmpRoot, buildPreset('gentle'));
    const result = await checkHookDrift(tmpRoot);
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.summary.drifted, 0);
    assert.strictEqual(result.summary.missing, 0);
    assert.strictEqual(result.platforms.length, 1);
    assert.strictEqual(result.platforms[0].preset, 'gentle');
  });

  test('returns empty findings for canonical strict preset', async () => {
    await seedClaude(tmpRoot, buildPreset('strict'));
    const result = await checkHookDrift(tmpRoot);
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.platforms[0].preset, 'strict');
  });

  test('flags drifted entry when installed command differs from canonical', async () => {
    const baseline = buildPreset('gentle');
    // Mutate one command to simulate operator hand-edit
    baseline.hooks.PreToolUse[0].hooks[0].command = 'npx --yes @rune-kit/rune hook-dispatch preflight --custom-flag';
    await seedClaude(tmpRoot, baseline);
    const result = await checkHookDrift(tmpRoot);
    const drift = result.findings.filter((f) => f.status === 'drift');
    const missing = result.findings.filter((f) => f.status === 'missing');
    assert.ok(drift.length >= 1, 'should flag the modified entry as drifted');
    assert.ok(missing.length >= 1, 'canonical entry no longer present → missing');
    assert.match(drift[0].actual, /--custom-flag/);
  });

  test('flags missing entry when canonical has more than installed', async () => {
    const partial = buildPreset('gentle');
    // Remove one Stop entry to simulate partial install
    partial.hooks.Stop = [];
    await seedClaude(tmpRoot, partial);
    const result = await checkHookDrift(tmpRoot);
    const missing = result.findings.filter((f) => f.status === 'missing' && f.event === 'Stop');
    assert.strictEqual(missing.length, 1);
    assert.match(missing[0].expected, /completion-gate/);
  });

  test('ignores tier-emitted entries (${RUNE_PRO_ROOT})', async () => {
    const settings = buildPreset('gentle');
    // Inject a Pro-tier entry alongside Free preset entries
    settings.hooks.PostToolUse.push({
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: 'node "${RUNE_PRO_ROOT}/hooks/run-hook.cjs" context-sense',
          async: false,
        },
      ],
    });
    await seedClaude(tmpRoot, settings);
    const result = await checkHookDrift(tmpRoot);
    // Tier entry should NOT be flagged as drift — it's tier-managed, not Free-preset
    const tierDrift = result.findings.find(
      (f) => f.status === 'drift' && typeof f.actual === 'string' && f.actual.includes('RUNE_PRO_ROOT'),
    );
    assert.strictEqual(tierDrift, undefined);
  });

  test('returns empty when settings.json absent', async () => {
    await mkdir(path.join(tmpRoot, '.claude'), { recursive: true });
    const result = await checkHookDrift(tmpRoot);
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.platforms.length, 0);
  });

  test('returns empty when no Rune hooks installed (preset = none)', async () => {
    await seedClaude(tmpRoot, { env: { FOO: 'bar' } }); // user settings, no Rune hooks
    const result = await checkHookDrift(tmpRoot);
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.platforms.length, 0);
  });

  test('reports parse error when settings.json is malformed', async () => {
    await mkdir(path.join(tmpRoot, '.claude'), { recursive: true });
    await writeFile(path.join(tmpRoot, SETTINGS_REL_PATH), '{ not valid json');
    const result = await checkHookDrift(tmpRoot);
    const errors = result.findings.filter((f) => f.status === 'error');
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /Cannot parse/);
  });

  test('flags mixed preset (both gentle and strict installed)', async () => {
    // Mix gentle PreToolUse with strict Stop
    const gentle = buildPreset('gentle');
    const strict = buildPreset('strict');
    const mixed = {
      hooks: {
        PreToolUse: gentle.hooks.PreToolUse,
        Stop: strict.hooks.Stop,
      },
    };
    await seedClaude(tmpRoot, mixed);
    const result = await checkHookDrift(tmpRoot);
    const mixedFinding = result.findings.find((f) => f.status === 'mixed-preset');
    assert.ok(mixedFinding, 'should flag mixed-preset');
    assert.match(mixedFinding.message, /gentle and strict/);
  });
});

describe('formatHookDriftResult', () => {
  test('clean preset → all-match line', () => {
    const out = formatHookDriftResult({
      findings: [],
      summary: { drifted: 0, missing: 0, errors: 0 },
      platforms: [{ platform: 'claude', preset: 'gentle' }],
    });
    assert.match(out, /All Rune-managed entries match canonical preset/);
  });

  test('no platforms → install hint', () => {
    const out = formatHookDriftResult({ findings: [], summary: { drifted: 0, missing: 0, errors: 0 }, platforms: [] });
    assert.match(out, /No installed Rune hooks detected/);
  });

  test('drift finding renders actual command', () => {
    const out = formatHookDriftResult({
      findings: [{ platform: 'claude', event: 'PreToolUse', status: 'drift', actual: 'custom-cmd' }],
      summary: { drifted: 1, missing: 0, errors: 0 },
      platforms: [{ platform: 'claude', preset: 'gentle' }],
    });
    assert.match(out, /drift/);
    assert.match(out, /custom-cmd/);
    assert.match(out, /Summary: 1 drifted/);
  });
});
