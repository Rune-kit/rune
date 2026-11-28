import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  inlineMd,
  itemTitle,
  latestReleased,
  notesMarkdown,
  parseChangelog,
  releaseHighlights,
  telegramText,
} from '../lib/changelog.mjs';

const CL = `# Changelog

Format notes.

## [Unreleased]

### Added
- **Junk-match pass** (\`rune verify --junk\`). Scans diffs.

## [2.34.1] - 2026-11-27

Patch for \`rune serve\`.

### Fixed
- **Help only prints usage.** \`rune serve setup --help\` used to
  run the whole setup.
- **Key never printed on non-TTY.** Writes ~/.rune/serve.key.

### Changed
- **\`list_skills\` is compact by default.** Fewer tokens.

### Added
- **Release script.** One command.

## [2.32.0] - 2026-08-16

"Drawing the Mesh" — the mesh knows what its pieces look like.

### Added — \`diagram\` L3 skill (v0.1.0)

New \`diagram\` skill draws figures.

Second paragraph.

### Fixed — quarantine hook was async

It ran and reached nobody.
`;

describe('changelog parser', () => {
  const releases = parseChangelog(CL);

  test('parses every version heading in order, with dates', () => {
    assert.deepStrictEqual(
      releases.map((r) => [r.version, r.date]),
      [
        ['Unreleased', null],
        ['2.34.1', '2026-11-27'],
        ['2.32.0', '2026-08-16'],
      ],
    );
  });

  test('joins wrapped bullet lines into one item', () => {
    const fixed = releases[1].sections.find((s) => s.type === 'Fixed');
    assert.strictEqual(fixed.items.length, 2);
    assert.match(fixed.items[0].raw, /used to run the whole setup/);
    assert.strictEqual(fixed.items[0].title, 'Help only prints usage');
  });

  test('a prose section becomes one item titled by its heading suffix', () => {
    const added = releases[2].sections.find((s) => s.type === 'Added');
    assert.strictEqual(added.items.length, 1);
    assert.strictEqual(added.items[0].title, '`diagram` L3 skill (v0.1.0)');
    assert.match(added.items[0].body, /Second paragraph/);
  });

  test('keeps the intro / codename line', () => {
    assert.strictEqual(releases[1].intro, 'Patch for `rune serve`.');
    assert.match(releases[2].intro, /^"Drawing the Mesh"/);
  });

  test('infers area tags from the text', () => {
    assert.ok(releases[1].areas.includes('Serve'));
    assert.ok(releases[0].areas.includes('Verify'));
    assert.ok(releases[2].areas.includes('Hooks'));
  });

  test('latestReleased skips Unreleased', () => {
    assert.strictEqual(latestReleased(releases).version, '2.34.1');
    assert.strictEqual(latestReleased(parseChangelog('## [Unreleased]\n- x\n')), null);
  });

  test('highlights put Added first, then the rest, capped', () => {
    assert.deepStrictEqual(releaseHighlights(releases[1], 3), [
      'Release script',
      '`list_skills` is compact by default',
      'Help only prints usage',
    ]);
  });
});

describe('inline markdown', () => {
  test('escapes HTML before rendering', () => {
    assert.strictEqual(inlineMd('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  test('renders code, bold and links', () => {
    assert.strictEqual(
      inlineMd('**Bold** `a<b>` [docs](docs/SERVE.md)'),
      '<strong>Bold</strong> <code>a&lt;b&gt;</code> <a href="https://github.com/rune-kit/rune/blob/master/docs/SERVE.md">docs</a>',
    );
  });
  test('drops javascript: links to plain text', () => {
    assert.strictEqual(inlineMd('[x](javascript:alert(1))'), 'x');
  });
  test('itemTitle falls back to a trimmed first sentence', () => {
    assert.strictEqual(
      itemTitle('Manifest validation accepts AfterModel. More text.'),
      'Manifest validation accepts AfterModel',
    );
  });
});

describe('release notes', () => {
  const releases = parseChangelog(CL);
  test('GitHub notes are the CHANGELOG section plus a compare link', () => {
    const md = notesMarkdown(releases[1], { previous: '2.32.0' });
    assert.match(md, /^Patch for `rune serve`\./);
    assert.match(md, /### Fixed/);
    assert.match(md, /compare\/v2\.32\.0\.\.\.v2\.34\.1/);
    assert.doesNotMatch(md, /fix\(serve\)/);
  });
  test('Telegram text is short HTML with escaped content', () => {
    const t = telegramText(parseChangelog('## [1.0.0] - 2026-01-01\n\n### Added\n- **A <b> & c.** x\n'), '1.0.0');
    assert.match(t, /A &lt;b&gt; &amp; c/);
    assert.ok(t.length < 4096);
    assert.match(t, /changelog\.html#v1-0-0/);
  });
  test('Telegram text is null for an unknown version', () => {
    assert.strictEqual(telegramText(releases, '9.9.9'), null);
  });
});
