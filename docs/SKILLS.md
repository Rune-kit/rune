# Skill Index — All 62 Core Skills

> **Need a skill?** Invoke via `/rune <skill-name>` in Claude Code, or `@rune:<skill-name>` in Cursor/Windsurf.
> Every skill has a `SKILL.md` at `skills/<name>/SKILL.md` — read that for the full spec.

**Total:** 62 skills across 5 layers · 215+ mesh connections
**Quick find:** use Ctrl+F on this page

---

## By Intent (Quick Lookup)

| I want to... | Invoke |
|--------------|--------|
| Build a feature / fix a bug / refactor | [`cook`](#cook) |
| Explore ideas before committing to an approach | [`brainstorm`](#brainstorm) → [`plan`](#plan) |
| Plan a multi-phase implementation | [`plan`](#plan) |
| Understand the codebase | [`scout`](#scout) |
| Find a root cause | [`debug`](#debug) |
| Write tests (TDD) | [`test`](#test) |
| Review code quality | [`review`](#review) |
| Ship to production | [`launch`](#launch) or [`deploy`](#deploy) |
| Gather requirements | [`ba`](#ba) |
| Set up a new project | [`scaffold`](#scaffold) |
| Rescue legacy code | [`rescue`](#rescue) |
| Port code from another repo | [`graft`](#graft) |
| Parallel work across 5+ files | [`team`](#team) |
| Handle a production incident | [`incident`](#incident) |
| Run a security audit | [`sentinel`](#sentinel) or [`audit`](#audit) |
| Generate docs | [`docs`](#docs) |
| Onboard an existing codebase | [`onboard`](#onboard) |

---

## L0 — Router (1)

### skill-router
Meta-enforcement layer. Routes every action through the correct skill before code is written. Always active — you rarely invoke it directly.
**Use when:** implicitly on every request. Explicit invocation: debugging mis-routing.

---

## L1 — Orchestrators (5)

### cook
Feature implementation orchestrator — handles 70% of requests. Runs the full TDD cycle: scout → plan → test → implement → verify → commit.
**Use when:** building, fixing, refactoring, adding features, modifying source code.

### team
Multi-agent meta-orchestrator for large tasks (5+ files or 3+ modules). Splits work into parallel workstreams with worktree isolation.
**Use when:** task spans many modules or user says "parallel", "split this up", "do all of these".

### launch
Deploy + marketing orchestrator. Pre-flight → deploy → live verification → marketing assets → announce.
**Use when:** shipping to production with public announcement.

### rescue
Legacy refactoring orchestrator for messy codebases (health <40). Multi-session workflow with safety nets and rollback points.
**Use when:** "refactor", "modernize", "clean up this mess", dealing with legacy code.

### scaffold
Autonomous project bootstrapper — 0 to production-ready. Orchestrates ba → plan → design → fix → test → docs → git in one pipeline.
**Use when:** starting a new project from a description.

---

## L2 — Workflow Hubs (29)

### ba
Business Analyst — elicits requirements with 5 probing questions, maps stakeholders, produces a Requirements Document.
**Use when:** task is non-trivial or vague; before planning or coding.

### plan
Creates structured implementation plans — master plan + phase files. Each session handles one phase.
**Use when:** work spans 3+ phases or 5+ files.

### scout
Fast codebase scanner. Finds files, patterns, dependencies, project structure. Read-only.
**Use when:** before planning, fixing, reviewing, or refactoring — get context first.

### brainstorm
Creative ideation — generates 2-3 approaches with trade-offs.
**Use when:** multiple valid paths exist or current approach has failed.

### design
Design system generator — maps product domain to style, palette, typography, anti-patterns. Produces `.rune/design-system.md`.
**Use when:** before any frontend code generation.

### skill-forge
The skill that builds skills. TDD-driven: baseline test → write skill → verify → refactor → integrate.
**Use when:** creating or editing Rune skills.

### debug
Root cause analysis ONLY. Investigates errors, traces stack traces, forms/tests hypotheses. Does NOT fix.
**Use when:** root cause is unknown.

### fix
Applies code changes from diagnosis or review findings. Locate → change → verify → report.
**Use when:** after debug diagnosis or review findings.

### test
TDD test writer. Writes FAILING tests FIRST (RED), verifies they pass after implementation (GREEN).
**Use when:** adding features or fixing bugs (always test-first).

### review
Code quality review. Checks correctness, security, performance, conventions, coverage. Every finding has file:line.
**Use when:** after any code change.

### db
Database workflow specialist. Migration generation (up + down), breaking change detection, index recommendations, SQL injection scanning.
**Use when:** schema changes detected.

### sentinel
Security gatekeeper. Blocks unsafe code BEFORE commit. Secret scanning, OWASP top 10, dependency audit.
**Use when:** before every commit (often auto-fires via hooks).

### preflight
Pre-commit quality gate. Catches "almost right" code — logic, error handling, regressions, completeness.
**Use when:** before commit (auto-fires via hooks when `rune hooks install` is active).

### onboard
Auto-generate project context. Scans codebase, creates CLAUDE.md + `.rune/` directory.
**Use when:** first session on an existing codebase.

### deploy
Deploy to target platform — Vercel, Netlify, Fly.io, AWS, VPS. Pre-deploy verification + security gates.
**Use when:** shipping without the full launch orchestrator.

### marketing
Create marketing assets — landing copy, social posts, SEO meta, video scripts, slides.
**Use when:** launch, announcements, content for marketing channels.

### perf
Performance regression gate. Detects N+1 queries, sync-in-async, missing indexes, memory leaks, bundle bloat.
**Use when:** before commit or deploy.

### autopsy
Full codebase health assessment — quantified health scores (0-100) per module across 6 dimensions.
**Use when:** starting a rescue workflow or project diagnosis.

### safeguard
Build safety nets BEFORE refactoring. Characterization tests, boundary markers, config freeze, rollback tags.
**Use when:** before surgeon (refactoring).

### surgeon
Incremental refactorer. ONE module per session, tests after EVERY edit, max 5 files blast radius.
**Use when:** within rescue workflow.

### audit
Comprehensive 8-dimension health audit — dependencies, security, code quality, architecture, performance, infra, docs, mesh analytics.
**Use when:** quarterly review or pre-release assessment.

### incident
Structured incident response. Triage (P1/P2/P3), contain, verify, root-cause, postmortem.
**Use when:** production is down or degraded. Contain BEFORE investigating.

### review-intake
Process external review feedback. Read ALL items first, verify against codebase, implement in priority order.
**Use when:** receiving PR comments or external code review.

### logic-guardian
Protects complex business logic from accidental deletion. Maintains logic manifest, enforces pre-edit gates.
**Use when:** touching trading bots, payment systems, state machines.

### docs
Auto-generate and maintain project documentation. Keeps docs in sync with code — the "docs are never outdated" skill.
**Use when:** after shipping features or before releases.

### mcp-builder
Build MCP servers from specs. TypeScript (official SDK) or Python (FastMCP). Multi-provider adapter pattern.
**Use when:** exposing APIs to AI assistants via Model Context Protocol.

### adversary
Pre-implementation red-team analysis. Challenges plans BEFORE code is written — edge cases, security holes, scalability bottlenecks.
**Use when:** plan is critical or high-risk.

### retro
Engineering retrospective. Analyzes commit history, work patterns, code quality metrics. Read-only.
**Use when:** weekly/monthly/quarterly review.

### graft
Clone, port, or convert features from any GitHub repo into your project. Understand before copy, challenge before implement.
**Use when:** stealing patterns from other repos. 4 modes: port, compare, copy, improve.

---

## L3 — Utilities (27)

| Skill | Purpose |
|-------|---------|
| **research** | Web research — min 3 sources per conclusion, max 5 WebFetch calls |
| **docs-seeker** | Documentation lookup — Context7 → llms.txt → WebSearch |
| **trend-scout** | Market intelligence — Product Hunt, GitHub Trending, HN, Reddit |
| **problem-solver** | Structured reasoning frameworks (5 Whys, Fishbone, First Principles, SCAMPER) with bias detection |
| **sequential-thinking** | Multi-variable analysis for >3 interdependent factors with cascading effects |
| **verification** | Universal verification — lint, type-check, tests, build. 3-level quality gate |
| **hallucination-guard** | Post-generation validation — phantom imports, typosquatting |
| **completion-gate** | Lie detector — validates every completion claim has evidence |
| **constraint-check** | Audits whether HARD-GATEs and constraints were followed |
| **sast** | Static analysis runner — ESLint, Semgrep, Bandit, Clippy, govulncheck |
| **integrity-check** | Detects prompt injection, memory poisoning in `.rune/` files |
| **context-engine** | Context window management, artifact folding, auto-compaction |
| **context-pack** | Structured handoff briefings between agents |
| **journal** | Persistent state tracking — ADRs, decisions, progress |
| **session-bridge** | Cross-session context persistence to `.rune/` files |
| **neural-memory** | Semantic memory graph via Neural Memory MCP |
| **worktree** | Git worktree lifecycle — parallel development isolation |
| **watchdog** | Post-deploy monitoring — health checks, response time, error detection |
| **scope-guard** | Passive scope monitor — flags out-of-scope files against plan |
| **browser-pilot** | Playwright browser automation — max 20 interactions |
| **asset-creator** | Code-based visual assets — SVG icons, OG images, banners |
| **video-creator** | Video content planning — narration, storyboards, shot lists |
| **slides** | Marp-compatible slide decks from structured JSON |
| **dependency-doctor** | Dependency health — outdated packages, CVEs, breaking change risk |
| **git** | Semantic commits, PR descriptions, branch naming, changelog generation |
| **doc-processor** | Generate/parse office documents — PDF, DOCX, XLSX, PPTX, CSV |
| **sentinel-env** | Environment pre-flight — OS, runtime versions, tools, ports, env vars |

---

## L4 — Extension Packs (14 Free)

Domain packs bundle multiple skills for a specific vertical.

| Pack | Purpose |
|------|---------|
| `@rune/ui` | Component libraries, design systems, Storybook |
| `@rune/backend` | APIs, services, databases |
| `@rune/devops` | CI/CD, IaC, containers, K8s |
| `@rune/mobile` | React Native, Expo, iOS, Android |
| `@rune/security` | AppSec, threat modeling, pentest |
| `@rune/trading` | Trading bots, strategies, backtests |
| `@rune/saas` | Multi-tenant, billing, auth |
| `@rune/ecommerce` | Cart, checkout, inventory |
| `@rune/ai-ml` | RAG, embeddings, fine-tuning |
| `@rune/gamedev` | Game engines, physics, assets |
| `@rune/content` | CMS, blogs, MDX |
| `@rune/analytics` | Events, dashboards, funnels |
| `@rune/chrome-ext` | Chrome extensions — manifest v3 |
| `@rune/zalo` | Zalo Mini Apps |

**Paid packs** (separate repos): [`@rune-pro/*`](https://rune-kit.github.io/rune#pricing) ($49) and [`@rune-business/*`](https://rune-kit.github.io/rune#pricing) ($149).

---

## Discovery Tips

- **Too many skills?** Start with `cook`. It routes to the right skills automatically.
- **Don't know what to invoke?** Describe intent to Claude — `skill-router` handles routing.
- **Skill chains:** see [`SIGNALS.md`](SIGNALS.md) for how skills auto-trigger each other.
- **Full mesh graph:** run `node compiler/bin/rune.js visualize` for an interactive view.
- **Skill template:** see [`SKILL-TEMPLATE.md`](SKILL-TEMPLATE.md) to understand structure.
