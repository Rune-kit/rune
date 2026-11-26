/**
 * Skill catalog for `rune serve`.
 *
 * Discovers every skill installed on this machine — Free core skills, Free
 * extension packs, and Pro / Business tiers found through the same tier
 * detection `rune setup` uses ($RUNE_PRO_ROOT / $RUNE_BUSINESS_ROOT, monorepo
 * sibling, well-known paths) — plus any extra `--skills-dir` folders.
 *
 * Every file read goes through `resolveInside()` so a client can never read
 * outside a skill's own directory (no `..`, no absolute paths, no symlink
 * escapes) and never more than `maxBytes` at a time.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { parsePack, parseSkill } from '../parser.js';

/** Text files we expose as references. Binary assets are never served. */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.csv',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.py',
  '.sh',
  '.ps1',
  '.html',
  '.css',
  '.sql',
  '.xml',
]);

const SKIP_DIRS = new Set(['node_modules', '__tests__', '__pycache__', '.git', 'dist', 'build', 'coverage']);

export const DEFAULT_MAX_BYTES = 256 * 1024;
const MAX_REFERENCES_PER_SKILL = 400;
const MAX_WALK_DEPTH = 5;

/** Valid skill ids: lowercase, digits, dash, optional `tier-` prefix. */
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Normalise whatever the user/agent typed into a skill id candidate.
 * Accepts `cook`, `rune:cook`, `/rune cook`, `/rune-cook`, `rune-cook`,
 * `@rune/backend`, `@rune-pro/media`, `Cook`.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSkillName(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  s = s.replace(/^\/+/, '');
  s = s.replace(/^rune\s+/, '');
  s = s.replace(/^rune:/, '');
  s = s.replace(/^@rune\//, '');
  s = s.replace(/^@rune-(pro|business)\//, 'pro-');
  s = s.split(/\s+/)[0] || '';
  return s;
}

/**
 * Resolve `rel` inside `baseDir`, refusing anything that escapes it.
 * Returns the absolute real path or throws.
 * @param {string} baseDir
 * @param {string} rel
 */
export function resolveInside(baseDir, rel) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) {
    throw new Error('Invalid path');
  }
  if (rel.includes('\0')) throw new Error('Invalid path');
  const cleaned = rel.replace(/\\/g, '/');
  if (cleaned.startsWith('/') || /^[a-zA-Z]:/.test(cleaned)) {
    throw new Error('Absolute paths are not allowed');
  }
  if (cleaned.split('/').some((seg) => seg === '..')) {
    throw new Error('Path traversal is not allowed');
  }
  const base = realpathSync(baseDir);
  const candidate = path.resolve(base, cleaned);
  if (candidate !== base && !candidate.startsWith(base + path.sep)) {
    throw new Error('Path traversal is not allowed');
  }
  if (!existsSync(candidate)) throw new Error(`Not found: ${rel}`);
  const real = realpathSync(candidate);
  if (real !== base && !real.startsWith(base + path.sep)) {
    throw new Error('Path escapes the skill directory');
  }
  return real;
}

/**
 * Read a text file with a hard byte cap.
 * @param {string} absPath
 * @param {number} maxBytes
 * @returns {{ text: string, truncated: boolean, bytes: number }}
 */
export function readCapped(absPath, maxBytes = DEFAULT_MAX_BYTES) {
  const st = statSync(absPath);
  if (!st.isFile()) throw new Error('Not a file');
  const buf = readFileSync(absPath);
  const truncated = buf.length > maxBytes;
  const text = (truncated ? buf.subarray(0, maxBytes) : buf).toString('utf-8');
  return { text, truncated, bytes: st.size };
}

/**
 * List reference files inside a skill/pack directory (relative, posix style).
 * @param {string} dir
 * @param {Set<string>} exclude — relative paths to skip (e.g. SKILL.md)
 */
export function listReferences(dir, exclude = new Set()) {
  const out = [];
  const walk = (abs, rel, depth) => {
    if (depth > MAX_WALK_DEPTH || out.length >= MAX_REFERENCES_PER_SKILL) return;
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (out.length >= MAX_REFERENCES_PER_SKILL) return;
      if (ent.name.startsWith('.')) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        walk(path.join(abs, ent.name), childRel, depth + 1);
      } else if (ent.isFile()) {
        if (exclude.has(childRel)) continue;
        if (!TEXT_EXTENSIONS.has(path.extname(ent.name).toLowerCase())) continue;
        out.push(childRel);
      }
    }
  };
  walk(dir, '', 0);
  return out;
}

function readHead(file) {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function truthy(v) {
  return v === true || v === 'true';
}

/**
 * Build a catalog entry for a core skill dir (`<dir>/SKILL.md`).
 */
function skillEntry(dir, tier) {
  const file = path.join(dir, 'SKILL.md');
  const content = readHead(file);
  if (content === null) return null;
  let parsed;
  try {
    parsed = parseSkill(content, file);
  } catch {
    return null;
  }
  const fm = parsed.frontmatter || {};
  const id = (parsed.name || path.basename(dir)).toLowerCase();
  return {
    id,
    name: parsed.name || path.basename(dir),
    tier,
    kind: 'skill',
    dir,
    mainFile: 'SKILL.md',
    description: String(parsed.description || '').trim(),
    layer: parsed.layer || null,
    group: parsed.group || null,
    userInvocable: fm['user-invocable'] === undefined ? true : truthy(fm['user-invocable']),
    modelInvocable: !truthy(fm['disable-model-invocation']),
    crossRefs: parsed.crossRefs || [],
  };
}

/**
 * Build a catalog entry for an extension pack (`<dir>/PACK.md`).
 */
function packEntry(dir, tier) {
  const file = path.join(dir, 'PACK.md');
  const content = readHead(file);
  if (content === null) return null;
  let parsed;
  try {
    parsed = parsePack(content, file);
  } catch {
    return null;
  }
  const id = path.basename(dir).toLowerCase();
  return {
    id,
    name: parsed.name || id,
    tier,
    kind: 'pack',
    dir,
    mainFile: 'PACK.md',
    description: String(parsed.description || '').trim(),
    layer: parsed.layer || 'L4',
    group: null,
    userInvocable: true,
    modelInvocable: true,
    crossRefs: parsed.crossRefs || [],
  };
}

function subdirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => path.join(dir, d.name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Scan one root. A root is either a Rune-shaped tree (has `skills/` and/or
 * `extensions/`) or a plain folder of `<name>/SKILL.md` skill dirs.
 * @param {string} root
 * @param {string} tier
 */
export function scanRoot(root, tier) {
  const entries = [];
  if (!root || !existsSync(root)) return entries;
  const skillsDir = path.join(root, 'skills');
  const extDir = path.join(root, 'extensions');
  const runeShaped = existsSync(skillsDir) || existsSync(extDir);
  const skillDirs = runeShaped ? subdirs(skillsDir) : subdirs(root);
  for (const d of skillDirs) {
    if (existsSync(path.join(d, 'SKILL.md'))) {
      const e = skillEntry(d, tier);
      if (e) entries.push(e);
    } else if (existsSync(path.join(d, 'PACK.md'))) {
      const e = packEntry(d, tier);
      if (e) entries.push(e);
    }
  }
  if (runeShaped) {
    for (const d of subdirs(extDir)) {
      if (existsSync(path.join(d, 'PACK.md'))) {
        const e = packEntry(d, tier);
        if (e) entries.push(e);
      }
    }
  }
  return entries;
}

/**
 * Create a catalog.
 *
 * @param {{ roots: Array<{ root: string, tier: string }>, maxBytes?: number }} opts
 */
export function createCatalog({ roots, maxBytes = DEFAULT_MAX_BYTES }) {
  /** @type {Map<string, object>} */
  let byId = new Map();
  /** sub-skill alias (e.g. `image-generator`) → { packId, file } */
  let aliases = new Map();
  let builtAt = 0;

  const rebuild = () => {
    const next = new Map();
    for (const { root, tier } of roots) {
      for (const entry of scanRoot(root, tier)) {
        let id = entry.id;
        if (!ID_RE.test(id)) id = id.replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '');
        if (!id) continue;
        if (next.has(id)) id = `${tier}-${id}`;
        if (next.has(id)) continue;
        next.set(id, { ...entry, id });
      }
    }
    const nextAliases = new Map();
    for (const e of next.values()) {
      if (e.kind !== 'pack') continue;
      const sk = path.join(e.dir, 'skills');
      let files = [];
      try {
        files = readdirSync(sk).filter((f) => f.endsWith('.md') && !f.endsWith('-evals.md'));
      } catch {
        continue;
      }
      for (const f of files) {
        const alias = f.slice(0, -3).toLowerCase();
        if (next.has(alias) || nextAliases.has(alias)) continue;
        nextAliases.set(alias, { packId: e.id, file: `skills/${f}` });
      }
    }
    byId = next;
    aliases = nextAliases;
    builtAt = Date.now();
  };

  rebuild();

  const api = {
    roots,
    maxBytes,
    get size() {
      return byId.size;
    },
    get builtAt() {
      return builtAt;
    },
    rebuild,
    /** Re-scan when the cached view is older than `ttlMs` (picks up `git pull` on tier repos). */
    refreshIfStale(ttlMs = 30_000) {
      if (Date.now() - builtAt > ttlMs) rebuild();
    },
    all() {
      return [...byId.values()];
    },
    counts() {
      const out = {};
      for (const e of byId.values()) out[e.tier] = (out[e.tier] || 0) + 1;
      return out;
    },
    /** Exact lookup after normalisation; also tries `pro-`/`business-` prefixed ids. */
    find(raw) {
      const n = normalizeSkillName(raw);
      if (!n) return null;
      if (byId.has(n)) return byId.get(n);
      for (const prefix of ['pro-', 'business-', 'free-', 'custom-']) {
        if (byId.has(prefix + n)) return byId.get(prefix + n);
      }
      for (const e of byId.values()) {
        if (e.name.toLowerCase() === raw.trim().toLowerCase()) return e;
      }
      const alias = aliases.get(n);
      if (alias && byId.has(alias.packId)) return { ...byId.get(alias.packId), focus: alias.file };
      // "use the video skill" → the ONE id containing "video" (ambiguous → no match).
      if (n.length >= 3) {
        const hits = [...byId.keys()].filter((id) => id.split('-').includes(n) || id.startsWith(`${n}-`));
        if (hits.length === 1) return byId.get(hits[0]);
      }
      return null;
    },
    /** Fuzzy suggestions for a miss. */
    suggest(raw, limit = 5) {
      const n = normalizeSkillName(raw);
      if (!n) return [];
      const scored = [];
      for (const e of byId.values()) {
        let score = 0;
        if (e.id.includes(n) || n.includes(e.id)) score += 3;
        if (e.description.toLowerCase().includes(n)) score += 1;
        const d = levenshtein(n, e.id);
        if (d <= 2) score += 3 - d;
        if (score > 0) scored.push({ id: e.id, score });
      }
      for (const [alias] of aliases) {
        if (alias.includes(n) || levenshtein(n, alias) <= 2) scored.push({ id: alias, score: 2 });
      }
      return scored
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map((s) => s.id);
    },
    /** Search by free text over id + description. */
    search({ filter, tier, kind } = {}) {
      const terms = String(filter || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      return api.all().filter((e) => {
        if (tier && e.tier !== tier) return false;
        if (kind && e.kind !== kind) return false;
        if (terms.length === 0) return true;
        const hay =
          `${e.id} ${e.name} ${e.description} ${e.group || ''} ${api.aliasesFor(e.id).join(' ')}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    },
    /** Pack sub-skill aliases, for listing. */
    aliasesFor(packId) {
      return [...aliases.entries()].filter(([, v]) => v.packId === packId).map(([k]) => k);
    },
    references(entry) {
      return listReferences(entry.dir, new Set([entry.mainFile]));
    },
    readMain(entry) {
      return readCapped(resolveInside(entry.dir, entry.mainFile), maxBytes);
    },
    readReference(entry, rel) {
      const abs = resolveInside(entry.dir, rel);
      const ext = path.extname(abs).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) throw new Error(`Only text files can be read (got ${ext || 'no extension'})`);
      return readCapped(abs, maxBytes);
    },
  };
  return api;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}
