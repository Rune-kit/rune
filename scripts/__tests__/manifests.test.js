/**
 * Cross-runtime manifest contract — v2.33 "Everywhere"
 *
 * One repo root, five loaders. Each test pins a constraint from the runtime's
 * published spec so a hand edit cannot silently make Rune un-installable:
 *   - Agent Plugins 1.0  plugin.json            agent-plugins.org/specification §5
 *   - Cursor plugin      .cursor-plugin/plugin.json  cursor.com/docs/reference/plugins
 *   - Gemini CLI         gemini-extension.json  geminicli.com/docs/extensions/reference
 *   - Grok Build         .grok-plugin/marketplace.json  xai-org/grok-build docs 09-plugins
 *   - Claude Code        .claude-plugin/marketplace.json (install name rune@<marketplace>)
 */

import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const pkg = readJson('package.json');

// Agent Plugins §5.5 / Cursor / Grok: lowercase, alnum + hyphen/period, no doubles.
const PLUGIN_NAME_RE = /^(?!.*--)(?!.*\.\.)[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;

describe('Agent Plugins 1.0 root plugin.json', () => {
  const m = readJson('plugin.json');
  const ALLOWED = [
    '$schema',
    'name',
    'version',
    'description',
    'author',
    'homepage',
    'repository',
    'license',
    'keywords',
    'extensions',
  ];

  test('declares the canonical 1.0.0 schema id', () => {
    assert.strictEqual(m.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  });

  test('schema is closed — no unknown top-level fields', () => {
    for (const key of Object.keys(m)) assert.ok(ALLOWED.includes(key), `unknown field "${key}"`);
  });

  test('name satisfies §5.5', () => {
    assert.match(m.name, PLUGIN_NAME_RE);
  });

  test('author only has name/email/url strings', () => {
    for (const [k, v] of Object.entries(m.author ?? {})) {
      assert.ok(['name', 'email', 'url'].includes(k), `author.${k} not allowed`);
      assert.strictEqual(typeof v, 'string');
    }
  });

  test('keywords is a string array', () => {
    assert.ok(Array.isArray(m.keywords) && m.keywords.every((k) => typeof k === 'string'));
  });

  test('fixed component locations resolve to the right kinds (§6.2)', () => {
    assert.ok(statSync(join(ROOT, 'skills')).isDirectory());
    // No MCP server ships with Rune — mcp.json must be absent, not an empty stub.
    assert.ok(!existsSync(join(ROOT, 'mcp.json')));
  });
});

describe('Cursor plugin manifest', () => {
  const m = readJson('.cursor-plugin/plugin.json');

  test('name is lowercase kebab-case', () => {
    assert.match(m.name, PLUGIN_NAME_RE);
  });

  test('every declared component path exists', () => {
    for (const key of ['skills', 'agents', 'commands', 'hooks', 'logo']) {
      assert.ok(m[key], `${key} declared`);
      assert.ok(existsSync(join(ROOT, m[key])), `${key} → ${m[key]} missing`);
    }
  });

  test('hooks override points at a Cursor-format file, not the Claude hooks.json', () => {
    // Folder discovery would otherwise pick up hooks/hooks.json, whose commands
    // depend on ${CLAUDE_PLUGIN_ROOT} — unset under Cursor.
    assert.notStrictEqual(m.hooks.replace(/^\.\//, ''), 'hooks/hooks.json');
    const hooks = readJson(m.hooks);
    assert.strictEqual(hooks.version, 1);
    assert.strictEqual(typeof hooks.hooks, 'object');
  });
});

describe('Gemini CLI extension manifest', () => {
  const m = readJson('gemini-extension.json');

  test('name is lowercase-dashed and matches the installed directory name', () => {
    assert.match(m.name, /^[a-z0-9-]+$/);
    assert.strictEqual(m.name, 'rune');
  });

  test('has version + description for the gallery', () => {
    assert.strictEqual(typeof m.version, 'string');
    assert.ok(m.description.length > 0);
  });

  test('agents/ frontmatter carries no keys Gemini rejects', () => {
    // Gemini validates agent frontmatter strictly; `subagent_type` made every
    // Rune agent fail to load. Keep agents/ to the shared key set.
    const dir = join(ROOT, 'agents');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const fm = readFileSync(join(dir, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
      assert.ok(!/^subagent_type:/m.test(fm), `${file}: subagent_type is not a portable agent key`);
    }
  });
});

describe('Grok Build marketplace', () => {
  const m = readJson('.grok-plugin/marketplace.json');

  test('every plugin name is kebab-case and has a source', () => {
    assert.ok(m.plugins.length > 0);
    for (const p of m.plugins) {
      assert.match(p.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${p.name} not kebab-case`);
      assert.ok(p.source, `${p.name} missing source`);
    }
  });

  test('rune entry points at the repo root plugin', () => {
    const rune = m.plugins.find((p) => p.name === 'rune');
    assert.ok(rune);
    const path = typeof rune.source === 'string' ? rune.source : rune.source.path;
    assert.strictEqual(path, './');
  });
});

describe('Claude Code marketplace ↔ README install command', () => {
  test('README advertises /plugin install rune@<marketplace name>', () => {
    const market = readJson('.claude-plugin/marketplace.json');
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    assert.ok(readme.includes('/plugin marketplace add rune-kit/rune'));
    assert.ok(readme.includes(`/plugin install rune@${market.name}`));
    assert.ok(!readme.includes('claude plugin add rune-kit/rune'), 'stale install command');
  });
});

describe('Claude Code marketplace plugin ids', () => {
  test('every entry is installable (letters, digits, ".", "_", "-"; starts alphanumeric)', () => {
    // `claude plugin validate` rejected the whole marketplace while packs were
    // named "@rune/<pack>" — `/plugin marketplace add rune-kit/rune` failed.
    const market = readJson('.claude-plugin/marketplace.json');
    assert.match(market.name, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
    for (const p of market.plugins) {
      assert.match(p.name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/, `"${p.name}" is not a valid plugin id`);
    }
  });
});

describe('all manifests share one version', () => {
  for (const [file, read] of [
    ['plugin.json', (j) => j.version],
    ['.cursor-plugin/plugin.json', (j) => j.version],
    ['gemini-extension.json', (j) => j.version],
    ['.grok-plugin/marketplace.json', (j) => j.plugins.find((p) => p.name === 'rune').version],
  ]) {
    test(file, () => assert.strictEqual(read(readJson(file)), pkg.version));
  }
});
