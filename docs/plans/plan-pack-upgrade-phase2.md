# Phase 2: New Pro + Free Packs (data-science, support, chrome-ext)

## Goal
Build 2 new Pro packs (@rune-pro/data-science, @rune-pro/support) at the enriched depth standard (650+ lines), plus 1 new FREE L4 pack (@rune/chrome-ext at 500+ lines) as a unique market differentiator.

## Tasks

### @rune-pro/data-science (NEW — 700+ lines, 7 skills)

- [x] Task 1 — Create `data-exploration` skill
  - 7 steps: detect data source → profile schema → statistical summary → distribution analysis → correlation matrix → outlier detection → cleaning recommendation
  - Output artifact: `.rune/data/exploration-<dataset>.md` (schema, stats, issues, recommendations)
  - Template: `DATA-PROFILE-TEMPLATE.md`
  - Tools: Read, Bash (pandas/polars), Grep

- [x] Task 2 — Create `sql-advanced` skill
  - 7 steps: understand question → identify tables → draft query → optimize (explain plan) → add CTEs for readability → handle edge cases → document query
  - Output artifact: `queries/<name>.sql` with header comments
  - Template: `QUERY-TEMPLATE.sql` (header: purpose, tables, filters, expected output)
  - Extends free @rune/analytics.sql-patterns with: recursive CTEs, lateral joins, window function composition, query plan optimization

- [x] Task 3 — Create `visualization` skill
  - 7 steps: identify data story → select chart type (decision tree from 25+ types) → choose library → implement → style (accessibility: colorblind, high contrast) → add interactivity → responsive layout
  - Output artifact: chart component file + `.rune/data/viz-spec.md`
  - Template: `CHART-DECISION-TREE.md` (data shape → recommended chart type mapping, inspired by AgentUp's 25 chart types)
  - Cross-pack: uses `@rune/ui` for styling tokens

- [x] Task 4 — Create `statistical-testing` skill
  - 8 steps: define hypothesis → check assumptions (normality, variance) → select test → calculate test statistic → compute p-value → effect size → confidence interval → interpret and report
  - Output artifact: `.rune/data/stat-test-<name>.md`
  - Template: `HYPOTHESIS-TEST-TEMPLATE.md` (H0, H1, test, α, result, interpretation)
  - Extends free @rune/analytics.statistical-analysis with: power analysis, Bayesian inference, multiple comparison correction

- [x] Task 5 — Create `dashboard-building` skill
  - 8 steps: identify audience → select KPIs → layout wireframe → data source mapping → implement components → add filters/drill-down → performance optimization (virtualization) → deploy spec
  - Output artifact: `.rune/data/dashboard-spec.md` + component stubs
  - Template: `DASHBOARD-SPEC-TEMPLATE.md` (audience, KPIs, layout, data sources, refresh cadence)
  - Cross-pack: receives KPI definitions from `@rune-pro/product.metrics-tracking`

- [x] Task 6 — Create `data-pipeline` skill
  - 7 steps: map data flow → identify sources/sinks → define transformations → add quality gates → implement idempotent loads → add monitoring/alerting → document lineage
  - Output artifact: `.rune/data/pipeline-<name>.md` + pipeline code stubs
  - Template: `PIPELINE-SPEC-TEMPLATE.md` (source, transformations, destination, SLA, quality checks)

- [x] Task 7 — Create `ml-evaluation` skill
  - 7 steps: define evaluation criteria → split strategy → baseline model → metric selection (per task type) → cross-validation → error analysis → A/B lift estimation
  - Output artifact: `.rune/data/ml-eval-<model>.md`
  - Template: `ML-EVAL-TEMPLATE.md` (model, metrics, baseline, results, recommendation)
  - Cross-pack: feeds results to `@rune-pro/product.metrics-tracking`

- [x] Task 8 — Pack-level structure
  - Purpose, Triggers, Connections, Tech Stack, Constraints, Sharp Edges, Done When, Cost Profile
  - Cross-pack orchestration: data-science↔product (metrics), data-science↔sales (pipeline analytics)
  - Business context: reads `.rune/business/context.md` for company-specific metric definitions

### @rune-pro/support (NEW — 650+ lines, 6 skills)

- [x] Task 9 — Create `ticket-triage` skill
  - 7 steps: parse ticket → classify severity (P0-P4) → identify affected component → check known issues → suggest assignment → draft initial response → set SLA timer
  - Output artifact: `.rune/support/triage/<ticket-id>.md`
  - Template: `TRIAGE-TEMPLATE.md` (severity, component, assignee, SLA, initial response)
  - Business context: reads `.rune/business/processes.md` for escalation paths

- [x] Task 10 — Create `response-drafting` skill
  - 7 steps: understand issue → gather context (logs, docs, similar tickets) → draft response → tone check (empathetic, professional) → add resolution steps → include prevention advice → self-review
  - Output artifact: response text ready to paste
  - Template: `RESPONSE-TEMPLATE.md` (greeting, understanding, steps, prevention, closing)
  - Cross-pack: searches `@rune-pro/product` specs for feature context

- [x] Task 11 — Create `knowledge-base` skill
  - 7 steps: identify knowledge gap → draft article → structure (problem, cause, solution, prevention) → add search keywords → cross-link related articles → review for accuracy → publish spec
  - Output artifact: `docs/kb/<slug>.md`
  - Template: `KB-ARTICLE-TEMPLATE.md` (title, symptoms, cause, solution, prevention, related)

- [x] Task 12 — Create `escalation-management` skill
  - 6 steps: assess escalation criteria → document timeline → notify stakeholders → coordinate resolution → draft customer update → post-mortem
  - Output artifact: `.rune/support/escalations/<id>.md`
  - Template: `ESCALATION-TEMPLATE.md` (timeline, stakeholders, status, resolution, post-mortem)
  - Cross-pack: notifies `@rune-pro/product` of recurring issues for roadmap input

- [x] Task 13 — Create `faq-generator` skill
  - 6 steps: analyze ticket patterns → cluster common questions → draft Q&A pairs → validate against docs → format for target platform → review coverage
  - Output artifact: `docs/faq.md` or JSON for API
  - Template: `FAQ-TEMPLATE.md` (question, short answer, detailed answer, related articles)

- [x] Task 14 — Create `support-metrics` skill
  - 7 steps: define SLA targets → track response/resolution times → calculate CSAT/NPS trends → identify bottlenecks → suggest process improvements → generate weekly report → forecast capacity
  - Output artifact: `.rune/support/metrics/report-<date>.md`
  - Template: `SUPPORT-METRICS-TEMPLATE.md` (SLA compliance, CSAT, ticket volume, trends, recommendations)
  - Cross-pack: feeds to `@rune-pro/product.metrics-tracking` and `@rune-pro/data-science.dashboard-building`

- [x] Task 15 — Pack-level structure (same as Task 8 but for support)

### @rune/chrome-ext (NEW FREE — 500+ lines, 6 skills)

- [x] Task 16 — Create `mv3-scaffold` skill
  - 6 steps: detect project type (popup, sidebar, content-injector, background-only) → generate manifest.json (MV3) → scaffold service worker (top-level listeners, no in-memory state) → scaffold content script → scaffold popup/sidebar UI → generate .gitignore + dev config
  - Key patterns: no remote code, chrome.alarms instead of setTimeout, chrome.storage instead of variables
  - Tech stack options: React+Vite (CRXJS), vanilla TS, Svelte
  - Template: `MANIFEST-TEMPLATE.json` (minimal permissions, proper CSP)

- [x] Task 17 — Create `ext-messaging` skill
  - 6 steps: identify message flow (popup↔worker↔content) → define message types (TypeScript discriminated union) → implement sendMessage pattern → implement port-based streaming (for AI responses) → add error handling (Chrome 146+ rejection) → test messaging in dev
  - Key patterns: synchronous listener registration, long-lived connections, cross-frame communication

- [x] Task 18 — Create `ext-storage` skill
  - 5 steps: choose storage type (local/session/sync) → define storage schema → implement typed get/set helpers → add migration for schema changes → implement quota monitoring
  - Key patterns: never rely on service worker memory, storage.session for ephemeral state, 100KB sync limit

- [x] Task 19 — Create `cws-preflight` skill (highest value)
  - 8 steps: lint manifest for over-permissioning → check for remote code (eval, CDN, dynamic imports) → validate CSP → verify privacy policy exists → check assets (icon 128px, screenshots) → generate permission justifications → review description for policy violations → generate submission checklist
  - Output artifact: `.rune/chrome-ext/preflight-report.md`
  - Key insight: 58% of CWS rejections are preventable compliance errors — this skill catches them all
  - Sharp edges: `<all_urls>` = auto-flag, `tabs` + `history` combo = manual review trigger, new dev account + sensitive permissions = weeks of delay

- [x] Task 20 — Create `cws-publish` skill
  - 7 steps: verify preflight passed → prepare store listing copy → generate screenshots description → fill permission justifications → choose visibility (public/unlisted) → submit via dashboard guide → post-submission monitoring (approval timeline expectations)
  - Output artifact: `.rune/chrome-ext/store-listing.md`
  - Template: `STORE-LISTING-TEMPLATE.md` (name, short desc, long desc, category, permissions justification)
  - Tips: don't submit Fridays, use optional_permissions for non-critical features, escalation path for >3 week reviews

- [x] Task 21 — Create `ext-ai-integration` skill
  - 6 steps: detect AI integration type (Gemini Nano built-in vs external API) → check hardware requirements (Nano: 22GB disk, 4GB VRAM) → implement with graceful fallback → wire streaming via port messaging → handle quota/rate limits → test offline behavior
  - Key APIs: chrome.aiLanguageModel (Prompt), Summarizer, Writer, Rewriter, Translator, Language Detector
  - Manifest: `"permissions": ["aiLanguageModelParams"]`
  - Fallback pattern: try Nano → fall back to external API → fall back to static response

- [x] Task 22 — Pack-level structure
  - Purpose, Triggers (detect `manifest.json` with `manifest_version: 3`), Connections
  - Tech Stack: React+Vite+CRXJS, vanilla TS, Svelte options
  - Constraints: no eval(), no CDN, no inline scripts, minimal permissions, top-level listeners
  - Sharp edges: service worker termination (30s idle), no persistent state in JS variables, MV2→MV3 migration pitfalls
  - Cost Profile: ~2,000-3,500 tokens per skill activation

## Acceptance Criteria
- [x] @rune-pro/data-science is 700+ lines with 7 skills, each 7-8 steps
- [x] @rune-pro/support is 650+ lines with 6 skills, each 6-7 steps
- [x] @rune/chrome-ext is 500+ lines with 6 skills
- [x] Every Pro skill produces an output artifact
- [x] cws-preflight catches all top 5 CWS rejection reasons
- [x] Cross-pack calls documented: data-science↔product, support↔product
- [x] chrome-ext pack has no overlap with existing free packs

## Files Touched
- `extensions/pro-data-science/PACK.md` — new (in rune-pro repo)
- `extensions/pro-support/PACK.md` — new (in rune-pro repo)
- `extensions/chrome-ext/PACK.md` — new (in rune FREE repo)

## Dependencies
- Phase 1 completed (sets depth standard and cross-pack protocol)
- @rune/chrome-ext can be built independently (no Phase 1 dependency)
