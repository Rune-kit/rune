/**
 * Hook Tests — intent-router + pre-tool-guard (privacy mesh)
 *
 * Tests hook scripts via child_process to verify stdin/stdout behavior.
 */

import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = path.resolve(__dirname, '../../hooks');

/**
 * Run a hook with given stdin input and environment
 * @returns {{ stdout: string, exitCode: number }}
 */
function runHook(hookName, stdinInput, env = {}) {
  const hookPath = path.join(HOOKS_DIR, hookName, 'index.cjs');
  try {
    const stdout = execFileSync('node', [hookPath], {
      input: stdinInput,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      timeout: 5000,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', exitCode: err.status || 1 };
  }
}

// --- Pre-Tool Guard (Privacy Mesh) ---

describe('pre-tool-guard: privacy mesh', () => {
  test('WARN on .env file', () => {
    const { stdout, exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": ".env"}}');
    assert.strictEqual(exitCode, 0, 'WARN should not block (exit 0)');
    assert.ok(stdout.includes('privacy-mesh'), 'should show privacy-mesh label');
    assert.ok(stdout.includes('Sensitive file'), 'should warn about sensitive file');
  });

  test('BLOCK on private key file', () => {
    const { stdout, exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": "id_rsa"}}');
    assert.strictEqual(exitCode, 2, 'BLOCK should exit with code 2');
    assert.ok(stdout.includes('BLOCKED'), 'should show BLOCKED label');
  });

  test('BLOCK on .pem file', () => {
    const { exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": "server.pem"}}');
    assert.strictEqual(exitCode, 2, '.pem should be blocked');
  });

  test('ALLOW .env.example (safe exception)', () => {
    const { stdout, exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": ".env.example"}}');
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '', '.env.example should produce no output');
  });

  test('ALLOW .env.test (safe exception)', () => {
    const { stdout, exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": ".env.test"}}');
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '', '.env.test should produce no output');
  });

  test('ALLOW normal files', () => {
    const { stdout, exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": "src/index.js"}}');
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '', 'normal files should produce no output');
  });

  test('elevated skill bypasses WARN', () => {
    const { stdout, exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": ".env"}}', {
      RUNE_ACTIVE_SKILL: 'sentinel',
    });
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '', 'sentinel should bypass .env warning');
  });

  test('elevated skill does NOT bypass BLOCK', () => {
    const { exitCode } = runHook('pre-tool-guard', '{"tool_input": {"file_path": "id_rsa"}}', {
      RUNE_ACTIVE_SKILL: 'sentinel',
    });
    assert.strictEqual(exitCode, 2, 'BLOCK cannot be bypassed by elevation');
  });

  test('graceful on empty input', () => {
    const { exitCode } = runHook('pre-tool-guard', '');
    assert.strictEqual(exitCode, 0, 'should exit cleanly on empty input');
  });

  test('graceful on missing file_path', () => {
    const { exitCode } = runHook('pre-tool-guard', '{"tool_input": {}}');
    assert.strictEqual(exitCode, 0, 'should exit cleanly on missing file_path');
  });
});

// --- Intent Router ---

describe('intent-router', () => {
  test('exits silently when no skill-index.json available', () => {
    const { stdout, exitCode } = runHook('intent-router', '{"user_prompt": "build a feature"}', {
      CLAUDE_PLUGIN_ROOT: '/nonexistent',
    });
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '', 'should be silent without index');
  });

  test('exits silently on empty prompt', () => {
    const { stdout, exitCode } = runHook('intent-router', '{"user_prompt": ""}');
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '');
  });

  test('exits silently on very short prompt', () => {
    const { stdout, exitCode } = runHook('intent-router', '{"user_prompt": "hi"}');
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '');
  });

  test('graceful on invalid JSON', () => {
    const { exitCode } = runHook('intent-router', 'not json');
    assert.strictEqual(exitCode, 0, 'should exit cleanly on invalid JSON');
  });
});

// --- Metrics Collector (skill attribution: Skill + Task subagent paths) ---

describe('metrics-collector: skill attribution', () => {
  // Run the hook with a controlled cwd so the tmpdir metrics file is isolated,
  // then read back what it recorded. Returns the recorded skill names (in order).
  function runMetrics(stdinInput) {
    const tmpCwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rune-mc-')));
    const hash = Buffer.from(tmpCwd).toString('base64url').slice(0, 16);
    const metricsFile = path.join(os.tmpdir(), `rune-metrics-${hash}.jsonl`);
    try {
      fs.rmSync(metricsFile, { force: true });
      execFileSync('node', [path.join(HOOKS_DIR, 'metrics-collector', 'index.cjs')], {
        input: stdinInput,
        cwd: tmpCwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      if (!fs.existsSync(metricsFile)) return [];
      return fs
        .readFileSync(metricsFile, 'utf-8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l).skill);
    } finally {
      fs.rmSync(metricsFile, { force: true });
      fs.rmSync(tmpCwd, { recursive: true, force: true });
    }
  }

  test('captures Skill tool invocation (rune:review → review)', () => {
    const skills = runMetrics('{"tool":"Skill","tool_input":{"skill":"rune:review"}}');
    assert.deepStrictEqual(skills, ['review']);
  });

  test('captures Task subagent invocation (rune:cook → cook)', () => {
    const skills = runMetrics('{"tool":"Task","tool_input":{"subagent_type":"rune:cook"}}');
    assert.deepStrictEqual(skills, ['cook'], 'Task subagent path must be attributed');
  });

  test('skips generic (non-rune) subagents', () => {
    const skills = runMetrics('{"tool":"Task","tool_input":{"subagent_type":"general-purpose"}}');
    assert.deepStrictEqual(skills, [], 'generic agents are not Rune skills');
  });

  test('captures subagent via Agent tool (rune:fix → fix)', () => {
    const skills = runMetrics('{"tool":"Agent","tool_input":{"subagent_type":"rune:fix"}}');
    assert.deepStrictEqual(skills, ['fix'], 'Agent tool path must be attributed');
  });

  test('Skill tool with incidental subagent_type still attributes the skill', () => {
    // tool name is authoritative — must NOT be mis-routed to the subagent path
    const skills = runMetrics('{"tool":"Skill","tool_input":{"skill":"rune:plan","subagent_type":"rune:cook"}}');
    assert.deepStrictEqual(skills, ['plan']);
  });

  test('resolves tool via tool_name field as well as tool', () => {
    const skills = runMetrics('{"tool_name":"Task","tool_input":{"subagent_type":"rune:debug"}}');
    assert.deepStrictEqual(skills, ['debug']);
  });

  test('skips non-rune subagent via Agent tool (Explore)', () => {
    const skills = runMetrics('{"tool":"Agent","tool_input":{"subagent_type":"Explore"}}');
    assert.deepStrictEqual(skills, []);
  });

  test('graceful on empty input (records nothing)', () => {
    const skills = runMetrics('');
    assert.deepStrictEqual(skills, []);
  });
});
