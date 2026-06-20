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
      // mesh
      skillMesh: { nodes: [], edges: [] },
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
  const totalSkills = 64; // canonical mesh size

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
  const _VALID_PERSONAS = ['exec', 'compliance', 'eng'];
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
    </div>
  </header>

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
    <div class="section">
      <div class="improve-placeholder">
        <div class="ip-icon" aria-hidden="true">&#128640;</div>
        <h4>Improve — coming soon</h4>
        <p>Prioritised improvement recommendations derived from governance gaps and comprehension depth will appear here in a future phase.</p>
      </div>
    </div>
  </div>

  <footer class="footer">
    Generated ${escHtml(generatedDate)}
    &bull; Rune Dashboard
    &bull; 100% local &mdash; no data leaves your machine
  </footer>

</div><!-- /wrap -->

<script>
// ── Safely embedded data ──
const D = ${dataJson};

// ── Helpers ──
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function safeInt(v){const n=parseInt(v,10);return isNaN(n)?0:n;}
function safePct(n,d){return d>0?Math.round(n/d*100):null;}

// ── Tab switching ──
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>{
    tabs.forEach(t=>{t.classList.remove('active');t.setAttribute('aria-selected','false');});
    panels.forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected','true');
    panels[i].classList.add('active');
    if(tab.id==='tab-understand') renderUnderstandGraph();
  });
});

// ── Profile state ──
// Loaded from D.initialPersona (seeded from .rune/dashboard-profile.json on generate).
// Also persisted to localStorage for instant UX within the same browser session.
const LS_KEY='rune_dashboard_profile';
const VALID_PERSONAS=['exec','compliance','eng'];
function clampPersona(v){
  return VALID_PERSONAS.includes(v)?v:(VALID_PERSONAS.includes(D.initialPersona)?D.initialPersona:'exec');
}
function loadProfile(){
  // Prefer localStorage (instant UX within session) over D.initialPersona.
  // Normalize shape on load: guard against missing/unknown fields from tampered storage.
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw){
      const p=JSON.parse(raw);
      return {
        persona:clampPersona(p?.persona),
        pinnedConcerns:Array.isArray(p?.pinnedConcerns)?p.pinnedConcerns:[],
      };
    }
  }catch{}
  return {persona:clampPersona(D.initialPersona),pinnedConcerns:Array.isArray(D.initialPinned)?D.initialPinned:[]};
}
function saveProfile(p){
  try{localStorage.setItem(LS_KEY,JSON.stringify(p));}catch{}
}
let currentProfile=loadProfile();

// ── Persona toggle ──
// Personas re-emphasize sections:
//   Exec       → scorecard + verdict prominent; raw tables de-emphasised
//   Compliance → compliance coverage + ledger first; details shown
//   Eng        → full detail including provenance + raw events
const PERSONA_LABELS={exec:'Exec',compliance:'Compliance',eng:'Eng'};
const PERSONA_DESCRIPTIONS={
  exec:'Scorecard and verdict at a glance.',
  compliance:'Compliance coverage and obligation ledger.',
  eng:'Full detail including raw events and provenance.',
};

function applyPersona(persona){
  currentProfile={...currentProfile,persona};
  saveProfile(currentProfile);

  // Update button states
  document.querySelectorAll('.persona button').forEach(b=>{
    const active=b.dataset.persona===persona;
    b.classList.toggle('on',active);
    b.setAttribute('aria-pressed',active?'true':'false');
  });

  // Section visibility/order — use data-persona-hide attribute
  // Exec: hide raw tables (.govern-eng-only), show scorecard first
  // Compliance: show coverage first (.govern-compliance-first reorder)
  // Eng: show everything
  document.querySelectorAll('[data-exec-hide]').forEach(el=>{
    el.style.display=persona==='exec'?'none':'';
  });
  document.querySelectorAll('[data-eng-only]').forEach(el=>{
    el.style.display=persona==='eng'?'':'none';
  });
  document.querySelectorAll('[data-compliance-priority]').forEach(el=>{
    el.style.order=persona==='compliance'?'-1':'0';
  });

  // Update profile status label
  const statusEl=document.getElementById('profile-status-label');
  if(statusEl)statusEl.textContent=PERSONA_DESCRIPTIONS[persona]||'';
}

document.querySelectorAll('.persona button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    applyPersona(btn.dataset.persona||'exec');
  });
});

// ── Count-up animation ──
function countUp(el,target,suffix,decimals,duration){
  if(!Number.isFinite(target))return; // guard: never write NaN or Infinity
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){
    el.textContent=target.toFixed(decimals)+suffix;return;
  }
  const steps=50,interval=Math.min(duration/steps,20);
  let cur=0;
  const inc=target/steps;
  const t=setInterval(()=>{
    cur+=inc;
    if(cur>=target){cur=target;clearInterval(t);}
    el.textContent=cur.toFixed(decimals)+suffix;
  },interval);
}

// ── Verdict score count-up ──
window.addEventListener('load',()=>{
  const scoreNum=document.getElementById('score-num');
  if(scoreNum && D.verdictScore!=null){
    countUp(scoreNum,D.verdictScore,'',0,800);
  }
  const gatesEl=document.getElementById('kpi-gates');
  const gatesTarget=D.gates ? D.gates.reduce((s,g)=>s+(g.fired||0),0) : 0;
  if(gatesEl && gatesTarget>0) countUp(gatesEl,gatesTarget,'',0,600);

  const compEl=document.getElementById('compliance-num');
  if(compEl && D.compliance && D.compliance.length>0){
    const met=D.compliance.filter(c=>c.status==='met').length;
    const pct=safePct(met,D.compliance.length);
    if(pct!==null) countUp(compEl,pct,'',0,600);
  }

  const skillsNum=document.getElementById('skills-num');
  if(skillsNum && D.skillFrequency && D.skillFrequency.length>0){
    countUp(skillsNum,D.skillFrequency.length,'',0,600);
  }
});

// ── Govern tab (Phase 3) ──
function renderGovern(){
  const container=document.getElementById('govern-content');
  if(!container)return;

  const gates=D.gates||[];
  const compliance=D.compliance||[];
  const decisions=D.decisions||[];
  const totalBlocks=gates.reduce((s,g)=>s+(g.blocked||0),0);
  const totalFired=gates.reduce((s,g)=>s+(g.fired||0),0);
  const met=compliance.filter(c=>c.status==='met').length;
  const compliancePct=compliance.length>0?Math.round(met/compliance.length*100):null;

  // ── Profile bar ──
  const profileBar=document.createElement('div');
  profileBar.className='profile-bar';
  profileBar.setAttribute('aria-label','Profile actions');
  const profileStatus=document.createElement('span');
  profileStatus.id='profile-status-label';
  profileStatus.className='profile-status';
  profileStatus.textContent='';
  const exportBtn=document.createElement('button');
  exportBtn.textContent='Export profile';
  exportBtn.setAttribute('aria-label','Download dashboard profile JSON');
  exportBtn.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(currentProfile,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='dashboard-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  profileBar.appendChild(profileStatus);
  profileBar.appendChild(exportBtn);
  container.appendChild(profileBar);

  // ── Govern sections wrapper (flex col for persona ordering) ──
  const sections=document.createElement('div');
  sections.className='govern-sections';
  container.appendChild(sections);

  // ── 1. Scorecard row ── (visible to all personas, prominent for Exec)
  const scorecard=document.createElement('div');
  scorecard.className='govern-scorecard';
  scorecard.setAttribute('aria-label','Governance scorecard');

  function kpiCell(label,val,sub,subClass){
    const d=document.createElement('div');
    d.className='kpi';
    d.innerHTML=
      '<div class="k-lbl">'+esc(label)+'</div>'+
      '<div class="k-val" style="font-size:22px">'+esc(String(val==null?'—':val))+'</div>'+
      (sub?'<div class="k-sub'+(subClass?' '+subClass:'')+'">'+esc(sub)+'</div>':'');
    return d;
  }

  scorecard.appendChild(kpiCell(
    'Compliance',
    compliancePct!==null?compliancePct+'%':'—',
    compliance.length>0?met+'/'+compliance.length+' obligations met':'no obligations captured',
    met>0?'up':'',
  ));
  scorecard.appendChild(kpiCell(
    'Gates fired',
    totalFired>0?totalFired:'—',
    totalFired>0?gates.length+' gate'+(gates.length!==1?'s':'')+' active':'no gates yet',
    totalFired>0?'up':'',
  ));
  scorecard.appendChild(kpiCell(
    'Blocks caught',
    totalBlocks>0?totalBlocks:'—',
    totalBlocks>0?'real block events captured':'not captured yet',
    totalBlocks>0?'warn':'',
  ));
  scorecard.appendChild(kpiCell(
    'Cost / feature',
    '—',
    'not captured yet',
    '',
  ));
  sections.appendChild(scorecard);

  // ── 2. Two-column: Gate ledger (left) + Compliance coverage map (right) ──
  const twoCol=document.createElement('div');
  twoCol.className='govern-3col';
  twoCol.setAttribute('data-compliance-priority','1'); // Compliance persona pulls this first
  sections.appendChild(twoCol);

  // ── 2a. Gate ledger ──
  const ledgerWrap=document.createElement('div');
  ledgerWrap.setAttribute('data-exec-hide','1'); // Exec hides raw ledger to show scorecard only
  twoCol.appendChild(ledgerWrap);

  const ledgerPanel=document.createElement('div');
  ledgerPanel.className='panel';
  ledgerWrap.appendChild(ledgerPanel);

  const ledgerTitle=document.createElement('h3');
  ledgerTitle.innerHTML='Governance Ledger <span class="pill">gate audit</span>';
  ledgerPanel.appendChild(ledgerTitle);

  if(gates.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='30px 10px';
    empty.innerHTML='<h4>No gates recorded yet</h4><p>Run Rune skills (sentinel, preflight, completion-gate, etc.) to start capturing gate fire events.</p>';
    ledgerPanel.appendChild(empty);
  } else {
    const tbl=document.createElement('table');
    tbl.setAttribute('aria-label','Governance gate ledger');
    tbl.innerHTML=
      '<thead><tr>'+
        '<th>Gate</th>'+
        '<th>Fired</th>'+
        '<th>Blocked</th>'+
        '<th>Passed / Bypassed</th>'+
        '<th>Last event</th>'+
      '</tr></thead>';
    const tbody=document.createElement('tbody');
    for(const g of gates){
      const tr=document.createElement('tr');
      const tsLabel=g.ts?new Date(g.ts).toLocaleDateString():'—';
      const blocked=safeInt(g.blocked);
      // passed/bypassed remain uncaptured (GAP-1 Phase 3 — honest label)
      const passedLabel='not captured';
      const blockedCell=blocked>0
        ?'<span class="blocks-badge" aria-label="'+blocked+' block'+(blocked!==1?'s':'')+' caught">&#x26A0; '+blocked+'</span>'
        :'<span style="color:var(--text-tertiary);font-size:11px">—</span>';
      tr.innerHTML=
        '<td class="mono">'+esc(g.name)+'</td>'+
        '<td class="mono">'+safeInt(g.fired)+'</td>'+
        '<td>'+blockedCell+'</td>'+
        '<td style="color:var(--text-tertiary);font-size:11px">'+esc(passedLabel)+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(tsLabel)+'</td>';
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    ledgerPanel.appendChild(tbl);

    // Blocked events detail (Eng persona only) — read from gate-outcomes embedded in gate data
    const blockedGates=gates.filter(g=>(g.blocked||0)>0);
    if(blockedGates.length>0){
      const detail=document.createElement('details');
      detail.className='blocked-events';
      detail.setAttribute('data-eng-only','1');
      const sum=document.createElement('summary');
      sum.textContent='Raw block events ('+totalBlocks+' total) — Eng view';
      detail.appendChild(sum);
      const mini=document.createElement('table');
      mini.setAttribute('aria-label','Raw block events');
      mini.innerHTML='<thead><tr><th>Gate</th><th>Blocks captured</th><th>Most recent</th></tr></thead>';
      const mb=document.createElement('tbody');
      for(const g of blockedGates){
        const mr=document.createElement('tr');
        mr.innerHTML=
          '<td class="mono" style="font-size:11px">'+esc(g.name)+'</td>'+
          '<td class="mono" style="font-size:11px">'+safeInt(g.blocked)+'</td>'+
          '<td style="font-size:11px;color:var(--text-tertiary)">'+esc(g.ts?new Date(g.ts).toLocaleString():'—')+'</td>';
        mb.appendChild(mr);
      }
      mini.appendChild(mb);
      detail.appendChild(mini);
      ledgerPanel.appendChild(detail);
    }
  }

  // ── 2b. Compliance coverage map ──
  const compWrap=document.createElement('div');
  twoCol.appendChild(compWrap);

  const compPanel=document.createElement('div');
  compPanel.className='panel';
  compWrap.appendChild(compPanel);

  const compTitle=document.createElement('h3');
  compTitle.innerHTML='Compliance Coverage <span class="pill">obligations</span>';
  compPanel.appendChild(compTitle);

  if(compliance.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='30px 10px';
    empty.innerHTML='<h4>No obligations captured</h4><p>Business pack PACK.md Constraints + Done-When sections declare obligations. Install Rune Business to see them here.</p>';
    compPanel.appendChild(empty);
  } else {
    // Group by pack
    const byPack=new Map();
    for(const c of compliance){
      if(!byPack.has(c.pack))byPack.set(c.pack,[]);
      byPack.get(c.pack).push(c);
    }

    // Pin controls
    const pinBar=document.createElement('div');
    pinBar.style.cssText='margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;';
    const pinLabel=document.createElement('span');
    pinLabel.style.cssText='font-size:11px;color:var(--text-tertiary);flex-shrink:0;';
    pinLabel.textContent='Pin pack:';
    pinBar.appendChild(pinLabel);
    for(const pk of byPack.keys()){
      const chip=document.createElement('button');
      chip.style.cssText='font:500 10px var(--font-mono);padding:2px 8px;border-radius:var(--r-pill);cursor:pointer;transition:all var(--t-fast);';
      chip.textContent=pk.split('/').pop()||pk;
      chip.title='Pin/unpin: '+pk;
      chip.setAttribute('aria-label','Pin pack '+pk);
      chip.setAttribute('aria-pressed',currentProfile.pinnedConcerns.includes(pk)?'true':'false');
      chip.style.border=currentProfile.pinnedConcerns.includes(pk)?'1px solid var(--accent)':'1px solid var(--border-strong)';
      chip.style.background=currentProfile.pinnedConcerns.includes(pk)?'rgba(45,212,191,.10)':'transparent';
      chip.style.color=currentProfile.pinnedConcerns.includes(pk)?'var(--accent)':'var(--text-secondary)';
      chip.addEventListener('click',()=>{
        const pinned=currentProfile.pinnedConcerns;
        const idx=pinned.indexOf(pk);
        const newPinned=idx>=0?pinned.filter(p=>p!==pk):[...pinned,pk];
        currentProfile={...currentProfile,pinnedConcerns:newPinned};
        saveProfile(currentProfile);
        // Re-render govern to reflect new pin state
        container.innerHTML='';
        renderGovern();
      });
      pinBar.appendChild(chip);
    }
    compPanel.appendChild(pinBar);

    // Coverage map: pinned packs first
    const sortedPacks=[...byPack.keys()].sort((a,b)=>{
      const aPin=currentProfile.pinnedConcerns.includes(a)?0:1;
      const bPin=currentProfile.pinnedConcerns.includes(b)?0:1;
      return aPin-bPin||a.localeCompare(b);
    });

    const covList=document.createElement('div');
    covList.setAttribute('aria-label','Compliance coverage by pack');
    for(const pk of sortedPacks){
      const items=byPack.get(pk);
      const pkMet=items.filter(c=>c.status==='met').length;
      const pkUnknown=items.filter(c=>c.status==='unknown').length;
      const pkGap=items.filter(c=>c.status==='gap'||c.status==='partial').length;
      const isPinned=currentProfile.pinnedConcerns.includes(pk);

      const packDiv=document.createElement('div');
      packDiv.className='cov-pack'+(isPinned?' pinned':'');

      // Pack header with bar
      const hdr=document.createElement('div');
      hdr.className='cov-pack-header';
      const nameSpan=document.createElement('span');
      nameSpan.className='cov-pack-name';
      nameSpan.title=pk;
      nameSpan.textContent=pk;
      const pctSpan=document.createElement('span');
      const pctVal=items.length>0?Math.round(pkMet/items.length*100):0;
      // Status pill for the pack: color+icon+text (never color-only per design system)
      let pkStClass='info',pkStIcon='?',pkStText='unknown';
      if(pkMet===items.length&&items.length>0){pkStClass='pass';pkStIcon='&#10003;';pkStText='all met';}
      else if(pkGap>0){pkStClass='fail';pkStIcon='&#10005;';pkStText=pkGap+' gap'+(pkGap!==1?'s':'');}
      else if(pkMet>0){pkStClass='warn';pkStIcon='&#9651;';pkStText=pkMet+'/'+items.length+' met';}
      pctSpan.innerHTML='<span class="st '+pkStClass+'" aria-label="Pack status: '+pkStText+'">'+pkStIcon+' '+esc(pkStText)+'</span>';
      hdr.appendChild(nameSpan);
      hdr.appendChild(pctSpan);
      packDiv.appendChild(hdr);

      // Coverage bar
      const barTrack=document.createElement('div');
      barTrack.className='cov-bar-track';
      barTrack.setAttribute('role','progressbar');
      barTrack.setAttribute('aria-valuenow',String(pctVal));
      barTrack.setAttribute('aria-valuemin','0');
      barTrack.setAttribute('aria-valuemax','100');
      barTrack.setAttribute('aria-label',pctVal+'% obligations met for '+pk);
      const barFill=document.createElement('div');
      barFill.className='cov-bar-fill';
      barFill.style.width=pctVal+'%';
      barFill.style.background=pkMet===items.length&&items.length>0?'var(--pass)':pkGap>0?'var(--fail)':'var(--warn)';
      barTrack.appendChild(barFill);
      packDiv.appendChild(barTrack);

      // Items (Compliance+Eng see all; Exec sees pack-level summary only)
      const itemsDiv=document.createElement('div');
      itemsDiv.className='cov-items';
      itemsDiv.setAttribute('data-exec-hide','1');
      for(const c of items){
        const row=document.createElement('div');
        row.className='cov-item';
        let stClass='info',stIcon='?',stText=c.status;
        if(c.status==='met'){stClass='pass';stIcon='&#10003;';stText='met';}
        else if(c.status==='gap'){stClass='fail';stIcon='&#10005;';stText='gap';}
        else if(c.status==='partial'){stClass='warn';stIcon='&#9651;';stText='partial';}
        else{stClass='info';stIcon='&#8253;';stText='not verified';}
        row.innerHTML=
          '<span class="st '+stClass+'" aria-label="Status: '+esc(stText)+'" style="flex-shrink:0;margin-top:1px">'+stIcon+'</span>'+
          '<span class="cov-item-text">'+esc(c.obligation)+'</span>';
        itemsDiv.appendChild(row);
      }
      packDiv.appendChild(itemsDiv);
      covList.appendChild(packDiv);
    }
    compPanel.appendChild(covList);
  }

  // ── 3. Decision Provenance ──
  const provPanel=document.createElement('div');
  provPanel.className='panel govern-provenance';
  provPanel.setAttribute('data-eng-only','1'); // Exec/Compliance: hide raw provenance
  const provTitle=document.createElement('h3');
  provTitle.innerHTML='Decision Provenance <span class="pill">trace</span>';
  provPanel.appendChild(provTitle);

  if(decisions.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='30px 10px';
    empty.innerHTML=
      '<h4>No decision provenance captured yet</h4>'+
      '<p>Future: a journal/ADR hook or <code>xlabs_log_decision</code> integration will populate this trace. Each entry maps an output (commit/file) back through its signal chain &#x2192; gate &#x2192; model &#x2192; cost.</p>';
    provPanel.appendChild(empty);
  } else {
    const tbl=document.createElement('table');
    tbl.setAttribute('aria-label','Decision provenance trace');
    tbl.innerHTML=
      '<thead><tr>'+
        '<th>Output</th>'+
        '<th>Signal chain</th>'+
        '<th>Gate</th>'+
        '<th>Model</th>'+
        '<th>Cost (USD)</th>'+
        '<th>When</th>'+
      '</tr></thead>';
    const tbody=document.createElement('tbody');
    for(const dec of decisions){
      const tr=document.createElement('tr');
      const chain=Array.isArray(dec.signal_chain)?dec.signal_chain.map(s=>esc(s)).join(' &#x2192; '):'—';
      const cost=typeof dec.cost==='number'?'$'+dec.cost.toFixed(4):'—';
      const ts=dec.ts?new Date(dec.ts).toLocaleDateString():'—';
      tr.innerHTML=
        '<td class="mono" style="font-size:11px">'+esc(dec.output||'—')+'</td>'+
        '<td style="font-size:10px;color:var(--accent)">'+chain+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(dec.gate||'—')+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(dec.model||'—')+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(cost)+'</td>'+
        '<td style="font-size:11px;color:var(--text-tertiary)">'+esc(ts)+'</td>';
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    provPanel.appendChild(tbl);
  }
  sections.appendChild(provPanel);

  // Apply initial persona
  applyPersona(currentProfile.persona);
}

// ── Measure tab ──
function renderMeasure(){
  const container=document.getElementById('measure-content');
  if(!container)return;

  const freq=D.skillFrequency||[];
  const models=D.modelDistribution||[];
  const ov=D.overview||{};

  const cols=document.createElement('div');
  cols.className='cols';

  // Left: top skills
  const skillPanel=document.createElement('div');
  skillPanel.className='panel';
  skillPanel.innerHTML='<h3>Top Skills <span class="pill">frequency</span></h3>';

  if(freq.length===0){
    skillPanel.innerHTML+='<div class="empty"><h4>No skill data</h4><p>Run Rune skills to start collecting frequency metrics.</p></div>';
  } else {
    const maxCount=freq[0].count||1;
    const barList=document.createElement('div');
    barList.style.marginTop='8px';
    for(const s of freq.slice(0,15)){
      const row=document.createElement('div');
      row.className='skill-bar-row';
      const pct=Math.max(4,Math.round((s.count/maxCount)*100));
      row.innerHTML=
        '<div class="skill-bar-name" title="'+esc(s.skill)+'">'+esc(s.skill)+'</div>'+
        '<div class="skill-bar-track"><div class="skill-bar-fill" style="width:'+pct+'%"></div></div>'+
        '<div class="skill-bar-count">'+safeInt(s.count)+'</div>';
      barList.appendChild(row);
    }
    skillPanel.appendChild(barList);
  }

  // Right: models + overview stats
  const rightPanel=document.createElement('div');
  rightPanel.className='panel';
  rightPanel.innerHTML='<h3>Model Mix <span class="pill">usage</span></h3>';

  if(models.length===0 && !ov.total_sessions){
    rightPanel.innerHTML+='<div class="empty"><h4>No analytics data</h4><p>Start sessions to populate model usage and overview stats.</p></div>';
  } else {
    if(models.length>0){
      const tbl=document.createElement('table');
      tbl.setAttribute('aria-label','Model distribution');
      tbl.innerHTML='<thead><tr><th>Model</th><th style="text-align:right">Skill calls</th></tr></thead>';
      const tbody=document.createElement('tbody');
      for(const m of models){
        const tr=document.createElement('tr');
        tr.innerHTML='<td class="mono">'+esc(m.model)+'</td><td class="mono" style="text-align:right">'+safeInt(m.skill_count)+'</td>';
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      rightPanel.appendChild(tbl);
    }
    if(ov.total_sessions){
      const stats=document.createElement('div');
      stats.style.cssText='margin-top:16px;display:flex;flex-direction:column;gap:8px;';
      const items=[
        ['Sessions',ov.total_sessions],
        ['Avg duration',ov.avg_duration_min!=null?ov.avg_duration_min+'min':'—'],
        ['Total tool calls',ov.total_tool_calls||0],
        ['Skill invocations',ov.total_skill_invocations||0],
        ['Active days',ov.active_days||0],
      ];
      for(const [label,val] of items){
        const row=document.createElement('div');
        row.style.cssText='display:flex;justify-content:space-between;font-size:13px;';
        row.innerHTML='<span style="color:var(--text-tertiary)">'+esc(label)+'</span><span style="font-family:var(--font-mono);color:var(--text-primary)">'+esc(String(val))+'</span>';
        stats.appendChild(row);
      }
      rightPanel.appendChild(stats);
    }
  }

  cols.appendChild(skillPanel);
  cols.appendChild(rightPanel);
  container.appendChild(cols);
}

// ── Understand tab: module graph ──
let understandRendered=false;
function renderUnderstandGraph(){
  if(understandRendered)return;
  understandRendered=true;

  const container=document.getElementById('understand-content');
  if(!container)return;

  const modules=D.modules||[];
  const edges=D.edges||[];
  const layers=D.layers||[];
  const skillMesh=D.skillMesh||{nodes:[],edges:[]};

  // Prefer comprehension modules; fall back to skillMesh nodes
  const useComprehension=modules.length>0;
  const nodes=useComprehension
    ? modules.map(m=>({id:m.id||m.name,name:m.name,layer:m.layer||'module',type:m.type||'module'}))
    : (skillMesh.nodes||[]).map(n=>({id:n.id||n.name,name:n.id||n.name,layer:n.layer||'L3',type:'skill'}));
  const rawEdges=useComprehension
    ? edges.map(e=>({source:e.from,target:e.to}))
    : (skillMesh.edges||[]).map(e=>({source:e.source,target:e.target}));

  // Panel wrapper
  const panel=document.createElement('div');
  panel.className='panel';
  const title=document.createElement('h3');
  title.innerHTML='Codebase Map <span class="pill">understand</span>';
  panel.appendChild(title);

  if(nodes.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.innerHTML='<h4>No comprehension data</h4><p>Run <code>rune onboard</code> or <code>rune autopsy</code> on your project to generate comprehension.json and populate this graph.</p>';
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  const graphWrap=document.createElement('div');
  graphWrap.className='graph-wrap';
  const canvas=document.createElement('canvas');
  canvas.id='understand-canvas';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Module dependency graph with '+nodes.length+' nodes');
  graphWrap.appendChild(canvas);
  panel.appendChild(graphWrap);

  // Legend
  const LAYER_COLORS={
    code:'#2dd4bf',service:'#60a5fa',data:'#a78bfa',
    domain:'#fbbf24',docs:'#f472b6',infra:'#38bdf8',concept:'#34d399',
    L0:'#fbbf24',L1:'#f97316',L2:'#60a5fa',L3:'#a78bfa',L4:'#34d399',
    module:'#2dd4bf',skill:'#60a5fa',
  };
  const usedLayers=[...new Set(nodes.map(n=>n.layer))].slice(0,6);
  const legendEl=document.createElement('div');
  legendEl.className='legend';
  legendEl.setAttribute('aria-label','Graph legend');
  for(const l of usedLayers){
    const color=LAYER_COLORS[l]||'#94a3b8';
    legendEl.innerHTML+='<span aria-label="'+esc(l)+' layer"><i style="background:'+color+'" aria-hidden="true"></i>'+esc(l)+'</span>';
  }
  panel.appendChild(legendEl);
  container.appendChild(panel);

  // Draw graph after DOM insertion
  requestAnimationFrame(()=>{
    const LAYER_C=LAYER_COLORS;
    const W=canvas.offsetWidth||600;
    const H=canvas.offsetHeight||280;
    const dpr=window.devicePixelRatio||1;
    canvas.width=W*dpr;canvas.height=H*dpr;

    // Layout: circular placement
    const N=nodes.length;
    const cx=W/2,cy=H/2;
    const r=Math.min(W,H)*0.36;

    // Position nodes in a circle, cluster by layer
    const layerOrder=[...new Set(nodes.map(n=>n.layer))];
    nodes.forEach((n,i)=>{
      const angle=(i/N)*Math.PI*2 - Math.PI/2;
      n.x=cx+Math.cos(angle)*r*(0.7+Math.random()*0.3);
      n.y=cy+Math.sin(angle)*r*(0.7+Math.random()*0.3);
      n.color=LAYER_C[n.layer]||'#94a3b8';
      n.radius=6+Math.random()*4;
    });

    // Build adjacency for hover highlight
    const nodeMap=new Map(nodes.map((n,i)=>[n.id,i]));
    const edgeList=rawEdges
      .filter(e=>nodeMap.has(e.source)&&nodeMap.has(e.target))
      .map(e=>({si:nodeMap.get(e.source),ti:nodeMap.get(e.target)}));

    let hovered=null;
    const ctx=canvas.getContext('2d');

    function draw(ts){
      ctx.save();ctx.scale(dpr,dpr);
      ctx.clearRect(0,0,W,H);
      const t=(ts||0)*0.001;

      // Draw edges
      for(const e of edgeList){
        const a=nodes[e.si],b=nodes[e.ti];
        const hi=hovered!=null&&(e.si===hovered||e.ti===hovered);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=hi?'rgba(45,212,191,.45)':'rgba(148,163,184,.12)';
        ctx.lineWidth=hi?1.5:0.8;ctx.stroke();
      }

      // Draw nodes
      for(let i=0;i<nodes.length;i++){
        const n=nodes[i];
        const isH=hovered===i;
        const isC=hovered!=null&&!isH&&edgeList.some(e=>(e.si===hovered&&e.ti===i)||(e.ti===hovered&&e.si===i));
        const dim=hovered!=null&&!isH&&!isC;
        const pulse=isH?1.2:(1+0.08*Math.sin(t*0.8+i*1.1));
        const rad=n.radius*pulse;

        if(!dim){
          // Glow
          const grd=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,rad*2.8);
          grd.addColorStop(0,n.color+(isH?'40':'18'));
          grd.addColorStop(1,n.color+'00');
          ctx.fillStyle=grd;ctx.beginPath();ctx.arc(n.x,n.y,rad*2.8,0,Math.PI*2);ctx.fill();
        }

        ctx.globalAlpha=dim?0.25:0.9;
        ctx.fillStyle=dim?'#334155':n.color;
        ctx.beginPath();ctx.arc(n.x,n.y,rad,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;

        // Label for hovered or large nodes
        if(isH||n.radius>9){
          ctx.font='500 9px var(--font-body)';
          ctx.fillStyle=dim?'transparent':'#cbd5e1';
          ctx.textAlign='center';
          ctx.fillText(n.name.slice(0,14),n.x,n.y+rad+11);
        }
      }
      ctx.restore();
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    // Hover
    canvas.addEventListener('mousemove',(ev)=>{
      const rect=canvas.getBoundingClientRect();
      const mx=ev.clientX-rect.left,my=ev.clientY-rect.top;
      hovered=null;
      for(let i=0;i<nodes.length;i++){
        const dx=mx-nodes[i].x,dy=my-nodes[i].y;
        if(dx*dx+dy*dy<(nodes[i].radius+6)**2){hovered=i;break;}
      }
      canvas.title=hovered!=null?nodes[hovered].name:'';
    });
    canvas.addEventListener('mouseleave',()=>{hovered=null;canvas.title='';});
  });
}

// ── Initial renders ──
renderGovern();
renderMeasure();
</script>
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
