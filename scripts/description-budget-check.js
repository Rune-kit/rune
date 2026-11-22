#!/usr/bin/env node

// description-budget-check.js — keeps skill descriptions inside the budget
// agent hosts load into every session.
//
// Every host (Claude Code, Grok Build, Cursor, Codex, Antigravity, …) puts each
// skill's `description` into the model context so the model can decide which
// skill to invoke. Long or shouting descriptions cost tokens in every session
// and make a skill over-trigger. This check enforces:
//   - per skill: ≤ PER_SKILL_MAX chars (Agent Skills spec hard limit is 1024)
//   - total across skills/: ≤ TOTAL_MAX chars
//   - no all-caps absolutes (ALWAYS / NEVER / MUST / EVERY / ANY / ALL), which
//     push models to invoke a skill when it does not fit.
//
// Usage: node scripts/description-budget-check.js [--json]
// Exit 0 = within budget, 1 = over budget.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PER_SKILL_MAX = 500;
export const SPEC_MAX = 1024;
export const TOTAL_MAX = 20000;
export const SHOUTING_RE = /\b(ALWAYS|NEVER|MUST|EVERY|ANY|ALL)\b/g;

export function readDescription(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const line = fm[1].split(/\r?\n/).find((l) => l.startsWith('description:'));
  if (!line) return null;
  let value = line.slice('description:'.length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

export function checkDescriptions(skillsDir, limits = {}) {
  const perSkillMax = limits.perSkillMax ?? PER_SKILL_MAX;
  const totalMax = limits.totalMax ?? TOTAL_MAX;
  const skills = [];
  const errors = [];
  for (const name of readdirSync(skillsDir).sort()) {
    const file = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const desc = readDescription(readFileSync(file, 'utf-8'));
    if (desc == null) {
      errors.push(`${name}: missing description`);
      continue;
    }
    const length = [...desc].length;
    skills.push({ name, length });
    if (length > SPEC_MAX) errors.push(`${name}: description is ${length} chars (spec max ${SPEC_MAX})`);
    else if (length > perSkillMax) errors.push(`${name}: description is ${length} chars (budget ${perSkillMax})`);
    const shouting = desc.match(SHOUTING_RE);
    if (shouting) errors.push(`${name}: all-caps absolute(s) in description: ${[...new Set(shouting)].join(', ')}`);
  }
  const total = skills.reduce((sum, s) => sum + s.length, 0);
  if (total > totalMax) errors.push(`total description length ${total} chars exceeds budget ${totalMax}`);
  return { skills, total, errors, limits: { perSkillMax, totalMax } };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const result = checkDescriptions(join(__dirname, '..', 'skills'));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const longest = [...result.skills].sort((a, b) => b.length - a.length).slice(0, 3);
    console.log(
      `description budget: ${result.skills.length} skills, ${result.total}/${result.limits.totalMax} chars; longest: ${longest
        .map((s) => `${s.name} ${s.length}`)
        .join(', ')}`,
    );
    for (const e of result.errors) console.error(`  ✗ ${e}`);
  }
  process.exit(result.errors.length ? 1 : 0);
}
