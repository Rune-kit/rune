import assert from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServe } from '../serve/index.js';
import { createRunner, RUNNER_PRESETS, whichSync } from '../serve/runner.js';

const RUNE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// A fake agent CLI: echoes the prompt it got (stdin or --prompt-file), writes a file, honours SLEEP.
const FAKE_AGENT = `
const fs = require('node:fs');
const i = process.argv.indexOf('--prompt-file');
const fromFile = i > 0 ? fs.readFileSync(process.argv[i + 1], 'utf-8') : null;
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  const prompt = fromFile ?? input;
  fs.writeFileSync('deliverable.md', 'done');
  const delay = Number(process.env.FAKE_SLEEP || 0);
  setTimeout(() => {
    process.stdout.write('AGENT GOT: ' + prompt.split('\\n')[0] + ' | key=' + (process.env.RUNE_SERVE_KEY || 'none'));
    process.exit(prompt.includes('FAIL') ? 3 : 0);
  }, delay);
});
`;

describe('serve runner (experimental)', () => {
  let tmp;
  let fake;
  before(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'rune-runner-'));
    fake = path.join(tmp, 'fake-agent.cjs');
    await writeFile(fake, FAKE_AGENT);
  });
  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  test('presets never go through a shell and feed the prompt via stdin or a file', () => {
    assert.deepStrictEqual(Object.keys(RUNNER_PRESETS).sort(), ['claude', 'codex', 'grok']);
    assert.ok(RUNNER_PRESETS.grok.args.includes('{promptFile}'));
    assert.ok(RUNNER_PRESETS.codex.args.includes('-'));
  });

  test('refuses unknown runners and missing binaries', () => {
    assert.throws(() => createRunner({ name: 'bash' }), /Unknown runner/);
    assert.throws(() => createRunner({ name: 'claude', env: { PATH: tmp } }), /not found/);
    assert.strictEqual(whichSync('definitely-not-a-real-cli-xyz'), null);
  });

  test('runs, captures output + files, strips the server key', async () => {
    const r = createRunner({
      name: 'custom',
      command: process.execPath,
      args: [fake],
      workRoot: path.join(tmp, 'runs'),
      env: { ...process.env, RUNE_SERVE_KEY: 'rune_sk_secret' },
    });
    const res = await r.run('hello skill', { skill: 'video-creator' });
    assert.strictEqual(res.ok, true);
    assert.match(res.output, /AGENT GOT: hello skill \| key=none/);
    assert.match(res.output, /- deliverable\.md/);
    assert.match(res.cwd, /video-creator/);
  });

  test('prompt file mode', async () => {
    const r = createRunner({
      name: 'custom',
      command: process.execPath,
      args: [fake, '--prompt-file', '{promptFile}'],
      workRoot: path.join(tmp, 'runs'),
    });
    const res = await r.run('via file');
    assert.match(res.output, /AGENT GOT: via file/);
    assert.doesNotMatch(res.output, /\.rune-prompt\.md/);
  });

  test('non-zero exit is reported as failure', async () => {
    const r = createRunner({
      name: 'custom',
      command: process.execPath,
      args: [fake],
      workRoot: path.join(tmp, 'runs'),
    });
    const res = await r.run('FAIL please');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.exitCode, 3);
  });

  test('timeout kills the run; concurrency limit answers busy', async () => {
    const r = createRunner({
      name: 'custom',
      command: process.execPath,
      args: [fake],
      timeoutMs: 300,
      concurrency: 1,
      workRoot: path.join(tmp, 'runs'),
      env: { ...process.env, FAKE_SLEEP: '5000' },
    });
    const first = r.run('slow');
    const busy = await r.run('second');
    assert.match(busy.output, /Server busy/);
    const res = await first;
    assert.strictEqual(res.timedOut, true);
    assert.strictEqual(res.ok, false);
  });

  test('run_skill mode "execute" goes through the runner; user-invoked-only skills refuse', async () => {
    const runner = createRunner({
      name: 'custom',
      command: process.execPath,
      args: [fake],
      workRoot: path.join(tmp, 'runs'),
    });
    const running = await startServe({
      runeRoot: RUNE_ROOT,
      projectRoot: tmp,
      args: { port: '0', config: path.join(tmp, 'serve.json'), 'no-tiers': true },
      out: () => {},
      runner,
    });
    const client = new Client({ name: 't', version: '1' });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(running.url), {
          requestInit: { headers: { Authorization: `Bearer ${running.key}` } },
        }),
      );
      const { tools } = await client.listTools();
      assert.ok('mode' in tools.find((t) => t.name === 'run_skill').inputSchema.properties);
      assert.match(client.getInstructions(), /Server-side execution is enabled/);
      const exec = await client.callTool({
        name: 'run_skill',
        arguments: { name: 'video-creator', input: 'teaser', mode: 'execute' },
      });
      assert.match(exec.content[0].text, /\[rune runner: custom, exit 0/);
      assert.match(exec.content[0].text, /AGENT GOT: # Rune skill: video-creator/);
      const instr = await client.callTool({ name: 'run_skill', arguments: { name: 'video-creator' } });
      assert.match(instr.content[0].text, /^# Rune skill: video-creator/);
      const launch = await client.callTool({ name: 'run_skill', arguments: { name: 'launch', mode: 'execute' } });
      assert.strictEqual(launch.isError, true);
      assert.match(launch.content[0].text, /never executed server-side/);
    } finally {
      await client.close();
      await running.close();
    }
  });
});
