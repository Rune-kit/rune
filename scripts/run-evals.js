#!/usr/bin/env node

// run-evals.js — Behavioral eval runner for Rune skills.
//
// Each eval case = evals/<skill>/<case>/{fixture/, expected.json}.
// The runner copies the fixture to a temp dir, asks a FRESH headless Claude
// session to execute the skill's SKILL.md against it (the skill text is the
// only instruction source — no author context), then asserts marker strings
// against the transcript and checks file-mutation contracts.
//
// This is NOT part of `npm run ci` — each case costs one full agent run
// (LLM tokens + minutes). Run deliberately:
//
//   npm run eval                      # all cases
//   npm run eval -- converge         # one skill
//   npm run eval -- converge/clean-pass  # one case
//   node scripts/run-evals.js --list # list cases, run nothing
//
// Requires the `claude` CLI on PATH (Claude Code). Exit 1 on any failure.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EVALS_DIR = join(ROOT, 'evals');
const MAX_TURNS = 40;
// Windows npm shims are .cmd files — execFileSync can't spawn bare `claude` there.
const CLAUDE_BIN = process.platform === 'win32' ? 'claude.cmd' : 'claude';

function listCases(filter) {
  const cases = [];
  for (const skill of readdirSync(EVALS_DIR, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    for (const c of readdirSync(join(EVALS_DIR, skill.name), { withFileTypes: true })) {
      if (!c.isDirectory()) continue;
      const id = `${skill.name}/${c.name}`;
      if (filter && !id.startsWith(filter)) continue;
      cases.push({ id, skill: skill.name, dir: join(EVALS_DIR, skill.name, c.name) });
    }
  }
  return cases;
}

function buildPrompt(skillName, workDir, expected) {
  const skillPath = join(ROOT, 'skills', skillName, 'SKILL.md');
  return [
    `You are an agent executing the Rune \`${skillName}\` skill. Your ONLY instruction source is the skill file — read it and follow it literally, as written.`,
    ``,
    `1. Read ${skillPath}`,
    `2. Execute it against this project: ${workDir}`,
    ``,
    `Constraints: do not run package-manager installs, linters, tests, or builds (no toolchain) — where the skill calls for them, SKIP with reason. File edits are allowed ONLY where the skill's own steps dictate.`,
    expected.appendsTo
      ? `The plan/task file the skill may append to is ${expected.appendsTo} (relative to the project).`
      : '',
    ``,
    `Output the skill's own report format verbatim, then state exactly which signal you would emit (write the signal name literally, e.g. \`signal.name\`).`,
  ]
    .filter(Boolean)
    .join('\n');
}

function runCase(c) {
  const expected = JSON.parse(readFileSync(join(c.dir, 'expected.json'), 'utf-8'));
  const workDir = mkdtempSync(join(tmpdir(), `rune-eval-${c.skill}-`));
  cpSync(join(c.dir, 'fixture'), workDir, { recursive: true });

  const guarded = expected.fileUntouched ? join(workDir, expected.fileUntouched) : null;
  const before = guarded && existsSync(guarded) ? readFileSync(guarded, 'utf-8') : null;

  let transcript = '';
  try {
    // Prompt goes via stdin (`claude -p` reads it) — argv stays flag-only, so
    // `shell: true` (required to spawn the .cmd shim on Windows, Node ≥20) is safe.
    transcript = execFileSync(
      CLAUDE_BIN,
      ['-p', '--max-turns', String(MAX_TURNS), '--allowedTools', 'Read', 'Glob', 'Grep', 'Edit', 'Write'],
      {
        encoding: 'utf-8',
        input: buildPrompt(c.skill, workDir, expected),
        timeout: 10 * 60 * 1000,
        windowsHide: true,
        shell: process.platform === 'win32',
      },
    );
  } catch (err) {
    return { id: c.id, pass: false, failures: [`agent run failed: ${err.message.slice(0, 200)}`] };
  } finally {
    // keep workDir on failure for post-mortem; clean on pass below
  }

  const failures = [];
  for (const marker of expected.must ?? []) {
    if (!transcript.includes(marker)) failures.push(`missing expected marker: "${marker}"`);
  }
  for (const marker of expected.mustNot ?? []) {
    if (transcript.includes(marker)) failures.push(`forbidden marker present: "${marker}"`);
  }
  if (guarded && before !== null) {
    const after = existsSync(guarded) ? readFileSync(guarded, 'utf-8') : null;
    if (after !== before) failures.push(`fileUntouched violated: ${expected.fileUntouched} was modified`);
  }
  if (expected.appendsTo) {
    const target = join(workDir, expected.appendsTo);
    const content = existsSync(target) ? readFileSync(target, 'utf-8') : '';
    if (!content.includes('## Convergence')) {
      failures.push(`appendsTo contract: no appended section found in ${expected.appendsTo}`);
    }
  }

  const pass = failures.length === 0;
  if (pass) rmSync(workDir, { recursive: true, force: true });
  return { id: c.id, pass, failures, workDir: pass ? null : workDir };
}

// --- main ---
const args = process.argv.slice(2).filter((a) => a !== '--');
if (args.includes('--list')) {
  for (const c of listCases()) console.log(c.id);
  process.exit(0);
}

const filter = args.find((a) => !a.startsWith('--'));
const cases = listCases(filter);
if (cases.length === 0) {
  console.error(`No eval cases match "${filter ?? ''}" under evals/`);
  process.exit(1);
}

console.log(`Running ${cases.length} eval case(s) — each is a full agent run, this costs tokens.\n`);
let failed = 0;
for (const c of cases) {
  process.stdout.write(`▶ ${c.id} ... `);
  const r = runCase(c);
  if (r.pass) {
    console.log('✓ PASS');
  } else {
    failed++;
    console.log('✗ FAIL');
    for (const f of r.failures) console.log(`    - ${f}`);
    if (r.workDir) console.log(`    fixture preserved at: ${r.workDir}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} eval case(s) passed`);
process.exit(failed === 0 ? 0 : 1);
