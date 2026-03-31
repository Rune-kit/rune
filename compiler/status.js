/**
 * Status — Project Neofetch
 *
 * Shows a rich boxed dashboard of the current Rune project.
 * Output varies by detected tier: Free, Pro, Business.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSkill } from './parser.js';

// ─── Constants ───

// ─── Box Drawing ───

function box(lines, { title = '', width = 52 } = {}) {
  const inner = width - 2;
  const output = [];

  const titleStr = title ? ` ${title} ` : '';
  const topFill = inner - titleStr.length - 1;
  output.push(`╭─${titleStr}${'─'.repeat(Math.max(topFill, 0))}╮`);

  for (const line of lines) {
    const dw = displayWidth(line);
    const pad = inner - dw;
    output.push(`│ ${line}${' '.repeat(Math.max(pad, 0))}│`);
  }

  output.push(`╰${'─'.repeat(inner + 1)}╯`);
  return output.join('\n');
}

function displayWidth(str) {
  let w = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    // Emoji and wide chars take 2 columns
    if (
      code > 0x1f600 ||
      (code >= 0x2600 && code <= 0x27bf) ||
      (code >= 0x2700 && code <= 0x27bf) ||
      code === 0x2713 ||
      code === 0x2717 ||
      code === 0x2192 ||
      code === 0x2593 ||
      code === 0x2591
    ) {
      w += 1; // These specific Unicode symbols are single-width in most terminals
    } else if (code > 0xffff) {
      w += 2; // Emoji (surrogate pairs) are double-width
    } else {
      w += 1;
    }
  }
  return w;
}

function progressBar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

// ─── Data Collection ───

export async function collectStats(runeRoot, tierSources = {}) {
  const skillsDir = path.join(runeRoot, 'skills');
  const extDir = path.join(runeRoot, 'extensions');

  // Count core skills by layer
  const layers = { L0: 0, L1: 0, L2: 0, L3: 0 };
  const skillNames = [];
  let signalCount = 0;
  const signalMap = { emitters: {}, listeners: {} };
  const parsedSkills = [];

  if (existsSync(skillsDir)) {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const content = await readFile(skillFile, 'utf-8');
      const parsed = parseSkill(content, skillFile);
      parsedSkills.push(parsed);
      skillNames.push(parsed.name);

      const layer = parsed.layer || 'L3';
      if (layers[layer] !== undefined) layers[layer]++;

      if (parsed.signals?.emit && parsed.signals?.listen) {
        for (const sig of parsed.signals.emit) {
          if (!signalMap.emitters[sig]) signalMap.emitters[sig] = [];
          signalMap.emitters[sig].push(parsed.name);
        }
        for (const sig of parsed.signals.listen) {
          if (!signalMap.listeners[sig]) signalMap.listeners[sig] = [];
          signalMap.listeners[sig].push(parsed.name);
        }
      }
    }
    const allSignals = new Set([...Object.keys(signalMap.emitters), ...Object.keys(signalMap.listeners)]);
    signalCount = allSignals.size;
  }

  // Count connections
  let totalConnections = 0;
  for (const skill of parsedSkills) {
    totalConnections += new Set((skill.crossRefs ?? []).map((r) => r.skillName)).size;
  }
  const avgConnections = parsedSkills.length > 0 ? (totalConnections / parsedSkills.length).toFixed(1) : '0';

  // Count free packs
  const freePacks = [];
  if (existsSync(extDir)) {
    const entries = await readdir(extDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const packFile = path.join(extDir, entry.name, 'PACK.md');
      if (!existsSync(packFile)) continue;
      freePacks.push(entry.name);
    }
  }

  // Count Pro packs
  const proPacks = await scanTierPacks(tierSources.pro);
  const bizPacks = await scanTierPacks(tierSources.business);

  // Detect tier
  const tier = bizPacks.length > 0 ? 'business' : proPacks.length > 0 ? 'pro' : 'free';

  return {
    tier,
    skillCount: parsedSkills.length,
    layers,
    signalCount,
    signalMap,
    totalConnections,
    avgConnections,
    freePacks,
    proPacks,
    bizPacks,
    parsedSkills,
  };
}

async function scanTierPacks(tierDir) {
  const packs = [];
  if (!tierDir || !existsSync(tierDir)) return packs;

  const entries = await readdir(tierDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packDir = path.join(tierDir, entry.name);
    const packFile = path.join(packDir, 'PACK.md');
    if (!existsSync(packFile)) continue;

    // Count total lines in pack
    let lines = 0;
    const subEntries = await readdir(packDir, { withFileTypes: true });
    for (const sub of subEntries) {
      if (sub.isFile() && sub.name.endsWith('.md')) {
        const content = await readFile(path.join(packDir, sub.name), 'utf-8');
        lines += content.split('\n').length;
      }
    }

    packs.push({ name: entry.name, lines });
  }
  return packs;
}

// ─── Rendering ───

function tierIcon(tier) {
  if (tier === 'business') return '🏢';
  if (tier === 'pro') return '⚡';
  return '🔮';
}

function tierLabel(tier) {
  if (tier === 'business') return 'Rune Business';
  if (tier === 'pro') return 'Rune Pro';
  return 'Rune';
}

function fmtNum(n) {
  return n.toLocaleString('en-US');
}

export function renderStatus(stats, { version = '', platform = '', projectName = '' } = {}) {
  const lines = [];
  const icon = tierIcon(stats.tier);
  const label = tierLabel(stats.tier);

  // Header
  lines.push('');

  // Project info
  if (projectName) lines.push(`Project     ${projectName}`);
  if (platform) lines.push(`Platform    ${platform}`);
  if (version) lines.push(`Version     ${version}`);
  if (projectName || platform || version) lines.push('');

  // Core stats
  const layerStr = Object.entries(stats.layers)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  lines.push(`Skills      ${stats.skillCount} core (${layerStr})`);

  const packParts = [`${stats.freePacks.length} free`];
  if (stats.proPacks.length > 0) packParts.push(`${stats.proPacks.length} pro`);
  if (stats.bizPacks.length > 0) packParts.push(`${stats.bizPacks.length} business`);
  lines.push(`Packs       ${packParts.join(' + ')}`);

  lines.push(`Signals     ${stats.signalCount} defined`);
  lines.push(`Mesh        ${stats.totalConnections}+ connections (${stats.avgConnections} avg/skill)`);
  lines.push('');

  // Health bar (based on signals + connections + pack count as simple heuristic)
  const healthScore = computeHealth(stats);
  lines.push(`${progressBar(healthScore)} ${healthScore}% mesh health`);
  lines.push('');

  // Pro section
  if (stats.proPacks.length > 0) {
    lines.push('Pro Packs');
    for (const pack of stats.proPacks) {
      lines.push(`  ✓ ${formatPackName(pack.name, 'pro')}  ${fmtNum(pack.lines)} lines`);
    }
    lines.push('');
  }

  // Business section
  if (stats.bizPacks.length > 0) {
    lines.push('Business Packs');
    for (const pack of stats.bizPacks) {
      lines.push(`  ✓ ${formatPackName(pack.name, 'business')}  ${fmtNum(pack.lines)} lines`);
    }
    lines.push('');
  }

  // Top signals (show signal flow)
  const topSignals = getTopSignals(stats.signalMap, 3);
  if (topSignals.length > 0) {
    lines.push('Active Signals');
    for (const sig of topSignals) {
      const emitters = sig.emitters.slice(0, 2).join(', ');
      const listeners = sig.listeners.slice(0, 3).join(', ');
      let sigLine = `  → ${sig.name} (${emitters} → ${listeners})`;
      if (sigLine.length > 64) sigLine = `${sigLine.slice(0, 61)}...`;
      lines.push(sigLine);
    }
    lines.push('');
  }

  const title = `${icon} ${label}`;
  const maxLineLen = lines.reduce((max, l) => Math.max(max, displayWidth(l)), 48);
  const boxWidth = Math.min(Math.max(maxLineLen + 4, 52), 72);

  return box(lines, { title, width: boxWidth });
}

export function renderStatusJson(stats, { version = '', platform = '', projectName = '' } = {}) {
  return JSON.stringify(
    {
      project: projectName || undefined,
      platform: platform || undefined,
      version: version || undefined,
      tier: stats.tier,
      skills: {
        total: stats.skillCount,
        layers: stats.layers,
      },
      packs: {
        free: stats.freePacks.length,
        pro: stats.proPacks.map((p) => ({ name: p.name, lines: p.lines })),
        business: stats.bizPacks.map((p) => ({ name: p.name, lines: p.lines })),
      },
      signals: {
        count: stats.signalCount,
        top: getTopSignals(stats.signalMap, 5).map((s) => ({
          name: s.name,
          emitters: s.emitters,
          listeners: s.listeners,
        })),
      },
      mesh: {
        connections: stats.totalConnections,
        avgPerSkill: parseFloat(stats.avgConnections),
      },
      health: computeHealth(stats),
    },
    null,
    2,
  );
}

function formatPackName(dirName, tier = 'free') {
  const baseName = dirName.replace(/^(pro|business)-/, '');
  if (tier === 'business') return `@rune-biz/${baseName}`.padEnd(26);
  if (tier === 'pro') return `@rune-pro/${baseName}`.padEnd(26);
  return `@rune/${baseName}`.padEnd(26);
}

function getTopSignals(signalMap, limit) {
  const signals = new Set([...Object.keys(signalMap.emitters), ...Object.keys(signalMap.listeners)]);

  const scored = [...signals].map((name) => ({
    name,
    emitters: signalMap.emitters[name] || [],
    listeners: signalMap.listeners[name] || [],
    score: (signalMap.emitters[name]?.length || 0) + (signalMap.listeners[name]?.length || 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function computeHealth(stats) {
  let score = 0;

  // Skills (max 25)
  score += Math.min(stats.skillCount / 60, 1) * 25;

  // Signals (max 25)
  score += Math.min(stats.signalCount / 15, 1) * 25;

  // Connections density (max 25)
  const avgConn = parseFloat(stats.avgConnections);
  score += Math.min(avgConn / 3.5, 1) * 25;

  // Pack coverage (max 25)
  const totalPacks = stats.freePacks.length + stats.proPacks.length + stats.bizPacks.length;
  score += Math.min(totalPacks / 14, 1) * 25;

  return Math.round(score);
}
