<p align="center">
  <img src="assets/banner.svg" alt="Rune — Skill Mesh for AI Coding Assistants" width="100%">
</p>

<p align="center">
  <strong>Less skills. Deeper connections.</strong><br>
  A lean, interconnected skill ecosystem for AI coding assistants.<br>
  59 skills · 200+ mesh connections · 8 platforms · MIT
</p>

<p align="center">
  <a href="https://rune-kit.github.io/rune"><img src="https://img.shields.io/badge/Landing_Page-rune--kit.github.io-blue?style=for-the-badge" alt="Landing Page"></a>
  <a href="https://rune-kit.github.io/rune#pricing"><img src="https://img.shields.io/badge/Pro_%2449-lifetime-blueviolet?style=for-the-badge" alt="Rune Pro $49"></a>
  <a href="https://rune-kit.github.io/rune#pricing"><img src="https://img.shields.io/badge/Business_%24149-lifetime-orange?style=for-the-badge" alt="Rune Business $149"></a>
</p>

<p align="center">
  <strong>Claude Code</strong> (native plugin) · <strong>Cursor</strong> · <strong>Windsurf</strong> · <strong>Google Antigravity</strong> · <strong>OpenAI Codex</strong> · <strong>OpenCode</strong> · any AI IDE
</p>

## Why Rune?

Most skill ecosystems are either **too many isolated skills** (540+ that don't talk to each other) or **rigid pipelines** (A → B → C, if B fails everything stops).

Rune is a **mesh** — 59 skills with 200+ connections across a 5-layer architecture. Skills call each other bidirectionally, forming resilient workflows that adapt when things go wrong.

```
Pipeline:  A → B → C → D         (B fails = stuck)
Hub-Spoke: A → HUB → C           (HUB fails = stuck)
Mesh:      A ↔ B ↔ C             (B fails = A reaches C via D→E)
           ↕       ↕
           D ↔ E ↔ F
```

## What's New (v2.3.3)

- **UI/UX Pro Max Integration** — 161 palettes, 84 styles, 73 font pairings, 161 reasoning rules from [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, 42.8k★) meshed into `design` skill + `@rune/ui` pack
- **11 Core Skill Enrichments** — deviation rules, repair operators, evidence quality gate, decision classification, debug knowledge base, CSO discipline, YAGNI pushback, formal pause/resume
- **Enforcement Upgrade** — Antigravity-level IDE compliance: 5-type Request Classifier, File Ownership Matrix, Self-Verification HARD-GATE, Routing Proof, Clarification Gate, Phase Transition Protocol
- **All 14 Free Packs Deep** — every L4 extension pack now exceeds 500 lines of production-ready patterns and code examples
- **8 Platform Adapters** — Claude Code, Cursor, Windsurf, Google Antigravity, OpenAI Codex, OpenCode, OpenClaw, Generic
- **59 Core Skills** — +4 since v2.1.0: adversary, sentinel-env, chrome-ext pack, context-pack
- **Rune Pro** — 4 premium packs (product, sales, data-science, support) in private repo. $49 lifetime

## What Rune Is (and Isn't)

Rune started as a **Claude Code plugin** and now compiles to **every major AI IDE**. Same 59 skills, same mesh connections, same workflows — zero knowledge loss across platforms.

| | Rune Provides | Claude Code Provides |
|---|---|---|
| **Workflows** | 8-phase TDD cycle (cook), parallel DAG execution (team), rescue pipelines | Basic tool calling |
| **Quality Gates** | preflight + sentinel + review + completion-gate (parallel) | None built-in |
| **Domain Knowledge** | 14 extension packs (trading, SaaS, mobile, etc.) | General-purpose |
| **Cross-Session State** | .rune/ directory (decisions, conventions, progress) | Conversation only |
| **Mesh Resilience** | 200+ skill connections, fail-loud-route-around | Linear execution |
| **Cost Optimization** | Auto model selection (haiku/sonnet/opus per task) | Single model |
| | | |
| **Sandbox & Permissions** | — | Claude Code handles this |
| **Agent Spawning** | — | Claude Code's Task/Agent system |
| **MCP Integration** | — | Claude Code's MCP protocol |
| **File System Access** | — | Claude Code's tool permissions |

### Common Misconceptions

| "Rune doesn't have..." | Reality |
|---|---|
| Task graph / DAG | `team` skill: DAG decomposition → parallel worktree agents → merge coordination |
| CI quality gates | `verification` skill: lint + typecheck + tests + build (actual commands, not LLM review) |
| Memory / state | `session-bridge` + `journal`: cross-session decisions, conventions, ADRs, module health |
| Multi-model strategy | Every skill has assigned model: haiku (scan), sonnet (code), opus (architecture) |
| Agent specialization | 58 specialized skills with dedicated roles (architect, coder, reviewer, scanner, researcher, BA, scaffolder) — each runs as a Task agent via Claude Code |
| Security scanning | `sentinel`: OWASP patterns, secret scanning, dependency audit. `sast`: static analysis |

## Install

### Claude Code (Native Plugin)

```bash
# Install via Claude Code CLI
claude plugin add rune-kit/rune
```

Or add manually in `~/.claude/settings.json` under `installed_plugins`.

Full mesh: subagents, hooks, adaptive routing, mesh analytics.

### Cursor / Windsurf / Antigravity / Any IDE

```bash
# Compile Rune skills for your platform
npx @rune-kit/rune init

# Or specify platform explicitly
npx @rune-kit/rune init --platform cursor
npx @rune-kit/rune init --platform windsurf
npx @rune-kit/rune init --platform antigravity
```

This compiles all 59 skills into your IDE's rules format. Same knowledge, same workflows.

### Platform Comparison

| Feature | Claude Code | Cursor / Windsurf / Others |
|---------|-------------|---------------------------|
| Skills available | 59/59 | 59/59 |
| Mesh connections | 200+ (programmatic) | 200+ (rule references) |
| Workflows & HARD-GATEs | Full | Full |
| Extension packs | 14 | 14 |
| Subagent parallelism | Native | Sequential fallback |
| Lifecycle hooks | 8 hooks (JS runtime) | Inline MUST/NEVER constraints |
| Adaptive model routing | haiku/sonnet/opus | Single model |
| Mesh analytics | Real-time metrics | Not available |

**Same power, different delivery.** Claude Code gets execution efficiency; other IDEs get the same knowledge and workflows.

## Quick Start

```bash
# Onboard any project (generates CLAUDE.md + .rune/ context)
/rune onboard

# Build a feature (full TDD cycle)
/rune cook "add user authentication with JWT"

# Debug an issue
/rune debug "login returns 401 for valid credentials"

# Security scan before commit
/rune sentinel

# Refactor legacy code safely
/rune rescue

# Full project health audit
/rune audit

# Respond to a production incident
/rune incident "login service returning 503 for 30% of users"

# Generate design system before building UI
/rune design "trading dashboard with real-time data"

# Bootstrap a new project from scratch (v2.1.0)
/rune scaffold "REST API with auth, payments, and Docker"

# Deep requirement analysis before building
/rune ba "integrate Telegram bot with trading signals"

# Auto-generate project documentation
/rune docs init

# Build an MCP server
/rune mcp-builder "weather API with forecast tools"
```

## Architecture

### 5-Layer Model

```
╔══════════════════════════════════════════════════════╗
║  L0: ROUTER (1)                                      ║
║  Meta-enforcement — routes every action               ║
║  skill-router                                         ║
╠══════════════════════════════════════════════════════╣
║  L1: ORCHESTRATORS (5)                                ║
║  Full lifecycle workflows                             ║
║  cook │ team │ launch │ rescue │ scaffold             ║
╠══════════════════════════════════════════════════════╣
║  L2: WORKFLOW HUBS (28)                               ║
║  Cross-hub mesh — the key differentiator              ║
║                                                        ║
║  Creation:    plan │ scout │ brainstorm │ design │     ║
║               skill-forge │ ba │ mcp-builder           ║
║  Development: debug │ fix │ test │ review │ db         ║
║  Quality:     sentinel │ preflight │ onboard │         ║
║               audit │ perf │ review-intake │           ║
║               logic-guardian                            ║
║  Delivery:    deploy │ marketing │ incident │ docs     ║
║  Rescue:      autopsy │ safeguard │ surgeon            ║
║  Security:    adversary                                ║
╠══════════════════════════════════════════════════════╣
║  L3: UTILITIES (26)                                   ║
║  Stateless, pure capabilities                         ║
║                                                        ║
║  Knowledge:   research │ docs-seeker │ trend-scout     ║
║  Reasoning:   problem-solver │ sequential-thinking     ║
║  Validation:  verification │ hallucination-guard │     ║
║               completion-gate │ constraint-check │     ║
║               sast │ integrity-check                   ║
║  State:       context-engine │ journal │               ║
║               session-bridge                           ║
║  Monitoring:  watchdog │ scope-guard                   ║
║  Media:       browser-pilot │ asset-creator │          ║
║               video-creator                            ║
║  Deps:        dependency-doctor                        ║
║  Workspace:   worktree                                 ║
║  Git:         git                                      ║
║  Documents:   doc-processor                            ║
║  Security:    sentinel-env                             ║
║  Memory:      neural-memory                            ║
╠══════════════════════════════════════════════════════╣
║  L4: EXTENSION PACKS (14)                             ║
║  Domain-specific, install what you need                ║
║                                                        ║
║  @rune/ui │ @rune/backend │ @rune/devops │            ║
║  @rune/mobile │ @rune/security │ @rune/trading │      ║
║  @rune/saas │ @rune/ecommerce │ @rune/ai-ml │        ║
║  @rune/gamedev │ @rune/content │ @rune/analytics │    ║
║  @rune/chrome-ext │ @rune/zalo                         ║
╚══════════════════════════════════════════════════════╝
```

### Layer Rules

| Layer | Can Call | Called By | State |
|-------|---------|----------|-------|
| L0 Router | L1-L3 (routing) | Every message | Stateless |
| L1 Orchestrators | L2, L3 | L0, User | Stateful (workflow) |
| L2 Workflow Hubs | L2 (cross-hub), L3 | L1, L2 | Stateful (task) |
| L3 Utilities | Nothing (pure)* | L1, L2 | Stateless |
| L4 Extensions | L3 | L2 (domain match) | Config-based |

\*L3→L3 exceptions: `context-engine`→`session-bridge`, `hallucination-guard`→`research`, `session-bridge`→`integrity-check`

### Cost Intelligence

Every skill has an auto-selected model for optimal cost:

| Task Type | Model | Cost |
|-----------|-------|------|
| Scan, search, validate | Haiku | Cheapest |
| Write code, fix bugs, review | Sonnet | Default |
| Architecture, security audit | Opus | Deep reasoning |

Typical feature: ~$0.05-0.15 (vs ~$0.60 all-opus).

## Key Workflows

### `/rune cook` — Build a Feature

```
Phase 0 RESUME     → detect existing .rune/plan-*.md, load active phase
Phase 1 UNDERSTAND → scout scans codebase, ba elicits requirements
Phase 2 PLAN       → plan creates master plan + phase files
Phase 3 TEST       → test writes failing tests (TDD red)
Phase 4 IMPLEMENT  → fix writes code (TDD green)
Phase 5 QUALITY    → preflight + sentinel + review (parallel)
Phase 6 VERIFY     → verification + hallucination-guard
Phase 7 COMMIT     → git creates semantic commit
Phase 8 BRIDGE     → session-bridge saves state, announce next phase
```

Multi-session: Phase 0 detects existing plans and resumes from the current phase. One phase per session = small context = better code.

### `/rune rescue` — Refactor Legacy Code

```
Phase 0 RECON      → autopsy assesses damage (health score)
Phase 1 SAFETY NET → safeguard writes characterization tests
Phase 2-N SURGERY  → surgeon refactors 1 module per session
Phase N+1 CLEANUP  → remove @legacy markers
Phase N+2 VERIFY   → health score comparison (before vs after)
```

### `/rune launch` — Deploy + Market

```
Phase 1 PRE-FLIGHT → full test suite
Phase 2 DEPLOY     → push to platform
Phase 3 VERIFY     → live site checks + monitoring
Phase 4 MARKET     → landing copy, social, SEO
Phase 5 ANNOUNCE   → publish content
```

## Mesh Resilience

If a skill fails, the mesh adapts:

| If this fails... | Rune tries... |
|---|---|
| debug can't find cause | problem-solver (different reasoning) |
| docs-seeker can't find docs | research (broader web search) |
| scout can't find files | research + docs-seeker |
| test can't run | deploy fix env, then test again |

Loop prevention: max 2 visits per skill, max chain depth 8.

## Cross-Session Persistence

Rune preserves context across sessions via `.rune/`:

```
.rune/
├── decisions.md     — architectural decisions log
├── conventions.md   — established patterns & style
├── progress.md      — task progress tracker
└── session-log.md   — brief session history
```

Every new session loads `.rune/` automatically — zero context loss.

## Extension Packs

Domain-specific skills that plug into the core mesh:

| Pack | Skills | For |
|------|--------|-----|
| @rune/ui | design-system, components, a11y, animation | Frontend |
| @rune/backend | api, auth, database, middleware | Backend |
| @rune/devops | docker, ci-cd, monitoring, server, ssl | DevOps |
| @rune/mobile | react-native, flutter, app-store, native | Mobile |
| @rune/security | owasp, pentest, secrets, compliance | Security |
| @rune/trading | fintech, realtime, charts, indicators | Fintech |
| @rune/saas | multi-tenant, billing, subscription, onboarding | SaaS |
| @rune/ecommerce | shopify, payment, cart, inventory | E-commerce |
| @rune/ai-ml | llm, rag, embeddings, fine-tuning | AI/ML |
| @rune/gamedev | threejs, webgl, game-loops, physics | Games |
| @rune/content | blog, cms, mdx, i18n, seo | Content |
| @rune/analytics | tracking, a/b testing, funnels, dashboards | Growth |

### Rune Pro (Premium)

Business department packs for product, sales, and data teams. Same PACK.md format, plugs into the core mesh.

| Pack | Skills | For |
|------|--------|-----|
| @rune-pro/product | feature-spec, roadmap, metrics, release-comms, user-research, competitive | Product Management |
| @rune-pro/sales | account-research, call-prep, outreach, pipeline-review, competitive-intel | Sales Enablement |
| @rune-pro/data-science | data-exploration, sql-advanced, visualization, statistical-testing, dashboards | Data Science |
| @rune-pro/support | ticket-triage, response-drafting, knowledge-base, escalation, faq, metrics | Customer Support |

**$49 lifetime** — [rune-kit/rune-pro](https://github.com/rune-kit/rune-pro)

### Rune Business (Enterprise)

Department packs for finance, legal, HR, and cross-system search. Requires Rune Free core.

| Pack | Skills | For |
|------|--------|-----|
| @rune-business/finance | budget-planning, expense-analysis, revenue-forecasting, financial-reporting, compliance, invoicing, cash-flow | Finance Ops |
| @rune-business/legal | contract-review, compliance-check, policy-generator, nda-triage, ip-protection, incident-legal | Legal & Compliance |
| @rune-business/hr | jd-writer, resume-screener, interview-planner, scorecard, onboarding, comp-benchmarker, policy-writer | HR & Recruiting |
| @rune-business/enterprise-search | query-planner, source-connector, result-merger, permission-guard, knowledge-graph, search-analytics | Knowledge Retrieval |

**$149 lifetime** — [rune-kit/rune-business](https://github.com/rune-kit/rune-business)

## Multi-Platform Compiler

Rune includes a 3-stage compiler that transforms SKILL.md files into platform-native rule formats:

```
skills/*.md → PARSE → TRANSFORM → EMIT → platform rules
```

**8 transforms applied per platform:**
1. Frontmatter: strip Claude Code-specific directives
2. Cross-references: `rune:cook` → `@rune-cook.mdc` (Cursor) / prose ref (Windsurf)
3. Tool names: `Read`, `Edit`, `Bash` → generic language
4. Subagents: parallel → sequential workflow
5. Compliance: inject enforcement preamble (non-Claude platforms)
6. Hooks: runtime hooks → inline MUST/NEVER constraints
7. Branding: Rune attribution footer

```bash
# Build for any platform
npx @rune-kit/rune build --platform cursor
npx @rune-kit/rune build --platform windsurf

# Validate compiled output
npx @rune-kit/rune doctor
```

See [docs/MULTI-PLATFORM.md](docs/MULTI-PLATFORM.md) for the full architecture.

## Numbers

```
Core Skills:       59 (L0: 1 │ L1: 5 │ L2: 28 │ L3: 26)
Extension Packs:   14 free + 4 pro + 4 business
Mesh Connections:  200+ cross-references
Connections/Skill: 3.4 avg
Platforms:         8 (Claude Code, Cursor, Windsurf, Antigravity, Codex, OpenCode, OpenClaw, Generic)
Compiler:          ~1400 LOC (parser + 8 transforms + 8 adapters + CLI)
Quality:           59/59 skills with Output Format, Sharp Edges, Done When, Cost Profile
Pack Depth:        22 packs total (14 free + 4 pro + 4 business, all free packs rated Deep)
```

## Acknowledgments

- **[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** (MIT, 42.8k★) — Design intelligence databases powering Rune's `design` skill and `@rune/ui` pack: 161 color palettes, 84 UI styles, 73 font pairings, 99 UX guidelines, 161 industry reasoning rules.

## License

MIT
