/**
 * EXPERIMENTAL — `rune serve --tunnel`
 *
 * Opens a Cloudflare quick tunnel (`cloudflared tunnel --url …`) to the local
 * server so remote agents get an https URL with no open port and no
 * certificate to manage. Quick-tunnel URLs change on every start; for a fixed
 * hostname set up a named tunnel (see docs/SERVE.md).
 */

import { spawn } from 'node:child_process';
import { whichSync } from './runner.js';

const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

/** Pull the public URL out of cloudflared's log output. */
export function parseTunnelUrl(text) {
  const m = String(text).match(URL_RE);
  return m ? m[0] : null;
}

/**
 * @param {{ target: string, command?: string, args?: string[], timeoutMs?: number, env?: NodeJS.ProcessEnv }} opts
 * @returns {Promise<{ publicUrl: string, stop: () => void }>}
 */
export function startTunnel({ target, command = 'cloudflared', args, timeoutMs = 30_000, env = process.env }) {
  const bin = whichSync(command, env.PATH);
  if (!bin) {
    return Promise.reject(
      new Error(
        '`cloudflared` not found on PATH. Install it (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or drop --tunnel and use Caddy/nginx.',
      ),
    );
  }
  const argv = args || ['tunnel', '--no-autoupdate', '--url', target];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'], env, shell: false });
    let buf = '';
    let done = false;
    const stop = () => {
      if (child.exitCode === null) child.kill('SIGTERM');
    };
    let url = null;
    let lastErr = '';
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      stop();
      reject(
        new Error(
          url
            ? `cloudflared got ${url} but never connected to the Cloudflare edge within ${Math.round(timeoutMs / 1000)}s${lastErr ? ` (${lastErr})` : ''} — outbound tunnel traffic may be blocked`
            : `cloudflared did not report a tunnel URL within ${Math.round(timeoutMs / 1000)}s`,
        ),
      );
    }, timeoutMs);
    const onData = (c) => {
      if (done) return;
      const chunk = c.toString('utf-8');
      buf = (buf + chunk).slice(-8192);
      url = url || parseTunnelUrl(buf);
      const err = chunk.match(/ERR ([^\n]{0,160})/);
      if (err) lastErr = err[1].trim();
      // The URL is allocated before the edge connection exists; wait for both.
      if (url && /Registered tunnel connection/i.test(buf)) {
        done = true;
        clearTimeout(timer);
        resolve({ publicUrl: url, stop, child });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error(`cloudflared exited (${code}) before the tunnel was up`));
    });
  });
}
