---
name: context-pack
description: "Creates structured handoff briefings between agents. Packages task context, constraints, and progress into a compact packet that subagents can consume without re-reading the full conversation. Prevents the 'lost context' problem in multi-agent delegation."
user-invocable: true
triggers:
  - pack context for subagent
  - create handoff briefing
  - delegate with context
  - hand off this task
  - pack context before delegating
  - create context packet
  - prepare agent handoff
  - pack task context
metadata:
  author: runedev
  version: "0.1.0"
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
   - Task description and user intent
   - Decisions already made (and WHY)
   - Constraints and hard-stops
   - Failed attempts (what NOT to do)
   - Files already read or modified
   - Current progress state

2. **COMPRESS** — Reduce to essential information:
   - Strip conversational noise
   - Deduplicate repeated context
   - Prioritize by relevance to the delegated task
   - Target: <500 tokens for simple tasks, <1500 tokens for complex

3. **STRUCTURE** — Format as a context packet (see Output Format)

4. **VALIDATE** — Check packet completeness:
   - Does it include the task goal?
   - Does it include constraints that could cause failure?
   - Does it include what was already tried?
   - Is it small enough for the target agent's context budget?

## Output Format

```markdown
## Context Packet

**Task**: [One-line description of what the subagent must do]
**Parent**: [Which skill/agent is delegating]
**Scope**: [Specific files, modules, or boundaries]

### Decisions Made
- [Decision 1]: [choice] — because [reason]
- [Decision 2]: [choice] — because [reason]

### Constraints
- MUST: [requirement 1]
- MUST NOT: [prohibition 1]
- BLOCKED BY: [dependency, if any]

### Already Tried
- [Approach that failed] — [why it failed]

### Files Touched
- `path/to/file.ts` — [what was done / what needs doing]

### Success Criteria
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]

### Progress
- [What's done so far, if partial handoff]
```

## Returns

| Field | Type | Description |
|-------|------|-------------|
| `packet` | markdown | Structured context packet ready for subagent injection |
| `token_estimate` | number | Estimated token count of the packet |
| `completeness` | enum | `full` / `partial` / `minimal` — how much context was captured |
| `warnings` | string[] | Missing context that could cause subagent failure |

## Constraints

1. MUST include task goal and success criteria — subagent needs to know when it's done
2. MUST include failed attempts — prevents subagent from repeating mistakes
3. MUST include hard-stop constraints — prevents constraint violations in delegated work
4. MUST NOT exceed 2000 tokens — context packets that are too large defeat the purpose
5. MUST NOT include full file contents — use file paths and summaries instead
6. MUST NOT fabricate context — only include information from the actual conversation

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Packet too large (>2000 tokens) | HIGH | Compress aggressively — file paths not contents, decisions not discussions |
| Missing constraint causes subagent violation | CRITICAL | Always scan for MUST/MUST NOT in parent conversation |
| Stale context from prior session included | MEDIUM | Cross-check session-bridge state with current files |
| Over-constraining subagent with parent's approach | MEDIUM | Include constraints and goals, not implementation approach (unless approach is the constraint) |

## Self-Validation

```
SELF-VALIDATION (run before emitting output):
- [ ] Packet includes a clear task goal
- [ ] Packet includes success criteria (verifiable, not vague)
- [ ] All MUST/MUST NOT constraints from parent are present
- [ ] Failed attempts are listed (if any exist)
- [ ] Token estimate is under 2000
- [ ] No full file contents embedded (paths only)
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
