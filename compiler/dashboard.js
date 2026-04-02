/**
 * Dashboard — Analytics HTML Generator (Hybrid Mesh+Rhythm)
 *
 * Generates a self-contained HTML dashboard from analytics data.
 * Layout: Interactive skill mesh + heatmap + session timeline.
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

#voronoi-bg, #mesh-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0; pointer-events: none;
}
#mesh-overlay { z-index: 0; }
.light #voronoi-bg { opacity: 0.35; }
.light #mesh-overlay { opacity: 0.15; }

.container { max-width: 1280px; margin: 0 auto; padding: 24px 20px; position: relative; z-index: 1; }

/* ─── Header ─── */
.header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
}
.header h1 {
  font-family: var(--font-display);
  font-size: 24px; font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.header-controls { display: flex; gap: 6px; align-items: center; }
.btn {
  padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-card); color: var(--text-secondary);
  font-family: var(--font-body); font-size: 12px; cursor: pointer;
  transition: all 150ms ease;
}
.btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }

/* ─── Top Row: KPIs + Model Donut ─── */
.top-row {
  display: grid; grid-template-columns: 1fr auto; gap: 16px;
  margin-bottom: 20px; align-items: stretch;
}
.kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
  box-shadow: var(--shadow);
}
.kpi-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.kpi-value { font-family: var(--font-mono); font-size: 28px; font-weight: 700; }
.kpi-sub { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.model-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; min-width: 200px;
  box-shadow: var(--shadow); display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.model-title { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.model-legend { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.legend-label { color: var(--text-secondary); }
.legend-value { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); margin-left: auto; }

/* ─── Skill Mesh (Interactive Canvas) ─── */
.mesh-panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0; margin-bottom: 20px;
  box-shadow: var(--shadow); position: relative; overflow: hidden;
}
.mesh-panel-header {
  padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--border);
}
.mesh-panel-title {
  font-family: var(--font-display); font-size: 14px; font-weight: 600;
  color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;
}
.mesh-hint { font-size: 11px; color: var(--text-muted); }
#skill-mesh-canvas { width: 100%; height: 340px; display: block; cursor: crosshair; }
.mesh-tooltip {
  position: absolute; pointer-events: none; z-index: 10;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 12px; font-size: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); display: none;
}
.mesh-tooltip-name { font-family: var(--font-mono); font-weight: 700; color: var(--accent); }
.mesh-tooltip-stat { color: var(--text-secondary); }

/* ─── Heatmap ─── */
.heatmap-panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px; margin-bottom: 20px;
  box-shadow: var(--shadow); overflow-x: auto;
}
.heatmap-title {
  font-family: var(--font-display); font-size: 14px; font-weight: 600;
  color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 14px;
}
.heatmap-grid { display: flex; flex-direction: column; gap: 2px; }
.heatmap-row { display: flex; align-items: center; gap: 2px; }
.heatmap-label {
  width: 90px; flex-shrink: 0; font-family: var(--font-mono);
  font-size: 11px; color: var(--text-secondary); text-align: right; padding-right: 8px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.heatmap-cell {
  width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
  background: var(--bg-elevated); cursor: pointer;
  transition: transform 100ms ease;
}
.heatmap-cell:hover { transform: scale(1.5); z-index: 2; position: relative; }
.heatmap-cell[data-active="true"] { outline: 2px solid var(--accent); outline-offset: 1px; }
.heatmap-dates {
  display: flex; gap: 2px; margin-left: 92px; margin-top: 4px;
}
.heatmap-date {
  width: 14px; flex-shrink: 0; font-size: 8px; color: var(--text-muted);
  text-align: center; transform: rotate(-45deg); transform-origin: center;
}
.heatmap-legend {
  display: flex; align-items: center; gap: 6px; margin-top: 10px; margin-left: 92px;
  font-size: 10px; color: var(--text-muted);
}
.heatmap-legend-cell {
  width: 12px; height: 12px; border-radius: 2px;
}

/* ─── Bottom Row: Timeline + Chains ─── */
.bottom-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px;
  box-shadow: var(--shadow);
}
.panel-title {
  font-family: var(--font-display); font-size: 14px; font-weight: 600;
  color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 14px;
}

/* Session Timeline */
.timeline { display: flex; flex-direction: column; gap: 12px; }
.tl-session {
  padding: 12px; background: var(--bg-elevated); border-radius: 8px;
  border: 1px solid transparent; cursor: pointer;
  transition: border-color 150ms ease;
}
.tl-session:hover { border-color: var(--accent); }
.tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tl-date { font-family: var(--font-mono); font-size: 12px; font-weight: 600; }
.tl-meta { font-size: 11px; color: var(--text-muted); }
.tl-skills {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.tl-skill {
  font-family: var(--font-mono); font-size: 10px; padding: 2px 6px;
  border-radius: 4px; background: var(--accent-dim); color: var(--accent);
}
.tl-skill.primary { background: var(--accent); color: #fff; }
.tl-chain {
  font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
  margin-top: 4px;
}

/* Chain table */
.chain-table { width: 100%; border-collapse: collapse; }
.chain-table th {
  text-align: left; font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 6px 10px; border-bottom: 1px solid var(--border);
}
.chain-table td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid var(--border); }
.chain-table tr:last-child td { border-bottom: none; }
.chain-table tr:hover { background: var(--bg-hover); }
.chain-name { font-family: var(--font-mono); color: var(--accent); font-size: 11px; }
.chain-count { font-family: var(--font-mono); font-weight: 700; text-align: right; }
.chain-bar {
  height: 4px; border-radius: 2px; background: var(--accent);
  transition: width 600ms cubic-bezier(0.34,1.56,0.64,1);
}

/* ─── Empty State ─── */
.empty-state { text-align: center; padding: 80px 20px; color: var(--text-muted); }
.empty-state h2 { font-family: var(--font-display); font-size: 22px; margin-bottom: 12px; color: var(--text-secondary); }
.empty-state p { max-width: 480px; margin: 0 auto; line-height: 1.7; }

/* ─── Footer ─── */
.footer { text-align: center; margin-top: 24px; padding: 12px; font-size: 11px; color: var(--text-muted); }

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .top-row { grid-template-columns: 1fr; }
  .kpi-strip { grid-template-columns: repeat(2, 1fr); }
  .bottom-row { grid-template-columns: 1fr; }
  #skill-mesh-canvas { height: 260px; }
}
@media (max-width: 480px) {
  .kpi-strip { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
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
  models: { opus: '#a855f7', sonnet: '#3b82f6', haiku: '#10b981' },
  heatmap: ['var(--bg-elevated)', '#1a3a5c', '#1d5a8a', '#2176b8', '#3b9fe6']
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

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// ─── Donut SVG ───
function donutSVG(items, size = 120) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return '<svg></svg>';
  const r = size / 2 - 8;
  const cx = size / 2, cy = size / 2;
  let cumulative = 0;
  const paths = items.map((item) => {
    const pct = item.value / total;
    const start = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const end = cumulative * 2 * Math.PI - Math.PI / 2;
    const large = pct > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    if (pct >= 0.999) return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+item.color+'" stroke-width="18"/>';
    return '<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+large+' 1 '+x2+' '+y2+' Z" fill="'+item.color+'" opacity="0.85"/>';
  });
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-12)+'" fill="var(--bg-card)"/>'+
    paths.join('')+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-12)+'" fill="var(--bg-card)"/>'+
    '</svg>';
}

// ─── Force-Directed Skill Mesh ───
function renderSkillMesh(canvasEl, meshData, tooltip) {
  if (!meshData || !meshData.nodes || meshData.nodes.length === 0) return;

  const nodes = meshData.nodes.map(n => ({
    ...n,
    x: Math.random() * 600 + 100,
    y: Math.random() * 280 + 30,
    vx: 0, vy: 0,
    radius: 6 + (n.count / meshData.maxCount) * 18
  }));
  const nodeMap = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = meshData.edges
    .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map(e => ({ ...e, si: nodeMap.get(e.source), ti: nodeMap.get(e.target) }));
  const maxEdgeWeight = Math.max(1, ...edges.map(e => e.weight));

  let W, H, dpr, hoveredNode = null;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvasEl.offsetWidth;
    H = canvasEl.offsetHeight;
    canvasEl.width = W * dpr;
    canvasEl.height = H * dpr;
  }
  resize();

  // Simple force simulation
  const center = { x: W / 2, y: H / 2 };
  for (let i = 0; i < nodes.length; i++) {
    const angle = (i / nodes.length) * Math.PI * 2;
    const spread = Math.min(W, H) * 0.35;
    nodes[i].x = center.x + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5);
    nodes[i].y = center.y + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5);
  }

  function simulate() {
    for (let iter = 0; iter < 80; iter++) {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let d = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = 800 / (d * d);
          let fx = (dx / d) * force;
          let fy = (dy / d) * force;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }
      // Attraction (edges)
      for (const e of edges) {
        let dx = nodes[e.ti].x - nodes[e.si].x;
        let dy = nodes[e.ti].y - nodes[e.si].y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = (d - 100) * 0.005;
        let fx = (dx / d) * force;
        let fy = (dy / d) * force;
        nodes[e.si].vx += fx; nodes[e.si].vy += fy;
        nodes[e.ti].vx -= fx; nodes[e.ti].vy -= fy;
      }
      // Center gravity
      for (const n of nodes) {
        n.vx += (center.x - n.x) * 0.002;
        n.vy += (center.y - n.y) * 0.002;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(n.radius + 10, Math.min(W - n.radius - 10, n.x));
        n.y = Math.max(n.radius + 10, Math.min(H - n.radius - 10, n.y));
      }
    }
  }
  simulate();

  const ctx = canvasEl.getContext('2d');

  function draw(time) {
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const isLight = document.body.classList.contains('light');
    const t = (time || 0) * 0.001;

    // Draw edges
    for (const e of edges) {
      const a = nodes[e.si], b = nodes[e.ti];
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.5 + e.si + e.ti);
      const alpha = 0.08 + (e.weight / maxEdgeWeight) * 0.15 * pulse;
      const isHighlight = hoveredNode !== null && (e.si === hoveredNode || e.ti === hoveredNode);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (isHighlight) {
        ctx.strokeStyle = isLight ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.6)';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,'+alpha+')' : 'rgba(100,160,255,'+alpha+')';
        ctx.lineWidth = 0.5 + (e.weight / maxEdgeWeight) * 1.5;
      }
      ctx.stroke();
    }

    // Draw nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isHovered = hoveredNode === i;
      const isConnected = hoveredNode !== null && edges.some(e =>
        (e.si === hoveredNode && e.ti === i) || (e.ti === hoveredNode && e.si === i));
      const dimmed = hoveredNode !== null && !isHovered && !isConnected;

      const pulse = 0.8 + 0.2 * Math.sin(t * 0.8 + i * 1.3);
      const r = n.radius * (isHovered ? 1.2 : 1) * pulse;

      // Glow
      if (!dimmed) {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2.5);
        const glowColor = COLORS.bars[i % COLORS.bars.length];
        grad.addColorStop(0, glowColor + (isHovered ? '40' : '18'));
        grad.addColorStop(1, glowColor + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      const nodeColor = COLORS.bars[i % COLORS.bars.length];
      ctx.fillStyle = dimmed ? (isLight ? '#ddd' : '#2a2a2a') : nodeColor;
      ctx.globalAlpha = dimmed ? 0.3 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label
      if (r > 8 || isHovered) {
        ctx.font = (isHovered ? '600 12px' : '500 10px') + ' var(--font-mono)';
        ctx.fillStyle = dimmed ? 'transparent' : (isLight ? '#1e293b' : '#e2e8f0');
        ctx.textAlign = 'center';
        ctx.fillText(n.id, n.x, n.y + r + 14);
      }
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // Hover interaction
  canvasEl.addEventListener('mousemove', (evt) => {
    const rect = canvasEl.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;
    hoveredNode = null;
    for (let i = 0; i < nodes.length; i++) {
      const dx = mx - nodes[i].x, dy = my - nodes[i].y;
      if (dx * dx + dy * dy < (nodes[i].radius + 5) ** 2) {
        hoveredNode = i;
        break;
      }
    }
    if (hoveredNode !== null) {
      const n = nodes[hoveredNode];
      tooltip.style.display = 'block';
      tooltip.style.left = (n.x + n.radius + 12) + 'px';
      tooltip.style.top = (n.y - 10 + canvasEl.offsetTop) + 'px';
      const connected = edges.filter(e => e.si === hoveredNode || e.ti === hoveredNode)
        .map(e => e.si === hoveredNode ? nodes[e.ti].id : nodes[e.si].id);
      tooltip.innerHTML = '<div class="mesh-tooltip-name">' + n.id + '</div>' +
        '<div class="mesh-tooltip-stat">' + n.count + ' sessions</div>' +
        (connected.length > 0 ? '<div class="mesh-tooltip-stat" style="margin-top:4px;font-size:10px;color:var(--text-muted)">\\u2194 ' + connected.join(', ') + '</div>' : '');
    } else {
      tooltip.style.display = 'none';
    }
  });
  canvasEl.addEventListener('mouseleave', () => {
    hoveredNode = null;
    tooltip.style.display = 'none';
  });

  window.addEventListener('resize', () => { resize(); simulate(); });
}

// ─── Render ───
function render() {
  const app = document.getElementById('app');
  const d = Object.assign({
    overview: { total_sessions: 0, avg_duration_min: 0, total_tool_calls: 0, total_skill_invocations: 0, active_days: 0 },
    skillFrequency: [], modelDistribution: [], sessionTrend: [], skillChains: [], toolDistribution: [],
    skillHeatmap: { heatmap: [], dates: [], maxCount: 1 },
    sessionTimeline: [],
    skillMesh: { nodes: [], edges: [], maxCount: 1 },
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
  const daysLabel = d.days > 0 ? d.days + 'd' : 'All';

  // Header
  app.appendChild(el('div', { className: 'header' },
    el('h1', null, 'Rune Analytics'),
    el('div', { className: 'header-controls' },
      ...[7, 30, 90, 0].map(days =>
        el('button', {
          className: 'btn' + (d.days === days ? ' active' : ''),
          innerHTML: days === 0 ? 'All' : days + 'd'
        })
      ),
      el('button', { className: 'btn', innerHTML: '\\u263E', onClick: toggleTheme, title: 'Toggle theme' })
    )
  ));

  // ── Top Row: KPIs + Model Donut ──
  const o = d.overview;
  const topRow = el('div', { className: 'top-row' });
  const kpiStrip = el('div', { className: 'kpi-strip' });

  const kpis = [
    { label: 'Sessions', value: o.total_sessions, sub: daysLabel, color: 'var(--accent)' },
    { label: 'Avg Duration', value: o.avg_duration_min + 'm', sub: 'per session', color: 'var(--green)' },
    { label: 'Skill Calls', value: fmtNum(o.total_skill_invocations), sub: fmtNum(o.total_tool_calls) + ' tools', color: 'var(--amber)' },
    { label: 'Active Days', value: o.active_days, sub: 'with usage', color: 'var(--purple)' },
  ];
  for (const k of kpis) {
    kpiStrip.appendChild(el('div', { className: 'kpi-card' },
      el('div', { className: 'kpi-label' }, k.label),
      el('div', { className: 'kpi-value', style: 'color:' + k.color }, String(k.value)),
      el('div', { className: 'kpi-sub' }, k.sub)
    ));
  }
  topRow.appendChild(kpiStrip);

  // Model donut (compact)
  if (d.modelDistribution.length > 0) {
    const modelCard = el('div', { className: 'model-card' });
    modelCard.appendChild(el('div', { className: 'model-title' }, 'Models'));
    const items = d.modelDistribution.map(m => ({
      label: m.model, value: m.skill_count,
      color: COLORS.models[m.model] || COLORS.donut[0]
    }));
    modelCard.appendChild(el('div', { innerHTML: donutSVG(items, 100) }));
    const legend = el('div', { className: 'model-legend' });
    const total = items.reduce((s, i) => s + i.value, 0);
    items.forEach(item => {
      const pct = total > 0 ? Math.round(item.value / total * 100) : 0;
      legend.appendChild(el('div', { className: 'legend-item' },
        el('div', { className: 'legend-dot', style: 'background:' + item.color }),
        el('span', { className: 'legend-label' }, item.label),
        el('span', { className: 'legend-value' }, pct + '%')
      ));
    });
    modelCard.appendChild(legend);
    topRow.appendChild(modelCard);
  }
  app.appendChild(topRow);

  // ── Skill Mesh ──
  const meshPanel = el('div', { className: 'mesh-panel' });
  meshPanel.appendChild(el('div', { className: 'mesh-panel-header' },
    el('div', { className: 'mesh-panel-title' }, 'Skill Mesh'),
    el('div', { className: 'mesh-hint' }, 'Hover to explore connections')
  ));
  const meshCanvas = el('canvas', { id: 'skill-mesh-canvas' });
  const meshTooltip = el('div', { className: 'mesh-tooltip' });
  meshPanel.appendChild(meshCanvas);
  meshPanel.appendChild(meshTooltip);
  app.appendChild(meshPanel);

  requestAnimationFrame(() => renderSkillMesh(meshCanvas, d.skillMesh, meshTooltip));

  // ── Heatmap ──
  const hm = d.skillHeatmap;
  if (hm && hm.heatmap && hm.heatmap.length > 0) {
    const hmPanel = el('div', { className: 'heatmap-panel' });
    hmPanel.appendChild(el('div', { className: 'heatmap-title' }, 'Skill Activity'));

    const grid = el('div', { className: 'heatmap-grid' });
    const isLight = document.body.classList.contains('light');

    for (const row of hm.heatmap) {
      const rowEl = el('div', { className: 'heatmap-row' });
      rowEl.appendChild(el('div', { className: 'heatmap-label', title: row.skill }, row.skill));
      for (const day of row.days) {
        const intensity = day.count / hm.maxCount;
        let bg;
        if (day.count === 0) {
          bg = isLight ? '#f1f5f9' : 'var(--bg-elevated)';
        } else if (intensity < 0.25) {
          bg = isLight ? '#bfdbfe' : '#1a3a5c';
        } else if (intensity < 0.5) {
          bg = isLight ? '#60a5fa' : '#1d5a8a';
        } else if (intensity < 0.75) {
          bg = isLight ? '#3b82f6' : '#2176b8';
        } else {
          bg = isLight ? '#1d4ed8' : '#3b9fe6';
        }
        rowEl.appendChild(el('div', {
          className: 'heatmap-cell',
          style: 'background:' + bg,
          title: day.date + ': ' + day.count + 'x ' + row.skill
        }));
      }
      grid.appendChild(rowEl);
    }

    // Date labels (show every 7th)
    if (hm.dates.length > 0) {
      const dateRow = el('div', { className: 'heatmap-dates' });
      hm.dates.forEach((date, i) => {
        const label = el('div', { className: 'heatmap-date' });
        if (i % 7 === 0) label.textContent = date.slice(5);
        dateRow.appendChild(label);
      });
      hmPanel.appendChild(grid);
      hmPanel.appendChild(dateRow);
    } else {
      hmPanel.appendChild(grid);
    }

    // Legend
    const legend = el('div', { className: 'heatmap-legend' });
    legend.appendChild(document.createTextNode('Less'));
    const legendColors = isLight
      ? ['#f1f5f9', '#bfdbfe', '#60a5fa', '#3b82f6', '#1d4ed8']
      : ['var(--bg-elevated)', '#1a3a5c', '#1d5a8a', '#2176b8', '#3b9fe6'];
    legendColors.forEach(c => {
      legend.appendChild(el('div', { className: 'heatmap-legend-cell', style: 'background:' + c }));
    });
    legend.appendChild(document.createTextNode('More'));
    hmPanel.appendChild(legend);

    app.appendChild(hmPanel);
  }

  // ── Bottom Row: Timeline + Chains ──
  const bottomRow = el('div', { className: 'bottom-row' });

  // Session Timeline
  const tlPanel = el('div', { className: 'panel' });
  tlPanel.appendChild(el('div', { className: 'panel-title' }, 'Recent Sessions'));
  const timeline = el('div', { className: 'timeline' });
  if (d.sessionTimeline && d.sessionTimeline.length > 0) {
    for (const session of d.sessionTimeline) {
      const tlEl = el('div', { className: 'tl-session' });
      tlEl.appendChild(el('div', { className: 'tl-header' },
        el('div', { className: 'tl-date' }, session.date),
        el('div', { className: 'tl-meta' }, session.duration_min + 'min \\u2022 ' + session.tool_calls + ' tools')
      ));
      const skills = el('div', { className: 'tl-skills' });
      for (const skill of session.skills_used.slice(0, 8)) {
        skills.appendChild(el('span', {
          className: 'tl-skill' + (skill === session.primary_skill ? ' primary' : '')
        }, skill));
      }
      if (session.skills_used.length > 8) {
        skills.appendChild(el('span', { className: 'tl-skill', style: 'opacity:0.5' }, '+' + (session.skills_used.length - 8)));
      }
      tlEl.appendChild(skills);
      if (session.chains.length > 0) {
        tlEl.appendChild(el('div', { className: 'tl-chain' }, session.chains[0].join(' \\u2192 ')));
      }
      timeline.appendChild(tlEl);
    }
  } else {
    timeline.appendChild(el('div', { style: 'color:var(--text-muted);text-align:center;padding:20px;font-size:13px' }, 'No sessions yet'));
  }
  tlPanel.appendChild(timeline);
  bottomRow.appendChild(tlPanel);

  // Workflow Chains
  const chainPanel = el('div', { className: 'panel' });
  chainPanel.appendChild(el('div', { className: 'panel-title' }, 'Workflow Chains'));
  if (d.skillChains && d.skillChains.length > 0) {
    const maxChain = d.skillChains[0].count || 1;
    const table = el('table', { className: 'chain-table' });
    table.appendChild(el('thead', null,
      el('tr', null,
        el('th', null, 'Chain'),
        el('th', null, ''),
        el('th', { style: 'text-align:right;width:50px' }, '#')
      )
    ));
    const tbody = el('tbody');
    d.skillChains.slice(0, 12).forEach(c => {
      const pct = Math.max(5, (c.count / maxChain) * 100);
      tbody.appendChild(el('tr', null,
        el('td', { className: 'chain-name' }, c.chain),
        el('td', { style: 'width:80px' }, el('div', { className: 'chain-bar', style: 'width:' + pct + '%' })),
        el('td', { className: 'chain-count' }, String(c.count))
      ));
    });
    table.appendChild(tbody);
    chainPanel.appendChild(table);
  } else {
    chainPanel.appendChild(el('div', { style: 'color:var(--text-muted);text-align:center;padding:20px;font-size:13px' }, 'No chains yet'));
  }
  bottomRow.appendChild(chainPanel);

  app.appendChild(bottomRow);

  // Footer
  app.appendChild(el('div', { className: 'footer' },
    'Generated ' + new Date(d.generated).toLocaleString() + ' \\u2022 Rune Business \\u2022 100% local data'
  ));
}

function toggleTheme() {
  document.body.classList.toggle('light');
  drawVoronoiMesh();
}

// ─── Voronoi Mesh Background ───
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let meshSeeds = [], meshW = 0, meshH = 0;

function generateSeeds() {
  meshW = window.innerWidth;
  meshH = window.innerHeight;
  meshSeeds = [];
  const N = 50;
  const rng = mulberry32(42);
  for (let i = 0; i < N; i++) {
    const x = rng() * meshW;
    const y = rng() * meshH;
    const g = (x / meshW) * 0.45 + (1 - y / meshH) * 0.35;
    const hueShift = rng() * 0.3 - 0.15;
    meshSeeds.push({ x, y, g, hue: hueShift, phase: rng() * Math.PI * 2 });
  }
}

function drawVoronoiCells() {
  let canvas = document.getElementById('voronoi-bg');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'voronoi-bg'; document.body.prepend(canvas); }
  const w = meshW, h = meshH, scale = 2;
  const sw = Math.ceil(w / scale), sh = Math.ceil(h / scale);
  canvas.width = sw; canvas.height = sh;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  const isLight = document.body.classList.contains('light');
  const imageData = ctx.createImageData(sw, sh);
  const data = imageData.data;
  const seeds = meshSeeds.map(s => ({ ...s, sx: s.x / scale, sy: s.y / scale }));
  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      let d1 = Infinity, d2 = Infinity, ni = 0;
      for (let i = 0; i < seeds.length; i++) {
        const dx = px - seeds[i].sx, dy = py - seeds[i].sy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; ni = i; } else if (d < d2) { d2 = d; }
      }
      const seed = seeds[ni];
      const e1 = Math.sqrt(d1), e2 = Math.sqrt(d2);
      const edgeGlow = Math.max(0, 1 - (e2 - e1) / 2.5);
      const depthShade = 0.85 + 0.15 * Math.min(1, (e1 / (e2 * 0.5 + 1)) * 0.8);
      let r, g, b;
      if (isLight) {
        const base = 0.88 - seed.g * 0.18;
        r = Math.round((base - 0.03 + seed.hue * 0.04) * 255 * depthShade);
        g = Math.round((base - 0.01 + seed.hue * 0.02) * 255 * depthShade);
        b = Math.round((base + 0.02) * 255 * depthShade);
        r = Math.min(255, r + Math.round(edgeGlow * 40));
        g = Math.min(255, g + Math.round(edgeGlow * 38));
        b = Math.min(255, b + Math.round(edgeGlow * 50));
      } else {
        const base = 0.04 + seed.g * 0.09;
        r = Math.round((base * 0.45 + seed.hue * 0.03) * 255 * depthShade);
        g = Math.round((base * 0.65 + seed.hue * 0.05) * 255 * depthShade);
        b = Math.round((base * 1.4 + seed.hue * 0.08) * 255 * depthShade);
        r = Math.min(255, r + Math.round(edgeGlow * 25));
        g = Math.min(255, g + Math.round(edgeGlow * 35));
        b = Math.min(255, b + Math.round(edgeGlow * 65));
      }
      const idx = (py * sw + px) * 4;
      data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const grd = ctx.createRadialGradient(sw * 0.7, sh * 0.1, 0, sw * 0.5, sh * 0.5, sw * 0.9);
  if (isLight) { grd.addColorStop(0, 'rgba(255,255,255,0.1)'); grd.addColorStop(1, 'rgba(0,0,0,0.04)'); }
  else { grd.addColorStop(0, 'rgba(80,140,255,0.06)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.2)'); }
  ctx.fillStyle = grd; ctx.fillRect(0, 0, sw, sh);
}

let meshAnimFrame = null;
function initMeshOverlay() {
  let canvas = document.getElementById('mesh-overlay');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'mesh-overlay'; const bg = document.getElementById('voronoi-bg'); if (bg) bg.after(canvas); else document.body.prepend(canvas); }
  canvas.width = meshW; canvas.height = meshH;
  canvas.style.width = meshW + 'px'; canvas.style.height = meshH + 'px';
  const edges = [];
  const seeds = meshSeeds;
  for (let i = 0; i < seeds.length; i++) {
    const dists = [];
    for (let j = 0; j < seeds.length; j++) { if (i === j) continue; const dx = seeds[i].x - seeds[j].x, dy = seeds[i].y - seeds[j].y; dists.push({ j, d: dx*dx+dy*dy }); }
    dists.sort((a,b) => a.d - b.d);
    for (let k = 0; k < Math.min(3, dists.length); k++) { const key = Math.min(i, dists[k].j)+'-'+Math.max(i, dists[k].j); if (!edges.find(e => e.key === key)) edges.push({ key, a: Math.min(i, dists[k].j), b: Math.max(i, dists[k].j) }); }
  }
  if (meshAnimFrame) cancelAnimationFrame(meshAnimFrame);
  const ctx = canvas.getContext('2d');
  function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = t * 0.001;
    const isLight = document.body.classList.contains('light');
    for (const edge of edges) {
      const sa = seeds[edge.a], sb = seeds[edge.b];
      const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.4 + (sa.phase + sb.phase) / 2));
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
      ctx.strokeStyle = isLight ? 'rgba(100,100,140,' + (0.04 * pulse).toFixed(3) + ')' : 'rgba(100,160,255,' + (0.06 * pulse).toFixed(3) + ')';
      ctx.lineWidth = 0.8; ctx.stroke();
    }
    for (const s of seeds) {
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.6 + s.phase));
      const radius = 1.5 + pulse;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 4);
      grad.addColorStop(0, isLight ? 'rgba(80,80,160,' + (0.12 * pulse).toFixed(3) + ')' : 'rgba(100,180,255,' + (0.2 * pulse).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(s.x, s.y, radius * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isLight ? 'rgba(100,100,180,' + (0.25 * pulse).toFixed(3) + ')' : 'rgba(140,200,255,' + (0.4 * pulse).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    meshAnimFrame = requestAnimationFrame(frame);
  }
  meshAnimFrame = requestAnimationFrame(frame);
}

function drawVoronoiMesh() { generateSeeds(); drawVoronoiCells(); initMeshOverlay(); }

drawVoronoiMesh();
window.addEventListener('resize', drawVoronoiMesh);
render();
</script>
</body>
</html>`;
}
