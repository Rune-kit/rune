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
- `surgeon` (L2): scan module before refactoring
- `marketing` (L2): scan codebase for feature descriptions
- `safeguard` (L2): scan module boundaries before adding safety net

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

### Dependencies
- [module] → [module] (import relationship)

### Observations
- [pattern noticed]
- [potential issue]
```

## Cost Profile

~500-2000 tokens input, ~200-500 tokens output. Always haiku. Fast.
