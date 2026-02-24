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

### Workflow (L2) — Creation
- `/rune plan <task>` — Invoke the rune:plan skill to create implementation plan
- `/rune scout` — Invoke the rune:scout skill to scan codebase
- `/rune brainstorm <topic>` — Invoke the rune:brainstorm skill for creative ideation

### Workflow (L2) — Development
- `/rune debug <issue>` — Invoke the rune:debug skill for root cause analysis
- `/rune fix <issue>` — Invoke the rune:fix skill to apply code changes
- `/rune test` — Invoke the rune:test skill to write and run tests
- `/rune review` — Invoke the rune:review skill for code quality review

### Workflow (L2) — Quality
- `/rune sentinel` — Invoke the rune:sentinel skill for security scanning
- `/rune preflight` — Invoke the rune:preflight skill for pre-commit quality gate
- `/rune onboard` — Invoke the rune:onboard skill to generate project context

### Workflow (L2) — Delivery
- `/rune deploy` — Invoke the rune:deploy skill for deployment management
- `/rune marketing` — Invoke the rune:marketing skill for launch asset creation

### Workflow (L2) — Rescue
- `/rune autopsy` — Invoke the rune:autopsy skill for codebase health assessment
- `/rune safeguard` — Invoke the rune:safeguard skill to build safety nets for legacy code
- `/rune surgeon` — Invoke the rune:surgeon skill for incremental refactoring

### Utilities (L3) — Knowledge
- `/rune research <topic>` — Invoke the rune:research skill for web research
- `/rune docs-seeker <query>` — Invoke the rune:docs-seeker skill for documentation lookup
- `/rune trend-scout <topic>` — Invoke the rune:trend-scout skill for market intelligence

### Utilities (L3) — Reasoning
- `/rune problem-solver <problem>` — Invoke the rune:problem-solver skill for structured reasoning
- `/rune sequential-thinking <problem>` — Invoke the rune:sequential-thinking skill for multi-variable analysis

### Utilities (L3) — Validation
- `/rune verification` — Invoke the rune:verification skill to run lint, type-check, tests, build
- `/rune hallucination-guard` — Invoke the rune:hallucination-guard skill to verify imports and APIs

### Utilities (L3) — State
- `/rune context-engine` — Invoke the rune:context-engine skill for context window management
- `/rune journal` — Invoke the rune:journal skill for rescue state tracking
- `/rune session-bridge` — Invoke the rune:session-bridge skill for cross-session persistence

### Utilities (L3) — Monitoring
- `/rune watchdog` — Invoke the rune:watchdog skill for post-deploy monitoring
- `/rune scope-guard` — Invoke the rune:scope-guard skill for scope creep detection

### Utilities (L3) — Media
- `/rune browser-pilot <url>` — Invoke the rune:browser-pilot skill for Playwright automation
- `/rune asset-creator <brief>` — Invoke the rune:asset-creator skill for visual asset generation
- `/rune video-creator <brief>` — Invoke the rune:video-creator skill for video content planning

### Utilities (L3) — Deps
- `/rune dependency-doctor` — Invoke the rune:dependency-doctor skill for dependency management

### Quick Actions
- `/rune status` — Show current project state from .rune/ files

## Usage

When the user runs `/rune <action>`, invoke the corresponding `rune:<action>` skill.
If no action is provided, show this help menu.
