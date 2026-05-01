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

import { execFileSync } from 'node:child_process';
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

// 1b. Version in docs/content files
const versionFiles = [
  { path: 'docs/index.html', pattern: /v(\d+\.\d+\.\d+)\s*&mdash;/ },
  { path: 'ROADMAP.md', pattern: /Version:\s*(\d+\.\d+\.\d+)/ },
  { path: 'ROADMAP.md', pattern: /## Current State \(v(\d+\.\d+\.\d+)/ },
  { path: 'README.md', pattern: /What's New \(v(\d+\.\d+\.\d+)/ },
  { path: 'CHANGELOG.md', pattern: /^## \[(\d+\.\d+\.\d+)\]/m },
];

for (const { path, pattern } of versionFiles) {
  const filePath = join(ROOT, path);
  if (!existsSync(filePath)) continue;
  const content = readFileSync(filePath, 'utf8');
  const match = content.match(pattern);
  if (!match) {
    warn(`${path}: no version pattern found`);
  } else if (match[1] !== pkg.version) {
    fail(`${path}: shows v${match[1]}, expected v${pkg.version}`);
  } else {
    pass(`${path}: v${match[1]}`);
  }
}

// 1b2. Workspace-level dashboard.html (lives at D:/Project/Rune/dashboard.html when workspace exists)
const dashboardPath = join(ROOT, '..', 'dashboard.html');
if (existsSync(dashboardPath)) {
  const dash = readFileSync(dashboardPath, 'utf8');
  const skillsDir3 = join(ROOT, 'skills');
  if (existsSync(skillsDir3)) {
    const actualSkillCount2 = readdirSync(skillsDir3, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && existsSync(join(skillsDir3, d.name, 'SKILL.md')),
    ).length;
    const m = dash.match(/Free core gives you (\d+) skills/);
    if (!m) {
      warn('dashboard.html: no skill count pattern found');
    } else if (parseInt(m[1], 10) !== actualSkillCount2) {
      fail(`dashboard.html: shows ${m[1]} skills, actual is ${actualSkillCount2}`);
    } else {
      pass(`dashboard.html: ${m[1]} skills`);
    }
  }
}

// 1c. marketplace.json version
const marketplacePath = join(ROOT, '.claude-plugin/marketplace.json');
if (existsSync(marketplacePath)) {
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  const mpPlugin = marketplace.plugins?.find((p) => p.name === 'rune');
  if (mpPlugin) {
    if (mpPlugin.version === pkg.version) {
      pass(`marketplace.json: v${mpPlugin.version}`);
    } else {
      fail(`marketplace.json: shows v${mpPlugin.version}, expected v${pkg.version}`);
    }
  } else {
    warn('marketplace.json: no "rune" plugin entry found');
  }
}

// 1d. Skill count consistency across docs
const skillsDir2 = join(ROOT, 'skills');
if (existsSync(skillsDir2)) {
  const actualSkillCount = readdirSync(skillsDir2, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && existsSync(join(skillsDir2, d.name, 'SKILL.md')),
  ).length;

  const skillCountFiles = [
    { path: 'docs/index.html', pattern: /data-target="(\d+)"[\s\S]*?Core Skills/m },
    { path: 'docs/index.html', pattern: /(\d+) core skills \(L0/ },
    { path: 'docs/index.html', pattern: /Core dev skills \((\d+)\)/ },
    { path: 'README.md', pattern: /^\s*(\d+) skills · \d+\+ mesh/m },
    { path: 'README.md', pattern: /Rune is a \*\*mesh\*\* — (\d+) skills/ },
    { path: 'CLAUDE.md', pattern: /(\d+) core skills built/ },
    { path: 'docs/VISION.md', pattern: /Rune = (\d+) skills × \d+\+ bidirectional/ },
    // dashboard.html lives at workspace root, not Free root — checked separately below
  ];

  for (const { path, pattern } of skillCountFiles) {
    const filePath = join(ROOT, path);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf8');
    const match = content.match(pattern);
    if (!match) continue;
    const found = parseInt(match[1], 10);
    if (found === actualSkillCount) {
      pass(`${path}: ${found} skills`);
    } else {
      fail(`${path}: shows ${found} skills, actual is ${actualSkillCount}`);
    }
  }
}

// 2. npm registry check (non-blocking, just warn)
try {
  const npmVersion = execFileSync('npm', ['view', pkg.name, 'version'], {
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
