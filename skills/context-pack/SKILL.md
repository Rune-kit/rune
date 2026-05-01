---
name: context-pack
description: "Creates structured handoff briefings between agents. Use when delegating complex work to subagents that would otherwise lose context. Packages task context, constraints, and progress into a compact packet that subagents can consume without re-reading the full conversation. Prevents the 'lost context' problem in multi-agent delegation."
user-invocable: false
metadata:
  author: runedev
  version: "0.3.0"
  layer: L3
  model: haiku
  group: state
  tools: "Read, Glob, Grep"
---

# context-pack

## Purpose

When a parent agent delegates work to a subagent, critical context gets lost — the subagent starts fresh without knowing what was tried, what failed, what constraints apply, or what the parent already decided. Context-pack solves this by creating structured handoff briefings (context packets) that compress the essential information into a compact, parseable format. The packet is small enough to fit in a subagent's system prompt but complete enough to prevent redundant work and constraint violations.

## Triggers

- Called by `cook`, `team`, `rescue` before spawning subagents
- Called by any L1/L2 skill that delegates work to another skill
- Manual: when user says "hand off", "delegate", "split this task"

## Calls (outbound)

- `session-bridge` (L3): read persisted state for inclusion in packet
- `context-engine` (L3): check current context budget before deciding packet size

## Called By (inbound)

- `cook` (L1): before Phase 2-5 subagent spawning
- `team` (L1): before dispatching parallel workstreams
- `rescue` (L1): before delegating module-level refactoring
- `scaffold` (L1): before delegating component generation
- Any L2 skill that spawns subagents

## Data Flow

### Feeds Into →

- All subagent invocations: context packet → subagent system prompt
- `completion-gate` (L3): packet's success criteria → claim validation baseline

### Fed By ←

- Parent agent conversation: decisions, constraints, failed attempts
- `session-bridge` (L3): persisted state from prior sessions
- `plan` (L2): phase files with task breakdowns

## Workflow

1. **COLLECT** — Gather context from the current conversation:
   - Task description and user intent (verb-led behavioral phrasing)
   - Decisions already made (and WHY)
   - Constraints and hard-stops
   - Failed attempts (what NOT to do)
   - Files already read or modified
   - Current progress state
   - **Type Surface** — types / function signatures / contracts that callers cross. These are the durable spine of the brief.

2. **COMPRESS** — Reduce to essential information:
   - Strip conversational noise
   - Deduplicate repeated context
   - Prioritize by relevance to the delegated task
   - Target: <500 tokens for simple tasks, <1500 tokens for complex

3. **STRUCTURE** — Format as a context packet (v2 — see Output Format and [references/brief-template.md](references/brief-template.md))

4. **VALIDATE** — Check packet completeness:
   - Does it include the task goal?
   - Does it include constraints that could cause failure?
   - Does it include what was already tried?
   - Does it include `### Out of scope`? (mandatory)
   - Does it include `### Type Surface` (mandatory if task >= 300 tokens)?
   - Is it small enough for the target agent's context budget?

5. **PHASE 4.5 — SMELL TESTS** — Run mechanical regex gates before emit. See [references/durability-rules.md](references/durability-rules.md).

   | Regex | Tier | Reason |
   |-------|------|--------|
   | `\b\S+\.[a-z]{1,4}:\d+\b` | BLOCK | file:line reference (e.g., `login.ts:42`) — line numbers go stale |
   | `^- \S*[\\/]\S+\.(ts\|js\|py\|go\|rs\|java)\b` outside `### Files Touched` | BLOCK | Path-only bullet in narrative |
   | `\b(line \|on line )\d+\b` | BLOCK | "line 42" / "on line 100" |
   | `\b(src\|lib\|app)/\S+` in narrative paragraphs | WARN | Path mention; verify it belongs in Files Touched section |

   <HARD-GATE>
   Any BLOCK-tier match → DO NOT emit. Rewrite the offending lines to use type/function/module names.
   Missing `### Out of scope` section → DO NOT emit (completion-gate rejects).
   Missing `### Type Surface` for tasks >= 300 tokens → DO NOT emit.
   </HARD-GATE>

6. **EMIT** — Send the validated packet to the receiving agent.

## Output Format (v2)

```markdown
## Context Packet

**Task**: [One-line behavioral description, verb-led]
**Parent**: [delegating skill]
**Scope**: [type names / module names — NOT file paths]

### Decisions Made
- [Decision]: chose [X] over [Y] because [reason]

### Constraints
- MUST: [behavioral assertion]
- MUST NOT: [behavioral prohibition]
- BLOCKED BY: [contract dependency, not file path]

### Already Tried
- [approach] — [observable failure mode]

### Type Surface (durable)
- `TypeName { field: type }` — [what it represents]
- `Module.method(input: T): Result<O, E>` — [contract]

### Files Touched (locator-only, may rename)
- `path/to/file.ts` (TypeName, Module.method) — [behavioral hint]

### Acceptance Criteria
- [ ] [verb-led testable statement starting with: accepts, rejects, produces, notifies, persists, retries, times-out, validates, returns, dispatches, redirects, throws, logs, increments, decrements, retrieves, emits, caches, invalidates, authenticates]
- [ ] ...

### Out of scope
- [Thing the receiver should NOT do]
- (or "(none)" if explicitly empty)

### Progress
- [partial state if mid-handoff — omit if fresh start]
```

Full template + worked examples: [references/brief-template.md](references/brief-template.md).

## Variant: Agent Brief (Async / Durable Handoff)
<MUST-READ path="references/agent-brief.md" trigger="when handing off to an AFK agent, an issue tracker queue, autopilot, or any receiver that may execute hours/days later"/>

The standard packet (above) is for **immediate** sub-agent dispatch in the same session. When the handoff target is async — issue tracker, scheduled cron agent, `rune:autopilot` (Pro) for multi-session work, or any receiver that may execute hours or days later — switch to the **agent brief** variant.

Agent brief adds two durability principles on top of the standard packet:

1. **Durability over precision** — describe interfaces, types, and behavioral contracts. NEVER reference line numbers in narrative. File paths only in `### Files Touched` (locator-only, may rename).
2. **Behavioral, not procedural** — describe WHAT the system should do, not HOW to implement it. The async agent will explore the codebase fresh.

Additional BLOCK-tier checks for agent briefs (on top of the standard smell tests):
- `**Category:**` line present (`bug` / `enhancement` / `refactor`)
- Both `**Current behavior:**` and `**Desired behavior:**` sections present
- Acceptance criteria are independently testable (each pass/fail alone)
- `**Key interfaces:**` names types/functions, not file paths

Full template + worked examples: [references/agent-brief.md](references/agent-brief.md).

## Returns

| Field | Type | Description |
|-------|------|-------------|
| `packet` | markdown | Structured context packet ready for subagent injection |
| `token_estimate` | number | Estimated token count of the packet |
| `completeness` | enum | `full` / `partial` / `minimal` — how much context was captured |
| `warnings` | string[] | Missing context that could cause subagent failure |

## Constraints

1. MUST include task goal and acceptance criteria — subagent needs to know when it's done
2. MUST include failed attempts — prevents subagent from repeating mistakes
3. MUST include hard-stop constraints — prevents constraint violations in delegated work
4. MUST NOT exceed 2000 tokens — context packets that are too large defeat the purpose
5. MUST NOT include full file contents — use type names + summaries instead
6. MUST NOT fabricate context — only include information from the actual conversation
7. MUST emit `### Out of scope` section — empty `(none)` allowed, missing section is rejected by completion-gate
8. MUST emit `### Type Surface` section for tasks >= 300 tokens — durable contract spine
9. MUST pass all BLOCK-tier smell tests — no file:line references, no "line N", no narrative path-only bullets
10. MUST use behavior verbs in Acceptance Criteria — shape verbs ("is defined", "has property") rejected

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Packet too large (>2000 tokens) | HIGH | Compress aggressively — type names not file contents, decisions not discussions |
| Missing constraint causes subagent violation | CRITICAL | Always scan for MUST/MUST NOT in parent conversation |
| Stale context from prior session included | MEDIUM | Cross-check session-bridge state with current files |
| Over-constraining subagent with parent's approach | MEDIUM | Include constraints and goals, not implementation approach (unless approach is the constraint) |
| File:line references in packet (rotting briefs) | CRITICAL | Phase 4.5 BLOCK gate — regex `\b\S+\.[a-z]{1,4}:\d+\b` catches them; rewrite to type/function names |
| Narrative paragraphs with bare paths (`src/auth/`) | MEDIUM | WARN tier — surface and rewrite or move to Files Touched table |
| Missing Type Surface section for non-trivial task | HIGH | Mandatory for tasks >= 300 tokens; the durable spine is what survives file moves |
| Missing Out of scope section | HIGH | Always required (even "(none)"); completion-gate rejects briefs without it |
| Acceptance Criteria using shape verbs ("is defined", "has property") | MEDIUM | Rewrite to behavior verbs from the whitelist |
| Async handoff (issue tracker / autopilot / scheduled run) emitted as standard packet | HIGH | Switch to agent-brief variant (`references/agent-brief.md`) — standard packet rots when receiver runs hours/days later. Brief adds durability rules: behavioral not procedural, no line numbers in narrative |
| Agent brief with file:line references in narrative ("change `auth.ts:42`") | CRITICAL | Brief BLOCK gate — line numbers go stale on first edit. Reference type names, function signatures, contracts instead. File paths only in `### Files Touched` |
| Agent brief without `**Current behavior:**` AND `**Desired behavior:**` split | HIGH | Brief BLOCK gate — without the delta explicit, async agent cannot verify when work is done |

## Self-Validation

```
SELF-VALIDATION (run before emitting output):
- [ ] Packet includes a clear task goal (verb-led)
- [ ] Packet includes acceptance criteria (verb-led, testable, not vague)
- [ ] All MUST/MUST NOT constraints from parent are present
- [ ] Failed attempts are listed (if any exist)
- [ ] Token estimate is under 2000
- [ ] No full file contents embedded (type names + paths only)
- [ ] No file:line references anywhere (regex check)
- [ ] No bare-path narrative bullets outside Files Touched
- [ ] ### Out of scope section present (even if "(none)")
- [ ] ### Type Surface section present (if task >= 300 tokens)
- [ ] Files Touched entries include (TypeName, function) annotations
IF ANY check fails → fix before reporting done. Do NOT defer to completion-gate.
```

## Done When

- Context packet emitted in structured format
- Token estimate calculated and within budget
- All constraints from parent conversation captured
- Completeness level assessed honestly
- Self-Validation checklist: all checks passed

## Cost Profile

~200-500 input tokens (scanning conversation) + ~300-800 output tokens (generating packet). Haiku model — minimal cost per invocation.

**Scope guardrail**: Do not implement code changes, run tests, or modify files. Only produce context packets for handoff. If asked to do more, defer to the delegated skill.
