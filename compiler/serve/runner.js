/**
 * EXPERIMENTAL — `rune serve --runner claude|codex|grok`
 *
 * Lets `run_skill(mode: "execute")` run a skill ON THE SERVER through a local
 * agent CLI and return its output. Meant for self-contained deliverables
 * (plans, copy, reports, media) — not for editing the caller's repo.
 *
 * Each run gets a fresh working directory under ~/.rune/serve-runs/, a hard
 * timeout, an output cap and a concurrency limit. No shell is involved: the
 * CLI is spawned with an argv array and the prompt goes over stdin.
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * argv per supported CLI. The prompt goes over stdin, or — where `{promptFile}`
 * appears — into `.rune-prompt.md` inside the run's working directory.
 */
export const RUNNER_PRESETS = Object.freeze({
  claude: { command: 'claude', args: ['-p', '--output-format', 'text', '--permission-mode', 'acceptEdits'] },
  codex: { command: 'codex', args: ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-'] },
  grok: {
    command: 'grok',
    args: ['--prompt-file', '{promptFile}', '--permission-mode', 'acceptEdits', '--output-format', 'plain'],
  },
});

/** Find an executable on PATH (no shell). */
export function whichSync(cmd, envPath = process.env.PATH || '') {
  if (path.isAbsolute(cmd)) return existsSync(cmd) ? cmd : null;
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = path.join(dir, cmd + ext);
      try {
        if (statSync(full).isFile()) return full;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

function listFiles(dir, max = 50) {
  const out = [];
  const walk = (abs, rel) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (out.length >= max) return;
      if (ent.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(abs, ent.name), r);
      else out.push(r);
    }
  };
  try {
    walk(dir, '');
  } catch {
    /* empty */
  }
  return out;
}

/**
 * @param {{
 *   name: string,                 // claude | codex | grok | custom
 *   command?: string, args?: string[],   // override (tests / custom CLIs)
 *   timeoutMs?: number, maxOutputBytes?: number, concurrency?: number,
 *   workRoot?: string, env?: NodeJS.ProcessEnv,
 * }} opts
 */
export function createRunner({
  name,
  command,
  args,
  timeoutMs = 600_000,
  maxOutputBytes = 1024 * 1024,
  concurrency = 2,
  workRoot = path.join(os.homedir(), '.rune', 'serve-runs'),
  env = process.env,
}) {
  const preset = RUNNER_PRESETS[name];
  const cmd = command || preset?.command;
  const argv = args || preset?.args;
  if (!cmd || !argv) {
    throw new Error(`Unknown runner "${name}". Use one of: ${Object.keys(RUNNER_PRESETS).join(', ')}`);
  }
  const resolved = whichSync(cmd, env.PATH);
  if (!resolved) throw new Error(`Runner "${name}" needs \`${cmd}\` on PATH (not found).`);

  const childEnv = { ...env };
  delete childEnv.RUNE_SERVE_KEY; // never hand the server key to the agent
  let active = 0;

  return {
    name,
    command: resolved,
    /**
     * @param {string} prompt
     * @param {{ skill?: string }} [meta]
     */
    run(prompt, meta = {}) {
      const started = Date.now();
      if (active >= concurrency) {
        return Promise.resolve({
          ok: false,
          output: `Server busy: ${active} skill run(s) already in progress (limit ${concurrency}). Try again shortly, or use mode "instructions".`,
          exitCode: null,
          timedOut: false,
          durationMs: 0,
        });
      }
      active += 1;
      const slug =
        String(meta.skill || 'run')
          .replace(/[^a-z0-9-]/gi, '')
          .slice(0, 40) || 'run';
      const cwd = path.join(
        workRoot,
        `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug}-${randomBytes(3).toString('hex')}`,
      );
      mkdirSync(cwd, { recursive: true, mode: 0o700 });

      const promptFile = path.join(cwd, '.rune-prompt.md');
      const usesFile = argv.some((a) => a.includes('{promptFile}'));
      if (usesFile) writeFileSync(promptFile, prompt, { mode: 0o600 });
      const finalArgv = argv.map((a) => a.replaceAll('{promptFile}', promptFile));

      return new Promise((resolve) => {
        let out = Buffer.alloc(0);
        let truncated = false;
        let timedOut = false;
        const append = (chunk) => {
          if (truncated) return;
          const room = maxOutputBytes - out.length;
          if (chunk.length > room) {
            out = Buffer.concat([out, chunk.subarray(0, room)]);
            truncated = true;
          } else {
            out = Buffer.concat([out, chunk]);
          }
        };
        const child = spawn(resolved, finalArgv, { cwd, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 5000).unref();
        }, timeoutMs);
        const finish = (exitCode, extra = '') => {
          clearTimeout(timer);
          active -= 1;
          const files = listFiles(cwd);
          let text = out.toString('utf-8') + extra;
          if (truncated) text += `\n[output truncated at ${maxOutputBytes} bytes]`;
          if (files.length)
            text += `\n\n[files written on the server in ${cwd}]\n${files.map((f) => `- ${f}`).join('\n')}`;
          resolve({
            ok: !timedOut && exitCode === 0,
            output: text,
            exitCode,
            timedOut,
            durationMs: Date.now() - started,
            cwd,
          });
        };
        child.on('error', (err) => finish(null, `\n[runner failed to start: ${err.message}]`));
        child.on('close', (code) => finish(code));
        child.stdin.on('error', () => {});
        child.stdin.end(usesFile ? '' : prompt);
      });
    },
  };
}
