# Feature: Guide MVP — live counts, auto changelog, what's-new, Serve/Verify guide

## Overview
The Guide reads like a doc dump: the mesh iframe is cropped and shows stale counts (64/203/40 vs 67/248/46),
code blocks collapse onto one line, and new features (`rune serve`, `rune verify`) are invisible there.
Users also have no way to learn what shipped: GitHub/Telegram notes are a commit list, the site has no changelog,
and the CLI says nothing after an upgrade. This plan fixes all of that with generated (not hand-edited) output.

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Generators + drift guard | ✅ Done | plan-guide-mvp-phase1.md | `scripts/site-gen.mjs` (changelog parser, changelog.html, what's-new chip, mesh diagram, skills badge, `compiler/data/whats-new.json`), `--check` in doctor, drift rules |
| 2 | Discovery surfaces | ✅ Done | plan-guide-mvp-phase2.md | CLI what's-new notice + `rune whats-new`, release.mjs runs site-gen, publish.yml + Telegram + ClawHub notes from CHANGELOG |
| 3 | Guide content + visual QA | ✅ Done | plan-guide-mvp-phase3.md | Code-block fix, Serve + Verify sections, nav links, 375px/1440px screenshots |

## Key Decisions
- One generator script, idempotent, with `--check` wired into `npm run doctor` (CI) — generated files cannot go stale.
- Generated regions in hand-written HTML live between `<!-- rune:gen:<name> -->` markers; everything else stays hand-authored.
- CHANGELOG.md stays the single source. The npm package does not ship CHANGELOG.md, so the CLI reads a small generated `compiler/data/whats-new.json`.
- Mesh diagram is computed from `skill-index.json` (nodes, layers, edges); headline counts come from `collectStats` so they match version-sync.
- CLI notice: once per version, TTY only, never with `--json`, never in CI, never for `hook-dispatch`/`serve`/`verify`; opt-out `RUNE_NO_WHATS_NEW=1`. Silent on a first-ever install (no `~/.rune/`), shown when `~/.rune/` exists but the version changed.
- Unreleased is shown on the changelog page as a clearly labelled "On master — not on npm yet" card; chips and CLI use the latest *released* section only.

## Decision Compliance
- Decisions (locked, from Nam): no new skills; `rune serve` presented as a free core CLI, no upsell; automate over hand-editing; no npm publish in this PR.
- Discretion (agent): area tags inferred from keywords; highlight = first `Added` item; fixes in `<details>`.
- Deferred (wave 2): mesh explorer with click-to-trace, workflow theater, 5-minute mission, scenario cards, cheatsheet, clips.

## Architecture
CHANGELOG.md ──parse──► site-gen.mjs ──► docs/changelog.html, chips (docs/index.html, docs/guides/index.html), compiler/data/whats-new.json
skill-index.json + collectStats ──► site-gen.mjs ──► docs/assets/mesh-diagram.html, /skills/ badge + total
release.mjs prepare ─► site-gen (write) · CI doctor ─► site-gen --check · publish.yml/Telegram ─► site-gen notes <ver>

## Dependencies
- None new (Node built-ins only).

## Risks
- Regex markdown rendering misses an edge case → escape HTML first, render only `code`, `**bold**`, `[links](url)`; tests cover escaping.
- Notice spams users → once-per-version state file + TTY/CI/json guards, unit-tested.
- Telegram 4096-char limit → notes capped to the highlight + 5 titles + link.

## Outcome
- Phases 1–3 done in one PR. `npm run ci`: lint clean, 2013/2013 tests, doctor + version-sync green (incl. site-gen check).
- Screenshots (1440 + 375, no horizontal scroll): /workspace/rune-drafts/guide-mvp/ (not committed).
- Wave 2 (deferred): mesh explorer "play a failure" + workflow theater, 5-minute mission, scenario cards, cheatsheet, clips.
