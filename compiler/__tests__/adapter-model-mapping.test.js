/**
 * Adapter model tier mapping (v2.15+) — verify non-Anthropic adapters
 * translate `model: opus|sonnet|haiku` to provider-correct names while
 * Anthropic-backed adapters (claude/cursor/windsurf) remain no-op.
 *
 * Validates:
 *   - codex/antigravity emit concrete provider model names
 *   - opencode/openclaw/generic emit semantic tier hints (provider-agnostic)
 *   - claude/cursor/windsurf do NOT translate (no-op)
 *   - Skills without `model:` produce no model line
 *   - Unknown tier values pass through unchanged
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';
import { getAdapter } from '../adapters/index.js';

const baseSkill = {
  name: 'cook',
  description: 'Feature implementation orchestrator',
  layer: 'L1',
  group: 'orchestration',
};

describe('codex adapter model mapping', () => {
  const codex = getAdapter('codex');

  test('opus translates to gpt-5-pro', () => {
    const header = codex.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /model: gpt-5-pro/);
  });

  test('sonnet translates to gpt-5', () => {
    const header = codex.generateHeader({ ...baseSkill, model: 'sonnet' });
    assert.match(header, /model: gpt-5(?!-)/);
  });

  test('haiku translates to gpt-5-mini', () => {
    const header = codex.generateHeader({ ...baseSkill, model: 'haiku' });
    assert.match(header, /model: gpt-5-mini/);
  });

  test('omitted model produces no model line', () => {
    const header = codex.generateHeader({ ...baseSkill });
    assert.doesNotMatch(header, /model:/);
  });

  test('unknown tier passes through unchanged', () => {
    const header = codex.generateHeader({ ...baseSkill, model: 'custom-fine-tune' });
    assert.match(header, /model: custom-fine-tune/);
  });
});

describe('antigravity adapter model mapping', () => {
  const antigravity = getAdapter('antigravity');

  test('opus translates to gemini-3-pro', () => {
    const header = antigravity.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /model: gemini-3-pro/);
  });

  test('sonnet translates to gemini-3-flash', () => {
    const header = antigravity.generateHeader({ ...baseSkill, model: 'sonnet' });
    assert.match(header, /model: gemini-3-flash(?!-)/);
  });

  test('haiku translates to gemini-3-flash-lite', () => {
    const header = antigravity.generateHeader({ ...baseSkill, model: 'haiku' });
    assert.match(header, /model: gemini-3-flash-lite/);
  });
});

describe('opencode adapter model mapping (provider-agnostic)', () => {
  const opencode = getAdapter('opencode');

  test('opus translates to tier:heavy', () => {
    const header = opencode.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /model: tier:heavy/);
  });

  test('sonnet translates to tier:mid', () => {
    const header = opencode.generateHeader({ ...baseSkill, model: 'sonnet' });
    assert.match(header, /model: tier:mid/);
  });

  test('haiku translates to tier:light', () => {
    const header = opencode.generateHeader({ ...baseSkill, model: 'haiku' });
    assert.match(header, /model: tier:light/);
  });
});

describe('openclaw adapter model mapping (markdown header)', () => {
  const openclaw = getAdapter('openclaw');

  test('opus appears as tier:heavy in metadata line', () => {
    const header = openclaw.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /model: tier:heavy/);
  });

  test('omitted model produces no model line', () => {
    const header = openclaw.generateHeader({ ...baseSkill });
    assert.doesNotMatch(header, /model:/);
  });
});

describe('generic adapter model mapping (markdown header)', () => {
  const generic = getAdapter('generic');

  test('opus appears as tier:heavy in metadata line', () => {
    const header = generic.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /model: tier:heavy/);
  });
});

describe('Anthropic-native adapters are no-op for model field', () => {
  test('claude generateHeader returns empty (passthrough)', () => {
    const claude = getAdapter('claude');
    const header = claude.generateHeader({ ...baseSkill, model: 'opus' });
    assert.strictEqual(header, '');
  });

  test('cursor + windsurf do NOT rewrite anthropic tier names', () => {
    const cursor = getAdapter('cursor');
    const windsurf = getAdapter('windsurf');
    const cursorHeader = cursor.generateHeader({ ...baseSkill, model: 'opus' });
    const windsurfHeader = windsurf.generateHeader({ ...baseSkill, model: 'opus' });
    assert.doesNotMatch(cursorHeader, /gpt-5/);
    assert.doesNotMatch(cursorHeader, /gemini/);
    assert.doesNotMatch(windsurfHeader, /gpt-5/);
    assert.doesNotMatch(windsurfHeader, /gemini/);
  });
});

describe('qoder adapter model mapping (provider-agnostic)', () => {
  const qoder = getAdapter('qoder');

  test('opus translates to tier:heavy', () => {
    const header = qoder.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /model: tier:heavy/);
  });

  test('omitted model produces no model line', () => {
    const header = qoder.generateHeader({ ...baseSkill });
    assert.doesNotMatch(header, /model:/);
  });
});

describe('copilot adapter model mapping (tier-hint comment)', () => {
  const copilot = getAdapter('copilot');

  test('opus emits tier-hint:tier:heavy as comment (Copilot ignores model field)', () => {
    const header = copilot.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /tier-hint: tier:heavy/);
  });

  test('omitted model produces no tier-hint line', () => {
    const header = copilot.generateHeader({ ...baseSkill });
    assert.doesNotMatch(header, /tier-hint/);
  });
});

describe('aider adapter model mapping (inline header)', () => {
  const aider = getAdapter('aider');

  test('opus appears as tier:heavy inline', () => {
    const header = aider.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /tier:heavy/);
  });

  test('omitted model produces no tier line', () => {
    const header = aider.generateHeader({ ...baseSkill });
    assert.doesNotMatch(header, /tier:/);
  });
});

describe('qwen adapter model mapping (Qwen family)', () => {
  const qwen = getAdapter('qwen');

  test('opus translates to qwen3-coder-plus', () => {
    const header = qwen.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /qwen3-coder-plus/);
  });

  test('sonnet translates to qwen3-coder', () => {
    const header = qwen.generateHeader({ ...baseSkill, model: 'sonnet' });
    assert.match(header, /qwen3-coder(?!-)/);
  });

  test('haiku translates to qwen3-coder-flash', () => {
    const header = qwen.generateHeader({ ...baseSkill, model: 'haiku' });
    assert.match(header, /qwen3-coder-flash/);
  });
});

describe('gemini adapter model mapping (Gemini family)', () => {
  const gemini = getAdapter('gemini');

  test('opus translates to gemini-2.5-pro', () => {
    const header = gemini.generateHeader({ ...baseSkill, model: 'opus' });
    assert.match(header, /gemini-2\.5-pro/);
  });

  test('sonnet translates to gemini-2.5-flash', () => {
    const header = gemini.generateHeader({ ...baseSkill, model: 'sonnet' });
    assert.match(header, /gemini-2\.5-flash/);
  });

  test('haiku translates to gemini-2.0-flash-lite', () => {
    const header = gemini.generateHeader({ ...baseSkill, model: 'haiku' });
    assert.match(header, /gemini-2\.0-flash-lite/);
  });
});

describe('cross-adapter consistency', () => {
  test('all 5 non-Anthropic adapters emit a model line for opus skills', () => {
    const adapterNames = ['codex', 'antigravity', 'opencode', 'openclaw', 'generic'];
    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const header = adapter.generateHeader({ ...baseSkill, model: 'opus' });
      assert.match(header, /model: /, `${name} should emit a model line for opus skill`);
    }
  });

  test('all 5 non-Anthropic adapters omit model line when skill has no model', () => {
    const adapterNames = ['codex', 'antigravity', 'opencode', 'openclaw', 'generic'];
    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const header = adapter.generateHeader({ ...baseSkill });
      assert.doesNotMatch(header, /model:/, `${name} should NOT emit a model line for skill without model`);
    }
  });
});
