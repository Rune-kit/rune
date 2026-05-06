/**
 * Hook drift reporter.
 *
 * Compares Rune-managed Free-preset entries in `.claude/settings.json` against
 * the canonical `buildPreset()` output for the detected preset. Flags missing
 * entries (preset wired more than what's installed) and drifted entries
 * (installed command differs from canonical shape).
 *
 * Reporter, NOT a gate — exit 0 always. Operators legitimately edit settings.json
 * (custom user hooks alongside Rune hooks). Auto-fix would be hostile.
 *
 * Scope: Free preset only. Tier-emitted entries (`${RUNE_PRO_ROOT}` /
 * `${RUNE_BUSINESS_ROOT}`) are filtered out — those are checked separately
 * by tier doctor (out of scope for v2.17.0).
 *
 * Use case: diagnostic before users file "skill is broken" issues. Local drift
 * is a common cause of unexplained hook behavior — a check that points at the
 * actual deviation saves a round-trip with the maintainer.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { detectPlatforms } from '../../adapters/hooks/index.js';
import { detectPreset } from './merge.js';
import { buildPreset, isRuneManaged, SETTINGS_REL_PATH } from './presets.js';

const TIER_ENV_RE = /\$\{RUNE_[A-Z][A-Z0-9_]*_ROOT\}/;

/**
 * @param {string} projectRoot
 * @returns {Promise<{findings: Array, summary: object, platforms: string[]}>}
 */
export async function checkHookDrift(projectRoot) {
  const platforms = detectPlatforms(projectRoot);
  const findings = [];
  const checked = [];

  for (const id of platforms) {
    if (id !== 'claude') continue; // Settings drift is Claude-specific
    const settingsPath = path.join(projectRoot, SETTINGS_REL_PATH);
    if (!existsSync(settingsPath)) continue;

    let settings;
    try {
      const raw = await readFile(settingsPath, 'utf-8');
      settings = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      findings.push({
        platform: id,
        event: null,
        status: 'error',
        message: `Cannot parse ${SETTINGS_REL_PATH}: ${err.message}`,
      });
      continue;
    }

    const preset = detectPreset(settings);
    if (preset === 'none') continue; // No Rune hooks installed
    if (preset === 'mixed') {
      findings.push({
        platform: id,
        event: null,
        status: 'mixed-preset',
        message: 'settings.json contains both gentle and strict Rune entries — re-run `rune hooks install --preset <gentle|strict>` to converge',
      });
    }

    // For mixed preset, fall back to gentle for canonical comparison
    const canonicalPreset = preset === 'mixed' ? 'gentle' : preset;
    const canonical = buildPreset(canonicalPreset);
    checked.push({ platform: id, preset });

    for (const event of ['PreToolUse', 'PostToolUse', 'Stop']) {
      const actualCommands = collectFreePresetCommands(settings.hooks?.[event] || []);
      const canonicalCommands = collectFreePresetCommands(canonical.hooks?.[event] || []);

      // Missing: canonical entry not present in actual
      for (const cmd of canonicalCommands) {
        if (!actualCommands.includes(cmd)) {
          findings.push({ platform: id, event, status: 'missing', expected: cmd });
        }
      }

      // Drift: actual entry not in canonical (extra or modified)
      for (const cmd of actualCommands) {
        if (!canonicalCommands.includes(cmd)) {
          findings.push({ platform: id, event, status: 'drift', actual: cmd });
        }
      }
    }
  }

  const summary = {
    drifted: findings.filter((f) => f.status === 'drift').length,
    missing: findings.filter((f) => f.status === 'missing').length,
    errors: findings.filter((f) => f.status === 'error' || f.status === 'mixed-preset').length,
  };

  return { findings, summary, platforms: checked };
}

/**
 * Pull Rune-managed Free-preset commands out of a matcher-group list.
 * Tier-emitted entries (`${RUNE_*_ROOT}/...`) are excluded — those are tier-managed,
 * not Free-preset, and have their own check path.
 */
function collectFreePresetCommands(matcherGroups) {
  const cmds = [];
  if (!Array.isArray(matcherGroups)) return cmds;
  for (const group of matcherGroups) {
    if (!Array.isArray(group?.hooks)) continue;
    for (const entry of group.hooks) {
      if (!isRuneManaged(entry)) continue;
      if (TIER_ENV_RE.test(entry.command)) continue; // tier entry — not our concern here
      cmds.push(entry.command);
    }
  }
  return cmds;
}

/**
 * Format drift result as human-readable lines.
 *
 * @param {Awaited<ReturnType<typeof checkHookDrift>>} result
 * @returns {string}
 */
export function formatHookDriftResult(result) {
  const lines = [];
  lines.push('  Hook Drift Report');
  lines.push('  ──────────────────');

  if (result.platforms.length === 0) {
    lines.push('');
    lines.push('  ℹ No installed Rune hooks detected on Claude. Run `rune hooks install --preset gentle` first.');
    return lines.join('\n');
  }

  for (const { platform, preset } of result.platforms) {
    lines.push(`  Platform: ${platform} (preset: ${preset})`);
  }
  lines.push('');

  if (result.findings.length === 0) {
    lines.push('  ✓ All Rune-managed entries match canonical preset.');
    return lines.join('\n');
  }

  for (const f of result.findings) {
    if (f.status === 'mixed-preset' || f.status === 'error') {
      lines.push(`  ⚠ ${f.platform}: ${f.message}`);
    } else if (f.status === 'missing') {
      lines.push(`  ✗ ${f.platform} ${f.event}: missing canonical entry`);
      lines.push(`      expected: ${f.expected}`);
    } else if (f.status === 'drift') {
      lines.push(`  ✗ ${f.platform} ${f.event}: drift — installed command not in canonical preset`);
      lines.push(`      actual:   ${f.actual}`);
    }
  }

  lines.push('');
  lines.push(`  Summary: ${result.summary.drifted} drifted, ${result.summary.missing} missing, ${result.summary.errors} error(s).`);
  lines.push('  Resolution: re-run `rune hooks install --preset <gentle|strict>` to re-converge.');
  lines.push('  This is a reporter — operator decides what to do with the findings.');

  return lines.join('\n');
}
