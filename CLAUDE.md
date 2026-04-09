# Rune — Project Configuration

## Overview

Rune is an interconnected skill ecosystem for AI coding assistants.
62 core skills | 5-layer mesh architecture | 215+ connections | Multi-platform.
Philosophy: "Less skills. Deeper connections."

Works on: Claude Code (native plugin) · Cursor · Windsurf · Google Antigravity · OpenAI Codex · OpenCode · any AI IDE.

## Tech Stack

- Claude Code Plugin System (native)
- Multi-platform compiler (Node.js) — compiles to Cursor, Windsurf, Antigravity, Codex, OpenCode, generic
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
│   ├── adapters/       # Platform adapters (claude, cursor, windsurf, antigravity, codex, openclaw, opencode, generic)
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

- Validate plugin: `claude plugin validate .`
- Test locally: `claude --plugin-dir .`
- Build for Cursor: `node compiler/bin/rune.js build --platform cursor --output <project-dir>`
- Build for Windsurf: `node compiler/bin/rune.js build --platform windsurf --output <project-dir>`
- Build for Codex: `node compiler/bin/rune.js build --platform codex --output <project-dir>`
- Build for OpenCode: `node compiler/bin/rune.js build --platform opencode --output <project-dir>`
- Validate build: `node compiler/bin/rune.js doctor`
- Project dashboard: `node compiler/bin/rune.js status` (tiered neofetch)
- Mesh visualizer: `node compiler/bin/rune.js visualize` (interactive graph)
- Run tests: `npm test` (946 tests — compiler + signals + hooks + scripts + status + visualizer)
- Run tests with coverage: `npm run test:coverage` (c8 + lcov)
- Lint: `npm run lint` (Biome)
- Lint + fix: `npm run lint:fix`
- Full CI check: `npm run ci` (lint + test + doctor)

## Current Wave

62 core skills built (v2.10.0 — "Graft Intelligence").

### L0 Router (1)
skill-router — meta-enforcement layer, routes every action through the correct skill

### L1 Orchestrators (5)
cook, team, launch, rescue, scaffold

### L2 Workflow Hubs (29)
plan, scout, brainstorm, design, skill-forge, debug, fix, test, review, db,
sentinel, preflight, onboard, deploy, marketing, perf,
autopsy, safeguard, surgeon, audit, incident, review-intake, logic-guardian,
ba, docs, mcp-builder, adversary, retro, graft

### L3 Utilities (27)
research, docs-seeker, trend-scout, problem-solver, sequential-thinking,
verification, hallucination-guard, completion-gate, constraint-check, sast, integrity-check,
context-engine, context-pack, journal, session-bridge, neural-memory, worktree,
watchdog, scope-guard, browser-pilot, asset-creator, video-creator, slides,
dependency-doctor, git, doc-processor, sentinel-env

### L4 Extension Packs (14)
@rune/ui, @rune/backend, @rune/devops, @rune/mobile, @rune/security,
@rune/trading, @rune/saas, @rune/ecommerce, @rune/ai-ml, @rune/gamedev,
@rune/content, @rune/analytics, @rune/chrome-ext, @rune/zalo

All layers complete. Repository: https://github.com/rune-kit/rune

### Rune Pro (Premium Extensions — separate private repo)
Repository: https://github.com/rune-kit/rune-pro (private)
@rune-pro/product (✅), @rune-pro/sales (✅), @rune-pro/data-science (✅), @rune-pro/support (✅), @rune-pro/growth (✅)
Pricing: $49 lifetime (Pro), $149 lifetime (Business)
Pro packs use same PACK.md format, install into `extensions/pro-*/`.

### Rune Business (Enterprise Extensions — separate private repo)
Repository: https://github.com/rune-kit/rune-business (private)
@rune-business/finance (✅), @rune-business/legal (✅), @rune-business/hr (✅), @rune-business/enterprise-search (✅)
4 packs, 26 skills. $149 lifetime.

## Full Spec

See `docs/ARCHITECTURE.md` for the 5-layer architecture reference.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Free** (549 symbols, 690 relationships, 16 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/Free/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Free/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Free/clusters` | All functional areas |
| `gitnexus://repo/Free/processes` | All execution flows |
| `gitnexus://repo/Free/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->
