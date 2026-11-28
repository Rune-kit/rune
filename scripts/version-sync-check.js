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
 * 6. npm publish --dry-run --ignore-scripts does not auto-correct package.json
 *    or drop the rune bin (npm 11+ treats "./path" bin values as invalid)
 *
 * Usage: node scripts/version-sync-check.js
 * Hook: runs via doctor command or pre-publish
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPlatforms } from '../compiler/adapters/index.js';
import { collectStats } from '../compiler/status.js';
import { buildOutputs } from './site-gen.mjs';

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

// 1a. Cross-runtime manifests (v2.33 "Everywhere"): every manifest a runtime reads
// must advertise the same version, or marketplaces show stale builds.
const crossRuntimeManifests = [
  { path: 'plugin.json', label: 'Agent Plugins manifest', read: (j) => j.version },
  { path: '.cursor-plugin/plugin.json', label: 'Cursor plugin', read: (j) => j.version },
  { path: 'gemini-extension.json', label: 'Gemini CLI extension', read: (j) => j.version },
  {
    path: '.grok-plugin/marketplace.json',
    label: 'Grok marketplace',
    read: (j) => j.plugins?.find((p) => p.name === 'rune')?.version,
  },
];
for (const { path, label, read } of crossRuntimeManifests) {
  const filePath = join(ROOT, path);
  if (!existsSync(filePath)) continue;
  const found = read(JSON.parse(readFileSync(filePath, 'utf8')));
  if (found === pkg.version) pass(`${path}: v${found} (${label})`);
  else fail(`${path}: shows v${found}, expected v${pkg.version} (${label})`);
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
    { path: 'docs/skills/index.html', pattern: /stat-value">(\d+)<\/span>\s*<span class="stat-label">Total Skills/ },
    { path: 'docs/assets/mesh-diagram.html', pattern: /<b>(\d+)<\/b><span>skills<\/span>/ },
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
  {
    path: '.claude-plugin/marketplace.json',
    value: `${liveStats.skillCount} skills`,
    label: 'marketplace skill count',
  },
  {
    path: '.claude-plugin/marketplace.json',
    value: `${liveStats.signalCount} signals`,
    label: 'marketplace signal count',
  },
  {
    path: '.claude-plugin/plugin.json',
    value: `${liveStats.signalCount} signals`,
    label: 'Claude plugin signal count',
  },
  { path: 'plugin.json', value: `${liveStats.skillCount}-skill`, label: 'Agent Plugins skill count' },
  { path: '.cursor-plugin/plugin.json', value: `${liveStats.skillCount}-skill`, label: 'Cursor plugin skill count' },
  { path: 'gemini-extension.json', value: `${liveStats.skillCount}-skill`, label: 'Gemini extension skill count' },
];

for (const fact of publicFacts) {
  const content = readFileSync(join(ROOT, fact.path), 'utf8');
  if (content.includes(fact.value)) pass(`${fact.path}: ${fact.label} = ${fact.value}`);
  else fail(`${fact.path}: missing ${fact.label} "${fact.value}"`);
}

// 1f. Drift scanner — any public count claim in the plausible range for a
// product fact must equal the live value. Catches stale numbers the targeted
// patterns above miss (e.g. "66 skills" in a guide, "45 signals" in a footer).
// Historical design docs and the changelog are exempt by construction.
const DRIFT_FILES = [
  'README.md',
  'ROADMAP.md',
  'AGENTS.md',
  'llms.txt',
  'docs/llms.txt',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'package.json',
  'plugin.json',
  'gemini-extension.json',
  '.cursor-plugin/plugin.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.grok-plugin/marketplace.json',
  'docs/index.html',
  'docs/guides/index.html',
  'docs/skills/index.html',
  'docs/assets/mesh-diagram.html',
  'docs/guides/cli.md',
  'docs/GETTING_STARTED.md',
  'docs/SKILLS.md',
  'docs/SIGNALS.md',
  'docs/VISION.md',
  'docs/ARCHITECTURE.md',
  'compiler/transforms/branding.js',
  'compiler/adapters/openclaw.js',
];
const DRIFT_RULES = [
  {
    label: 'skills',
    re: /\b(\d{2})(?:-skill\b| (?:core |interconnected |connected )?skills\b)/gi,
    min: 60,
    max: 99,
    live: liveStats.skillCount,
  },
  { label: 'signals', re: /\b(\d{2}) (?:mesh |async )?signals\b/g, min: 40, max: 69, live: liveStats.signalCount },
  {
    label: 'connections',
    re: /\b(\d{3}) (?:mesh |sync )?connections\b/g,
    min: 200,
    max: 399,
    live: liveStats.totalConnections,
  },
  {
    label: 'platforms',
    re: /\b(\d{1,2})(?:-platform\b| (?:AI coding |coding |compile )?platforms\b)/g,
    min: 8,
    max: 40,
    live: platformCount,
  },
];
let driftHits = 0;
for (const rel of DRIFT_FILES) {
  const filePath = join(ROOT, rel);
  if (!existsSync(filePath)) continue;
  const content = readFileSync(filePath, 'utf8');
  for (const rule of DRIFT_RULES) {
    for (const m of content.matchAll(rule.re)) {
      const n = parseInt(m[1], 10);
      if (n < rule.min || n > rule.max || n === rule.live) continue;
      const line = content.slice(0, m.index).split('\n').length;
      fail(`${rel}:${line}: stale ${rule.label} count "${m[0]}" (live: ${rule.live})`);
      driftHits++;
    }
  }
}
if (driftHits === 0) pass(`No stale skill/signal/connection/platform counts in ${DRIFT_FILES.length} public files`);

// 1g. Generated site artifacts (scripts/site-gen.mjs) must be current: changelog page,
// What's-new chips, CLI notice data, mesh diagram counts, /skills/ badge + stats, Guide
// layer table. A hand edit or a forgotten regen fails here, not on the live site.
try {
  const outputs = await buildOutputs(ROOT);
  const stale = Object.entries(outputs)
    .filter(([rel, content]) => !existsSync(join(ROOT, rel)) || readFileSync(join(ROOT, rel), 'utf8') !== content)
    .map(([rel]) => rel);
  if (stale.length) fail(`generated files are stale — run \`node scripts/site-gen.mjs\`: ${stale.join(', ')}`);
  else pass(`site-gen: ${Object.keys(outputs).length} generated files up to date`);
} catch (err) {
  fail(`site-gen failed: ${err.message}`);
}
const skillsBadge = readFileSync(join(ROOT, 'docs/skills/index.html'), 'utf8').match(
  /v(\d+\.\d+\.\d+)<!-- \/rune:gen:version -->/,
)?.[1];
if (skillsBadge === pkg.version) pass(`docs/skills/index.html: badge v${skillsBadge}`);
else fail(`docs/skills/index.html: badge shows v${skillsBadge ?? '?'}, expected v${pkg.version}`);

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

// 6. npm publish metadata: the 2.34.0 publish was aborted because npm 11
// auto-corrected package.json and dropped bin.rune ("./compiler/bin/rune.js"
// is an invalid script name). Catch that before a real publish.
{
  const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : { ...(pkg.bin || {}) };
  const binRel = bins.rune;
  if (!binRel) {
    fail('package.json is missing bin.rune — the published package would have no `rune` CLI');
  } else if (binRel.startsWith('./') || binRel.startsWith('.\\')) {
    fail(`package.json bin.rune is "${binRel}" — omit the ./ prefix; npm 11+ drops the bin as an invalid script name`);
  } else if (!existsSync(join(ROOT, binRel))) {
    fail(`package.json bin.rune points at missing file ${binRel}`);
  } else {
    pass(`package.json bin.rune is ${binRel}`);
    try {
      const indexed = execFileSync('git', ['ls-files', '-s', binRel], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (indexed) {
        const mode = indexed.split(/\s+/)[0];
        if (mode !== '100755') {
          fail(`git mode for ${binRel} is ${mode}, expected 100755 (executable)`);
        } else {
          pass(`${binRel} is executable in git (100755)`);
        }
      }
    } catch {
      warn(`Could not read git mode for ${binRel}`);
    }
  }

  const result = spawnSync('npm', ['publish', '--dry-run', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env },
  });
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const warningLines = combined
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => /auto-corrected|errors corrected|was invalid and removed|was normalized to/i.test(line));
  // After a release the registry already has this version, so npm refuses the dry run at the very
  // end — but it has packed the tarball and printed any auto-corrections by then. Judge those.
  const alreadyPublished = /cannot publish over the previously published versions?/i.test(combined);
  if (result.error) {
    fail(`npm publish --dry-run failed to start (${result.error.message})`);
  } else if (result.status !== 0 && !alreadyPublished) {
    const tail = combined.trim().split('\n').slice(-8).join('\n    ');
    fail(`npm publish --dry-run --ignore-scripts exited ${result.status}:\n    ${tail}`);
  } else if (warningLines.length > 0) {
    fail(
      `npm publish --dry-run auto-corrected package.json (the rune bin may be dropped). Run "npm pkg fix" and commit the result.\n    ${warningLines.join('\n    ')}`,
    );
  } else if (!bins.rune) {
    // already failed above; skip the tarball mention
  } else {
    pass(
      `npm publish --dry-run: no auto-corrections; bin.rune is present${alreadyPublished ? ` (v${pkg.version} is already on npm)` : ''}`,
    );
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
