/**
 * Doctor — Validates compiled output
 *
 * Checks: files exist, cross-references resolve, layer discipline, source freshness.
 * Mesh checks: reciprocal connections, version suggestions, required sections.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseOrgConfig, parsePack, parseTemplate } from './parser.js';

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

  // Check 8: Reference injection rule validation
  const injectionErrors = await checkInjectionRules(runeRoot, config);
  if (injectionErrors.length === 0) {
    results.checks.push({ name: 'Injection rules', status: 'pass' });
  } else {
    results.checks.push({
      name: 'Injection rules',
      status: 'warn',
      detail: `${injectionErrors.length} issues`,
    });
    results.warnings.push(...injectionErrors);
  }

  // Check 9: Template signal validation (Pro/Business packs)
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

  // Check 10: Org template validation (Business)
  const orgErrors = await checkOrgTemplates(runeRoot, config);
  if (orgErrors.length === 0) {
    results.checks.push({ name: 'Org templates', status: 'pass' });
  } else {
    results.checks.push({
      name: 'Org templates',
      status: 'warn',
      detail: `${orgErrors.length} issues`,
    });
    results.warnings.push(...orgErrors);
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
 * Check that inject.json rules reference existing files and valid skills.
 */
async function checkInjectionRules(runeRoot, _config) {
  const errors = [];
  const parentDir = path.resolve(runeRoot, '..');

  // Collect known skill names from Free core
  const knownSkills = new Set();
  const skillsDir = path.join(runeRoot, 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(path.join(skillsDir, entry.name, 'SKILL.md'))) {
        knownSkills.add(entry.name);
      }
    }
  }

  // Scan tier directories for inject.json files
  const tierDirs = [
    path.join(runeRoot, 'extensions'),
    path.join(parentDir, 'Pro', 'extensions'),
    path.join(parentDir, 'Business', 'extensions'),
  ];

  for (const extDir of tierDirs) {
    if (!existsSync(extDir)) continue;
    for (const packEntry of await readdir(extDir, { withFileTypes: true })) {
      if (!packEntry.isDirectory()) continue;
      const injectFile = path.join(extDir, packEntry.name, 'inject.json');
      if (!existsSync(injectFile)) continue;

      try {
        const raw = await readFile(injectFile, 'utf-8');
        const config = JSON.parse(raw);
        const packDir = path.join(extDir, packEntry.name);

        for (const rule of config.injections || []) {
          // Check target skill exists
          if (rule.skill && !knownSkills.has(rule.skill)) {
            errors.push(`${packEntry.name}/inject.json: target skill "${rule.skill}" not found in Free core`);
          }
          // Check reference file exists
          if (rule.ref) {
            const refPath = path.join(packDir, rule.ref);
            if (!existsSync(refPath)) {
              errors.push(`${packEntry.name}/inject.json: reference file "${rule.ref}" not found`);
            }
          }
        }
      } catch (e) {
        errors.push(`${packEntry.name}/inject.json: invalid JSON — ${e.message}`);
      }
    }
  }

  return errors;
}

/**
 * Check that template signal references exist in the skill ecosystem.
 * Scans templates/ in Pro/Business extension dirs (relative to runeRoot parent).
 */
async function checkTemplateSignals(runeRoot, _config) {
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
 * Validate org templates in Business tier.
 * Checks: valid frontmatter, required sections, policy structure.
 */
async function checkOrgTemplates(_runeRoot, config) {
  const errors = [];
  const tierSources = config.tierSources || {};
  if (!tierSources.business) return errors;

  const orgTemplatesDir = path.join(tierSources.business, 'org-templates');
  if (!existsSync(orgTemplatesDir)) return errors;

  let entries;
  try {
    entries = await readdir(orgTemplatesDir);
  } catch {
    return errors;
  }

  const mdFiles = entries.filter((f) => f.endsWith('.md'));
  if (mdFiles.length === 0) {
    errors.push('org-templates/: directory exists but contains no .md files');
    return errors;
  }

  const requiredSections = ['Teams', 'Roles', 'Policies', 'Governance Level'];

  for (const file of mdFiles) {
    const filePath = path.join(orgTemplatesDir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseOrgConfig(content, filePath);

      // Check required frontmatter
      if (!parsed.name) {
        errors.push(`org-templates/${file}: missing 'name' in frontmatter`);
      }
      if (!parsed.description) {
        errors.push(`org-templates/${file}: missing 'description' in frontmatter`);
      }

      // Check required sections exist
      for (const section of requiredSections) {
        const pattern = new RegExp(`## ${section}`);
        if (!pattern.test(content)) {
          errors.push(`org-templates/${file}: missing required section '## ${section}'`);
        }
      }

      // Check teams table has entries
      if (parsed.teams.length === 0) {
        errors.push(`org-templates/${file}: ## Teams table is empty`);
      }

      // Check roles table has entries
      if (parsed.roles.length === 0) {
        errors.push(`org-templates/${file}: ## Roles table is empty`);
      }

      // Check governance level is valid
      const validLevels = ['minimal', 'moderate', 'maximum'];
      if (!validLevels.includes(parsed.governanceLevel.level)) {
        errors.push(
          `org-templates/${file}: governance level '${parsed.governanceLevel.level}' not in [${validLevels.join(', ')}]`,
        );
      }
    } catch (err) {
      errors.push(`org-templates/${file}: parse error — ${err.message}`);
    }
  }

  return errors;
}

/**
 * Check mesh integrity: reciprocal connections, version suggestions, required sections
 *
 * @param {string} runeRoot - path to Rune source root
 * @returns {Promise<object>} mesh check results
 */
export async function checkMeshIntegrity(runeRoot) {
  const results = {
    checks: [],
    warnings: [],
    errors: [],
    stats: { skills: 0, connections: 0, missingReciprocals: 0 },
  };

  const skillsDir = path.join(runeRoot, 'skills');
  if (!existsSync(skillsDir)) {
    results.errors.push('skills/ directory not found');
    return results;
  }

  // Step 1: Parse all skills
  const skills = new Map(); // name → { calls: [], calledBy: [], version, sections }
  const entries = await readdir(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const content = await readFile(skillFile, 'utf-8');
    const parsed = parseSkillConnections(content, entry.name);
    skills.set(entry.name, parsed);
  }

  results.stats.skills = skills.size;

  // Step 2: Validate reciprocals
  const missingReciprocals = [];

  for (const [name, skill] of skills) {
    for (const called of skill.calls) {
      const targetSkill = skills.get(called.skill);
      if (!targetSkill) continue; // External skill or L4 pack

      // Check if target acknowledges this caller
      const acknowledges = targetSkill.calledBy.some((c) => c.skill === name);
      if (!acknowledges) {
        missingReciprocals.push({
          caller: name,
          callee: called.skill,
          reason: called.reason,
        });
      }
    }
    results.stats.connections += skill.calls.length;
  }

  results.stats.missingReciprocals = missingReciprocals.length;

  if (missingReciprocals.length === 0) {
    results.checks.push({ name: 'Reciprocal connections', status: 'pass' });
  } else {
    results.checks.push({
      name: 'Reciprocal connections',
      status: 'warn',
      detail: `${missingReciprocals.length} missing`,
    });
    // Group by callee for cleaner output
    const byCallee = {};
    for (const m of missingReciprocals) {
      if (!byCallee[m.callee]) byCallee[m.callee] = [];
      byCallee[m.callee].push(m.caller);
    }
    for (const [callee, callers] of Object.entries(byCallee)) {
      results.warnings.push(`${callee}: missing callers in Called By: ${callers.join(', ')}`);
    }
  }

  // Step 3: Check version maturity
  const matureButLow = [];
  for (const [name, skill] of skills) {
    if (!skill.version) continue;
    const [major, minor] = skill.version.split('.').map(Number);
    // Suggest 1.0 if version is 0.8+ and has all required sections
    if (major === 0 && minor >= 8 && skill.hasAllSections) {
      matureButLow.push({ name, version: skill.version });
    }
  }

  if (matureButLow.length === 0) {
    results.checks.push({ name: 'Version maturity', status: 'pass' });
  } else {
    results.checks.push({
      name: 'Version maturity',
      status: 'warn',
      detail: `${matureButLow.length} skills ready for 1.0`,
    });
    for (const s of matureButLow) {
      results.warnings.push(`${s.name} v${s.version}: mature skill, consider promoting to 1.0`);
    }
  }

  // Step 4: Check required sections
  const requiredSections = ['Sharp Edges', 'Done When', 'Cost Profile'];
  const missingSections = [];

  for (const [name, skill] of skills) {
    const missing = requiredSections.filter((s) => !skill.sections.includes(s));
    if (missing.length > 0) {
      missingSections.push({ name, missing });
    }
  }

  if (missingSections.length === 0) {
    results.checks.push({ name: 'Required sections', status: 'pass' });
  } else {
    results.checks.push({
      name: 'Required sections',
      status: 'warn',
      detail: `${missingSections.length} skills incomplete`,
    });
    for (const s of missingSections) {
      results.warnings.push(`${s.name}: missing sections: ${s.missing.join(', ')}`);
    }
  }

  return results;
}

/**
 * Parse skill connections from SKILL.md content
 */
function parseSkillConnections(content, skillName) {
  const result = {
    name: skillName,
    calls: [],
    calledBy: [],
    version: null,
    sections: [],
    hasAllSections: false,
  };

  // Extract version from frontmatter
  const versionMatch = content.match(/version:\s*["']?([\d.]+)["']?/);
  if (versionMatch) {
    result.version = versionMatch[1];
  }

  // Extract Calls section
  const callsMatch = content.match(/## Calls \(outbound\)\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (callsMatch) {
    const lines = callsMatch[1].split('\n');
    for (const line of lines) {
      // Match patterns like: - `scout` (L2): scan codebase
      // Or: - scout (L2): scan codebase
      const match = line.match(/^-\s*`?([a-z][\w-]*)`?\s*\(L\d\)/i);
      if (match) {
        const skillRef = match[1].toLowerCase();
        const reason = line.replace(match[0], '').replace(/^[:\s-]+/, '').trim();
        result.calls.push({ skill: skillRef, reason });
      }
    }
  }

  // Extract Called By section
  const calledByMatch = content.match(/## Called By \(inbound\)\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (calledByMatch) {
    const lines = calledByMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^-\s*`?([a-z][\w-]*)`?\s*\(L\d\)/i);
      if (match) {
        const skillRef = match[1].toLowerCase();
        result.calledBy.push({ skill: skillRef });
      }
    }
  }

  // Check for required sections
  const sectionPatterns = [
    { name: 'Sharp Edges', pattern: /## Sharp Edges/ },
    { name: 'Done When', pattern: /## Done When/ },
    { name: 'Cost Profile', pattern: /## Cost Profile/ },
    { name: 'Returns', pattern: /## Returns/ },
  ];

  for (const { name, pattern } of sectionPatterns) {
    if (pattern.test(content)) {
      result.sections.push(name);
    }
  }

  result.hasAllSections = sectionPatterns.every(({ name }) => result.sections.includes(name));

  return result;
}

/**
 * Format mesh results for console output
 */
export function formatMeshResults(results) {
  const lines = [];
  lines.push(`\n  Mesh Integrity Check`);
  lines.push(`  Skills: ${results.stats.skills} | Connections: ${results.stats.connections}`);
  lines.push('');

  for (const check of results.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '✗';
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

  const healthy = results.errors.length === 0 && results.warnings.length === 0;
  lines.push('');
  lines.push(healthy ? '  ✓ Mesh is healthy' : `  ! Mesh has ${results.warnings.length} warnings`);

  return lines.join('\n');
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
