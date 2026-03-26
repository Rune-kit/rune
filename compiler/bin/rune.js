#!/usr/bin/env node

/**
 * Rune CLI
 *
 * Commands:
 *   rune init    — Interactive setup for a new project
 *   rune build   — Compile skills for the configured platform
 *   rune doctor  — Validate compiled output
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { getAdapter, listPlatforms } from '../adapters/index.js';
import { formatDoctorResults, runDoctor } from '../doctor.js';
import { buildAll } from '../emitter.js';

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
  if (existsSync(path.join(projectRoot, '.agent'))) return 'antigravity';
  if (existsSync(path.join(projectRoot, '.openclaw'))) return 'openclaw';
  if (existsSync(path.join(projectRoot, '.codex'))) return 'codex';
  if (existsSync(path.join(projectRoot, '.agents'))) return 'agents';
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
  const stats = await buildAll({
    runeRoot: RUNE_ROOT,
    outputRoot: projectRoot,
    adapter,
    disabledSkills: config.skills.disabled,
    enabledPacks: config.extensions.enabled,
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
  log('    3. /rune help          See all 58 skills');
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

  log('');
  log(`  [parse]     Discovering skills...`);

  const stats = await buildAll({
    runeRoot,
    outputRoot,
    adapter,
    disabledSkills,
    enabledPacks,
  });

  log(`  [transform] Platform: ${stats.platform}`);
  log(`  [transform] Resolved ${stats.crossRefsResolved} cross-references`);
  log(`  [transform] Resolved ${stats.toolRefsResolved} tool-name references`);
  log(`  [emit]      ${stats.skillCount} skills + ${stats.packCount} extensions`);

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

  if (!results.healthy) process.exit(1);
}

// ─── Arg Parsing ───

// Flags that require a string value (not boolean)
const VALUE_REQUIRED_FLAGS = new Set(['platform', 'output', 'disable', 'extensions']);

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

  return { command: positional[0], args };
}

// ─── Main ───

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
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
      log('    doctor   Validate compiled output');
      log('');
      log('  Options:');
      log(
        '    --platform <name>   Override platform (cursor, windsurf, antigravity, codex, agents, openclaw, opencode, generic)',
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
