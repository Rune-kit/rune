import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatWhatsNew, maybeShowWhatsNew, shouldShowWhatsNew } from '../lib/whats-new.js';

const DATA = {
  version: '2.35.0',
  date: '2026-11-29',
  summary: 'Verify P1',
  highlights: ['Junk-match pass', 'rune verify --oracle', 'Reflect / generated lints', 'a fourth'],
  url: 'https://rune-kit.github.io/rune/changelog.html#v2-35-0',
};

const base = { command: 'update', args: {}, isTTY: true, env: {}, version: '2.35.0', data: DATA };

describe('shouldShowWhatsNew', () => {
  test('shows once when the version changed since last seen', () => {
    assert.strictEqual(shouldShowWhatsNew({ ...base, state: { lastSeen: '2.34.1' }, runeHomeExists: true }), true);
    assert.strictEqual(shouldShowWhatsNew({ ...base, state: { lastSeen: '2.35.0' }, runeHomeExists: true }), false);
  });
  test('an existing ~/.rune without state counts as an upgrade', () => {
    assert.strictEqual(shouldShowWhatsNew({ ...base, state: null, runeHomeExists: true }), true);
  });
  test('a first-ever install (no ~/.rune) stays silent', () => {
    assert.strictEqual(shouldShowWhatsNew({ ...base, state: null, runeHomeExists: false }), false);
  });
  test('never on non-TTY, --json, CI or opt-out', () => {
    const s = { state: { lastSeen: '2.34.1' }, runeHomeExists: true };
    assert.strictEqual(shouldShowWhatsNew({ ...base, ...s, isTTY: false }), false);
    assert.strictEqual(shouldShowWhatsNew({ ...base, ...s, args: { json: true } }), false);
    assert.strictEqual(shouldShowWhatsNew({ ...base, ...s, env: { CI: 'true' } }), false);
    assert.strictEqual(shouldShowWhatsNew({ ...base, ...s, env: { RUNE_NO_WHATS_NEW: '1' } }), false);
  });
  test('never for hook-dispatch, serve or verify', () => {
    const s = { state: { lastSeen: '2.34.1' }, runeHomeExists: true };
    for (const command of ['hook-dispatch', 'serve', 'verify', 'whats-new'])
      assert.strictEqual(shouldShowWhatsNew({ ...base, ...s, command }), false, command);
  });
  test('stays quiet when the bundled notes are for another version', () => {
    assert.strictEqual(
      shouldShowWhatsNew({ ...base, version: '2.36.0-dev', state: { lastSeen: '2.34.1' }, runeHomeExists: true }),
      false,
    );
    assert.strictEqual(shouldShowWhatsNew({ ...base, data: null, state: null, runeHomeExists: true }), false);
  });
});

describe('formatWhatsNew', () => {
  test('header with link + at most 3 highlights', () => {
    const lines = formatWhatsNew(DATA);
    assert.strictEqual(lines.length, 4);
    assert.match(lines[0], /What's new in rune v2\.35\.0/);
    assert.match(lines[0], /changelog\.html#v2-35-0/);
    assert.ok(!lines.join('\n').includes('a fourth'));
  });
});

describe('maybeShowWhatsNew', () => {
  let home;
  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'rune-wn-'));
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test('prints once, records the version, then stays quiet', async () => {
    await mkdir(path.join(home, '.rune'));
    await writeFile(path.join(home, '.rune', 'whats-new.json'), JSON.stringify({ lastSeen: '2.34.1' }));
    const out = [];
    const opts = { ...base, home, log: (l) => out.push(l) };
    assert.strictEqual(await maybeShowWhatsNew(opts), true);
    assert.ok(out.length >= 2 && out.length <= 5);
    const state = JSON.parse(await readFile(path.join(home, '.rune', 'whats-new.json'), 'utf8'));
    assert.strictEqual(state.lastSeen, '2.35.0');
    out.length = 0;
    assert.strictEqual(await maybeShowWhatsNew(opts), false);
    assert.strictEqual(out.length, 0);
  });

  test('first-ever run records silently, creating ~/.rune', async () => {
    const out = [];
    assert.strictEqual(await maybeShowWhatsNew({ ...base, home, log: (l) => out.push(l) }), false);
    assert.strictEqual(out.length, 0);
    assert.ok(existsSync(path.join(home, '.rune', 'whats-new.json')));
  });

  test('a corrupt state file is treated as unseen and never throws', async () => {
    await mkdir(path.join(home, '.rune'));
    await writeFile(path.join(home, '.rune', 'whats-new.json'), '{not json');
    const out = [];
    assert.strictEqual(await maybeShowWhatsNew({ ...base, home, log: (l) => out.push(l) }), true);
  });

  test('non-TTY leaves state untouched', async () => {
    await mkdir(path.join(home, '.rune'));
    const out = [];
    assert.strictEqual(await maybeShowWhatsNew({ ...base, home, isTTY: false, log: (l) => out.push(l) }), false);
    assert.ok(!existsSync(path.join(home, '.rune', 'whats-new.json')));
  });
});

describe('bundled data', () => {
  test('compiler/data/whats-new.json matches the package version', async () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const data = JSON.parse(await readFile(path.join(root, 'compiler', 'data', 'whats-new.json'), 'utf8'));
    assert.strictEqual(data.version, pkg.version);
    assert.ok(data.highlights.length >= 1 && data.highlights.length <= 3);
  });
});
