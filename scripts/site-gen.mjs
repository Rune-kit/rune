#!/usr/bin/env node
/**
 * site-gen.mjs — regenerate every site/CLI artifact that is derived from
 * CHANGELOG.md, skill-index.json and the live mesh stats. Hand-edit the
 * sources, never the outputs.
 *
 *   node scripts/site-gen.mjs            write all outputs
 *   node scripts/site-gen.mjs --check    exit 1 if any output is stale (CI / npm run doctor)
 *   node scripts/site-gen.mjs notes <X.Y.Z> [--telegram|--plain]
 *                                        print release notes for one version from CHANGELOG.md
 *                                        (GitHub release body, Telegram HTML, or ClawHub plain text);
 *                                        exit 3 when CHANGELOG has no such section
 *
 * Outputs:
 *   docs/changelog.html                       full changelog page
 *   docs/assets/mesh-diagram.html             mesh diagram (layout from skill-index.json)
 *   compiler/data/whats-new.json              data for the CLI "what's new" notice
 *   marker regions <!-- rune:gen:NAME --> … <!-- /rune:gen:NAME --> in:
 *     docs/index.html        whats-new chip
 *     docs/guides/index.html whats-new chip, layer table body
 *     docs/skills/index.html version badge, stats bar
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectStats } from '../compiler/status.js';
import {
  anchorFor,
  CHANGELOG_URL,
  escapeHtml,
  inlineMd,
  isFixSection,
  isNewSection,
  latestReleased,
  notesMarkdown,
  parseChangelog,
  plainText,
  releaseHighlights,
  telegramText,
} from './lib/changelog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// ─── marker regions ───

export function replaceRegion(html, name, body, file = '?') {
  const re = new RegExp(`(<!-- rune:gen:${name} -->)[\\s\\S]*?(<!-- /rune:gen:${name} -->)`);
  if (!re.test(html)) throw new Error(`${file}: missing marker <!-- rune:gen:${name} --> … <!-- /rune:gen:${name} -->`);
  return html.replace(re, (_, a, b) => `${a}${body}${b}`);
}

// ─── what's new ───

function firstSentence(text, max = 110) {
  const s = plainText(text).replace(/`/g, '');
  const one = s.split(/(?<=[.!?])\s/)[0].replace(/[.]$/, '');
  return one.length > max ? `${one.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : one;
}

export function chipText(release) {
  if (release.intro) return firstSentence(release.intro.replace(/^"[^"]+"\s+[—–-]\s+/, ''));
  return firstSentence(releaseHighlights(release, 1)[0] || '');
}

export function renderChip(release, base) {
  if (!release) return '\n';
  const href = `${base}changelog.html#${anchorFor(release.version)}`;
  return `
<a class="wn-chip" href="${href}"><span class="wn-tag">New in v${escapeHtml(release.version)}</span><span class="wn-text">${escapeHtml(chipText(release))}</span><span class="wn-arrow" aria-hidden="true">&rarr;</span></a>
`;
}

export function whatsNewData(release) {
  if (!release) return null;
  return {
    version: release.version,
    date: release.date,
    summary: chipText(release),
    highlights: releaseHighlights(release, 3).map((t) => plainText(t).replace(/`/g, '')),
    url: `${CHANGELOG_URL}#${anchorFor(release.version)}`,
  };
}

// ─── changelog page ───

function renderItem(i) {
  const body = i.prose ? i.body : i.body;
  if (i.prose) return `<li><strong>${inlineMd(i.title)}</strong><span class="cl-body">${inlineMd(body)}</span></li>`;
  return `<li><strong>${inlineMd(i.title)}</strong>${body ? ` <span class="cl-body">${inlineMd(body)}</span>` : ''}</li>`;
}

function renderRelease(r, { expanded }) {
  const id = anchorFor(r.version);
  const unreleased = r.version === 'Unreleased';
  const news = r.sections.filter(isNewSection);
  const fixes = r.sections.filter(isFixSection);
  const other = r.sections.filter((s) => !isNewSection(s) && !isFixSection(s));
  const allNew = news.flatMap((s) => s.items);
  const [hero, ...restNew] = allNew.length ? allNew : r.sections.flatMap((s) => s.items).slice(0, 1);
  const heroFromOther = !allNew.length;
  const group = (label, items, open) =>
    items.length
      ? `<details class="cl-group"${open ? ' open' : ''}><summary>${label} <span class="cl-count">${items.length}</span></summary><ul>${items.map(renderItem).join('')}</ul></details>`
      : '';
  const otherItems = other.flatMap((s) => s.items).filter((i) => !(heroFromOther && i === hero));
  const fixItems = fixes.flatMap((s) => s.items).filter((i) => !(heroFromOther && i === hero));
  const badge = unreleased
    ? '<span class="cl-ver cl-ver-next">Unreleased</span><span class="cl-date">On master — not on npm yet</span>'
    : `<a class="cl-ver" href="#${id}">v${escapeHtml(r.version)}</a><time class="cl-date" datetime="${r.date || ''}">${r.date ? fmtDate(r.date) : ''}</time>`;
  return `
<article class="cl-entry${unreleased ? ' cl-next' : ''}" id="${id}" data-areas="${escapeHtml(r.areas.join('|'))}">
  <div class="cl-gutter">${badge}</div>
  <div class="cl-main">
    ${r.intro ? `<p class="cl-intro">${inlineMd(r.intro)}</p>` : ''}
    ${r.areas.length ? `<p class="cl-areas">${r.areas.map((a) => `<span class="cl-area">${escapeHtml(a)}</span>`).join('')}</p>` : ''}
    ${hero ? `<div class="cl-hero"><p class="cl-eyebrow">${heroFromOther ? 'Headline' : 'Highlight'}</p><h3>${inlineMd(hero.title)}</h3>${hero.body && hero.body !== hero.title ? `<p>${inlineMd(hero.body)}</p>` : ''}</div>` : ''}
    ${group('New', restNew, expanded)}
    ${group('Changed', otherItems, false)}
    ${group('Fixed', fixItems, false)}
  </div>
</article>`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function renderChangelogPage(releases) {
  const latest = latestReleased(releases);
  const rail = releases
    .slice(0, 40)
    .map(
      (r) =>
        `<a href="#${anchorFor(r.version)}">${r.version === 'Unreleased' ? 'Unreleased' : `v${escapeHtml(r.version)}`}</a>`,
    )
    .join('');
  const areas = [...new Set(releases.flatMap((r) => r.areas))];
  const entries = releases.map((r, idx) => renderRelease(r, { expanded: idx < 6 })).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- GENERATED by scripts/site-gen.mjs from CHANGELOG.md — do not edit by hand. -->
  <title>Rune Changelog — what's new in every release</title>
  <meta name="description" content="Every Rune release: new features, changes and fixes${latest ? `. Latest: v${escapeHtml(latest.version)}` : ''}.">
  <meta property="og:title" content="Rune Changelog">
  <meta property="og:url" content="https://rune-kit.github.io/rune/changelog.html">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <script>document.documentElement.setAttribute('data-theme', localStorage.getItem('rune-theme') || 'dark');</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0f1a; --card: #111827; --elev: #1a2332; --code: #0d1117;
      --ink: #f0f4f8; --ink-2: #a3b1c2; --ink-3: #6b7b8c; --line: #1e2d3d;
      --accent: #10b981; --accent-tint: rgba(16,185,129,0.12); --amber: #f59e0b;
      --display: 'Space Grotesk', system-ui, sans-serif; --body: 'Inter', system-ui, sans-serif;
      --mono: 'JetBrains Mono', ui-monospace, monospace;
    }
    [data-theme="light"] {
      --bg: #f8fafb; --card: #ffffff; --elev: #f1f5f9; --code: #f1f5f9;
      --ink: #0f172a; --ink-2: #475569; --ink-3: #64748b; --line: #e2e8f0;
      --accent: #059669; --accent-tint: rgba(5,150,105,0.10);
    }
    html { scroll-padding-top: 72px; }
    body { background: var(--bg); color: var(--ink); font: 400 16px/1.65 var(--body); -webkit-font-smoothing: antialiased; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font: 500 0.86em var(--mono); background: var(--code); border: 1px solid var(--line); padding: 1px 6px; border-radius: 5px; overflow-wrap: anywhere; }
    :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
    .nav { position: sticky; top: 0; z-index: 10; background: color-mix(in oklch, var(--bg) 92%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
    .nav-inner { max-width: 1180px; margin: 0 auto; padding: 0 20px; height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .logo { font: 700 18px var(--display); color: var(--ink); }
    .logo span { color: var(--accent); }
    .nav-links { display: flex; align-items: center; gap: 20px; font-size: 14px; }
    .nav-links a { color: var(--ink-2); }
    .nav-links a.active { color: var(--accent); }
    .theme { background: none; border: 1px solid var(--line); color: var(--ink-2); border-radius: 8px; width: 34px; height: 34px; cursor: pointer; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 48px 20px 96px; display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 48px; }
    .rail { position: sticky; top: 80px; align-self: start; max-height: calc(100vh - 100px); overflow: auto; display: grid; gap: 2px; font: 500 13px var(--mono); }
    .rail a { color: var(--ink-3); padding: 4px 8px; border-radius: 6px; }
    .rail a:hover { color: var(--ink); background: var(--elev); text-decoration: none; }
    .head h1 { font: 700 clamp(34px, 5vw, 52px)/1.05 var(--display); letter-spacing: -0.02em; margin-bottom: 12px; }
    .head p { color: var(--ink-2); max-width: 640px; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 24px 0 8px; }
    .filters button { font: 500 13px var(--body); color: var(--ink-2); background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
    .filters button[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); background: var(--accent-tint); }
    .cl-entry { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 32px; padding: 40px 0; border-bottom: 1px solid var(--line); }
    .cl-entry[hidden] { display: none; }
    .cl-gutter { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .cl-ver { font: 700 14px var(--mono); color: var(--accent); background: var(--accent-tint); border: 1px solid color-mix(in oklch, var(--accent) 40%, transparent); padding: 3px 10px; border-radius: 999px; }
    .cl-ver-next { color: var(--amber); background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.4); }
    .cl-date { font: 500 13px var(--mono); color: var(--ink-3); }
    .cl-intro { font: 600 21px/1.4 var(--display); color: var(--ink); margin-bottom: 12px; text-wrap: pretty; }
    .cl-areas { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
    .cl-area { font: 600 12px var(--mono); letter-spacing: 0.04em; color: var(--ink-2); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
    .cl-hero { background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 12px; padding: 20px 22px; margin-bottom: 16px; }
    .cl-eyebrow { font: 700 12px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
    .cl-main { min-width: 0; overflow-wrap: anywhere; }
    main { min-width: 0; }
    .cl-hero h3 { font: 700 19px/1.35 var(--display); margin-bottom: 6px; }
    .cl-hero p:not(.cl-eyebrow) { color: var(--ink-2); font-size: 15px; }
    .cl-group { border: 1px solid var(--line); border-radius: 10px; margin-top: 10px; background: color-mix(in oklch, var(--card) 60%, transparent); }
    .cl-group summary { cursor: pointer; padding: 10px 16px; font: 600 15px var(--display); list-style: none; display: flex; align-items: center; gap: 8px; }
    .cl-group summary::-webkit-details-marker { display: none; }
    .cl-group summary::before { content: "▸"; color: var(--ink-3); transition: transform 150ms ease; }
    .cl-group[open] summary::before { transform: rotate(90deg); }
    .cl-count { font: 600 12px var(--mono); color: var(--ink-3); background: var(--elev); border-radius: 999px; padding: 1px 8px; }
    .cl-group ul { padding: 0 20px 14px 36px; display: grid; gap: 10px; }
    .cl-group li { color: var(--ink-2); font-size: 15px; overflow-wrap: anywhere; }
    .cl-group li strong { color: var(--ink); font-weight: 600; }
    .cl-body { display: inline; }
    .foot { color: var(--ink-3); font-size: 14px; margin-top: 32px; }
    @media (max-width: 860px) {
      .wrap { grid-template-columns: minmax(0, 1fr); padding-top: 32px; }
      .rail { display: none; }
      .cl-entry { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 28px 0; }
      .cl-gutter { flex-direction: row; align-items: center; gap: 10px; }
      .nav-links { gap: 14px; }
      .nav-links .hide-sm { display: none; }
      .cl-intro { font-size: 18px; }
    }
  </style>
</head>
<body>
  <nav class="nav"><div class="nav-inner">
    <a class="logo" href="./"><span>&#9670;</span> Rune</a>
    <div class="nav-links">
      <a href="./">Home</a><a href="guides/">Guides</a><a class="hide-sm" href="skills/">Skills</a><a class="active" href="changelog.html" aria-current="page">Changelog</a>
      <button class="theme" id="theme" aria-label="Toggle light/dark mode">&#9790;</button>
      <a class="hide-sm" href="https://github.com/rune-kit/rune" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div></nav>
  <div class="wrap">
    <nav class="rail" aria-label="Releases">${rail}</nav>
    <main>
      <header class="head">
        <h1>Changelog</h1>
        <p>What shipped in every Rune release${latest ? ` — latest is <strong>v${escapeHtml(latest.version)}</strong>` : ''}. Update with <code>npm i -g @rune-kit/rune@latest</code>, or run <code>rune whats-new</code> to see the newest highlights in your terminal.</p>
        <div class="filters" role="group" aria-label="Filter by area"><button type="button" data-area="" aria-pressed="true">All</button>${areas.map((a) => `<button type="button" data-area="${escapeHtml(a)}" aria-pressed="false">${escapeHtml(a)}</button>`).join('')}</div>
      </header>
${entries}
      <p class="foot">Generated from <a href="https://github.com/rune-kit/rune/blob/master/CHANGELOG.md">CHANGELOG.md</a>.</p>
    </main>
  </div>
  <script>
    document.getElementById('theme').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('rune-theme', next);
    });
    const buttons = document.querySelectorAll('.filters button');
    buttons.forEach((b) => b.addEventListener('click', () => {
      const area = b.dataset.area;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      document.querySelectorAll('.cl-entry').forEach((e) => {
        e.hidden = !!area && !e.dataset.areas.split('|').includes(area);
      });
    }));
  </script>
</body>
</html>
`;
}

// ─── mesh diagram ───

const LAYER_STYLE = {
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

export function renderMeshDiagram(index, stats, packs) {
  const { byLayer, nodes, edges } = meshLayout(index, packs);
  const H = 540;
  const rings = ['L1', 'L2', 'L3', 'L4'].map((l) => `<circle class="ring" r="${LAYER_STYLE[l].r}"/>`).join('');
  const edgeSvg = edges
    .map(([f, t]) => {
      const a = nodes[f];
      const b = nodes[t];
      // bend toward the centre so the mesh reads as curves, not a hairball of chords
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
      if (n.layer === 'L0')
        label = `<text class="lbl lbl-big" y="42" text-anchor="middle">${escapeHtml(n.name)}</text>`;
      else if (n.layer === 'L1') {
        label = `<text class="lbl lbl-mid" y="${n.y < 0 ? -20 : 32}" text-anchor="middle">${escapeHtml(n.name)}</text>`;
      } else {
        const deg = (n.a * 180) / Math.PI;
        const flip = Math.cos(n.a) < 0;
        const inward = n.layer === 'L2';
        const off = inward ? -10 : 10;
        const anchor = flip !== inward ? 'end' : 'start';
        const rot = flip ? deg + 180 : deg;
        const tx = flip ? -off : off;
        label = `<text class="lbl lbl-hide" transform="rotate(${rot.toFixed(1)})" x="${tx}" dy="0.35em" text-anchor="${anchor}">${escapeHtml(n.name)}</text>`;
      }
      return `<g class="node" data-n="${escapeHtml(n.name)}" transform="translate(${n.x},${n.y})" tabindex="0"><title>${escapeHtml(n.name)} (${n.layer})</title><circle r="${size}" fill="${c}"/>${label}</g>`;
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
        `<span><i style="background:${s.color}"></i>${s.label} <b>${l === 'L4' ? packs.length : byLayer[l].length}</b></span>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- GENERATED by scripts/site-gen.mjs from skill-index.json + live mesh stats — do not edit by hand. -->
<title>Rune — ${counts.skills}-Skill Mesh Architecture</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body { background: #0a0e17; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; overflow: hidden; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 12px 16px 0; }
  .title b { display: block; font: 700 16px 'Space Grotesk', system-ui, sans-serif; }
  .title span { font-size: 12px; color: #8896a8; }
  .stats { display: flex; gap: 16px; text-align: right; }
  .stats div b { display: block; font: 700 18px 'JetBrains Mono', monospace; color: #f59e0b; line-height: 1.1; }
  .stats div span { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: #8896a8; }
  svg { flex: 1; min-height: 0; width: 100%; display: block; }
  .ring { fill: none; stroke: rgba(148,163,184,.12); stroke-dasharray: 3 5; }
  .edge { fill: none; stroke-width: 1.2; opacity: .24; transition: opacity .15s; }
  .lbl { font: 500 15px 'JetBrains Mono', monospace; fill: #c3cfdc; pointer-events: none; paint-order: stroke; stroke: #0a0e17; stroke-width: 4px; }
  .lbl-hide { display: none; }
  .ring-lbl { font: 700 13px 'JetBrains Mono', monospace; letter-spacing: .14em; opacity: .7; }
  svg.focus .ring-lbl { opacity: .25; }
  svg.focus .node.on .lbl-hide { display: block; }
  @media (min-width: 1000px) and (min-height: 760px) { .lbl-hide { display: block; } .lbl { font-size: 11px; stroke-width: 3px; } .lbl-mid { font-size: 14px; } }
  .lbl-mid { font-size: 19px; font-weight: 700; fill: #f0f4f8; }
  .lbl-big { font-size: 20px; font-weight: 700; fill: #f59e0b; }
  .node { cursor: pointer; outline: none; }
  .node circle { stroke: #0a0e17; stroke-width: 1.5; }
  svg.focus .edge { opacity: .03; }
  svg.focus .edge.on { opacity: .9; stroke-width: 1.6; }
  svg.focus .node { opacity: .35; }
  svg.focus .node.on { opacity: 1; }
  svg.focus .node.on .lbl { fill: #f0f4f8; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; justify-content: center; padding: 0 12px 10px; font-size: 11.5px; color: #a3b1c2; }
  .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
  .legend b { color: #f0f4f8; font-weight: 600; margin-left: 2px; }
  .hint { padding: 2px 16px 0; font-size: 11.5px; color: #6b7b8c; }
  @media (max-width: 520px) { .stats { gap: 10px; } .stats div b { font-size: 15px; } .title span { display: none; } }
  @media (prefers-reduced-motion: reduce) { .edge { transition: none; } }
</style>
</head>
<body>
<div class="top">
  <div class="title"><b>Rune Skill Mesh</b><span>Every line is a declared call · hover or tap a skill to trace it</span></div>
  <div class="stats">
    <div><b>${counts.skills}</b><span>skills</span></div>
    <div><b>${counts.connections}</b><span>connections</span></div>
    <div><b>${counts.signals}</b><span>signals</span></div>
  </div>
</div>
<svg id="mesh" viewBox="${-H} ${-H} ${2 * H} ${2 * H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rune mesh: ${counts.skills} core skills in layers L0 to L3 plus ${counts.packs} extension packs; ${counts.connections} connections and ${counts.signals} signals">
${rings}
<g id="edges">
${edgeSvg}
</g>
<g id="nodes">
${nodeSvg}
</g>
</svg>
<div class="legend">${legend}</div>
<script>
  const svg = document.getElementById('mesh');
  const edges = [...svg.querySelectorAll('.edge')];
  function focus(name) {
    if (!name) { svg.classList.remove('focus'); svg.querySelectorAll('.on').forEach((e) => e.classList.remove('on')); return; }
    svg.classList.add('focus');
    const near = new Set([name]);
    for (const e of edges) {
      const on = e.dataset.f === name || e.dataset.t === name;
      e.classList.toggle('on', on);
      if (on) { near.add(e.dataset.f); near.add(e.dataset.t); }
    }
    svg.querySelectorAll('.node').forEach((n) => n.classList.toggle('on', near.has(n.dataset.n)));
  }
  svg.querySelectorAll('.node').forEach((n) => {
    n.addEventListener('mouseenter', () => focus(n.dataset.n));
    n.addEventListener('focus', () => focus(n.dataset.n));
    n.addEventListener('click', (ev) => { ev.stopPropagation(); focus(n.dataset.n); });
  });
  svg.addEventListener('mouseleave', () => focus(null));
  svg.addEventListener('click', () => focus(null));
</script>
</body>
</html>
`;
}

// ─── generated regions on hand-written pages ───

const LAYER_ROWS = [
  ['L0', 'l0', 'Router', 'skill-router — routes every action to the right skill'],
  ['L1', 'l1', 'Orchestrators', 'cook, team, launch, rescue, scaffold'],
  ['L2', 'l2', 'Workflow Hubs', 'plan, debug, fix, test, review, sentinel, design, ba, adversary...'],
  ['L3', 'l3', 'Utilities', 'research, verification, git, session-bridge, sentinel-env...'],
  ['L4', 'l4', 'Extension Packs', '@rune/trading, @rune/saas, @rune/ai-ml, @rune/gamedev...'],
];

export function renderLayerRows(stats) {
  const count = (l) => (l === 'L4' ? stats.freePacks.length : stats.layers[l]);
  return `\n${LAYER_ROWS.map(
    ([l, cls, role, ex]) =>
      `          <tr>\n            <td><span class="layer-badge ${cls}">${l}</span></td>\n            <td>${role}</td>\n            <td>${count(l)}</td>\n            <td>${ex}</td>\n          </tr>`,
  ).join('\n')}\n          `;
}

export function renderSkillsStats(stats) {
  const item = (value, label, color) =>
    `    <div class="stat-item">\n      <span class="stat-value"${color ? ` style="color: var(${color})"` : ''}>${value}</span>\n      <span class="stat-label">${label}</span>\n    </div>`;
  return `\n${[
    item(stats.skillCount, 'Total Skills'),
    item(`${stats.layers.L0}+${stats.layers.L1}`, 'L0 Router + L1 Orchestrators', '--l1-color'),
    item(stats.layers.L2, 'L2 Workflow Hubs', '--l2-color'),
    item(stats.layers.L3, 'L3 Utilities'),
    item(stats.freePacks.length, 'L4 Extension Packs', '--l4-color'),
    item(stats.totalConnections, 'Mesh Connections'),
  ].join('\n')}\n    `;
}

// ─── build ───

export async function buildOutputs(root = ROOT) {
  const r = (rel) => readFileSync(join(root, rel), 'utf8');
  const releases = parseChangelog(r('CHANGELOG.md'));
  const latest = latestReleased(releases);
  const pkg = JSON.parse(r('package.json'));
  const index = JSON.parse(r('skill-index.json'));
  const stats = await collectStats(root);
  const packs = [...stats.freePacks].sort();
  const out = {};

  out['docs/changelog.html'] = renderChangelogPage(releases);
  out['docs/assets/mesh-diagram.html'] = renderMeshDiagram(index, stats, packs);
  out['compiler/data/whats-new.json'] = `${JSON.stringify(whatsNewData(latest), null, 2)}\n`;

  let home = r('docs/index.html');
  home = replaceRegion(home, 'whats-new', renderChip(latest, ''), 'docs/index.html');
  out['docs/index.html'] = home;

  let guide = r('docs/guides/index.html');
  guide = replaceRegion(guide, 'whats-new', renderChip(latest, '../'), 'docs/guides/index.html');
  guide = replaceRegion(guide, 'layer-rows', renderLayerRows(stats), 'docs/guides/index.html');
  out['docs/guides/index.html'] = guide;

  let skills = r('docs/skills/index.html');
  skills = replaceRegion(skills, 'version', `v${pkg.version}`, 'docs/skills/index.html');
  skills = replaceRegion(skills, 'stats', renderSkillsStats(stats), 'docs/skills/index.html');
  out['docs/skills/index.html'] = skills;
  return out;
}

async function main(argv) {
  if (argv[0] === 'notes') {
    const version = argv[1]?.replace(/^v/, '');
    if (!version) throw new Error('Usage: site-gen.mjs notes <X.Y.Z> [--telegram|--plain]');
    const releases = parseChangelog(read('CHANGELOG.md'));
    const idx = releases.findIndex((x) => x.version === version);
    if (idx < 0) {
      console.error(`CHANGELOG.md has no ## [${version}] section`);
      process.exit(3);
    }
    if (argv.includes('--telegram')) process.stdout.write(`${telegramText(releases, version)}\n`);
    else if (argv.includes('--plain'))
      process.stdout.write(
        `${releaseHighlights(releases[idx], 10)
          .map((t) => `• ${plainText(t).replace(/`/g, '')}`)
          .join('\n')}\n`,
      );
    else {
      const previous = releases.slice(idx + 1).find((x) => /^\d+\.\d+\.\d+$/.test(x.version))?.version;
      process.stdout.write(notesMarkdown(releases[idx], { previous }));
    }
    return;
  }
  const check = argv.includes('--check');
  const outputs = await buildOutputs();
  const stale = [];
  for (const [rel, content] of Object.entries(outputs)) {
    const file = join(ROOT, rel);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    stale.push(rel);
    if (!check) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  if (check) {
    if (stale.length) {
      console.error(
        `  ✗ site-gen: stale generated files — run \`node scripts/site-gen.mjs\`:\n${stale.map((s) => `    - ${s}`).join('\n')}`,
      );
      process.exit(1);
    }
    console.log(`  ✓ site-gen: ${Object.keys(outputs).length} generated files up to date`);
  } else {
    console.log(
      stale.length
        ? `  ✓ site-gen wrote:\n${stale.map((s) => `    - ${s}`).join('\n')}`
        : '  ✓ site-gen: nothing to update',
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`  ✗ ${err.message}`);
    process.exit(1);
  });
}
