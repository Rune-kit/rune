/**
 * Key management for `rune serve`.
 *
 * The server key is generated on first run and printed ONCE. Only its SHA-256
 * hash is stored, in `~/.rune/serve.json` (mode 0600, dir 0700). Lose the key →
 * `rune serve key rotate` mints a new one (old one stops working immediately).
 *
 * Overrides:
 *   - `RUNE_SERVE_KEY` env var — use this exact key (Docker / systemd secrets);
 *     nothing is written to disk.
 *   - `RUNE_SERVE_CONFIG` env var or `--config <path>` — alternate config file.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const KEY_PREFIX = 'rune_sk_';

export function defaultConfigPath() {
  return process.env.RUNE_SERVE_CONFIG || path.join(os.homedir(), '.rune', 'serve.json');
}

export function hashKey(key) {
  return createHash('sha256').update(String(key), 'utf-8').digest('hex');
}

export function generateKey() {
  return KEY_PREFIX + randomBytes(32).toString('base64url');
}

export function readServeConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeServeConfig(config, configPath = defaultConfigPath()) {
  const dir = path.dirname(configPath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // writeFileSync's mode only applies on create — enforce on existing files too.
  try {
    chmodSync(configPath, 0o600);
  } catch {
    /* non-POSIX fs (Windows) — best effort */
  }
}

/**
 * Mint a new key, store its hash, return the plaintext (caller prints it once).
 * @returns {{ key: string, configPath: string }}
 */
export function rotateKey(configPath = defaultConfigPath()) {
  const key = generateKey();
  const prev = readServeConfig(configPath) || {};
  writeServeConfig(
    {
      ...prev,
      version: 1,
      keyHash: hashKey(key),
      keyHint: `${key.slice(0, KEY_PREFIX.length + 4)}…`,
      createdAt: new Date().toISOString(),
    },
    configPath,
  );
  return { key, configPath };
}

/**
 * Get the active key hash, creating a key on first run.
 * @returns {{ keyHash: string, created: boolean, key?: string, source: 'env'|'config'|'new', configPath: string, keyHint?: string }}
 */
export function ensureKey(configPath = defaultConfigPath()) {
  if (process.env.RUNE_SERVE_KEY) {
    return { keyHash: hashKey(process.env.RUNE_SERVE_KEY), created: false, source: 'env', configPath };
  }
  const cfg = readServeConfig(configPath);
  if (cfg && typeof cfg.keyHash === 'string' && /^[a-f0-9]{64}$/.test(cfg.keyHash)) {
    return { keyHash: cfg.keyHash, created: false, source: 'config', configPath, keyHint: cfg.keyHint };
  }
  const { key } = rotateKey(configPath);
  return { keyHash: hashKey(key), created: true, key, source: 'new', configPath };
}

/** Constant-time compare of a presented key against the stored hash. */
export function verifyKey(presented, keyHash) {
  if (typeof presented !== 'string' || presented.length === 0 || presented.length > 512) return false;
  const a = Buffer.from(hashKey(presented), 'hex');
  const b = Buffer.from(keyHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pull the key from `Authorization: Bearer`, `X-Rune-Key`, or (opt-in) `?key=`. */
export function extractKey(req, { allowQueryKey = false } = {}) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const x = req.headers['x-rune-key'];
  if (typeof x === 'string' && x) return x.trim();
  if (allowQueryKey) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const q = url.searchParams.get('key');
      if (q) return q;
    } catch {
      /* ignore */
    }
  }
  return null;
}
