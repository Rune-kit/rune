/**
 * mesh-diagram.mjs — layout + HTML for docs/assets/mesh-diagram.html.
 * Data comes from skill-index.json and live mesh stats. Interaction lives in mesh-view.mjs.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml } from './changelog.mjs';

export const LAYER_STYLE = {
  L0: { color: '#f59e0b', r: 0, label: 'L0 Router' },
  L1: { color: '#ef4444', r: 105, label: 'L1 Orchestrators' },
  L2: { color: '#6366f1', r: 215, label: 'L2 Workflow hubs' },
  L3: { color: '#10b981', r: 345, label: 'L3 Utilities' },
  L4: { color: '#06b6d4', r: 480, label: 'L4 Extension packs' },
};

export function meshLayout(index, packs) {
  const byLayer = { L0: [], L1: [], L2: [], L3: [], L4: [] };
  for (const [name, s] of Object.entries(index.skills)) (byLayer[s.layer] || byLayer.L3).push(name);
  for (const k of Object.keys(byLayer)) byLayer[k].sort();
  byLayer.L4 = packs.map((p) => `@rune/${p}`);
  const nodes = {};
  const offsets = { L1: -Math.PI / 2, L2: -Math.PI / 2 + 0.05, L3: -Math.PI / 2 + 0.1, L4: -Math.PI / 2 };
  for (const [layer, names] of Object.entries(byLayer)) {
    const { r } = LAYER_STYLE[layer];
    names.forEach((name, i) => {
      const a = names.length === 1 && r === 0 ? 0 : offsets[layer] + (2 * Math.PI * i) / names.length;
      nodes[name] = { name, layer, a, x: +(r * Math.cos(a)).toFixed(1), y: +(r * Math.sin(a)).toFixed(1) };
    });
  }
  const edges = [];
  for (const [from, tos] of Object.entries(index.graph || {})) {
    for (const to of tos) if (nodes[from] && nodes[to] && from !== to) edges.push([from, to]);
  }
  return { byLayer, nodes, edges };
}

/** Front-matter `description:` of each free pack, keyed by `@rune/<name>`. */
export function packDescriptions(root, packs) {
  const out = {};
  for (const p of packs) {
    const file = join(root, 'extensions', p, 'PACK.md');
    if (!existsSync(file)) continue;
    const m = readFileSync(file, 'utf8').match(/^description:\s*(.+)$/m);
    out[`@rune/${p}`] = (m ? m[1] : '').trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function catalogFrom(index, layout, packDesc) {
  const nodes = {};
  for (const [name, pos] of Object.entries(layout.nodes)) {
    const skill = index.skills?.[name];
    const pack = packDesc[name] || '';
    nodes[name] = {
      layer: pos.layer,
      group: skill?.group || (pos.layer === 'L4' ? 'pack' : ''),
      description: skill?.description || pack,
      emit: skill?.signals?.emit || [],
      listen: skill?.signals?.listen || [],
      x: pos.x,
      y: pos.y,
    };
  }
  return nodes;
}

export function renderMeshDiagram(index, stats, packs, packDesc = {}) {
  const { byLayer, nodes, edges } = meshLayout(index, packs);
  const H = 540;
  const catalog = catalogFrom(index, { nodes }, packDesc);
  const rings = ['L1', 'L2', 'L3', 'L4'].map((l) => `<circle class="ring" r="${LAYER_STYLE[l].r}"/>`).join('');
  const edgeSvg = edges
    .map(([f, t]) => {
      const a = nodes[f];
      const b = nodes[t];
      const mx = ((a.x + b.x) / 2) * 0.6;
      const my = ((a.y + b.y) / 2) * 0.6;
      return `<path class="edge" data-f="${escapeHtml(f)}" data-t="${escapeHtml(t)}" stroke="${LAYER_STYLE[a.layer].color}" d="M${a.x},${a.y} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x},${b.y}"/>`;
    })
    .join('\n');
  const nodeSvg = Object.values(nodes)
    .map((n) => {
      const c = LAYER_STYLE[n.layer].color;
      const size = n.layer === 'L0' ? 18 : n.layer === 'L1' ? 11 : 7;
      let label;
      if (n.layer === 'L0') {
        label = `<text class="lbl lbl-hub" y="32" text-anchor="middle">${escapeHtml(n.name)}</text>`;
      } else {
        const ox = +(Math.cos(n.a) * (size + 10)).toFixed(1);
        const oy = +(Math.sin(n.a) * (size + 10)).toFixed(1);
        const anchor = Math.cos(n.a) < 0 ? 'end' : 'start';
        const cls = n.layer === 'L1' ? 'lbl lbl-hub' : 'lbl';
        label = `<text class="${cls}" x="${ox}" y="${oy}" dy="0.35em" text-anchor="${anchor}">${escapeHtml(n.name)}</text>`;
      }
      return `<g class="node" data-n="${escapeHtml(n.name)}" transform="translate(${n.x},${n.y})" tabindex="0" role="button" aria-label="${escapeHtml(n.name)} (${n.layer})"><title>${escapeHtml(n.name)} (${n.layer})</title><circle r="${size}" fill="${c}"/>${label}</g>`;
    })
    .join('\n');
  const counts = {
    skills: stats.skillCount,
    connections: stats.totalConnections,
    signals: stats.signalCount,
    packs: packs.length,
  };
  const legend = Object.entries(LAYER_STYLE)
    .map(
      ([l, s]) =>
        `<button type="button" class="layer-btn" data-layer="${l}" aria-pressed="true" title="Toggle ${s.label}"><i style="background:${s.color}"></i>${s.label} <b>${l === 'L4' ? packs.length : byLayer[l].length}</b></button>`,
    )
    .join('');
  const data = JSON.stringify({ nodes: catalog, edges }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- GENERATED by scripts/site-gen.mjs from skill-index.json + live mesh stats — do not edit by hand. -->
<title>Rune — ${counts.skills}-Skill Mesh Architecture</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<script>
  try {
    const t = new URLSearchParams(location.search).get('theme') || localStorage.getItem('rune-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
</script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0e17; --ink: #e8eef6; --muted: #8b9aab; --card: #111827; --line: #223042;
    --accent: #10b981; --halo: #0a0e17; --shadow: 0 10px 32px rgba(0,0,0,.4);
    --display: 'Space Grotesk', system-ui, sans-serif;
    --body: 'Inter', system-ui, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, monospace;
  }
  [data-theme="light"] {
    --bg: #f4f6f8; --ink: #0f172a; --muted: #475569; --card: #ffffff; --line: #d8dee8;
    --accent: #059669; --halo: #f4f6f8; --shadow: 0 10px 28px rgba(15,23,42,.12);
  }
  html, body { height: 100%; background: var(--bg); color: var(--ink); font-family: var(--body); overflow: hidden; }
  body { display: flex; flex-direction: column; min-width: 0; }
  .mesh-chrome {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
    padding: 10px 12px 8px; flex: none; min-width: 0;
  }
  .brand { min-width: 0; flex: 1 1 140px; }
  .brand b { display: block; font: 700 15px/1.2 var(--display); }
  .brand span { font-size: 11.5px; color: var(--muted); }
  .stats { display: flex; gap: 12px; text-align: right; flex: none; }
  .stats div b { display: block; font: 700 16px/1.1 var(--mono); color: #f59e0b; }
  .stats div span { font: 600 9px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .search-wrap { position: relative; flex: 1 1 180px; min-width: 0; max-width: 320px; }
  #mesh-search {
    width: 100%; background: var(--card); color: var(--ink); border: 1px solid var(--line);
    border-radius: 10px; padding: 8px 12px; font: 500 14px var(--body);
  }
  #mesh-search:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  #mesh-suggest {
    position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 4px);
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    box-shadow: var(--shadow); max-height: 240px; overflow: auto; padding: 4px;
  }
  #mesh-suggest .suggest {
    display: flex; justify-content: space-between; gap: 8px; width: 100%;
    background: none; border: 0; color: var(--ink); font: 500 13px var(--mono);
    padding: 8px 10px; border-radius: 8px; cursor: pointer; text-align: left;
  }
  #mesh-suggest .suggest:hover, #mesh-suggest .suggest[data-first] { background: color-mix(in oklch, var(--accent) 14%, transparent); }
  #mesh-suggest .suggest span { color: var(--muted); font-size: 11px; }
  .zoom-btns { display: flex; align-items: center; gap: 4px; flex: none; }
  .zoom-btns button, #mesh-full {
    background: var(--card); color: var(--ink); border: 1px solid var(--line);
    border-radius: 8px; min-width: 32px; height: 32px; padding: 0 10px;
    font: 600 14px var(--mono); cursor: pointer; text-decoration: none; display: inline-grid; place-items: center;
  }
  .zoom-btns button:hover, #mesh-full:hover { border-color: var(--accent); }
  #zoom-readout { font: 600 12px var(--mono); color: var(--muted); min-width: 40px; text-align: center; }
  #mesh-full { font-size: 12px; height: 32px; padding: 0 10px; white-space: nowrap; }
  #mesh-full[data-standalone] { display: none; }
  #mesh-stage { flex: 1; min-height: 0; min-width: 0; position: relative; display: flex; }
  #mesh { flex: 1; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
  #mesh:active { cursor: grabbing; }
  .ring { fill: none; stroke: color-mix(in oklch, var(--ink) 14%, transparent); stroke-dasharray: 3 5; }
  .edge { fill: none; stroke-width: 1; opacity: .045; pointer-events: none; transition: opacity .12s; }
  .edge.is-dim { opacity: .015; }
  .edge.is-hover { opacity: .6; stroke-width: 1.6; }
  .edge.is-on { opacity: .95; stroke-width: 2; }
  .lbl {
    font: 500 13px var(--mono); fill: var(--ink); pointer-events: none;
    paint-order: stroke; stroke: var(--halo); stroke-width: 4px;
  }
  .lbl-hub { font-weight: 700; font-size: 15px; }
  .node { cursor: pointer; outline: none; }
  .node circle { stroke: var(--halo); stroke-width: 1.5; }
  .node.is-dim { opacity: .28; }
  .node.is-selected circle, .node:focus-visible circle { stroke: var(--accent); stroke-width: 3; }
  .legend {
    display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
    padding: 6px 10px 10px; flex: none;
  }
  .layer-btn {
    background: var(--card); color: var(--muted); border: 1px solid var(--line);
    border-radius: 999px; padding: 4px 10px; font: 500 11.5px var(--body); cursor: pointer;
  }
  .layer-btn i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
  .layer-btn b { color: var(--ink); margin-left: 2px; }
  .layer-btn[aria-pressed="true"] { color: var(--ink); }
  .layer-btn[data-off] { opacity: .45; }
  #mesh-panel {
    position: absolute; top: 8px; right: 8px; width: min(300px, 46%);
    max-height: calc(100% - 16px); overflow: auto; overflow-wrap: anywhere;
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 14px 16px 16px; box-shadow: var(--shadow); z-index: 3;
  }
  #mesh-panel h2 { font: 700 18px var(--display); margin: 0 0 8px; padding-right: 24px; }
  #mesh-panel h3 { font: 700 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 12px 0 6px; }
  .panel-layer { font: 600 11.5px var(--mono); color: var(--accent); margin-bottom: 2px; }
  .panel-desc { font-size: 13.5px; color: var(--muted); line-height: 1.45; }
  .panel-close {
    position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
    border: 0; background: none; color: var(--muted); font-size: 20px; cursor: pointer;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    background: color-mix(in oklch, var(--accent) 12%, var(--bg));
    color: var(--ink); border: 1px solid color-mix(in oklch, var(--accent) 35%, var(--line));
    border-radius: 999px; padding: 3px 9px; font: 500 12px var(--mono); cursor: pointer;
  }
  .chip:hover { border-color: var(--accent); }
  .empty { font-size: 13px; color: var(--muted); }
  .signals p { font-size: 12.5px; color: var(--muted); margin-bottom: 4px; }
  .signals span { font: 600 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; margin-right: 6px; }
  .signals code { font: 500 11.5px var(--mono); background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
  @media (max-width: 640px) {
    .brand span, .stats { display: none; }
    .search-wrap { flex: 1 1 100%; max-width: none; }
    #mesh-panel {
      top: auto; right: 0; left: 0; bottom: 0; width: auto;
      max-height: 46%; border-radius: 16px 16px 0 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .edge, .node { transition: none; }
  }
</style>
</head>
<body>
  <div class="mesh-chrome">
    <div class="brand">
      <b>Rune Skill Mesh</b>
      <span>Hover or click a skill to see its links · scroll or pinch to zoom</span>
    </div>
    <div class="stats">
      <div><b>${counts.skills}</b><span>skills</span></div>
      <div><b>${counts.connections}</b><span>connections</span></div>
      <div><b>${counts.signals}</b><span>signals</span></div>
    </div>
    <div class="search-wrap">
      <input id="mesh-search" type="search" placeholder="Search a skill…" aria-label="Search a skill" autocomplete="off" spellcheck="false">
      <div id="mesh-suggest" hidden role="listbox" aria-label="Matching skills"></div>
    </div>
    <div class="zoom-btns">
      <button type="button" id="zoom-out" aria-label="Zoom out">−</button>
      <span id="zoom-readout" aria-live="polite">100%</span>
      <button type="button" id="zoom-in" aria-label="Zoom in">+</button>
      <button type="button" id="zoom-fit" aria-label="Reset view">Fit</button>
    </div>
    <a id="mesh-full" href="mesh-diagram.html" target="_blank" rel="noopener">Open fullscreen</a>
  </div>
  <div id="mesh-stage">
    <svg id="mesh" viewBox="${-H} ${-H} ${2 * H} ${2 * H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rune mesh: ${counts.skills} core skills in layers L0 to L3 plus ${counts.packs} extension packs; ${counts.connections} connections and ${counts.signals} signals. Scroll or pinch to zoom, drag to pan, click a skill for its connections.">
      <g id="camera">
        ${rings}
        <g id="edges">${edgeSvg}</g>
        <g id="nodes">${nodeSvg}</g>
      </g>
    </svg>
    <aside id="mesh-panel" hidden></aside>
  </div>
  <div class="legend" role="group" aria-label="Toggle layers">${legend}</div>
  <script type="application/json" id="mesh-data">${data}</script>
  <script type="module">
    import { boot } from './mesh-view.js';
    boot(document, JSON.parse(document.getElementById('mesh-data').textContent));
  </script>
</body>
</html>
`;
}
