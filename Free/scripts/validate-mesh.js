#!/usr/bin/env node

// validate-mesh.js — Validates bidirectional connections across all SKILL.md files
// Usage: node scripts/validate-mesh.js

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

function parseSkillMd(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const name = path.basename(path.dirname(filePath));

  const callsMatch = content.match(/## Calls \(outbound[^)]*\)([\s\S]*?)(?=\n## )/);
  const calledByMatch = content.match(/## Called By \(inbound[^)]*\)([\s\S]*?)(?=\n## )/);

  const extractSkills = (text) => {
    if (!text) return [];
    const matches = text.matchAll(/`([a-z-]+)`\s*\(L[1-4]\)/g);
    return [...matches].map(m => m[1]);
  };

  return {
    name,
    calls: extractSkills(callsMatch ? callsMatch[1] : ''),
    calledBy: extractSkills(calledByMatch ? calledByMatch[1] : '')
  };
}

function validate() {
  const skills = {};
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      skills[dir] = parseSkillMd(skillPath);
    }
  }

  const issues = [];

  for (const [name, skill] of Object.entries(skills)) {
    // Check: if A calls B, B should list A in calledBy
    for (const target of skill.calls) {
      if (skills[target] && !skills[target].calledBy.includes(name)) {
        issues.push(`${name} → ${target}: ${target} missing "${name}" in Called By`);
      }
    }

    // Check: if A lists B in calledBy, B should list A in calls
    for (const caller of skill.calledBy) {
      if (caller === 'User') continue;
      if (skills[caller] && !skills[caller].calls.includes(name)) {
        issues.push(`${caller} → ${name}: ${caller} missing "${name}" in Calls`);
      }
    }
  }

  console.log(`Scanned ${Object.keys(skills).length} skills`);

  if (issues.length === 0) {
    console.log('All mesh connections are bidirectionally consistent!');
  } else {
    console.log(`\nFound ${issues.length} broken connections:\n`);
    issues.forEach(issue => console.log(`  - ${issue}`));
  }

  process.exit(issues.length > 0 ? 1 : 0);
}

validate();
