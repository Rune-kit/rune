<p align="center">
  <img src="assets/banner.svg" alt="Rune — Skill Mesh for AI Coding Assistants" width="100%">
</p>

<p align="center">
  <strong>Less skills. Deeper connections.</strong><br>
  A lean, interconnected skill ecosystem for AI coding assistants.<br>
  61 skills · 200+ mesh connections · 8 platforms · MIT
</p>

<p align="center">
  <a href="https://rune-kit.github.io/rune"><img src="https://img.shields.io/badge/Landing_Page-rune--kit.github.io-blue?style=for-the-badge" alt="Landing Page"></a>
  <a href="https://rune-kit.github.io/rune#pricing"><img src="https://img.shields.io/badge/Pro_%2449-lifetime-blueviolet?style=for-the-badge" alt="Rune Pro $49"></a>
  <a href="https://rune-kit.github.io/rune#pricing"><img src="https://img.shields.io/badge/Business_%24149-lifetime-orange?style=for-the-badge" alt="Rune Business $149"></a>
  <a href="https://t.me/xlabs_updates"><img src="https://img.shields.io/badge/Telegram-Updates-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram Updates"></a>
</p>

<p align="center">
  <strong>Claude Code</strong> (native plugin) · <strong>Cursor</strong> · <strong>Windsurf</strong> · <strong>Google Antigravity</strong> · <strong>OpenAI Codex</strong> · <strong>OpenCode</strong> · any AI IDE
</p>

## Why Rune?

Most skill ecosystems are either **too many isolated skills** (540+ that don't talk to each other) or **rigid pipelines** (A → B → C, if B fails everything stops).

Rune is a **mesh** — 61 skills with 200+ connections across a 5-layer architecture. Skills call each other bidirectionally, forming resilient workflows that adapt when things go wrong.

```
Pipeline:  A → B → C → D         (B fails = stuck)
Hub-Spoke: A → HUB → C           (HUB fails = stuck)
Mesh:      A ↔ B ↔ C             (B fails = A reaches C via D→E)
           ↕       ↕
           D ↔ E ↔ F
```

## Benchmark: With Rune vs Without Rune

We ran 10 standardized coding tasks on Claude Code — once **without** Rune (vanilla), once **with** Rune — and measured tokens, cost, duration, and correctness.

### Headline Results

```
                Without Rune    With Rune     Delta
Avg Tokens:     541,400         454,491       ↓ 16%
Avg Cost:       $0.69           $0.65         ↓ 6%
Avg Duration:   2.3 min         2.1 min       ↓ 9%
Avg Tool Calls: 14              13            ↓ 7%
Correctness:    9/10            9/10          =
```

### Where Rune Shines: Complex Tasks

| Task | Difficulty | Tokens | Cost | Duration | Tools |
|------|-----------|--------|------|----------|-------|
| Refactor 450-line component | Medium | **-62%** | **-17%** | **-32%** | **-27%** |
| Full feature (auth + API + tests) | Complex | **-36%** | **-29%** | **-31%** | **-27%** |
| Add Zod validation | Easy | -9% | **-28%** | **-32%** | 0% |
| Dark mode across 6 components | Hard | ~0% | +10% | -7% | -6% |

Rune doesn't make Claude smarter — Claude already knows how to code. Rune makes Claude **disciplined**. The more complex the task, the more discipline matters.

> _"Without Rune, Claude writes code that works. With Rune, Claude writes code that lasts."_

<details>
<summary>Full 10-task breakdown</summary>

| # | Task | Diff | Tokens | Cost | Time | Correct |
|---|------|------|--------|------|------|---------|
| 1 | Zod Validation | Easy | -9% | -28% | -32% | ✅ → ✅ |
| 2 | Fix N+1 Query | Easy | +12% | +25% | +3% | ❌ → ❌ |
| 3 | Cursor Pagination | Med | +12% | +19% | -9% | ✅ → ✅ |
| 4 | Security Review | Med | +13% | +32% | +3% | ✅ → ✅ |
| 5 | Rate Limiting | Med | +12% | +5% | +5% | ✅ → ✅ |
| 6 | Refactor Component | Med | **-62%** | **-17%** | **-32%** | ✅ → ✅ |
| 7 | Dark Mode (6 files) | Hard | ~0% | +10% | -7% | ✅ → ✅ |
| 8 | DB Migration | Hard | +52% | +11% | +49% | ✅ → ✅ |
| 9 | Memory Leak Debug | Hard | +13% | +28% | -2% | ✅ → ✅ |
| 10 | Full Auth System | Complex | **-36%** | **-29%** | **-31%** | ✅ → ✅ |

_Methodology: Claude Code CLI headless mode (`claude -p --output-format json`), 10 tasks with fixture code, pattern-based correctness evaluation. Source: [`Benchmark/`](Benchmark/)_

</details>

---

## What's New (v2.8.0)

- **Anti-Loop Intelligence** — 7 core skills enriched with execution loop detection, saturation analysis, error pattern matching, artifact folding, budget-aware progression, and recovery policy routing
- **cook v2.1.0** — observation/effect ratio tracking (detects stuck agents reading without writing) + budget-aware phase progression with hard caps on replans, quality retries, and session tool calls
- **completion-gate v1.8.0** — execution loop audit: classifies tool calls as observation vs effect, flags imbalanced ratios and repeating sequences in gate reports
- **scout v0.3.0** — info saturation detection: tracks entity discovery rate and content similarity to stop scanning when diminishing returns detected
- **research v0.4.0** — diminishing returns detection: monitors new-entity ratio and result overlap across searches to skip redundant queries
- **context-engine v0.9.0** — artifact folding: large tool outputs (>4000 chars or >120 lines) saved to `.rune/artifacts/` with compact preview in context
- **debug v1.0.0** — known error pattern catalog: 8 error archetypes (STATELESS_LOSS, MODULE_NOT_FOUND, TYPE_MISMATCH, ASYNC_DEADLOCK, etc.) with recovery hints + error fingerprinting for dedup
- **fix v0.8.0** — recovery policy matrix: classifies errors into 8 types (INPUT_REQUIRED→PROMPT_USER, TIMEOUT→RETRY, POLICY_BLOCKED→ABORT, etc.) before attempting fixes
- **Source attribution cleanup** — removed all enrichment credit lines from skill files to reduce context noise

### Previous (v2.7.0)

- **Deep Knowledge** — 8 core skills enriched with battle-tested patterns: context compaction, structured cumulative memory, milestone analysis, multi-provider adapters, AI-driven interview, prompt-as-API-contract, token budget tracking, incremental stream processing
- **946 Tests** — compiler + signals + hooks + scripts + status + visualizer validation

### Previous (v2.6.0)

- **Mesh Signals** — event-driven skill communication via frontmatter. Skills declare `emit` and `listen` signals; compiler builds a signal graph in `skill-index.json`. 17 signals across 15 core skills
- **Signal Validation** — `scripts/validate-signals.js` checks orphan listeners (hard error), unlistened emitters (warning), signal naming conventions
- **Mesh Contract** (v2.5.0) — `.rune/contract.md` project-level invariants enforced by cook + sentinel as hard gates
- **Tier Override** — Pro/Business packs override Free packs with skill-level merging
- **Scripts Bundling** — compiler copies `scripts/` directories, resolves `{scripts_dir}` placeholders

### Signal Graph

Skills communicate through declarative signals — no runtime event bus, just metadata for discovery, validation, and routing:

```
scout ──emit:codebase.scanned──→ plan, brainstorm
fix ────emit:code.changed──────→ test, sentinel, review, preflight, verification
test ───emit:tests.passed──────→ deploy
test ───emit:tests.failed──────→ debug
sentinel─emit:security.passed──→ deploy
debug ──emit:bug.diagnosed─────→ fix
deploy ─emit:deploy.complete───→ watchdog
cook ───emit:phase.complete────→ session-bridge
```

## What Rune Is (and Isn't)

Rune started as a **Claude Code plugin** and now compiles to **every major AI IDE**. Same 61 skills, same mesh connections, same workflows — zero knowledge loss across platforms.

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
| Agent specialization | 61 specialized skills with dedicated roles (architect, coder, reviewer, scanner, researcher, BA, scaffolder) — each runs as a Task agent via Claude Code |
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

This compiles all 61 skills into your IDE's rules format. Same knowledge, same workflows.

### Platform Comparison

| Feature | Claude Code | Cursor / Windsurf / Others |
|---------|-------------|---------------------------|
| Skills available | 61/61 | 61/61 |
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
║  Velocity:    retro                                    ║
╠══════════════════════════════════════════════════════╣
║  L3: UTILITIES (27)                                   ║
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
║  Packs:       context-pack                             ║
║  Slides:      slides                                   ║
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

### Rune Pro — $49 lifetime

> *Free Rune makes Claude disciplined. Pro makes Claude self-aware.*

**Context Intelligence** — the headline Pro feature. Claude Code auto-compacts at random, wiping your session context. With Pro, Claude **knows** when context is filling up — and proactively saves decisions, progress, and discoveries before compact hits.

```
Free:  Claude is blind to context pressure → auto-compact → amnesia
Pro:   Claude sees real-time context % → saves state → compact → reloads → zero loss
```

How it works: `rune-pulse` (statusline) reads `context_window.used_percentage` from Claude Code, writes to temp file. `context-inject` hook injects warnings into Claude's context at 70% / 80% / 90%. Claude triggers `session-bridge` + `neural-memory` to persist everything. After `/compact`, `session-start` reloads `.rune/` state — Claude picks up exactly where it left off.

**Autopilot** — approve a plan, walk away. Autonomous multi-session execution with zero-HIGH-tolerance quality gates, baseline regression checks, cross-phase coherence review, and structured completion reports. `cook` gets the job done. `autopilot` gets it done while you sleep.

**Department Packs** — 34 skills across 5 domains:

| Pack | What it does |
|------|-------------|
| **Product** | PRDs from user stories, roadmap prioritization, KPI dashboards, release comms, competitive analysis |
| **Sales** | Account research briefs, call prep with objection handling, outreach sequences, pipeline health review |
| **Data Science** | SQL exploration → visualization → statistical testing → ML eval, all in one flow |
| **Support** | Ticket triage with SLA routing, KB article generation, escalation playbooks, support metrics |
| **Growth** | Niche research, content scouting, SEO architecture, landing page generation, content health monitoring, data moats |

All Pro packs plug into the core mesh — `cook` orchestrates them, `sentinel` gates them, `team` parallelizes them.

**[Get Rune Pro](https://rune-kit.github.io/rune#pricing)** — [rune-kit/rune-pro](https://github.com/rune-kit/rune-pro)

### Rune Business — $149 lifetime (includes Pro)

> *Pro handles departments. Business handles the company.*

Business packs don't just add skills — they **wire departments together**. Finance pulls from sales pipeline. Legal audits product specs. Enterprise search indexes support KB. 40 cross-domain signals, zero manual context passing.

| Pack | What it does |
|------|-------------|
| **Finance** | Budget planning from sales pipeline data, P&L analysis, cash flow forecasting, compliance reporting |
| **Legal** | Contract review with clause extraction, GDPR/SOC2 compliance checks, NDA triage, IP protection |
| **HR** | JD generation, resume screening, structured interviews, comp benchmarking, onboarding workflows |
| **Enterprise Search** | Cross-system knowledge retrieval with permission-aware filtering and knowledge graph |

4 packs, 26 skills, 118 reference files, 11 automation scripts. Business includes all Pro features because it depends on Pro data — finance can't forecast without sales pipeline, legal can't audit without product specs.

**[Get Rune Business](https://rune-kit.github.io/rune#pricing)** — [rune-kit/rune-business](https://github.com/rune-kit/rune-business)

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
Core Skills:       61 (L0: 1 │ L1: 5 │ L2: 28 │ L3: 27)
Extension Packs:   14 free + 5 pro + 4 business
Mesh Connections:  200+ cross-references
Mesh Signals:      57 signals across 66 skills (emit/listen graph)
Connections/Skill: 3.4 avg
Platforms:         8 (Claude Code, Cursor, Windsurf, Antigravity, Codex, OpenCode, OpenClaw, Generic)
Compiler:          ~1400 LOC (parser + 8 transforms + 8 adapters + CLI)
Tests:             946 (compiler + signals + status + visualizer + hooks + scripts)
Pack Depth:        23 packs total (14 free + 5 pro + 4 business, all free packs rated Deep)
```

## Acknowledgments

- **[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** (MIT, 42.8k★) — Design intelligence databases powering Rune's `design` skill and `@rune/ui` pack: 161 color palettes, 84 UI styles, 73 font pairings, 99 UX guidelines, 161 industry reasoning rules.

## License

MIT
