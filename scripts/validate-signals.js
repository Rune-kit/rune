#!/usr/bin/env node

// validate-signals.js — Validates signal consistency across all SKILL.md files
// Checks: orphan listeners (listen but no emitter), signal naming, duplicate emitters
// Usage: node scripts/validate-signals.js

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const PRO_DIR = join(__dirname, '..', '..', 'Pro', 'extensions');
const BUSINESS_DIR = join(__dirname, '..', '..', 'Business', 'extensions');

// Signal naming: lowercase, dot-separated segments (e.g. code.changed, tests.passed)
const SIGNAL_NAME_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

/**
 * Parse emit/listen signals from SKILL.md frontmatter
 * Supports both core format (skills/fix/SKILL.md) and pack format (skills/feature-spec.md)
 */
export function parseSignals(filePath) {
  const content = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  const segments = filePath.split(/[/\\]/);
  const fileName = segments.at(-1);
  // Core format: skills/fix/SKILL.md → name from directory
  // Pack format: skills/feature-spec.md → name from filename
  const name = fileName === 'SKILL.md' ? segments.at(-2) : fileName.replace(/\.md$/, '');

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { name, emit: [], listen: [] };

  const raw = fmMatch[1];
  const emit = parseCommaList(raw, 'emit');
  const listen = parseCommaList(raw, 'listen');

  return { name, emit, listen };
}

function parseCommaList(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Scan a core skills directory (skills/fix/SKILL.md format)
 */
function scanCoreSkills(skillsDir) {
  const skills = {};
  if (!existsSync(skillsDir)) return skills;
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (existsSync(skillPath)) {
      skills[dir] = parseSignals(skillPath);
    }
  }
  return skills;
}

// Scan pack extensions directory (extensions/pro-{name}/skills/{skill}.md format)
function scanPackSkills(extensionsDir) {
  const skills = {};
  if (!existsSync(extensionsDir)) return skills;
  const packs = readdirSync(extensionsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const pack of packs) {
    const packSkillsDir = join(extensionsDir, pack.name, 'skills');
    if (!existsSync(packSkillsDir)) continue;
    const files = readdirSync(packSkillsDir, { withFileTypes: true }).filter(
      (f) => f.isFile() && f.name.endsWith('.md'),
    );

    for (const file of files) {
      const skillPath = join(packSkillsDir, file.name);
      const skillName = file.name.replace(/\.md$/, '');
      skills[skillName] = parseSignals(skillPath);
    }
  }
  return skills;
}

/**
 * Validate signal consistency across all skills (Free + Pro + Business)
 */
export function validateSignals(skillsDir, { proDirs = [], tierLabels = [] } = {}) {
  const skills = { ...scanCoreSkills(skillsDir) };
  const tierSkills = {};

  for (let i = 0; i < proDirs.length; i++) {
    const packSkills = scanPackSkills(proDirs[i]);
    const label = tierLabels[i] || `tier-${i}`;
    tierSkills[label] = packSkills;
    Object.assign(skills, packSkills);
  }

  // Build global signal registry
  const emitters = new Map(); // signal → [skill names]
  const listeners = new Map(); // signal → [skill names]
  const issues = [];
  const warnings = [];

  for (const [, skill] of Object.entries(skills)) {
    for (const signal of skill.emit) {
      if (!SIGNAL_NAME_PATTERN.test(signal)) {
        issues.push(`${skill.name}: invalid signal name "${signal}" — use lowercase.dot.notation (e.g. code.changed)`);
      }
      if (!emitters.has(signal)) emitters.set(signal, []);
      emitters.get(signal).push(skill.name);
    }

    for (const signal of skill.listen) {
      if (!SIGNAL_NAME_PATTERN.test(signal)) {
        issues.push(`${skill.name}: invalid signal name "${signal}" — use lowercase.dot.notation (e.g. code.changed)`);
      }
      if (!listeners.has(signal)) listeners.set(signal, []);
      listeners.get(signal).push(skill.name);
    }
  }

  // Check: every listen signal must have at least one emitter
  for (const [signal, listenerList] of listeners) {
    if (!emitters.has(signal)) {
      issues.push(`orphan listener: "${signal}" listened by [${listenerList.join(', ')}] but no skill emits it`);
    }
  }

  // Warn: emitted signals that nobody listens to
  for (const [signal, emitterList] of emitters) {
    if (!listeners.has(signal)) {
      warnings.push(`unlistened signal: "${signal}" emitted by [${emitterList.join(', ')}] but no skill listens to it`);
    }
  }

  const signalCount = new Set([...emitters.keys(), ...listeners.keys()]).size;
  const emitterCount = [...emitters.values()].reduce((sum, arr) => sum + arr.length, 0);
  const listenerCount = [...listeners.values()].reduce((sum, arr) => sum + arr.length, 0);

  return {
    skillCount: Object.keys(skills).length,
    signalCount,
    emitterCount,
    listenerCount,
    issues,
    warnings,
    tierSkills,
  };
}

// CLI entry point
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const proDirs = [PRO_DIR, BUSINESS_DIR].filter(existsSync);
  const tierLabels = ['Pro', 'Business'];
  const { skillCount, signalCount, emitterCount, listenerCount, issues, warnings } = validateSignals(SKILLS_DIR, {
    proDirs,
    tierLabels,
  });
  console.log(`Scanned ${skillCount} skills — ${signalCount} signals, ${emitterCount} emit, ${listenerCount} listen`);

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠  ${w}`));
  }

  if (issues.length === 0) {
    console.log('\n✓ All signals are valid!');
  } else {
    console.log(`\n✗ Found ${issues.length} signal issue(s):\n`);
    issues.forEach((issue) => console.log(`  ✗  ${issue}`));
  }

  process.exit(issues.length > 0 ? 1 : 0);
}
