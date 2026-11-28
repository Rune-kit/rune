import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '../lib/changelog.mjs';
import { buildOutputs, chipText, meshLayout, renderChip, replaceRegion, whatsNewData } from '../site-gen.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('site-gen', () => {
  test('replaceRegion swaps only the marked region and is idempotent', () => {
    const html = 'a <!-- rune:gen:x -->old<!-- /rune:gen:x --> b';
    const once = replaceRegion(html, 'x', 'NEW');
    assert.strictEqual(once, 'a <!-- rune:gen:x -->NEW<!-- /rune:gen:x --> b');
    assert.strictEqual(replaceRegion(once, 'x', 'NEW'), once);
  });

  test('replaceRegion names the file and marker when the marker is missing', () => {
    assert.throws(
      () => replaceRegion('<p></p>', 'whats-new', '', 'docs/x.html'),
      /docs\/x\.html: missing marker <!-- rune:gen:whats-new -->/,
    );
  });

  test('chip uses the release intro without the codename and links its anchor', () => {
    const [r] = parseChangelog(
      '## [2.34.0] - 2026-11-26\n\n"Serve" — install Rune once, use it everywhere.\n\n### Added\n- **x.** y\n',
    );
    assert.strictEqual(chipText(r), 'install Rune once, use it everywhere');
    assert.match(renderChip(r, '../'), /href="\.\.\/changelog\.html#v2-34-0"/);
    assert.strictEqual(renderChip(null, ''), '\n');
    assert.strictEqual(whatsNewData(null), null);
  });

  test('mesh layout has every core skill and pack, and only edges between drawn nodes', () => {
    const index = JSON.parse(readFileSync(join(ROOT, 'skill-index.json'), 'utf8'));
    const { nodes, edges } = meshLayout(index, ['ui', 'zalo']);
    assert.strictEqual(Object.keys(nodes).length, Object.keys(index.skills).length + 2);
    assert.ok(edges.length > 100);
    for (const [f, t] of edges) assert.ok(nodes[f] && nodes[t] && f !== t);
  });

  test('committed outputs equal a fresh build (run `node scripts/site-gen.mjs`)', async () => {
    const outputs = await buildOutputs(ROOT);
    for (const [rel, content] of Object.entries(outputs)) {
      assert.ok(existsSync(join(ROOT, rel)), `${rel} missing`);
      assert.strictEqual(readFileSync(join(ROOT, rel), 'utf8'), content, `${rel} is stale`);
    }
  });

  test('generated changelog escapes markup from CHANGELOG text', async () => {
    const html = readFileSync(join(ROOT, 'docs', 'changelog.html'), 'utf8');
    const scripts = html.match(/<script\b/g) || [];
    assert.strictEqual(scripts.length, 2, 'only the theme + filter scripts');
  });
});
