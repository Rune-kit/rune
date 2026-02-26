# Rune — Project Configuration

## Overview

Rune is a Claude Code plugin providing an interconnected skill ecosystem.
40 core skills | 4-layer mesh architecture.
Philosophy: "Less skills. Deeper connections."

## Tech Stack

- Claude Code Plugin System
- Agent Skills SKILL.md format
- Git for version control
- Markdown + JSON for configuration
- JavaScript for hooks/scripts

## Directory Structure

```
rune/
├── .claude-plugin/     # Plugin manifest
│   ├── plugin.json     # Plugin metadata
│   └── marketplace.json # Marketplace catalog
├── skills/             # Core skills (L1-L3, one dir per skill)
├── extensions/         # L4 extension packs (one dir per pack)
├── commands/           # Slash command definitions
├── agents/             # Subagent definitions
├── hooks/              # Event hooks (session-start, etc.)
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

## Current Wave

All 43 core skills built (Waves 0-5 complete + audit + perf/db/incident + design + skill-router + review-intake + skill-forge).

### L0 Router (1)
skill-router — meta-enforcement layer, routes every action through the correct skill

### L1 Orchestrators (4)
cook, team, launch, rescue

### L2 Workflow Hubs (22)
plan, scout, brainstorm, design, skill-forge, debug, fix, test, review, db,
sentinel, preflight, onboard, deploy, marketing, perf,
autopsy, safeguard, surgeon, audit, incident, review-intake

### L3 Utilities (16)
research, docs-seeker, trend-scout, problem-solver, sequential-thinking,
verification, hallucination-guard, context-engine, journal, session-bridge,
watchdog, scope-guard, browser-pilot, asset-creator, video-creator,
dependency-doctor

### L4 Extension Packs (12)
@rune/ui, @rune/backend, @rune/devops, @rune/mobile, @rune/security,
@rune/trading, @rune/saas, @rune/ecommerce, @rune/ai-ml, @rune/gamedev,
@rune/content, @rune/analytics

All layers complete. Repository: https://github.com/rune-kit/rune

## Full Spec

See `~/.claude/rune/RUNE-COMPLETE.md` for the complete product specification.
See `docs/ARCHITECTURE.md` for the 4-layer architecture reference.
