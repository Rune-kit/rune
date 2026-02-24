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
- `/rune sentinel` — Invoke the rune:sentinel skill for security scanning
- `/rune preflight` — Invoke the rune:preflight skill for pre-commit quality gate
- `/rune onboard` — Invoke the rune:onboard skill to generate project context

### Utilities (L3)
- `/rune status` — Show current project state from .rune/ files

## Usage

When the user runs `/rune <action>`, invoke the corresponding `rune:<action>` skill.
If no action is provided, show this help menu.
