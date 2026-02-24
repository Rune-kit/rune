# Rune Wave 0: Project Setup & Plugin Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize the Rune project as a Claude Code plugin with proper structure, skill file format, git repo, and first working skill (session-bridge) to validate the architecture.

**Architecture:** Rune is a Claude Code plugin distributed via marketplace. Skills follow Agent Skills SKILL.md spec. Plugin uses `.claude-plugin/plugin.json` manifest. Each skill is a directory under `skills/` with a `SKILL.md` file. Commands under `commands/` map `/rune <action>` to skills. Hooks under `hooks/` auto-trigger skills on events.

**Tech Stack:** Claude Code Plugin System, Agent Skills SKILL.md format, Git, Markdown, JSON, Bash/CMD hooks

---

## Task 1: Initialize Git Repository

**Files:**
- Create: `D:/Project/Rune/.gitignore`
- Create: `D:/Project/Rune/README.md`
- Create: `D:/Project/Rune/LICENSE`

**Step 1: Init git repo**

Run: `cd D:/Project/Rune && git init`
Expected: Initialized empty Git repository

**Step 2: Create .gitignore**

```gitignore
# OS
.DS_Store
Thumbs.db
desktop.ini

# Node
node_modules/
*.log

# IDE
.idea/
.vscode/
*.swp
*.swo

# Rune local state (per-project, not in plugin)
.rune/

# Environment
.env
.env.local
```

**Step 3: Create LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 Rune Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 4: Create README.md**

```markdown
# Rune

**Less skills. Deeper connections.**

A lean, interconnected skill ecosystem for Claude Code that covers the full project lifecycle — from idea to revenue.

## Stats

- 35 core skills | 108 connections | 12 extension packs
- 4-layer architecture: Orchestrators → Workflow Hubs → Utilities → Extensions
- 85% pain point coverage (17/20 real-world dev problems solved)

## Install

```bash
/plugin marketplace add runedev/rune
/plugin install rune@runedev
```

## Philosophy

> "54 connected skills > 540 isolated skills" — but we took it further:
> 35 skills with 108 connections. Fewer skills, deeper connections.

## License

MIT (Core L1-L3). Extension packs (L4) sold separately.
```

**Step 5: Initial commit**

```bash
git add .gitignore LICENSE README.md
git commit -m "chore: init Rune repository"
```

---

## Task 2: Create Plugin Manifest & Directory Structure

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `skills/.gitkeep`
- Create: `commands/.gitkeep`
- Create: `agents/.gitkeep`
- Create: `hooks/.gitkeep`
- Create: `scripts/.gitkeep`
- Create: `docs/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p .claude-plugin skills commands agents hooks scripts docs/plans
```

**Step 2: Create plugin.json**

```json
{
  "name": "rune",
  "description": "Less skills. Deeper connections. A lean, interconnected skill ecosystem for Claude Code.",
  "version": "0.1.0",
  "author": {
    "name": "Rune Contributors"
  },
  "homepage": "https://github.com/runedev/rune",
  "repository": "https://github.com/runedev/rune",
  "license": "MIT",
  "keywords": [
    "skills",
    "workflow",
    "orchestration",
    "mesh",
    "tdd",
    "debugging",
    "refactoring",
    "security",
    "deployment"
  ]
}
```

**Step 3: Create marketplace.json**

```json
{
  "name": "runedev",
  "owner": {
    "name": "Rune Contributors"
  },
  "metadata": {
    "description": "Rune - Less skills. Deeper connections.",
    "version": "0.1.0"
  },
  "plugins": [
    {
      "name": "rune",
      "source": "./",
      "description": "Core Rune skills ecosystem (L1-L3)",
      "version": "0.1.0",
      "category": "workflow",
      "tags": ["skills", "orchestration", "mesh", "workflow"]
    }
  ]
}
```

**Step 4: Add .gitkeep files to empty dirs**

```bash
touch skills/.gitkeep commands/.gitkeep agents/.gitkeep hooks/.gitkeep scripts/.gitkeep docs/.gitkeep
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add plugin manifest and directory structure"
```

---

## Task 3: Create Skill File Format Template

**Files:**
- Create: `docs/SKILL-TEMPLATE.md`
- Create: `docs/ARCHITECTURE.md`

**Step 1: Create skill template**

This is the standard template every Rune skill MUST follow. It extends the Agent Skills SKILL.md spec with Rune-specific sections (Layer, Calls, Called By).

```markdown
---
name: skill-name
description: One-line description of what this skill does and when to use it.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1|L2|L3
  model: haiku|sonnet|opus
  group: creation|development|quality|delivery|rescue|knowledge|reasoning|validation|state|monitoring|media|deps
---

# skill-name

## Purpose

One paragraph describing the skill's role in the Rune ecosystem.

## Triggers

- `/rune <command>` — manual invocation
- Auto-trigger conditions (file patterns, error types, etc.)

## Calls (outbound connections)

- `skill-name` (L2|L3): condition when this skill calls it

## Called By (inbound connections)

- `skill-name` (L1|L2): condition when called

## Workflow

Step-by-step execution flow.

## Cost Profile

Estimated token usage per invocation.
```

**Step 2: Create architecture doc**

```markdown
# Rune Architecture

## 4-Layer Model

| Layer | Name | Count | Can Call | Called By | State |
|-------|------|-------|----------|----------|-------|
| L1 | Orchestrators | 4 | L2, L3 | User only | Stateful (workflow) |
| L2 | Workflow Hubs | 15 | L2 (cross-hub), L3 | L1, L2 | Stateful (task) |
| L3 | Utilities | 16 | Nothing (pure) | L1, L2 | Stateless |
| L4 | Extension Packs | 12 | L3 | L2 (domain match) | Config-based |

## Mesh Protocol

### Loop Prevention
- No self-calls (history[-1] !== target)
- Max 2 visits to same skill per chain
- Max chain depth: 8
- If blocked → escalate to L1 orchestrator

### Model Auto-Selection
- Read-only/scan → haiku
- Write/edit/generate → sonnet
- Architecture/security → opus
- Priority: critical → always opus

### Parallel Execution
- L3 haiku: max 5 parallel
- L2 sonnet: max 3 parallel
- L1: max 1 at a time

## Skill Groups

### L1 Orchestrators
cook, team, launch, rescue

### L2 Workflow Hubs
- CREATION: plan, scout, brainstorm
- DEVELOPMENT: debug, fix, test, review
- QUALITY: sentinel, preflight, onboard
- DELIVERY: deploy, marketing
- RESCUE: autopsy, safeguard, surgeon

### L3 Utilities
- KNOWLEDGE: research, docs-seeker, trend-scout
- REASONING: problem-solver, sequential-thinking
- VALIDATION: verification, hallucination-guard
- STATE: context-engine, journal, session-bridge
- MONITORING: watchdog, scope-guard
- MEDIA: browser-pilot, asset-creator, video-creator
- DEPS: dependency-doctor
```

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: add skill template and architecture reference"
```

---

## Task 4: Create Hook System (Session Start)

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/run-hook.cmd`
- Create: `hooks/session-start/index.js`

**Step 1: Create hooks.json**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "'${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd' session-start",
            "async": false
          }
        ]
      }
    ]
  }
}
```

**Step 2: Create run-hook.cmd (Windows-compatible polyglot)**

```bash
#!/usr/bin/env bash
":" //; exec node "$0" "$@"

// Polyglot script: runs as bash on Unix, node on Windows
const { execSync } = require('child_process');
const path = require('path');

const hookName = process.argv[2];
if (!hookName) {
  console.error('Usage: run-hook <hook-name>');
  process.exit(1);
}

const hookPath = path.join(__dirname, hookName, 'index.js');
try {
  require(hookPath);
} catch (e) {
  console.error(`Hook ${hookName} failed: ${e.message}`);
  process.exit(1);
}
```

**Step 3: Create session-start hook**

```javascript
// hooks/session-start/index.js
// Rune Session Start Hook
// Loads .rune/ state files if they exist in the project directory

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const runeDir = path.join(cwd, '.rune');

if (fs.existsSync(runeDir)) {
  const stateFiles = ['progress.md', 'decisions.md', 'conventions.md', 'RESCUE-STATE.md'];
  const loaded = [];

  for (const file of stateFiles) {
    const filePath = path.join(runeDir, file);
    if (fs.existsSync(filePath)) {
      loaded.push(file);
    }
  }

  if (loaded.length > 0) {
    console.log(`Rune: Loaded project state (${loaded.join(', ')})`);
  } else {
    console.log('Rune: Project initialized but no state files yet.');
  }
} else {
  console.log('Rune: No .rune/ directory found. Run /rune onboard to set up.');
}
```

**Step 4: Commit**

```bash
git add hooks/
git commit -m "feat: add session-start hook for state loading"
```

---

## Task 5: Create First Skill — scout (L2, haiku)

**Files:**
- Create: `skills/scout/SKILL.md`

**Why scout first:** Scout is the MOST-CALLED skill in the mesh (8 inbound connections). Every other skill depends on it. Building it first validates the skill format and provides immediate utility.

**Step 1: Create scout skill**

```markdown
---
name: scout
description: Fast codebase scanner. Finds files, patterns, dependencies, and project structure. Use when any skill needs to understand the codebase before acting. Most-called skill in the Rune mesh.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: haiku
  group: creation
---

# scout

## Purpose

Fast, lightweight codebase scanning. Scout is the eyes of the Rune ecosystem — it finds files, maps structure, identifies patterns, and provides context to every other skill. Runs on haiku for speed and cost efficiency.

## Triggers

- Called by other skills (plan, debug, review, fix, cook, team, sentinel, preflight, onboard, autopsy)
- `/rune scout` — manual scan
- Auto-trigger: when any L2 skill needs codebase context

## Calls (outbound)

None — scout is a pure scanner using Glob/Grep/Read tools.

## Called By (inbound)

- `plan` (L2): scan codebase before planning
- `debug` (L2): find related code for root cause analysis
- `review` (L2): find related code for context during review
- `fix` (L2): understand dependencies before changing code
- `cook` (L1): Phase 1 UNDERSTAND — scan codebase
- `team` (L1): understand full project scope
- `sentinel` (L2): scan changed files for security issues
- `preflight` (L2): find affected code paths
- `onboard` (L2): full project scan for CLAUDE.md generation
- `autopsy` (L2): comprehensive health assessment

## Workflow

1. **Receive scan request** with search patterns, file types, or questions
2. **Structure scan** — map directory tree, count files/LOC per module
3. **Pattern search** — use Glob for file patterns, Grep for content
4. **Dependency map** — identify imports, exports, module relationships
5. **Return results** — structured output for calling skill to consume

## Output Format

```
## Scout Report
- **Project**: [name] | **Framework**: [detected] | **Language**: [detected]
- **Files**: [count] | **LOC**: [count] | **Modules**: [count]

### Relevant Files
- `path/to/file.ts` — [why relevant]
- `path/to/file.ts` — [why relevant]

### Dependencies
- [module] → [module] (import relationship)

### Observations
- [pattern noticed]
- [potential issue]
```

## Cost Profile

~500-2000 tokens input, ~200-500 tokens output. Always haiku. Fast.
```

**Step 2: Commit**

```bash
git add skills/scout/
git commit -m "feat: add scout skill (L2, haiku) — most-called skill in mesh"
```

---

## Task 6: Create First Command — /rune

**Files:**
- Create: `commands/rune.md`

**Step 1: Create rune command**

This is the main entry point. `/rune <action>` routes to the appropriate skill.

```markdown
---
description: "Rune skill ecosystem — interconnected workflows for the full project lifecycle. Use /rune <action> to invoke skills."
disable-model-invocation: true
---

# Rune — Less skills. Deeper connections.

Route to the appropriate Rune skill based on the action:

## Available Commands

### Orchestrators (L1)
- `/rune cook <task>` — Invoke the rune:cook skill for feature implementation
- `/rune team <task>` — Invoke the rune:team skill for parallel multi-agent work
- `/rune launch` — Invoke the rune:launch skill for deploy + marketing
- `/rune rescue` — Invoke the rune:rescue skill for legacy refactoring

### Workflow (L2)
- `/rune scout` — Invoke the rune:scout skill to scan codebase
- `/rune plan <task>` — Invoke the rune:plan skill to create implementation plan
- `/rune debug <issue>` — Invoke the rune:debug skill for root cause analysis
- `/rune review` — Invoke the rune:review skill for code quality review
- `/rune onboard` — Invoke the rune:onboard skill to generate project context

### Utilities
- `/rune status` — Show current project state from .rune/ files

## Usage

When the user runs `/rune <action>`, invoke the corresponding `rune:<action>` skill.
If no action is provided, show this help menu.
```

**Step 2: Commit**

```bash
git add commands/
git commit -m "feat: add /rune command router"
```

---

## Task 7: Create session-bridge Skill (L3, haiku) — Wave 1 Start

**Files:**
- Create: `skills/session-bridge/SKILL.md`

**Why session-bridge first in Wave 1:** It's CRITICAL priority, low effort, and every other skill benefits from cross-session state persistence.

**Step 1: Create session-bridge skill**

```markdown
---
name: session-bridge
description: Universal context persistence across sessions. Auto-saves decisions, conventions, and progress to .rune/ files. Loads state at session start. Use when any skill makes architectural decisions or establishes patterns that must survive session boundaries.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: haiku
  group: state
---

# session-bridge

## Purpose

Solve the #1 developer complaint: context loss across sessions. Session-bridge auto-saves critical context to `.rune/` files in the project directory, and loads them at session start. Every new session knows exactly where the last one left off.

## Triggers

- Auto-trigger: when an architectural decision is made
- Auto-trigger: when a convention/pattern is established
- Auto-trigger: before context compaction
- Auto-trigger: at session end (stop hook)
- `/rune status` — manual state check

## Calls (outbound)

None — pure state management (read/write .rune/ files).

## Called By (inbound)

- `cook` (L1): auto-save decisions during feature implementation
- `rescue` (L1): state management throughout refactoring
- `team` (L1): coordinate state across parallel agents
- `context-engine` (L3): save state before compaction

## State Files Managed

```
.rune/
├── decisions.md      — Architectural decisions log
├── conventions.md    — Established patterns & style
├── progress.md       — Task progress tracker
└── session-log.md    — Brief log of each session
```

## Workflow

### Save (auto-triggered or manual)

1. **Detect save trigger** — decision made, pattern established, or session ending
2. **Classify content**:
   - Architecture/tech choice → `decisions.md`
   - Naming/pattern convention → `conventions.md`
   - Task completion/progress → `progress.md`
   - Session summary → `session-log.md`
3. **Append to file** — never overwrite, always append with timestamp
4. **Confirm save** — brief message: "Rune: Saved decision to .rune/decisions.md"

### Load (session start)

1. **Check .rune/ exists** — if not, suggest `/rune onboard`
2. **Read all state files** — decisions, conventions, progress, session-log
3. **Inject as context** — "Here's what happened in previous sessions: ..."
4. **Resume work** — AI knows exactly where to continue

### Decision Log Format

```markdown
## [YYYY-MM-DD HH:MM] Decision: <title>

**Context:** Why this decision was needed
**Decision:** What was decided
**Rationale:** Why this approach over alternatives
**Impact:** What files/modules are affected
```

### Convention Log Format

```markdown
## [YYYY-MM-DD] Convention: <title>

**Pattern:** Description of the convention
**Example:** Code example showing the pattern
**Applies to:** Where this convention should be followed
```

### Progress Log Format

```markdown
## [YYYY-MM-DD HH:MM] Session Summary

**Completed:**
- [x] Task description

**In Progress:**
- [ ] Task description (step X/Y)

**Blocked:**
- [ ] Task description — reason

**Next Session Should:**
- Start with X
- Continue Y from step Z
```

## Cost Profile

~100-300 tokens per save. ~500-1000 tokens per load. Always haiku. Negligible cost.
```

**Step 2: Commit**

```bash
git add skills/session-bridge/
git commit -m "feat: add session-bridge skill (L3, haiku) — cross-session context persistence"
```

---

## Task 8: Test Plugin Locally

**Step 1: Verify plugin structure**

```bash
cd D:/Project/Rune
claude plugin validate .
```

Expected: No errors

**Step 2: Test local install**

```bash
claude --plugin-dir D:/Project/Rune
```

Expected: Rune plugin loads, `/rune` command available, session-start hook fires

**Step 3: Test scout skill**

In the Claude Code session with plugin loaded:
```
/rune scout
```

Expected: Scout skill loads and is ready to scan

**Step 4: Test session-bridge**

```
Ask Claude to make an architectural decision, verify it suggests saving to .rune/
```

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during local testing"
```

---

## Task 9: Create CLAUDE.md for Rune Project

**Files:**
- Create: `CLAUDE.md`

**Step 1: Create project-level CLAUDE.md**

```markdown
# Rune — Project Configuration

## Overview
Rune is a Claude Code plugin providing an interconnected skill ecosystem.
35 core skills | 108 connections | 4-layer mesh architecture.

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
- Run tests: (TBD — Wave 2)

## Current Wave
Wave 0 (Setup) → Wave 1 (session-bridge, sentinel, onboard, preflight)
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md project configuration"
```

---

## Summary

After completing all 9 tasks, the Rune repo will have:

```
D:/Project/Rune/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest v0.1.0
│   └── marketplace.json     # Self-hosted marketplace
├── skills/
│   ├── scout/SKILL.md       # First L2 skill (most-called)
│   └── session-bridge/SKILL.md  # First L3 skill (critical)
├── commands/
│   └── rune.md              # /rune command router
├── agents/                  # Empty (Wave 3)
├── hooks/
│   ├── hooks.json           # Hook definitions
│   ├── run-hook.cmd         # Polyglot runner
│   └── session-start/index.js  # Session start hook
├── scripts/                 # Empty (Wave 2)
├── docs/
│   ├── SKILL-TEMPLATE.md    # Standard skill format
│   ├── ARCHITECTURE.md      # 4-layer architecture reference
│   └── plans/
│       └── 2026-02-24-rune-wave0-setup.md  # This plan
├── .gitignore
├── CLAUDE.md
├── LICENSE                  # MIT
└── README.md
```

Git history: 8 clean commits following conventional commits.

**Next:** Wave 1 — build remaining critical skills (sentinel, onboard, preflight).
