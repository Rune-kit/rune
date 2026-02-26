# Rune

**Less skills. Deeper connections.**

A lean, interconnected skill ecosystem for Claude Code that covers the full project lifecycle — from idea to revenue.

## Why Rune?

Most skill ecosystems are either **too many isolated skills** (540+ that don't talk to each other) or **rigid pipelines** (A → B → C, if B fails everything stops).

Rune is a **mesh** — 48 skills with 160+ connections across a 5-layer architecture. Skills call each other bidirectionally, forming resilient workflows that adapt when things go wrong.

```
Pipeline:  A → B → C → D         (B fails = stuck)
Hub-Spoke: A → HUB → C           (HUB fails = stuck)
Mesh:      A ↔ B ↔ C             (B fails = A reaches C via D→E)
           ↕       ↕
           D ↔ E ↔ F
```

## Install

```bash
# Via Claude Code plugin marketplace
/plugin marketplace add rune-kit/rune
/plugin install rune@rune-kit
```

Or clone directly:

```bash
git clone https://github.com/rune-kit/rune
```

## Quick Start

```bash
# Install the plugin
claude plugin add rune

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
```

## Architecture

### 5-Layer Model

```
╔══════════════════════════════════════════════════════╗
║  L0: ROUTER (1)                                      ║
║  Meta-enforcement — routes every action               ║
║  skill-router                                         ║
╠══════════════════════════════════════════════════════╣
║  L1: ORCHESTRATORS (4)                                ║
║  Full lifecycle workflows                             ║
║  cook │ team │ launch │ rescue                        ║
╠══════════════════════════════════════════════════════╣
║  L2: WORKFLOW HUBS (22)                               ║
║  Cross-hub mesh — the key differentiator              ║
║                                                        ║
║  Creation:    plan │ scout │ brainstorm │ design │     ║
║               skill-forge                              ║
║  Development: debug │ fix │ test │ review │ db         ║
║  Quality:     sentinel │ preflight │ onboard │         ║
║               audit │ perf │ review-intake             ║
║  Delivery:    deploy │ marketing │ incident            ║
║  Rescue:      autopsy │ safeguard │ surgeon            ║
╠══════════════════════════════════════════════════════╣
║  L3: UTILITIES (21)                                   ║
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
Phase 1 UNDERSTAND → scout scans codebase
Phase 2 PLAN       → plan creates implementation steps
Phase 3 TEST       → test writes failing tests (TDD red)
Phase 4 IMPLEMENT  → fix writes code (TDD green)
Phase 5 QUALITY    → preflight + sentinel + review
Phase 6 VERIFY     → verification + hallucination-guard
Phase 7 COMMIT     → git commit with semantic message
Phase 8 BRIDGE     → session-bridge saves state
```

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

## Numbers

```
Core Skills:       48 (L0: 1 │ L1: 4 │ L2: 22 │ L3: 21)
Extension Packs:   12
Mesh Connections:  160+
Connections/Skill: 3.3 avg
Pain Points Solved: 92% (18/20 real dev problems)
```

## License

MIT
