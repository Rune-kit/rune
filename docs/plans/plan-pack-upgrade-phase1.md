# Phase 1: Enrich Existing Pro Packs (product + sales)

## Goal
Upgrade @rune-pro/product from 455→750+ lines and @rune-pro/sales from ~400→650+ lines. Every skill gains: deeper workflows (6-8 steps), output artifact generation, reusable templates, business context integration, and cross-pack orchestration hooks.

## Depth Standard (must exceed free @rune/trading benchmark)

| Dimension | Free Trading (benchmark) | Pro Target |
|-----------|-------------------------|------------|
| Lines/pack | 597 | 650-750+ |
| Skills/pack | 7 | 6-8 |
| Steps/skill | 5-7 | 6-8 |
| Code examples | 2-3 per skill | 2-3 per skill |
| Sharp edges | 4-6 rows | 5-7 rows |
| **Output artifacts** | None | **2-3 per skill** |
| **Templates** | None | **1-2 per skill** |
| **Cross-pack calls** | Within pack only | **Cross-pack orchestration** |
| **Business context** | None | **`.rune/business/` integration** |

## Tasks

### @rune-pro/product Enhancement (455→750+)

- [x] Task 1 — Enrich `feature-spec` skill
  - Add Steps 4-6: stakeholder review checklist, acceptance criteria generator, edge case discovery
  - Add output artifact: generates `docs/specs/<feature-name>.md` from PRD template
  - Add template: `PRD-TEMPLATE.md` (sections: Problem, Users, Requirements, Success Metrics, Risks, Timeline)
  - Add business context: reads `.rune/business/people.md` to auto-fill stakeholder fields
  - Add sharp edges: scope creep detection, missing NFRs, vague acceptance criteria

- [x] Task 2 — Enrich `roadmap` skill
  - Add Steps 5-7: dependency graph generation, resource allocation check, stakeholder alignment matrix
  - Add output artifact: generates `.rune/roadmap/roadmap-<quarter>.md` with ICE/RICE scores
  - Add template: `ROADMAP-TEMPLATE.md` (quarterly view, swimlanes by team, dependency arrows)
  - Add cross-pack call: pulls competitive intel from `@rune-pro/sales.competitive-intel`
  - Add business context: reads `.rune/business/processes.md` for approval gates

- [x] Task 3 — Enrich `metrics-tracking` skill
  - Add Steps 5-7: automated KPI dashboard spec, alert threshold definition, metric decay detection
  - Add output artifact: generates `.rune/metrics/kpi-dashboard-spec.md`
  - Add template: `KPI-TEMPLATE.md` (metric name, formula, source, target, alert threshold, owner)
  - Add cross-pack call: feeds metrics to `@rune-pro/data-science.dashboard-building` when available

- [x] Task 4 — Enrich `release-comms` (was stakeholder-comms)
  - Add Steps 5-7: multi-channel distribution (Slack, email, changelog), audience-aware tone adjustment
  - Add output artifact: generates `docs/releases/<version>.md` + Slack-formatted summary
  - Add template: `RELEASE-NOTES-TEMPLATE.md` (highlights, breaking changes, migration guide, credits)
  - Add business context: reads `.rune/business/people.md` to route comms to right stakeholders

- [x] Task 5 — Enrich `user-research-synthesis` skill
  - Add Steps 5-7: sentiment analysis framework, insight prioritization (impact × frequency), action item generator
  - Add output artifact: generates `.rune/research/synthesis-<date>.md`
  - Add template: `RESEARCH-SYNTHESIS-TEMPLATE.md` (themes, quotes, sentiment, recommendations)
  - Add cross-pack call: feeds insights to `feature-spec` for PRD context

- [x] Task 6 — Enrich `competitive-analysis` skill
  - Add Steps 5-7: feature parity matrix generator, pricing comparison table, SWOT output
  - Add output artifact: generates `.rune/competitive/<competitor>.md` + comparison matrix
  - Add template: `COMPETITIVE-MATRIX-TEMPLATE.md` (features × competitors grid, scoring)
  - Add cross-pack call: feeds to `@rune-pro/sales.competitive-intel` for sales enablement

- [x] Task 7 — Add pack-level enhancements
  - Add "Cross-Pack Orchestration" section to PACK.md (product↔sales handoff protocol)
  - Add "Business Context Setup" section (how to populate `.rune/business/` files)
  - Add "Output Artifacts Directory" section (where all generated files go)
  - Update Connections section with cross-pack calls
  - Update Cost Profile (token estimates for enriched skills)

### @rune-pro/sales Enhancement (~400→650+)

- [x] Task 8 — Enrich `account-research` skill
  - Add Steps 5-7: tech stack detection, org chart mapping, trigger event identification
  - Add output artifact: generates `.rune/sales/accounts/<company>.md`
  - Add template: `ACCOUNT-BRIEF-TEMPLATE.md` (company, decision makers, tech stack, pain points, triggers)
  - Add business context: reads `.rune/business/glossary.md` to align terminology

- [x] Task 9 — Enrich `call-preparation` skill
  - Add Steps 5-7: objection handling playbook, competitor landmine detection, value prop customization
  - Add output artifact: generates `.rune/sales/calls/<company>-<date>.md`
  - Add template: `CALL-PREP-TEMPLATE.md` (agenda, talking points, objections, questions to ask, next steps)
  - Add cross-pack call: pulls product roadmap from `@rune-pro/product.roadmap` for feature timeline answers

- [x] Task 10 — Enrich `competitive-intel` skill
  - Add Steps 5-7: win/loss pattern analysis, battlecard generator, competitive response playbook
  - Add output artifact: generates `.rune/sales/battlecards/<competitor>.md`
  - Add template: `BATTLECARD-TEMPLATE.md` (their pitch, our counter, landmines, proof points)
  - Add cross-pack call: consumes `@rune-pro/product.competitive-analysis` data

- [x] Task 11 — Enrich `outreach-drafting` skill
  - Add Steps 5-7: multi-channel sequences (email + LinkedIn + follow-up), A/B variant generation, personalization hooks
  - Add output artifact: generates `.rune/sales/outreach/<prospect>-sequence.md`
  - Add template: `OUTREACH-SEQUENCE-TEMPLATE.md` (5-touch sequence with timing, channel, message)

- [x] Task 12 — Enrich `pipeline-review` skill
  - Add Steps 5-7: deal risk scoring, velocity analysis, forecast confidence intervals
  - Add output artifact: generates `.rune/sales/pipeline/review-<date>.md`
  - Add template: `PIPELINE-REVIEW-TEMPLATE.md` (deals by stage, risk flags, forecast, action items)
  - Add cross-pack call: feeds to `@rune-pro/product.metrics-tracking` for revenue KPIs

- [x] Task 13 — Enrich `daily-briefing` skill
  - Add Steps 5-6: multi-source aggregation (CRM + email + calendar), priority scoring, time-block suggestions
  - Add output artifact: generates `.rune/sales/briefings/<date>.md`
  - Add template: `DAILY-BRIEFING-TEMPLATE.md` (top 3 priorities, deals to follow up, meetings prep, blockers)

- [x] Task 14 — Add pack-level enhancements (same as Task 7 but for sales)
  - Cross-Pack Orchestration (sales↔product handoff)
  - Business Context Setup
  - Output Artifacts Directory
  - Updated Connections and Cost Profile

## Acceptance Criteria
- [x] @rune-pro/product PACK.md is 750+ lines with 6 enriched skills
- [x] @rune-pro/sales PACK.md is 650+ lines with 6 enriched skills
- [x] Every skill has 6-8 workflow steps (not 4-5)
- [x] Every skill produces at least 1 output artifact
- [x] Every skill has at least 1 reusable template
- [x] At least 4 cross-pack calls exist (product↔sales bidirectional)
- [x] Business context integration (.rune/business/) documented in both packs
- [x] Sharp edges table has 5-7 rows per skill (up from 3-4)
- [x] Both packs exceed @rune/trading (597 lines) benchmark

## Files Touched
- `extensions/pro-product/PACK.md` — major rewrite (in rune-pro repo)
- `extensions/pro-sales/PACK.md` — major rewrite (in rune-pro repo)

## Dependencies
- None — enriching existing files
- Must be done in rune-kit/rune-pro private repo
