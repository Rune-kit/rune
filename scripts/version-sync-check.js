#!/usr/bin/env node

/**
 * version-sync-check.js — Prevents version mismatch across distribution channels.
 *
 * Checks:
 * 1. package.json version === Claude and Codex plugin manifest versions
 * 2. npm registry version vs local (warns if local is ahead and unpublished)
 * 3. Extensions on disk match what npm would pack (no missing packs)
 * 4. Split skill files exist for packs that declare format: split
 * 5. Public product facts match the live source inventory
 *
 * Usage: node scripts/version-sync-check.js
 * Hook: runs via doctor command or pre-publish
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPlatforms } from '../compiler/adapters/index.js';
import { collectStats } from '../compiler/status.js';

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

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

console.log('\n  Version Sync Check\n  ──────────────────\n');

// 1. Version consistency: package.json vs plugin.json
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const plugin = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));
const codexPlugin = JSON.parse(readFileSync(join(ROOT, '.codex-plugin/plugin.json'), 'utf8'));

if (pkg.version === plugin.version && pkg.version === codexPlugin.version) {
  pass(`Version consistent: ${pkg.version} (package.json = Claude plugin = Codex plugin)`);
} else {
  fail(
    `Version mismatch: package.json=${pkg.version}, Claude plugin=${plugin.version}, Codex plugin=${codexPlugin.version}`,
  );
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

// 1e. Public product facts: derive counts from the same compiler/status sources
// used by the CLI so landing-page and package claims cannot drift independently.
const liveStats = await collectStats(ROOT);
const platformCount = listPlatforms().length;
const publicFacts = [
  { path: 'README.md', value: `${liveStats.skillCount} skills`, label: 'core skill count' },
  { path: 'README.md', value: `${liveStats.totalConnections} connections`, label: 'mesh connection count' },
  { path: 'README.md', value: `${liveStats.signalCount} signals`, label: 'mesh signal count' },
  { path: 'README.md', value: `${platformCount} platforms`, label: 'platform count' },
  { path: 'docs/index.html', value: `$149`, label: 'Business price' },
  { path: 'docs/script.js', value: `baseIntl: 149`, label: 'Business checkout price' },
  { path: 'docs/index.html', value: `${platformCount} platforms`, label: 'landing platform count' },
  { path: 'package.json', value: `${liveStats.skillCount}-skill mesh`, label: 'package skill count' },
  { path: 'package.json', value: `${liveStats.totalConnections} connections`, label: 'package connection count' },
  { path: '.codex-plugin/plugin.json', value: `${liveStats.skillCount}-skill`, label: 'Codex plugin skill count' },
  { path: '.claude-plugin/plugin.json', value: `${liveStats.skillCount}-skill`, label: 'Claude plugin skill count' },
  {
    path: '.claude-plugin/marketplace.json',
    value: `${liveStats.totalConnections} connections`,
    label: 'marketplace connection count',
  },
];

for (const fact of publicFacts) {
  const content = readFileSync(join(ROOT, fact.path), 'utf8');
  if (content.includes(fact.value)) pass(`${fact.path}: ${fact.label} = ${fact.value}`);
  else fail(`${fact.path}: missing ${fact.label} "${fact.value}"`);
}

const forbiddenClaims = [
  { path: 'README.md', value: '209 connections' },
  { path: 'README.md', value: '205 connections' },
  { path: 'README.md', value: 'Platforms:         8' },
  { path: 'docs/index.html', value: '$169' },
  { path: 'docs/SKILLS.md', value: '@rune-business/' },
];
for (const claim of forbiddenClaims) {
  const content = readFileSync(join(ROOT, claim.path), 'utf8');
  if (content.includes(claim.value)) fail(`${claim.path}: stale public claim "${claim.value}"`);
  else pass(`${claim.path}: no stale "${claim.value}" claim`);
}

const schemaPath = join(ROOT, 'docs', 'config-schema.json');
if (!existsSync(schemaPath)) {
  fail('docs/config-schema.json: missing although public docs link to it');
} else {
  try {
    JSON.parse(readFileSync(schemaPath, 'utf8'));
    pass('docs/config-schema.json: valid JSON');
  } catch (error) {
    fail(`docs/config-schema.json: invalid JSON (${error.message})`);
  }
}

const hooksSchemaPath = join(ROOT, 'docs', 'schemas', 'hooks-manifest.v1.json');
if (!existsSync(hooksSchemaPath)) {
  fail('docs/schemas/hooks-manifest.v1.json: missing paid-tier manifest schema');
} else {
  try {
    JSON.parse(readFileSync(hooksSchemaPath, 'utf8'));
    pass('docs/schemas/hooks-manifest.v1.json: valid JSON');
  } catch (error) {
    fail(`docs/schemas/hooks-manifest.v1.json: invalid JSON (${error.message})`);
  }
}

const businessRoot = join(ROOT, '..', 'Business');
if (existsSync(businessRoot)) {
  const businessFiles = walkFiles(join(businessRoot, 'extensions'));
  const businessPackSkills = businessFiles.filter(
    (file) => /[\\/]skills[\\/][^\\/]+\.md$/i.test(file) && !file.endsWith('-evals.md'),
  ).length;
  const businessReferences = businessFiles.filter((file) => /[\\/]references[\\/].+\.md$/i.test(file)).length;
  const businessScripts = businessFiles.filter((file) => /[\\/]scripts[\\/].+\.py$/i.test(file)).length;
  const businessOrchestrators = readdirSync(join(businessRoot, 'skills'), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(join(businessRoot, 'skills', entry.name, 'SKILL.md')),
  ).length;
  const expectedBusiness = {
    packSkills: 28,
    references: 124,
    scripts: 12,
    orchestrators: 4,
  };
  const actualBusiness = {
    packSkills: businessPackSkills,
    references: businessReferences,
    scripts: businessScripts,
    orchestrators: businessOrchestrators,
  };
  for (const [key, expected] of Object.entries(expectedBusiness)) {
    if (actualBusiness[key] === expected) pass(`Business ${key}: ${expected}`);
    else fail(`Business ${key}: expected ${expected}, found ${actualBusiness[key]}`);
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
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  const marketplacePacks = marketplace.plugins
    .filter((entry) => typeof entry.source === 'string' && entry.source.startsWith('./extensions/'))
    .map((entry) => entry.source.replace('./extensions/', ''))
    .sort();

  const unpublishedPacks = diskPacks.filter((name) => !marketplacePacks.includes(name));
  if (unpublishedPacks.length > 0) {
    fail(`Extension packs missing from marketplace.json: ${unpublishedPacks.join(', ')}`);
  } else {
    pass(`marketplace.json exposes all ${diskPacks.length} Free extension packs`);
  }

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
