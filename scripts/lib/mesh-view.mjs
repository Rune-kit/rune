/**
 * mesh-view.mjs — camera, search and selection helpers for the skill-mesh
 * diagram. Pure functions (safe to unit-test). `boot()` wires them to a
 * generated docs/assets/mesh-diagram.html page. Copied to
 * docs/assets/mesh-view.js by scripts/site-gen.mjs — edit this file, not the copy.
 */

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 12;
/** Zoom at or above this shows every label (horizontal, SVG text — stays crisp). */
export const LABEL_ZOOM = 2.5;
export const BUTTON_ZOOM = 1.4;
export const DBL_ZOOM = 2;
export const SEARCH_ZOOM = 2.2;

export const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function fitCamera() {
  return { k: 1, x: 0, y: 0 };
}

/** Zoom so the SVG-space point (fx, fy) stays where it is on screen. */
export function zoomAt(cam, fx, fy, factor) {
  const k = clampZoom(cam.k * factor);
  const r = k / cam.k;
  return { k, x: fx - (fx - cam.x) * r, y: fy - (fy - cam.y) * r };
}

export function panBy(cam, dx, dy) {
  return { k: cam.k, x: cam.x + dx, y: cam.y + dy };
}

/** Put a node at the view origin (the centre of the viewBox). */
export function centerOn(node, k = SEARCH_ZOOM) {
  const z = clampZoom(k);
  return { k: z, x: -node.x * z, y: -node.y * z };
}

export const transformAttr = (cam) => `translate(${cam.x} ${cam.y}) scale(${cam.k})`;

export function rankSearch(names, query) {
  const raw = String(query).trim().toLowerCase();
  if (!raw) return [];
  const packOnly = raw.startsWith('@');
  const q = raw.replace(/^@rune\//, '').replace(/^@/, '');
  if (!q) return names.filter((n) => !packOnly || n.startsWith('@')).sort();
  const scored = [];
  for (const name of names) {
    const hay = name.toLowerCase();
    const bare = hay.replace(/^@rune\//, '');
    if (packOnly && !hay.startsWith('@')) continue;
    const tokens = bare.split(/[-/]/);
    let score = Number.POSITIVE_INFINITY;
    if (hay === raw || bare === q) score = 0;
    else if (bare.startsWith(q) || hay.startsWith(raw)) score = 1;
    else if (tokens.some((tok) => tok.startsWith(q))) score = 2;
    if (score < Number.POSITIVE_INFINITY) scored.push({ name, score, bare });
  }
  scored.sort((a, b) => a.score - b.score || a.bare.length - b.bare.length || a.bare.localeCompare(b.bare));
  return scored.map((s) => s.name);
}

export function neighbors(name, edges) {
  const calls = [];
  const calledBy = [];
  for (const [f, t] of edges) {
    if (f === name) calls.push(t);
    if (t === name) calledBy.push(f);
  }
  return { calls, calledBy, near: new Set([name, ...calls, ...calledBy]) };
}

export function panelFor(name, catalog, edges) {
  const node = catalog[name];
  if (!node) return null;
  const { calls, calledBy, near } = neighbors(name, edges);
  return {
    name,
    layer: node.layer,
    group: node.group || '',
    description: node.description || '',
    calls,
    calledBy,
    emit: node.emit || [],
    listen: node.listen || [],
    near,
    x: node.x,
    y: node.y,
  };
}

/**
 * How an edge is drawn. Edges are quiet ('base') until a skill is hovered or selected:
 * 200 lines at full strength is a hairball, not a map.
 */
export function edgeState(edge, selected, hover) {
  const [f, t] = edge;
  if (selected && (f === selected || t === selected)) return 'on';
  if (hover && (f === hover || t === hover)) return 'hover';
  return selected ? 'dim' : 'base';
}

/**
 * What a finished press means. The node is read at pointerdown: with pointer capture the
 * pointerup target is retargeted to the capturing element, so it cannot tell us what was clicked.
 */
export function resolveTap({ downNode, moved, onChrome = false }) {
  if (moved || onChrome) return { type: 'none' };
  return downNode ? { type: 'select', name: downNode } : { type: 'clear' };
}

/** 'hubs' = L0/L1 only; 'related' = selection + neighbours; 'all' = every visible node. */
export function labelMode(cam, selected) {
  if (cam.k >= LABEL_ZOOM) return 'all';
  if (selected) return 'related';
  return 'hubs';
}

export function shouldShowLabel(mode, layer, name, near) {
  if (mode === 'all') return true;
  if (mode === 'related') return near?.has(name) === true;
  return layer === 'L0' || layer === 'L1';
}

// ─── DOM boot (no-op in node tests that only import the pure API) ───

const escapeText = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function chipList(names, empty) {
  if (!names.length) return `<p class="empty">${empty}</p>`;
  return `<div class="chips">${names.map((n) => `<button type="button" class="chip" data-go="${escapeText(n)}">${escapeText(n)}</button>`).join('')}</div>`;
}

export function boot(doc, data) {
  const svg = doc.getElementById('mesh');
  const cameraEl = doc.getElementById('camera');
  const search = doc.getElementById('mesh-search');
  const suggest = doc.getElementById('mesh-suggest');
  const panel = doc.getElementById('mesh-panel');
  const stage = doc.getElementById('mesh-stage');
  if (!svg || !cameraEl) return;

  const catalog = data.nodes;
  const edges = data.edges;
  const names = Object.keys(catalog);
  let cam = fitCamera();
  let selected = null;
  const hiddenLayers = new Set();
  let hover = null;
  let dragging = null;
  let moved = false;

  const clientToSvg = (clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const applyCam = () => {
    cameraEl.setAttribute('transform', transformAttr(cam));
    doc.getElementById('zoom-readout').textContent = `${Math.round(cam.k * 100)}%`;
    paint();
  };

  const paint = () => {
    const focusName = selected || hover;
    const mode = labelMode(cam, focusName);
    const near = focusName ? neighbors(focusName, edges).near : null;
    for (const el of svg.querySelectorAll('.node')) {
      const n = el.dataset.n;
      const node = catalog[n];
      const hidden = hiddenLayers.has(node?.layer);
      el.toggleAttribute('hidden', hidden);
      el.classList.toggle('is-selected', n === selected);
      el.classList.toggle('is-near', Boolean(!hidden && near?.has(n)));
      el.classList.toggle('is-dim', Boolean(focusName && !hidden && !near?.has(n)));
      const label = el.querySelector('.lbl');
      if (label) label.toggleAttribute('hidden', hidden || !shouldShowLabel(mode, node?.layer, n, near));
    }
    for (const el of svg.querySelectorAll('.edge')) {
      const hidden = hiddenLayers.has(catalog[el.dataset.f]?.layer) || hiddenLayers.has(catalog[el.dataset.t]?.layer);
      const state = edgeState([el.dataset.f, el.dataset.t], selected, hover);
      el.toggleAttribute('hidden', hidden);
      el.classList.toggle('is-on', !hidden && state === 'on');
      el.classList.toggle('is-hover', !hidden && state === 'hover');
      el.classList.toggle('is-dim', !hidden && state === 'dim');
    }
    svg.classList.toggle('is-focused', Boolean(selected));
  };

  const renderPanel = () => {
    if (!panel) return;
    const info = selected ? panelFor(selected, catalog, edges) : null;
    panel.hidden = !info;
    doc.body.classList.toggle('has-panel', Boolean(info));
    if (!info) {
      panel.innerHTML = '';
      return;
    }
    const layer = `${info.layer}${info.group ? ` · ${info.group}` : ''}`;
    const signals =
      info.emit.length || info.listen.length
        ? `<div class="signals">
            ${info.emit.length ? `<p><span>emits</span> ${info.emit.map((s) => `<code>${escapeText(s)}</code>`).join(' ')}</p>` : ''}
            ${info.listen.length ? `<p><span>listens</span> ${info.listen.map((s) => `<code>${escapeText(s)}</code>`).join(' ')}</p>` : ''}
          </div>`
        : '';
    panel.innerHTML = `
      <button type="button" class="panel-close" data-close aria-label="Close panel">×</button>
      <p class="panel-layer">${escapeText(layer)}</p>
      <h2>${escapeText(info.name)}</h2>
      ${info.description ? `<p class="panel-desc">${escapeText(info.description)}</p>` : ''}
      <h3>Calls →</h3>
      ${chipList(info.calls, 'Does not call another skill.')}
      <h3>← Called by</h3>
      ${chipList(info.calledBy, 'Not called by another skill.')}
      ${signals}`;
  };

  const select = (name, { fly = false } = {}) => {
    if (name && !catalog[name]) return;
    selected = name || null;
    if (name && fly) cam = centerOn(catalog[name], Math.max(cam.k, SEARCH_ZOOM));
    if (name) {
      const hash = `#${encodeURIComponent(name)}`;
      if (doc.defaultView?.history?.replaceState && doc.defaultView.location.hash !== hash) {
        try {
          doc.defaultView.history.replaceState(null, '', hash);
        } catch {
          /* file: or sandboxed */
        }
      }
    }
    renderPanel();
    applyCam();
    const nodeEl = name && svg.querySelector(`.node[data-n="${CSS.escape(name)}"]`);
    nodeEl?.focus({ preventScroll: true });
  };

  const setHidden = (layer, hide) => {
    if (hide) hiddenLayers.add(layer);
    else hiddenLayers.delete(layer);
    if (selected && hiddenLayers.has(catalog[selected]?.layer)) select(null);
    else paint();
  };

  // Buttons
  doc.getElementById('zoom-in')?.addEventListener('click', () => {
    cam = zoomAt(cam, 0, 0, BUTTON_ZOOM);
    applyCam();
  });
  doc.getElementById('zoom-out')?.addEventListener('click', () => {
    cam = zoomAt(cam, 0, 0, 1 / BUTTON_ZOOM);
    applyCam();
  });
  doc.getElementById('zoom-fit')?.addEventListener('click', () => {
    cam = fitCamera();
    applyCam();
  });
  panel?.addEventListener('click', (ev) => {
    const go = ev.target.closest?.('[data-go]')?.dataset.go;
    if (go) {
      ev.preventDefault();
      select(go, { fly: true });
      return;
    }
    if (ev.target.closest?.('[data-close]')) select(null);
  });

  // Wheel / trackpad pinch (browsers fire wheel+ctrlKey for pinch)
  svg.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const p = clientToSvg(ev.clientX, ev.clientY);
      const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0025));
      cam = zoomAt(cam, p.x, p.y, factor);
      applyCam();
    },
    { passive: false },
  );

  // No setPointerCapture: it retargets pointerup/click to the stage, which swallowed every node click.
  // The pointermove/up listeners live on the document, so a drag that leaves the SVG still works.
  const onPointerDown = (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const onChrome = Boolean(ev.target.closest('button, input, a, .mesh-chrome, #mesh-panel'));
    dragging = {
      id: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
      node: onChrome ? null : ev.target.closest('.node')?.dataset.n || null,
      onChrome,
    };
    moved = false;
  };
  const onPointerMove = (ev) => {
    if (!dragging || ev.pointerId !== dragging.id || dragging.onChrome) return;
    const dx = ev.clientX - dragging.x;
    const dy = ev.clientY - dragging.y;
    if (!moved && dx * dx + dy * dy < 25) return;
    moved = true;
    hover = null;
    const a = clientToSvg(dragging.x, dragging.y);
    const b = clientToSvg(ev.clientX, ev.clientY);
    cam = panBy(cam, b.x - a.x, b.y - a.y);
    dragging.x = ev.clientX;
    dragging.y = ev.clientY;
    applyCam();
  };
  const onPointerUp = (ev) => {
    if (!dragging || ev.pointerId !== dragging.id) return;
    const tap = resolveTap({ downNode: dragging.node, moved, onChrome: dragging.onChrome });
    dragging = null;
    if (ev.type === 'pointercancel') return;
    if (tap.type === 'select') select(tap.name);
    else if (tap.type === 'clear') select(null);
  };
  (stage || svg).addEventListener('pointerdown', onPointerDown);
  doc.addEventListener('pointermove', onPointerMove);
  doc.addEventListener('pointerup', onPointerUp);
  doc.addEventListener('pointercancel', onPointerUp);

  // Hover preview (mouse only): lights a skill's edges without touching the selection or the panel.
  svg.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse' || dragging) return;
    const n = ev.target.closest?.('.node')?.dataset.n || null;
    if (n !== hover) {
      hover = n;
      paint();
    }
  });
  svg.addEventListener('pointerleave', () => {
    if (hover) {
      hover = null;
      paint();
    }
  });

  // Pinch (two pointers)
  const pins = new Map();
  svg.addEventListener('pointerdown', (ev) => {
    pins.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!pins.has(ev.pointerId) || pins.size !== 2) return;
    ev.preventDefault();
    const before = [...pins.values()];
    pins.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const after = [...pins.values()];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const m = mid(after[0], after[1]);
    const p = clientToSvg(m.x, m.y);
    cam = zoomAt(cam, p.x, p.y, dist(after[0], after[1]) / dist(before[0], before[1]));
    applyCam();
    dragging = null;
    moved = true;
  });
  const endPin = (ev) => pins.delete(ev.pointerId);
  svg.addEventListener('pointerup', endPin);
  svg.addEventListener('pointercancel', endPin);

  svg.addEventListener('dblclick', (ev) => {
    ev.preventDefault();
    const p = clientToSvg(ev.clientX, ev.clientY);
    cam = zoomAt(cam, p.x, p.y, DBL_ZOOM);
    const node = ev.target.closest?.('.node');
    if (node) select(node.dataset.n);
    applyCam();
  });

  // Keyboard (ignore when typing in the search box, except Escape)
  doc.addEventListener('keydown', (ev) => {
    const typing = ev.target === search || ev.target.closest?.('input, textarea');
    if (ev.key === 'Escape') {
      if (suggest && !suggest.hidden) {
        suggest.hidden = true;
        return;
      }
      if (selected) {
        select(null);
        ev.preventDefault();
      }
      return;
    }
    if (ev.key === '/' && !typing) {
      ev.preventDefault();
      search?.focus();
      search?.select();
      return;
    }
    if (typing) return;
    if (ev.key === '+' || ev.key === '=') {
      cam = zoomAt(cam, 0, 0, BUTTON_ZOOM);
      applyCam();
      ev.preventDefault();
    } else if (ev.key === '-' || ev.key === '_') {
      cam = zoomAt(cam, 0, 0, 1 / BUTTON_ZOOM);
      applyCam();
      ev.preventDefault();
    } else if (ev.key === '0') {
      cam = fitCamera();
      applyCam();
      ev.preventDefault();
    }
  });

  const renderSuggest = (q) => {
    if (!suggest) return;
    const hits = rankSearch(names, q).slice(0, 8);
    suggest.hidden = !hits.length;
    suggest.innerHTML = hits
      .map(
        (n, i) =>
          `<button type="button" role="option" class="suggest" data-go="${escapeText(n)}" ${i === 0 ? 'data-first' : ''}>${escapeText(n)} <span>${escapeText(catalog[n].layer)}</span></button>`,
      )
      .join('');
  };
  search?.addEventListener('input', () => renderSuggest(search.value));
  search?.addEventListener('focus', () => renderSuggest(search.value));
  search?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const first = rankSearch(names, search.value)[0];
      if (first) {
        select(first, { fly: true });
        suggest && (suggest.hidden = true);
        search.blur();
      }
    }
  });
  suggest?.addEventListener('mousedown', (ev) => ev.preventDefault()); // keep input focus until click
  suggest?.addEventListener('click', (ev) => {
    const go = ev.target.closest?.('[data-go]')?.dataset.go;
    if (go) {
      select(go, { fly: true });
      suggest.hidden = true;
      if (search) search.value = go;
    }
  });
  doc.addEventListener('click', (ev) => {
    if (suggest && !ev.target.closest?.('.search-wrap')) suggest.hidden = true;
  });

  for (const btn of doc.querySelectorAll('[data-layer]')) {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      const hide = !btn.hasAttribute('data-off');
      btn.toggleAttribute('data-off', hide);
      btn.setAttribute('aria-pressed', String(!hide));
      setHidden(layer, hide);
    });
  }

  // Theme: ?theme=, shared localStorage, or a storage event from the parent page
  const applyTheme = (theme) => {
    const next = theme === 'light' ? 'light' : 'dark';
    doc.documentElement.setAttribute('data-theme', next);
  };
  const readTheme = () => {
    try {
      const q = new URLSearchParams(doc.defaultView.location.search).get('theme');
      if (q) return q;
      return doc.defaultView.localStorage?.getItem('rune-theme');
    } catch {
      return null;
    }
  };
  applyTheme(readTheme());
  doc.defaultView?.addEventListener('storage', (ev) => {
    if (ev.key === 'rune-theme') applyTheme(ev.newValue);
  });

  // Fullscreen link: in an iframe it must leave the frame
  const full = doc.getElementById('mesh-full');
  if (full) {
    try {
      if (doc.defaultView.self !== doc.defaultView.top) full.hidden = false;
      else full.dataset.standalone = '1';
    } catch {
      full.hidden = false; // cross-origin iframe
    }
  }

  const start = decodeURIComponent((doc.defaultView?.location.hash || '').replace(/^#/, ''));
  const qSkill = new URLSearchParams(doc.defaultView?.location.search || '').get('skill');
  if (catalog[qSkill]) select(qSkill, { fly: true });
  else if (catalog[start]) select(start, { fly: true });
  else applyCam();

  return { getCamera: () => cam, select, applyCam };
}
