# Phase 3: Spawn-Agent Integration (Antigravity + Windsurf + Generic)

## Goal
Integrate the spawn-agent delegation pattern into non-Claude adapters so platforms without native subagent support can still delegate scoped tasks to worker agents (Gemini CLI or Codex CLI). This solves the context overflow problem on Antigravity and other platforms where all work happens in a single context window.

## Problem
On Claude Code, `Agent` tool forks context — worker runs in isolation, main context stays clean. On Antigravity/Windsurf/Generic, there is NO subagent system. Current transform converts "parallel agents" to "sequential steps" — but this means ALL work stays in one context → overflow → degraded performance on large tasks.

## Solution
Adopt spawn-agent pattern (credit: khanhbkqt/spawn-agent): emit a shell script + task templates alongside skill files. Rewrite subagent instructions to use the spawn script instead of collapsing to sequential.

## Data Flow
```
rune build --platform antigravity --output <project>
  -> existing pipeline (skills, extensions, index)
  -> NEW: emit spawn-agent.sh to .agent/scripts/
  -> NEW: emit task templates to .agent/scripts/templates/
  -> NEW: transformSubagentInstruction rewrites Agent references → spawn-agent delegation
  -> NEW: emit orchestrator-guide.md to .agent/rules/ (delegation protocol)
```

## Code Contracts

### Updated subagents transform
```javascript
// compiler/transforms/subagents.js
// Instead of collapsing to sequential, rewrite to spawn-agent delegation
// when adapter.hasSpawnAgent === true

// Before: "Launch 3 parallel agents" → "Execute the following 3 steps sequentially"
// After:  "Launch 3 parallel agents" → "Delegate these 3 tasks using spawn-agent.sh"
```

### Adapter flag
```javascript
// compiler/adapters/antigravity.js (+ windsurf.js, generic.js)
export default {
  ...
  hasSpawnAgent: true,
  transformSubagentInstruction(text) {
    // Rewrite Agent tool references to spawn-agent.sh delegation
  },
};
```

### Emitter additions
```javascript
// compiler/emitter.js
// After skill emission, if adapter.hasSpawnAgent:
//   1. Copy spawn-agent.sh to <outputDir>/../scripts/spawn-agent.sh
//   2. Copy task templates to <outputDir>/../scripts/templates/
//   3. Emit orchestrator-guide rule file
```

## Tasks
- [ ] Task 1 -- Create spawn-agent script for Rune
  - File: `compiler/assets/spawn-agent.sh` (new, ~180 lines)
  - Adapted from khanhbkqt/spawn-agent but Rune-branded
  - Supports: `--gemini`, `--codex`, `--claude` (claude CLI as worker too)
  - Approval modes: `--yolo`, `--auto-edit`, `--safe`
  - Prompt via `-p "text"` or `-f file.md`
  - Output to `.agent/spawn_agent_tasks/output-<timestamp>.log`
  - Timeout with `--timeout` flag
  - Key difference from original: add `--claude` agent option for spawning claude CLI as worker
- [ ] Task 2 -- Create Rune task templates
  - Files: `compiler/assets/templates/` (new directory, 3 files)
    - `implementation-task.md` — for cook/fix style work
    - `research-task.md` — for scout/research style work
    - `bugfix-task.md` — for debug/fix style work
  - Adapted from spawn-agent templates but aligned with Rune skill terminology
  - Templates reference Rune patterns (verification commands, report format)
- [ ] Task 3 -- Create orchestrator guide rule
  - File: `compiler/assets/rune-orchestrator-guide.md` (new)
  - Content: delegation protocol for the main agent
    - When to delegate vs do yourself (maps to Rune skill complexity)
    - How to write self-contained prompts (worker has ZERO context)
    - spawn-agent.sh usage examples
    - Review protocol (always read output, verify changes)
  - This gets emitted as a rule file alongside skills
- [ ] Task 4 -- Update subagents transform
  - File: `compiler/transforms/subagents.js` (modify)
  - Add spawn-agent aware patterns when `adapter.hasSpawnAgent === true`:
    - "Launch N parallel agents" → "Delegate these N tasks via spawn-agent.sh (one at a time, review between each)"
    - "Use Agent tool" → "Use spawn-agent.sh to delegate"
    - "spawn subagent" → "spawn-agent.sh --gemini --auto-edit"
    - Keep existing sequential fallback for adapters without hasSpawnAgent
  - Edge: don't rewrite if already inside a code block (```)
- [ ] Task 5 -- Update adapters with hasSpawnAgent + transformSubagentInstruction
  - Files: `compiler/adapters/antigravity.js`, `windsurf.js`, `generic.js` (modify)
  - Add `hasSpawnAgent: true` to each
  - Update `transformSubagentInstruction(text)` to add delegation hints:
    - Append spawn-agent usage tip after subagent sections
    - Rewrite "Agent tool" references to spawn-agent invocation
  - DO NOT modify claude.js or cursor.js (Claude has native Agent, Cursor has no shell)
  - DO NOT modify openclaw.js (OpenClaw has its own plugin system)
- [ ] Task 6 -- Update emitter to emit spawn-agent assets
  - File: `compiler/emitter.js` (modify)
  - After skill emission, if `adapter.hasSpawnAgent`:
    - Copy `compiler/assets/spawn-agent.sh` → `<outputRoot>/<scriptsDir>/spawn-agent.sh`
    - Copy `compiler/assets/templates/*.md` → `<outputRoot>/<scriptsDir>/templates/`
    - Emit `rune-orchestrator-guide.md` as a rule file in outputDir
    - scriptsDir: `.agent/scripts` (antigravity), `.windsurf/scripts` (windsurf), `.ai/scripts` (generic)
  - Update stats to include emitted asset count
- [ ] Task 7 -- Update CLI guide with spawn-agent section
  - File: `docs/guides/cli.md` (modify)
  - Add "Context Delegation" section after Extension Packs
  - Explain: what spawn-agent is, which platforms get it, how to use it
  - Note: Claude Code and OpenClaw don't need it (native subagent support)
- [ ] Task 8 -- Write tests
  - File: `compiler/__tests__/spawn-agent.test.js` (new)
  - Cases:
    - subagents transform rewrites patterns when hasSpawnAgent=true
    - subagents transform still collapses to sequential when hasSpawnAgent=false
    - antigravity/windsurf/generic adapters have hasSpawnAgent=true
    - claude/cursor/openclaw adapters do NOT have hasSpawnAgent
    - transformSubagentInstruction adds delegation hints

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| spawn-agent.sh not executable | Worker fails to launch | Permissions -- emitter should set chmod +x |
| Neither gemini nor codex installed | Script exits with error | Runtime -- script shows install instructions |
| Worker modifies files outside scope | Scope creep | Design -- templates must include off-limits section |
| Output log too large for orchestrator context | Context pollution returns | Design -- orchestrator should `tail -50` not `cat` full log |
| Cursor adapter gets hasSpawnAgent | Cursor can't run shell scripts | Logic -- only antigravity/windsurf/generic get the flag |

## Rejection Criteria (DO NOT)
- DO NOT add spawn-agent to Claude Code adapter -- it has native Agent tool
- DO NOT add spawn-agent to Cursor adapter -- Cursor rules are passive, can't invoke shell
- DO NOT add spawn-agent to OpenClaw adapter -- OpenClaw has its own plugin hook system
- DO NOT make spawn-agent a hard dependency -- skills must still work without it (graceful degradation)
- DO NOT copy spawn-agent verbatim -- adapt and Rune-brand it (MIT license allows this)

## Cross-Phase Context
- **Assumes**: Phase 1-2 completed (CLI guide, OpenClaw adapter)
- **Exports**: Non-Claude platforms get context delegation capability
- **Interface contract**: `adapter.hasSpawnAgent` boolean flag, `transformSubagentInstruction()` method

## Acceptance Criteria
- [ ] `compiler/assets/spawn-agent.sh` exists and is valid bash
- [ ] `compiler/assets/templates/` has 3 task templates
- [ ] `compiler/assets/rune-orchestrator-guide.md` exists
- [ ] `rune build --platform antigravity` emits spawn-agent.sh + templates + orchestrator guide
- [ ] `rune build --platform windsurf` emits spawn-agent.sh + templates + orchestrator guide
- [ ] `rune build --platform generic` emits spawn-agent.sh + templates + orchestrator guide
- [ ] `rune build --platform claude` does NOT emit spawn-agent assets
- [ ] `rune build --platform cursor` does NOT emit spawn-agent assets
- [ ] `rune build --platform openclaw` does NOT emit spawn-agent assets
- [ ] Subagent instructions in skills are rewritten to spawn-agent delegation (not sequential collapse)
- [ ] All tests pass
- [ ] CLI guide updated with context delegation section
