import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  centerOn,
  clampZoom,
  fitCamera,
  LABEL_ZOOM,
  labelMode,
  MAX_ZOOM,
  MIN_ZOOM,
  neighbors,
  panBy,
  panelFor,
  rankSearch,
  transformAttr,
  zoomAt,
} from '../lib/mesh-view.mjs';

describe('camera', () => {
  test('clampZoom stays inside the allowed range', () => {
    assert.strictEqual(clampZoom(0), MIN_ZOOM);
    assert.strictEqual(clampZoom(99), MAX_ZOOM);
    assert.strictEqual(clampZoom(2), 2);
  });

  test('zoomAt keeps the focal point fixed in view space', () => {
    const cam = { k: 1, x: 0, y: 0 };
    const next = zoomAt(cam, 100, 50, 2);
    assert.strictEqual(next.k, 2);
    // view = k * world + t, so world = (view - t) / k
    const worldX = (100 - cam.x) / cam.k;
    const worldY = (50 - cam.y) / cam.k;
    assert.strictEqual(next.x + worldX * next.k, 100);
    assert.strictEqual(next.y + worldY * next.k, 50);
  });

  test('zoomAt at the view origin is what the +/− buttons use', () => {
    const cam = { k: 2, x: -40, y: 10 };
    const next = zoomAt(cam, 0, 0, 0.5);
    assert.strictEqual(next.k, 1);
    assert.strictEqual(next.x, -20);
    assert.strictEqual(next.y, 5);
  });

  test('zoomAt will not pass the ceiling or the floor', () => {
    assert.strictEqual(zoomAt({ k: MAX_ZOOM, x: 0, y: 0 }, 0, 0, 2).k, MAX_ZOOM);
    assert.strictEqual(zoomAt({ k: MIN_ZOOM, x: 0, y: 0 }, 0, 0, 0.1).k, MIN_ZOOM);
  });

  test('panBy shifts the translation only', () => {
    assert.deepStrictEqual(panBy({ k: 3, x: 1, y: 2 }, 10, -4), { k: 3, x: 11, y: -2 });
  });

  test('centerOn puts a node at the view origin at the requested zoom', () => {
    const cam = centerOn({ x: 20, y: -10 }, 4);
    assert.strictEqual(cam.k, 4);
    assert.strictEqual(cam.x + 20 * 4, 0);
    assert.strictEqual(cam.y + -10 * 4, 0);
    assert.strictEqual(transformAttr(cam), 'translate(-80 40) scale(4)');
  });

  test('fitCamera is identity and centerOn clamps the zoom', () => {
    assert.deepStrictEqual(fitCamera(), { k: 1, x: 0, y: 0 });
    assert.strictEqual(centerOn({ x: 0, y: 0 }, 99).k, MAX_ZOOM);
  });
});

describe('search', () => {
  const names = ['cook', 'council', 'context-pack', '@rune/content', 'scout'];
  test('ranks exact, then prefix, then substring; @rune/ is optional', () => {
    assert.deepStrictEqual(rankSearch(names, 'cook'), ['cook']);
    assert.deepStrictEqual(rankSearch(names, 'co'), ['cook', '@rune/content', 'council', 'context-pack']);
    assert.deepStrictEqual(rankSearch(names, 'content'), ['@rune/content']);
    assert.deepStrictEqual(rankSearch(names, 'pack'), ['context-pack']);
    assert.deepStrictEqual(rankSearch(names, '@rune/co'), ['@rune/content']);
  });
  test('empty or whitespace yields nothing; case does not matter', () => {
    assert.deepStrictEqual(rankSearch(names, '  '), []);
    assert.deepStrictEqual(rankSearch(names, 'COOK'), ['cook']);
  });
});

describe('selection graph', () => {
  const edges = [
    ['cook', 'plan'],
    ['cook', 'scout'],
    ['skill-router', 'cook'],
    ['plan', 'adversary'],
  ];
  test('neighbors splits outgoing and incoming, and builds the highlight set', () => {
    const n = neighbors('cook', edges);
    assert.deepStrictEqual(n.calls, ['plan', 'scout']);
    assert.deepStrictEqual(n.calledBy, ['skill-router']);
    assert.deepStrictEqual([...n.near].sort(), ['cook', 'plan', 'scout', 'skill-router']);
  });
  test('panelFor carries layer, description and signals', () => {
    const catalog = {
      cook: {
        layer: 'L1',
        group: 'orchestrator',
        description: 'Build a feature',
        emit: ['phase.complete'],
        listen: ['plan.ready'],
        x: 0,
        y: 0,
      },
    };
    const panel = panelFor('cook', catalog, edges);
    assert.strictEqual(panel.name, 'cook');
    assert.strictEqual(panel.layer, 'L1');
    assert.strictEqual(panel.description, 'Build a feature');
    assert.deepStrictEqual(panel.calls, ['plan', 'scout']);
    assert.deepStrictEqual(panel.calledBy, ['skill-router']);
    assert.deepStrictEqual(panel.emit, ['phase.complete']);
    assert.deepStrictEqual(panel.listen, ['plan.ready']);
  });
  test('panelFor is null for an unknown name', () => {
    assert.strictEqual(panelFor('nope', {}, edges), null);
  });
});

describe('label mode', () => {
  test('hubs only at the default fit zoom; all labels past the threshold; related when a skill is selected', () => {
    assert.strictEqual(labelMode({ k: 1 }), 'hubs');
    assert.strictEqual(labelMode({ k: LABEL_ZOOM }), 'all');
    assert.strictEqual(labelMode({ k: 2 }, 'cook'), 'related');
    assert.strictEqual(labelMode({ k: LABEL_ZOOM + 1 }, 'cook'), 'all');
  });
});
