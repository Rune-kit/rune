/**
 * whats-new.js — tell a user, once, what changed after they upgrade Rune.
 *
 * The notes are bundled as compiler/data/whats-new.json (generated from
 * CHANGELOG.md by scripts/site-gen.mjs — the npm package does not ship the
 * changelog itself). The last version a user has seen lives in
 * ~/.rune/whats-new.json. The notice prints at most once per version and
 * never where output is parsed: non-TTY stdout, --json, CI, hook-dispatch,
 * serve and verify. Opt out with RUNE_NO_WHATS_NEW=1. Never throws.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'whats-new.json');
const QUIET_COMMANDS = new Set(['hook-dispatch', 'serve', 'verify', 'whats-new']);

/** Bundled notes for this package version, or null. */
export function loadWhatsNewData(file = DATA_PATH) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
}

export function statePath(home = os.homedir()) {
  return path.join(home, '.rune', 'whats-new.json');
}

/** Pure decision. `state` is the parsed ~/.rune/whats-new.json (or null). */
export function shouldShowWhatsNew({ command, args = {}, isTTY, env = {}, version, data, state, runeHomeExists }) {
  if (!data || !data.version || data.version !== version) return false;
  if (!isTTY || args.json || env.CI || env.RUNE_NO_WHATS_NEW) return false;
  if (QUIET_COMMANDS.has(command)) return false;
  if (state?.lastSeen) return state.lastSeen !== version;
  return Boolean(runeHomeExists); // used Rune before this version, but never recorded → an upgrade
}

/** Header line (with the changelog link) + up to `max` highlights. */
export function formatWhatsNew(data, { max = 3 } = {}) {
  const lines = [`  ✨ What's new in rune v${data.version} → ${data.url}`];
  for (const h of (data.highlights || []).slice(0, max)) lines.push(`     • ${h}`);
  return lines;
}

async function readState(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function writeState(home, version) {
  try {
    await mkdir(path.join(home, '.rune'), { recursive: true });
    await writeFile(statePath(home), `${JSON.stringify({ lastSeen: version, at: new Date().toISOString() })}\n`);
  } catch {
    // read-only HOME: printing again next time beats crashing now
  }
}

/**
 * Print the notice when due and record the version. Returns true when printed.
 * Silent first-ever runs still record the version so the next upgrade is noticed.
 */
export async function maybeShowWhatsNew({
  command,
  args = {},
  version,
  home = os.homedir(),
  isTTY = Boolean(process.stdout.isTTY),
  env = process.env,
  data = loadWhatsNewData(),
  log = console.log,
} = {}) {
  try {
    const runeHomeExists = existsSync(path.join(home, '.rune'));
    const state = await readState(statePath(home));
    const ctx = { command, args, isTTY, env, version, data, state, runeHomeExists };
    if (shouldShowWhatsNew(ctx)) {
      log('');
      for (const line of formatWhatsNew(data)) log(line);
      await writeState(home, version);
      return true;
    }
    const eligible = data?.version === version && isTTY && !args.json && !env.CI && !env.RUNE_NO_WHATS_NEW;
    if (eligible && !QUIET_COMMANDS.has(command) && !state?.lastSeen && !runeHomeExists)
      await writeState(home, version);
    return false;
  } catch {
    return false;
  }
}

/** `rune whats-new` — always prints (any stdout); `--json` prints the data. */
export function printWhatsNew({ args = {}, data = loadWhatsNewData(), log = console.log } = {}) {
  if (!data) {
    log('  No release notes bundled with this build. See https://rune-kit.github.io/rune/changelog.html');
    return 1;
  }
  if (args.json) {
    log(JSON.stringify(data, null, 2));
    return 0;
  }
  log('');
  log(`  Rune v${data.version}${data.date ? ` (${data.date})` : ''} — ${data.summary || ''}`.trimEnd());
  for (const h of data.highlights || []) log(`    • ${h}`);
  log(`  Full notes: ${data.url}`);
  log('');
  return 0;
}
