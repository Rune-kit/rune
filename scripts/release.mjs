#!/usr/bin/env node
/**
 * release.mjs — the repeatable part of a Rune release, as one script.
 *
 *   npm run release -- 2.34.1 [--title "Wave"] [--date YYYY-MM-DD] [--no-branch] [--no-ci] [--pr]
 *     1. checks CHANGELOG.md has a non-empty `## [Unreleased]` section
 *     2. creates `release/v<version>` (unless --no-branch)
 *     3. renames `## [Unreleased]` → `## [<version>] - <date>`
 *     4. README "What's New (v<old> — T)" → "(v<version> — T)" with a one-line summary
 *     5. scripts/bump-version.js <version> --title <T> (every synced manifest + version-sync-check)
 *     6. npm run ci, then commits "chore(release): <version>" (--pr also pushes and opens the PR)
 *
 *   npm run release:publish [-- --dry-run]
 *     1. on master, clean tree, HEAD == origin/master, tag v<version> free, version not on npm
 *     2. npm publish --dry-run — refuses on ANY `npm warn` line
 *     3. (not with --dry-run) npm publish --access public --auth-type=web  (2FA in the browser)
 *     4. waits until the registry serves the version
 *     5. git tag v<version> + push, gh release create with the CHANGELOG section as notes
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_NAME = '@rune-kit/rune';
const SEMVER = /^\d+\.\d+\.\d+$/;

// ─── pure helpers (tested in scripts/__tests__/release.test.js) ───

/** Body of the `## [Unreleased]` section, or null when there is none. */
export function unreleasedBody(changelog) {
  const m = changelog.match(/^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## \[|(?![\s\S]))/m);
  return m ? m[1].trim() : null;
}

/** Rename `## [Unreleased]` to `## [version] - date`. Throws if missing or empty. */
export function promoteChangelog(changelog, version, date) {
  const body = unreleasedBody(changelog);
  if (body === null) throw new Error('CHANGELOG.md has no "## [Unreleased]" section — write the notes there first');
  if (!body) throw new Error('CHANGELOG.md "## [Unreleased]" section is empty');
  if (new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(changelog))
    throw new Error(`CHANGELOG.md already has a ${version} section`);
  return changelog.replace(/^## \[Unreleased\][^\n]*$/m, `## [${version}] - ${date}`);
}

/** Notes for one released version (its CHANGELOG section without the heading). */
export function releaseNotes(changelog, version) {
  const esc = version.replace(/\./g, '\\.');
  const m = changelog.match(new RegExp(`^## \\[${esc}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm'));
  if (!m) throw new Error(`CHANGELOG.md has no ## [${version}] section`);
  return m[1].trim();
}

/** First prose line of a CHANGELOG section — used as the README one-liner. */
export function summaryLine(body) {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line && !line.startsWith('#')) return line.replace(/^[-*]\s+/, '');
  }
  return '';
}

/** README "What's New" heading → new version, with a dated summary quote under it. */
export function updateReadme(readme, { from, to, date, summary }) {
  const esc = from.replace(/\./g, '\\.');
  const re = new RegExp(`^## What's New \\(v${esc}( — [^)]*)?\\)$`, 'm');
  const m = readme.match(re);
  if (!m) throw new Error(`README.md has no "## What's New (v${from} …)" heading`);
  const title = m[1] || '';
  const note = summary ? `\n\n> **v${to} (${date}):** ${summary}` : '';
  return readme.replace(re, `## What's New (v${to}${title})${note}`);
}

/** Current wave title from ROADMAP "## Current State (vX — "Title")". */
export function currentTitle(roadmap) {
  const m = roadmap.match(/^## Current State \(v[\d.]+ — "([^"]+)"\)/m);
  return m ? m[1] : null;
}

/** Lines npm printed as warnings (npm 9–11: `npm warn …` / `npm WARN …`). */
export function npmWarnings(output) {
  return output.split('\n').filter((l) => /^npm warn/i.test(l.trim()));
}

export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─── shell helpers ───

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.status})`);
}
const read = (f) => readFileSync(join(ROOT, f), 'utf-8');
const write = (f, s) => writeFileSync(join(ROOT, f), s);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const flag = (argv, name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── release (prepare) ───

export function prepare(argv) {
  const version = argv.find((a) => SEMVER.test(a));
  if (!version) throw new Error('Usage: npm run release -- <X.Y.Z> [--title "Wave"] [--date YYYY-MM-DD] [--pr]');
  const old = JSON.parse(read('package.json')).version;
  if (old === version) throw new Error(`package.json is already ${version}`);
  const date = flag(argv, '--date') || localDate();
  const title = flag(argv, '--title') || currentTitle(read('ROADMAP.md'));
  if (!title) throw new Error('Could not read the wave title from ROADMAP.md — pass --title "Wave"');
  if (sh('git', ['status', '--porcelain'])) throw new Error('Working tree is not clean — commit or stash first');

  const changelog = read('CHANGELOG.md');
  const promoted = promoteChangelog(changelog, version, date); // validates before any write
  const summary = summaryLine(unreleasedBody(changelog));

  if (!argv.includes('--no-branch')) {
    sh('git', ['checkout', '-b', `release/v${version}`]);
    console.log(`  ✓ branch release/v${version}`);
  }
  write('CHANGELOG.md', promoted);
  console.log(`  ✓ CHANGELOG.md: [Unreleased] → [${version}] - ${date}`);
  write('README.md', updateReadme(read('README.md'), { from: old, to: version, date, summary }));
  console.log(`  ✓ README.md: What's New (v${version} — ${title})`);
  const claude = read('CLAUDE.md');
  const releaseLine = new RegExp(`Current release \\*\\*v${old.replace(/\./g, '\\.')}\\b`);
  if (releaseLine.test(claude)) {
    write('CLAUDE.md', claude.replace(releaseLine, `Current release **v${version}`));
    console.log(`  ✓ CLAUDE.md: current release v${version}`);
  }
  run(process.execPath, [join(ROOT, 'scripts', 'bump-version.js'), version, '--title', title]);
  if (!argv.includes('--no-ci')) run(npm, ['run', 'ci']);
  sh('git', ['add', '-A']);
  sh('git', ['commit', '-m', `chore(release): ${version}`]);
  console.log(`\n  ✓ committed chore(release): ${version}`);
  if (argv.includes('--pr')) {
    run('git', ['push', '-u', 'origin', `release/v${version}`]);
    run('gh', [
      'pr',
      'create',
      '--base',
      'master',
      '--head',
      `release/v${version}`,
      '--title',
      `chore(release): ${version}`,
      '--body',
      releaseNotes(read('CHANGELOG.md'), version),
    ]);
  } else {
    console.log(`  Next: git push -u origin release/v${version} && gh pr create --fill   (or re-run with --pr)`);
  }
  console.log('  After merge: git checkout master && git pull && npm run release:publish');
}

// ─── release:publish ───

export async function publish(argv) {
  const dry = argv.includes('--dry-run');
  const version = JSON.parse(read('package.json')).version;
  const tag = `v${version}`;
  console.log(`\n  Publishing ${PKG_NAME}@${version}${dry ? ' (DRY RUN — stops before npm publish)' : ''}\n`);

  sh('git', ['fetch', '--quiet', '--tags', 'origin']);
  const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'master') throw new Error(`On "${branch}" — publish only from master`);
  if (sh('git', ['status', '--porcelain'])) throw new Error('Working tree is not clean');
  const head = sh('git', ['rev-parse', 'HEAD']);
  const remote = sh('git', ['rev-parse', 'origin/master']);
  if (head !== remote)
    throw new Error(`HEAD ${head.slice(0, 7)} != origin/master ${remote.slice(0, 7)} — pull/push first`);
  console.log(`  ✓ clean master == origin/master (${head.slice(0, 7)})`);
  if (sh('git', ['tag', '--list', tag])) throw new Error(`Tag ${tag} already exists`);
  const notes = releaseNotes(read('CHANGELOG.md'), version);
  const onNpm = spawnSync(npm, ['view', `${PKG_NAME}@${version}`, 'version'], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  if (onNpm.status === 0 && onNpm.stdout.trim() === version) throw new Error(`${version} is already on npm`);
  console.log(`  ✓ tag ${tag} free, ${version} not on npm, CHANGELOG notes found`);

  const dr = spawnSync(npm, ['publish', '--dry-run', '--access', 'public'], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const output = `${dr.stdout}\n${dr.stderr}`;
  const warnings = npmWarnings(output);
  if (dr.status !== 0) throw new Error(`npm publish --dry-run failed:\n${output}`);
  if (warnings.length) throw new Error(`npm publish --dry-run printed warnings:\n${warnings.join('\n')}`);
  const size = output.match(/package size:\s*(.+)/i)?.[1] || '?';
  const files = output.match(/total files:\s*(\d+)/i)?.[1] || '?';
  console.log(`  ✓ npm publish --dry-run clean — 0 warnings, ${files} files, ${size}`);
  if (dry) {
    console.log('\n  Dry run done. Real publish: npm run release:publish');
    return;
  }

  run(npm, ['publish', '--access', 'public', '--auth-type=web']);
  for (let i = 0; i < 60; i++) {
    const v = spawnSync(npm, ['view', `${PKG_NAME}@${version}`, 'version'], {
      cwd: ROOT,
      encoding: 'utf-8',
      shell: process.platform === 'win32',
    });
    if (v.status === 0 && v.stdout.trim() === version) {
      console.log(`  ✓ registry serves ${PKG_NAME}@${version}`);
      break;
    }
    if (i === 59) throw new Error('Registry did not show the version after 5 minutes — tag/release skipped');
    await sleep(5000);
  }
  sh('git', ['tag', '-a', tag, '-m', `${tag}`]);
  run('git', ['push', 'origin', tag]);
  const notesFile = join(tmpdir(), `rune-${tag}-notes.md`);
  writeFileSync(notesFile, `${notes}\n`);
  run('gh', ['release', 'create', tag, '--title', tag, '--notes-file', notesFile, '--verify-tag']);
  console.log(`\n  ✓ Released ${tag}`);
}

// ─── main ───

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, ...argv] = process.argv.slice(2);
  try {
    if (mode === 'prepare') prepare(argv);
    else if (mode === 'publish') await publish(argv);
    else throw new Error('Usage: node scripts/release.mjs prepare <X.Y.Z> | publish [--dry-run]');
  } catch (err) {
    console.error(`\n  ✗ ${err.message}\n`);
    process.exit(1);
  }
}
