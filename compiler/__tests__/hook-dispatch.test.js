import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, test } from 'node:test';
import { dispatchHook, normalizeEvent, translate } from '../commands/hook-dispatch.js';

// Plain (non-git) dir so completion-gate stays quiet in the contract tests.
const QUIET_CWD = mkdtempSync(path.join(os.tmpdir(), 'rune-dispatch-'));

function makeIO({ stdinData = '', cwd = QUIET_CWD } = {}) {
  const stdin = new PassThrough();
  stdin.setEncoding = () => {};
  stdin.isTTY = false;
  if (stdinData) {
    stdin.write(stdinData);
  }
  stdin.end();

  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  let err = '';
  stdout.on('data', (chunk) => {
    out += chunk.toString();
  });
  stderr.on('data', (chunk) => {
    err += chunk.toString();
  });
  return { stdin, stdout, stderr, cwd, getOut: () => out, getErr: () => err };
}

describe('dispatchHook', () => {
  test('unknown skill exits 1 in strict mode', async () => {
    const io = makeIO();
    const code = await dispatchHook(['evil-skill'], io);
    assert.strictEqual(code, 1);
    assert.match(io.getErr(), /unknown skill/);
  });

  test('unknown skill exits 0 in gentle mode', async () => {
    const io = makeIO();
    const code = await dispatchHook(['evil-skill', '--gentle'], io);
    assert.strictEqual(code, 0);
    assert.match(io.getErr(), /unknown skill/);
  });

  test('missing skill name errors', async () => {
    const io = makeIO();
    const code = await dispatchHook([], io);
    assert.strictEqual(code, 1);
    assert.match(io.getErr(), /missing skill/);
  });

  test('known skill succeeds and emits advisory line', async () => {
    const io = makeIO({ stdinData: JSON.stringify({ tool_name: 'Edit' }) });
    const code = await dispatchHook(['preflight', '--gentle'], io);
    assert.strictEqual(code, 0);
    assert.match(io.getErr(), /rune-hook: preflight/);
    assert.match(io.getErr(), /advisory/);
    assert.match(io.getErr(), /Edit/);
    assert.strictEqual(io.getOut(), '', 'claude format keeps stdout empty (Cursor imports Claude hooks)');
  });

  test('strict mode prints enforcing label (nothing to check → pass)', async () => {
    const io = makeIO({ stdinData: '{}' });
    const code = await dispatchHook(['sentinel'], io);
    assert.strictEqual(code, 0);
    assert.match(io.getErr(), /enforcing/);
  });

  // Cursor: invalid JSON from a permission hook blocks the action (cursor.com/docs/hooks)
  for (const event of ['preToolUse', 'beforeShellExecution', 'beforeMCPExecution', 'beforeReadFile', 'subagentStart']) {
    test(`--format cursor: ${event} prints {"permission":"allow"}`, async () => {
      const io = makeIO({ stdinData: JSON.stringify({ hook_event_name: event, tool_name: 'Write' }) });
      const code = await dispatchHook(['preflight', '--gentle', '--format', 'cursor'], io);
      assert.strictEqual(code, 0);
      assert.deepStrictEqual(JSON.parse(io.getOut()), { permission: 'allow' });
    });
  }

  for (const event of ['afterFileEdit', 'postToolUse', 'stop']) {
    test(`--format=cursor: ${event} prints {} (no follow-up, no override)`, async () => {
      const io = makeIO({ stdinData: JSON.stringify({ hook_event_name: event }) });
      await dispatchHook(['completion-gate', '--gentle', '--format=cursor'], io);
      assert.deepStrictEqual(JSON.parse(io.getOut()), {});
    });
  }

  // A permission hook blocks on `{}`, so an event the dispatcher can't identify
  // (no hook_event_name, cut-off or non-JSON stdin) must get the allow form.
  for (const [label, stdinData] of [
    ['missing hook_event_name', JSON.stringify({ tool_name: 'Shell' })],
    ['non-JSON stdin', '{"hook_event_name": "beforeShellExec'],
    ['empty stdin', ''],
  ]) {
    test(`--format cursor: ${label} falls back to {"permission":"allow"}`, async () => {
      const io = makeIO({ stdinData });
      const code = await dispatchHook(['sentinel', '--gentle', '--format', 'cursor'], io);
      assert.strictEqual(code, 0);
      assert.deepStrictEqual(JSON.parse(io.getOut()), { permission: 'allow' });
    });
  }

  test('--format gemini: stdout is exactly one JSON object', async () => {
    const io = makeIO({ stdinData: JSON.stringify({ hook_event_name: 'BeforeTool', tool_name: 'write_file' }) });
    const code = await dispatchHook(['preflight', '--format', 'gemini', '--gentle'], io);
    assert.strictEqual(code, 0);
    assert.deepStrictEqual(JSON.parse(io.getOut()), {});
    assert.match(io.getErr(), /write_file/);
  });

  test('--format value is not mistaken for the skill name', async () => {
    const io = makeIO({ stdinData: '{}' });
    const code = await dispatchHook(['--format', 'gemini', 'sentinel'], io);
    assert.strictEqual(code, 0);
    assert.match(io.getErr(), /sentinel/);
  });

  test('malformed stdin does not crash', async () => {
    const io = makeIO({ stdinData: 'not json at all' });
    const code = await dispatchHook(['completion-gate', '--gentle'], io);
    assert.strictEqual(code, 0);
  });

  // T5: invalid skill name (not in allowlist) → exits non-zero, stderr contains rejected name
  test('T5: skill not in allowlist exits 1 in strict mode with name in stderr', async () => {
    const io = makeIO();
    const code = await dispatchHook(['totally-fake-skill'], io);
    assert.strictEqual(code, 1);
    assert.ok(io.getErr().includes('totally-fake-skill'), 'stderr must contain the rejected skill name');
  });

  // T6: stdin larger than 1MB → truncates or errors gracefully (no OOM)
  test('T6: stdin larger than 1MB is rejected gracefully', async () => {
    // Build a payload just over the 1MB limit
    const big = 'x'.repeat(1_100_000);
    const io = makeIO({ stdinData: big });
    // Should not throw — must return an exit code (0 or 1, gentle or strict)
    const code = await dispatchHook(['preflight', '--gentle'], io);
    assert.ok(typeof code === 'number', 'must return a numeric exit code');
    // gentle mode: still exits 0 even if stdin was discarded
    assert.strictEqual(code, 0);
  });

  // ── Real gates (v2.33.0: dispatcher runs hooks/*.cjs, strict actually blocks) ──
  const keyEvent = (extra = {}) =>
    JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'secrets/id_rsa' }, ...extra });

  test('preflight strict: private key read is BLOCKED with exit 2 + reason on stderr', async () => {
    const io = makeIO({ stdinData: keyEvent({ hook_event_name: 'PreToolUse' }) });
    const code = await dispatchHook(['preflight'], io);
    assert.strictEqual(code, 2);
    assert.match(io.getErr(), /privacy-mesh\] BLOCKED: secrets\/id_rsa/);
    assert.match(io.getErr(), /BLOCK/);
    assert.match(JSON.parse(io.getOut()).systemMessage, /BLOCKED/);
  });

  test('preflight gentle: same read passes (exit 0) with an advisory', async () => {
    const io = makeIO({ stdinData: keyEvent() });
    const code = await dispatchHook(['preflight', '--gentle'], io);
    assert.strictEqual(code, 0);
    assert.match(io.getErr(), /would block/);
    assert.strictEqual(io.getOut(), '');
  });

  test('preflight strict --format cursor: deny JSON + exit 2', async () => {
    const io = makeIO({ stdinData: keyEvent({ hook_event_name: 'preToolUse' }) });
    const code = await dispatchHook(['preflight', '--format', 'cursor'], io);
    assert.strictEqual(code, 2);
    const out = JSON.parse(io.getOut());
    assert.strictEqual(out.permission, 'deny');
    assert.match(out.agent_message, /BLOCKED/);
  });

  test('preflight strict --format cursor: Cursor top-level `path` payload is normalized', async () => {
    const io = makeIO({
      stdinData: JSON.stringify({ hook_event_name: 'beforeReadFile', file_path: 'certs/server.pem' }),
    });
    const code = await dispatchHook(['preflight', '--format', 'cursor'], io);
    assert.strictEqual(code, 2);
    assert.strictEqual(JSON.parse(io.getOut()).permission, 'deny');
  });

  test('preflight strict --format gemini: decision deny + exit 2', async () => {
    const io = makeIO({ stdinData: keyEvent({ hook_event_name: 'BeforeTool' }) });
    const code = await dispatchHook(['preflight', '--format', 'gemini'], io);
    assert.strictEqual(code, 2);
    assert.deepStrictEqual(Object.keys(JSON.parse(io.getOut())).sort(), ['decision', 'reason']);
  });

  test('preflight strict: ordinary file passes', async () => {
    const io = makeIO({ stdinData: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'src/app.ts' } }) });
    assert.strictEqual(await dispatchHook(['preflight'], io), 0);
  });

  test('sentinel strict: git commit with a staged secret is BLOCKED', async () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'rune-sentinel-'));
    const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
    git('init', '-q');
    // Built at runtime so this test file does not itself contain a secret pattern.
    writeFileSync(path.join(repo, 'config.js'), `const k = "${'AKIA'}${'ABCDEFGHIJKLMNOP'}";\n`);
    git('add', 'config.js');
    const io = makeIO({
      stdinData: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }),
      cwd: repo,
    });
    const code = await dispatchHook(['sentinel'], io);
    assert.strictEqual(code, 2);
    assert.match(io.getErr(), /AWS Access Key/);
  });

  test('sentinel: Cursor beforeShellExecution top-level command is normalized', () => {
    const e = normalizeEvent({ hook_event_name: 'beforeShellExecution', command: 'git commit -m x' });
    assert.strictEqual(e.tool_name, 'Bash');
    assert.strictEqual(e.tool_input.command, 'git commit -m x');
  });

  test('dependency-doctor: manifest edit → advisory, never blocks', async () => {
    const io = makeIO({ stdinData: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'package.json' } }) });
    const code = await dispatchHook(['dependency-doctor'], io);
    assert.strictEqual(code, 0);
    assert.match(JSON.parse(io.getOut()).systemMessage, /dependency-doctor\] package\.json changed/);
  });

  test('completion-gate: uncommitted changes → advisory on Stop, never blocks', async () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'rune-gate-'));
    execFileSync('git', ['init', '-q'], { cwd: repo });
    mkdirSync(path.join(repo, 'src'));
    writeFileSync(path.join(repo, 'src', 'a.js'), 'x\n');
    const io = makeIO({ stdinData: JSON.stringify({ hook_event_name: 'Stop' }), cwd: repo });
    const code = await dispatchHook(['completion-gate'], io);
    assert.strictEqual(code, 0);
    assert.match(JSON.parse(io.getOut()).systemMessage, /uncommitted change/);
  });

  test('completion-gate: stop_hook_active short-circuits', async () => {
    const io = makeIO({ stdinData: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }) });
    assert.strictEqual(await dispatchHook(['completion-gate'], io), 0);
    assert.strictEqual(io.getOut(), '');
  });

  test('crashed gate fails open', () => {
    const r = translate({
      skill: 'preflight',
      format: 'cursor',
      gentle: false,
      eventName: 'preToolUse',
      gate: { status: 1, stdout: '', stderr: 'boom' },
    });
    assert.strictEqual(r.code, 0);
    assert.deepStrictEqual(JSON.parse(r.stdout), { permission: 'allow' });
  });

  test('advisory skills never block even on exit 2', () => {
    const r = translate({
      skill: 'quarantine',
      format: 'claude',
      gentle: false,
      eventName: 'PostToolUse',
      gate: { status: 2, stdout: '', stderr: 'x' },
    });
    assert.strictEqual(r.code, 0);
  });
});
