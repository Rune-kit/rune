#!/usr/bin/env node

// validate-skills.js — Validates structural completeness of all SKILL.md files
// Usage: node scripts/validate-skills.js
// Exit 0 = all pass, Exit 1 = issues found

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

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

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

function checkHardGateFormat(content, skillName) {
  const issues = [];
  // HARD-GATE should use XML tags, not markdown code blocks
  const badPattern = /```\s*\nHARD-GATE|HARD.GATE.*```/g;
  if (badPattern.test(content)) {
    issues.push(`${skillName}: HARD-GATE uses backtick block instead of <HARD-GATE> XML tags`);
  }
  return issues;
}

function validateSkill(skillPath, skillName) {
  const issues = [];
  let content;

  try {
    content = fs.readFileSync(skillPath, 'utf-8').replace(/\r\n/g, '\n');
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

    // Check model value is valid
    const modelMatch = frontmatter.match(/model:\s*(\S+)/);
    if (modelMatch) {
      const model = modelMatch[1].replace(/"/g, '');
      if (!VALID_MODELS.includes(model)) {
        issues.push(`${skillName}: Invalid model "${model}" — must be haiku, sonnet, or opus`);
      }
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

  // Check Done When has at least one bullet (handles variants like "## Done When (Save Mode)")
  const doneWhenMatch = content.match(/## Done When[^\n]*\n\n- /);
  if (content.includes('## Done When') && !doneWhenMatch) {
    issues.push(`${skillName}: Done When section exists but has no bullet points`);
  }

  // Check Cost Profile has content
  const costProfileMatch = content.match(/## Cost Profile\n\n[^\n]+/);
  if (content.includes('## Cost Profile') && !costProfileMatch) {
    issues.push(`${skillName}: Cost Profile section is empty`);
  }

  return issues;
}

function validate() {
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const allIssues = [];
  const warnings = [];
  let scanned = 0;

  for (const dir of dirs) {
    const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      allIssues.push(`${dir}: No SKILL.md found in skills/${dir}/`);
      continue;
    }

    const issues = validateSkill(skillPath, dir);
    const hardIssues = issues.filter(i => !i.includes('WARN'));
    const softIssues = issues.filter(i => i.includes('WARN'));

    allIssues.push(...hardIssues);
    warnings.push(...softIssues);
    scanned++;
  }

  console.log(`Scanned ${scanned} skills\n`);

  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(`  ⚠  ${w}`));
    console.log('');
  }

  if (allIssues.length === 0) {
    console.log('✓ All skills pass structural validation!');
  } else {
    console.log(`✗ Found ${allIssues.length} structural issue(s):\n`);
    allIssues.forEach(issue => console.log(`  ✗  ${issue}`));
  }

  process.exit(allIssues.length > 0 ? 1 : 0);
}

validate();
