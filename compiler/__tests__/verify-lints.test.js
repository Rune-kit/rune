import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { runVerify } from '../commands/verify.js';
import {
  appendConvention,
  loadFindings,
  matchFilesGlob,
  mergeRules,
  recurringFindings,
  runLints,
  runLintsForEvent,
  runReflect,
  upsertPointer,
} from '../lib/verify-lints.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'rune-lints-'));
}

describe('rules + findings', () => {
  test('a finding must recur (count ≥ 2) unless promote is set', () => {
    const once = recurringFindings(
      loadFindings('{"title":"no fetch in unit tests","pattern":"fetch\\\\(","count":1}\n'),
    );
    assert.equal(once.length, 0);
    const twice = recurringFindings([
      { title: 'no fetch in unit tests', pattern: 'fetch\\(', count: 1 },
      { title: 'no fetch in unit tests', pattern: 'fetch\\(', count: 1 },
    ]);
    assert.equal(twice.length, 1);
    const forced = recurringFindings([{ title: 'one-off but approved', pattern: 'TODO', promote: true }]);
    assert.equal(forced.length, 1);
  });

  test('mergeRules dedupes by id or pattern and reports newly added ids', () => {
    const { rules, added } = mergeRules(
      [{ id: 'no-fetch', pattern: 'fetch\\(', title: 'no fetch', message: 'old' }],
      [
        { id: 'no-fetch', pattern: 'fetch\\(', title: 'no fetch', message: 'new wording' },
        { id: 'no-eval', pattern: '\\beval\\(', title: 'no eval', message: 'do not eval' },
      ],
      { today: '2026-11-27' },
    );
    assert.equal(rules.length, 2);
    assert.deepEqual(
      added.map((r) => r.id),
      ['no-eval'],
    );
    assert.equal(rules[0].message, 'new wording');
  });

  test('upsertPointer is idempotent', () => {
    const first = upsertPointer('# Agent instructions\n\nBe careful.\n');
    assert.match(first, /rune-verify-lints/);
    assert.match(first, /rune verify --lints/);
    const second = upsertPointer(first);
    assert.equal(first, second);
  });

  test('appendConvention does not duplicate a title', () => {
    const first = appendConvention(
      '# Conventions\n',
      [{ title: 'No fetch in unit tests', message: 'Use a stub.', id: 'no-fetch', pattern: 'fetch\\(' }],
      { today: '2026-11-27' },
    );
    const second = appendConvention(
      first.text,
      [{ title: 'No fetch in unit tests', message: 'Use a stub.', id: 'no-fetch', pattern: 'fetch\\(' }],
      { today: '2026-11-27' },
    );
    assert.equal(first.text, second.text);
    assert.equal(second.added.length, 0);
  });

  test('matchFilesGlob handles brace extensions and globstar', () => {
    assert.equal(matchFilesGlob('src/pay.test.ts', '**/*.{js,ts,jsx,tsx,py,go,rs,java}'), true);
    assert.equal(matchFilesGlob('src/pay.test.ts', '**/*.{test,spec}.{ts,js}'), true);
    assert.equal(matchFilesGlob('src/pay.test.ts', '**/*.test.ts'), true);
    assert.equal(matchFilesGlob('src/pay.js', '**/*.{js,ts}'), true);
    assert.equal(matchFilesGlob('src/pay.js', '**/*.js'), true);
    assert.equal(matchFilesGlob('src/pay.py', '**/*.js'), false);
    assert.equal(matchFilesGlob('src/pay.js', '**/*'), true);
  });
});

describe('runLints + reflect + hooks', () => {
  test('runLints flags a high rule and leaves a non-matching file clean', () => {
    const dir = tmp();
    try {
      mkdirSync(join(dir, '.rune', 'lints'), { recursive: true });
      writeFileSync(
        join(dir, '.rune', 'lints', 'rules.json'),
        JSON.stringify({
          rules: [
            { id: 'no-eval', pattern: '\\beval\\(', message: 'do not call eval', files: '**/*.js', severity: 'high' },
          ],
        }),
      );
      writeFileSync(join(dir, 'bad.js'), 'export const x = eval("1");\n');
      writeFileSync(join(dir, 'good.js'), 'export const x = 1;\n');
      const r = runLints(dir);
      assert.equal(r.blocked, true);
      assert.equal(r.high.length, 1);
      assert.equal(r.high[0].file, 'bad.js');
      assert.ok(r.findings.every((f) => f.file !== 'good.js'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reflect writes rules, conventions, and AGENTS/CLAUDE pointers, and does not invent a commit', async () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '# Agents\n\nProject notes.\n');
      writeFileSync(join(dir, 'CLAUDE.md'), '# Claude\n');
      mkdirSync(join(dir, '.rune'), { recursive: true });
      writeFileSync(
        join(dir, '.rune', 'review-findings.jsonl'),
        `${JSON.stringify({ title: 'Do not call eval', pattern: '\\beval\\(', message: 'Use JSON.parse', files: '**/*.js', severity: 'high', count: 2, source: 'review' })}\n`,
      );
      const result = runReflect(dir, { today: '2026-11-27' });
      assert.ok(result.addedRules.includes('do-not-call-eval') || result.promoted === 1);
      assert.ok(result.written.includes('.rune/lints/rules.json'));
      assert.ok(result.written.includes('.rune/conventions.md'));
      assert.ok(result.pointers.includes('AGENTS.md'));
      assert.ok(result.pointers.includes('CLAUDE.md'));
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
      assert.match(agents, /rune-verify-lints/);
      const conventions = readFileSync(join(dir, '.rune', 'conventions.md'), 'utf8');
      assert.match(conventions, /Do not call eval/);
      assert.match(conventions, /2026-11-27/);
      const rules = JSON.parse(readFileSync(join(dir, '.rune', 'lints', 'rules.json'), 'utf8'));
      assert.equal(rules.rules.length, 1);
      assert.equal(rules.rules[0].pattern, '\\beval\\(');

      const again = runReflect(dir, { today: '2026-11-27' });
      assert.equal(again.addedRules.length, 0);
      assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), agents);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('runLintsForEvent blocks a high lint on Write', () => {
    const dir = tmp();
    try {
      mkdirSync(join(dir, '.rune', 'lints'), { recursive: true });
      writeFileSync(
        join(dir, '.rune', 'lints', 'rules.json'),
        JSON.stringify({
          rules: [{ id: 'no-eval', pattern: 'eval\\(', files: '**/*.js', severity: 'high', message: 'no eval' }],
        }),
      );
      const gate = runLintsForEvent(
        { tool_name: 'Write', tool_input: { file_path: join(dir, 'x.js'), content: 'eval(1)\n' } },
        dir,
      );
      assert.equal(gate.status, 2);
      assert.match(gate.stderr, /no-eval/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('runLintsForEvent is a no-op when no rules file exists', () => {
    const dir = tmp();
    try {
      const gate = runLintsForEvent(
        { tool_name: 'Write', tool_input: { file_path: 'x.js', content: 'eval(1)\n' } },
        dir,
      );
      assert.equal(gate.status, 0);
      assert.equal(gate.stderr, '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('CLI --reflect and --lints, and usage without a mode', async () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '# Agents\n');
      mkdirSync(join(dir, '.rune'), { recursive: true });
      writeFileSync(
        join(dir, '.rune', 'review-findings.jsonl'),
        `${JSON.stringify({ title: 'ban eval', pattern: 'eval\\(', files: '**/*.js', severity: 'warn', count: 2 })}\n`,
      );
      writeFileSync(join(dir, 'ok.js'), 'export const n = 1;\n');
      const out = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const err = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const code = await runVerify(dir, { reflect: true }, { stdout: out, stderr: err });
      assert.equal(code, 0, err.chunks.join(''));
      assert.match(out.chunks.join(''), /reflect:/);

      const out2 = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const code2 = await runVerify(dir, { lints: true }, { stdout: out2, stderr: err });
      assert.equal(code2, 0);
      assert.match(out2.chunks.join(''), /lints: clean/);

      const err3 = {
        chunks: [],
        write(c) {
          this.chunks.push(c);
          return true;
        },
      };
      const code3 = await runVerify(dir, {}, { stdout: out2, stderr: err3 });
      assert.equal(code3, 1);
      assert.match(err3.chunks.join(''), /--oracle/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
