/**
 * Governance Collector
 *
 * Assembles .rune/governance.json from three best-effort sources:
 *   1. Gate fires  — skill-frequency counts from analytics (.rune/metrics/)
 *   2. Signals     — static mesh signal definitions from the visualizer
 *   3. Compliance  — obligations declared in Business pack PACK.md files
 *
 * Phase-3 known capture gaps (updated from Phase 1):
 *
 *   GAP-1  Gate outcomes (passed / bypassed / blocked) — PARTIALLY FILLED in Phase 3.
 *            pre-tool-guard now appends a structured record to
 *            .rune/metrics/gate-outcomes.jsonl when it decides to BLOCK (exit code 2).
 *            This file is read here and populates the `blocked` count + most-recent `ts`
 *            for the "privacy-mesh" gate.
 *            STILL uncaptured: `passed` and `bypassed` outcomes remain 0 because they
 *            are not observable at the hook layer without instrumenting every allow/pass
 *            path — which would add noise without signal value.
 *
 *   GAP-2  Gate timestamps — no PER-INVOCATION timestamp is captured.  Best-effort:
 *            the `ts` field carries the date-only `last_used` from skills.json when
 *            available, else null.  A gate-outcome hook would provide real per-fire ts.
 *
 *   GAP-6  `fired` is an INVOCATION count (cumulative total_invocations from
 *            skills.json, or windowed session-PRESENCE as fallback) — NOT a count of
 *            gate pass/fail events, and not strictly windowed when sourced from the
 *            cumulative totals file.  Pair with GAP-1: outcomes remain uncaptured.
 *
 *   GAP-3  Signal runtime counts — collectGraphData() returns static mesh
 *            definitions (emit / listen pairs) from the INSTALLED RUNE mesh
 *            (runeRoot/skills/**), not the buyer's app, and not runtime emission
 *            counts.  Signal `count` is always 0 until a runtime signal log is wired.
 *
 *   GAP-4  Compliance status — Business pack PACK.md files declare obligations
 *            (Constraints + Done-When items) but there is no automated outcome
 *            capture.  All compliance entries are marked status:"unknown".
 *
 *   GAP-5  Decision provenance — no provenance capture source exists in Phase 1.
 *            The decisions[] array is always [].  A future journal/ADR hook or
 *            xlabs_log_decision integration would feed this field.
 *
 * None of the above gaps cause this function to throw — they degrade gracefully.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { collectGraphData } from './visualizer.js';

// ─── Gate skill list ───────────────────────────────────────────────────────────
// These are the governance / quality-gate skills tracked in the mesh.
// Add new gate skills here as they are introduced.
const GATE_SKILLS = [
  'sentinel',
  'sentinel-env',
  'preflight',
  'completion-gate',
  'logic-guardian',
  'constraint-check',
  'hallucination-guard',
  'integrity-check',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJsonl(content) {
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Load sessions.jsonl + skills.json from .rune/metrics/ in runeRoot.
 * Returns empty structures on any error — never throws.
 */
async function loadMetrics(runeRoot) {
  const metricsDir = path.join(runeRoot, '.rune', 'metrics');

  let sessions = [];
  try {
    const sessionsPath = path.join(metricsDir, 'sessions.jsonl');
    if (existsSync(sessionsPath)) {
      sessions = readJsonl(await readFile(sessionsPath, 'utf-8'));
    }
  } catch {
    /* degrade silently */
  }

  let skillTotals = {};
  try {
    const skillsPath = path.join(metricsDir, 'skills.json');
    if (existsSync(skillsPath)) {
      const raw = JSON.parse(await readFile(skillsPath, 'utf-8'));
      skillTotals = raw.skills || {};
    }
  } catch {
    /* degrade silently */
  }

  return { sessions, skillTotals };
}

/**
 * Filter sessions to the lookback window (inclusive).
 */
function filterByDays(sessions, days) {
  if (!days || days <= 0) return sessions;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= cutoffStr);
}

/**
 * Return the body of a "## <heading>" markdown section up to the next "## "
 * heading or end-of-file. Index-based (no fragile regex end-anchor — JS has no \Z).
 */
function extractSection(content, heading) {
  const start = content.search(new RegExp(`^##\\s+${heading}\\s*$`, 'm'));
  if (start === -1) return '';
  const body = content.slice(start).replace(/^##[^\n]*\n/, ''); // drop heading line
  const next = body.search(/^##\s/m);
  return next === -1 ? body : body.slice(0, next);
}

// ─── Gate-outcome capture reader ─────────────────────────────────────────────

/**
 * Read .rune/metrics/gate-outcomes.jsonl and return a map of
 *   gate → { blocked: number, latestTs: string|null }
 *
 * Only "blocked" outcomes are currently captured (pre-tool-guard Phase 3).
 * passed/bypassed remain uncaptured — see GAP-1.
 *
 * Never throws — degrades to empty map on any error.
 */
async function loadGateOutcomes(runeRoot) {
  const outFile = path.join(runeRoot, '.rune', 'metrics', 'gate-outcomes.jsonl');
  const result = new Map(); // gate → { blocked, latestTs }

  try {
    if (!existsSync(outFile)) return result;
    const raw = await readFile(outFile, 'utf-8');
    for (const record of readJsonl(raw)) {
      if (!record || typeof record.gate !== 'string') continue;
      const gate = record.gate;
      const existing = result.get(gate) || { blocked: 0, latestTs: null };

      if (record.outcome === 'blocked') {
        existing.blocked += 1;
        // Keep the most-recent ts (ISO string compare works lexicographically)
        if (record.ts && (!existing.latestTs || record.ts > existing.latestTs)) {
          existing.latestTs = record.ts;
        }
      }
      result.set(gate, existing);
    }
  } catch {
    /* degrade silently */
  }

  return result;
}

// ─── Gate assembly ────────────────────────────────────────────────────────────

/**
 * Assemble gates[] — one entry per governance gate skill with activity.
 *
 * `fired` = cumulative invocation count from skills.json `total_invocations`
 * (the TRUE fire count the producer accumulates), falling back to windowed
 * session-PRESENCE when skills.json is absent. See GAP-6 — this is an
 * invocation count, NOT a pass/fail outcome.
 */
async function assembleGates(runeRoot, days) {
  const [{ sessions, skillTotals }, gateOutcomes] = await Promise.all([
    loadMetrics(runeRoot),
    loadGateOutcomes(runeRoot),
  ]);
  const filtered = filterByDays(sessions, days);

  // Windowed session-PRESENCE: number of sessions in the window that invoked the
  // gate. NOTE: sessions.skills_used is DEDUPED per session by the producer
  // (post-session-reflect writes Object.keys(skillCounts)), so this counts
  // "sessions that used the gate", not individual fires. Used only as a fallback.
  const sessionPresence = {};
  for (const session of filtered) {
    if (!Array.isArray(session.skills_used)) continue;
    for (const skill of session.skills_used) {
      if (GATE_SKILLS.includes(skill)) {
        sessionPresence[skill] = (sessionPresence[skill] || 0) + 1;
      }
    }
  }

  // skills.json shape (from post-session-reflect): { <skill>: { total_invocations, last_used } }
  const totalFires = (name) => {
    const rec = skillTotals[name];
    return rec && typeof rec === 'object' ? rec.total_invocations || 0 : 0;
  };
  const lastUsedTs = (name) => {
    const rec = skillTotals[name];
    return rec && typeof rec === 'object' && rec.last_used ? `${rec.last_used}T00:00:00.000Z` : null;
  };

  const allGateNames = new Set([
    ...Object.keys(sessionPresence),
    ...GATE_SKILLS.filter((g) => totalFires(g) > 0),
    ...gateOutcomes.keys(),
  ]);

  if (allGateNames.size === 0) return [];

  return Array.from(allGateNames).map((name) => {
    const outcomes = gateOutcomes.get(name) || { blocked: 0, latestTs: null };
    // Prefer outcome ts over skills.json date when a real block event was recorded
    const ts = outcomes.latestTs || lastUsedTs(name);
    return {
      name,
      // Cumulative true fire count; windowed session-presence as fallback (GAP-6).
      fired: totalFires(name) || sessionPresence[name] || 0,
      // GAP-1 (Phase 3 partial fill): blocked IS now captured from gate-outcomes.jsonl.
      // passed/bypassed remain 0 — not observable at the hook layer.
      passed: 0,
      bypassed: 0,
      blocked: outcomes.blocked,
      // Best-effort ts: real block event ts when available, else last_used from skills.json.
      ts,
    };
  });
}

// ─── Signal assembly ──────────────────────────────────────────────────────────

/**
 * Extract signal definitions from the static mesh via collectGraphData.
 * Returns signals[] with from/to derived from signalEdges.
 *
 * GAP-3: runtime counts are always 0 until signal emission is logged.
 */
async function assembleSignals(runeRoot) {
  let graphData;
  try {
    graphData = await collectGraphData(runeRoot);
  } catch {
    return []; // degrade if skills dir is missing or parse fails
  }

  const { signalEdges } = graphData;
  if (!Array.isArray(signalEdges) || signalEdges.length === 0) return [];

  // Deduplicate: one entry per (signal name, from, to) triple.
  const seen = new Map();
  for (const edge of signalEdges) {
    const key = `${edge.signal}::${edge.source}::${edge.target}`;
    if (!seen.has(key)) {
      seen.set(key, {
        name: edge.signal,
        from: edge.source || null,
        to: edge.target || null,
        // GAP-3: no runtime count available in Phase 1
        count: 0,
      });
    }
  }

  return Array.from(seen.values());
}

// ─── Compliance assembly ──────────────────────────────────────────────────────

/**
 * Extract compliance obligations from Business PACK.md files.
 * Looks for Business pack at <runeRoot>/../Business/extensions/pro-*.
 *
 * Obligations are extracted from the ## Constraints and ## Done When sections —
 * the same sections Business PACK.md authors already maintain.
 *
 * GAP-4: outcomes are always "unknown" until automated verification exists.
 */
async function assembleCompliance(runeRoot) {
  const bizExtDir = path.join(runeRoot, '..', 'Business', 'extensions');
  if (!existsSync(bizExtDir)) return [];

  let packDirs;
  try {
    const entries = await readdir(bizExtDir, { withFileTypes: true });
    packDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  const obligations = [];

  for (const packDir of packDirs) {
    const packFile = path.join(bizExtDir, packDir, 'PACK.md');
    if (!existsSync(packFile)) continue;

    let content;
    try {
      content = await readFile(packFile, 'utf-8');
    } catch {
      continue; // skip unreadable pack
    }

    // Business is the entitlement tier; paid pack manifests retain the
    // canonical @rune-pro/* namespace for mesh compatibility.
    const packName = packDir.replace(/^pro-/, '@rune-pro/');

    // Extract obligations from ## Constraints. Real Business PACK.md files use
    // numbered ("1. MUST …") OR bulleted ("- MUST …") lists, so accept both.
    const constraintsBody = extractSection(content, 'Constraints');
    const listItem = /^(?:[-*]|\d+\.)\s+(.*)$/;
    for (const raw of constraintsBody.split('\n')) {
      const m = raw.trim().match(listItem);
      if (!m) continue;
      const text = m[1].trim();
      if (!/^(MUST|NEVER)\b/.test(text)) continue;
      obligations.push({
        pack: packName,
        obligation: text,
        // GAP-4: no automated outcome verification yet
        status: 'unknown',
      });
    }

    // Extract checkbox items from ## Done When (only checked boxes are "met").
    const doneWhenBody = extractSection(content, 'Done When');
    for (const raw of doneWhenBody.split('\n')) {
      const line = raw.trim();
      const cb = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
      if (!cb) continue;
      const met = cb[1] === 'x' || cb[1] === 'X';
      obligations.push({
        pack: packName,
        obligation: cb[2].trim(),
        // Only mark "met" if the checkbox is checked in the PACK.md itself;
        // otherwise unknown because we cannot verify runtime outcomes.
        status: met ? 'met' : 'unknown',
      });
    }
  }

  return obligations;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assemble a governance.json object conforming to governance.schema.json.
 *
 * @param {string} runeRoot - Absolute path to the Free repo root (the directory
 *   that contains the `skills/` and `.rune/` directories).
 * @param {number} [days=30] - Lookback window in days for gate fire counts.
 * @returns {Promise<object>} Governance record (never throws — degrades gracefully).
 */
export async function assembleGovernance(runeRoot, days = 30) {
  const [gates, signals, compliance] = await Promise.all([
    assembleGates(runeRoot, days).catch(() => []),
    assembleSignals(runeRoot).catch(() => []),
    assembleCompliance(runeRoot).catch(() => []),
  ]);

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    gates,
    signals,
    compliance,
    // GAP-5: decision provenance has no capture source in Phase 1.
    // A future journal ADR hook or xlabs_log_decision integration would feed this.
    decisions: [],
  };
}
