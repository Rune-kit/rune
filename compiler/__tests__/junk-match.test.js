import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { mergeGates } from '../commands/hook-dispatch.js';
import { runVerify } from '../commands/verify.js';
import { analyzeJunkFile, formatJunkReport, JUNK_RULES, runJunkForEvent, splitTestBlocks } from '../lib/junk-match.js';

function rules(result) {
  const findings = Array.isArray(result) ? result : result.findings || [];
  return findings.map((f) => f.rule);
}

function scan(file, after, before = '') {
  return analyzeJunkFile({ file, before, after });
}

describe('false-positive guards (must stay clean)', () => {
  test('expect(isValid(x)).toBe(true) is a real assertion, not expect(true)', () => {
    const r = scan(
      'pay.test.ts',
      `test('accepts a valid card', () => {
  expect(isValid(card)).toBe(true);
  expect(result.ok).toBe(true);
  assert.equal(flag, true);
});
`,
    );
    assert.deepEqual(rules(r), []);
  });

  test('adding a new meaningful assertion stays clean', () => {
    const r = analyzeJunkFile({
      file: 'pay.test.ts',
      before: `test('charges the card', () => {
  expect(charge(card).amount).toBe(10);
});
`,
      after: `test('charges the card', () => {
  const rec = charge(card);
  expect(rec.amount).toBe(10);
  expect(rec.currency).toEqual('USD');
});
`,
    });
    assert.deepEqual(rules(r), []);
  });

  test('a specific regex matcher is not a catch-all', () => {
    const r = scan(
      'pay.test.ts',
      `test('surfaces a card error', () => {
  expect(message).toMatch(/expired.*card/i);
  expect(message).toMatch(/^ERR-\\d+$/);
});
`,
    );
    assert.deepEqual(rules(r), []);
  });

  test('mock plus an assertion about the system under test is not mock-echo', () => {
    const r = scan(
      'pay.test.ts',
      `test('uses the gateway response', () => {
  gateway.charge.mockReturnValue({ ok: true, id: 'ch_1' });
  const rec = pay(cart);
  expect(gateway.charge).toHaveBeenCalled();
  expect(rec.receiptId).toBe('ch_1');
  expect(rec.total).toBe(cart.total);
});
`,
    );
    assert.deepEqual(rules(r), []);
  });

  test('a test named after a status code may only check status', () => {
    const r = scan(
      'auth.test.ts',
      `test('returns 401 unauthorized when the token is missing', async () => {
  const res = await request(app).get('/secret');
  expect(res.status).toBe(401);
});
`,
    );
    assert.deepEqual(rules(r), []);
  });

  test('status plus a body assertion is not status-only', () => {
    const r = scan(
      'pay.test.ts',
      `test('creates a charge', async () => {
  const res = await request(app).post('/charges');
  expect(res.status).toBe(200);
  expect(res.body.id).toMatch(/^ch_/);
});
`,
    );
    assert.deepEqual(rules(r), []);
  });

  test('renames and formatting in a real test stay clean', () => {
    const before = `test('charges the card', () => {
  expect(charge(card).amount).toBe(10);
});
`;
    const after = `test('charges the Visa card', () => {
  const receipt = charge(card);
  expect(receipt.amount).toBe(10);
});
`;
    assert.deepEqual(rules(analyzeJunkFile({ file: 'pay.test.ts', before, after })), []);
  });

  test('src that does not import fixtures stays clean', () => {
    const r = scan(
      'src/pay.js',
      `import { charge } from './gateway.js';\nexport function pay(c) { return charge(c); }\n`,
    );
    assert.deepEqual(rules(r), []);
  });
});

describe('junk detections', () => {
  test('expect(true) / assert.ok(true) / assert True are high', () => {
    const r = scan(
      'vacuous.test.ts',
      `test('passes no matter what', () => {
  expect(true).toBe(true);
  assert.ok(true);
});
`,
    );
    assert.ok(r.some((f) => f.rule === JUNK_RULES.EXPECT_TRUE && f.severity === 'high'));
  });

  test('python assert True is flagged', () => {
    const r = scan('test_pay.py', 'def test_ok():\n    assert True\n');
    assert.ok(r.some((f) => f.rule === JUNK_RULES.EXPECT_TRUE));
  });

  test('expect(value).toBe(value) is a tautology', () => {
    const r = scan(
      'pay.test.ts',
      `test('echo', () => {
  expect(result).toBe(result);
});
`,
    );
    assert.ok(r.some((f) => f.rule === JUNK_RULES.TAUTOLOGY && f.severity === 'high'));
  });

  test('catch-all /^.*$/ and /.*/ are flagged', () => {
    const r = scan(
      'pay.test.ts',
      `test('accepts anything', () => {
  expect(output).toMatch(/^.*$/);
  expect(output).toMatch(/.*/);
});
`,
    );
    const hits = r.filter((f) => f.rule === JUNK_RULES.CATCHALL_REGEX);
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].severity, 'warn');
  });

  test('empty inline snapshot is high', () => {
    const r = scan(
      'pay.test.ts',
      `test('renders', () => {
  expect(render()).toMatchInlineSnapshot(\`\`);
});
`,
    );
    assert.ok(r.some((f) => f.rule === JUNK_RULES.EMPTY_SNAPSHOT && f.severity === 'high'));
  });

  test('empty snapshot file is high', () => {
    const r = analyzeJunkFile({ file: 'pay.test.ts.snap', before: 'exports[`x`] = `hello`;', after: '' });
    assert.ok(r.some((f) => f.rule === JUNK_RULES.EMPTY_SNAPSHOT));
  });

  test('mockReturnValue + expect the same literal with no other assert is mock-echo', () => {
    const r = scan(
      'pay.test.ts',
      `test('the mock works', () => {
  api.charge.mockReturnValue(42);
  expect(api.charge()).toBe(42);
});
`,
    );
    assert.ok(r.some((f) => f.rule === JUNK_RULES.MOCK_ECHO));
  });

  test('a behavior test that only checks res.status is status-only', () => {
    const r = scan(
      'pay.test.ts',
      `test('creates a charge for a valid cart', async () => {
  const res = await request(app).post('/charges').send(cart);
  expect(res.status).toBe(200);
});
`,
    );
    assert.ok(r.some((f) => f.rule === JUNK_RULES.STATUS_ONLY));
  });

  test('production src importing __fixtures__ is fixture-in-src', () => {
    const r = scan(
      'src/pay.js',
      `import expected from '../__fixtures__/charge.json';\nexport const GOLDEN = expected;\n`,
    );
    assert.ok(r.some((f) => f.rule === JUNK_RULES.FIXTURE_IN_SRC));
  });

  test('pre-existing junk on an untouched line is not re-flagged when a new real assert is added', () => {
    const before = `test('old', () => {
  expect(true).toBe(true);
});
`;
    const after = `test('old', () => {
  expect(true).toBe(true);
  expect(charge(card).amount).toBe(10);
});
`;
    const r = analyzeJunkFile({ file: 'pay.test.ts', before, after });
    assert.equal(
      r.filter((f) => f.rule === JUNK_RULES.EXPECT_TRUE).length,
      0,
      'unchanged vacuous line must not be re-reported',
    );
  });
});

describe('blocks and reports', () => {
  test('splitTestBlocks finds jest and pytest tests', () => {
    const js = splitTestBlocks(`test('a', () => {});\nit('b', () => {});`, 'javascript');
    assert.deepEqual(
      js.map((b) => b.name),
      ['a', 'b'],
    );
    const py = splitTestBlocks('def test_a():\n    assert 1\n\ndef test_b():\n    assert 2\n', 'python');
    assert.deepEqual(
      py.map((b) => b.name),
      ['test_a', 'test_b'],
    );
  });

  test('formatJunkReport is clean when empty and lists fingerprints otherwise', () => {
    assert.match(formatJunkReport({ findings: [], high: [], warn: [], blocked: false }), /clean/);
    const text = formatJunkReport({
      findings: [
        { file: 'a.test.ts', line: 3, rule: 'expect-true', after: 'expect(true)', detail: 'x', severity: 'high' },
      ],
      high: [1],
      warn: [],
      blocked: true,
    });
    assert.match(text, /HIGH/);
    assert.match(text, /expect-true/);
    assert.match(text, /a.test.ts:3/);
  });
});

describe('git + CLI + hooks', () => {
  test('CLI --junk exits 2 on a new expect(true) and 0 when adding a real assert', async () => {
    const { execFileSync } = await import('node:child_process');
    const dir = mkdtempSync(join(tmpdir(), 'rune-junk-'));
    try {
      const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
      git('init', '-q');
      git('config', 'user.email', 'rune@example.com');
      git('config', 'user.name', 'Rune Test');
      writeFileSync(join(dir, 'pay.test.ts'), `test('charges', () => { expect(charge(card).amount).toBe(10); });\n`);
      git('add', 'pay.test.ts');
      git('commit', '-q', '-m', 'baseline');
      writeFileSync(join(dir, 'pay.test.ts'), `test('charges', () => { expect(true).toBe(true); });\n`);
      const err = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const out = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const code = await runVerify(dir, { junk: true }, { stdout: out, stderr: err });
      assert.equal(code, 2);
      assert.match(out.chunks.join(''), /expect-true/);

      writeFileSync(
        join(dir, 'pay.test.ts'),
        `test('charges', () => { expect(charge(card).amount).toBe(10); expect(charge(card).currency).toBe('USD'); });\n`,
      );
      const out2 = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const code2 = await runVerify(dir, { junk: true }, { stdout: out2, stderr: err });
      assert.equal(code2, 0);
      assert.match(out2.chunks.join(''), /clean/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('runJunkForEvent blocks expect(true) on a test edit', () => {
    const event = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: 'pay.test.ts',
        content: `test('charges', () => { expect(true).toBe(true); });\n`,
      },
    };
    const gate = runJunkForEvent(event, process.cwd());
    assert.equal(gate.status, 2);
    assert.match(gate.stderr, /junk-match|expect-true|expect\(true\)/);
  });
});

describe('mergeGates still prefers a block', () => {
  test('junk block survives a clean lint gate', () => {
    const blocked = { status: 2, stdout: '', stderr: 'junk' };
    const clean = { status: 0, stdout: '', stderr: '' };
    assert.equal(mergeGates(clean, blocked).status, 2);
  });
});
