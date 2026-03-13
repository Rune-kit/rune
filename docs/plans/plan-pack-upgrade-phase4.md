# Phase 4: Distribution & Polish

## Goal
Set up payment/distribution (LemonSqueezy + GitHub Sponsors), enrich @rune/ui with AgentUp-inspired design database depth, establish cross-pack orchestration protocol, and update all documentation.

## Tasks

### Distribution Setup

- [ ] Task 1 — Set up LemonSqueezy store
  - Create LemonSqueezy account (supports Vietnam sellers)
  - Create 2 products: Rune Pro ($49 lifetime), Rune Business ($149 lifetime)
  - Configure license key generation (per-purchase unique key)
  - Set up checkout page with Rune branding
  - Test purchase flow end-to-end
  - Add checkout links to landing page (docs/index.html)

- [ ] Task 2 — Implement license activation in CLI
  - Add `npx @rune-kit/rune pro activate <key>` command
  - Key validation: call LemonSqueezy API to verify license
  - On valid key: clone rune-pro repo content into `extensions/pro-*/`
  - Store activation status in `.rune/license.json` (key hash, tier, activated date)
  - Graceful handling: offline mode (cache last validation), expired key, invalid key

- [ ] Task 3 — Keep GitHub Sponsors as secondary channel
  - Update GitHub Sponsors tiers: $49 (Pro), $149 (Business)
  - Auto-invite sponsors to rune-pro private repo (GitHub Actions workflow)
  - Document: "GitHub Sponsors = simpler for devs, LemonSqueezy = license key for teams"

- [ ] Task 4 — Update RUNE-PRO-PLAN.md distribution section
  - Remove Option B (Stripe) — not available in Vietnam
  - Add LemonSqueezy as primary (license keys, tax handling, VN support)
  - Keep GitHub Sponsors as secondary
  - Keep GitHub Marketplace as future option
  - Add Gumroad as backup (10% fee but simple, works in VN)

### @rune/ui Enrichment (AgentUp-inspired)

- [ ] Task 5 — Add design decision trees to @rune/ui
  - Product type → recommended style mapping (inspired by AgentUp's 96 product categories, condensed to 30 most useful)
  - Data shape → chart type decision tree (inspired by AgentUp's 25 chart types)
  - Add as new skill: `design-decision` in @rune/ui pack
  - Format: structured markdown sections (not CSV — stay consistent with Rune format)

- [ ] Task 6 — Expand color palette database
  - Add 30+ palettes organized by product type (fintech, healthcare, education, gaming, etc.)
  - Inspired by AgentUp's 97 palettes, curated to 30 most distinct/useful
  - Include: CSS variables, Tailwind config, dark/light mode, colorblind alternatives
  - Add as new skill: `palette-picker` in @rune/ui pack

- [ ] Task 7 — Expand typography pairing database
  - Add 25+ font pairings with Google Fonts URLs + Tailwind config
  - Inspired by AgentUp's 57 pairings, curated to most practical
  - Include: display + body + mono combinations, size scale, weight mapping
  - Add as new skill: `type-system` in @rune/ui pack

- [ ] Task 8 — Expand landing page patterns
  - Add 12+ landing page section patterns (hero variants, features, testimonials, pricing, CTA, waitlist)
  - Inspired by AgentUp's 15 landing patterns
  - Include: conversion tips, anti-AI design rules, responsive considerations
  - Add to existing `design-system` skill or new `landing-patterns` skill

### Cross-Pack Orchestration Protocol

- [ ] Task 9 — Define orchestration protocol document
  - File: `docs/CROSS-PACK-PROTOCOL.md` (new)
  - Sections:
    - How packs discover each other (check extensions/ for installed packs)
    - Call convention: `calls @rune-pro/sales.competitive-intel` syntax
    - Data handoff: output artifact path convention (`.rune/<pack>/<skill>/`)
    - Conflict resolution: what happens when two packs write to same path
    - Dependency direction: Pro calls Free (never reverse), Business calls Pro + Free

- [ ] Task 10 — Add orchestration examples to 2 pack pairs
  - product↔sales: competitive-analysis → competitive-intel battlecard
  - data-science↔product: dashboard-building → metrics-tracking KPI spec
  - Add concrete workflow examples to each pack's "Cross-Pack Orchestration" section

### Documentation Updates

- [ ] Task 11 — Update landing page (docs/index.html)
  - Add LemonSqueezy checkout links to pricing cards
  - Update Pro card: 4 packs (product, sales, data-science, support)
  - Update Business card: 4 Pro + 5 Business packs
  - Add @rune/chrome-ext to free features list
  - Update total skill count if changed

- [ ] Task 12 — Update CLAUDE.md
  - Add @rune/chrome-ext to L4 packs list
  - Update Pro pack count (2→4)
  - Update Business pack count (0→2-5 depending on validation)

- [ ] Task 13 — Update docs/ARCHITECTURE.md
  - Add chrome-ext pack to L4 section
  - Add cross-pack orchestration protocol reference
  - Update pack counts and connection graph

- [ ] Task 14 — Update CLI guide (docs/guides/cli.md)
  - Add `rune pro activate <key>` command documentation
  - Add `rune pro status` command (show current license tier)
  - Add Pro pack installation section

## Acceptance Criteria
- [ ] LemonSqueezy store live with 2 products ($49/$149)
- [ ] License activation works: `npx @rune-kit/rune pro activate <key>` installs Pro packs
- [ ] GitHub Sponsors tiers match LemonSqueezy pricing
- [ ] @rune/ui enriched: 225→400+ lines with design decision trees, 30+ palettes, 25+ font pairings
- [ ] Cross-pack orchestration protocol documented and exemplified
- [ ] Landing page has checkout links
- [ ] All docs updated with new pack counts

## Files Touched
- `compiler/bin/rune.js` — add `pro activate` and `pro status` commands
- `extensions/ui/PACK.md` — enrich (rune FREE repo)
- `docs/index.html` — update pricing + checkout links
- `docs/style.css` — if new styling needed for checkout buttons
- `docs/CROSS-PACK-PROTOCOL.md` — new
- `docs/guides/cli.md` — add pro commands
- `docs/ARCHITECTURE.md` — update counts
- `CLAUDE.md` — update counts
- `docs/plans/RUNE-PRO-PLAN.md` — update distribution strategy

## Dependencies
- Phases 1-3 completed (packs exist before distribution can sell them)
- LemonSqueezy account approval (may take a few days)
- @rune/ui enrichment can start independently (no dependency on Phases 1-3)
