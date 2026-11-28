/**
 * Real-pointer regression test for the mesh diagram.
 *
 * Why this exists: v1 of the diagram shipped with setPointerCapture on the stage, which retargets
 * pointerup away from the node, so clicking a skill did nothing. Tests that used element.click() or
 * dispatchEvent bypass pointer capture and missed it. This drives real mouse input (CDP
 * Input.dispatchMouseEvent via puppeteer-core) at node coordinates, on the standalone page AND inside
 * the Guide iframe.
 *
 * Needs a local Chrome/Chromium. Skipped when none is found (set RUNE_REQUIRE_BROWSER=1 to make a
 * missing browser a failure; CI does).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const DOCS = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'docs');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
const CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => p && existsSync(p));

let puppeteer = null;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  /* not installed */
}
const skip = !CHROME || !puppeteer;
if (skip && process.env.RUNE_REQUIRE_BROWSER)
  throw new Error('RUNE_REQUIRE_BROWSER set but no Chrome/puppeteer-core found');

describe('mesh diagram: real mouse input', { skip: skip && 'no Chrome/puppeteer-core available' }, () => {
  let server;
  let base;
  let browser;

  before(async () => {
    server = createServer((req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      let file = join(DOCS, path);
      if (existsSync(file) && !extname(file)) file = join(file, 'index.html');
      if (!existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });
  });

  after(async () => {
    await browser?.close();
    await new Promise((r) => server?.close(r));
  });

  const nodeCenter = (frame, name) =>
    frame.evaluate((n) => {
      const r = document.querySelector(`.node[data-n="${n}"] circle`).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, name);

  const state = (frame) =>
    frame.evaluate(() => ({
      selected: document.querySelector('.node.is-selected')?.dataset.n ?? null,
      panelHidden: document.getElementById('mesh-panel').hidden,
      panelTitle: document.querySelector('#mesh-panel h2')?.textContent ?? null,
      edgesOn: document.querySelectorAll('.edge.is-on').length,
      edgesHover: document.querySelectorAll('.edge.is-hover').length,
      edgeOpacities: [...new Set([...document.querySelectorAll('.edge')].map((e) => getComputedStyle(e).opacity))],
      zoom: document.getElementById('zoom-readout').textContent,
    }));

  async function open(url, viewport) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
    return { page, errors };
  }

  // [label, url, how to reach the frame that holds the diagram, offset of that frame in the page]
  const targets = [
    {
      label: 'standalone page',
      url: '/assets/mesh-diagram.html',
      viewport: { width: 1440, height: 900 },
      frame: async (page) => ({ frame: page.mainFrame(), dx: 0, dy: 0 }),
    },
    {
      label: 'Guide iframe',
      url: '/guides/index.html',
      viewport: { width: 1440, height: 900 },
      frame: async (page) => {
        const handle = await page.waitForSelector('.mesh-embed iframe');
        await handle.scrollIntoView();
        const frame = await handle.contentFrame();
        await frame.waitForSelector('#camera');
        await frame.waitForSelector('.node[data-n="cook"]');
        const box = await handle.boundingBox();
        return { frame, dx: box.x, dy: box.y };
      },
    },
  ];

  for (const t of targets) {
    describe(t.label, () => {
      let page;
      let errors;
      let frame;
      let dx;
      let dy;

      before(async () => {
        ({ page, errors } = await open(t.url, t.viewport));
        ({ frame, dx, dy } = await t.frame(page));
        await frame.waitForSelector('.node[data-n="cook"]');
      });
      after(() => page?.close());

      const at = async (name) => {
        const c = await nodeCenter(frame, name);
        return { x: dx + c.x, y: dy + c.y };
      };

      test('loads without script errors', () => {
        assert.deepEqual(errors, []);
      });

      test('edges are quiet by default (no hairball)', async () => {
        const s = await state(frame);
        assert.equal(s.selected, null);
        for (const o of s.edgeOpacities) assert.ok(Number(o) <= 0.1, `default edge opacity ${o} should be <= 0.1`);
      });

      test('hovering a skill lights its edges without selecting it', async () => {
        const p = await at('cook');
        await page.mouse.move(p.x, p.y);
        const s = await state(frame);
        assert.equal(s.selected, null);
        assert.ok(s.edgesHover > 0, 'hovered skill edges should be highlighted');
        await page.mouse.move(2, 2);
        assert.equal((await state(frame)).edgesHover, 0);
      });

      test('a real click on a node selects it and opens the panel', async () => {
        const p = await at('cook');
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.up();
        const s = await state(frame);
        assert.equal(s.selected, 'cook');
        assert.equal(s.panelHidden, false);
        assert.equal(s.panelTitle, 'cook');
        assert.ok(s.edgesOn > 0);
      });

      test('a click with a couple of pixels of jitter still counts as a click', async () => {
        const p = await at('plan');
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.move(p.x + 2, p.y + 1);
        await page.mouse.up();
        assert.equal((await state(frame)).selected, 'plan');
      });

      test('a real drag pans and does not change the selection', async () => {
        const before = await state(frame);
        const camBefore = await frame.evaluate(() => document.getElementById('camera').getAttribute('transform'));
        const p = await at('plan');
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.move(p.x + 60, p.y + 40, { steps: 6 });
        await page.mouse.up();
        const camAfter = await frame.evaluate(() => document.getElementById('camera').getAttribute('transform'));
        assert.notEqual(camAfter, camBefore, 'drag should pan the camera');
        assert.equal((await state(frame)).selected, before.selected);
      });

      test('clicking empty canvas clears the selection', async () => {
        const box = await frame.evaluate(() => {
          const r = document.getElementById('mesh').getBoundingClientRect();
          return { x: r.x + 6, y: r.y + r.height - 6 };
        });
        await page.mouse.click(dx + box.x, dy + box.y);
        const s = await state(frame);
        assert.equal(s.selected, null);
        assert.equal(s.panelHidden, true);
      });

      test('wheel zoom still works', async () => {
        const p = await at('cook');
        await page.mouse.move(p.x, p.y);
        const z0 = (await state(frame)).zoom;
        await page.mouse.wheel({ deltaY: -400 });
        assert.notEqual((await state(frame)).zoom, z0);
      });
    });
  }
});
