# Rune

**Less skills. Deeper connections.**

A lean, interconnected skill ecosystem for AI coding assistants. 55 skills, 200+ mesh connections, full project lifecycle — from idea to production.

Works on **Claude Code** (native plugin) · **Cursor** · **Windsurf** · **Google Antigravity** · any AI IDE

## Why Rune?

Most skill ecosystems are either **too many isolated skills** (540+ that don't talk to each other) or **rigid pipelines** (A → B → C, if B fails everything stops).

Rune is a **mesh** — 55 skills with 200+ connections across a 5-layer architecture. Skills call each other bidirectionally, forming resilient workflows that adapt when things go wrong.

```
Pipeline:  A → B → C → D         (B fails = stuck)
Hub-Spoke: A → HUB → C           (HUB fails = stuck)
Mesh:      A ↔ B ↔ C             (B fails = A reaches C via D→E)
           ↕       ↕
           D ↔ E ↔ F
```

## What's New (v2.1.0)

- **Phase-Aware Execution** — cook v0.5.0 resumes multi-session plans automatically. Master plan + phase files = one phase per session, any model executes accurately
- **Amateur-Proof Plans** — plan v0.4.0 generates self-contained phase files with data flow diagrams, code contracts, failure scenarios, and rejection criteria. Designed so even the weakest model succeeds
- **Cognitive Bias Detection** — problem-solver v0.3.0 runs mandatory bias checks (12 biases) before every analysis. Reversibility Filter, Pre-Mortem, Weighted Matrix, MECE decomposition
- **Second-Order Thinking** — sequential-thinking v0.3.0 classifies decision reversibility, traces cascading effects, and cross-checks for anchoring/status-quo/overconfidence biases
- **6 New Skills** — ba (business analyst), scaffold (project bootstrap), docs (documentation lifecycle), git (semantic commits), mcp-builder (MCP server generator), doc-processor (PDF/DOCX/XLSX)
- **Multi-Platform Compiler** — all 55 skills compile to Cursor, Windsurf, Antigravity, and generic formats with zero knowledge loss

## What Rune Is (and Isn't)

Rune started as a **Claude Code plugin** and now compiles to **every major AI IDE**. Same 55 skills, same mesh connections, same workflows — zero knowledge loss across platforms.

| | Rune Provides | Claude Code Provides |
|---|---|---|
| **Workflows** | 8-phase TDD cycle (cook), parallel DAG execution (team), rescue pipelines | Basic tool calling |
| **Quality Gates** | preflight + sentinel + review + completion-gate (parallel) | None built-in |
| **Domain Knowledge** | 12 extension packs (trading, SaaS, mobile, etc.) | General-purpose |
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
| Agent specialization | 55 specialized skills with dedicated roles (architect, coder, reviewer, scanner, researcher, BA, scaffolder) — each runs as a Task agent via Claude Code |
| Security scanning | `sentinel`: OWASP patterns, secret scanning, dependency audit. `sast`: static analysis |

## Install

### Claude Code (Native Plugin)

```bash
# Via Claude Code plugin marketplace
/plugin marketplace add rune-kit/rune
/plugin install rune@rune-kit
```

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

This compiles all 55 skills into your IDE's rules format. Same knowledge, same workflows.

### Platform Comparison

| Feature | Claude Code | Cursor / Windsurf / Others |
|---------|-------------|---------------------------|
| Skills available | 55/55 | 55/55 |
| Mesh connections | 200+ (programmatic) | 200+ (rule references) |
| Workflows & HARD-GATEs | Full | Full |
| Extension packs | 12 | 12 |
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
║  L2: WORKFLOW HUBS (26)                               ║
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
╠══════════════════════════════════════════════════════╣
║  L3: UTILITIES (23)                                   ║
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
╠══════════════════════════════════════════════════════╣
║  L4: EXTENSION PACKS (12)                             ║
║  Domain-specific, install what you need                ║
║                                                        ║
║  @rune/ui │ @rune/backend │ @rune/devops │            ║
║  @rune/mobile │ @rune/security │ @rune/trading │      ║
║  @rune/saas │ @rune/ecommerce │ @rune/ai-ml │        ║
║  @rune/gamedev │ @rune/content │ @rune/analytics      ║
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

Coming soon. See [docs/plans/RUNE-PRO-PLAN.md](docs/plans/RUNE-PRO-PLAN.md) for the full roadmap.

## Multi-Platform Compiler

Rune includes a 3-stage compiler that transforms SKILL.md files into platform-native rule formats:

```
skills/*.md → PARSE → TRANSFORM → EMIT → platform rules
```

**6 transforms applied per platform:**
1. Cross-references: `rune:cook` → `@rune-cook.mdc` (Cursor) / prose ref (Windsurf)
2. Tool names: `Read`, `Edit`, `Bash` → generic language
3. Frontmatter: strip Claude Code-specific directives
4. Subagents: parallel → sequential workflow
5. Hooks: runtime hooks → inline MUST/NEVER constraints
6. Branding: Rune attribution footer

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
Core Skills:       55 (L0: 1 │ L1: 5 │ L2: 26 │ L3: 23)
Extension Packs:   12 free + 3 pro (coming soon)
Mesh Connections:  206 cross-references + 151 tool references
Connections/Skill: 3.7 avg
Platforms:         5 (Claude Code, Cursor, Windsurf, Antigravity, Generic)
Compiler:          ~1200 LOC (parser + transforms + adapters + CLI)
Quality:           55/55 skills with Output Format, Sharp Edges, Done When, Cost Profile
```

## License

MIT
