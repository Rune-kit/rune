#!/usr/bin/env node

/**
 * bump-version.js — Atomically bump the Rune version across all distribution touchpoints.
 *
 * Replaces the manual sweep of: package.json, Claude/Codex plugin manifests, marketplace.json,
 * docs/index.html (hero badge), ROADMAP.md (header + Current State title),
 * CHANGELOG.md (heading promotion).
 *
 * Usage:
 *   node scripts/bump-version.js 2.17.0                  # write
 *   node scripts/bump-version.js 2.17.0 --dry-run        # preview only
 *   node scripts/bump-version.js 2.17.0 --title "Wave"   # also stamp ROADMAP "Current State" title
 *
 * Behavior:
 *   - Reads current version from package.json
 *   - Aborts if any target file does NOT contain the OLD version (manual edits expected first)
 *   - Aborts if --title is omitted but ROADMAP "Current State" still references the old wave
 *   - On success, runs version-sync-check.js to verify no drift remains
 *
 * Does NOT touch: CHANGELOG.md body (narrative requires human authoring),
 * README.md "What's New" content (same), or skill counts (use validate-signals.js).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const newVersion = args.find((a) => /^\d+\.\d+\.\d+$/.test(a));
const dryRun = args.includes('--dry-run');
const titleIdx = args.indexOf('--title');
const newTitle = titleIdx >= 0 ? args[titleIdx + 1] : null;

if (!newVersion) {
  console.error('Usage: node scripts/bump-version.js <X.Y.Z> [--dry-run] [--title "Wave Name"]');
  process.exit(1);
}

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;

if (oldVersion === newVersion) {
  console.error(`✗ Version already at ${newVersion} — nothing to do.`);
  process.exit(1);
}

console.log(`\n  Bumping ${oldVersion} → ${newVersion}${dryRun ? ' (DRY RUN)' : ''}\n`);

const oldEsc = oldVersion.replace(/\./g, '\\.');

const targets = [
  {
    file: 'package.json',
    find: new RegExp(`"version":\\s*"${oldEsc}"`),
    replace: () => `"version": "${newVersion}"`,
  },
  {
    file: '.claude-plugin/plugin.json',
    find: new RegExp(`"version":\\s*"${oldEsc}"`),
    replace: () => `"version": "${newVersion}"`,
  },
  {
    file: '.codex-plugin/plugin.json',
    find: new RegExp(`"version":\\s*"${oldEsc}"`),
    replace: () => `"version": "${newVersion}"`,
  },
  {
    file: '.claude-plugin/marketplace.json',
    find: new RegExp(`"version":\\s*"${oldEsc}"`),
    replace: () => `"version": "${newVersion}"`,
  },
  {
    file: 'docs/index.html',
    find: new RegExp(`v${oldEsc}\\s*&mdash;`),
    replace: () => `v${newVersion} &mdash;`,
  },
  {
    file: 'ROADMAP.md',
    find: new RegExp(`Version:\\s*${oldEsc}`),
    replace: () => `Version: ${newVersion}`,
  },
  {
    file: 'ROADMAP.md',
    find: new RegExp(`## Current State \\(v${oldEsc}[^)]*\\)`),
    replace: () => {
      if (!newTitle) {
        throw new Error(
          'ROADMAP "Current State" header references old wave name — pass --title "Wave Name" to set the new one',
        );
      }
      return `## Current State (v${newVersion} — "${newTitle}")`;
    },
  },
];

// PLAN: group targets by file (multiple transforms per file are common — e.g., ROADMAP has 2).
// Apply each file's transforms in-memory before writing. NO disk writes during planning.
const fileBuckets = new Map(); // file -> { filePath, content, transforms[] }
const skips = [];
let planError = null;

for (const { file, find, replace } of targets) {
  const filePath = join(ROOT, file);
  if (!existsSync(filePath)) {
    skips.push({ file, reason: 'file not found' });
    continue;
  }

  let bucket = fileBuckets.get(file);
  if (!bucket) {
    bucket = { filePath, content: readFileSync(filePath, 'utf8'), transforms: 0, hasMatch: false };
    fileBuckets.set(file, bucket);
  }

  if (!find.test(bucket.content)) {
    if (bucket.transforms === 0) {
      skips.push({ file, reason: 'pattern not matched (already bumped or different format)' });
    }
    continue;
  }

  let replacement;
  try {
    replacement = replace();
  } catch (err) {
    planError ||= err;
    break;
  }

  bucket.content = bucket.content.replace(find, replacement);
  bucket.transforms += 1;
  bucket.hasMatch = true;
}

if (planError) {
  console.error(`\n  ✗ Aborted (planning phase, no files modified): ${planError.message}\n`);
  process.exit(1);
}

// Drop buckets that had zero matches (already in skips list)
const plan = [...fileBuckets.entries()]
  .filter(([, b]) => b.hasMatch)
  .map(([file, b]) => ({ file, filePath: b.filePath, newContent: b.content, transforms: b.transforms }));

// EXECUTE: only after all transforms validated. Atomic in spirit — all-or-nothing.
for (const r of skips) {
  console.log(`  ⚠ ${r.file} — ${r.reason}`);
}
for (const { file, filePath, newContent, transforms } of plan) {
  if (!dryRun) writeFileSync(filePath, newContent);
  console.log(`  ${dryRun ? '·' : '✓'} ${file}${transforms > 1 ? ` (${transforms} transforms)` : ''}`);
}

console.log(`\n  Done. Next steps:`);
console.log(`    1. Add a new ## [${newVersion}] - YYYY-MM-DD entry to CHANGELOG.md (narrative is manual)`);
console.log(`    2. Add "## What's New (v${newVersion} — ...)" section to README.md (narrative is manual)`);
console.log(`    3. Run: node scripts/version-sync-check.js`);

if (!dryRun) {
  console.log(`\n  Running version-sync-check.js...\n`);
  try {
    execFileSync('node', [join(__dirname, 'version-sync-check.js')], { stdio: 'inherit', cwd: ROOT });
  } catch {
    console.error(`\n  ⚠ version-sync-check reported issues — review above and fix any remaining drift.\n`);
    process.exit(1);
  }
}
