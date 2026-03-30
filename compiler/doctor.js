/**
 * Doctor — Validates compiled output
 *
 * Checks: files exist, cross-references resolve, layer discipline, source freshness.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePack, parseTemplate } from './parser.js';

/**
 * Run doctor checks on compiled output
 *
 * @param {object} options
 * @param {string} options.outputRoot - project root
 * @param {object} options.adapter - platform adapter
 * @param {object} options.config - rune.config.json contents
 * @param {string} options.runeRoot - rune source root
 * @returns {Promise<object>} doctor results
 */
export async function runDoctor({ outputRoot, adapter, config, runeRoot }) {
  const results = {
    platform: adapter.name,
    checks: [],
    warnings: [],
    errors: [],
    healthy: true,
  };

  // Check 1: Config exists (skip in CI / source-only mode)
  const configPath = path.join(outputRoot, 'rune.config.json');
  if (existsSync(configPath)) {
    results.checks.push({ name: 'Config file', status: 'pass' });
  } else if (config && Object.keys(config).length > 0) {
    // Config was passed but file doesn't exist on disk — real problem
    results.checks.push({ name: 'Config file', status: 'fail', detail: 'rune.config.json not found' });
    results.errors.push('rune.config.json not found. Run `rune init` first.');
    results.healthy = false;
  } else {
    // No config at all (CI / fresh clone) — skip gracefully
    results.checks.push({ name: 'Config file', status: 'skip', detail: 'No config — source-only mode' });
  }

  // Check 2: Output directory exists
  if (adapter.name === 'claude') {
    results.checks.push({ name: 'Output directory', status: 'skip', detail: 'Claude Code uses source directly' });
    return results;
  }

  const outputDir = path.join(outputRoot, adapter.outputDir);
  if (existsSync(outputDir)) {
    results.checks.push({ name: 'Output directory', status: 'pass', detail: outputDir });
  } else {
    results.checks.push({ name: 'Output directory', status: 'fail', detail: `${outputDir} not found` });
    results.errors.push(`Output directory ${outputDir} not found. Run \`rune build\` first.`);
    results.healthy = false;
    return results;
  }

  // Check 3: Count skill files
  const files = await readdir(outputDir);
  const skillFiles = files.filter((f) => f.startsWith('rune-') && f !== `rune-index${adapter.fileExtension}`);

  // Dynamic expected count: scan source skills/ directory
  const sourceSkillsDir = path.join(runeRoot, 'skills');
  let sourceSkillCount = 0;
  if (existsSync(sourceSkillsDir)) {
    const entries = await readdir(sourceSkillsDir, { withFileTypes: true });
    sourceSkillCount = entries.filter(
      (e) => e.isDirectory() && existsSync(path.join(sourceSkillsDir, e.name, 'SKILL.md')),
    ).length;
  }
  const expectedSkillCount = sourceSkillCount - (config.skills?.disabled?.length || 0);

  if (skillFiles.length >= expectedSkillCount) {
    results.checks.push({ name: 'Skill files', status: 'pass', detail: `${skillFiles.length}/${expectedSkillCount}` });
  } else {
    results.checks.push({
      name: 'Skill files',
      status: 'warn',
      detail: `${skillFiles.length}/${expectedSkillCount} present`,
    });
    results.warnings.push(`Expected ${expectedSkillCount} skill files, found ${skillFiles.length}`);
  }

  // Check 4: Cross-reference integrity
  const crossRefErrors = await checkCrossRefs(outputDir, skillFiles, adapter);
  if (crossRefErrors.length === 0) {
    results.checks.push({ name: 'Cross-references', status: 'pass' });
  } else {
    results.checks.push({ name: 'Cross-references', status: 'warn', detail: `${crossRefErrors.length} dangling` });
    results.warnings.push(...crossRefErrors);
  }

  // Check 5: Index file exists
  const indexFile = `rune-index${adapter.fileExtension}`;
  if (files.includes(indexFile)) {
    results.checks.push({ name: 'Index file', status: 'pass' });
  } else {
    results.checks.push({ name: 'Index file', status: 'warn', detail: 'Missing index file' });
    results.warnings.push('Index file not found. Rebuild with `rune build`.');
  }

  // Check 6: Disabled skills warning
  const disabled = config.skills?.disabled || [];
  if (disabled.length > 0) {
    results.warnings.push(`${disabled.length} skills disabled: ${disabled.join(', ')}`);
  }

  // Check 7: Split pack integrity (validate skill manifest files exist)
  const extensionsDir = path.join(runeRoot, 'extensions');
  if (existsSync(extensionsDir)) {
    const splitPackErrors = await checkSplitPacks(extensionsDir);
    if (splitPackErrors.length === 0) {
      results.checks.push({ name: 'Split packs', status: 'pass' });
    } else {
      results.checks.push({
        name: 'Split packs',
        status: 'fail',
        detail: `${splitPackErrors.length} missing skill files`,
      });
      results.errors.push(...splitPackErrors);
    }
  }

  // Check 8: Template signal validation (Pro/Business packs)
  const templateErrors = await checkTemplateSignals(runeRoot, config);
  if (templateErrors.length === 0) {
    results.checks.push({ name: 'Template signals', status: 'pass' });
  } else {
    results.checks.push({
      name: 'Template signals',
      status: 'warn',
      detail: `${templateErrors.length} issues`,
    });
    results.warnings.push(...templateErrors);
  }

  if (results.errors.length > 0) results.healthy = false;

  return results;
}

/**
 * Check that all cross-references in compiled files point to existing files
 */
async function checkCrossRefs(outputDir, files, adapter) {
  const errors = [];
  const fileSet = new Set(files);

  for (const file of files) {
    const content = await readFile(path.join(outputDir, file), 'utf-8');

    // Look for references to other rune skills
    const refPattern = /rune-([a-z][\w-]*)/g;
    let match;
    while ((match = refPattern.exec(content)) !== null) {
      const refName = match[1];
      const expectedFile = `rune-${refName}${adapter.fileExtension}`;
      if (!fileSet.has(expectedFile) && refName !== 'index' && refName !== 'kit') {
        errors.push(`${file}: references rune-${refName} but ${expectedFile} not found`);
      }
    }
  }

  return [...new Set(errors)]; // deduplicate
}

/**
 * Check that all split packs have their declared skill files present
 */
async function checkSplitPacks(extensionsDir) {
  const errors = [];
  const entries = await readdir(extensionsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packFile = path.join(extensionsDir, entry.name, 'PACK.md');
    if (!existsSync(packFile)) continue;

    const content = await readFile(packFile, 'utf-8');
    const parsed = parsePack(content, packFile);

    if (!parsed.isSplit) continue;

    const packDir = path.dirname(packFile);
    for (const skill of parsed.skillManifest) {
      const skillPath = path.join(packDir, skill.file);
      if (!existsSync(skillPath)) {
        errors.push(`@rune/${entry.name}: skill file "${skill.file}" declared in manifest but not found`);
      }
    }
  }

  return errors;
}

/**
 * Check that template signal references exist in the skill ecosystem.
 * Scans templates/ in Pro/Business extension dirs (relative to runeRoot parent).
 */
async function checkTemplateSignals(runeRoot, config) {
  const errors = [];
  const parentDir = path.resolve(runeRoot, '..');

  // Collect all known signals from core + pack skills
  const knownSignals = new Set();
  const skillsDir = path.join(runeRoot, 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      const content = await readFile(skillFile, 'utf-8');
      for (const signal of extractFrontmatterSignals(content)) {
        knownSignals.add(signal);
      }
    }
  }

  // Scan tier extension dirs for signals + templates
  const tierDirs = [
    path.join(runeRoot, 'extensions'),
    path.join(parentDir, 'Pro', 'extensions'),
    path.join(parentDir, 'Business', 'extensions'),
  ];

  const templateFiles = [];

  for (const extDir of tierDirs) {
    if (!existsSync(extDir)) continue;
    for (const packEntry of await readdir(extDir, { withFileTypes: true })) {
      if (!packEntry.isDirectory()) continue;
      const packDir = path.join(extDir, packEntry.name);

      // Collect signals from pack skills
      const packSkillsDir = path.join(packDir, 'skills');
      if (existsSync(packSkillsDir)) {
        for (const sf of await readdir(packSkillsDir)) {
          if (!sf.endsWith('.md')) continue;
          const content = await readFile(path.join(packSkillsDir, sf), 'utf-8');
          for (const signal of extractFrontmatterSignals(content)) {
            knownSignals.add(signal);
          }
        }
      }

      // Collect template files
      const templatesDir = path.join(packDir, 'templates');
      if (existsSync(templatesDir)) {
        for (const tf of await readdir(templatesDir)) {
          if (!tf.endsWith('.md')) continue;
          templateFiles.push(path.join(templatesDir, tf));
        }
      }
    }
  }

  // Validate each template's signals
  for (const templatePath of templateFiles) {
    const content = await readFile(templatePath, 'utf-8');
    const parsed = parseTemplate(content, templatePath);
    const templateName = parsed.name || path.basename(templatePath, '.md');

    for (const signal of parsed.signals.listen) {
      if (!knownSignals.has(signal)) {
        errors.push(`template "${templateName}": listens to "${signal}" but no skill emits it`);
      }
    }
  }

  return errors;
}

/**
 * Extract emit/listen signal names from a file's frontmatter
 */
function extractFrontmatterSignals(content) {
  const signals = [];
  const normalized = content.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return signals;

  const raw = fmMatch[1];
  for (const key of ['emit', 'listen']) {
    const match = raw.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
    if (match) {
      for (const s of match[1].split(',')) {
        const trimmed = s.trim();
        if (trimmed) signals.push(trimmed);
      }
    }
  }
  return signals;
}

/**
 * Format doctor results for console output
 */
export function formatDoctorResults(results) {
  const lines = [];
  lines.push(`\n  Platform: ${results.platform}`);

  for (const check of results.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : check.status === 'skip' ? '–' : '✗';
    const detail = check.detail ? ` (${check.detail})` : '';
    lines.push(`  [${icon}] ${check.name}${detail}`);
  }

  if (results.warnings.length > 0) {
    lines.push('');
    for (const w of results.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  if (results.errors.length > 0) {
    lines.push('');
    for (const e of results.errors) {
      lines.push(`  ✗ ${e}`);
    }
  }

  lines.push('');
  lines.push(results.healthy ? '  ✓ Rune installation healthy' : '  ✗ Rune installation has issues');

  return lines.join('\n');
}
