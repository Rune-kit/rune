# Phase 1: Generators + drift guard

## Goal
One script turns CHANGELOG.md, skill-index.json and live stats into every generated site artifact, and fails CI when any is stale.

## Data Flow
```
CHANGELOG.md → parseChangelog() → releases[] → renderChangelogPage() → docs/changelog.html
                                     ↓ latestReleased()
                         renderChip() → marker regions in docs/index.html, docs/guides/index.html
                         whatsNewData() → compiler/data/whats-new.json
skill-index.json + collectStats() → renderMeshDiagram() → docs/assets/mesh-diagram.html
```

## Code Contracts
```js
// scripts/lib/changelog.mjs
parseChangelog(md) → [{ version: 'Unreleased'|'X.Y.Z', date: string|null, intro: string,
                        sections: [{ type: string, items: [{ title: string, body: string, raw: string }] }],
                        areas: string[] }]
latestReleased(releases) → release | null
releaseHighlights(release, n=3) → string[]          // item titles, Added first
inlineMd(text) → html                               // escapes first; `code`, **bold**, [a](b)
notesMarkdown(release, { max }) → string            // GitHub/Telegram/ClawHub body
// scripts/site-gen.mjs  [--check] | notes <version> [--telegram]
replaceRegion(html, name, body) → html               // <!-- rune:gen:name --> … <!-- /rune:gen:name -->
```

## Tasks
- [x] P1-T1 — changelog parser + inline renderer — File `scripts/lib/changelog.mjs` — Test `scripts/__tests__/changelog.test.js`
- [x] P1-T2 — changelog page, chip, whats-new.json, mesh diagram, skills badge — File `scripts/site-gen.mjs`
- [x] P1-T3 — `--check` mode + wire into `npm run doctor` — File `package.json`
- [x] P1-T4 — drift: add `docs/assets/mesh-diagram.html`, `docs/changelog.html`; catch "NN interconnected skills" and stat-card totals; skills badge must equal package version — File `scripts/version-sync-check.js`

## Failure Scenarios
| When | Then |
|------|------|
| Marker region missing in a target HTML | site-gen exits 1 naming the file + marker |
| CHANGELOG has no released section | chip/whats-new omitted, page still renders Unreleased |
| `--check` finds a diff | exit 1, list stale files, hint `node scripts/site-gen.mjs` |
| HTML/`<script>` text in a changelog line | escaped, never rendered |
