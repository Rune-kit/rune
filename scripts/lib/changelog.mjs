/**
 * changelog.mjs — parse CHANGELOG.md (Keep a Changelog, Rune flavour) into
 * structured releases, and render the bits every release surface needs:
 * the site changelog, the "What's new" chips, the CLI notice data, and the
 * GitHub / Telegram / ClawHub notes. CHANGELOG.md stays the single source.
 *
 * Pure functions only — file IO lives in scripts/site-gen.mjs.
 */

export const REPO_URL = 'https://github.com/rune-kit/rune';
export const SITE_URL = 'https://rune-kit.github.io/rune';
export const CHANGELOG_URL = `${SITE_URL}/changelog.html`;

const NEW_TYPES = /^(added|what you get|highlights|new)\b/i;
const FIX_TYPES = /^(fixed|security)\b/i;

/** Keyword → area tag. First matches win; at most 4 tags per release. */
const AREAS = [
  ['Serve', /\brune serve\b|\bMCP\b|`serve`/],
  ['Verify', /\brune verify\b|\bintegrity\b|junk-match|\boracle\b|--reflect|\blints?\b/i],
  ['Hooks', /\bhooks?\b/i],
  ['Platforms', /\badapters?\b|\bplatforms?\b|Grok Build|Cursor|Codex|Antigravity|Windsurf/],
  ['Skills', /\bL[0-4] skill\b|\bnew skill\b|SKILL\.md/],
  ['Models', /\bmodel tiers?\b|\bmodel routing\b|\bgemini-|\bopus\b|\bsonnet\b/i],
  ['Site & docs', /\bsite\b|landing page|\bdocs\//i],
  ['Release', /\brelease script\b|npm publish|release\.mjs/i],
];

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline markdown → HTML. Escapes first; renders only `code`, **bold**, [text](url). */
export function inlineMd(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, label, url) => {
    const raw = url.replace(/&amp;/g, '&');
    let href;
    if (/^https?:\/\//i.test(raw)) href = raw;
    else if (/^[\w./#-]+$/.test(raw) && !/^[a-z]+:/i.test(raw))
      href = `${REPO_URL}/blob/master/${raw.replace(/^\.\//, '')}`;
    else return label;
    return `<a href="${escapeHtml(href)}">${label}</a>`;
  });
  return s.replace(/\uE000(\d+)\uE000/g, (_, i) => codes[Number(i)]);
}

/** Strip markdown to plain text (for terminals and Telegram). */
export function plainText(text) {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title of an item: its leading **bold** run, else its first sentence (≤ 90 chars). */
export function itemTitle(raw) {
  const bold = raw.match(/^\*\*(.+?)\*\*/);
  let t = bold ? bold[1] : raw.split(/(?<=[.!?])\s/)[0];
  t = t.trim().replace(/[.:]$/, '');
  if (!bold && t.length > 90) t = `${t.slice(0, 87).replace(/\s+\S*$/, '')}…`;
  return t;
}

function itemBody(raw) {
  return raw.replace(/^\*\*(.+?)\*\*\s*/, '').trim();
}

function makeItem(raw, title) {
  return title
    ? { raw, title, body: raw, prose: true }
    : { raw, title: itemTitle(raw), body: itemBody(raw), prose: false };
}

function areasFor(text) {
  const out = [];
  for (const [tag, re] of AREAS) if (re.test(text) && out.length < 4) out.push(tag);
  return out;
}

/** Parse a section body (lines after a ### heading) into items. */
function parseItems(lines, headingSuffix) {
  const bullets = [];
  const prose = [];
  let cur = null;
  for (const line of lines) {
    const b = line.match(/^\s{0,1}[-*]\s+(.*)$/);
    if (b) {
      cur = { text: b[1] };
      bullets.push(cur);
    } else if (cur && /^\s+\S/.test(line)) {
      cur.text += ` ${line.trim()}`;
    } else if (line.trim()) {
      cur = null;
      prose.push(line.trim());
    } else {
      cur = null;
      if (prose.length && prose.at(-1) !== '') prose.push('');
    }
  }
  if (bullets.length) return bullets.map((b) => makeItem(b.text.trim()));
  const body = prose.join('\n').trim();
  if (!body) return [];
  return [makeItem(body.replace(/\n(?!\n)/g, ' '), headingSuffix ? headingSuffix : itemTitle(body))];
}

/**
 * @param {string} md CHANGELOG.md text
 * @returns {Array<{version:string,date:string|null,intro:string,sections:Array<{type:string,heading:string,items:Array}>,areas:string[]}>}
 */
export function parseChangelog(md) {
  const releases = [];
  const blocks = String(md).split(/^## /m).slice(1);
  for (const block of blocks) {
    const [headLine, ...rest] = block.split('\n');
    const m = headLine.match(/^\[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (!m) continue;
    const release = { version: m[1], date: m[2] || null, intro: '', sections: [], areas: [] };
    const introLines = [];
    let section = null;
    let buf = [];
    const flush = () => {
      if (!section) return;
      section.items = parseItems(buf, section.suffix);
      delete section.suffix;
      if (section.items.length) release.sections.push(section);
    };
    for (const line of rest) {
      const h = line.match(/^###\s+(.*)$/);
      if (h) {
        flush();
        const [type, ...suffix] = h[1].split(/\s+[—–-]\s+/);
        section = { type: type.trim(), heading: h[1].trim(), suffix: suffix.join(' — ').trim() || null, items: [] };
        buf = [];
      } else if (section) buf.push(line);
      else introLines.push(line);
    }
    flush();
    // Intro: first prose paragraph before any ### (bullets there become a "Notes" section).
    const introBullets = introLines.filter((l) => /^\s*[-*]\s+/.test(l) || /^\s{2,}\S/.test(l));
    const introProse = introLines.filter((l) => !introBullets.includes(l));
    release.intro =
      introProse
        .join('\n')
        .trim()
        .split(/\n\s*\n/)[0]
        ?.replace(/\n/g, ' ')
        .trim() || '';
    if (introBullets.length)
      release.sections.unshift({ type: 'Notes', heading: 'Notes', items: parseItems(introBullets) });
    release.areas = areasFor(
      `${release.intro}\n${release.sections.map((s) => s.heading + s.items.map((i) => i.raw).join(' ')).join('\n')}`,
    );
    releases.push(release);
  }
  return releases;
}

export const isNewSection = (s) => NEW_TYPES.test(s.type);
export const isFixSection = (s) => FIX_TYPES.test(s.type);

export function latestReleased(releases) {
  return releases.find((r) => r.version !== 'Unreleased' && /^\d+\.\d+\.\d+/.test(r.version)) || null;
}

/** Ordered items: new first, then changed/other, then fixes. */
export function orderedItems(release) {
  const rank = (s) => (isNewSection(s) ? 0 : isFixSection(s) ? 2 : 1);
  return [...release.sections].sort((a, b) => rank(a) - rank(b)).flatMap((s) => s.items);
}

export function releaseHighlights(release, n = 3) {
  return orderedItems(release)
    .slice(0, n)
    .map((i) => i.title);
}

export const anchorFor = (version) => (version === 'Unreleased' ? 'unreleased' : `v${version.replace(/\./g, '-')}`);

/** GitHub / ClawHub notes: the CHANGELOG section verbatim (normalised) + compare link. */
export function notesMarkdown(release, { previous } = {}) {
  const out = [];
  if (release.intro) out.push(release.intro, '');
  for (const s of release.sections) {
    out.push(`### ${s.heading}`);
    for (const i of s.items) out.push(i.prose ? i.raw : `- ${i.raw}`);
    out.push('');
  }
  out.push(`Full notes: ${CHANGELOG_URL}#${anchorFor(release.version)}`);
  if (previous) out.push(`**Full Changelog**: ${REPO_URL}/compare/v${previous}...v${release.version}`);
  return `${out.join('\n').trim()}\n`;
}

/** Short Telegram HTML message for a version, or null when the CHANGELOG has no such section. */
export function telegramText(releases, version) {
  const r = releases.find((x) => x.version === version);
  if (!r) return null;
  const lines = [`🔮 <b>Rune v${escapeHtml(r.version)}</b>`];
  if (r.intro) lines.push('', escapeHtml(plainText(r.intro).replace(/`/g, '')).slice(0, 400));
  lines.push('');
  for (const t of releaseHighlights(r, 6)) lines.push(`• ${escapeHtml(plainText(t).replace(/`/g, ''))}`);
  lines.push(
    '',
    `📝 <a href="${CHANGELOG_URL}#${anchorFor(r.version)}">What's new</a> · 📦 <a href="${REPO_URL}/releases/tag/v${escapeHtml(r.version)}">Release</a>`,
    '⬆️ <code>npm i -g @rune-kit/rune@latest</code>',
  );
  return lines.join('\n').slice(0, 4000);
}

export { escapeHtml };
