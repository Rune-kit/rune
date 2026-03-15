# Rune — Project Configuration

## Overview

Rune is an interconnected skill ecosystem for AI coding assistants.
57 core skills | 5-layer mesh architecture | 200+ connections | Multi-platform.
Philosophy: "Less skills. Deeper connections."

Works on: Claude Code (native plugin) · Cursor · Windsurf · Google Antigravity · any AI IDE.

## Tech Stack

- Claude Code Plugin System (native)
- Multi-platform compiler (Node.js) — compiles to Cursor, Windsurf, Antigravity, generic
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
│   ├── adapters/       # Platform adapters (claude, cursor, windsurf, antigravity, generic)
│   └── transforms/     # Cross-refs, tool-names, frontmatter, subagents, hooks, branding
├── commands/           # Slash command definitions
├── agents/             # Subagent definitions
├── contexts/           # Behavioral mode injection (dev, research, review)
├── hooks/              # Event hooks (session-start, pre-compact, etc.)
├── scripts/            # Executable scripts for skills
└── docs/               # Documentation, templates, and plans
```

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
- Validate build: `node compiler/bin/rune.js doctor`

## Current Wave

57 core skills built (v2.1.0 — "The Missing Pieces").

### L0 Router (1)
skill-router — meta-enforcement layer, routes every action through the correct skill

### L1 Orchestrators (5)
cook, team, launch, rescue, scaffold

### L2 Workflow Hubs (27)
plan, scout, brainstorm, design, skill-forge, debug, fix, test, review, db,
sentinel, preflight, onboard, deploy, marketing, perf,
autopsy, safeguard, surgeon, audit, incident, review-intake, logic-guardian,
ba, docs, mcp-builder, adversary

### L3 Utilities (24)
research, docs-seeker, trend-scout, problem-solver, sequential-thinking,
verification, hallucination-guard, completion-gate, constraint-check, sast, integrity-check,
context-engine, journal, session-bridge, worktree,
watchdog, scope-guard, browser-pilot, asset-creator, video-creator,
dependency-doctor, git, doc-processor, sentinel-env

### L4 Extension Packs (13)
@rune/ui, @rune/backend, @rune/devops, @rune/mobile, @rune/security,
@rune/trading, @rune/saas, @rune/ecommerce, @rune/ai-ml, @rune/gamedev,
@rune/content, @rune/analytics, @rune/chrome-ext

All layers complete. Repository: https://github.com/rune-kit/rune

### Rune Pro (Premium Extensions — separate private repo)
Repository: https://github.com/rune-kit/rune-pro (private)
@rune-pro/product (✅), @rune-pro/sales (✅), @rune-pro/data-science (planned)
Pricing: $49 lifetime (Pro), $149 lifetime (Business)
Pro packs use same PACK.md format, install into `extensions/pro-*/`.
See `docs/plans/RUNE-PRO-PLAN.md` for full plan.

## Full Spec

See `~/.claude/rune/RUNE-COMPLETE.md` for the complete product specification.
See `docs/ARCHITECTURE.md` for the 5-layer architecture reference.
