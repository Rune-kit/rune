# Rune — Project Configuration

## Overview

Rune is a Claude Code plugin providing an interconnected skill ecosystem.
35 core skills | 108 connections | 4-layer mesh architecture.
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
├── skills/             # SKILL.md files (one dir per skill)
├── commands/           # Slash command definitions
├── agents/             # Subagent definitions
├── hooks/              # Event hooks (session-start, etc.)
├── scripts/            # Executable scripts for skills
└── docs/               # Documentation and plans
```

## Conventions

- Every skill MUST have a SKILL.md following docs/SKILL-TEMPLATE.md
- Skill names: lowercase kebab-case, max 64 chars
- Layer rules: L1 calls L2/L3. L2 calls L2/L3. L3 calls nothing.
- Model selection: haiku (scan), sonnet (code), opus (architecture)
- Commit messages: conventional commits (feat, fix, docs, chore)

## Commands

- Validate plugin: `claude plugin validate .`
- Test locally: `claude --plugin-dir .`

## Current Wave

Wave 0 (Setup) complete. Wave 1 (Quality Gate) complete. Wave 2 (Development Hub) complete.
Skills built: scout, session-bridge, sentinel, onboard, preflight, hallucination-guard,
  plan, debug, fix, test, review, brainstorm.
Next: Wave 3 (Core Orchestrator — cook L1 + mesh wiring)

## Full Spec

See `~/.claude/rune/FORGE-COMPLETE.md` for the complete product specification.
See `docs/ARCHITECTURE.md` for the 4-layer architecture reference.
