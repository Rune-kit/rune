---
name: neural-memory
description: "Cross-session cognitive persistence via Neural Memory MCP. Captures decisions, patterns, errors, and insights with rich semantic links. Provides recall, hypothesis tracking, and evidence-based reasoning across projects."
metadata:
  author: rune-kit
  version: 0.1.0
  layer: L3
  model: haiku
  group: state
  tools:
    - mcp__neural-memory__nmem_remember
    - mcp__neural-memory__nmem_recall
    - mcp__neural-memory__nmem_auto
    - mcp__neural-memory__nmem_hypothesize
    - mcp__neural-memory__nmem_evidence
    - mcp__neural-memory__nmem_predict
    - mcp__neural-memory__nmem_verify
    - mcp__neural-memory__nmem_edit
    - mcp__neural-memory__nmem_forget
    - mcp__neural-memory__nmem_health
    - mcp__neural-memory__nmem_consolidate
    - mcp__neural-memory__nmem_explain
    - mcp__neural-memory__nmem_gaps
    - mcp__neural-memory__nmem_stats
    - mcp__neural-memory__nmem_review
    - mcp__neural-memory__nmem_cognitive
    - Read
    - Grep
---

# neural-memory

## Purpose

Bridges Rune's file-based persistence (session-bridge, journal) with Neural Memory MCP's semantic graph. While session-bridge saves decisions to `.rune/` files and journal tracks ADRs locally, neural-memory captures **cross-project learnable patterns** — decisions, error root causes, architectural insights, and workflow preferences — into a persistent cognitive layer that compounds across every project and session.

Without this skill, each project is an island. With it, a caching pattern discovered in Project A auto-surfaces when Project B faces a similar problem.

## Triggers

**Auto-trigger:**
- Session start → Run **Recall Mode** (load relevant context before any work)
- After `cook` completes a feature → Run **Capture Mode** (save learnings)
- After `debug` finds root cause → Run **Capture Mode** (save error pattern)
- After `review` finds issues → Run **Capture Mode** (save code quality insight)
- After `rescue` completes a phase → Run **Capture Mode** (save refactoring pattern)
- After `journal` writes an ADR → Run **Capture Mode** (extract to nmem)
- Session end / before compaction → Run **Flush Mode** (capture remaining context)

**Manual trigger:**
- `/rune recall <topic>` — search neural memory for a topic
- `/rune remember <text>` — save a specific memory
- `/rune brain-health` — check neural memory health + maintenance
- `/rune hypothesize <question>` — start hypothesis tracking

## Calls (outbound)

| Skill | When | Why |
|-------|------|-----|
| `session-bridge` | After Capture Mode | Sync key decisions back to `.rune/` files |

## Called By (inbound)

| Skill | When | Why |
|-------|------|-----|
| `cook` | Phase 0 (resume) + Phase 8 (complete) | Recall project context at start, capture learnings at end |
| `debug` | After root cause found | Capture error pattern for future recognition |
| `fix` | After fix verified | Capture fix pattern (cause → solution) |
| `review` | After review complete | Capture code quality insight |
| `rescue` | Phase start + phase end | Recall past refactoring patterns, capture new ones |
| `plan` | Before architecture decisions | Recall past decisions on similar problems |
| `session-bridge` | Step 6 (cross-project extraction) | Extract generalizable patterns to nmem |
| `journal` | After ADR written | Extract decision + rejected alternatives to nmem |
| `context-engine` | Before compaction | Trigger Flush Mode to preserve context |
| `sentinel` | After security finding | Capture vulnerability pattern |
| `incident` | After resolution | Capture incident root cause + fix |

## Modes

### Mode 1: Recall (Session Start / Before Decisions)

Load relevant context from neural memory before starting work.

**Step 1 — Identify Recall Topics**
Read `.rune/progress.md` and current task context to determine 3-5 diverse recall topics.
Always prefix queries with the project name to avoid cross-project noise.

```
GOOD: "Rune compiler cross-reference resolution"
GOOD: "MyTrend PocketBase auth session handling"
BAD:  "cross-reference" (too generic, returns all projects)
BAD:  "auth" (returns noise from every project)
```

**Step 2 — Execute Recall**
Call `nmem_recall` for each topic. Use diverse angles:
- Technology-specific: `"<project> React state management"`
- Problem-specific: `"<project> caching strategy decision"`
- Pattern-specific: `"<project> error handling approach"`

**Step 3 — Synthesize Context**
Summarize recalled memories into actionable context:
- Decisions that apply to current task
- Patterns that worked (or failed) before
- Constraints or preferences from past sessions
- Open hypotheses still being tracked

**Step 4 — Surface Gaps**
If recall returns thin results for the current domain, note the gap.
Call `nmem_gaps(action="detect")` if working in a domain with sparse memories.

---

### Mode 2: Capture (After Task Completion)

Extract learnable patterns from completed work and save to neural memory.

**Step 1 — Classify What Happened**
Determine which memory types to create from the completed task:

| What happened | Memory type | Priority | Example |
|---------------|-------------|----------|---------|
| Chose approach A over B | `decision` | 7 | "Chose Zustand over Redux because single-store simpler for this scale" |
| Found and fixed a bug | `error` | 7 | "Root cause was stale closure in useEffect — fixed by adding dep array" |
| Discovered a reusable pattern | `insight` | 6 | "This codebase uses barrel exports for every feature module" |
| Learned user preference | `preference` | 8 | "User prefers Phosphor Icons over Lucide for all UI work" |
| Established a workflow | `workflow` | 6 | "Deploy: build → test → push → verify CI → tag" |
| Found a fact worth keeping | `fact` | 5 | "API rate limit is 100 req/min on free tier" |
| Received instruction to follow | `instruction` | 8 | "Always run prettier before commit in this project" |

**Step 2 — Craft Rich Memories**
Each memory MUST use cognitive language patterns for strong neural connections:

```
BAD:  "PostgreSQL" (flat, no context — orphan neuron)
GOOD: "Chose PostgreSQL over MongoDB because ACID needed for payment processing"

BAD:  "Fixed auth bug" (no root cause — useless for future recall)
GOOD: "Auth cookie expired silently because SameSite=Lax blocked cross-origin. Fixed by setting SameSite=None + Secure flag"

BAD:  "React project structure" (vague — won't match specific queries)
GOOD: "Rune compiler uses 3-stage pipeline: Parse SKILL.md → Transform cross-refs → Emit per-platform files"
```

**Cognitive patterns to use:**
- **Causal**: "X caused Y because Z", "Root cause was X which led to Y"
- **Temporal**: "After upgrading to v3, the middleware broke because of new cookie format"
- **Decisional**: "Chose X over Y because Z", "Rejected X due to Y"
- **Comparative**: "X is 3x faster than Y for read-heavy workloads"
- **Relational**: "X depends on Y", "X replaced Y", "X connects to Y through Z"

**Step 3 — Tag and Prioritize**
Every memory MUST include:
- **Tags**: `[project-name, technology, topic]` — lowercase, specific
- **Priority**: 5 (normal), 7-8 (important decisions/errors), 9-10 (critical security/breaking)
- **Max length**: 1-3 sentences. If longer, split into focused pieces.

**Step 4 — Save Memories**
Call `nmem_remember` for each memory. Save 2-5 memories per completed task:
- A bug fix has: root cause, fix approach, prevention insight
- A feature has: architecture decision, pattern used, trade-off made
- A review has: quality issue found, fix suggestion, pattern to avoid

**Step 5 — Reinforce Connections**
After saving, call `nmem_recall` on the topic to reinforce new neural connections.
This activates related neurons and strengthens the memory graph.

---

### Mode 3: Hypothesis Tracking

Track uncertain decisions with evidence over time.

**Step 1 — Form Hypothesis**
When making an uncertain architectural or design decision:
```
nmem_hypothesize("Redis will handle our session load better than Memcached
                   because our access pattern is 80% reads with complex data types")
```

**Step 2 — Collect Evidence**
As you work, update the hypothesis with evidence:
```
nmem_evidence(hypothesis_id, "Redis handled 10K concurrent sessions with
              p99 < 5ms in load test — SUPPORTS hypothesis")

nmem_evidence(hypothesis_id, "Memory usage 2x higher than Memcached estimate
              — WEAKENS hypothesis for memory-constrained deployments")
```

**Step 3 — Make Predictions**
Create falsifiable predictions:
```
nmem_predict("If we switch to Redis Cluster, session failover time will drop
              from 30s to < 2s")
```

**Step 4 — Verify Outcomes**
After deployment/testing, verify:
```
nmem_verify(prediction_id, outcome="Failover time dropped to 1.2s — CONFIRMED")
```

---

### Mode 4: Flush (Session End / Pre-Compaction)

Capture remaining context before session ends.

**Step 1 — Scan Unsaved Context**
Review the current session for:
- Decisions made but not yet captured
- Errors encountered and their resolutions
- Patterns discovered during exploration
- User preferences expressed

**Step 2 — Batch Save**
Call `nmem_auto(action="process", text="<session summary>")` with a concise summary
of the session's key outcomes, decisions, and learnings.

**Step 3 — Update Session Bridge**
If significant decisions were captured, also call `session-bridge` to sync
the most important ones to `.rune/decisions.md` for local persistence.

---

### Mode 5: Maintenance (Weekly / On-Demand)

Keep the neural memory healthy and useful.

**Step 1 — Health Check**
Call `nmem_health()` to assess brain status. Key metrics:
- Consolidation % (low = run consolidation)
- Orphan % (>20% = prune disconnected memories)
- Activation levels (low = recall more diverse topics)
- Connectivity (low = use richer cognitive language)
- Diversity (low = vary memory types)

**Step 2 — Consolidation**
If brain has >100 memories or consolidation is low:
```
nmem_consolidate  — merge episodic → semantic memories
```

**Step 3 — Review Queue**
Call `nmem_review(action="queue")` to surface memories needing attention:
- Outdated decisions that may no longer apply
- Low-confidence memories that need evidence
- Wall-of-text memories (>500 chars) that should be split

**Step 4 — Corrections**
Fix bad memories:
- Wrong type → `nmem_edit(memory_id, type="correct_type")`
- Wrong content → `nmem_edit(memory_id, content="corrected text")`
- Outdated → `nmem_forget(memory_id, reason="outdated")`
- Sensitive/garbage → `nmem_forget(memory_id, hard=true)`

**Step 5 — Connection Tracing**
Use `nmem_explain(entity_a, entity_b)` to trace paths between concepts.
Useful for understanding why certain memories surface together.

## Output Format

### Recall Report
```
## Neural Memory Recall — <project>

### Loaded Context
- <memory 1 summary — decision/pattern/insight>
- <memory 2 summary>
- <memory 3 summary>

### Applicable to Current Task
- <how memory X applies>
- <how memory Y applies>

### Gaps Detected
- <domain with sparse coverage>
```

### Capture Report
```
## Neural Memory Capture — <task summary>

### Saved Memories
| # | Type | Priority | Tags | Content (preview) |
|---|------|----------|------|--------------------|
| 1 | decision | 7 | [project, tech, topic] | Chose X over Y because... |
| 2 | error | 7 | [project, bug, tech] | Root cause was X... |
| 3 | insight | 6 | [project, pattern] | This codebase uses... |

### Reinforced Topics
- <topic recalled to strengthen connections>
```

### Health Report
```
## Neural Memory Health

| Metric | Value | Status |
|--------|-------|--------|
| Total memories | N | — |
| Consolidation | N% | ✅ / ⚠️ |
| Orphans | N% | ✅ / ⚠️ |
| Activation | level | ✅ / ⚠️ |
| Top penalty | <metric> | Fix: <action> |

### Recommended Actions
1. <action with command>
```

## Constraints

1. **MUST prefix all recall queries with project name** — generic queries return cross-project noise that confuses the AI. The ONLY exception is intentional cross-project searches.
2. **MUST use rich cognitive language** — flat facts ("X exists") create orphan neurons with zero connections. Every memory MUST include WHY, BECAUSE, or relationship context.
3. **MUST NOT save wall-of-text memories** — max 1-3 sentences per memory. Split longer content into focused pieces. Memories >500 chars degrade recall quality.
4. **MUST NOT duplicate file-based state** — don't save task progress, file paths, or git history to nmem. Those belong in `.rune/` files (session-bridge) or git. nmem is for *learnable patterns* only.
5. **MUST save 2-5 memories per completed task** — a single memory per task is insufficient. Capture the decision, the reasoning, the pattern, and the prevention insight separately.
6. **MUST NOT save sensitive data** — no API keys, passwords, tokens, or PII. Mask or omit sensitive values.
7. **MUST tag every memory** — always include `[project-name, technology, topic]`. Tags enable future recall precision.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Cross-project noise from generic queries | HIGH | Always prefix queries with project name. Use `nmem_explain` to trace unexpected connections |
| Orphan neurons from flat facts | HIGH | Enforce cognitive language patterns (causal, decisional, comparative). Run `nmem_health` to detect orphan % |
| Memory bloat from over-saving | MEDIUM | Cap at 5 memories per task. Run `nmem_consolidate` weekly. Use `nmem_review` to prune |
| Stale decisions applied to changed codebase | MEDIUM | Include temporal context ("As of v2.1, ..."). Verify recalled decisions against current code before applying |
| Duplicate memories from repeated sessions | MEDIUM | Before saving, `nmem_recall` the topic first to check for existing memories. Update rather than create duplicates |
| Loss of nuance from oversimplification | LOW | Save rejected alternatives alongside chosen approach. Use `nmem_hypothesize` for uncertain decisions |

## Done When

**Recall Mode:**
- 3-5 diverse topics recalled with project-name prefix
- Applicable context summarized for current task
- Gaps noted if coverage is thin

**Capture Mode:**
- 2-5 memories saved with rich cognitive language
- All memories tagged with `[project, technology, topic]`
- Priority assigned (5-10 scale)
- Connections reinforced via post-save recall

**Flush Mode:**
- All significant unsaved decisions captured
- `nmem_auto` called with session summary
- Session-bridge synced if major decisions made

**Maintenance Mode:**
- `nmem_health` run and metrics assessed
- Top penalty addressed with specific action
- Review queue processed (outdated/bloated memories fixed)

## Cost Profile

- **Recall**: ~200-500 tokens (3-5 queries + synthesis)
- **Capture**: ~300-600 tokens (2-5 memories + reinforcement)
- **Flush**: ~100-300 tokens (auto-process + sync)
- **Maintenance**: ~500-1000 tokens (health + consolidate + review)
- **Hypothesis**: ~200-400 tokens per hypothesis lifecycle
