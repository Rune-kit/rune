# Rune — Project Configuration

## Overview

Rune is an interconnected skill ecosystem for AI coding assistants.
65 core skills | 5-layer mesh architecture | 204 connections + 43 signals | Multi-platform.
Philosophy: "Less skills. Deeper connections."

Works on: Claude Code (native plugin) · Cursor · Windsurf · Google Antigravity · OpenAI Codex · OpenCode · Aider · GitHub Copilot CLI · Gemini CLI · Qoder · Qwen Coder · any AI IDE.

## Tech Stack

- Claude Code Plugin System (native)
- Multi-platform compiler (Node.js) — 13 adapters: Cursor, Windsurf, Antigravity, Codex, OpenCode, OpenClaw, Aider, GitHub Copilot CLI, Gemini CLI, Qoder, Qwen Coder, generic
- Agent Skills SKILL.md format
- Git for version control
- Markdown + JSON for configuration
- JavaScript for hooks/scripts

## Directory Structure

```
rune/
├── .claude-plugin/     # Plugin manifest (Claude Code native)
│   ├── plugin.json     # Plugin metadata
│   └── marketplace.json # Marketplace catalog
├── skills/             # Core skills — SINGLE SOURCE OF TRUTH
├── extensions/         # L4 extension packs (one dir per pack)
├── compiler/           # Multi-platform compiler
│   ├── bin/rune.js     # CLI (init, build, doctor)
│   ├── parser.js       # SKILL.md → IR
│   ├── transformer.js  # Transform pipeline
│   ├── emitter.js      # IR → platform files
│   ├── adapters/       # Platform adapters (claude, cursor, windsurf, antigravity, codex, openclaw, opencode, generic, aider, copilot, gemini, qoder, qwen)
│   └── transforms/     # Cross-refs, tool-names, frontmatter, subagents, hooks, branding
├── commands/           # Slash command definitions
├── agents/             # Subagent definitions
├── contexts/           # Behavioral mode injection (dev, research, review)
├── hooks/              # Event hooks (session-start, pre-compact, etc.)
├── scripts/            # Executable scripts for skills
└── docs/               # Documentation, templates, and plans
```

## Mandatory Skill Routing

**ALWAYS invoke skills via the Skill tool. NEVER "mentally apply" a skill or do the work casually.**

When the user's intent matches a skill, invoke it BEFORE writing any code or analysis:

| User Intent | Invoke | NOT This |
|-------------|--------|----------|
| "brainstorm", "ideas", "explore options" | `rune:brainstorm` | Casually listing ideas without framework |
| "plan", "design architecture", "break this down" | `rune:plan` | Writing an inline plan without phase files |
| "build", "implement", "fix", "refactor", "add feature" | `rune:cook` | Writing code without scout/plan/test cycle |
| "review", "check this code" | `rune:review` | Skimming code without file:line findings |
| "test", "write tests" | `rune:test` | Writing tests after implementation (TDD violation) |
| "deploy", "ship", "go live" | `rune:launch` | Running deploy without pre-flight verification |
| "debug", "why is this broken" | `rune:debug` | Guessing at fixes without hypothesis testing |
| "security check", "audit security" | `rune:sentinel` | Surface-level security comments |
| "research", "find out about" | `rune:research` | Single-source answers without triangulation |
| "new project", "bootstrap", "scaffold" | `rune:scaffold` | Creating files without requirements/plan |
| Large task (5+ files, 3+ modules) | `rune:team` | Sequential cook on parallel-eligible work |
| Legacy cleanup (health <40) | `rune:rescue` | Ad-hoc refactoring without safety nets |
| "graft", "port from repo", "copy from repo" | `rune:graft` | Manual copy-paste from GitHub without challenge gate |
| "set up rune", "install hooks", "wire hooks", "configure rune", "first-time setup" | Tell user: run `npx @rune-kit/rune setup` (interactive wizard) | Manually editing settings.json or chaining `cd && rune hooks install --tier pro` per project |

**Workflow chains are enforced by each skill's Step 0 prerequisite check:**
- `cook` → checks for approved plan (invokes `plan` if missing)
- `plan` → checks for codebase context (invokes `scout` if missing)
- `fix` → checks for diagnosis (invokes `debug` if missing)
- `deploy` → checks for passing tests + security (invokes `verification` + `sentinel` if missing)

## Conventions

- Every skill MUST have a SKILL.md following docs/SKILL-TEMPLATE.md
- Every extension MUST have a PACK.md following docs/EXTENSION-TEMPLATE.md
- Skill names: lowercase kebab-case, max 64 chars
- Layer rules: L1 calls L2/L3. L2 calls L2/L3. L3 calls nothing (except documented L3→L3 coordination).
- Exception: `team` (L1) can call other L1 orchestrators (meta-orchestration pattern).
- Model selection: haiku (scan), sonnet (code), opus (architecture)
- Commit messages: conventional commits (feat, fix, docs, chore)

## Commands

- **One-command setup (recommended for first-time)**: `npx @rune-kit/rune setup` — interactive wizard auto-detects Pro/Business tiers, asks for scope (current project / global) + preset, installs hooks
- Validate plugin: `claude plugin validate .`
- Test locally: `claude --plugin-dir .`
- Build for Cursor: `node compiler/bin/rune.js build --platform cursor --output <project-dir>`
- Build for Windsurf: `node compiler/bin/rune.js build --platform windsurf --output <project-dir>`
- Build for Codex: `node compiler/bin/rune.js build --platform codex --output <project-dir>`
- Build for OpenCode: `node compiler/bin/rune.js build --platform opencode --output <project-dir>`
- Validate build: `node compiler/bin/rune.js doctor`
- Hook drift report: `node compiler/bin/rune.js doctor --hooks` (compares installed vs canonical preset)
- Project dashboard: `node compiler/bin/rune.js status` (tiered neofetch)
- Comprehension dashboard: `node compiler/bin/rune.js dashboard` (self-contained HTML — Verdict/Govern/Measure/Understand/Improve tabs; tier-aware: Pro = My Lens, Business = full Govern)
- Mesh visualizer: `node compiler/bin/rune.js visualize` (interactive graph)
- Run tests: `npm test` (1,559 tests — compiler + signals + hooks + tier-hooks + scripts + status + visualizer + setup wizard + dashboard)
- Install runtime hooks (manual): `node compiler/bin/rune.js hooks install --preset gentle [--global]` (add `--tier pro` / `--tier business` to stack paid tiers)
- Run tests with coverage: `npm run test:coverage` (c8 + lcov)
- Lint: `npm run lint` (Biome)
- Lint + fix: `npm run lint:fix`
- Full CI check: `npm run ci` (lint + test + doctor)

## Current Wave

65 core skills built (v2.21.0 — "Convergence — spec↔code gap scan kills the dead-button failure mode").

Convergence layer: new `converge` skill (L3) re-reads spec/plan/contracts as sole intent and scans the ACTUAL code for `missing`/`partial`/`contradicts`/`unrequested` gaps — cook Phase 6.5 loops it until clean (max 2 rounds). Upstream: ba emits story-sliced specs (P1/P2/P3 + Independent Test + Key Entities), plan emits contracts-first boundary artifacts (data-model/contracts/quickstart) with a P1 zero-coverage HARD-GATE. Downstream: verification Level 3.5 INTERACTION WIRED traces button→handler→route, completion-gate Step 4.5 is mandatory for UI+data diffs, deploy warns without wiring evidence (`integration.verified`/`convergence.clean`).

Comprehension dashboard: `rune dashboard` emits a self-contained HTML artifact (Verdict hero + 5-tab IA: Verdict → Govern / Measure / Understand / Improve). Tier-aware — Free = verdict + measure, Pro = "My Lens" cost/ROI persona, Business = full Governance Scorecard + compliance coverage. Generator `compiler/comprehension.js` + client app `compiler/comprehension-client.js`. No CDN, no telemetry, XSS-hardened.

Runtime layer: `rune hooks install` wires preflight / sentinel / completion-gate / dependency-doctor as native hooks on Claude Code, Cursor, Windsurf, Antigravity. Tier-tagged manifest pattern (`$<TIER>_ROOT/hooks/manifest.json`) lets Pro/Business stack on top via `--tier pro --tier business`. Free compiler stays tier-agnostic.

### L0 Router (1)
skill-router — meta-enforcement layer, routes every action through the correct skill

### L1 Orchestrators (5)
cook, team, launch, rescue, scaffold

### L2 Workflow Hubs (30)
plan, scout, brainstorm, design, skill-forge, debug, fix, test, review, db,
sentinel, preflight, onboard, deploy, marketing, perf,
autopsy, safeguard, surgeon, audit, incident, review-intake, logic-guardian,
ba, docs, mcp-builder, adversary, retro, graft, improve-architecture

### L3 Utilities (29)
research, docs-seeker, trend-scout, problem-solver, sequential-thinking,
verification, hallucination-guard, completion-gate, constraint-check, sast, integrity-check,
context-engine, context-pack, journal, session-bridge, neural-memory, worktree,
watchdog, scope-guard, browser-pilot, asset-creator, video-creator, slides,
dependency-doctor, git, doc-processor, sentinel-env, quarantine, converge

### L4 Extension Packs (14)
@rune/ui, @rune/backend, @rune/devops, @rune/mobile, @rune/security,
@rune/trading, @rune/saas, @rune/ecommerce, @rune/ai-ml, @rune/gamedev,
@rune/content, @rune/analytics, @rune/chrome-ext, @rune/zalo

All layers complete. Repository: https://github.com/rune-kit/rune

### Rune Pro (Premium Extensions — separate private repo)
Repository: https://github.com/rune-kit/rune-pro (private)
@rune-pro/product (✅), @rune-pro/sales (✅), @rune-pro/data-science (✅), @rune-pro/support (✅), @rune-pro/growth (✅), @rune-pro/media (✅), @rune-pro/personal-brand (✅), @rune-pro/ecommerce (✅), @rune-pro/vietnam (✅)
9 packs. Pricing: $49 lifetime (Pro), $149 lifetime (Business)
Pro packs use same PACK.md format, install into `extensions/pro-*/`.

### Rune Business (Enterprise Extensions — separate private repo)
Repository: https://github.com/rune-kit/rune-business (private)
@rune-business/finance (✅), @rune-business/legal (✅), @rune-business/hr (✅), @rune-business/enterprise-search (✅)
4 packs, 26 skills. $149 lifetime.

## Full Spec

See `docs/ARCHITECTURE.md` for the 5-layer architecture reference.
