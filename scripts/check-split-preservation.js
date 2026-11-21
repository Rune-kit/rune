#!/usr/bin/env node
/**
 * check-split-preservation — prove a progressive-disclosure split dropped nothing.
 *
 * Compares each skill's SKILL.md at a git ref (default: master) with the
 * working tree "bundle" (SKILL.md + references/*.md) and fails when:
 *   - any non-blank line of the old SKILL.md is missing from the bundle
 *   - any rune:<skill> cross-ref (mesh connection) left SKILL.md
 *   - any <HARD-GATE> block left SKILL.md
 *   - the frontmatter (name, description, signals, metadata) changed
 *
 * Usage: node scripts/check-split-preservation.js [--ref master] [skill ...]
 * With no skill names, checks every skill that has a references/ folder.
 *
 *   --write-baseline <file>  record line hashes, cross-refs and HARD-GATE
 *                            counts of the ref's SKILL.md files, so a unit
 *                            test can keep guarding the split without git
 *                            history (CI clones are shallow). Merges into an
 *                            existing file: the listed skills are (re)written
 *                            with their own `ref`, other skills are kept.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CROSS_REF = /`?rune:([a-z][\w-]*)`?/g;
const GATE = /<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/g;

// A line moved into references/ may have its markdown link target rebased so it
// still clicks through on GitHub (`](references/x.md)` → `](x.md)` inside a
// reference file). Normalise local .md link targets to their path inside
// references/ so a rebased line still counts as preserved.
const LOCAL_MD_LINK = /\]\((?:\.\/)?(?:references\/)?([\w.-]+\.md)\)/g;
const norm = (l) => l.trim().replace(LOCAL_MD_LINK, '](<ref>/$1)');
export const hashLine = (l) => createHash('sha1').update(norm(l)).digest('hex').slice(0, 12);
const frontmatter = (t) => t.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
const body = (t) => t.replace(/^---\n[\s\S]*?\n---\n?/, '');
export const refs = (t) => new Set([...body(t).matchAll(CROSS_REF)].map((m) => m[1]));
export const gates = (t) => [...t.matchAll(GATE)].map((m) => m[1].split('\n').map(norm).join('\n').trim());

export function gitShow(ref, file, cwd = ROOT) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

export function bundle(skillDir) {
  let text = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
  const refDir = path.join(skillDir, 'references');
  if (existsSync(refDir)) {
    for (const f of readdirSync(refDir).sort()) {
      if (f.endsWith('.md')) text += `\n${readFileSync(path.join(refDir, f), 'utf-8')}`;
    }
  }
  return text;
}

/** Returns a list of human-readable problems (empty = preserved). */
export function checkSkill(oldText, skillDir) {
  const problems = [];
  const skillMd = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
  const have = new Set(bundle(skillDir).split('\n').map(norm));
  for (const line of oldText.split('\n').map(norm)) {
    if (line && !have.has(line)) problems.push(`line dropped: ${line.slice(0, 100)}`);
  }
  const now = refs(skillMd);
  for (const r of refs(oldText)) if (!now.has(r)) problems.push(`mesh connection left SKILL.md: rune:${r}`);
  const nowGates = new Set(gates(skillMd));
  for (const g of gates(oldText)) if (!nowGates.has(g)) problems.push(`HARD-GATE left SKILL.md: ${g.slice(0, 80)}`);
  if (frontmatter(oldText) !== frontmatter(skillMd)) problems.push('frontmatter changed');
  return problems;
}

function main(argv) {
  let ref = 'master';
  let baselineOut = null;
  const names = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') ref = argv[++i];
    else if (argv[i] === '--write-baseline') baselineOut = argv[++i];
    else names.push(argv[i]);
  }
  if (baselineOut) {
    const short = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf-8' }).trim();
    const out = existsSync(baselineOut) ? JSON.parse(readFileSync(baselineOut, 'utf-8')) : { skills: {} };
    // Legacy single-ref files: push the top-level ref down into each skill.
    if (out.ref) {
      for (const v of Object.values(out.skills)) v.ref ??= out.ref;
      delete out.ref;
    }
    for (const s of names) {
      const old = gitShow(ref, `skills/${s}/SKILL.md`);
      if (old === null) throw new Error(`skills/${s}/SKILL.md not found at ${ref}`);
      out.skills[s] = {
        ref: short,
        lines: [...new Set(old.split('\n').map(norm).filter(Boolean).map(hashLine))],
        crossRefs: [...refs(old)].sort(),
        hardGates: gates(old).length,
      };
    }
    writeFileSync(baselineOut, `${JSON.stringify(out, null, 1)}\n`);
    console.log(`baseline for ${names.length} skill(s) at ${short} → ${baselineOut}`);
    return 0;
  }
  const skillsRoot = path.join(ROOT, 'skills');
  const targets = names.length
    ? names
    : readdirSync(skillsRoot).filter((s) => existsSync(path.join(skillsRoot, s, 'references')));
  let failed = 0;
  let checked = 0;
  for (const s of targets) {
    const old = gitShow(ref, `skills/${s}/SKILL.md`);
    if (old === null) continue;
    checked++;
    const problems = checkSkill(old, path.join(skillsRoot, s));
    const oldLines = old.split('\n').length;
    const newLines = readFileSync(path.join(skillsRoot, s, 'SKILL.md'), 'utf-8').split('\n').length;
    if (problems.length) {
      failed++;
      console.log(`✗ ${s}: ${problems.length} problem(s)`);
      for (const p of problems.slice(0, 20)) console.log(`    ${p}`);
    } else if (oldLines !== newLines) {
      console.log(`✓ ${s}: SKILL.md ${oldLines} → ${newLines} lines, nothing dropped`);
    }
  }
  console.log(`${checked} skill(s) checked against ${ref}; ${failed} failed`);
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
