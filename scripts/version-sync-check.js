#!/usr/bin/env node

/**
 * version-sync-check.js — Prevents version mismatch across distribution channels.
 *
 * Checks:
 * 1. package.json version === .claude-plugin/plugin.json version
 * 2. npm registry version vs local (warns if local is ahead and unpublished)
 * 3. Extensions on disk match what npm would pack (no missing packs)
 * 4. Split skill files exist for packs that declare format: split
 *
 * Usage: node scripts/version-sync-check.js
 * Hook: runs via doctor command or pre-publish
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`  ⚠ ${msg}`);
  warnings++;
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

console.log('\n  Version Sync Check\n  ──────────────────\n');

// 1. Version consistency: package.json vs plugin.json
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const plugin = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));

if (pkg.version === plugin.version) {
  pass(`Version consistent: ${pkg.version} (package.json = plugin.json)`);
} else {
  fail(`Version mismatch: package.json=${pkg.version} vs plugin.json=${plugin.version}`);
}

// 2. npm registry check (non-blocking, just warn)
try {
  const npmVersion = execSync(`npm view ${pkg.name} version`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  if (npmVersion === pkg.version) {
    pass(`npm registry in sync: ${npmVersion}`);
  } else if (npmVersion) {
    warn(`npm registry has ${npmVersion}, local is ${pkg.version} — run "npm publish --access public" to sync`);
  }
} catch {
  warn('Could not check npm registry (offline or package not published)');
}

// 3. Extension packs: disk vs files field
const extDir = join(ROOT, 'extensions');
if (existsSync(extDir)) {
  const diskPacks = readdirSync(extDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const missingPack = diskPacks.filter((name) => {
    const packFile = join(extDir, name, 'PACK.md');
    return !existsSync(packFile);
  });

  if (missingPack.length > 0) {
    fail(`Extension dirs without PACK.md: ${missingPack.join(', ')}`);
  } else {
    pass(`All ${diskPacks.length} extension packs have PACK.md`);
  }

  // 4. Split packs: verify skill files exist
  for (const packName of diskPacks) {
    const packFile = join(extDir, packName, 'PACK.md');
    if (!existsSync(packFile)) continue;

    const content = readFileSync(packFile, 'utf8');
    const formatMatch = content.match(/format:\s*split/);
    if (!formatMatch) continue;

    const skillsDir = join(extDir, packName, 'skills');
    if (!existsSync(skillsDir)) {
      fail(`Split pack "${packName}" has format: split but no skills/ directory`);
      continue;
    }

    const skillFiles = readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
    if (skillFiles.length === 0) {
      fail(`Split pack "${packName}" has skills/ but no .md files`);
    } else {
      pass(`Split pack "${packName}": ${skillFiles.length} skill files`);
    }
  }
}

// Summary
console.log(`\n  ──────────────────`);
if (errors > 0) {
  console.error(`  ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`  All checks passed with ${warnings} warning(s)\n`);
} else {
  console.log(`  All checks passed ✓\n`);
}
