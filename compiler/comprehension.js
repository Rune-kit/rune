/**
 * Comprehension HTML Generator
 *
 * Generates a fully self-contained HTML dashboard from merged comprehension +
 * governance + analytics + mesh data. No CDN, no external requests, no fonts
 * loaded over the network — font stacks fall back to system fonts.
 *
 * XSS safety: the DATA object is embedded via JSON with `</` → `<\/` escaping
 * so a project name containing `</script>` cannot break out of the script tag.
 *
 * Layout mirrors dashboard-mockup.html (Signal Teal palette, contour bg,
 * Verdict hero, 5-tab nav, KPI row) but driven by real data.
 */

import { CLIENT_SCRIPT } from './comprehension-client.js';

/**
 * Embed a value as safe inline JSON (escapes `</` so script injection is
 * impossible even when the data contains `</script>`). Also escapes
 * U+2028 (LS) and U+2029 (PS) which are valid JSON but illegal in JS
 * string literals, preventing line-terminator injection.
 * @param {unknown} value
 * @returns {string}
 */
// Regex patterns for U+2028/U+2029 built via String.fromCharCode so linters
// (Biome/Prettier) cannot normalize the literal characters to spaces.
const _LINE_SEP_RE = new RegExp(String.fromCharCode(0x2028), 'g'); // U+2028 LINE SEPARATOR
const _PARA_SEP_RE = new RegExp(String.fromCharCode(0x2029), 'g'); // U+2029 PARAGRAPH SEPARATOR
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(_LINE_SEP_RE, '\\u2028')
    .replace(_PARA_SEP_RE, '\\u2029');
}

/**
 * Compute a Verdict health score (0-100) from the merged data object.
 *
 * Formula (each dimension contributes up to 25 pts):
 *   A. Comprehension depth  — modules present → up to 25 pts
 *   B. Gate coverage        — gate skills fired → up to 25 pts
 *   C. Compliance           — met/total obligations ratio → up to 25 pts
 *   D. Analytics activity   — sessions > 0 → up to 25 pts
 *
 * Returns null when there is no basis (all four dimensions are empty/zero)
 * so the UI can show "—" rather than a fabricated number.
 *
 * @param {object} data
 * @returns {{ score: number|null, basis: string[] }}
 */
export function computeVerdictScore(data) {
  const basis = [];
  let total = 0;
  let hasBasis = false;

  // A. Comprehension depth (0–25)
  const modules = Array.isArray(data.modules) ? data.modules : [];
  if (modules.length > 0) {
    hasBasis = true;
    basis.push('comprehension');
    const pts = Math.min(25, Math.round((modules.length / 20) * 25));
    total += pts;
  }

  // B. Gate coverage (0–25) — only count when at least one gate has actually fired
  // (gates.length > 0 with zero fired must NOT contribute to hasBasis — no fabricated score)
  const gates = Array.isArray(data.gates) ? data.gates : [];
  const firedGates = gates.filter((g) => (g.fired || 0) > 0);
  if (firedGates.length > 0) {
    hasBasis = true;
    basis.push('governance');
    // Reward coverage: GATE_SKILLS has 8 skills, full coverage = 25 pts
    const TOTAL_GATE_SKILLS = 8;
    const pts = Math.min(25, Math.round((firedGates.length / TOTAL_GATE_SKILLS) * 25));
    total += pts;
  }

  // C. Compliance (0–25) — met / (met + unknown + gap) obligations
  const compliance = Array.isArray(data.compliance) ? data.compliance : [];
  if (compliance.length > 0) {
    hasBasis = true;
    basis.push('compliance');
    const met = compliance.filter((c) => c.status === 'met').length;
    const pts = Math.round((met / compliance.length) * 25);
    total += pts;
  }

  // D. Analytics activity (0–25) — non-zero sessions
  const sessions = data.overview?.total_sessions ?? 0;
  if (sessions > 0) {
    hasBasis = true;
    basis.push('analytics');
    // Up to 25 pts; 20 sessions = full points
    const pts = Math.min(25, Math.round((sessions / 20) * 25));
    total += pts;
  }

  if (!hasBasis) return { score: null, basis: [] };
  return { score: Math.min(100, total), basis };
}

/**
 * Canonical list of all Rune core skills — single source of truth for the
 * "installed skills" denominator used in the ROI panel and KPI counters.
 * Update this list whenever a skill is added or removed from the Free tier.
 */
const ALL_KNOWN_SKILLS = [
  'cook',
  'plan',
  'scout',
  'brainstorm',
  'design',
  'skill-forge',
  'debug',
  'fix',
  'test',
  'review',
  'db',
  'sentinel',
  'preflight',
  'onboard',
  'deploy',
  'marketing',
  'perf',
  'autopsy',
  'safeguard',
  'surgeon',
  'audit',
  'incident',
  'review-intake',
  'logic-guardian',
  'ba',
  'docs',
  'mcp-builder',
  'adversary',
  'retro',
  'graft',
  'improve-architecture',
  'research',
  'docs-seeker',
  'trend-scout',
  'problem-solver',
  'sequential-thinking',
  'verification',
  'hallucination-guard',
  'completion-gate',
  'constraint-check',
  'sast',
  'integrity-check',
  'context-engine',
  'context-pack',
  'journal',
  'session-bridge',
  'neural-memory',
  'worktree',
  'watchdog',
  'scope-guard',
  'browser-pilot',
  'asset-creator',
  'video-creator',
  'slides',
  'dependency-doctor',
  'git',
  'doc-processor',
  'sentinel-env',
  'team',
  'launch',
  'rescue',
  'scaffold',
  'skill-router',
];

/**
 * Generate the fully self-contained comprehension dashboard HTML string.
 *
 * @param {object} data - Merged data from comprehension.json + governance.json +
 *   getAllAnalytics() + collectGraphData(). All fields optional — degrades gracefully.
 * @returns {string} Complete HTML document (no external requests).
 */
export function generateComprehensionHTML(data) {
  // Normalise and provide safe defaults for every field we touch
  const d = Object.assign(
    {
      project: '',
      generated_at: null,
      health_score: null,
      modules: [],
      edges: [],
      layers: [],
      domains: [],
      // governance
      gates: [],
      signals: [],
      compliance: [],
      decisions: [],
      window_days: 30,
      // analytics
      overview: {},
      skillFrequency: [],
      modelDistribution: [],
      skillHeatmap: { heatmap: [], dates: [], maxCount: 1 },
      sessionTimeline: [],
      skillChains: [],
      totalInstalledSkills: ALL_KNOWN_SKILLS.length, // single source of truth
      // mesh
      skillMesh: { nodes: [], edges: [] },
      // Phase 5b — tier gating (defaults to 'free' when not supplied by cmdDashboard)
      tier: 'free',
      hasPro: false,
      hasBusiness: false,
    },
    data,
  );

  // Verdict score — prefer comprehension.json health_score if present, else compute
  // Clamp + NaN-guard the override so bad JSON values never render as >100 or NaN
  const { score: computedScore, basis: scoreBasis } = computeVerdictScore(d);
  const verdictScore = Number.isFinite(d.health_score) ? Math.max(0, Math.min(100, d.health_score)) : computedScore;

  // Plain-language verdict sentence (escHtml applied to d.project — flows into <h1> via verdictLine)
  const projectLabel = d.project ? `Project "${escHtml(d.project)}"` : 'Your project';
  const firedCount = (d.gates || []).filter((g) => (g.fired || 0) > 0).length;
  const complianceTotal = (d.compliance || []).length;
  const complianceMet = (d.compliance || []).filter((c) => c.status === 'met').length;
  const skillsActive = d.overview?.total_skill_invocations ? (d.skillFrequency?.length ?? 0) : 0;
  const totalSkills = ALL_KNOWN_SKILLS.length; // single source of truth — ALL_KNOWN_SKILLS array

  let verdictLine;
  if (verdictScore === null) {
    verdictLine = `${projectLabel} — no session data yet. Run Rune skills to start collecting metrics.`;
  } else if (verdictScore >= 75) {
    verdictLine = `${projectLabel} is <b>healthy</b> — ${firedCount} gate${firedCount !== 1 ? 's' : ''} active${complianceMet > 0 ? `, ${complianceMet}/${complianceTotal} obligations met` : ''}.`;
  } else if (verdictScore >= 40) {
    verdictLine =
      firedCount > 0
        ? `${projectLabel} is <b>developing</b> — gates active: ${firedCount}. Grow coverage to improve score.`
        : `${projectLabel} is <b>developing</b> — no gate fires recorded yet. Grow coverage to improve score.`;
  } else {
    verdictLine = `${projectLabel} needs <b>attention</b> — limited gate coverage and session data so far.`;
  }

  // Delta (compare health_score vs computed score as a rough diff, show only when both exist)
  let deltaHtml = '';
  if (typeof d.health_score === 'number' && computedScore !== null && d.health_score !== computedScore) {
    const diff = d.health_score - computedScore;
    const cls = diff >= 0 ? 'up' : 'dn';
    const arrow = diff >= 0 ? '▲' : '▼';
    deltaHtml = `<span class="delta ${cls}">${arrow} ${diff >= 0 ? '+' : ''}${diff}</span>`;
  }

  const generatedDate = d.generated_at
    ? new Date(d.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // KPI values (safe — never show NaN)
  const gatesFired = (d.gates || []).reduce((s, g) => s + (g.fired || 0), 0);
  const compliancePct = complianceTotal > 0 ? Math.round((complianceMet / complianceTotal) * 100) : null;
  const sessions = d.overview?.total_sessions ?? 0;

  // Profile: initial persona seeded from d.profile (read by cmdDashboard from .rune/dashboard-profile.json).
  // Clamp persona to known values so a tampered dashboard-profile.json can't produce an incoherent view.
  // 'mylens' is a Pro-only persona — only valid when hasPro is true.
  const _VALID_PERSONAS = d.hasPro ? ['exec', 'compliance', 'eng', 'mylens'] : ['exec', 'compliance', 'eng'];
  const initialPersona = _VALID_PERSONAS.includes(d.profile?.persona) ? d.profile.persona : 'exec';
  const initialPinned = Array.isArray(d.profile?.pinnedConcerns) ? d.profile.pinnedConcerns : [];

  // Embed data safely
  const dataJson = safeJson({
    project: d.project,
    generated_at: d.generated_at,
    health_score: d.health_score,
    verdictScore,
    scoreBasis,
    modules: d.modules,
    edges: d.edges,
    layers: d.layers,
    domains: d.domains,
    gates: d.gates,
    signals: d.signals,
    compliance: d.compliance,
    decisions: d.decisions,
    overview: d.overview,
    skillFrequency: d.skillFrequency,
    modelDistribution: d.modelDistribution,
    skillMesh: d.skillMesh,
    window_days: d.window_days,
    initialPersona,
    initialPinned,
    // Phase 5a
    skillHeatmap: d.skillHeatmap || { heatmap: [], dates: [], maxCount: 1 },
    sessionTimeline: d.sessionTimeline || [],
    skillChains: d.skillChains || [],
    totalInstalledSkills: ALL_KNOWN_SKILLS.length, // single source of truth
    // Phase 5b — tier gating
    tier: d.tier,
    hasPro: d.hasPro,
    hasBusiness: d.hasBusiness,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rune Dashboard${d.project ? ` — ${escHtml(d.project)}` : ''}</title>
<style>
/* ── Reset ── */
*{box-sizing:border-box;margin:0;padding:0}

/* ── Design tokens (Signal Teal, dark-first) ── */
:root{
  --bg-base:#0b1120;--bg-card:#111a2e;--bg-elevated:#1b2740;--bg-graph:#080d1a;
  --accent:#2dd4bf;--accent-hover:#5eead4;--accent-deep:#0d9488;--accent-on:#04201b;
  --accent-glow:0 0 24px rgba(45,212,191,.35);
  --text-primary:#f1f5f9;--text-secondary:#94a3b8;
  --text-tertiary:#64748b;--text-disabled:#475569;
  --border:#1e293b;--border-strong:#334155;--border-accent:rgba(45,212,191,.45);
  --pass:#10b981;--warn:#f59e0b;--fail:#ef4444;--info:#38bdf8;--stale:#64748b;
  --c-code:#2dd4bf;--c-service:#60a5fa;--c-data:#a78bfa;
  --c-domain:#fbbf24;--c-docs:#f472b6;--c-infra:#38bdf8;--c-concept:#34d399;
  --r-card:12px;--r-el:8px;--r-pill:9999px;
  --shadow-sm:0 1px 2px rgba(0,0,0,.3);
  --shadow-md:0 4px 12px rgba(0,0,0,.35);
  --shadow-lg:0 12px 32px rgba(0,0,0,.45);
  --font-display:"Space Grotesk",ui-sans-serif,system-ui,sans-serif;
  --font-body:"Inter",ui-sans-serif,system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,Consolas,monospace;
  --t-fast:150ms ease;--t-normal:250ms ease;
}

/* ── Base ── */
body{
  font-family:var(--font-body);color:var(--text-primary);
  background:var(--bg-base);min-height:100vh;
  position:relative;overflow-x:hidden;padding-bottom:60px;
}

/* ── Background: glow blooms (always on) ── */
body::after{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(900px 600px at 12% -5%, rgba(45,212,191,.10), transparent 60%),
    radial-gradient(800px 500px at 100% 110%, rgba(56,130,246,.08), transparent 55%);
}

/* ── Background: contour texture (LOCKED) ── */
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.9;
  background-image:
    repeating-radial-gradient(circle at 20% 30%, transparent 0 38px, rgba(148,163,184,.07) 38px 39px),
    repeating-radial-gradient(circle at 85% 80%, transparent 0 46px, rgba(45,212,191,.06) 46px 47px);
}

/* ── Layout ── */
.wrap{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:20px 28px}

/* ── Header ── */
header.top{
  display:flex;align-items:center;gap:18px;padding:10px 0 18px;
  border-bottom:1px solid var(--border);flex-wrap:wrap;
}
.logo{
  display:flex;align-items:center;gap:9px;
  font-family:var(--font-display);font-weight:700;font-size:17px;
  color:var(--text-primary);text-decoration:none;
}
.logo .dot{
  width:13px;height:13px;border-radius:3px;
  background:var(--accent);box-shadow:var(--accent-glow);
  flex-shrink:0;
}

/* ── Tabs ── */
nav.tabs{
  display:flex;gap:2px;background:var(--bg-card);padding:4px;
  border-radius:var(--r-pill);border:1px solid var(--border);
}
.tab{
  font:500 13px var(--font-body);color:var(--text-secondary);
  padding:7px 15px;border-radius:var(--r-pill);cursor:pointer;
  border:none;background:transparent;transition:all var(--t-fast);
  min-height:44px;
}
.tab.active{background:var(--bg-elevated);color:var(--accent);}
.tab:hover:not(.active){color:var(--text-primary);}
.tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* ── Persona toggle ── */
.persona{
  margin-left:auto;display:flex;gap:2px;background:var(--bg-card);
  padding:4px;border-radius:var(--r-el);border:1px solid var(--border);
}
.persona button{
  font:500 12px var(--font-body);color:var(--text-secondary);
  padding:6px 12px;border:none;background:transparent;
  border-radius:6px;cursor:pointer;transition:all var(--t-fast);
  min-height:44px;
}
.persona button.on{background:var(--bg-elevated);color:var(--text-primary);}
.persona button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* ── Tab panels ── */
.tab-panel{display:none;}
.tab-panel.active{display:block;}

/* ── Verdict hero ── */
.hero{
  position:relative;margin-top:22px;padding:30px 34px;
  border-radius:var(--r-card);background:var(--bg-card);
  border:1px solid var(--border);overflow:hidden;
}
.hero::before{
  content:"";position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,var(--accent),transparent 60%);
}
.hero::after{
  content:"";position:absolute;top:-120px;left:-80px;
  width:380px;height:380px;
  background:radial-gradient(circle, rgba(45,212,191,.16),transparent 70%);
  pointer-events:none;
}
.hero .live{
  display:inline-flex;align-items:center;gap:7px;font-size:11px;
  letter-spacing:.08em;text-transform:uppercase;
  color:var(--text-tertiary);margin-bottom:12px;
}
.hero .live i{
  width:8px;height:8px;border-radius:50%;
  background:var(--accent);box-shadow:var(--accent-glow);
  animation:pulse 2s infinite;
}
.hero h1{
  font-family:var(--font-display);font-weight:500;font-size:23px;
  line-height:1.35;max-width:680px;color:var(--text-primary);
}
.hero h1 b{font-weight:700;color:var(--accent);}
.scoreRow{
  display:flex;align-items:flex-end;gap:18px;margin-top:18px;
  position:relative;z-index:1;flex-wrap:wrap;
}
.score{
  font-family:var(--font-mono);font-weight:700;font-size:76px;
  line-height:.9;color:#f8fafc;
  text-shadow:0 0 28px rgba(45,212,191,.4);
}
.score small{font-size:26px;color:var(--text-tertiary);}
.delta{
  font-family:var(--font-mono);font-weight:700;font-size:15px;
  padding:5px 11px;border-radius:var(--r-pill);margin-bottom:8px;
}
.delta.up{color:var(--pass);background:rgba(16,185,129,.13);}
.delta.dn{color:var(--fail);background:rgba(239,68,68,.13);}
.meta{margin-bottom:12px;color:var(--text-secondary);font-size:13px;}
.meta b{color:var(--text-primary);font-family:var(--font-mono);}

/* ── KPI row ── */
.kpis{
  display:grid;grid-template-columns:repeat(4,1fr);
  gap:16px;margin-top:18px;
}
.kpi{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r-card);padding:18px 20px;
  transition:transform var(--t-normal),box-shadow var(--t-normal),border-color var(--t-normal);
}
.kpi:hover{
  transform:translateY(-2px);box-shadow:var(--shadow-lg);
  border-color:var(--border-strong);
}
.k-lbl{
  font-size:11px;text-transform:uppercase;letter-spacing:.05em;
  color:var(--text-tertiary);
}
.k-val{
  font-family:var(--font-mono);font-weight:700;font-size:30px;
  margin-top:8px;color:var(--text-primary);
}
.k-sub{font-size:12px;margin-top:6px;color:var(--text-secondary);}
.k-sub.up{color:var(--pass);}
.k-sub.warn{color:var(--warn);}

/* ── Two-column layout ── */
.cols{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;margin-top:16px;}
.panel{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r-card);padding:20px;
}
.panel h3{
  font:600 14px var(--font-body);margin-bottom:14px;
  display:flex;align-items:center;gap:8px;color:var(--text-primary);
}
.panel h3 .pill{
  font:500 10px var(--font-body);text-transform:uppercase;letter-spacing:.05em;
  color:var(--accent);background:rgba(45,212,191,.12);
  padding:2px 8px;border-radius:var(--r-pill);
}

/* ── Tables ── */
table{width:100%;border-collapse:collapse;font-size:13px;}
th{
  text-align:left;font:500 11px var(--font-body);text-transform:uppercase;
  letter-spacing:.05em;color:var(--text-tertiary);
  padding:8px 6px;border-bottom:1px solid var(--border);
}
td{padding:11px 6px;border-bottom:1px solid var(--border);color:var(--text-secondary);}
td.mono{font-family:var(--font-mono);color:var(--text-primary);}
tr:last-child td{border-bottom:none;}

/* ── Status badges ── */
.st{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px;}
.st.pass{color:var(--pass);}
.st.warn{color:var(--warn);}
.st.fail{color:var(--fail);}
.st.info{color:var(--info);}

/* ── Graph panel ── */
.graph-wrap{
  background:var(--bg-graph);border-radius:var(--r-el);
  height:280px;position:relative;overflow:hidden;
}
.legend{
  display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;
  font-size:11px;color:var(--text-secondary);
}
.legend i{
  display:inline-block;width:9px;height:9px;border-radius:50%;
  margin-right:5px;vertical-align:middle;
}

/* ── Empty state ── */
.empty{
  text-align:center;padding:60px 20px;color:var(--text-tertiary);
}
.empty h4{
  font-family:var(--font-display);font-size:18px;margin-bottom:10px;
  color:var(--text-secondary);
}
.empty p{max-width:440px;margin:0 auto;line-height:1.7;font-size:13px;}

/* ── Section gap ── */
.section{margin-top:20px;}

/* ── Skill bar chart ── */
.skill-bar-row{
  display:flex;align-items:center;gap:8px;margin-bottom:6px;
}
.skill-bar-name{
  font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);
  width:110px;flex-shrink:0;text-align:right;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.skill-bar-track{
  flex:1;height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden;
}
.skill-bar-fill{
  height:100%;background:var(--accent);border-radius:4px;opacity:.8;
  transition:width 600ms cubic-bezier(.34,1.56,.64,1);
}
.skill-bar-count{
  font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary);
  width:30px;text-align:right;flex-shrink:0;
}

/* ── Compliance list ── */
.compliance-item{
  padding:10px 0;border-bottom:1px solid var(--border);
  font-size:12px;color:var(--text-secondary);display:flex;gap:10px;align-items:flex-start;
}
.compliance-item:last-child{border-bottom:none;}
.compliance-pack{
  font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);
  flex-shrink:0;width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.compliance-text{flex:1;line-height:1.5;}

/* ── Govern tab additions (Phase 3) ── */
.govern-scorecard{
  display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;
}
.govern-scorecard .kpi{margin-top:0;}
.govern-3col{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-top:0;}
.govern-full{margin-top:16px;}
.govern-provenance{margin-top:16px;}
/* Coverage map */
.cov-pack{margin-bottom:14px;}
.cov-pack-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:5px;font-size:12px;
}
.cov-pack-name{
  font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;
}
.cov-bar-track{height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden;}
.cov-bar-fill{height:100%;border-radius:3px;background:var(--pass);}
.cov-items{margin-top:6px;}
.cov-item{
  display:flex;gap:8px;align-items:flex-start;
  padding:5px 0;border-bottom:1px solid var(--border);font-size:11px;
}
.cov-item:last-child{border-bottom:none;}
.cov-item-text{flex:1;color:var(--text-secondary);line-height:1.45;}
/* Pinned pack highlight */
.cov-pack.pinned>.cov-pack-header>.cov-pack-name{color:var(--accent);}
.cov-pack.pinned{
  border-left:2px solid var(--accent-deep);padding-left:8px;
}
/* Blocked-events sub-table */
.blocked-events{margin-top:8px;}
.blocked-events summary{
  font-size:11px;color:var(--text-tertiary);cursor:pointer;
  padding:4px 0;list-style:none;
}
.blocked-events summary:hover{color:var(--text-secondary);}
.blocked-events table{margin-top:6px;}
/* Persona-gated visibility */
.persona-exec-hide{} /* default: show */
.persona-compliance-hide{}
.persona-eng-hide{}
/* Applied dynamically via JS */
[data-persona-hide]{display:none!important;}
/* Blocks-caught badge */
.blocks-badge{
  display:inline-flex;align-items:center;gap:4px;
  font-family:var(--font-mono);font-size:11px;font-weight:700;
  color:var(--fail);background:rgba(239,68,68,.10);
  padding:2px 8px;border-radius:var(--r-pill);
}
/* Profile actions */
.profile-bar{
  display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;
}
.profile-bar button{
  font:500 11px var(--font-body);padding:5px 12px;border-radius:var(--r-el);
  border:1px solid var(--border-strong);background:transparent;
  color:var(--text-secondary);cursor:pointer;transition:all var(--t-fast);
}
.profile-bar button:hover{background:var(--bg-elevated);color:var(--text-primary);border-color:var(--accent);}
.profile-bar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.profile-bar .profile-status{font-size:11px;color:var(--text-tertiary);}
/* Govern-full multi-section layout */
.govern-sections{display:flex;flex-direction:column;gap:16px;margin-top:16px;}

/* ── Understand graph canvas ── */
#understand-canvas{width:100%;height:100%;display:block;cursor:crosshair;}

/* ── Understand tab: Phase 4 additions ── */
/* Filter panel */
.u-layout{display:grid;grid-template-columns:200px 1fr;gap:16px;margin-top:12px;}
.u-filters{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r-card);padding:14px;font-size:12px;
  display:flex;flex-direction:column;gap:14px;
}
.u-filters h4{
  font:600 11px var(--font-body);text-transform:uppercase;letter-spacing:.06em;
  color:var(--text-tertiary);
}
.u-filter-group{display:flex;flex-direction:column;gap:5px;}
.u-filter-group-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:4px;
}
.u-filter-group-label{
  font:600 10px var(--font-body);text-transform:uppercase;letter-spacing:.06em;
  color:var(--text-tertiary);
}
.u-quick-btns{display:flex;gap:4px;}
.u-quick-btn{
  font:500 9px var(--font-body);padding:2px 6px;border-radius:3px;
  border:1px solid var(--border-strong);background:transparent;
  color:var(--text-tertiary);cursor:pointer;
}
.u-quick-btn:hover{color:var(--text-primary);border-color:var(--accent);}
.u-quick-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
.u-check-row{
  display:flex;align-items:center;gap:6px;
  color:var(--text-secondary);cursor:pointer;
}
.u-check-row input[type=checkbox]{accent-color:var(--accent);cursor:pointer;}
.u-check-label{font-size:11px;}
.u-badge{
  display:inline-block;min-width:16px;text-align:center;
  font-family:var(--font-mono);font-size:9px;
  background:var(--bg-elevated);border-radius:var(--r-pill);
  padding:1px 4px;color:var(--text-tertiary);margin-left:auto;
}
/* Main panel */
.u-main{display:flex;flex-direction:column;gap:12px;}
/* Graph toolbar */
.u-toolbar{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
.u-search-wrap{flex:1;min-width:160px;position:relative;}
.u-search{
  width:100%;padding:7px 10px 7px 32px;
  background:var(--bg-elevated);border:1px solid var(--border);
  border-radius:var(--r-el);color:var(--text-primary);font-size:12px;
  font-family:var(--font-body);
}
.u-search::placeholder{color:var(--text-tertiary);}
.u-search:focus{outline:none;border-color:var(--accent);}
.u-search-icon{
  position:absolute;left:9px;top:50%;transform:translateY(-50%);
  color:var(--text-tertiary);font-size:12px;pointer-events:none;
}
.u-toggle-btn{
  font:500 11px var(--font-body);padding:7px 12px;
  border:1px solid var(--border-strong);border-radius:var(--r-el);
  background:transparent;color:var(--text-secondary);cursor:pointer;
  transition:all var(--t-fast);white-space:nowrap;
}
.u-toggle-btn:hover{background:var(--bg-elevated);color:var(--text-primary);}
.u-toggle-btn.active{background:rgba(45,212,191,.12);border-color:var(--accent);color:var(--accent);}
.u-toggle-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
/* Export buttons */
.u-export-group{display:flex;gap:6px;}
.u-export-btn{
  font:500 10px var(--font-body);padding:6px 10px;
  border:1px solid var(--border-strong);border-radius:var(--r-el);
  background:transparent;color:var(--text-tertiary);cursor:pointer;
  transition:all var(--t-fast);
}
.u-export-btn:hover{background:var(--bg-elevated);color:var(--text-primary);}
.u-export-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
/* Graph area (canvas) */
.u-graph-wrap{
  background:var(--bg-graph);border-radius:var(--r-el);
  height:320px;position:relative;overflow:hidden;
}
/* Node inspector side panel */
.u-inspector{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r-card);padding:14px;font-size:12px;display:none;
}
.u-inspector.visible{display:block;}
.u-inspector h4{
  font:600 13px var(--font-body);color:var(--text-primary);margin-bottom:10px;
  display:flex;align-items:center;justify-content:space-between;
}
.u-inspector-close{
  background:transparent;border:none;color:var(--text-tertiary);
  cursor:pointer;font-size:14px;padding:2px 4px;
}
.u-inspector-close:hover{color:var(--text-primary);}
.u-inspector-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.u-insp-row{
  display:flex;gap:8px;margin-bottom:7px;align-items:baseline;
}
.u-insp-label{
  font:500 10px var(--font-body);text-transform:uppercase;letter-spacing:.05em;
  color:var(--text-tertiary);min-width:72px;flex-shrink:0;
}
.u-insp-val{color:var(--text-secondary);line-height:1.4;font-size:11px;}
.u-insp-summary{
  margin:8px 0 0;padding:8px;background:var(--bg-elevated);
  border-radius:var(--r-el);color:var(--text-secondary);
  font-size:11px;line-height:1.55;
}
.u-insp-relations{margin-top:10px;}
.u-insp-relations-label{
  font:500 10px var(--font-body);text-transform:uppercase;letter-spacing:.05em;
  color:var(--text-tertiary);margin-bottom:5px;
}
.u-rel-item{
  display:flex;align-items:center;gap:5px;font-size:10px;
  color:var(--text-secondary);padding:3px 0;border-bottom:1px solid var(--border);
}
.u-rel-item:last-child{border-bottom:none;}
.u-rel-dir{
  font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);
  min-width:16px;text-align:center;
}
.u-complexity-badge{
  display:inline-block;font-size:9px;font-weight:600;text-transform:uppercase;
  padding:1px 6px;border-radius:var(--r-pill);letter-spacing:.04em;
}
.u-complexity-badge.simple{background:rgba(16,185,129,.15);color:var(--pass);}
.u-complexity-badge.moderate{background:rgba(245,158,11,.15);color:var(--warn);}
.u-complexity-badge.complex{background:rgba(239,68,68,.15);color:var(--fail);}
/* Domain view */
.u-domain-view{
  display:grid;grid-auto-flow:column;grid-auto-columns:min(220px,80vw);
  gap:12px;overflow-x:auto;padding-bottom:8px;
}
.u-domain-col{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r-card);padding:14px;
  display:flex;flex-direction:column;gap:10px;
}
.u-domain-name{
  font:700 12px var(--font-display);color:var(--accent);margin-bottom:4px;
}
.u-domain-summary{
  font-size:10px;color:var(--text-tertiary);line-height:1.5;
}
.u-flow{
  border-left:2px solid var(--border-strong);padding-left:10px;
}
.u-flow-name{
  font:600 11px var(--font-body);color:var(--text-primary);margin-bottom:5px;
}
.u-step{
  font-size:10px;color:var(--text-secondary);padding:3px 0;
  border-bottom:1px dashed var(--border);display:flex;align-items:flex-start;gap:5px;
}
.u-step:last-child{border-bottom:none;}
.u-step-num{
  font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);
  min-width:14px;margin-top:1px;
}
/* Tour panel */
.u-tour-panel{
  background:var(--bg-card);border:1px solid var(--border-accent);
  border-radius:var(--r-card);padding:14px;font-size:12px;
  display:none;
}
.u-tour-panel.visible{display:block;}
.u-tour-header{
  display:flex;align-items:center;gap:10px;margin-bottom:10px;
  font:600 13px var(--font-body);color:var(--text-primary);
}
.u-tour-header span{flex:1;}
.u-tour-close{
  background:transparent;border:none;color:var(--text-tertiary);
  cursor:pointer;font-size:14px;
}
.u-tour-close:hover{color:var(--text-primary);}
.u-tour-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.u-tour-body{display:flex;gap:12px;}
.u-tour-steps{width:130px;flex-shrink:0;display:flex;flex-direction:column;gap:3px;}
.u-tour-step-item{
  font-size:10px;padding:5px 7px;border-radius:5px;cursor:pointer;
  color:var(--text-tertiary);border:1px solid transparent;
  transition:all var(--t-fast);
}
.u-tour-step-item:hover{color:var(--text-secondary);background:var(--bg-elevated);}
.u-tour-step-item.active{
  color:var(--accent);background:rgba(45,212,191,.1);
  border-color:var(--accent-deep);
}
.u-tour-step-item:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.u-tour-detail{flex:1;}
.u-tour-step-label{
  font:700 12px var(--font-body);color:var(--text-primary);margin-bottom:5px;
}
.u-tour-step-summary{
  font-size:11px;color:var(--text-secondary);line-height:1.55;
  background:var(--bg-elevated);padding:8px;border-radius:var(--r-el);
}
.u-tour-nav{display:flex;gap:6px;margin-top:10px;}
.u-tour-nav-btn{
  font:500 11px var(--font-body);padding:6px 14px;
  border:1px solid var(--border-strong);border-radius:var(--r-el);
  background:transparent;color:var(--text-secondary);cursor:pointer;
  transition:all var(--t-fast);
}
.u-tour-nav-btn:hover{background:var(--bg-elevated);color:var(--text-primary);}
.u-tour-nav-btn:disabled{opacity:.35;cursor:default;}
.u-tour-nav-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.u-tour-counter{font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary);margin-left:auto;display:flex;align-items:center;}
/* Graph legend (reused below canvas) */
.u-legend{
  display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;
  font-size:11px;color:var(--text-secondary);
}
.u-legend i{
  display:inline-block;width:9px;height:9px;border-radius:50%;
  margin-right:4px;vertical-align:middle;
}
.u-search-match-count{font-size:11px;color:var(--text-tertiary);white-space:nowrap;}
@media(max-width:880px){
  .u-layout{grid-template-columns:1fr;}
  .u-filters{display:grid;grid-template-columns:repeat(3,1fr);}
}
@media(max-width:540px){
  .u-layout{grid-template-columns:1fr;}
  .u-filters{grid-template-columns:1fr;}
}

/* ── Improve placeholder ── */
.improve-placeholder{
  display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:80px 20px;gap:16px;text-align:center;
}
.improve-placeholder .ip-icon{font-size:40px;opacity:.3;}
.improve-placeholder h4{
  font-family:var(--font-display);font-size:20px;color:var(--text-secondary);
}
.improve-placeholder p{
  font-size:13px;color:var(--text-tertiary);max-width:420px;line-height:1.7;
}

/* ── Phase 5a: Measure enrichment ── */
/* Skill-ROI section */
.roi-grid{
  display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;
}
.roi-card{
  background:var(--bg-elevated);border-radius:var(--r-el);
  padding:14px;font-size:12px;
}
.roi-card-title{
  font:500 10px var(--font-body);text-transform:uppercase;letter-spacing:.06em;
  color:var(--text-tertiary);margin-bottom:8px;
}
.roi-chip{
  display:inline-flex;align-items:center;gap:5px;
  font-family:var(--font-mono);font-size:11px;
  background:var(--bg-card);border-radius:var(--r-pill);
  padding:3px 9px;margin:2px;color:var(--text-secondary);border:1px solid var(--border);
}
.roi-chip.active{color:var(--accent);border-color:rgba(45,212,191,.3);}
.roi-chip.dormant{color:var(--text-secondary);border-color:transparent;}
.roi-stat{
  font-family:var(--font-mono);font-weight:700;font-size:22px;
  color:var(--text-primary);margin-bottom:4px;
}
.roi-stat-sub{font-size:11px;color:var(--text-secondary);}

/* Heatmap */
.heatmap-wrap{overflow-x:auto;margin-top:10px;}
.heatmap-table{border-collapse:collapse;font-size:10px;min-width:400px;}
.heatmap-table th{
  font:500 9px var(--font-body);text-transform:uppercase;letter-spacing:.04em;
  color:var(--text-tertiary);padding:3px 4px;text-align:left;
  white-space:nowrap;
}
.hm-skill-label{
  font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);
  max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  padding-right:6px;
}
.hm-cell{
  width:16px;height:16px;border-radius:2px;
  transition:opacity var(--t-fast);
}
.hm-cell:hover{opacity:.7;}
/* Timeline */
.timeline-list{display:flex;flex-direction:column;gap:8px;margin-top:10px;}
.timeline-item{
  background:var(--bg-elevated);border-radius:var(--r-el);
  padding:10px 12px;display:flex;align-items:flex-start;gap:10px;
  border-left:2px solid var(--border-strong);
}
.timeline-item.primary{border-left-color:var(--accent);}
.timeline-date{
  font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);
  flex-shrink:0;width:72px;
}
.timeline-skills{
  flex:1;display:flex;flex-wrap:wrap;gap:4px;
}
.timeline-skill-chip{
  font-family:var(--font-mono);font-size:9px;
  background:var(--bg-card);border-radius:3px;
  padding:2px 6px;color:var(--text-secondary);border:1px solid var(--border);
}
.timeline-skill-chip.primary-skill{
  color:var(--accent);border-color:rgba(45,212,191,.3);
}
.timeline-meta{
  font-size:10px;color:var(--text-tertiary);flex-shrink:0;text-align:right;
  width:60px;
}

/* ── Phase 5a: Improve tab cards ── */
.improve-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
  gap:14px;margin-top:16px;
}
.improve-card{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r-card);padding:16px;
  border-left:3px solid var(--border-strong);
  transition:transform var(--t-fast),box-shadow var(--t-fast);
}
.improve-card:hover{
  transform:translateY(-1px);box-shadow:var(--shadow-md);
}
.improve-card.sev-warn{border-left-color:var(--warn);}
.improve-card.sev-info{border-left-color:var(--info);}
.improve-card.sev-pass{border-left-color:var(--pass);}
.improve-card-header{
  display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;
}
.improve-card-icon{font-size:16px;flex-shrink:0;margin-top:1px;}
.improve-card-title{
  font:600 13px var(--font-body);color:var(--text-primary);flex:1;
  line-height:1.3;
}
.improve-sev-badge{
  font:600 9px var(--font-body);text-transform:uppercase;letter-spacing:.06em;
  padding:2px 7px;border-radius:var(--r-pill);flex-shrink:0;
}
.improve-sev-badge.warn{background:rgba(245,158,11,.15);color:var(--warn);}
.improve-sev-badge.info{background:rgba(56,189,248,.15);color:var(--info);}
.improve-sev-badge.pass{background:rgba(16,185,129,.15);color:var(--pass);}
.improve-card-body{
  font-size:12px;color:var(--text-secondary);line-height:1.6;
}
.improve-card-action{
  margin-top:10px;padding-top:10px;border-top:1px solid var(--border);
  font-size:11px;color:var(--text-tertiary);display:flex;gap:6px;align-items:baseline;
}
.improve-card-action b{color:var(--accent);font-weight:600;}
.improve-header{
  display:flex;align-items:baseline;gap:12px;margin-bottom:4px;
}
.improve-header h3{
  font:600 15px var(--font-display);color:var(--text-primary);
}
.improve-header .improve-count{
  font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary);
}
.improve-subhead{
  font-size:12px;color:var(--text-tertiary);margin-bottom:16px;line-height:1.5;
}

/* ── Canvas keyboard accessibility (sr-only node list) ── */
.sr-only{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;
}
/* Canvas focus ring */
#understand-canvas:focus-visible{
  outline:2px solid var(--accent);outline-offset:2px;
}
/* Focused node ring — drawn on canvas, not CSS */

/* ── Tier upsell panel (Govern tab — free tier) ── */
.tier-upsell{
  display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:60px 20px 48px;gap:18px;text-align:center;
}
.tier-upsell .upsell-icon{
  font-size:36px;opacity:.5;line-height:1;
  pointer-events:none;
}
.tier-upsell h3{
  font-family:var(--font-display);font-size:22px;font-weight:600;
  color:var(--text-primary);max-width:440px;line-height:1.3;
}
.tier-upsell .upsell-desc{
  font-size:13px;color:var(--text-secondary);max-width:480px;line-height:1.7;
}
.upsell-features{
  display:flex;flex-direction:column;gap:8px;
  max-width:400px;text-align:left;
}
.upsell-feature{
  display:flex;align-items:flex-start;gap:8px;
  font-size:12px;color:var(--text-secondary);line-height:1.5;
}
.upsell-feature-icon{
  font-size:14px;flex-shrink:0;margin-top:1px;
  pointer-events:none;
}
.upsell-how{
  margin-top:4px;font-size:11px;color:var(--text-tertiary);
  background:var(--bg-elevated);border-radius:var(--r-el);
  padding:10px 16px;max-width:400px;line-height:1.65;
}
.upsell-how code{
  font-family:var(--font-mono);font-size:10px;
  background:var(--bg-card);padding:1px 6px;border-radius:3px;
  border:1px solid var(--border);color:var(--accent);
}

/* ── My Lens persona (Pro) ── */
/* My Lens reuses existing measure-panel styles — no new classes needed.
   The panel content is injected by renderMyLens() into govern-content. */
.mylens-header{
  display:flex;align-items:center;gap:10px;padding:16px 0 8px;
  border-bottom:1px solid var(--border);margin-bottom:16px;
}
.mylens-badge{
  font:600 10px var(--font-body);text-transform:uppercase;letter-spacing:.06em;
  padding:2px 8px;border-radius:var(--r-pill);
  background:rgba(45,212,191,.12);color:var(--accent);flex-shrink:0;
}
.mylens-title{
  font-family:var(--font-display);font-size:16px;font-weight:600;
  color:var(--text-primary);
}
.mylens-sub{
  font-size:11px;color:var(--text-tertiary);margin-left:auto;
}
.mylens-kpis{
  display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;
}
.mylens-kpis .kpi{margin:0;}
@media(max-width:640px){.mylens-kpis{grid-template-columns:1fr 1fr;}}

/* ── Footer ── */
.footer{
  text-align:center;margin-top:28px;
  font-size:11px;color:var(--text-tertiary);line-height:1.8;
}

/* ── Animations ── */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* ── Motion guard ── */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important;}
}

/* ── Responsive ── */
@media(max-width:880px){
  .kpis{grid-template-columns:repeat(2,1fr);}
  .cols{grid-template-columns:1fr;}
  .score{font-size:52px;}
  nav.tabs{flex-wrap:wrap;}
}
@media(max-width:480px){
  .kpis{grid-template-columns:1fr;}
  .wrap{padding:12px 14px;}
}
</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <header class="top">
    <div class="logo" role="banner">
      <span class="dot" aria-hidden="true"></span>
      Rune${d.project ? ` &mdash; ${escHtml(d.project)}` : ''}
    </div>
    <nav class="tabs" role="tablist" aria-label="Dashboard tabs">
      <button class="tab active" role="tab" aria-selected="true" aria-controls="panel-verdict" id="tab-verdict">Verdict</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="panel-govern" id="tab-govern">Govern</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="panel-measure" id="tab-measure">Measure</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="panel-understand" id="tab-understand">Understand</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="panel-improve" id="tab-improve">Improve</button>
    </nav>
    <div class="persona" role="group" aria-label="Persona view — changes section emphasis">
      <button data-persona="exec" aria-pressed="${initialPersona === 'exec' ? 'true' : 'false'}" class="${initialPersona === 'exec' ? 'on' : ''}">Exec</button>
      <button data-persona="compliance" aria-pressed="${initialPersona === 'compliance' ? 'true' : 'false'}" class="${initialPersona === 'compliance' ? 'on' : ''}">Compliance</button>
      <button data-persona="eng" aria-pressed="${initialPersona === 'eng' ? 'true' : 'false'}" class="${initialPersona === 'eng' ? 'on' : ''}">Eng</button>
      ${d.hasPro ? `<button data-persona="mylens" aria-pressed="${initialPersona === 'mylens' ? 'true' : 'false'}" class="${initialPersona === 'mylens' ? 'on' : ''}" title="Pro: personal cost, gates fired, and skill ROI focus">My Lens</button>` : ''}
    </div>
  </header>

  <main id="dash-main">

  <!-- ── VERDICT TAB ── -->
  <div class="tab-panel active" id="panel-verdict" role="tabpanel" aria-labelledby="tab-verdict">

    <!-- Verdict hero -->
    <section class="hero" aria-label="Project verdict">
      <div class="live" aria-label="Generated date">
        <i aria-hidden="true"></i>
        Generated ${escHtml(generatedDate)}
      </div>
      <h1 id="verdict-line">${verdictLine}</h1>
      <div class="scoreRow">
        <div class="score" id="verdict-score" aria-label="Health score: ${verdictScore !== null ? `${verdictScore} out of 100` : 'not available'}">
          ${
            verdictScore !== null
              ? `<span id="score-num">${verdictScore}</span><small>/100</small>`
              : `<span style="font-size:48px;color:var(--text-tertiary);">&mdash;</span><small>/100</small>`
          }
        </div>
        ${deltaHtml}
        <div class="meta">
          ${sessions > 0 ? `via <b>${sessions}</b> session${sessions !== 1 ? 's' : ''}` : 'no sessions yet'}
          ${skillsActive > 0 ? ` &bull; <b>${skillsActive}/${totalSkills}</b> skills active` : ''}
        </div>
      </div>
    </section>

    <!-- KPI row -->
    <section class="kpis" aria-label="Key metrics">
      <div class="kpi">
        <div class="k-lbl">Cost / feature</div>
        <div class="k-val" id="kpi-cost">&mdash;</div>
        <div class="k-sub">not captured yet</div>
      </div>
      <div class="kpi">
        <div class="k-lbl">Gates fired</div>
        <div class="k-val" id="kpi-gates" data-target="${gatesFired}">0</div>
        <div class="k-sub ${gatesFired > 0 ? 'up' : ''}">${gatesFired > 0 ? `${gatesFired} total invocations` : 'no gates yet'}</div>
      </div>
      <div class="kpi">
        <div class="k-lbl">Compliance</div>
        <div class="k-val" id="kpi-compliance">${compliancePct !== null ? `<span id="compliance-num">0</span>%` : '&mdash;'}</div>
        <div class="k-sub">${complianceTotal > 0 ? `${complianceMet}/${complianceTotal} obligations met` : 'no obligations captured'}</div>
      </div>
      <div class="kpi">
        <div class="k-lbl">Skills active</div>
        <div class="k-val" id="kpi-skills">${skillsActive > 0 ? `<span id="skills-num">0</span><span style="font-size:16px;color:var(--text-tertiary)">/${totalSkills}</span>` : '&mdash;'}</div>
        <div class="k-sub">${skillsActive > 0 ? `${totalSkills - skillsActive} dormant` : 'run skills to track'}</div>
      </div>
    </section>

  </div><!-- /panel-verdict -->

  <!-- ── GOVERN TAB ── -->
  <div class="tab-panel" id="panel-govern" role="tabpanel" aria-labelledby="tab-govern">
    <div class="section cols" id="govern-content">
      <!-- ledger + compliance rendered by JS -->
    </div>
  </div>

  <!-- ── MEASURE TAB ── -->
  <div class="tab-panel" id="panel-measure" role="tabpanel" aria-labelledby="tab-measure">
    <div class="section" id="measure-content">
      <!-- skill frequency + model distribution rendered by JS -->
    </div>
  </div>

  <!-- ── UNDERSTAND TAB ── -->
  <div class="tab-panel" id="panel-understand" role="tabpanel" aria-labelledby="tab-understand">
    <div class="section" id="understand-content">
      <!-- module graph rendered by JS -->
    </div>
  </div>

  <!-- ── IMPROVE TAB ── -->
  <div class="tab-panel" id="panel-improve" role="tabpanel" aria-labelledby="tab-improve">
    <div class="section" id="improve-content">
      <!-- data-driven improvement cards rendered by JS -->
    </div>
  </div>

  </main>

  <footer class="footer">
    Generated ${escHtml(generatedDate)}
    &bull; Rune Dashboard
    &bull; 100% local &mdash; no data leaves your machine
  </footer>

</div><!-- /wrap -->

<script>
// ── Safely embedded data ──
const D = ${dataJson};
${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// ── Template helper: HTML escape for server-side string insertion ──
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
