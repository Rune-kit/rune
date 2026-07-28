#!/usr/bin/env node

// build-skill-index.js — Emit skill-index.json at the plugin root.
//
// Every compiled platform gets a skill-index.json written into its output dir by
// the emitter. Claude Code does not compile — the plugin is served straight from
// this repo — so the intent-router hook had no index to read and exited silently
// on every prompt. This script generates the same artifact for the uncompiled case.
//
// Usage:
//   node scripts/build-skill-index.js            # write skill-index.json
//   node scripts/build-skill-index.js --check    # exit 1 if the committed file is stale

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSkillIndex } from '../compiler/emitter.js';
import { parseSkill } from '../compiler/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const OUT = join(ROOT, 'skill-index.json');

export function buildIndex(skillsDir = SKILLS_DIR) {
  const parsed = readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(skillsDir, d.name, 'SKILL.md'))
    .map((p) => {
      try {
        return parseSkill(readFileSync(p, 'utf-8'), p);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return generateSkillIndex(parsed);
}

// `generated` is a timestamp — it differs on every run and says nothing about
// whether the index still matches the skills. Compare everything else.
export function isStale(committed, fresh) {
  const strip = ({ generated, ...rest }) => rest;
  return JSON.stringify(strip(committed)) !== JSON.stringify(strip(fresh));
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isMain) {
  const fresh = buildIndex();

  if (process.argv.includes('--check')) {
    let committed;
    try {
      committed = JSON.parse(readFileSync(OUT, 'utf-8'));
    } catch {
      console.error('✗ skill-index.json missing or unreadable — run: node scripts/build-skill-index.js');
      process.exit(1);
    }

    if (isStale(committed, fresh)) {
      console.error('✗ skill-index.json is stale — run: node scripts/build-skill-index.js');
      process.exit(1);
    }

    console.log(`✓ skill-index.json current (${Object.keys(fresh.intents).length} intents)`);
    process.exit(0);
  }

  writeFileSync(OUT, `${JSON.stringify(fresh, null, 2)}\n`);
  console.log(`✓ skill-index.json written — ${fresh.skillCount} skills, ${Object.keys(fresh.intents).length} intents`);
}
