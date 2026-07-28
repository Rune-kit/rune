#!/usr/bin/env node

// validate-skills.js — Validates structural completeness of all SKILL.md files
// Usage: node scripts/validate-skills.js
// Exit 0 = all pass, Exit 1 = issues found

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');

// Required top-level sections in every SKILL.md
const REQUIRED_SECTIONS = [
  '## Calls (outbound',
  '## Called By (inbound',
  '## Constraints',
  '## Sharp Edges',
  '## Done When',
  '## Cost Profile',
];

// Required YAML frontmatter fields
const REQUIRED_FRONTMATTER = ['name:', 'description:', 'layer:', 'model:'];

// Valid layer values
const VALID_LAYERS = ['L0', 'L1', 'L2', 'L3'];

// Valid model values
const VALID_MODELS = ['haiku', 'sonnet', 'opus'];

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

// A SKILL.md can carry `model` twice, and the two are read by different consumers:
//   metadata.model  → the compiler (parser.js), which maps it per platform
//   top-level model → Claude Code itself, but ONLY for `context: fork` skills
// They must agree, or the tier a user sees depends on which runtime they are on.
export function parseModelFields(frontmatter) {
  const top = frontmatter.match(/^model:\s*(\S+)\s*$/m);
  const nested = frontmatter.match(/^\s+model:\s*(\S+)\s*$/m);
  const strip = (m) => (m ? m[1].replace(/["']/g, '') : null);
  return { topLevel: strip(top), metadata: strip(nested) };
}

export function isForkSkill(frontmatter) {
  return /^context:\s*fork\s*$/m.test(frontmatter);
}

export function checkHardGateFormat(content, skillName) {
  const issues = [];
  // HARD-GATE should use XML tags, not markdown code blocks
  const badPattern = /```\s*\nHARD-GATE|HARD.GATE.*```/g;
  if (badPattern.test(content)) {
    issues.push(`${skillName}: HARD-GATE uses backtick block instead of <HARD-GATE> XML tags`);
  }
  return issues;
}

export function validateSkill(skillPath, skillName) {
  const issues = [];
  let content;

  try {
    content = readFileSync(skillPath, 'utf-8').replace(/\r\n/g, '\n');
  } catch (e) {
    return [`${skillName}: Cannot read SKILL.md — ${e.message}`];
  }

  // Check frontmatter exists
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    issues.push(`${skillName}: Missing YAML frontmatter (--- block)`);
  } else {
    // Check required frontmatter fields
    for (const field of REQUIRED_FRONTMATTER) {
      if (!frontmatter.includes(field)) {
        issues.push(`${skillName}: Missing frontmatter field "${field}"`);
      }
    }

    // Check layer value is valid
    const layerMatch = frontmatter.match(/layer:\s*(\S+)/);
    if (layerMatch && !VALID_LAYERS.includes(layerMatch[1])) {
      issues.push(`${skillName}: Invalid layer "${layerMatch[1]}" — must be L1, L2, or L3`);
    }

    // Check model values are valid — both the compiler's and Claude Code's copy
    const { topLevel, metadata } = parseModelFields(frontmatter);
    for (const model of [topLevel, metadata]) {
      if (model && !VALID_MODELS.includes(model)) {
        issues.push(`${skillName}: Invalid model "${model}" — must be haiku, sonnet, or opus`);
      }
    }

    // The two copies must agree — a silent split means the tier differs per runtime
    if (topLevel && metadata && topLevel !== metadata) {
      issues.push(`${skillName}: model split — top-level "${topLevel}" vs metadata "${metadata}". They must match.`);
    }

    // Claude Code only honours top-level model when the skill forks into a subagent
    if (topLevel && !isForkSkill(frontmatter)) {
      issues.push(`${skillName}: WARN — top-level model has no effect without "context: fork"`);
    }
  }

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      issues.push(`${skillName}: Missing section "${section}"`);
    }
  }

  // Check Output Format section exists (not required for all but strongly recommended)
  if (!content.includes('## Output Format')) {
    issues.push(`${skillName}: WARN — Missing "## Output Format" section`);
  }

  // Check HARD-GATE format if skill has one
  if (content.includes('HARD-GATE') || content.includes('HARD GATE')) {
    const hardGateIssues = checkHardGateFormat(content, skillName);
    issues.push(...hardGateIssues);
  }

  // Check Sharp Edges table has at least one row
  const sharpEdgesMatch = content.match(/## Sharp Edges[\s\S]*?\|([^\n]+)\|([^\n]+)\|([^\n]+)\|/);
  if (content.includes('## Sharp Edges') && !sharpEdgesMatch) {
    issues.push(`${skillName}: Sharp Edges section exists but has no table rows`);
  }

  // Check Done When has at least one bullet anywhere within the section
  // (handles variants: "## Done When (Save Mode)", subsections via "### Mode", lead paragraph then bullets)
  if (content.includes('## Done When')) {
    const doneWhenSection = content.match(/## Done When[\s\S]*?(?=\n## |$)/);
    const hasBullet = doneWhenSection && /\n- \S/.test(doneWhenSection[0]);
    if (!hasBullet) {
      issues.push(`${skillName}: Done When section exists but has no bullet points`);
    }
  }

  // Check Cost Profile has content
  const costProfileMatch = content.match(/## Cost Profile\n\n[^\n]+/);
  if (content.includes('## Cost Profile') && !costProfileMatch) {
    issues.push(`${skillName}: Cost Profile section is empty`);
  }

  return issues;
}

// agents/*.md is a hand-written parallel copy of the tier table. Nothing generates
// it from skills/, so the two drift silently — 23 of 66 had split apart before this
// check existed. SKILL.md is the source of truth; agents/ must follow it.
export function validateAgentSync(skillsDir, agentsDir) {
  const issues = [];
  if (!existsSync(agentsDir)) return issues;

  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const name of dirs) {
    const skillPath = join(skillsDir, name, 'SKILL.md');
    const agentPath = join(agentsDir, `${name}.md`);
    if (!existsSync(skillPath) || !existsSync(agentPath)) continue;

    const skillFm = parseFrontmatter(readFileSync(skillPath, 'utf-8').replace(/\r\n/g, '\n'));
    const agentFm = parseFrontmatter(readFileSync(agentPath, 'utf-8').replace(/\r\n/g, '\n'));
    if (!skillFm || !agentFm) continue;

    const skillModel = parseModelFields(skillFm).metadata;
    const agentModel = parseModelFields(agentFm).topLevel;
    if (skillModel && agentModel && skillModel !== agentModel) {
      issues.push(
        `${name}: tier drift — skills/${name}/SKILL.md says "${skillModel}", agents/${name}.md says "${agentModel}"`,
      );
    }
  }

  return issues;
}

export function validateAllSkills(skillsDir, agentsDir = join(skillsDir, '..', 'agents')) {
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const allIssues = [];
  const warnings = [];
  let scanned = 0;

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (!existsSync(skillPath)) {
      allIssues.push(`${dir}: No SKILL.md found in skills/${dir}/`);
      continue;
    }

    const issues = validateSkill(skillPath, dir);
    const hardIssues = issues.filter((i) => !i.includes('WARN'));
    const softIssues = issues.filter((i) => i.includes('WARN'));

    allIssues.push(...hardIssues);
    warnings.push(...softIssues);
    scanned++;
  }

  allIssues.push(...validateAgentSync(skillsDir, agentsDir));

  return { scanned, allIssues, warnings };
}

// CLI entry point
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const { scanned, allIssues, warnings } = validateAllSkills(SKILLS_DIR);

  console.log(`Scanned ${scanned} skills\n`);

  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠  ${w}`));
    console.log('');
  }

  if (allIssues.length === 0) {
    console.log('✓ All skills pass structural validation!');
  } else {
    console.log(`✗ Found ${allIssues.length} structural issue(s):\n`);
    allIssues.forEach((issue) => console.log(`  ✗  ${issue}`));
  }

  process.exit(allIssues.length > 0 ? 1 : 0);
}
