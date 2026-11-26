/**
 * `rune verify --integrity [--staged|--base <ref>] [--json]`
 *
 * Runs the test-integrity analyzer against a git diff and prints fingerprints.
 * Exit 0 when clean or warnings-only (or when an auditable override is present).
 * Exit 2 when high-severity findings would block a strict hook.
 * Exit 1 for usage errors.
 */

import { analyzeGit, formatReport, resolveOverride, verdictFromResult } from '../lib/test-integrity.js';

export function parseVerifyArgs(args = {}) {
  const integrity = Boolean(args.integrity);
  const staged = Boolean(args.staged);
  const json = Boolean(args.json);
  const base = typeof args.base === 'string' && args.base ? args.base : undefined;
  return { integrity, staged, json, base };
}

/**
 * @param {string} projectRoot
 * @param {Record<string, unknown>} args  parsed flags from rune.js
 * @param {{stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream, env?: NodeJS.ProcessEnv}} [io]
 * @returns {number} exit code
 */
export function runVerify(projectRoot, args, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const { integrity, staged, json, base } = parseVerifyArgs(args);

  if (!integrity) {
    stderr.write('  rune verify: pass --integrity to run the test-integrity gate.\n');
    stderr.write('  Usage: rune verify --integrity [--staged|--base <ref>] [--json]\n');
    return 1;
  }

  if (staged && base) {
    stderr.write('  rune verify: use either --staged or --base <ref>, not both.\n');
    return 1;
  }

  let result;
  try {
    result = analyzeGit(projectRoot, { staged, base });
  } catch (err) {
    stderr.write(`  rune verify: failed to collect git diff (${err.message})\n`);
    return 1;
  }

  const override = resolveOverride({ env: io.env || process.env, cwd: projectRoot });
  const verdict = verdictFromResult(result, { override });
  stdout.write(formatReport(result, { json }));
  if (override && result.blocked) {
    stderr.write(`  test-integrity: override accepted from ${override.source}: ${override.reason}\n`);
  }
  return verdict.exitCode;
}
