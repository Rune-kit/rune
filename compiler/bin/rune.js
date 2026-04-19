#!/usr/bin/env node

/**
 * Rune CLI
 *
 * Commands:
 *   rune init    — Interactive setup for a new project
 *   rune build   — Compile skills for the configured platform
 *   rune doctor  — Validate compiled output + mesh integrity (--mesh for mesh only)
 *   rune status  — Project dashboard (neofetch-style)
 *   rune visualize — Interactive mesh graph
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { getAdapter, listPlatforms } from '../adapters/index.js';
import { getAllAnalytics } from '../analytics.js';
import { dispatchHook } from '../commands/hook-dispatch.js';
import { installHooks } from '../commands/hooks/install.js';
import { hookStatus } from '../commands/hooks/status.js';
import { uninstallHooks } from '../commands/hooks/uninstall.js';
import { generateDashboardHTML } from '../dashboard.js';
import { checkMeshIntegrity, formatDoctorResults, formatMeshResults, runDoctor } from '../doctor.js';
import { buildAll } from '../emitter.js';
import { collectStats, renderStatus, renderStatusJson } from '../status.js';
import { collectGraphData, generateMeshHTML } from '../visualizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNE_ROOT = path.resolve(__dirname, '../..');

const CONFIG_FILE = 'rune.config.json';

// ─── Helpers ───

function log(msg) {
  console.log(msg);
}
function logStep(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function readConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (!existsSync(configPath)) return null;
  return JSON.parse(await readFile(configPath, 'utf-8'));
}

async function writeConfig(projectRoot, config) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

function detectPlatform(projectRoot) {
  if (existsSync(path.join(projectRoot, '.claude-plugin'))) return 'claude';
  if (existsSync(path.join(projectRoot, '.cursor'))) return 'cursor';
  if (existsSync(path.join(projectRoot, '.windsurf'))) return 'windsurf';
  if (existsSync(path.join(projectRoot, '.agents'))) return 'antigravity';
  if (existsSync(path.join(projectRoot, '.openclaw'))) return 'openclaw';
  if (existsSync(path.join(projectRoot, '.codex'))) return 'codex';
  if (existsSync(path.join(projectRoot, '.opencode'))) return 'opencode';
  return null;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Resolve tier source paths from config.
 * Paths can be absolute or relative to projectRoot.
 *
 * Config format:
 *   "tiers": { "pro": "../Pro/extensions", "business": "../Business/extensions" }
 *
 * @param {Object} tiers - tier config object
 * @param {string} projectRoot - base for relative paths
 * @returns {Object} resolved { pro?: string, business?: string }
 */
function resolveTierSources(tiers, projectRoot) {
  if (!tiers) return {};
  const resolved = {};
  for (const tier of ['pro', 'business']) {
    if (tiers[tier]) {
      resolved[tier] = path.resolve(projectRoot, tiers[tier]);
    }
  }
  return resolved;
}

// ─── Commands ───

async function cmdInit(projectRoot, args) {
  log('');
  log('  ╭──────────────────────────────────────────╮');
  log('  │  Rune — Less skills. Deeper connections.  │');
  log('  ╰──────────────────────────────────────────╯');
  log('');

  // Platform detection / selection
  let platform = args.platform || detectPlatform(projectRoot);

  if (platform) {
    logStep('→', `Detected: ${platform}`);
  } else {
    log(`  Available platforms: ${listPlatforms().join(', ')}`);
    const answer = await prompt('  ? Select platform: ');
    platform = answer.toLowerCase();
    if (!listPlatforms().includes(platform)) {
      platform = 'generic';
      logStep('→', `Unknown platform, using generic adapter`);
    }
  }

  if (platform === 'claude') {
    logStep('✓', 'Claude Code detected — Rune works as a native plugin. No compilation needed.');
    log('');
    return;
  }

  // Extension pack selection
  const extensions = args.extensions ? args.extensions.split(',') : null; // null = all

  // Build config
  const config = {
    $schema: 'https://rune-kit.github.io/rune/config-schema.json',
    version: 1,
    platform,
    source: '@rune-kit/rune',
    skills: {
      disabled: args.disable ? args.disable.split(',') : [],
    },
    extensions: {
      enabled: extensions,
    },
    output: {
      index: true,
    },
  };

  await writeConfig(projectRoot, config);
  logStep('✓', 'Created rune.config.json');

  // Auto-build
  const adapter = getAdapter(platform);
  const tierSources = resolveTierSources(config.tiers, projectRoot);
  const stats = await buildAll({
    runeRoot: RUNE_ROOT,
    outputRoot: projectRoot,
    adapter,
    disabledSkills: config.skills.disabled,
    enabledPacks: config.extensions.enabled,
    tierSources,
  });

  logStep('✓', `Built ${stats.skillCount} skills + ${stats.packCount} extensions to ${adapter.outputDir}/`);

  if (stats.errors.length > 0) {
    for (const err of stats.errors) {
      logStep('✗', `Error: ${err.file} — ${err.error}`);
    }
  }

  log('');
  log('  Next steps:');
  log('    1. /rune onboard       Generate project context (CLAUDE.md + .rune/)');
  log('    2. /rune cook "..."    Build a feature (full TDD cycle)');
  log('    3. /rune help          See all 62 skills');
  log('');
}

async function cmdBuild(projectRoot, args) {
  const config = await readConfig(projectRoot);

  const platform = args.platform || config?.platform;
  if (!platform) {
    log('  ✗ No platform configured. Run `rune init` first.');
    process.exit(1);
  }

  if (platform === 'claude') {
    log('  Claude Code uses source SKILL.md files directly. No compilation needed.');
    return;
  }

  const adapter = getAdapter(platform);
  const runeRoot = config?.source === '@rune-kit/rune' ? RUNE_ROOT : config?.source || RUNE_ROOT;
  const outputRoot = typeof args.output === 'string' ? args.output : projectRoot;
  const disabledSkills = config?.skills?.disabled || [];
  const enabledPacks = config?.extensions?.enabled || null;
  const tierSources = resolveTierSources(config?.tiers, projectRoot);

  log('');
  log(`  [parse]     Discovering skills...`);

  const stats = await buildAll({
    runeRoot,
    outputRoot,
    adapter,
    disabledSkills,
    enabledPacks,
    tierSources,
  });

  log(`  [transform] Platform: ${stats.platform}`);
  log(`  [transform] Resolved ${stats.crossRefsResolved} cross-references`);
  log(`  [transform] Resolved ${stats.toolRefsResolved} tool-name references`);
  log(`  [emit]      ${stats.skillCount} skills + ${stats.packCount} extensions`);

  if (stats.tierOverrides?.length > 0) {
    log(`  [tier]      ${stats.tierOverrides.length} pack(s) resolved from higher tiers:`);
    for (const override of stats.tierOverrides) {
      log(`              → ${override.pack} (${override.tier})`);
    }
  }

  if (stats.skipped.length > 0) {
    log(`  [skip]      ${stats.skipped.length} disabled: ${stats.skipped.join(', ')}`);
  }

  if (stats.errors.length > 0) {
    for (const err of stats.errors) {
      log(`  [error]     ${err.file}: ${err.error}`);
    }
  }

  log('');
  log(`  ✓ Built ${stats.files.length} files to ${adapter.outputDir}/`);
  log('');
}

async function cmdDoctor(projectRoot, args) {
  const config = await readConfig(projectRoot);

  // --mesh flag: run mesh integrity check only
  if (args.mesh) {
    log('');
    const meshResults = await checkMeshIntegrity(RUNE_ROOT);
    log(formatMeshResults(meshResults));
    if (meshResults.errors.length > 0) process.exit(1);
    // Exit with warning code if there are warnings (for CI awareness)
    if (args.strict && meshResults.warnings.length > 0) process.exit(1);
    return;
  }

  if (!config) {
    // No config = CI or fresh clone. Run source-only checks (split packs).
    log('');
    log('  ℹ No rune.config.json found — running source-only checks.');
    const results = await runDoctor({
      outputRoot: projectRoot,
      adapter: getAdapter('claude'),
      config: {},
      runeRoot: RUNE_ROOT,
    });
    log(formatDoctorResults(results));

    // Also run mesh check in source-only mode
    log('');
    const meshResults = await checkMeshIntegrity(RUNE_ROOT);
    log(formatMeshResults(meshResults));

    if (!results.healthy) process.exit(1);
    return;
  }

  const platform = args.platform || config.platform;
  const adapter = getAdapter(platform);
  const runeRoot = config.source === '@rune-kit/rune' ? RUNE_ROOT : config.source || RUNE_ROOT;

  const results = await runDoctor({
    outputRoot: projectRoot,
    adapter,
    config,
    runeRoot,
  });

  log(formatDoctorResults(results));

  // Also run mesh check
  log('');
  const meshResults = await checkMeshIntegrity(runeRoot);
  log(formatMeshResults(meshResults));

  if (!results.healthy) process.exit(1);
}

async function cmdStatus(projectRoot, args) {
  const config = await readConfig(projectRoot);
  const tierSources = resolveTierSources(config?.tiers, projectRoot);
  const runeRoot =
    config?.source === '@rune-kit/rune'
      ? RUNE_ROOT
      : config?.source
        ? path.resolve(projectRoot, config.source)
        : RUNE_ROOT;
  const platform = config?.platform || detectPlatform(projectRoot) || '';

  const pkg = JSON.parse(await readFile(path.join(RUNE_ROOT, 'package.json'), 'utf-8'));
  const projectName = path.basename(projectRoot);

  const stats = await collectStats(runeRoot, tierSources);

  if (args.json) {
    log(renderStatusJson(stats, { version: pkg.version, platform, projectName }));
  } else {
    log('');
    log(renderStatus(stats, { version: pkg.version, platform, projectName }));
    log('');
  }
}

async function cmdVisualize(projectRoot, args) {
  const config = await readConfig(projectRoot);
  const tierSources = resolveTierSources(config?.tiers, projectRoot);
  const runeRoot =
    config?.source === '@rune-kit/rune'
      ? RUNE_ROOT
      : config?.source
        ? path.resolve(projectRoot, config.source)
        : RUNE_ROOT;

  logStep('◎', 'Collecting mesh data...');
  const graphData = await collectGraphData(runeRoot, tierSources);

  logStep(
    '◎',
    `Found ${graphData.stats.nodeCount} nodes, ${graphData.stats.edgeCount} edges, ${graphData.stats.signalCount} signals`,
  );

  const html = generateMeshHTML(graphData);

  const runeDir = path.join(projectRoot, '.rune');
  if (!existsSync(runeDir)) {
    const { mkdir: mkdirFs } = await import('node:fs/promises');
    await mkdirFs(runeDir, { recursive: true });
  }

  const outputPath = args.output ? path.resolve(projectRoot, args.output) : path.join(runeDir, 'mesh.html');

  const { writeFile: writeFileFs } = await import('node:fs/promises');
  await writeFileFs(outputPath, html, 'utf-8');
  logStep('✓', `Mesh visualization written to ${path.relative(projectRoot, outputPath)}`);

  if (args.json) {
    log(JSON.stringify(graphData, null, 2));
  } else {
    // Try to open in browser
    try {
      const { exec } = await import('node:child_process');
      const cmd =
        process.platform === 'win32'
          ? `start "" "${outputPath}"`
          : process.platform === 'darwin'
            ? `open "${outputPath}"`
            : `xdg-open "${outputPath}"`;
      exec(cmd);
    } catch {
      /* ignore if browser open fails */
    }
  }
}

async function cmdAnalytics(projectRoot, args) {
  // Business tier gating
  const config = await readConfig(projectRoot);
  const businessPacks = ['business-finance', 'business-legal', 'business-hr', 'business-enterprise-search'];
  const hasBusiness =
    config?.tiers?.business || businessPacks.some((p) => existsSync(path.join(projectRoot, 'extensions', p)));
  if (!hasBusiness && !args.dev) {
    log('');
    log('  ⬢ Rune Analytics — Business tier exclusive');
    log('');
    log('  Analytics dashboard requires Rune Business ($169 lifetime).');
    log('  Includes: finance, legal, HR, enterprise-search packs + analytics.');
    log('');
    log('  Upgrade: https://github.com/sponsors/rune-kit');
    log('');
    return;
  }

  const days = args.days ? parseInt(args.days, 10) : 30;

  logStep('◎', `Querying metrics (${days > 0 ? `${days} days` : 'all time'})...`);
  const data = await getAllAnalytics(projectRoot, days);

  if (args.json) {
    log(JSON.stringify(data, null, 2));
    return;
  }

  logStep('◎', `${data.overview.total_sessions} sessions, ${data.overview.total_skill_invocations} skill invocations`);

  const html = generateDashboardHTML(data);

  const runeDir = path.join(projectRoot, '.rune');
  if (!existsSync(runeDir)) {
    const { mkdir: mkdirFs } = await import('node:fs/promises');
    await mkdirFs(runeDir, { recursive: true });
  }

  const outputPath = args.output ? path.resolve(projectRoot, args.output) : path.join(runeDir, 'analytics.html');

  const { writeFile: writeFileFs } = await import('node:fs/promises');
  await writeFileFs(outputPath, html, 'utf-8');
  logStep('✓', `Dashboard written to ${path.relative(projectRoot, outputPath)}`);

  // Open in browser
  try {
    const { exec } = await import('node:child_process');
    const cmd =
      process.platform === 'win32'
        ? `start "" "${outputPath}"`
        : process.platform === 'darwin'
          ? `open "${outputPath}"`
          : `xdg-open "${outputPath}"`;
    exec(cmd);
  } catch {
    /* ignore if browser open fails */
  }
}

// ─── Hook Commands ───

async function cmdHooks(projectRoot, args, subcommand) {
  if (!subcommand) {
    log('');
    log('  rune hooks — Auto-discipline entry point for AI IDEs');
    log('');
    log('  Subcommands:');
    log('    install [--preset strict|gentle|off] [--platform <name>|all] [--tier pro|business]');
    log('                                                                   Wire Rune hooks / rules / workflows');
    log(
      '    uninstall [--platform <name>|all]                              Remove Rune-managed entries (keeps user entries)',
    );
    log(
      '    status [--platform <name>|all] [--tier pro|business]          Show active preset, wired skills, tier coverage',
    );
    log('');
    log('  Platforms: claude, cursor, windsurf, antigravity (auto-detected if omitted)');
    log('  Tiers: pro, business — requires $RUNE_PRO_ROOT / $RUNE_BUSINESS_ROOT env var or monorepo sibling.');
    log('  Options:');
    log('    --dry    Preview changes without writing');
    log('    --tier <name>[,<name>]  Overlay tier manifest(s) — pass multiple tiers comma-separated.');
    log('');
    return;
  }

  switch (subcommand) {
    case 'install': {
      const tierArg = parseTierFlag(args.tier);
      const result = await installHooks(projectRoot, {
        preset: args.preset,
        dry: args.dry,
        platform: args.platform,
        tier: tierArg,
      });
      log('');
      if (result.platforms.length === 0) {
        for (const note of result.notes) logStep('·', note);
        log('');
        break;
      }
      const tierSuffix = result.tiers?.length ? ` + tier(s): ${result.tiers.join(', ')}` : '';
      if (result.written) {
        logStep('✓', `Installed preset "${result.preset}"${tierSuffix} across: ${result.platforms.join(', ')}`);
      } else if (args.dry) {
        logStep('◎', `Dry-run — no changes written (platforms: ${result.platforms.join(', ')}${tierSuffix})`);
      }
      for (const r of result.results) {
        log('');
        log(`  [${r.platform}]`);
        for (const file of r.files) {
          const rel = path.relative(projectRoot, file.path);
          logStep(file.deleted ? '−' : '→', rel);
        }
        for (const note of r.notes) logStep('·', note);
      }
      log('');
      break;
    }
    case 'uninstall': {
      const result = await uninstallHooks(projectRoot, { dry: args.dry, platform: args.platform });
      log('');
      if (result.platforms.length === 0) {
        for (const note of result.notes) logStep('·', note);
        log('');
        break;
      }
      if (result.written) {
        logStep('✓', `Uninstalled Rune entries across: ${result.platforms.join(', ')}`);
      } else if (args.dry) {
        logStep('◎', `Dry-run — would uninstall across: ${result.platforms.join(', ')}`);
      }
      for (const r of result.results) {
        log('');
        log(`  [${r.platform}]`);
        for (const file of r.files) {
          const rel = path.relative(projectRoot, file.path);
          logStep(file.deleted ? '−' : '→', rel);
        }
        for (const note of r.notes) logStep('·', note);
      }
      log('');
      break;
    }
    case 'status': {
      const tierArg = parseTierFlag(args.tier);
      const result = await hookStatus(projectRoot, RUNE_ROOT, { platform: args.platform, tier: tierArg });
      log('');
      if (result.platforms.length === 0) {
        for (const note of result.notes) logStep('·', note);
        log('');
        break;
      }
      for (const r of result.results) {
        log(`  [${r.platform}]${r.capability ? ` (${r.capability.maturity})` : ''}`);
        log(`    installed: ${r.installed ? 'yes' : 'no'}`);
        log(`    preset:    ${r.preset ?? 'none'}`);
        if (r.wired.length > 0) log(`    wired:     ${r.wired.join(', ')}`);
        if (r.missing.length > 0) logStep('⚠', `missing: ${r.missing.join(', ')}`);
        if (r.events) {
          for (const [event, skills] of Object.entries(r.events)) {
            log(`    ${event}: ${skills.join(', ')}`);
          }
        }
        for (const note of r.notes) logStep('·', note);
        log('');
      }
      if (result.tiers && result.tiers.length > 0) {
        log('  Tiers:');
        for (const t of result.tiers) {
          if (!t.found) {
            logStep('⚠', `${t.tier}: manifest not found${t.error ? ` (${t.error})` : ''}`);
          } else {
            const req = t.requiresOk ? 'env OK' : `missing env: ${t.requiresMissing.join(', ')}`;
            logStep('·', `${t.tier} v${t.version} — ${t.entries} entries — ${req}`);
          }
        }
        log('');
      }
      if (result.missingInRepo.length > 0) {
        logStep('⚠', `Skills referenced by presets but not found in repo: ${result.missingInRepo.join(', ')}`);
        log('');
      }
      break;
    }
    default:
      log(`  ✗ Unknown hooks subcommand: ${subcommand}. Run \`rune hooks\` for help.`);
      process.exit(1);
  }
}

// ─── Arg Parsing ───

// Flags that require a string value (not boolean)
const VALUE_REQUIRED_FLAGS = new Set(['platform', 'output', 'disable', 'extensions', 'days', 'preset', 'tier']);

function parseTierFlag(raw) {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw
      .flatMap((v) => String(v).split(','))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else if (VALUE_REQUIRED_FLAGS.has(key)) {
        log(`  ✗ Flag --${key} requires a value. Example: --${key} <value>`);
        process.exit(1);
      } else {
        args[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0], subcommand: positional[1], args, positional };
}

// ─── Main ───

async function main() {
  const rawArgv = process.argv.slice(2);

  // hook-dispatch bypasses parseArgs so flags like --gentle reach the dispatcher verbatim
  if (rawArgv[0] === 'hook-dispatch') {
    const exitCode = await dispatchHook(rawArgv.slice(1));
    process.exit(exitCode);
  }

  const { command, subcommand, args } = parseArgs(rawArgv);
  const projectRoot = process.cwd();

  // Handle --version / -v as flag (not positional command)
  if (args.version || args.v) {
    const pkg = JSON.parse(await readFile(path.join(RUNE_ROOT, 'package.json'), 'utf-8'));
    log(`  rune v${pkg.version}`);
    return;
  }

  switch (command) {
    case 'init':
      await cmdInit(projectRoot, args);
      break;
    case 'build':
      await cmdBuild(projectRoot, args);
      break;
    case 'doctor':
      await cmdDoctor(projectRoot, args);
      break;
    case 'status':
      await cmdStatus(projectRoot, args);
      break;
    case 'visualize':
    case 'viz':
      await cmdVisualize(projectRoot, args);
      break;
    case 'analytics':
    case 'dash':
      await cmdAnalytics(projectRoot, args);
      break;
    case 'hooks':
      await cmdHooks(projectRoot, args, subcommand);
      break;
    case 'version':
    case '--version':
    case '-v': {
      const pkg = JSON.parse(await readFile(path.join(RUNE_ROOT, 'package.json'), 'utf-8'));
      log(`  rune v${pkg.version}`);
      break;
    }
    case 'help':
    case '--help':
    case undefined:
      log('');
      log('  Rune CLI — Skill mesh for AI coding assistants');
      log('');
      log('  Commands:');
      log('    init     Interactive setup (auto-detects platform)');
      log('    build    Compile skills for configured platform');
      log('    doctor   Validate compiled output + mesh integrity');
      log('             --mesh   Mesh integrity only (reciprocals, versions, sections)');
      log('             --strict Fail on warnings (for CI)');
      log('    status   Project dashboard (skills, signals, packs, health)');
      log('    visualize  Interactive mesh graph (opens in browser)');
      log('    analytics  Usage analytics dashboard (Business tier)');
      log('    hooks      Install/uninstall/status for multi-platform auto-discipline');
      log(
        '               hooks install [--preset gentle|strict|off] [--platform claude|cursor|windsurf|antigravity|all]',
      );
      log('               hooks uninstall [--platform <name>|all]');
      log('               hooks status [--platform <name>|all]');
      log('');
      log('  Options:');
      log(
        '    --platform <name>   Override platform (cursor, windsurf, antigravity, codex, openclaw, opencode, generic)',
      );
      log('    --output <dir>      Override output directory');
      log('    --disable <skills>  Comma-separated skills to disable');
      log('    --version, -v       Show version');
      log('');
      break;
    default:
      log(`  ✗ Unknown command: ${command}. Run \`rune help\` for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('  ✗ Fatal:', err.message);
  process.exit(1);
});
