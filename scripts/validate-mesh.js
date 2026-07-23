#!/usr/bin/env node

// validate-mesh.js — Validates authoritative outbound connections across all SKILL.md files
// Usage: node scripts/validate-mesh.js

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkillConnections } from '../compiler/doctor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');

export function parseSkillMd(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const name = filePath.split(/[/\\]/).at(-2);
  const parsed = parseSkillConnections(content, name);

  return {
    name,
    calls: parsed.calls.map((entry) => entry.skill),
    calledBy: parsed.calledBy.map((entry) => entry.skill),
  };
}

export function validateMesh(skillsDir) {
  const skills = {};
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (existsSync(skillPath)) {
      skills[dir] = parseSkillMd(skillPath);
    }
  }

  const issues = [];

  for (const [name, skill] of Object.entries(skills)) {
    // Outbound Calls are authoritative and must be acknowledged by the target.
    // Called By may additionally declare conditional or dynamically routed callers.
    for (const target of skill.calls) {
      if (skills[target] && !skills[target].calledBy.includes(name)) {
        issues.push(`${name} → ${target}: ${target} missing "${name}" in Called By`);
      }
    }
  }

  return { skillCount: Object.keys(skills).length, issues };
}

// CLI entry point
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const { skillCount, issues } = validateMesh(SKILLS_DIR);
  console.log(`Scanned ${skillCount} skills`);

  if (issues.length === 0) {
    console.log('All outbound mesh connections are acknowledged by their targets!');
  } else {
    console.log(`\nFound ${issues.length} broken connections:\n`);
    issues.forEach((issue) => console.log(`  - ${issue}`));
  }

  process.exit(issues.length > 0 ? 1 : 0);
}
