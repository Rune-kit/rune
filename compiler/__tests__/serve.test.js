import assert from 'node:assert';
import { statSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { platform as osPlatform, tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ensureKey, extractKey, hashKey, readServeConfig, rotateKey, verifyKey } from '../serve/auth.js';
import { createCatalog, normalizeSkillName, resolveInside } from '../serve/catalog.js';
import { createRateLimiter } from '../serve/http.js';
import { resolveServeRoots, startServe } from '../serve/index.js';

const RUNE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function seedSkill(root, name, { body = 'Do the thing.', fm = '', refs = {} } = {}) {
  const dir = path.join(root, 'skills', name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: "${name} skill for tests"\n${fm}metadata:\n  layer: L1\n---\n\n# ${name}\n\n${body}\n`,
  );
  for (const [rel, content] of Object.entries(refs)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), content);
  }
  return dir;
}

async function seedPack(root, name, subs = []) {
  const dir = path.join(root, 'extensions', name);
  await mkdir(path.join(dir, 'skills'), { recursive: true });
  await writeFile(
    path.join(dir, 'PACK.md'),
    `---\nname: "@rune-pro/${name.replace(/^pro-/, '')}"\ndescription: "${name} pack"\nmetadata:\n  format: split\n---\n\n# ${name}\n`,
  );
  for (const s of subs) {
    await writeFile(path.join(dir, 'skills', `${s}.md`), `# ${s}\n`);
    await writeFile(path.join(dir, 'skills', `${s}-evals.md`), `# evals\n`);
  }
  return dir;
}

describe('serve: name normalisation', () => {
  test('accepts the ways people and agents type a skill', () => {
    for (const raw of ['cook', 'rune:cook', '/rune cook', '/rune-cook', 'Cook', '  rune cook add login ']) {
      assert.strictEqual(normalizeSkillName(raw).replace(/^rune-/, ''), 'cook', raw);
    }
    assert.strictEqual(normalizeSkillName('@rune/backend'), 'backend');
    assert.strictEqual(normalizeSkillName('@rune-pro/media'), 'pro-media');
  });
});

describe('serve: catalog', () => {
  let tmp;
  let catalog;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-serve-cat-'));
    await seedSkill(path.join(tmp, 'free'), 'cook', { refs: { 'references/a.md': 'AAA', 'references/img.png': 'x' } });
    await seedSkill(path.join(tmp, 'free'), 'video-creator');
    await seedSkill(path.join(tmp, 'free'), 'deploy', { fm: 'disable-model-invocation: true\n' });
    await seedSkill(path.join(tmp, 'free'), 'skill-router', { fm: 'user-invocable: false\n' });
    await seedSkill(path.join(tmp, 'pro'), 'autopilot');
    await seedSkill(path.join(tmp, 'pro'), 'cook'); // collides with free → pro-cook
    await seedPack(path.join(tmp, 'pro'), 'pro-media', ['image-generator']);
    await writeFile(path.join(tmp, 'secret.txt'), 'TOP SECRET');
    catalog = createCatalog({
      roots: [
        { root: path.join(tmp, 'free'), tier: 'free' },
        { root: path.join(tmp, 'pro'), tier: 'pro' },
      ],
      maxBytes: 2048,
    });
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  test('discovers skills and packs across tiers, prefixing collisions', () => {
    const ids = catalog
      .all()
      .map((e) => e.id)
      .sort();
    assert.deepStrictEqual(ids, [
      'autopilot',
      'cook',
      'deploy',
      'pro-cook',
      'pro-media',
      'skill-router',
      'video-creator',
    ]);
    assert.deepStrictEqual(catalog.counts(), { free: 4, pro: 3 });
    assert.strictEqual(catalog.find('cook').tier, 'free');
    assert.strictEqual(catalog.find('pro-cook').tier, 'pro');
  });

  test('reads invocation flags from frontmatter', () => {
    assert.strictEqual(catalog.find('deploy').modelInvocable, false);
    assert.strictEqual(catalog.find('skill-router').userInvocable, false);
    assert.strictEqual(catalog.find('cook').userInvocable, true);
  });

  test('resolves pack sub-skills and unique partial names', () => {
    const img = catalog.find('image-generator');
    assert.strictEqual(img.id, 'pro-media');
    assert.strictEqual(img.focus, 'skills/image-generator.md');
    assert.strictEqual(catalog.find('@rune-pro/media').id, 'pro-media');
    assert.strictEqual(catalog.find('video').id, 'video-creator');
    assert.strictEqual(catalog.find('nope'), null);
    assert.ok(catalog.suggest('cok').includes('cook'));
  });

  test('lists only text references, excluding the main file', () => {
    assert.deepStrictEqual(catalog.references(catalog.find('cook')), ['references/a.md']);
    const media = catalog.references(catalog.find('pro-media'));
    assert.ok(media.includes('skills/image-generator.md'));
    assert.ok(!media.includes('PACK.md'));
  });

  test('search matches description, tier and sub-skill aliases', () => {
    assert.deepStrictEqual(
      catalog.search({ tier: 'pro' }).map((e) => e.id),
      ['autopilot', 'pro-cook', 'pro-media'],
    );
    assert.deepStrictEqual(
      catalog.search({ filter: 'image' }).map((e) => e.id),
      ['pro-media'],
    );
  });

  test('blocks traversal, absolute paths and non-text files', () => {
    const cook = catalog.find('cook');
    assert.strictEqual(catalog.readReference(cook, 'references/a.md').text, 'AAA');
    for (const bad of ['../../secret.txt', '/etc/passwd', 'references/../../../secret.txt', 'C:/x', 'a\0b', '']) {
      assert.throws(() => catalog.readReference(cook, bad), undefined, bad);
    }
    assert.throws(() => catalog.readReference(cook, 'references/img.png'), /text files/);
  });

  test('blocks symlinks that escape the skill folder', { skip: osPlatform() === 'win32' }, async () => {
    const cook = catalog.find('cook');
    await symlink(path.join(tmp, 'secret.txt'), path.join(cook.dir, 'references', 'leak.md'));
    assert.throws(() => resolveInside(cook.dir, 'references/leak.md'), /escapes/);
  });

  test('caps file reads at maxBytes', async () => {
    await seedSkill(path.join(tmp, 'free'), 'big', { body: 'x'.repeat(5000) });
    catalog.rebuild();
    const out = catalog.readMain(catalog.find('big'));
    assert.strictEqual(out.truncated, true);
    assert.strictEqual(Buffer.byteLength(out.text), 2048);
  });
});

describe('serve: keys', () => {
  let tmp;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-serve-key-'));
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  test('first run creates a key, stores only its hash with 0600', () => {
    const cfg = path.join(tmp, 'nested', 'serve.json');
    const first = ensureKey(cfg);
    assert.strictEqual(first.created, true);
    assert.match(first.key, /^rune_sk_[A-Za-z0-9_-]{40,}$/);
    const stored = readServeConfig(cfg);
    assert.strictEqual(stored.keyHash, hashKey(first.key));
    assert.ok(!JSON.stringify(stored).includes(first.key));
    if (osPlatform() !== 'win32') assert.strictEqual(statSync(cfg).mode & 0o777, 0o600);
    const second = ensureKey(cfg);
    assert.strictEqual(second.created, false);
    assert.strictEqual(second.keyHash, first.keyHash);
  });

  test('rotate invalidates the old key', () => {
    const cfg = path.join(tmp, 'rot.json');
    const { key: oldKey } = rotateKey(cfg);
    const { key: newKey } = rotateKey(cfg);
    const { keyHash } = ensureKey(cfg);
    assert.strictEqual(verifyKey(newKey, keyHash), true);
    assert.strictEqual(verifyKey(oldKey, keyHash), false);
    assert.strictEqual(verifyKey('', keyHash), false);
    assert.strictEqual(verifyKey(undefined, keyHash), false);
  });

  test('extractKey: bearer, x-rune-key, query only when allowed', () => {
    assert.strictEqual(extractKey({ headers: { authorization: 'Bearer abc' }, url: '/mcp' }), 'abc');
    assert.strictEqual(extractKey({ headers: { 'x-rune-key': 'def' }, url: '/mcp' }), 'def');
    assert.strictEqual(extractKey({ headers: {}, url: '/mcp?key=q' }), null);
    assert.strictEqual(extractKey({ headers: {}, url: '/mcp?key=q' }, { allowQueryKey: true }), 'q');
  });
});

describe('serve: rate limiter', () => {
  test('allows `limit` hits per window then refuses', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    assert.ok(rl.hit('a').ok);
    assert.ok(rl.hit('a').ok);
    assert.ok(!rl.hit('a').ok);
    assert.ok(rl.hit('b').ok);
    t = 1000;
    assert.ok(rl.hit('a').ok);
  });
});

describe('serve: roots', () => {
  test('free root always, detected tiers, explicit roots win, --no-tiers skips', () => {
    const detect = () => ({ pro: { path: '/opt/pro/hooks/manifest.json', source: 'env' }, business: null });
    const r = resolveServeRoots({ runeRoot: '/rune', projectRoot: '/p', args: {}, detect });
    assert.deepStrictEqual(
      r.map((x) => [x.tier, x.root]),
      [
        ['free', '/rune'],
        ['pro', path.resolve('/opt/pro')],
      ],
    );
    const r2 = resolveServeRoots({
      runeRoot: '/rune',
      projectRoot: '/p',
      args: { 'business-root': '/b', 'skills-dir': 'x,y' },
      detect,
    });
    assert.deepStrictEqual(
      r2.map((x) => x.tier),
      ['free', 'pro', 'business', 'custom', 'custom'],
    );
    const r3 = resolveServeRoots({ runeRoot: '/rune', projectRoot: '/p', args: { 'no-tiers': true }, detect });
    assert.strictEqual(r3.length, 1);
  });
});

describe('serve: end-to-end over Streamable HTTP', () => {
  let tmp;
  let running;
  let client;
  const silent = () => {};

  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-serve-e2e-'));
    await seedSkill(path.join(tmp, 'pro'), 'autopilot', { refs: { 'references/loop.md': 'LOOP' } });
    await seedPack(path.join(tmp, 'pro'), 'pro-media', ['image-generator']);
    running = await startServe({
      runeRoot: RUNE_ROOT,
      projectRoot: tmp,
      args: { port: '0', config: path.join(tmp, 'serve.json'), 'pro-root': path.join(tmp, 'pro'), 'rate-limit': '500' },
      version: '9.9.9',
      out: silent,
      detect: () => ({}),
    });
    client = new Client({ name: 'rune-test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(running.url), {
        requestInit: { headers: { Authorization: `Bearer ${running.key}` } },
      }),
    );
  });

  after(async () => {
    await client?.close();
    await running?.close();
    await rm(tmp, { recursive: true, force: true });
  });

  test('health is public and leaks no skill data', async () => {
    const res = await fetch(running.url.replace('/mcp', '/health'));
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.version, '9.9.9');
    assert.ok(body.skills > 60);
    assert.deepStrictEqual(Object.keys(body).sort(), ['name', 'ok', 'skills', 'version']);
  });

  test('rejects missing / wrong keys with 401', async () => {
    const init = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    for (const headers of [{}, { authorization: 'Bearer nope' }]) {
      const res = await fetch(running.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify(init),
      });
      assert.strictEqual(res.status, 401);
    }
  });

  test('rejects oversized bodies with 413', async () => {
    const res = await fetch(running.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${running.key}`,
      },
      body: JSON.stringify({ pad: 'x'.repeat(1.2 * 1024 * 1024) }),
    });
    assert.strictEqual(res.status, 413);
  });

  test('advertises Rune in server instructions', () => {
    const instr = client.getInstructions();
    assert.match(instr, /Rune skill server/);
    assert.match(instr, /run_skill/);
    assert.match(instr, /not on the local machine/);
  });

  test('exposes the four tools', async () => {
    const { tools } = await client.listTools();
    assert.deepStrictEqual(tools.map((t) => t.name).sort(), ['get_reference', 'get_skill', 'list_skills', 'run_skill']);
    const run = tools.find((t) => t.name === 'run_skill');
    assert.ok(!('mode' in run.inputSchema.properties), 'no execute mode without --runner');
  });

  test('list_skills spans Free and Pro', async () => {
    const res = await client.callTool({ name: 'list_skills', arguments: { tier: 'pro' } });
    const text = res.content[0].text;
    assert.match(text, /autopilot \[pro/);
    assert.match(text, /pro-media \[pro, pack\].*includes: image-generator/);
    const all = await client.callTool({ name: 'list_skills', arguments: { filter: 'video' } });
    assert.match(all.content[0].text, /video-creator \[free/);
  });

  test('list_skills without filter is compact (names only); detail "full" restores descriptions', async () => {
    const compact = (await client.callTool({ name: 'list_skills', arguments: {} })).content[0].text;
    assert.match(compact, /names only/);
    assert.match(compact, /free skills: .*\bcook\b/);
    assert.match(compact, /pro packs: .*pro-media \([^)]*image-generator/);
    assert.doesNotMatch(compact, / — /, 'no descriptions');
    const full = (await client.callTool({ name: 'list_skills', arguments: { detail: 'full' } })).content[0].text;
    assert.match(full, /- cook \[free, L1\] — /);
    assert.ok(compact.length * 3 < full.length, `compact ${compact.length} vs full ${full.length}`);
    const narrowed = (await client.callTool({ name: 'list_skills', arguments: { filter: 'video', detail: 'compact' } }))
      .content[0].text;
    assert.match(narrowed, /names only/);
  });

  test('get_skill returns SKILL.md and references', async () => {
    const res = await client.callTool({ name: 'get_skill', arguments: { name: 'rune:autopilot' } });
    const text = res.content[0].text;
    assert.match(text, /tier: pro/);
    assert.match(text, /# autopilot/);
    assert.match(text, /- references\/loop\.md/);
  });

  test('get_reference reads inside the skill and refuses traversal', async () => {
    const ok = await client.callTool({
      name: 'get_reference',
      arguments: { skill: 'autopilot', path: 'references/loop.md' },
    });
    assert.strictEqual(ok.content[0].text, 'LOOP');
    const bad = await client.callTool({
      name: 'get_reference',
      arguments: { skill: 'autopilot', path: '../../serve.json' },
    });
    assert.strictEqual(bad.isError, true);
    assert.doesNotMatch(bad.content[0].text, /keyHash/);
  });

  test('run_skill frames the skill + input for the calling agent', async () => {
    const res = await client.callTool({
      name: 'run_skill',
      arguments: { name: '/rune video', input: 'a 30s teaser for Rune' },
    });
    const text = res.content[0].text;
    assert.match(text, /# Rune skill: video-creator \(free\)/);
    assert.match(text, /## User input\n\na 30s teaser for Rune/);
    assert.match(text, /get_reference/);
    assert.match(text, /name: video-creator/);
  });

  test('run_skill warns on user-invoked-only skills and resolves pack sub-skills', async () => {
    const launch = await client.callTool({ name: 'run_skill', arguments: { name: 'launch' } });
    assert.match(launch.content[0].text, /USER-INVOKED ONLY/);
    const img = await client.callTool({ name: 'run_skill', arguments: { name: 'image-generator', input: 'hero' } });
    assert.match(img.content[0].text, /get_reference\("pro-media", "skills\/image-generator\.md"\)/);
  });

  test('unknown skills return an error with suggestions', async () => {
    const res = await client.callTool({ name: 'run_skill', arguments: { name: 'cok' } });
    assert.strictEqual(res.isError, true);
    assert.match(res.content[0].text, /Did you mean: .*cook/);
  });

  test('prompts: generic /rune plus one per user-invocable skill', async () => {
    const { prompts } = await client.listPrompts();
    const names = prompts.map((p) => p.name);
    assert.ok(names.includes('rune'));
    assert.ok(names.includes('rune-cook'));
    assert.ok(names.includes('rune-autopilot'));
    assert.ok(names.includes('rune-pro-media'));
    assert.ok(!names.includes('rune-skill-router'), 'internal skills get no slash command');
    const p = await client.getPrompt({ name: 'rune-cook', arguments: { task: 'add login' } });
    assert.match(p.messages[0].content.text, /# Rune skill: cook/);
    assert.match(p.messages[0].content.text, /add login/);
    const g = await client.getPrompt({ name: 'rune', arguments: { skill: 'video', task: 'promo' } });
    assert.match(g.messages[0].content.text, /video-creator/);
  });

  test('key rotation takes effect without restart', async () => {
    const { key } = rotateKey(path.join(tmp, 'serve.json'));
    const fresh = new Client({ name: 'rune-test-2', version: '1.0.0' });
    await fresh.connect(
      new StreamableHTTPClientTransport(new URL(running.url), {
        requestInit: { headers: { Authorization: `Bearer ${key}` } },
      }),
    );
    const { tools } = await fresh.listTools();
    assert.strictEqual(tools.length, 4);
    await fresh.close();
    const stale = await fetch(running.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${running.key}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.strictEqual(stale.status, 401);
  });
});

describe('serve: stdio mode via the CLI', () => {
  test('`rune serve --stdio` speaks clean MCP on stdout', async () => {
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    const client = new Client({ name: 'rune-stdio-test', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [path.join(RUNE_ROOT, 'compiler', 'bin', 'rune.js'), 'serve', '--stdio', '--no-tiers'],
        stderr: 'ignore',
      }),
    );
    try {
      const res = await client.callTool({ name: 'get_skill', arguments: { name: 'cook' } });
      assert.match(res.content[0].text, /tier: free/);
      assert.match(res.content[0].text, /name: cook/);
    } finally {
      await client.close();
    }
  });
});
