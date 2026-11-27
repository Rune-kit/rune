import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, test } from 'node:test';
import { dispatchHook, GATE_LOG_REL, mergeGates } from '../commands/hook-dispatch.js';
import { runVerify } from '../commands/verify.js';
import {
  analyzeDiffs,
  analyzeFileDiff,
  analyzeGit,
  extractCommitMessage,
  formatReport,
  HIGH_RULES,
  isFrozenPath,
  isTestFile,
  loadIntegrityConfig,
  matchGlob,
  OVERRIDE_ENV,
  OVERRIDE_TRAILER,
  parseTrailerReason,
  RULES,
  resolveOverride,
  runIntegrityForEvent,
} from '../lib/test-integrity.js';

const JS_BEFORE = `import { checkout } from './pay.js';

test('user can checkout with a valid cart', async () => {
  const result = await checkout(cart, payment);
  expect(result.status).toEqual('confirmed');
  expect(result.total).toBe(42);
});
`;

function jsAfter(body) {
  return `import { checkout } from './pay.js';

test('user can checkout with a valid cart', async () => {
  const result = await checkout(cart, payment);
${body}
});
`;
}

function rulesOf(result) {
  const findings = result.findings || result;
  return findings.map((f) => f.rule);
}

describe('path helpers', () => {
  test('isTestFile recognizes common layouts', () => {
    assert.ok(isTestFile('src/pay.test.ts'));
    assert.ok(isTestFile('src/pay.spec.tsx'));
    assert.ok(isTestFile('__tests__/pay.js'));
    assert.ok(isTestFile('tests/char/billing.test.ts'));
    assert.ok(isTestFile('pkg/pay_test.go'));
    assert.ok(isTestFile('src/pay_test.rs'));
    assert.ok(isTestFile('tests/test_pay.py'));
    assert.ok(isTestFile('tests/pay_test.py'));
    assert.ok(isTestFile('src/test/java/com/acme/PayTest.java'));
    assert.ok(isTestFile('src/__snapshots__/pay.test.ts.snap'));
    assert.ok(!isTestFile('src/pay.ts'));
    assert.ok(!isTestFile('src/test-utils.ts'));
    assert.ok(!isTestFile('README.md'));
  });

  test('frozen paths default to tests/char and tests/holdout', () => {
    const cfg = { frozenPaths: ['tests/char/**', 'tests/holdout/**'] };
    assert.ok(isFrozenPath('tests/char/billing.test.ts', cfg));
    assert.ok(isFrozenPath('tests/holdout/api.spec.ts', cfg));
    assert.ok(!isFrozenPath('src/pay.test.ts', cfg));
    assert.ok(matchGlob('tests/char/nested/a.ts', 'tests/char/**'));
  });

  test('loadIntegrityConfig reads .rune/test-integrity.json', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-cfg-'));
    mkdirSync(path.join(dir, '.rune'), { recursive: true });
    writeFileSync(
      path.join(dir, '.rune', 'test-integrity.json'),
      JSON.stringify({ frozenPaths: ['spec/frozen/**'], disabledRules: ['todo-added'] }),
    );
    const cfg = loadIntegrityConfig(dir);
    assert.deepStrictEqual(cfg.frozenPaths, ['spec/frozen/**']);
    assert.ok(cfg.disabledRules.includes('todo-added'));
  });
});

describe('false-positive guards (must stay clean)', () => {
  test('adding new assertions does not flag', () => {
    const after = jsAfter(`  expect(result.status).toEqual('confirmed');
  expect(result.total).toBe(42);
  expect(result.id).toBeDefined();
`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.deepStrictEqual(r, [], `unexpected findings: ${JSON.stringify(r)}`);
  });

  test('adding a new test does not flag', () => {
    const after = `${JS_BEFORE}
test('rejects an empty cart', async () => {
  await expect(checkout(empty, payment)).rejects.toThrow();
});
`;
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.deepStrictEqual(r, []);
  });

  test('renaming a test keeps the suite clean when asserts stay', () => {
    const after = JS_BEFORE.replace('user can checkout with a valid cart', 'checkout accepts a valid cart');
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(!rulesOf(r).includes(RULES.TEST_DELETED), JSON.stringify(r));
    assert.ok(!rulesOf(r).includes(RULES.ASSERT_REMOVED), JSON.stringify(r));
  });

  test('whitespace / formatting only is clean', () => {
    const after = JS_BEFORE.replace("toEqual('confirmed')", "toEqual('confirmed') ");
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(!r.some((f) => f.severity === 'high'), JSON.stringify(r));
  });

  test('moving an assertion to another line in the same file is clean', () => {
    const after = `import { checkout } from './pay.js';

test('user can checkout with a valid cart', async () => {
  const result = await checkout(cart, payment);
  expect(result.total).toBe(42);
  expect(result.status).toEqual('confirmed');
});
`;
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(!rulesOf(r).includes(RULES.ASSERT_REMOVED), JSON.stringify(r));
    assert.ok(!rulesOf(r).includes(RULES.ASSERT_COUNT_DROP), JSON.stringify(r));
  });

  test('implementation-only diffs are ignored', () => {
    const r = analyzeDiffs([
      {
        file: 'src/pay.ts',
        before: 'export function checkout() { return 1 }',
        after: 'export function checkout() { return 2 }',
      },
    ]);
    assert.strictEqual(r.findings.length, 0);
    assert.strictEqual(r.blocked, false);
  });
});

describe('weakening detections', () => {
  test('deleted assertion is high (assert-removed)', () => {
    const after = jsAfter(`  expect(result.status).toEqual('confirmed');\n`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.ASSERT_REMOVED), JSON.stringify(r));
    assert.ok(r.some((f) => f.severity === 'high' && f.rule === RULES.ASSERT_REMOVED));
    const f = r.find((x) => x.rule === RULES.ASSERT_REMOVED);
    assert.ok(f.file.endsWith('pay.test.ts'));
    assert.ok(f.line >= 1);
    assert.match(f.before, /toBe\(42\)/);
    assert.strictEqual(f.after, '(deleted)');
  });

  test('commented-out assertion is flagged', () => {
    const after = jsAfter(`  expect(result.status).toEqual('confirmed');
  // expect(result.total).toBe(42);
`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.ASSERT_COMMENTED), JSON.stringify(r));
  });

  test('toEqual → toBeTruthy is matcher-loosened (warn, not assert-removed)', () => {
    const after = jsAfter(`  expect(result.status).toBeTruthy();
  expect(result.total).toBe(42);
`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.MATCHER_LOOSENED), JSON.stringify(r));
    assert.ok(!rulesOf(r).includes(RULES.ASSERT_REMOVED), JSON.stringify(r));
    assert.ok(r.every((f) => f.rule !== RULES.MATCHER_LOOSENED || f.severity === 'warn'));
  });

  test('toEqual → toContain is matcher-loosened (exact → contains)', () => {
    const before = jsAfter(`  expect(result.status).toEqual('confirmed');\n`);
    const after = jsAfter(`  expect(result.status).toContain('confirm');\n`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before, after });
    assert.ok(rulesOf(r).includes(RULES.MATCHER_LOOSENED), JSON.stringify(r));
  });

  test('Python assertEqual → assertTrue is matcher-loosened', () => {
    const before = `def test_total():\n    self.assertEqual(total, 42)\n`;
    const after = `def test_total():\n    self.assertTrue(total)\n`;
    const r = analyzeFileDiff({ file: 'tests/test_pay.py', before, after });
    assert.ok(rulesOf(r).includes(RULES.MATCHER_LOOSENED), JSON.stringify(r));
    assert.ok(!rulesOf(r).includes(RULES.ASSERT_REMOVED), JSON.stringify(r));
  });

  test('Rust assert_eq! → assert! is matcher-loosened', () => {
    const before = `#[test]\nfn total_ok() {\n    assert_eq!(total, 42);\n}\n`;
    const after = `#[test]\nfn total_ok() {\n    assert!(total);\n}\n`;
    const r = analyzeFileDiff({ file: 'src/pay_test.rs', before, after });
    assert.ok(rulesOf(r).includes(RULES.MATCHER_LOOSENED), JSON.stringify(r));
  });

  test('toBeCloseTo with a lower digit count is a widened tolerance', () => {
    const before = jsAfter(`  expect(result.total).toBeCloseTo(42.01, 5);\n`);
    const after = jsAfter(`  expect(result.total).toBeCloseTo(42.01, 1);\n`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before, after });
    assert.ok(rulesOf(r).includes(RULES.MATCHER_LOOSENED), JSON.stringify(r));
    assert.match(r.find((f) => f.rule === RULES.MATCHER_LOOSENED).detail, /tolerance/i);
  });

  test('it.skip added is high (skip-added)', () => {
    const after = JS_BEFORE.replace("test('user can checkout", "test.skip('user can checkout");
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.SKIP_ADDED), JSON.stringify(r));
    assert.ok(r.some((f) => f.rule === RULES.SKIP_ADDED && f.severity === 'high'));
  });

  test('pytest.mark.xfail is treated as skip-added (high)', () => {
    const before = `def test_total():\n    assert total == 42\n`;
    const after = `@pytest.mark.xfail\ndef test_total():\n    assert total == 42\n`;
    const r = analyzeFileDiff({ file: 'tests/test_pay.py', before, after });
    assert.ok(rulesOf(r).includes(RULES.SKIP_ADDED), JSON.stringify(r));
  });

  test('Go t.Skip added is skip-added', () => {
    const before = `func TestPay(t *testing.T) {\n    require.Equal(t, 42, total)\n}\n`;
    const after = `func TestPay(t *testing.T) {\n    t.Skip("later")\n    require.Equal(t, 42, total)\n}\n`;
    const r = analyzeFileDiff({ file: 'pay_test.go', before, after });
    assert.ok(rulesOf(r).includes(RULES.SKIP_ADDED), JSON.stringify(r));
  });

  test('Java @Disabled is skip-added', () => {
    const before = `public class PayTest {\n  @Test\n  public void total() { assertEquals(42, total); }\n}\n`;
    const after = `public class PayTest {\n  @Disabled\n  @Test\n  public void total() { assertEquals(42, total); }\n}\n`;
    const r = analyzeFileDiff({ file: 'src/test/java/PayTest.java', before, after });
    assert.ok(rulesOf(r).includes(RULES.SKIP_ADDED), JSON.stringify(r));
  });

  test('snapshot file update is flagged', () => {
    const r = analyzeFileDiff({
      file: 'src/__snapshots__/pay.test.ts.snap',
      before: 'exports[`pay 1`] = "old";\n',
      after: 'exports[`pay 1`] = "new";\n',
    });
    assert.ok(rulesOf(r).includes(RULES.SNAPSHOT_UPDATED), JSON.stringify(r));
  });

  test('expected literal change is high', () => {
    const after = JS_BEFORE.replace("toEqual('confirmed')", "toEqual('ok')");
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.EXPECTED_CHANGED), JSON.stringify(r));
    assert.ok(r.some((f) => f.rule === RULES.EXPECTED_CHANGED && f.severity === 'high'));
  });

  test('deleted test is flagged, adding tests is not', () => {
    const after = `import { checkout } from './pay.js';\n`;
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.TEST_DELETED), JSON.stringify(r));
  });

  test('net assertion count drop is flagged as warn', () => {
    const after = jsAfter(`  expect(result.status).toEqual('confirmed');\n`);
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    const drop = r.find((f) => f.rule === RULES.ASSERT_COUNT_DROP);
    assert.ok(drop, JSON.stringify(r));
    assert.strictEqual(drop.severity, 'warn');
    assert.strictEqual(drop.before, '2');
    assert.strictEqual(drop.after, '1');
  });

  test('jest.mock introduced for a previously real import is flagged', () => {
    const after = `jest.mock('./pay.js');\n${JS_BEFORE}`;
    const r = analyzeFileDiff({ file: 'src/pay.test.ts', before: JS_BEFORE, after });
    assert.ok(rulesOf(r).includes(RULES.MOCK_REPLACED_REAL), JSON.stringify(r));
  });

  test('frozen path edit is high even when asserts stay', () => {
    const r = analyzeFileDiff({
      file: 'tests/char/billing.test.ts',
      before: JS_BEFORE,
      after: JS_BEFORE.replace('42', '42 /* same */'),
    });
    assert.ok(rulesOf(r).includes(RULES.FROZEN_PATH), JSON.stringify(r));
    assert.ok(r.some((f) => f.rule === RULES.FROZEN_PATH && f.severity === 'high'));
  });

  test('HIGH_RULES is exactly the strict-block set', () => {
    assert.deepStrictEqual(
      [...HIGH_RULES].sort(),
      [RULES.ASSERT_REMOVED, RULES.EXPECTED_CHANGED, RULES.FROZEN_PATH, RULES.SKIP_ADDED].sort(),
    );
  });
});

describe('overrides and trailers', () => {
  test('parses Test-Change-Approved trailers', () => {
    const reason = parseTrailerReason(`fix tests\n\n${OVERRIDE_TRAILER}: safeguard rebase of billing\n`);
    assert.strictEqual(reason, 'safeguard rebase of billing');
    assert.strictEqual(parseTrailerReason('no trailer here'), '');
  });

  test('extracts -m and --trailer from a git commit command', () => {
    const cmd = `git commit -m "tighten tests" --trailer "${OVERRIDE_TRAILER}: reviewed by nam"`;
    const msg = extractCommitMessage(cmd);
    assert.match(msg, /tighten tests/);
    assert.strictEqual(parseTrailerReason(msg), 'reviewed by nam');
  });

  test('env override requires a real reason', () => {
    assert.strictEqual(resolveOverride({ env: { [OVERRIDE_ENV]: 'ok' } }), null); // too short
    const o = resolveOverride({ env: { [OVERRIDE_ENV]: 'safeguard rebase' } });
    assert.strictEqual(o.source, 'env');
    assert.strictEqual(o.reason, 'safeguard rebase');
  });
});

describe('runIntegrityForEvent (preflight / sentinel)', () => {
  test('Edit that removes an assertion returns status 2', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-edit-'));
    writeFileSync(path.join(dir, 'pay.test.ts'), JS_BEFORE);
    const event = {
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(dir, 'pay.test.ts'),
        old_string: '  expect(result.total).toBe(42);\n',
        new_string: '',
      },
    };
    const gate = runIntegrityForEvent(event, dir);
    assert.strictEqual(gate.status, 2, gate.stderr || gate.error);
    assert.match(gate.stderr, /test-integrity] BLOCKED/);
    assert.match(gate.stderr, /assert-removed/);
    assert.match(gate.stderr, /Fix the CODE, not the TESTS/);
  });

  test('env override turns a block into an advisory and records the reason', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-ov-'));
    writeFileSync(path.join(dir, 'pay.test.ts'), JS_BEFORE);
    const prev = process.env[OVERRIDE_ENV];
    process.env[OVERRIDE_ENV] = 'reviewed by nam after safeguard rebase';
    try {
      const gate = runIntegrityForEvent(
        {
          tool_name: 'Write',
          tool_input: {
            file_path: path.join(dir, 'pay.test.ts'),
            content: jsAfter(`  expect(result.status).toEqual('confirmed');\n`),
          },
        },
        dir,
      );
      assert.strictEqual(gate.status, 0, gate.stderr || gate.error);
      assert.ok(gate.override);
      assert.strictEqual(gate.override.source, 'env');
      assert.match(JSON.parse(gate.stdout).systemMessage, /OVERRIDDEN/);
    } finally {
      if (prev === undefined) delete process.env[OVERRIDE_ENV];
      else process.env[OVERRIDE_ENV] = prev;
    }
  });

  test('ordinary src edit is a no-op', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-src-'));
    writeFileSync(path.join(dir, 'app.ts'), 'export const n = 1;\n');
    const gate = runIntegrityForEvent(
      { tool_name: 'Write', tool_input: { file_path: path.join(dir, 'app.ts'), content: 'export const n = 2;\n' } },
      dir,
    );
    assert.strictEqual(gate.status, 0);
    assert.strictEqual(gate.stdout, '');
  });

  test('Read of a frozen test is a no-op (does not false-block)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-read-'));
    mkdirSync(path.join(dir, 'tests', 'char'), { recursive: true });
    writeFileSync(path.join(dir, 'tests', 'char', 'billing.test.ts'), JS_BEFORE);
    const gate = runIntegrityForEvent(
      { tool_name: 'Read', tool_input: { file_path: path.join(dir, 'tests', 'char', 'billing.test.ts') } },
      dir,
    );
    assert.strictEqual(gate.status, 0);
    assert.strictEqual(gate.stdout, '');
  });
});

function makeIO({ stdinData = '', cwd } = {}) {
  const stdin = new PassThrough();
  stdin.setEncoding = () => {};
  stdin.isTTY = false;
  if (stdinData) stdin.write(stdinData);
  stdin.end();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  let err = '';
  stdout.on('data', (c) => {
    out += c.toString();
  });
  stderr.on('data', (c) => {
    err += c.toString();
  });
  return { stdin, stdout, stderr, cwd, getOut: () => out, getErr: () => err };
}

describe('hook-dispatch integration', () => {
  test('preflight strict blocks a weakened test edit across formats', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-disp-'));
    mkdirSync(path.join(dir, '.rune'));
    writeFileSync(path.join(dir, 'pay.test.ts'), JS_BEFORE);
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(dir, 'pay.test.ts'),
        content: jsAfter(`  expect(result.status).toBeTruthy();\n`),
      },
    });
    // toBeTruthy is a loosening (warn) — also drop the second assert to get a high finding
    const highPayload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(dir, 'pay.test.ts'),
        content: jsAfter(`  expect(result.status).toEqual('confirmed');\n`),
      },
    });
    const io = makeIO({ stdinData: highPayload, cwd: dir });
    const code = await dispatchHook(['preflight'], io);
    assert.strictEqual(code, 2, io.getErr());
    assert.match(io.getErr(), /assert-removed|test-integrity] BLOCKED/);

    const cursor = makeIO({
      stdinData:
        JSON.parse(highPayload) && JSON.stringify({ ...JSON.parse(highPayload), hook_event_name: 'preToolUse' }),
      cwd: dir,
    });
    const ccode = await dispatchHook(['preflight', '--format', 'cursor'], cursor);
    assert.strictEqual(ccode, 2);
    assert.strictEqual(JSON.parse(cursor.getOut()).permission, 'deny');

    const gentle = makeIO({ stdinData: highPayload, cwd: dir });
    assert.strictEqual(await dispatchHook(['preflight', '--gentle'], gentle), 0);
    assert.match(gentle.getErr(), /would block/);

    void payload;
  });

  test('sentinel strict blocks a staged weakened test; trailer overrides and is logged', () => {
    // run as a git repo
  });
});

function gitInit(dir) {
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'rune@example.com');
  git('config', 'user.name', 'Rune Test');
  return git;
}

describe('git --staged / --base and CLI', () => {
  test('analyzeGit --staged catches a weakened assertion and the CLI exits 2', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-git-'));
    const git = gitInit(dir);
    writeFileSync(path.join(dir, 'pay.test.ts'), JS_BEFORE);
    git('add', 'pay.test.ts');
    git('commit', '-q', '-m', 'baseline');
    writeFileSync(path.join(dir, 'pay.test.ts'), jsAfter(`  expect(result.status).toEqual('confirmed');\n`));
    git('add', 'pay.test.ts');

    const r = analyzeGit(dir, { staged: true });
    assert.ok(r.blocked, JSON.stringify(r.findings));
    assert.ok(rulesOf(r).includes(RULES.ASSERT_REMOVED));

    const stdout = { chunks: [] };
    const buf = {
      write(c) {
        stdout.chunks.push(c);
        return true;
      },
    };
    const err = {
      write() {
        return true;
      },
    };
    const code = await runVerify(dir, { integrity: true, staged: true }, { stdout: buf, stderr: err });
    assert.strictEqual(code, 2);
    const text = stdout.chunks.join('');
    assert.match(text, /assert-removed/);
    assert.match(formatReport(r, { json: true }), /"rule": "assert-removed"/);
  });

  test('CLI --base sees unstaged changes; adding asserts exits 0', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-base-'));
    const git = gitInit(dir);
    writeFileSync(path.join(dir, 'pay.test.ts'), JS_BEFORE);
    git('add', 'pay.test.ts');
    git('commit', '-q', '-m', 'baseline');
    writeFileSync(
      path.join(dir, 'pay.test.ts'),
      jsAfter(
        `  expect(result.status).toEqual('confirmed');\n  expect(result.total).toBe(42);\n  expect(result.id).toBeTruthy();\n`,
      ),
    );
    const stdout = {
      write() {
        return true;
      },
    };
    const stderr = {
      write() {
        return true;
      },
    };
    const code = await runVerify(dir, { integrity: true, base: 'HEAD' }, { stdout, stderr });
    assert.strictEqual(code, 0);
  });

  test('sentinel hook blocks a git commit of a weakened test; trailer overrides and logs', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rune-ti-sen-'));
    mkdirSync(path.join(dir, '.rune'));
    const git = gitInit(dir);
    writeFileSync(path.join(dir, 'pay.test.ts'), JS_BEFORE);
    git('add', 'pay.test.ts');
    git('commit', '-q', '-m', 'baseline');
    writeFileSync(path.join(dir, 'pay.test.ts'), jsAfter(`  expect(result.status).toEqual('confirmed');\n`));
    git('add', 'pay.test.ts');

    const block = makeIO({
      stdinData: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "wip"' } }),
      cwd: dir,
    });
    const code = await dispatchHook(['sentinel'], block);
    assert.strictEqual(code, 2, block.getErr());
    assert.match(block.getErr(), /test-integrity] BLOCKED/);

    const ov = makeIO({
      stdinData: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: `git commit -m "wip" -m "${OVERRIDE_TRAILER}: reviewed by nam"` },
      }),
      cwd: dir,
    });
    const ocode = await dispatchHook(['sentinel'], ov);
    assert.strictEqual(ocode, 0, ov.getErr());
    const log = readFileSync(path.join(dir, GATE_LOG_REL), 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((r) => r.source === 'hook-dispatch');
    assert.ok(
      log.some((r) => r.outcome === 'overridden' && r.override?.reason === 'reviewed by nam'),
      JSON.stringify(log, null, 2),
    );
  });
});

describe('mergeGates', () => {
  test('a block from either side wins; a crash does not discard a block', () => {
    const blocked = mergeGates(
      { status: null, stdout: '', stderr: '', error: 'boom' },
      { status: 2, stdout: '', stderr: 'integrity blocked' },
    );
    assert.strictEqual(blocked.status, 2);
    assert.match(blocked.stderr, /integrity blocked/);
  });
});

describe('usage', () => {
  test('rune verify without a mode exits 1', async () => {
    const stderr = {
      chunks: [],
      write(c) {
        this.chunks.push(c);
        return true;
      },
    };
    const code = await runVerify(
      process.cwd(),
      {},
      {
        stdout: {
          write() {
            return true;
          },
        },
        stderr,
      },
    );
    assert.strictEqual(code, 1);
    assert.match(stderr.chunks.join(''), /--integrity/);
  });
});
