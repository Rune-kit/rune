/**
 * Dashboard — Analytics HTML Generator
 *
 * Generates a self-contained HTML dashboard from analytics data.
 * Same pattern as visualizer.js — single file, no CDN, all inline.
 * Business tier exclusive.
 */

export function generateDashboardHTML(data) {
  const dataJson = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rune Analytics Dashboard</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-base: #0c1222;
  --bg-card: #151d2e;
  --bg-elevated: #1a2540;
  --bg-hover: #1f2d4a;
  --text-primary: #f1f5f9;
  --text-secondary: #8892a8;
  --text-muted: #5a6478;
  --border: #243049;
  --accent: #3b82f6;
  --accent-dim: rgba(59,130,246,0.15);
  --green: #10b981;
  --green-dim: rgba(16,185,129,0.15);
  --amber: #f59e0b;
  --amber-dim: rgba(245,158,11,0.15);
  --red: #ef4444;
  --purple: #a855f7;
  --purple-dim: rgba(168,85,247,0.15);
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 12px;
  --shadow: 0 4px 24px rgba(0,0,0,0.25);
}

.light {
  --bg-base: #f8fafc;
  --bg-card: #ffffff;
  --bg-elevated: #f1f5f9;
  --bg-hover: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --shadow: 0 4px 24px rgba(0,0,0,0.08);
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-body);
  line-height: 1.5;
  min-height: 100vh;
  overflow-x: hidden;
}

/* ─── Voronoi Mesh Background ─── */
#voronoi-bg, #mesh-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0; pointer-events: none;
}
#mesh-overlay { z-index: 0; }
.light #voronoi-bg { opacity: 0.35; }
.light #mesh-overlay { opacity: 0.15; }

/* ─── Layout ─── */
.container { max-width: 1280px; margin: 0 auto; padding: 24px 20px; position: relative; z-index: 1; }

.header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 28px; flex-wrap: wrap; gap: 16px;
}

.header h1 {
  font-family: var(--font-display);
  font-size: 28px; font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}

.header-controls { display: flex; gap: 8px; align-items: center; }

.btn {
  padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-card); color: var(--text-secondary);
  font-family: var(--font-body); font-size: 13px; cursor: pointer;
  transition: all 150ms ease;
}
.btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }

/* ─── KPI Cards ─── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px; margin-bottom: 24px;
}

.kpi-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
  box-shadow: var(--shadow);
  transition: transform 200ms ease, box-shadow 200ms ease;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }

.kpi-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.kpi-value { font-family: var(--font-mono); font-size: 32px; font-weight: 700; color: var(--text-primary); }
.kpi-sub { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

.kpi-icon {
  width: 36px; height: 36px; border-radius: 10px; display: flex;
  align-items: center; justify-content: center; margin-bottom: 12px;
  font-size: 18px;
}
.kpi-icon.blue { background: var(--accent-dim); }
.kpi-icon.green { background: var(--green-dim); }
.kpi-icon.amber { background: var(--amber-dim); }
.kpi-icon.purple { background: var(--purple-dim); }

/* ─── Chart Panels ─── */
.panels {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
  box-shadow: var(--shadow);
}
.panel.wide { grid-column: span 2; }

.panel-title {
  font-family: var(--font-display);
  font-size: 15px; font-weight: 600;
  color: var(--text-secondary); margin-bottom: 16px;
  text-transform: uppercase; letter-spacing: 0.04em;
}

/* ─── Charts ─── */
.chart-container { position: relative; height: 280px; }
.chart-container.short { height: 220px; }

/* ─── Bar Chart (CSS-only) ─── */
.bar-list { display: flex; flex-direction: column; gap: 10px; }
.bar-item { display: flex; align-items: center; gap: 12px; }
.bar-label { font-size: 13px; color: var(--text-secondary); min-width: 110px; font-family: var(--font-mono); }
.bar-track { flex: 1; height: 28px; background: var(--bg-elevated); border-radius: 6px; overflow: hidden; position: relative; }
.bar-fill { height: 100%; border-radius: 6px; transition: width 600ms cubic-bezier(0.34,1.56,0.64,1); display: flex; align-items: center; padding-left: 10px; }
.bar-fill span { font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-primary); }

/* ─── Donut (SVG) ─── */
.donut-container { display: flex; align-items: center; gap: 32px; justify-content: center; height: 100%; }
.donut-legend { display: flex; flex-direction: column; gap: 10px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-label { color: var(--text-secondary); }
.legend-value { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); margin-left: auto; }

/* ─── Chain Table ─── */
.chain-table { width: 100%; border-collapse: collapse; }
.chain-table th { text-align: left; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 12px; border-bottom: 1px solid var(--border); }
.chain-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--border); }
.chain-table tr:last-child td { border-bottom: none; }
.chain-table tr:hover { background: var(--bg-hover); }
.chain-name { font-family: var(--font-mono); color: var(--accent); font-size: 12px; }
.chain-count { font-family: var(--font-mono); font-weight: 700; }

/* ─── Empty State ─── */
.empty-state {
  text-align: center; padding: 60px 20px; color: var(--text-muted);
}
.empty-state h2 { font-family: var(--font-display); font-size: 22px; margin-bottom: 12px; color: var(--text-secondary); }
.empty-state p { max-width: 480px; margin: 0 auto; line-height: 1.7; }

/* ─── Footer ─── */
.footer {
  text-align: center; margin-top: 32px; padding: 16px;
  font-size: 12px; color: var(--text-muted);
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .panels { grid-template-columns: 1fr; }
  .panel.wide { grid-column: span 1; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .header h1 { font-size: 22px; }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div class="container" id="app"></div>

<script>
const DATA = ${dataJson};

const COLORS = {
  bars: ['#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#2563eb','#4f46e5'],
  donut: ['#3b82f6','#10b981','#f59e0b','#a855f7','#ef4444','#06b6d4','#ec4899','#f97316'],
  models: { opus: '#a855f7', sonnet: '#3b82f6', haiku: '#10b981' }
};

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'innerHTML') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

// ─── Donut SVG ───
function donutSVG(items, size = 160) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return '<svg></svg>';
  const r = size / 2 - 10;
  const cx = size / 2, cy = size / 2;
  let cumulative = 0;
  const paths = items.map((item, i) => {
    const pct = item.value / total;
    const start = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const end = cumulative * 2 * Math.PI - Math.PI / 2;
    const large = pct > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    if (pct >= 0.999) return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+item.color+'" stroke-width="24"/>';
    return '<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+large+' 1 '+x2+' '+y2+' Z" fill="'+item.color+'" opacity="0.85"/>';
  });
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-16)+'" fill="var(--bg-card)"/>'+
    paths.join('')+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-16)+'" fill="var(--bg-card)"/>'+
    '<text x="'+cx+'" y="'+(cy+6)+'" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-mono)" font-size="22" font-weight="700">'+total+'</text>'+
    '</svg>';
}

// ─── Render ───
function render() {
  const app = document.getElementById('app');
  const d = Object.assign({
    overview: { total_sessions: 0, avg_duration_min: 0, total_tool_calls: 0, total_skill_invocations: 0, active_days: 0 },
    skillFrequency: [], modelDistribution: [], sessionTrend: [], skillChains: [], toolDistribution: [],
    generated: new Date().toISOString(), days: 30
  }, DATA);

  if (!d.overview || d.overview.total_sessions === 0) {
    app.innerHTML = '';
    app.appendChild(el('div', { className: 'empty-state' },
      el('h2', null, 'No analytics data yet'),
      el('p', null, 'Use Rune skills in your projects to start collecting metrics. Data is captured automatically via hooks and stored locally in .rune/metrics/.')
    ));
    return;
  }

  app.innerHTML = '';

  // Header
  const daysLabel = d.days > 0 ? d.days + ' days' : 'All time';
  const header = el('div', { className: 'header' },
    el('h1', null, 'Rune Analytics'),
    el('div', { className: 'header-controls' },
      ...[7, 30, 90, 0].map(days =>
        el('button', {
          className: 'btn' + (d.days === days ? ' active' : ''),
          innerHTML: days === 0 ? 'All' : days + 'd',
          onClick: () => { /* Static — regenerate with different --days flag */ }
        })
      ),
      el('button', { className: 'btn', innerHTML: '\\u263E', onClick: toggleTheme, title: 'Toggle theme' })
    )
  );
  app.appendChild(header);

  // KPI Cards
  const o = d.overview;
  const kpis = [
    { icon: '\\u25B6', cls: 'blue', label: 'Sessions', value: o.total_sessions, sub: daysLabel },
    { icon: '\\u23F1', cls: 'green', label: 'Avg Duration', value: o.avg_duration_min + 'm', sub: 'per session' },
    { icon: '\\u26A1', cls: 'amber', label: 'Skill Invocations', value: fmtNum(o.total_skill_invocations), sub: fmtNum(o.total_tool_calls) + ' tool calls' },
    { icon: '\\u2726', cls: 'purple', label: 'Active Days', value: o.active_days, sub: 'with Rune usage' },
  ];

  const kpiGrid = el('div', { className: 'kpi-grid' });
  for (const k of kpis) {
    kpiGrid.appendChild(el('div', { className: 'kpi-card' },
      el('div', { className: 'kpi-icon ' + k.cls, innerHTML: k.icon }),
      el('div', { className: 'kpi-label' }, k.label),
      el('div', { className: 'kpi-value' }, String(k.value)),
      el('div', { className: 'kpi-sub' }, k.sub)
    ));
  }
  app.appendChild(kpiGrid);

  // Panels
  const panels = el('div', { className: 'panels' });

  // 1. Usage Trend (wide)
  const trendPanel = el('div', { className: 'panel wide' },
    el('div', { className: 'panel-title' }, 'Usage Trend')
  );
  if (d.sessionTrend.length > 0) {
    trendPanel.appendChild(buildTrendChart(d.sessionTrend));
  }
  panels.appendChild(trendPanel);

  // 2. Skill Frequency (bar chart)
  const skillPanel = el('div', { className: 'panel' },
    el('div', { className: 'panel-title' }, 'Top Skills')
  );
  const topSkills = d.skillFrequency.slice(0, 12);
  if (topSkills.length > 0) {
    const maxVal = topSkills[0].sessions_count || 1;
    const barList = el('div', { className: 'bar-list' });
    topSkills.forEach((s, i) => {
      const pct = Math.max(8, (s.sessions_count / maxVal) * 100);
      barList.appendChild(el('div', { className: 'bar-item' },
        el('div', { className: 'bar-label' }, s.skill),
        el('div', { className: 'bar-track' },
          el('div', { className: 'bar-fill', style: 'width:'+pct+'%;background:'+COLORS.bars[i % COLORS.bars.length] },
            el('span', null, String(s.sessions_count))
          )
        )
      ));
    });
    skillPanel.appendChild(barList);
  }
  panels.appendChild(skillPanel);

  // 3. Model Distribution (donut)
  const modelPanel = el('div', { className: 'panel' },
    el('div', { className: 'panel-title' }, 'Model Distribution')
  );
  if (d.modelDistribution.length > 0) {
    const items = d.modelDistribution.map(m => ({
      label: m.model, value: m.skill_count,
      color: COLORS.models[m.model] || COLORS.donut[0]
    }));
    const donutDiv = el('div', { className: 'donut-container' });
    donutDiv.appendChild(el('div', { innerHTML: donutSVG(items) }));
    const legend = el('div', { className: 'donut-legend' });
    const total = items.reduce((s, i) => s + i.value, 0);
    items.forEach(item => {
      const pct = total > 0 ? Math.round(item.value / total * 100) : 0;
      legend.appendChild(el('div', { className: 'legend-item' },
        el('div', { className: 'legend-dot', style: 'background:'+item.color }),
        el('span', { className: 'legend-label' }, item.label),
        el('span', { className: 'legend-value' }, item.value + ' (' + pct + '%)')
      ));
    });
    donutDiv.appendChild(legend);
    modelPanel.appendChild(donutDiv);
  }
  panels.appendChild(modelPanel);

  // 4. Tool Distribution (donut)
  const toolPanel = el('div', { className: 'panel' },
    el('div', { className: 'panel-title' }, 'Tool Distribution')
  );
  if (d.toolDistribution.length > 0) {
    const items = d.toolDistribution.slice(0, 8).map((t, i) => ({
      label: t.tool, value: t.count, color: COLORS.donut[i % COLORS.donut.length]
    }));
    const donutDiv = el('div', { className: 'donut-container' });
    donutDiv.appendChild(el('div', { innerHTML: donutSVG(items) }));
    const legend = el('div', { className: 'donut-legend' });
    const total = items.reduce((s, i) => s + i.value, 0);
    items.forEach(item => {
      const pct = total > 0 ? Math.round(item.value / total * 100) : 0;
      legend.appendChild(el('div', { className: 'legend-item' },
        el('div', { className: 'legend-dot', style: 'background:'+item.color }),
        el('span', { className: 'legend-label' }, item.label),
        el('span', { className: 'legend-value' }, fmtNum(item.value) + ' (' + pct + '%)')
      ));
    });
    donutDiv.appendChild(legend);
    toolPanel.appendChild(donutDiv);
  }
  panels.appendChild(toolPanel);

  // 5. Workflow Chains (table)
  const chainPanel = el('div', { className: 'panel wide' },
    el('div', { className: 'panel-title' }, 'Workflow Chains')
  );
  if (d.skillChains.length > 0) {
    const table = el('table', { className: 'chain-table' });
    table.appendChild(el('thead', null,
      el('tr', null,
        el('th', null, 'Chain'),
        el('th', { style: 'width:80px;text-align:right' }, 'Count')
      )
    ));
    const tbody = el('tbody');
    d.skillChains.slice(0, 15).forEach(c => {
      tbody.appendChild(el('tr', null,
        el('td', { className: 'chain-name' }, c.chain),
        el('td', { className: 'chain-count', style: 'text-align:right' }, String(c.count))
      ));
    });
    table.appendChild(tbody);
    chainPanel.appendChild(table);
  } else {
    chainPanel.appendChild(el('div', { style: 'color:var(--text-muted);text-align:center;padding:20px' }, 'No workflow chains recorded yet'));
  }
  panels.appendChild(chainPanel);

  app.appendChild(panels);

  // Footer
  app.appendChild(el('div', { className: 'footer' },
    'Generated ' + new Date(d.generated).toLocaleString() + ' \\u2022 Rune Business \\u2022 100% local data'
  ));

  // Animate bars after render
  requestAnimationFrame(() => {
    document.querySelectorAll('.bar-fill').forEach(b => {
      const w = b.style.width; b.style.width = '0'; b.offsetHeight;
      b.style.width = w;
    });
  });
}

// ─── Trend Chart (Canvas) ───
function buildTrendChart(trend) {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 200;
  canvas.style.cssText = 'width:100%;height:200px;';

  requestAnimationFrame(() => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    const H = canvas.height = 200 * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const w = canvas.offsetWidth, h = 200;
    const pad = { top: 20, right: 20, bottom: 30, left: 45 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const maxSessions = Math.max(...trend.map(t => t.sessions), 1);
    const maxSkills = Math.max(...trend.map(t => t.skill_invocations), 1);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }

    // Sessions line (accent blue)
    drawLine(ctx, trend.map(t => t.sessions), maxSessions, COLORS.models.sonnet, pad, cw, ch);

    // Skill invocations line (green)
    drawLine(ctx, trend.map(t => t.skill_invocations), maxSkills, COLORS.models.haiku, pad, cw, ch);

    // X-axis labels
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#5a6478';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(trend.length / 7));
    trend.forEach((t, i) => {
      if (i % step === 0 || i === trend.length - 1) {
        const x = pad.left + (i / (trend.length - 1 || 1)) * cw;
        ctx.fillText(t.date.slice(5), x, h - 6);
      }
    });

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ch / 4) * i;
      const val = Math.round(maxSessions * (1 - i / 4));
      ctx.fillText(String(val), pad.left - 8, y + 4);
    }

    // Legend
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = COLORS.models.sonnet;
    ctx.fillRect(w - 220, 8, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8892a8';
    ctx.textAlign = 'left';
    ctx.fillText('Sessions', w - 206, 17);
    ctx.fillStyle = COLORS.models.haiku;
    ctx.fillRect(w - 130, 8, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8892a8';
    ctx.fillText('Skills', w - 116, 17);
  });

  return canvas;
}

function drawLine(ctx, values, maxVal, color, pad, cw, ch) {
  if (values.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad.left + (i / (values.length - 1)) * cw;
    const y = pad.top + ch - (v / maxVal) * ch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Area fill
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Dots
  values.forEach((v, i) => {
    const x = pad.left + (i / (values.length - 1)) * cw;
    const y = pad.top + ch - (v / maxVal) * ch;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  });
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function toggleTheme() {
  document.body.classList.toggle('light');
  drawVoronoiMesh(); // Redraw with new palette
}

// ─── Voronoi Mesh Background (Crystal + Neural Mesh) ───

// Seeded PRNG for deterministic layout
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Generate seed points (shared between layers)
let meshSeeds = [];
let meshW = 0, meshH = 0;

function generateSeeds() {
  meshW = window.innerWidth;
  meshH = window.innerHeight;
  meshSeeds = [];
  const N = 70;
  const rng = mulberry32(42);
  for (let i = 0; i < N; i++) {
    const x = rng() * meshW;
    const y = rng() * meshH;
    const g = (x / meshW) * 0.45 + (1 - y / meshH) * 0.35;
    // Assign a unique hue shift per cell for more variety
    const hueShift = rng() * 0.3 - 0.15;
    meshSeeds.push({ x, y, g, hue: hueShift, phase: rng() * Math.PI * 2 });
  }
}

// Layer 1: Voronoi crystal cells
function drawVoronoiCells() {
  let canvas = document.getElementById('voronoi-bg');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'voronoi-bg';
    document.body.prepend(canvas);
  }

  const w = meshW, h = meshH;
  const scale = 2; // Higher res for sharper edges
  const sw = Math.ceil(w / scale);
  const sh = Math.ceil(h / scale);

  canvas.width = sw;
  canvas.height = sh;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.style.imageRendering = 'auto';

  const ctx = canvas.getContext('2d');
  const isLight = document.body.classList.contains('light');
  const imageData = ctx.createImageData(sw, sh);
  const data = imageData.data;

  // Scale seeds to canvas coords
  const seeds = meshSeeds.map(s => ({
    ...s, sx: s.x / scale, sy: s.y / scale
  }));

  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      let d1 = Infinity, d2 = Infinity, ni = 0;

      for (let i = 0; i < seeds.length; i++) {
        const dx = px - seeds[i].sx;
        const dy = py - seeds[i].sy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; ni = i; }
        else if (d < d2) { d2 = d; }
      }

      const seed = seeds[ni];
      const e1 = Math.sqrt(d1), e2 = Math.sqrt(d2);
      const edgeDist = e2 - e1;

      // Crystal edge: bright line at cell boundaries
      const edgeGlow = Math.max(0, 1 - edgeDist / 2.5);    // Sharp bright edge
      const edgeFade = Math.min(1, edgeDist / 5);           // Softer cell fill transition

      // Inner cell shading: slight darkening toward center for 3D depth
      const centerDist = e1 / (e2 * 0.5 + 1);
      const depthShade = 0.85 + 0.15 * Math.min(1, centerDist * 0.8);

      let r, g, b;
      if (isLight) {
        const base = 0.88 - seed.g * 0.18;
        r = Math.round((base - 0.03 + seed.hue * 0.04) * 255 * depthShade);
        g = Math.round((base - 0.01 + seed.hue * 0.02) * 255 * depthShade);
        b = Math.round((base + 0.02) * 255 * depthShade);
      } else {
        const base = 0.04 + seed.g * 0.09;
        // More dramatic color range: deep navy → slate blue → muted teal
        r = Math.round((base * 0.45 + seed.hue * 0.03) * 255 * depthShade);
        g = Math.round((base * 0.65 + seed.hue * 0.05) * 255 * depthShade);
        b = Math.round((base * 1.4 + seed.hue * 0.08) * 255 * depthShade);
      }

      // Apply edge glow — bright crystalline boundary
      if (isLight) {
        r = Math.min(255, r + Math.round(edgeGlow * 40));
        g = Math.min(255, g + Math.round(edgeGlow * 38));
        b = Math.min(255, b + Math.round(edgeGlow * 50));
      } else {
        r = Math.min(255, r + Math.round(edgeGlow * 25));
        g = Math.min(255, g + Math.round(edgeGlow * 35));
        b = Math.min(255, b + Math.round(edgeGlow * 65));
      }

      const idx = (py * sw + px) * 4;
      data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Depth overlay: radial light from top-right
  const grd = ctx.createRadialGradient(sw * 0.7, sh * 0.1, 0, sw * 0.5, sh * 0.5, sw * 0.9);
  if (isLight) {
    grd.addColorStop(0, 'rgba(255,255,255,0.1)');
    grd.addColorStop(1, 'rgba(0,0,0,0.04)');
  } else {
    grd.addColorStop(0, 'rgba(80,140,255,0.06)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.2)');
  }
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, sw, sh);
}

// Layer 2: Animated neural mesh overlay (Delaunay edges + glowing nodes)
let meshAnimFrame = null;

function initMeshOverlay() {
  let canvas = document.getElementById('mesh-overlay');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'mesh-overlay';
    const bg = document.getElementById('voronoi-bg');
    if (bg) bg.after(canvas); else document.body.prepend(canvas);
  }

  canvas.width = meshW;
  canvas.height = meshH;
  canvas.style.width = meshW + 'px';
  canvas.style.height = meshH + 'px';

  // Compute Delaunay edges (nearest-neighbor approximation for performance)
  const edges = computeMeshEdges(meshSeeds);

  if (meshAnimFrame) cancelAnimationFrame(meshAnimFrame);
  animateMesh(canvas, edges);
}

function computeMeshEdges(seeds) {
  // Connect each seed to its 3 nearest neighbors (simple mesh)
  const edges = new Set();
  for (let i = 0; i < seeds.length; i++) {
    const dists = [];
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue;
      const dx = seeds[i].x - seeds[j].x;
      const dy = seeds[i].y - seeds[j].y;
      dists.push({ j, d: dx * dx + dy * dy });
    }
    dists.sort((a, b) => a.d - b.d);
    // Connect to 3 nearest — creates a dense but not cluttered mesh
    for (let k = 0; k < Math.min(3, dists.length); k++) {
      const key = Math.min(i, dists[k].j) + '-' + Math.max(i, dists[k].j);
      edges.add(key);
    }
  }
  return [...edges].map(k => {
    const [a, b] = k.split('-').map(Number);
    return { a, b };
  });
}

function animateMesh(canvas, edges) {
  const ctx = canvas.getContext('2d');
  const isLight = document.body.classList.contains('light');
  const seeds = meshSeeds;

  function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = t * 0.001;

    // Draw mesh edges with subtle pulse
    for (const edge of edges) {
      const sa = seeds[edge.a], sb = seeds[edge.b];
      const midPhase = (sa.phase + sb.phase) / 2;
      const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.4 + midPhase));

      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);

      if (isLight) {
        ctx.strokeStyle = 'rgba(100,100,140,' + (0.04 * pulse).toFixed(3) + ')';
      } else {
        ctx.strokeStyle = 'rgba(100,160,255,' + (0.06 * pulse).toFixed(3) + ')';
      }
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Draw node dots with glow
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.6 + s.phase));
      const radius = 1.5 + pulse * 1;

      // Outer glow
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 4);
      if (isLight) {
        grad.addColorStop(0, 'rgba(80,80,160,' + (0.12 * pulse).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(80,80,160,0)');
      } else {
        grad.addColorStop(0, 'rgba(100,180,255,' + (0.2 * pulse).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(100,180,255,0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      if (isLight) {
        ctx.fillStyle = 'rgba(100,100,180,' + (0.25 * pulse).toFixed(3) + ')';
      } else {
        ctx.fillStyle = 'rgba(140,200,255,' + (0.4 * pulse).toFixed(3) + ')';
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    meshAnimFrame = requestAnimationFrame(frame);
  }

  meshAnimFrame = requestAnimationFrame(frame);
}

function drawVoronoiMesh() {
  generateSeeds();
  drawVoronoiCells();
  initMeshOverlay();
}

// Initialize
drawVoronoiMesh();
window.addEventListener('resize', () => { drawVoronoiMesh(); });

render();
</script>
</body>
</html>`;
}
