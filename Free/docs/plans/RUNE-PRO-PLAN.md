# Rune Pro — Premium Extension Packs Plan

Status: IN PROGRESS | Created: 2025-03-10 | Updated: 2025-03-13

## Business Model

```
rune-kit/rune (FREE, MIT)    Rune Pro ($49 lifetime)     Rune Business ($149 lifetime)
┌──────────────────────┐     ┌──────────────────────┐    ┌──────────────────────┐
│ 55 dev skills        │     │ Everything Free +    │    │ Everything Pro +     │
│ 12 free L4 packs     │     │ Product Management   │    │ Finance ops          │
│ Full mesh + compiler │ ──► │ Sales Enablement     │ ──►│ Legal & Compliance   │
│ Multi-platform       │     │ Data Science         │    │ HR & Recruiting      │
│ Community + MIT      │     │ Customer Support     │    │ Enterprise Search    │
│                      │     │ Business memory      │    │ Custom skill forge   │
│                      │     │ MCP connectors       │    │ Priority support     │
│                      │     │ Future updates       │    │ Future updates       │
└──────────────────────┘     └──────────────────────┘    └──────────────────────┘
         FREE                      $49 once                    $149 once
```

### Why Lifetime (not Subscription)

Skills are static .md files — once user has the source, they can use forever.
Subscription creates false lock-in that feels unfair. Validated by ClaudeKit ($99 lifetime, 4K+ buyers).

- $49 = impulse buy territory, easy conversion
- $149 Business = enterprise users wanting full suite
- Rune gives 55 skills FREE → Pro is add-on, not full product → lower price than ClaudeKit ($99)
- Future MRR via Rune Cloud (hosted analytics, team metrics) — Phase 3+

## Brand

- Org: `rune-kit` (same GitHub org)
- Free: `rune-kit/rune` (current repo)
- Premium: `rune-kit/rune-pro` (separate repo, private until paid)
- Sub-brand: "Rune Pro" — not a separate brand, just premium tier
- npm: `@rune-pro/sales`, `@rune-pro/product`, etc.

## Technical Architecture

### How Pro packs connect to free Rune

Pro packs follow the same `PACK.md` format as free L4 extensions. When installed:

1. User runs `npx @rune-kit/rune init --pro` (or adds pro packs manually)
2. Pro packs install into `extensions/` alongside free packs
3. `cook` Phase 1.5 auto-detects them via the same trigger table
4. Pro skills can call free Rune skills (brainstorm, plan, research, etc.)
5. Free Rune skills NEVER require Pro packs — free works standalone

### Business Memory Layer

Pro packs need business context that free Rune doesn't track:

```
.rune/
├── business/
│   ├── people.md          — key stakeholders, roles, preferences
│   ├── glossary.md        — company-specific terminology
│   ├── processes.md       — business workflows and approval chains
│   └── context.md         — company info, product lines, market position
```

This extends `session-bridge` (L3) with a `business-context` sub-module.
Loaded at session start alongside technical context.

### Distribution

Option A: LemonSqueezy + license key (PRIMARY)
- User pays on LemonSqueezy checkout → receives license key automatically
- `npx @rune-kit/rune pro activate <key>` validates via LemonSqueezy API and installs
- Pros: proper licensing, built-in license keys, Merchant of Record (handles tax globally), **supports Vietnam sellers**
- Cons: 5% + $0.50 per transaction
- Why LemonSqueezy over Stripe: **Stripe is not available in Vietnam** (seller country restriction)

Option B: GitHub Sponsors + private repo access (SECONDARY)
- User sponsors → gets GitHub collaborator access → can clone/install
- Pros: zero infrastructure, GitHub handles payment, familiar for developers
- Cons: no license key, harder to revoke, less professional checkout UX

Option C: GitHub Marketplace (future)
- When Claude Code marketplace adds payment → native distribution
- Currently NOT available (no payment mechanism as of March 2025)

**Backup**: Gumroad (10% fee, works in VN, very simple setup)

**Recommendation**: LemonSqueezy as primary (license keys + tax handling + VN support), GitHub Sponsors as secondary for dev-first users. See `plan-pack-upgrade-phase4.md` for implementation details.

## Priority Packs (Phase 1)

### 1. @rune-pro/product — Product Management

**Why first**: Closest to developer workflow. PM + dev overlap is huge.

Sub-skills:
- `feature-spec` — Write structured PRDs from user stories
- `roadmap` — Prioritize features with ICE/RICE scoring
- `metrics-tracking` — Define and track product KPIs
- `stakeholder-comms` — Write status updates, release notes, changelogs
- `user-research-synthesis` — Summarize user feedback into actionable insights
- `competitive-analysis` — Compare features/pricing with competitors

Workflows:
- `/product write-spec` — generate feature specification
- `/product roadmap-update` — refresh roadmap with new priorities
- `/product metrics-review` — weekly KPI dashboard update
- `/product release-notes` — auto-generate from git log

Connections to free Rune:
- Calls `plan` for implementation planning after spec
- Calls `brainstorm` for feature ideation
- Calls `research` + `trend-scout` for competitive intel
- Called by `cook` when product context needed

### 2. @rune-pro/sales — Sales Enablement

**Why second**: Revenue-generating skill. Founders/startups need this.

Sub-skills:
- `account-research` — Research prospects using public data
- `call-preparation` — Generate talking points, objection handling
- `competitive-intel` — Track competitor pricing, features, positioning
- `outreach-drafting` — Cold email/LinkedIn sequences
- `pipeline-review` — Analyze deal pipeline, flag at-risk deals
- `daily-briefing` — Morning summary of key accounts and tasks

Workflows:
- `/sales call-prep <company>` — pre-call research brief
- `/sales outreach <prospect>` — draft outreach sequence
- `/sales pipeline-review` — weekly pipeline analysis
- `/sales competitive-update` — competitor intelligence update

Connections to free Rune:
- Calls `research` for prospect/company data
- Calls `marketing` for content alignment
- Calls `trend-scout` for market context

### 3. @rune-pro/data-science — Data Science & Analytics

**Why third**: Extends free @rune/analytics significantly.

Sub-skills:
- `data-exploration` — Profile datasets, detect patterns, suggest cleaning
- `sql-advanced` — Complex queries, CTEs, window functions, optimization
- `visualization` — Chart selection, layout, color encoding for data stories
- `statistical-testing` — Hypothesis testing, regression, significance analysis
- `dashboard-building` — Interactive dashboard architecture and implementation
- `data-pipeline` — ETL patterns, data quality gates, freshness monitoring
- `ml-evaluation` — Model performance metrics, A/B lift analysis

Workflows:
- `/data explore <dataset>` — profile and explore a dataset
- `/data query <question>` — translate natural language to SQL
- `/data dashboard <metrics>` — build analytics dashboard
- `/data significance <experiment>` — statistical significance analysis

Connections to free Rune:
- Extends `@rune/analytics` (free L4) with deeper capabilities
- Calls `plan` for dashboard architecture
- Calls `design` for visualization design tokens

## Tier Mapping

| Pack | Pro ($49) | Business ($149) |
|------|-----------|-----------------|
| @rune-pro/product | ✅ | ✅ |
| @rune-pro/sales | ✅ | ✅ |
| @rune-pro/data-science | ✅ | ✅ |
| @rune-pro/support | ✅ | ✅ |
| @rune-pro/finance | - | ✅ |
| @rune-pro/legal | - | ✅ |
| @rune-pro/hr | - | ✅ |
| @rune-pro/operations | - | ✅ |
| @rune-pro/enterprise-search | - | ✅ |
| Priority support | - | ✅ |
| Custom skill forge session | - | ✅ |

## Phase 2 Packs — Business tier (after Phase 1 validated)

### 4. @rune-pro/support — Customer Support
- Ticket triage, response drafting, escalation management
- Knowledge base maintenance, FAQ generation
- Connects to: research, marketing

### 5. @rune-pro/finance — Financial Operations
- Journal entries, reconciliation, variance analysis
- Connects to: @rune-pro/data-science for reporting

### 6. @rune-pro/legal — Legal & Compliance
- Contract review, NDA triage, compliance checking
- Connects to: sentinel (security), research

### 7. @rune-pro/hr — Human Resources
- Recruiting pipeline, onboarding checklists, performance reviews
- Connects to: @rune-pro/product for org planning

### 8. @rune-pro/operations — Business Operations
- Process optimization, vendor management, change management
- Connects to: plan, journal

### 9. @rune-pro/enterprise-search — Cross-Platform Search
- Unified search across Notion, Confluence, Slack, Drive
- Requires MCP connectors for each platform

## Connector Architecture (MCP)

Pro packs that interact with external tools need MCP server connectors:

| Category | Tools | MCP Server |
|----------|-------|------------|
| Chat | Slack, Teams | existing community MCP servers |
| Email | Gmail, Outlook | existing community MCP servers |
| CRM | Salesforce, HubSpot | needs custom or community MCP |
| Project | Linear, Jira, Asana | existing community MCP servers |
| Knowledge | Notion, Confluence | existing community MCP servers |

**Strategy**: Don't build MCP servers. Reference existing community servers in connector setup docs. Pro packs provide the SKILLS, users bring their own CONNECTORS.

## Success Metrics

### Phase 1 targets (first 3 months)
- 50+ GitHub stars on rune-pro
- 20+ paying users (sponsors or license keys)
- 3 Pro packs launched (product, sales, data-science)

### Validation signals (continue investing if)
- Users actually use Pro packs weekly (not just install)
- Feature requests come in for Pro skills (engagement signal)
- Word-of-mouth referrals (organic growth)

### Kill signals (stop if)
- < 10 paying users after 3 months
- No repeat usage after initial install
- Users can achieve the same with free tools + prompts

## Deep Upgrade Plan

Current Pro packs (product 455 lines, sales ~400 lines) are **thinner than best free packs** (trading 597, devops 520). Full upgrade plan: `plan-pack-upgrade.md` (master) + 4 phase files.

**Depth Standard**: Pro ≥650 lines, Business ≥700 lines, every skill produces output artifacts + templates.

| Phase | What | Status | Plan File |
|-------|------|--------|-----------|
| Phase 1 | Enrich product (1253 lines) + sales (889 lines) | ✅ Done | plan-pack-upgrade-phase1.md |
| Phase 2 | New: data-science, support (Pro) + chrome-ext (FREE) | ✅ Done | plan-pack-upgrade-phase2.md |
| Phase 3 | Business: finance (741), legal (733) → validate → hr, operations, enterprise-search | ✅ Done (finance+legal) | plan-pack-upgrade-phase3.md |
| Phase 4 | LemonSqueezy, @rune/ui enrichment, cross-pack protocol | ⬚ Pending | plan-pack-upgrade-phase4.md |

## Timeline

| Phase | What | When |
|-------|------|------|
| Phase 0 | Free Rune enhancements (design, marketing, plan, analytics) | ✅ Done |
| Phase 1a | @rune-pro/product pack (initial) | ✅ Done (PACK.md created) |
| Phase 1b | @rune-pro/sales pack (initial) | ✅ Done (PACK.md created) |
| **Upgrade Phase 1** | **Deep enrich product (1253 lines) + sales (889 lines)** | ✅ Done |
| **Upgrade Phase 2** | **New: data-science (1356), support (802), chrome-ext (995 FREE)** | ✅ Done |
| **Upgrade Phase 3** | **Business tier: finance (741) + legal (733)** | ✅ Done |
| **Upgrade Phase 4** | **Distribution (LemonSqueezy), UI enrichment, docs** | ⬚ After Phase 3 |
