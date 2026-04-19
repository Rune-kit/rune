import assert from 'node:assert';
import { PassThrough } from 'node:stream';
import { describe, test } from 'node:test';
import { dispatchHook } from '../commands/hook-dispatch.js';

function makeIO({ stdinData = '' } = {}) {
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
  return { stdin, stdout, stderr, getOut: () => out, getErr: () => err };
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
    assert.match(io.getOut(), /rune-hook: preflight/);
    assert.match(io.getOut(), /advisory/);
    assert.match(io.getOut(), /Edit/);
  });

  test('strict mode prints enforcing label', async () => {
    const io = makeIO({ stdinData: '{}' });
    const code = await dispatchHook(['sentinel'], io);
    assert.strictEqual(code, 0);
    assert.match(io.getOut(), /enforcing/);
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
});
