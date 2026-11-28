# Phase 3: Guide content + visual QA

## Goal
The Guide shows copyable multi-line code, a mesh that fits its frame, and first-class `rune serve` / `rune verify` sections; every page links Changelog.

## Data Flow
```
docs/SERVE.md, docs/VERIFY.md (headlines) → hand-written Guide sections (#serve, #verify) → sidebar group "Run & verify"
nav (index, guides, skills) → changelog.html
```

## Code Contracts
- `.code-block { white-space: pre; }` + `overflow-x:auto`; copy buttons keep `data-copy` text.
- Serve section: 3-step rail (setup → connect → use), "what stays local" note, Free/MIT label, no pricing link.
- Verify section: one card per mode (`--integrity`, `--junk`, `--oracle`, `--reflect`) with command + "catches" + exit behavior.

## Tasks
- [x] P3-T1 — code-block whitespace + light-theme parity — File `docs/guides/index.html`
- [x] P3-T2 — Serve + Verify sections and sidebar group — File `docs/guides/index.html`
- [x] P3-T3 — Changelog link in nav: homepage, guides, skills — Files `docs/index.html`, `docs/guides/index.html`, `docs/skills/index.html`
- [x] P3-T4 — screenshots 1440 + 375, assert `scrollWidth <= innerWidth` — Output `/workspace/rune-drafts/guide-mvp/`

## Failure Scenarios
| When | Then |
|------|------|
| long command at 375px | wraps inside its block (`overflow-x:auto`), page never scrolls sideways |
| JS disabled | sections fully readable (no JS-only content) |
