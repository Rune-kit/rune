import assert from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { detectInvariants, renderInvariants } from '../../skills/onboard/scripts/detect-invariants.js';

async function scaffold(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'rune-invariants-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
  }
  return root;
}

describe('detectInvariants — danger zones', () => {
  test('scores deeply-nested source directories as danger zones', async () => {
    const files = {};
    for (let i = 0; i < 12; i++) {
      files[`src/auth/sub/file${i}.ts`] = `export const x${i} = ${i};\n`;
    }
    files['src/auth/session.ts'] = 'export const SESSION_TTL = 900;\n';
    const root = await scaffold(files);
    try {
      const result = await detectInvariants({ root });
      const danger = result.danger.map((r) => r.where[0]);
      assert.ok(
        danger.some((d) => d.startsWith('src/auth')),
        `expected src/auth in danger, got: ${JSON.stringify(danger)}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('ignores node_modules and .git', async () => {
    const files = {};
    for (let i = 0; i < 20; i++) {
      files[`node_modules/pkg/file${i}.js`] = '// noise\n';
    }
    files['src/app.ts'] = 'export const A = 1;\n';
    const root = await scaffold(files);
    try {
      const result = await detectInvariants({ root });
      const danger = result.danger.map((r) => r.where[0]);
      assert.ok(!danger.some((d) => d.includes('node_modules')), 'node_modules must not appear');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('detectInvariants — critical constants', () => {
  test('flags SCREAMING_SNAKE constants used in 3+ files', async () => {
    const files = {
      'src/config.ts': 'export const MAX_RETRIES = 3;\n',
      'src/a.ts': 'import { MAX_RETRIES } from "./config";\nconsole.log(MAX_RETRIES);\n',
      'src/b.ts': 'import { MAX_RETRIES } from "./config";\nif (MAX_RETRIES > 0) {}\n',
      'src/c.ts': 'import { MAX_RETRIES } from "./config";\nconst x = MAX_RETRIES;\n',
    };
    const root = await scaffold(files);
    try {
      const result = await detectInvariants({ root });
      const found = result.critical.some(
        (r) => (r.title ?? '').includes('MAX_RETRIES') || (r.what ?? '').includes('MAX_RETRIES'),
      );
      assert.ok(
        found,
        `expected MAX_RETRIES in critical, got titles: ${JSON.stringify(result.critical.map((r) => r.title))}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('does NOT flag constants used in fewer than 3 places', async () => {
    const files = {
      'src/config.ts': 'export const LONELY = 1;\n',
      'src/a.ts': 'import { LONELY } from "./config";\n',
    };
    const root = await scaffold(files);
    try {
      const result = await detectInvariants({ root });
      const found = result.critical.some((r) => (r.title ?? '').includes('LONELY'));
      assert.strictEqual(found, false, 'LONELY should not be flagged with only 2 usages');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('renderInvariants', () => {
  test('produces markdown headings per non-empty bucket', () => {
    const result = {
      danger: [{ title: 'src/auth', what: '12 files', where: ['src/auth/**'], why: 'high churn' }],
      critical: [],
      state: [],
      cross: [],
      stats: { filesScanned: 10 },
    };
    const md = renderInvariants(result);
    assert.ok(md.includes('### Danger Zones'));
    assert.ok(md.includes('#### src/auth'));
    assert.ok(md.includes('- **WHAT**: 12 files'));
    assert.ok(!md.includes('### Critical Invariants'));
  });

  test('falls back to placeholder when empty', () => {
    const md = renderInvariants({ danger: [], critical: [], state: [], cross: [] });
    assert.match(md, /No invariants detected/);
  });
});

describe('detectInvariants — performance', () => {
  let root;
  before(async () => {
    const files = {};
    for (let i = 0; i < 120; i++) {
      files[`src/mod${i % 12}/file${i}.ts`] = `export const FOO_${i} = ${i};\n`;
    }
    root = await scaffold(files);
  });
  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test('completes under 5 seconds for a 120-file project', async () => {
    const start = Date.now();
    const result = await detectInvariants({ root });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, `took ${elapsed}ms, expected <5000ms`);
    assert.ok(result.stats.filesScanned >= 100, `scanned ${result.stats.filesScanned} files`);
  });
});
