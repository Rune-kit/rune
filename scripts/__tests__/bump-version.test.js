import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'bump-version.js');

/**
 * Spin up a tiny mirror of the Rune Free root (just the touchpoint files)
 * so we can run bump-version.js against it without mutating the real repo.
 */
function seedFixture(version, { withRoadmapTitle = true, withMarketplace = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rune-bump-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });

  // type: module required so the ESM bump-version.js can be executed from this fixture root
  // (Node walks up to the nearest package.json; without "type": "module" it treats import as CJS and SyntaxError-s).
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: '@rune-kit/rune', version, type: 'module' }, null, 2),
  );
  writeFileSync(join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'rune', version }, null, 2));
  if (withMarketplace) {
    writeFileSync(
      join(root, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({ plugins: [{ name: 'rune', version }] }, null, 2),
    );
  }
  writeFileSync(
    join(root, 'docs', 'index.html'),
    `<p class="hero-badge">v${version} &mdash; 63 skills &bull; MIT</p>\n`,
  );

  const roadmapHeader = `> Last updated: May 2026 | Version: ${version}\n\n`;
  const roadmapTitle = withRoadmapTitle
    ? `## Current State (v${version} — "Old Wave")\n`
    : `## Current State (legacy)\n`;
  writeFileSync(join(root, 'ROADMAP.md'), roadmapHeader + roadmapTitle);

  // Mirror the script (we test by copying — the production script lives elsewhere)
  copyFileSync(SCRIPT, join(root, 'scripts', 'bump-version.js'));
  // version-sync-check is required by the post-bump invocation — stub it as a no-op
  writeFileSync(join(root, 'scripts', 'version-sync-check.js'), `process.exit(0);\n`);
  return root;
}

function runBump(root, args) {
  return execFileSync('node', [join(root, 'scripts', 'bump-version.js'), ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('bump-version', () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test('rejects when no version argument is provided', () => {
    root = seedFixture('2.16.0');
    assert.throws(() => runBump(root, ['--dry-run']), /Usage:/);
  });

  test('rejects when version equals current version', () => {
    root = seedFixture('2.16.0');
    assert.throws(() => runBump(root, ['2.16.0', '--dry-run']), /already at 2\.16\.0/);
  });

  test('dry-run reports targets without writing', () => {
    root = seedFixture('2.16.0');
    const out = runBump(root, ['2.17.0', '--dry-run', '--title', 'Test Wave']);
    assert.match(out, /Bumping 2\.16\.0 → 2\.17\.0 \(DRY RUN\)/);
    assert.match(out, /package\.json/);
    assert.match(out, /plugin\.json/);
    assert.match(out, /marketplace\.json/);
    assert.match(out, /docs\/index\.html/);
    assert.match(out, /ROADMAP\.md/);

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '2.16.0', 'dry-run must not mutate files');
  });

  test('write mode bumps all files', () => {
    root = seedFixture('2.16.0');
    runBump(root, ['2.17.0', '--title', 'New Wave']);

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '2.17.0');

    const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.strictEqual(plugin.version, '2.17.0');

    const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
    assert.strictEqual(marketplace.plugins[0].version, '2.17.0');

    const indexHtml = readFileSync(join(root, 'docs', 'index.html'), 'utf8');
    assert.match(indexHtml, /v2\.17\.0\s*&mdash;/);
    assert.ok(!indexHtml.includes('v2.16.0'), 'old version must be replaced');

    const roadmap = readFileSync(join(root, 'ROADMAP.md'), 'utf8');
    assert.match(roadmap, /Version: 2\.17\.0/);
    assert.match(roadmap, /## Current State \(v2\.17\.0 — "New Wave"\)/);
  });

  test('aborts when ROADMAP Current State title needs --title and none was provided', () => {
    root = seedFixture('2.16.0');
    assert.throws(() => runBump(root, ['2.17.0']), /pass --title/);

    // After abort, package.json must remain unchanged (atomicity contract)
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.strictEqual(
      pkg.version,
      '2.16.0',
      'partial writes occurred before the failing target — package.json should not have been mutated',
    );
  });

  test('skips files that do not exist', () => {
    root = seedFixture('2.16.0', { withMarketplace: false });
    const out = runBump(root, ['2.17.0', '--dry-run', '--title', 'Wave']);
    assert.match(out, /marketplace\.json — file not found/);
  });
});
