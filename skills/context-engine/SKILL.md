---
name: context-engine
description: "Context window management. Auto-triggered when context is filling up. Triggers smart compaction and preserves critical information across compaction boundaries. Called by L1 orchestrators at context thresholds."
user-invocable: false
metadata:
  author: runedev
  version: "0.6.0"
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

### Step 6b — Context Percentage Advisory

In addition to tool-call counting, monitor context window percentage when available:

| Remaining | Level | Action |
|-----------|-------|--------|
| >35% | SAFE | Continue normally |
| 25-35% | WARNING | Advise: "Context at ~[X]%. Consider /compact at next phase boundary" |
| <25% | CRITICAL | Save state via session-bridge → recommend immediate /compact |

Debounce: emit advisory max once per 5 tool calls to avoid noise.
Tool-call thresholds (Steps 1-2) remain the primary signal. Percentage advisory is supplementary — use when CLI status bar data is available.

## Iterative Retrieval (Context-Loading Strategy)

When loading context for a task (Phase 1 of cook, or onboard), use a 4-phase retrieval loop instead of loading everything at once:

```
1. DISPATCH (broad): Search with initial task keywords → get 5-10 candidate files
2. EVALUATE: Score each file's relevance (0-1). Note codebase-specific terminology discovered
3. REFINE: Use discovered terms to search again with better keywords
4. LOOP: Repeat max 3 cycles. STOP when 3 high-relevance files found (not 10 mediocre ones)
```

**Why**: The first search cycle reveals codebase-specific terms (custom class names, project conventions, internal APIs) that produce much better results in cycle 2. Loading 3 deeply relevant files beats loading 10 surface-level matches.

**Key rule**: Stop at 3 high-relevance files, not 10 mediocre ones. Quality > quantity for context loading.

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

## Strategic Compact Decision Table

When ORANGE or RED is reached, use this table to determine whether compaction is safe at the current boundary:

| Transition | Compact? | Reason |
|-----------|----------|--------|
| Research → Planning | YES | Research findings summarize well; key decisions survive |
| Planning → Implementation | YES | Plan is in files (.rune/plan-*.md); context can reload from artifacts |
| Debug → Next feature | YES | Debug findings are in Debug Report; fix has the diagnosis |
| Mid-implementation (Phase 4) | **NO** | Losing file paths, partial changes, and test state is catastrophic |
| After failed approach → Pivot | YES | Failed approach should be discarded; fresh context helps |
| Quality (Phase 5) → Verify | **NO** | Quality findings reference specific file:line in current context |
| After commit (Phase 7) | YES | Work is persisted in git; safe boundary |

**What survives compaction**: Task description, file paths mentioned, key decisions, plan reference, current phase.
**What is lost**: Full file contents read, intermediate reasoning, exact error messages, tool output details.

## Context Budget Audit (Baseline Cost Awareness)

MCP tool schemas and agent descriptions consume significant baseline context before any work begins. This section helps identify and reduce invisible context waste.

### Token Cost Reference

| Source | Approx. Cost | Loaded When |
|--------|-------------|-------------|
| Each MCP tool schema | ~500 tokens | Session start (always) |
| Each agent description | ~200-400 tokens | Every `Task()` invocation |
| CLAUDE.md | ~100-2000 tokens | Session start (always) |
| Skill SKILL.md (full load) | ~500-3000 tokens | When skill is invoked |

### Budget Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| Max MCP servers | <10 active | Disable unused MCP servers in settings |
| Max MCP tools | <80 total | Remove or consolidate bloated MCP servers |
| Agent descriptions | Only load needed | Use specific `subagent_type` to avoid loading all descriptions |
| CLAUDE.md size | <150 lines | Move detailed docs to `.rune/` files, keep CLAUDE.md as index |

### Audit Procedure

When context health is YELLOW or worse, or when onboard detects >80 MCP tools:

1. Count total MCP tool schemas loaded (from session start messages)
2. Count agent descriptions available
3. Estimate baseline cost: `(tools × 500) + (agents × 300) + CLAUDE.md tokens`
4. If baseline >15% of estimated context window → flag as **Context Budget Warning**
5. Rank MCP servers by tool count — suggest disabling servers with most tools and least usage

### Report Addition

When Context Budget Warning fires, append to Context Health report:

```
### Context Budget
- **Baseline cost**: ~[N]k tokens ([X]% of estimated window)
- **MCP tools loaded**: [count] across [N] servers
- **Top consumers**: [server1] ([N] tools), [server2] ([N] tools)
- **Recommendation**: Disable [server] to save ~[N]k tokens
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
