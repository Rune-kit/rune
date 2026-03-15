# Phase 3: Business Tier Packs ($149)

## Goal
Build 5 Business-tier packs (finance, legal, hr, operations, enterprise-search) at 700+ lines each. Business packs differentiate from Pro with: compliance/regulatory patterns, multi-stakeholder approval workflows, enterprise tool output formats (Jira, Linear, Notion), and deeper cross-pack orchestration.

## Strategy: Build 2, Validate, Then 3

Don't build all 5 blindly. Ship finance + legal first (highest perceived enterprise value), validate demand signals, then build hr + operations + enterprise-search.

| Priority | Pack | Why First |
|----------|------|-----------|
| 1st | @rune-pro/finance | Every company has finance ops — universal demand |
| 2nd | @rune-pro/legal | Compliance is painful and high-stakes — willingness to pay |
| 3rd | @rune-pro/hr | Build after validating finance + legal traction |
| 4th | @rune-pro/operations | Build after validating finance + legal traction |
| 5th | @rune-pro/enterprise-search | Most complex (MCP connectors) — build last |

## Tasks

### @rune-pro/finance (NEW — 750+ lines, 7 skills)

- [ ] Task 1 — Create `budget-planning` skill
  - 8 steps: gather cost categories → historical analysis → project growth rates → draft budget → variance thresholds → approval workflow → quarterly review cadence → export format
  - Output artifact: `.rune/finance/budget-<period>.md`
  - Template: `BUDGET-TEMPLATE.md` (line items, actuals, forecast, variance, notes)
  - Business context: reads `.rune/business/context.md` for fiscal year, cost centers

- [ ] Task 2 — Create `expense-analysis` skill
  - 7 steps: categorize expenses → trend analysis → anomaly detection → vendor comparison → optimization recommendations → policy compliance check → report generation
  - Output artifact: `.rune/finance/expense-report-<period>.md`
  - Template: `EXPENSE-REPORT-TEMPLATE.md` (categories, trends, anomalies, recommendations)

- [ ] Task 3 — Create `revenue-forecasting` skill
  - 8 steps: identify revenue streams → historical data analysis → seasonality detection → growth model selection → scenario modeling (optimistic/base/pessimistic) → confidence intervals → sensitivity analysis → executive summary
  - Output artifact: `.rune/finance/forecast-<period>.md`
  - Cross-pack: pulls pipeline data from `@rune-pro/sales.pipeline-review`

- [ ] Task 4 — Create `financial-reporting` skill
  - 7 steps: determine report type (P&L, balance sheet, cash flow, board deck) → gather data sources → calculate metrics → format per audience (executive vs detailed) → add commentary → compliance check → export
  - Output artifact: `reports/financial/<type>-<period>.md`
  - Template: `P&L-TEMPLATE.md`, `BOARD-DECK-TEMPLATE.md`
  - Multi-stakeholder: different views for CEO, CFO, board, investors

- [ ] Task 5 — Create `compliance-reporting` skill
  - 8 steps: identify applicable regulations (SOX, GAAP, IFRS) → map requirements to data → gather evidence → draft report → internal review checklist → auditor-ready formatting → gap analysis → remediation plan
  - Output artifact: `.rune/finance/compliance/<regulation>-<period>.md`
  - Template: `COMPLIANCE-CHECKLIST-TEMPLATE.md` (requirement, evidence, status, gap, remediation)
  - Sharp edges: regulatory deadlines, missing documentation, control failures

- [ ] Task 6 — Create `invoice-management` skill
  - 6 steps: detect invoice format → extract key fields → validate against PO/contract → flag discrepancies → aging analysis → payment prioritization
  - Output artifact: `.rune/finance/invoices/summary-<period>.md`
  - Template: `INVOICE-REVIEW-TEMPLATE.md`

- [ ] Task 7 — Create `cash-flow-optimization` skill
  - 7 steps: map cash inflows/outflows → identify timing mismatches → model scenarios → working capital analysis → recommend payment timing → vendor term negotiation talking points → runway calculation
  - Output artifact: `.rune/finance/cash-flow-<period>.md`
  - Cross-pack: feeds runway data to `@rune-pro/product.roadmap` for resource planning

- [ ] Task 8 — Pack-level structure (750+ lines target)

### @rune-pro/legal (NEW — 700+ lines, 6 skills)

- [ ] Task 9 — Create `contract-review` skill
  - 8 steps: identify contract type → extract key terms → flag non-standard clauses → check against company playbook → liability assessment → IP/confidentiality analysis → redline suggestions → summary for stakeholder
  - Output artifact: `.rune/legal/reviews/<contract-name>.md`
  - Template: `CONTRACT-REVIEW-TEMPLATE.md` (parties, term, key clauses, flags, recommendations)
  - Business context: reads `.rune/business/processes.md` for approval thresholds

- [ ] Task 10 — Create `compliance-check` skill
  - 8 steps: identify applicable regulations (GDPR, CCPA, SOC2, HIPAA) → map data flows → check consent mechanisms → review data retention → audit access controls → privacy impact assessment → gap report → remediation priorities
  - Output artifact: `.rune/legal/compliance/<regulation>.md`
  - Template: `COMPLIANCE-GAP-TEMPLATE.md` (requirement, current state, gap, risk level, remediation)
  - Cross-pack: coordinates with `@rune-pro/finance.compliance-reporting` for SOX overlap

- [ ] Task 11 — Create `policy-generator` skill
  - 7 steps: identify policy need → research requirements → draft policy → add definitions section → review against industry standards → stakeholder review routing → version control
  - Output artifact: `docs/policies/<policy-name>.md`
  - Template: `POLICY-TEMPLATE.md` (purpose, scope, definitions, policy statements, enforcement, review date)
  - Key policies: privacy, acceptable use, data retention, incident response, vendor management

- [ ] Task 12 — Create `nda-triage` skill
  - 6 steps: classify NDA type (mutual/unilateral) → extract key terms → check against standard template → flag deviations → risk assessment → recommend accept/negotiate/reject
  - Output artifact: `.rune/legal/nda/<counterparty>.md`
  - Template: `NDA-REVIEW-TEMPLATE.md`

- [ ] Task 13 — Create `ip-protection` skill
  - 7 steps: audit codebase licenses → check OSS compliance → review contributor agreements → trademark usage scan → patent landscape (if applicable) → export control check → recommendation report
  - Output artifact: `.rune/legal/ip/audit-<date>.md`
  - Cross-pack: uses `sentinel` (L2 free) for license scanning in dependencies

- [ ] Task 14 — Create `incident-legal` skill
  - 7 steps: assess legal exposure → notification requirements (breach notification laws) → evidence preservation → stakeholder communication (legal-reviewed) → regulatory filing requirements → insurance claim preparation → lessons learned
  - Output artifact: `.rune/legal/incidents/<id>.md`
  - Cross-pack: coordinates with `incident` (L2 free) for technical response, `@rune-pro/support.escalation-management` for customer comms

- [ ] Task 15 — Pack-level structure (700+ lines target)

### @rune-pro/hr (NEW — 700+ lines, 6 skills) — Build after validation

- [ ] Task 16 — Create `job-description` skill (7 steps: role analysis → requirements → inclusive language check → compensation benchmarking → posting optimization → multi-platform format → track applicants)
- [ ] Task 17 — Create `interview-guide` skill (7 steps: competency mapping → question bank → scoring rubric → panel assignment → debrief template → bias check → decision framework)
- [ ] Task 18 — Create `onboarding-plan` skill (7 steps: role-specific checklist → 30/60/90 plan → buddy assignment → training schedule → tool access → milestone check-ins → feedback loop)
- [ ] Task 19 — Create `performance-review` skill (7 steps: goal review → evidence gathering → self-assessment guide → manager assessment → calibration prep → development plan → compensation input)
- [ ] Task 20 — Create `team-health` skill (6 steps: engagement signals → retention risk → skill gap analysis → succession planning → culture metrics → action recommendations)
- [ ] Task 21 — Create `policy-handbook` skill (6 steps: audit existing policies → gap analysis → draft new policies → legal review routing → employee communication → acknowledgment tracking)
- [ ] Task 22 — Pack-level structure (700+ lines target)

### @rune-pro/operations (NEW — 700+ lines, 6 skills) — Build after validation

- [ ] Task 23 — Create `process-mapping` skill (7 steps: identify process → map current state → measure cycle time → identify bottlenecks → design future state → implementation plan → measurement framework)
- [ ] Task 24 — Create `sop-generator` skill (7 steps: observe process → document steps → add decision points → include quality checks → format for audience → review cycle → version control)
- [ ] Task 25 — Create `vendor-management` skill (7 steps: vendor evaluation matrix → contract terms review → SLA monitoring → risk assessment → renewal planning → consolidation opportunities → relationship health)
- [ ] Task 26 — Create `change-management` skill (7 steps: impact assessment → stakeholder mapping → communication plan → training needs → resistance mitigation → rollout schedule → success metrics)
- [ ] Task 27 — Create `capacity-planning` skill (7 steps: demand forecasting → resource inventory → gap analysis → hiring vs outsourcing → budget impact → timeline → contingency planning)
- [ ] Task 28 — Create `okr-tracking` skill (7 steps: OKR drafting → alignment check → progress tracking → check-in cadence → scoring methodology → retrospective → next cycle planning)
- [ ] Task 29 — Pack-level structure (700+ lines target)

### @rune-pro/enterprise-search (NEW — 700+ lines, 5 skills) — Build last

- [ ] Task 30 — Create `unified-search` skill (8 steps: identify knowledge sources → configure MCP connectors → build search index → implement ranking → add filters → handle permissions → cache strategy → monitor usage)
- [ ] Task 31 — Create `knowledge-graph` skill (7 steps: extract entities → map relationships → build graph → query patterns → visualization → gap detection → maintenance)
- [ ] Task 32 — Create `doc-indexer` skill (6 steps: crawl sources → extract content → chunk + embed → index → freshness monitoring → dedup)
- [ ] Task 33 — Create `context-assembler` skill (6 steps: understand query → retrieve from multiple sources → rank relevance → assemble context → cite sources → format for AI consumption)
- [ ] Task 34 — Create `search-analytics` skill (6 steps: track queries → identify gaps → measure satisfaction → suggest content → report trends → optimize ranking)
- [ ] Task 35 — Pack-level structure (700+ lines target)

## Acceptance Criteria
- [ ] finance + legal packs shipped first (700+ lines each)
- [ ] Validation gate: ≥5 paying users or strong demand signals before building hr + operations + enterprise-search
- [ ] Every Business skill has 7-9 workflow steps
- [ ] Every Business skill produces output artifacts
- [ ] Multi-stakeholder workflows present in ≥3 packs (approval chains, sign-off gates)
- [ ] Compliance/regulatory patterns in finance + legal
- [ ] Enterprise tool output formats documented (Jira, Linear, Notion where applicable)
- [ ] Cross-pack orchestration: finance↔legal (SOX/compliance), finance↔sales (revenue), legal↔support (incidents)

## Files Touched
- `extensions/pro-finance/PACK.md` — new (rune-pro repo)
- `extensions/pro-legal/PACK.md` — new (rune-pro repo)
- `extensions/pro-hr/PACK.md` — new (rune-pro repo, after validation)
- `extensions/pro-operations/PACK.md` — new (rune-pro repo, after validation)
- `extensions/pro-enterprise-search/PACK.md` — new (rune-pro repo, after validation)

## Dependencies
- Phase 1-2 completed (depth standard established, cross-pack protocol proven)
- Validation gate between finance+legal and hr+operations+enterprise-search
- enterprise-search requires MCP connector documentation (references to community MCP servers)
