#!/usr/bin/env node

// validate-pack.js — Validates structural completeness of community PACK.md files
// Usage: node scripts/validate-pack.js [path-to-pack-dir]
// If no path given, validates all packs in .rune/community-packs/
// Exit 0 = all pass, Exit 1 = issues found

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Required top-level sections in every PACK.md
const REQUIRED_SECTIONS = [
  '## Purpose',
  '## Triggers',
  '## Skills Included',
  '## Connections',
  '## Constraints',
  '## Sharp Edges',
  '## Done When',
  '## Cost Profile',
];

// Required YAML frontmatter fields
const REQUIRED_FRONTMATTER = ['name:', 'description:', 'layer:'];

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

export function validatePack(packDir) {
  const issues = [];
  const packName = basename(packDir);
  const packFile = join(packDir, 'PACK.md');

  if (!existsSync(packFile)) {
    issues.push(`${packName}: Missing PACK.md`);
    return issues;
  }

  const content = readFileSync(packFile, 'utf-8').replace(/\r\n/g, '\n');

  // Check frontmatter
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    issues.push(`${packName}: Missing YAML frontmatter (---)`);
  } else {
    for (const field of REQUIRED_FRONTMATTER) {
      if (!frontmatter.includes(field)) {
        issues.push(`${packName}: Missing frontmatter field: ${field}`);
      }
    }
    // Must be L4
    if (frontmatter.includes('layer:') && !frontmatter.includes('L4')) {
      issues.push(`${packName}: Extension packs must be layer L4`);
    }
  }

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      issues.push(`${packName}: Missing section: ${section}`);
    }
  }

  // Check for at least one skill
  const skillHeaders = content.match(/### \w/g);
  if (!skillHeaders || skillHeaders.length === 0) {
    issues.push(`${packName}: No skills found under "## Skills Included" (expected ### headers)`);
  }

  // Check for workflow steps in skills
  if (!content.includes('**Step 1')) {
    issues.push(`${packName}: Skills should have workflow steps (Step 1, Step 2, ...)`);
  }

  return issues;
}

// CLI entry point
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const targetPath = process.argv[2];
  let packDirs = [];

  if (targetPath) {
    packDirs = [resolve(targetPath)];
  } else {
    // Validate all community packs
    const communityDir = join(process.cwd(), '.rune', 'community-packs');
    if (existsSync(communityDir)) {
      const entries = readdirSync(communityDir, { withFileTypes: true });
      packDirs = entries
        .filter((e) => e.isDirectory() && e.name !== 'node_modules')
        .map((e) => join(communityDir, e.name));
    }

    // Also validate core extension packs
    const extensionsDir = join(__dirname, '..', 'extensions');
    if (existsSync(extensionsDir)) {
      const entries = readdirSync(extensionsDir, { withFileTypes: true });
      packDirs = packDirs.concat(entries.filter((e) => e.isDirectory()).map((e) => join(extensionsDir, e.name)));
    }
  }

  if (packDirs.length === 0) {
    console.log('No extension packs found to validate.');
    process.exit(0);
  }

  let totalIssues = 0;
  let totalPacks = 0;

  for (const dir of packDirs) {
    totalPacks++;
    const issues = validatePack(dir);
    if (issues.length > 0) {
      totalIssues += issues.length;
      for (const issue of issues) {
        console.log(`  FAIL: ${issue}`);
      }
    } else {
      console.log(`  PASS: ${basename(dir)}`);
    }
  }

  console.log(`\n${totalPacks} packs validated, ${totalIssues} issues found.`);
  process.exit(totalIssues > 0 ? 1 : 0);
}
