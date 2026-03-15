---
name: context-engine
description: "Context window management. Auto-triggered when context is filling up. Triggers smart compaction and preserves critical information across compaction boundaries. Called by L1 orchestrators at context thresholds."
user-invocable: false
metadata:
  author: runedev
  version: "0.4.0"
  layer: L3
  model: haiku
  group: state
  tools: "Read, Glob, Grep"
---

# context-engine

## Purpose

Context window management for long sessions. Detects when context is approaching limits, triggers smart compaction preserving critical decisions and progress, and coordinates with session-bridge to save state before compaction. Prevents the common failure mode of losing important context mid-workflow.

### Behavioral Contexts

Context-engine also manages **behavioral mode injection** via `contexts/` directory. Three modes are available:

| Mode | File | When to Use |
|------|------|-------------|
| `dev` | `contexts/dev.md` | Active coding — bias toward action, code-first |
| `research` | `contexts/research.md` | Investigation — read widely, evidence-based |
| `review` | `contexts/review.md` | Code review — systematic, severity-labeled |

**Mode activation**: Orchestrators (cook, team, rescue) can set the active mode by writing to `.rune/active-context.md`. The session-start hook injects the active context file into the session. Mode switches mid-session are supported — the orchestrator updates the file and references the new behavioral rules.

**Default**: If no `.rune/active-context.md` exists, no behavioral mode is injected (standard Claude behavior).

## Triggers

- Called by `cook` and `team` automatically at context boundaries
- Auto-trigger: when tool call count exceeds threshold or context utilization is high
- Auto-trigger: before compaction events

## Calls (outbound)

# Exception: L3→L3 coordination
- `session-bridge` (L3): coordinate state save when context critical

## Called By (inbound)

- Auto-triggered at phase boundaries and context thresholds by L1 orchestrators

## Execution

### Step 1 — Count tool calls

Count total tool calls made so far in this session. This is the ONLY reliable metric — token usage is not exposed by Claude Code and any estimate will be dangerously inaccurate.

Do NOT attempt to estimate token percentages. Tool count is a directional proxy, not a precise measurement.

### Step 2 — Classify health

Map tool call count to health level:

```
GREEN   (<50 calls)    — Healthy, continue normally
YELLOW  (50-80 calls)  — Load only essential files going forward
ORANGE  (80-120 calls) — Recommend /compact at next logical boundary
RED     (>120 calls)   — Trigger immediate compaction, save state first
```

These thresholds are directional heuristics, not precise limits. Sessions with many large file reads may hit context limits earlier; sessions with mostly Grep/Glob may go longer.

#### Large-File Adjustment

Projects with large source files (Python modules often 500-1500 LOC, Java files similarly) consume significantly more context per `Read` call. If the session has read files averaging >500 lines, apply a 0.8x multiplier to all thresholds:

```
Adjusted thresholds (large-file sessions):
GREEN   (<40 calls)    — Healthy, continue normally
YELLOW  (40-65 calls)  — Load only essential files going forward
ORANGE  (65-100 calls) — Recommend /compact at next logical boundary
RED     (>100 calls)   — Trigger immediate compaction, save state first
```

Detection: count `Read` tool calls that returned >500 lines. If ≥3 such calls → activate large-file thresholds for the remainder of the session.

### Step 3 — If YELLOW

Emit advisory to the calling orchestrator:

> "[X] tool calls. Load only essential files. Avoid reading full files when Grep will do."

Do NOT trigger compaction yet. Continue execution.

### Step 4 — If ORANGE

Emit recommendation to the calling orchestrator:

> "[X] tool calls. Recommend /compact at next phase boundary (after current module completes)."

Identify the next safe boundary (end of current loop iteration, end of current file being processed) and flag it.

### Step 5 — If RED

Immediately trigger state save via `rune:session-bridge` (Save Mode) before any compaction occurs.

Pass to session-bridge:
- Current task and phase description
- List of files touched this session
- Decisions made (architectural choices, conventions established)
- Remaining tasks not yet started

After session-bridge confirms save, emit:

> "Context CRITICAL ([X] tool calls, likely near limit). State saved to .rune/. Run /compact now."

Block further tool calls until compaction is acknowledged.

### Step 6 — Report

Emit the context health report to the calling skill.

## Context Health Levels

```
GREEN   (<50 calls)    — Healthy, continue normally
YELLOW  (50-80 calls)  — Load only essential files
ORANGE  (80-120 calls) — Recommend /compact at next logical boundary
RED     (>120 calls)   — Save state NOW via session-bridge, compact immediately
```

Note: These are tool call counts, NOT token percentages. Claude Code does not expose context utilization to skills. Tool count is a directional signal only.

## Output Format

```
## Context Health
- **Tool Calls**: [count]
- **Status**: GREEN | YELLOW | ORANGE | RED
- **Recommendation**: continue | load-essential-only | compact-at-boundary | compact-immediately
- **Note**: Tool count is a directional proxy. Check CLI status bar for actual context usage.

### Critical Context (preserved on compaction)
- Task: [current task]
- Phase: [current phase]
- Decisions: [count saved to .rune/]
- Files touched: [list]
- Blockers: [if any]
```

## Constraints

1. MUST preserve context fidelity — no summarizing away critical details
2. MUST flag context conflicts between skills — never silently pick one
3. MUST NOT inject stale context from previous sessions without marking it as historical

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Triggering compaction without saving state first | CRITICAL | Step 5 (RED): session-bridge MUST run before any compaction — state loss is irreversible |
| Blocking tool calls when context is ORANGE (not RED) | MEDIUM | ORANGE = recommend only; blocking is only for RED (>120 calls) |
| Injecting stale context from previous session without marking it historical | HIGH | Constraint 3: all loaded context must include session date marker |
| Premature compaction from over-estimated utilization | MEDIUM | Tool count is directional only — sessions with heavy Read calls may need lower thresholds; only block at confirmed RED |
| Not activating large-file adjustment on Python/Java codebases | MEDIUM | Track Read calls returning >500 lines; if ≥3 occur, switch to adjusted (0.8x) thresholds for the session |

## Done When

- Tool call count captured
- Health level classified from count thresholds (GREEN / YELLOW / ORANGE / RED)
- Appropriate advisory emitted matching health level (no advisory for GREEN)
- If RED: session-bridge called and confirmed saved before compaction signal
- Context Health Report emitted with tool count, status, and recommendation

## Cost Profile

~200-500 tokens input, ~100-200 tokens output. Haiku for minimal overhead. Runs frequently as a background monitor.
