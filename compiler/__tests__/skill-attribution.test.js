/**
 * Attribution hygiene — skills and agents must not carry graft-source credits.
 *
 * Rune skills present their guidance as Rune's own. A `> From <repo> (N★): "…"`
 * blockquote leaks where a pattern was grafted from, dates the file with a star
 * count, and reads as borrowed authority. The prose stays; the credit line goes.
 *
 * Guards the patterns removed in a2df7b5 so they cannot drift back in.
 *
 * Legitimate credits are NOT attribution: a license obligation for redistributed
 * data (skills/design), a descriptive "Source patterns:" lead-in, and a filename
 * cited inside a config example all stay. Each is asserted explicitly below so a
 * future tightening of the rules cannot silently outlaw them.
 */

import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const SCAN_DIRS = ['skills', 'agents'];

/**
 * Each rule matches a single line. Keep them shape-based: a rule that keys on a
 * repo name rots the moment a different repo is grafted.
 */
const FORBIDDEN = [
  { name: 'blockquote "> From <repo>"', re: /^\s*>\s*From\s+\S/ },
  { name: 'blockquote "> Inspired by"', re: /^\s*>\s*Inspired by\s/ },
  { name: 'blockquote "> Source:"', re: /^\s*>\s*Source:/ },
  { name: 'bare "Source: … ★"', re: /^\s*Source:\s.*★/ },
  { name: 'blockquote carrying a star count', re: /^\s*>\s.*★/ },
];

/** Lines that look adjacent to the rules above and must keep passing. */
const MUST_PASS = [
  'Design intelligence data from [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, 42.8k★).',
  '> Source patterns: production-proven PostgreSQL scaling strategies.',
  'Source: compliance-soc2.yaml',
];

function walkMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function findViolations(text, file) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const rule of FORBIDDEN) {
      if (rule.re.test(line)) {
        hits.push(`${file}:${i + 1} — ${rule.name} → ${line.trim()}`);
      }
    }
  });
  return hits;
}

describe('attribution hygiene', () => {
  test('no source-attribution lines in skills/ or agents/', () => {
    const violations = [];
    for (const dirName of SCAN_DIRS) {
      const dir = join(REPO_ROOT, dirName);
      for (const file of walkMarkdown(dir)) {
        violations.push(...findViolations(readFileSync(file, 'utf8'), relative(REPO_ROOT, file)));
      }
    }

    assert.deepStrictEqual(
      violations,
      [],
      `Attribution lines found — delete the credit, keep the prose:\n${violations.join('\n')}`,
    );
  });

  test('rules fire on the exact lines removed in a2df7b5', () => {
    const removed = [
      '> From goclaw (nextlevelbuilder/goclaw, 832★): "Compact during run, not just at session boundary."',
      '> From superpowers (obra/superpowers, 84k★): "Each fix revealing new problems elsewhere = structural issue."',
      '> Inspired by CLI-Anything (HKUDS/CLI-Anything, 14.5k★): "Never trust exit 0."',
      'Source: goclaw (832★) — SHA256-based loop detection distinguishes true stuck loops.',
    ];

    for (const line of removed) {
      assert.ok(
        FORBIDDEN.some((rule) => rule.re.test(line)),
        `no rule caught a known attribution line: ${line}`,
      );
    }
  });

  test('legitimate credits and lookalikes are not flagged', () => {
    for (const line of MUST_PASS) {
      const caught = FORBIDDEN.filter((rule) => rule.re.test(line)).map((rule) => rule.name);
      assert.deepStrictEqual(caught, [], `false positive on a legitimate line: ${line}`);
    }
  });
});
