import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  currentTitle,
  npmWarnings,
  promoteChangelog,
  releaseNotes,
  summaryLine,
  unreleasedBody,
  updateReadme,
} from '../release.mjs';

const CL = `# Changelog

Intro.

## [Unreleased]

Patch for serve.

### Fixed
- help works

## [2.34.0] - 2026-11-26

Old notes.
`;

describe('release.mjs helpers', () => {
  test('promotes [Unreleased] to a dated version heading', () => {
    const out = promoteChangelog(CL, '2.34.1', '2026-11-27');
    assert.match(out, /^## \[2\.34\.1\] - 2026-11-27$/m);
    assert.doesNotMatch(out, /Unreleased/);
    assert.match(out, /^## \[2\.34\.0\] - 2026-11-26$/m, 'older sections untouched');
  });

  test('refuses a missing, empty or duplicate section', () => {
    assert.throws(() => promoteChangelog('# Changelog\n\n## [2.34.0] - x\n', '2.34.1', 'd'), /no "## \[Unreleased\]"/);
    assert.throws(() => promoteChangelog('## [Unreleased]\n\n## [2.34.0] - x\n', '2.34.1', 'd'), /empty/);
    assert.throws(() => promoteChangelog(CL, '2.34.0', 'd'), /already has a 2\.34\.0/);
  });

  test('extracts notes for a version and the unreleased body', () => {
    assert.strictEqual(unreleasedBody(CL), 'Patch for serve.\n\n### Fixed\n- help works');
    const promoted = promoteChangelog(CL, '2.34.1', '2026-11-27');
    assert.strictEqual(releaseNotes(promoted, '2.34.1'), 'Patch for serve.\n\n### Fixed\n- help works');
    assert.strictEqual(releaseNotes(promoted, '2.34.0'), 'Old notes.');
    assert.throws(() => releaseNotes(promoted, '9.9.9'), /no ## \[9\.9\.9\]/);
    assert.strictEqual(summaryLine('### Fixed\n- help works'), 'help works');
  });

  test('updates the README What’s New heading and adds a dated line', () => {
    const readme = "# Rune\n\n## What's New (v2.34.0 — Serve)\n\n> **v2.34.0:** big\n";
    const out = updateReadme(readme, { from: '2.34.0', to: '2.34.1', date: '2026-11-27', summary: 'Patch.' });
    assert.match(
      out,
      /^## What's New \(v2\.34\.1 — Serve\)\n\n> \*\*v2\.34\.1 \(2026-11-27\):\*\* Patch\.\n\n> \*\*v2\.34\.0:\*\* big/m,
    );
    assert.throws(() => updateReadme(readme, { from: '1.0.0', to: '1.0.1', date: 'd' }), /no "## What's New/);
  });

  test('reads the wave title and spots npm warnings', () => {
    assert.strictEqual(currentTitle('## Current State (v2.34.0 — "Serve")\n'), 'Serve');
    assert.deepStrictEqual(npmWarnings('npm notice x\nnpm warn publish "bin" was cleaned\nnpm WARN old\nok'), [
      'npm warn publish "bin" was cleaned',
      'npm WARN old',
    ]);
    assert.deepStrictEqual(npmWarnings('npm notice Tarball Contents\n+ @rune-kit/rune@2.34.1'), []);
  });
});
