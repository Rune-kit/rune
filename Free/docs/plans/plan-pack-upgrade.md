# Feature: Pro & Business Pack Deep Upgrade

## Overview
Deeply upgrade all Pro and Business packs to justify $49/$149 lifetime pricing. Current Pro packs (product, sales) are ~450 lines — thinner than best free packs (trading 597, devops 520). This plan raises ALL paid packs to 600-800+ lines with unique differentiators: output artifacts, cross-pack orchestration, business context integration, and template libraries.

Additionally: add @rune/chrome-ext as a new FREE L4 pack (unique differentiator — no competitor has this), enrich @rune/ui with AgentUp-inspired design database depth, and fix distribution strategy (Stripe → LemonSqueezy since Stripe unavailable in Vietnam).

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Enrich Existing Pro | ✅ Done | plan-pack-upgrade-phase1.md | @rune-pro/product (1253 lines) and @rune-pro/sales (889 lines) |
| 2 | New Pro + Free Packs | ✅ Done | plan-pack-upgrade-phase2.md | @rune-pro/data-science (1356 lines), @rune-pro/support (802 lines), @rune/chrome-ext (995 lines FREE) |
| 3 | Business Tier | ⬚ Pending | plan-pack-upgrade-phase3.md | Build @rune-pro/finance, legal, hr, operations, enterprise-search |
| 4 | Distribution & Polish | ⬚ Pending | plan-pack-upgrade-phase4.md | LemonSqueezy setup, @rune/ui enrichment, cross-pack orchestration protocol |

## Key Decisions

### Depth Standard
- **FREE best** (trading): 597 lines, 7 skills, 5-7 steps/skill, code examples, sharp edges
- **PRO minimum**: 650+ lines, 6+ skills, 6-8 steps/skill, output artifacts, templates, cross-pack calls
- **BUSINESS minimum**: 700+ lines, 6+ skills, 7-9 steps/skill, compliance patterns, multi-stakeholder workflows, enterprise integration
- **Rule**: Every Pro/Business skill MUST produce an output artifact (.md, .json, .csv) — not just advice

### Unique Pro/Business Differentiators (vs Free)
1. **Output Artifacts** — Pro skills generate documents (PRD.md, roadmap.md, call-brief.md, pipeline-report.md)
2. **Template Library** — Each Pro pack includes 3-5 reusable templates that free packs don't have
3. **Cross-Pack Orchestration** — product→sales handoff, sales→support escalation, data-science→product metrics
4. **Business Context** — `.rune/business/` integration (people, glossary, processes, context)
5. **Multi-Stakeholder Workflows** — approval gates, sign-off checklists, status update generators

### New FREE Pack: @rune/chrome-ext
- Unique in the market — neither AgentUp nor any competitor has Chrome extension skills
- 5-6 skills: mv3-scaffold, ext-messaging, ext-storage, cws-preflight, cws-publish, ext-ai-integration
- Pain point: 58% CWS rejections are preventable compliance errors
- MV3 gotchas (service worker termination, no remote code, permission minimization) are perfect for AI agent skills

### Distribution Fix
- **Stripe**: ❌ Not available in Vietnam — remove Option B from RUNE-PRO-PLAN.md
- **LemonSqueezy**: ✅ VN support, 5%+50¢ fee, Merchant of Record (handles tax), built-in license keys
- **GitHub Sponsors**: ✅ Keep as secondary (simpler for dev-first users)
- **Gumroad**: ⚠️ Backup option, 10% fee but very simple

### AgentUp-Inspired Enrichments
- @rune/ui: Add design database depth (68 styles → condensed to 30 most useful, 50+ palettes, 30+ font pairings)
- Concept: queryable knowledge patterns (not CSV+BM25, but structured markdown sections with clear decision trees)
- Architecture generator concept → enhance `scaffold` skill with multi-domain reasoning

## Pack Inventory (Current → Target)

### FREE L4 Packs (12 existing + 1 new)
| Pack | Current | Target | Notes |
|------|---------|--------|-------|
| @rune/ui | 225 lines | 400+ | Enrich with design database (Phase 4) |
| @rune/backend | 257 | Keep | Adequate |
| @rune/devops | 520 | Keep | Already deep |
| @rune/mobile | 273 | Keep | Adequate |
| @rune/security | 216 | Keep | Adequate |
| @rune/trading | 597 | Keep | Already deep — benchmark for Pro |
| @rune/saas | 276 | Keep | Adequate |
| @rune/ecommerce | 280 | Keep | Adequate |
| @rune/ai-ml | 517 | Keep | Already deep |
| @rune/gamedev | 393 | Keep | Adequate |
| @rune/content | 381 | Keep | Adequate |
| @rune/analytics | 557 | Keep | Already deep |
| **@rune/chrome-ext** | **NEW** | **500+** | **Phase 2 — unique differentiator** |

### PRO Packs ($49 lifetime — all must be 650+ lines)
| Pack | Current | Target | Phase |
|------|---------|--------|-------|
| @rune-pro/product | 455 lines | 750+ | Phase 1 |
| @rune-pro/sales | ~400 lines | 650+ | Phase 1 |
| @rune-pro/data-science | Planned | 700+ | Phase 2 |
| @rune-pro/support | Planned | 650+ | Phase 2 |

### BUSINESS Packs ($149 lifetime — all must be 700+ lines)
| Pack | Current | Target | Phase |
|------|---------|--------|-------|
| @rune-pro/finance | Planned | 750+ | Phase 3 |
| @rune-pro/legal | Planned | 700+ | Phase 3 |
| @rune-pro/hr | Planned | 700+ | Phase 3 |
| @rune-pro/operations | Planned | 700+ | Phase 3 |
| @rune-pro/enterprise-search | Planned | 700+ | Phase 3 |

## Value Justification

### Why $49 Pro is worth it
- 4 packs × 650-750 lines = ~2,800+ lines of domain expertise
- 24+ skills with 6-8 step workflows each
- 15-20 output artifact templates (PRD, roadmap, call brief, pipeline report, etc.)
- Cross-pack orchestration (product↔sales↔support↔data-science)
- Business context integration (.rune/business/)
- Comparison: ClaudeKit charges $99 lifetime for less domain depth

### Why $149 Business is worth it
- Everything in Pro PLUS 5 enterprise packs (~3,500+ additional lines)
- 30+ enterprise skills with compliance/regulatory patterns
- Multi-stakeholder workflows (approval chains, sign-off gates)
- Enterprise tool integration (Jira/Linear/Notion output formats)
- Priority support + custom skill forge session

## Dependencies
- Phase 1: No dependencies (enrich existing files in rune-pro repo)
- Phase 2: Phase 1 sets the depth standard; chrome-ext is independent (free repo)
- Phase 3: Phase 1-2 validate the depth approach before investing in 5 Business packs
- Phase 4: Phases 1-3 complete → distribution and polish

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Pro packs still feel thin after upgrade | No sales | Benchmark against trading pack (597 lines) — Pro must exceed |
| Business packs too niche (finance, legal) | Low demand | Start with 2 most requested, validate before building all 5 |
| LemonSqueezy blocks VN sellers | No payment | GitHub Sponsors as primary, Gumroad as backup |
| Chrome extension ecosystem changes | Pack obsolete | MV3 is stable since 2024, Chrome AI APIs are new growth area |
| AgentUp copies our chrome-ext pack | Competition | First-mover advantage, deeper Rune mesh integration |
