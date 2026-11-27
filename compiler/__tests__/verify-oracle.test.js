import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { runVerify } from '../commands/verify.js';
import {
  aggregate,
  canonicalize,
  compareObservations,
  fingerprintId,
  loadCorpus,
  redactVolatile,
  runOracle,
  splitCommand,
} from '../lib/verify-oracle.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'rune-oracle-'));
}

describe('helpers', () => {
  test('splitCommand respects quotes', () => {
    assert.deepEqual(splitCommand('node -e "console.log(1)"'), ['node', '-e', 'console.log(1)']);
    assert.deepEqual(splitCommand("python -c 'print(1)'"), ['python', '-c', 'print(1)']);
  });

  test('canonicalize stable-sorts JSON and leaves plain text', () => {
    assert.equal(canonicalize('{"b":1,"a":2}').includes('"a":2'), true);
    assert.equal(canonicalize('{"b":1,"a":2}'), canonicalize('{"a":2,"b":1}'));
    assert.equal(canonicalize('hello\n'), 'hello\n');
  });

  test('redactVolatile hides uuids and timestamps but keeps status codes', () => {
    const t = redactVolatile('200 2026-11-27T12:00:00Z id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    assert.match(t, /200/);
    assert.match(t, /<ts>/);
    assert.match(t, /<uuid>/);
  });

  test('compareObservations reports status, body, and exit separately', () => {
    const diffs = compareObservations(
      {
        status: 200,
        body: '{"ok":true}',
        exit: null,
        stdout: '{"ok":true}',
        stderr: '',
        headers: { 'content-type': 'application/json' },
        kind: 'url',
      },
      {
        status: 500,
        body: '{"ok":false}',
        exit: null,
        stdout: '{"ok":false}',
        stderr: '',
        headers: { 'content-type': 'application/json' },
        kind: 'url',
      },
    );
    const kinds = diffs.map((d) => d.diffKind).sort();
    assert.ok(kinds.includes('status'));
    assert.ok(kinds.includes('body'));
  });

  test('identical canonical JSON is not a divergence', () => {
    const diffs = compareObservations(
      {
        stdout: '{"b":1,"a":2}',
        body: '{"b":1,"a":2}',
        stderr: '',
        exit: 0,
        status: null,
        headers: {},
        kind: 'command',
      },
      {
        stdout: '{"a":2,"b":1}',
        body: '{"a":2,"b":1}',
        stderr: '',
        exit: 0,
        status: null,
        headers: {},
        kind: 'command',
      },
    );
    assert.deepEqual(diffs, []);
  });
});

describe('corpus + oracle run', () => {
  test('loadCorpus reads json, sidecar expected, and raw text', () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, 'a.json'), JSON.stringify({ stdin: 'hello', args: ['--x'] }));
      writeFileSync(join(dir, 'a.expected'), 'HELLO');
      writeFileSync(join(dir, 'b.txt'), 'plain');
      const cases = loadCorpus(dir);
      assert.equal(cases.length, 2);
      const a = cases.find((c) => c.id === 'a');
      assert.equal(a.stdin, 'hello');
      assert.equal(a.expected, 'HELLO');
      const b = cases.find((c) => c.id === 'b');
      assert.equal(b.stdin, 'plain');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('matching commands exit 0; a divergence fingerprints and exits 2; baseline accepts it', async () => {
    const dir = tmp();
    try {
      const corpus = join(dir, 'corpus');
      mkdirSync(corpus);
      writeFileSync(join(corpus, 'hello.txt'), 'hi');
      const echo = "node -e \"process.stdout.write(require('fs').readFileSync(0,'utf8'))\"";
      const upper = "node -e \"process.stdout.write(require('fs').readFileSync(0,'utf8').toUpperCase())\"";

      const clean = await runOracle(dir, { oracle: echo, candidate: echo, corpus, writeLog: false });
      assert.equal(clean.exitCode, 0);
      assert.equal(clean.compared, 1);
      assert.equal(clean.newCount, 0);

      const bad = await runOracle(dir, { oracle: echo, candidate: upper, corpus, writeLog: true });
      assert.equal(bad.exitCode, 2);
      assert.equal(bad.newCount, 1);
      assert.ok(bad.findings[0].id);
      assert.equal(bad.findings[0].diffKind, 'stdout');
      assert.equal(bad.findings[0].input, 'hello');
      assert.ok(bad.runLog);

      const clusters = aggregate(bad.findings);
      assert.equal(clusters.length, 1);
      assert.deepEqual(clusters[0].cases, ['hello']);

      const baseline = join(dir, 'baseline.json');
      writeFileSync(baseline, JSON.stringify({ accepted: [{ id: bad.findings[0].id, reason: 'known case fold' }] }));
      const accepted = await runOracle(dir, { oracle: echo, candidate: upper, corpus, baseline, writeLog: false });
      assert.equal(accepted.exitCode, 0);
      assert.equal(accepted.baselinedCount, 1);
      assert.equal(accepted.newCount, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fixture-dir oracle compares a candidate against recorded expected output', async () => {
    const dir = tmp();
    try {
      const fixtures = join(dir, 'fixtures');
      mkdirSync(fixtures);
      writeFileSync(join(fixtures, 'case.json'), JSON.stringify({ stdin: 'hi', expected: 'hi' }));
      const echo = "node -e \"process.stdout.write(require('fs').readFileSync(0,'utf8'))\"";
      const ok = await runOracle(dir, { oracle: fixtures, candidate: echo, writeLog: false });
      assert.equal(ok.exitCode, 0, JSON.stringify(ok.findings));
      const upper = 'node -e "process.stdout.write(\'NOPE\')"';
      const bad = await runOracle(dir, { oracle: fixtures, candidate: upper, writeLog: false });
      assert.equal(bad.exitCode, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('injected runner covers URL-shaped observations', async () => {
    const dir = tmp();
    try {
      const corpus = join(dir, 'corpus');
      mkdirSync(corpus);
      writeFileSync(join(corpus, 'ping.json'), JSON.stringify({ path: '/ping', method: 'GET' }));
      const runner = (spec) => {
        if (spec.value.includes('legacy')) {
          return {
            ok: true,
            kind: 'url',
            status: 200,
            body: '{"ok":true}',
            stdout: '{"ok":true}',
            stderr: '',
            headers: { 'content-type': 'application/json' },
            exit: null,
            error: null,
          };
        }
        return {
          ok: true,
          kind: 'url',
          status: 200,
          body: '{"ok":false}',
          stdout: '{"ok":false}',
          stderr: '',
          headers: { 'content-type': 'application/json' },
          exit: null,
          error: null,
        };
      };
      const r = await runOracle(dir, {
        oracle: 'https://legacy.example/api',
        candidate: 'https://new.example/api',
        corpus,
        runner,
        writeLog: false,
      });
      assert.equal(r.exitCode, 2);
      assert.ok(r.findings.some((f) => f.diffKind === 'body'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('CLI --oracle reports fingerprints and exits 2 on a new divergence', async () => {
    const dir = tmp();
    try {
      const corpus = join(dir, 'corpus');
      mkdirSync(corpus);
      writeFileSync(join(corpus, 'hello.txt'), 'hi');
      const echo = "node -e \"process.stdout.write(require('fs').readFileSync(0,'utf8'))\"";
      const upper = "node -e \"process.stdout.write(require('fs').readFileSync(0,'utf8').toUpperCase())\"";
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
      const code = await runVerify(dir, { oracle: echo, candidate: upper, corpus }, { stdout: out, stderr: err });
      assert.equal(code, 2);
      const text = out.chunks.join('');
      assert.match(text, /stdout/);
      assert.match(text, /NEW/);
      assert.match(text, /hello/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fingerprint ids are stable for the same mismatch', () => {
    const a = fingerprintId('stdout', 'hi', 'HI');
    const b = fingerprintId('stdout', 'hi', 'HI');
    const c = fingerprintId('stdout', 'hi', 'hey');
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.length, 16);
  });
});
