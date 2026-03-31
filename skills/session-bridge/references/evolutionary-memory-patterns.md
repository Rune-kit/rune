> Activate when: session-bridge is saving context and the project has accumulated 3+ sessions of history, OR when a task explicitly requires cross-session learning from past decisions and failures.

# Evolutionary Memory Patterns

Flat session logs answer "what happened?" — typed memory answers "what worked, what failed, and why?" This reference describes how to upgrade session-bridge from append-only logs to a queryable typed memory graph.

---

## 1. Why Typed Memory Beats Flat Logs

Flat text logs grow linearly and become noise. After 10 sessions, an agent scanning a flat log must read everything to find relevant context — and still cannot distinguish a recoverable mistake from a permanent architectural constraint.

Typed memory solves this with three queryable node types:

| Type | Question it answers | When to write |
|------|--------------------|--------------------|
| Decision | "What did I choose and did it work?" | Before + after executing a strategic choice |
| Finding | "What did I discover and has it been acted on?" | Immediately on discovery |
| Failure | "What broke, why, and what should I never repeat?" | On error or recovery |

Each node carries: `timestamp`, `session_id`, `context` (what the agent was doing), `outcome` (updated post-execution), and `tags` (topic labels for retrieval).

The key property: **an agent can query by type + tags** instead of scanning chronologically. "Show me all Failures tagged `api-auth` from the last 5 sessions" is impossible with flat logs, trivial with typed nodes.

---

## 2. Memory Node Schema

### Decision Node

Captures strategic choices. Written in two passes: intent before execution, outcome after.

```yaml
# .rune/memory/decisions.md entry
---
type: decision
id: dec-20260315-001
session_id: sess-abc123
timestamp: 2026-03-15T10:22:00Z
tags: [auth, library-choice, architecture]
confidence: 0.8
outcome: success  # pending | success | failure | partial
---
what: Chose lucia-auth over next-auth for session management
alternatives:
  - next-auth: rejected — too opinionated, v5 breaking changes expected
  - custom JWT: rejected — maintenance burden too high
reasoning: lucia-auth is framework-agnostic, zero dependencies, aligns with our SvelteKit setup
impact: affects src/lib/auth/, src/hooks.server.ts, all protected routes
outcome_notes: Shipped cleanly. No issues after 3 weeks. Confidence promoted to 0.9.
```

### Finding Node

Captures discoveries that affect future work. Marked `consumed_by` once a session acts on it.

```yaml
# .rune/memory/findings.md entry
---
type: finding
id: fnd-20260316-003
session_id: sess-def456
timestamp: 2026-03-16T14:05:00Z
tags: [performance, database, n+1]
significance: high  # low | medium | high | critical
actionable: true
consumed_by: sess-ghi789  # session that acted on this finding
---
what: UserPosts query triggers N+1 — one DB call per post to fetch author
source: profiling with Prisma query logs during load test (500 concurrent users)
context: Investigating why /feed endpoint degraded above 100 users
recommended_action: Add include:{author:true} to all post list queries
```

### Failure Node

Captures what broke and why. The `lesson` field is the distilled takeaway — written for a future agent who has no context.

```yaml
# .rune/memory/failures.md entry
---
type: failure
id: fail-20260317-002
session_id: sess-jkl012
timestamp: 2026-03-17T09:41:00Z
tags: [deployment, env-vars, ci]
preventable: true
recovery: reverted deploy, added env var to CI secrets, re-deployed
---
what: Production deploy failed — app crashed at startup with "DATABASE_URL is undefined"
root_cause: .env.production was not committed (correct), but CI pipeline did not have DATABASE_URL in secrets vault
context: First deploy to new environment after migrating CI from GitHub Actions to GitLab
lesson: Every new environment needs a secrets audit before first deploy — check all required env vars against running config
```

---

## 3. Cross-Session Loading Strategy

Loading everything on session start causes context flooding. Use selective loading:

```
Load order (on session start):
  1. Findings    → ALL unread (consumed_by = null), max 10
  2. Failures    → ALL from last 30 days, max 8
  3. Decisions   → ONLY confidence >= 0.7, max 5, sorted by recency

Hard cap: 20 nodes total per session load
```

**Recency bias**: weight recent nodes higher. A failure from last week is more relevant than one from 6 months ago — unless it's pinned.

**Relevance filter**: match nodes by tags against the current task description. If the session is working on authentication, load auth-tagged nodes before untagged ones.

**Staleness demotion**: nodes older than 30 days without a `pinned: true` flag are excluded from the default load. They remain queryable on demand but don't auto-surface.

```yaml
# Pinning a node to prevent staleness demotion
pinned: true
pin_reason: Core architectural constraint — do not expire
```

**Memory budget enforcement**: if the filtered set exceeds 20 nodes, apply this priority:
1. Pinned nodes (always included)
2. Critical-significance findings
3. Preventable failures (high lesson value)
4. High-confidence decisions with `outcome: success`
5. Everything else — truncate here

---

## 4. Memory Accumulation Pattern

Write nodes in real-time, not in batch at session end. Batch writing loses context — if the session crashes or is interrupted, nothing is saved.

### Decision write lifecycle

```
BEFORE executing:
  write node with outcome: pending
  captures intent even if execution fails

AFTER executing:
  update outcome: success | failure | partial
  add outcome_notes with evidence
  update confidence (up on success, down on failure)
```

### Finding write trigger

```
IMMEDIATELY on discovery:
  any unexpected behavior → Finding (significance: medium+)
  any constraint discovered → Finding (actionable: true)
  any external API behavior → Finding (tags: [external-api, <service>])
```

### Failure write trigger

```
ON ERROR or unexpected recovery:
  write before resuming normal flow
  root_cause must not be "unknown" — attempt RCA even if uncertain
  lesson must be one sentence, written for future-agent context
```

### End-of-session consolidation pass

After all nodes are written, run one consolidation sweep:

1. Find duplicate Findings (same `what`, different sessions) — merge into highest-confidence node, archive duplicates
2. Find Decisions with `outcome: pending` older than 1 session — mark as `outcome: unknown`, add note
3. Find Failures with `preventable: true` — scan conventions.md for existing rules covering the lesson. If no rule exists, create one.
4. Prune noise: Findings with `actionable: false` and `significance: low` older than 14 days — delete

---

## 5. Query Patterns for Agents

Typed nodes unlock structured recall. These patterns map agent questions to node queries:

**"What failed last time I tried to deploy?"**
```
query: type=failure AND tags contains "deploy"
sort: timestamp DESC
limit: 5
→ surfaces recent deployment failures with root causes
```

**"What did I decide about the database layer and did it work?"**
```
query: type=decision AND tags contains "database"
filter: outcome != pending
sort: confidence DESC
→ surfaces past DB decisions with confirmed outcomes
```

**"What have we discovered about the payment API?"**
```
query: type=finding AND tags contains "payment"
filter: significance in [high, critical]
→ surfaces all significant payment API findings
```

**"Is there anything actionable I haven't consumed yet?"**
```
query: type=finding AND actionable=true AND consumed_by=null
sort: significance DESC
→ surfaces backlog of unconsumed findings
```

**"Show me all preventable failures — what lessons do I have?"**
```
query: type=failure AND preventable=true
field: lesson
→ quick scan of all distilled lessons
```

Agents should run the first two queries automatically on session load when the task has a known topic. The "unconsumed findings" query should run every session — it's the cross-session handoff mechanism.

---

## 6. Integration with Session Bridge

This pattern layers on top of session-bridge's existing state files. It does not replace decisions.md — it extends it with typed structure.

### File layout

```
.rune/
├── decisions.md         ← existing (unstructured log)
├── conventions.md       ← existing
├── progress.md          ← existing
├── session-log.md       ← existing
├── memory/
│   ├── decisions.md     ← NEW: typed Decision nodes (YAML frontmatter per entry)
│   ├── findings.md      ← NEW: typed Finding nodes
│   └── failures.md      ← NEW: typed Failure nodes
```

The original `.rune/decisions.md` stays as a human-readable narrative log. The new `.rune/memory/` files are structured for agent querying.

### Integration points in session-bridge flow

**Save Mode — after Step 2 (decisions):**
- For each architectural decision, also write a typed Decision node to `.rune/memory/decisions.md`
- Set `outcome: pending` — update after execution confirms result

**Save Mode — after Step 3 (conventions):**
- For each new convention derived from a Failure lesson, cross-reference the failure node: add `convention_created: true` to the Failure node

**Load Mode — after Step 2 (load files):**
- Run typed memory queries: unconsumed findings + recent failures
- Inject summary into the Step 3 context report:
  ```
  ## Session Bridge — Memory Loaded
  - Unconsumed findings: [N] (see .rune/memory/findings.md)
  - Recent failures (30d): [N], [top lesson preview]
  - High-confidence decisions: [N] loaded
  ```

### Format convention

Each node is a YAML frontmatter block followed by a markdown body for extended notes:

```markdown
---
type: finding
id: fnd-[YYYYMMDD]-[NNN]
session_id: [session identifier]
timestamp: [ISO 8601]
tags: [tag1, tag2, tag3]
significance: high
actionable: true
consumed_by: null
---
what: [one sentence summary]
source: [how/where this was found]
context: [what the agent was doing when this was found]
recommended_action: [what to do with this finding]
```

Node IDs use the pattern `[type-prefix]-[date]-[sequence]` (e.g., `dec-20260315-001`) to ensure uniqueness across sessions without requiring a database.

---

## Signal Integration

```yaml
signals:
  emits:
    - memory.decision.written:
        when: Decision node written with outcome=pending
        payload: { node_id, tags, confidence }
    - memory.finding.discovered:
        when: Finding node written with significance=high or critical
        payload: { node_id, tags, actionable }
    - memory.failure.recorded:
        when: Failure node written with preventable=true
        payload: { node_id, tags, lesson }
    - memory.session.loaded:
        when: Load Mode completes typed memory queries
        payload: { decisions_loaded, findings_unconsumed, failures_recent }

  listens:
    - phase.complete:
        action: Run end-of-session consolidation pass (merge duplicates, prune noise)
    - task.failed:
        action: Write Failure node immediately with root_cause from error context
    - decision.made:
        action: Write Decision node with outcome=pending before execution proceeds
```
