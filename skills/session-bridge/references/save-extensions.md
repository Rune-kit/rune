# session-bridge — Save-mode steps 5.5–6

> Reference for `skills/session-bridge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Step 5.5 — Autonomous Loop Notes (when inside team or headless)

When session-bridge is invoked by `cook` running inside `team` or in autonomous mode (`claude -p`), persist iteration state to `.rune/task-notes.md`:

```markdown
# Task Notes: [task name]
## What Worked (with evidence)
- [approach]: [outcome, test output, or file path as proof]

## What Failed
- [approach]: [why it failed, error message]

## What's Left
- [ ] [remaining task with specific next step]

## Key Context for Next Iteration
- [critical info that would be lost on context reset]
```

**Why**: In autonomous loops, each `claude -p` invocation starts with zero context. Without this file, the next iteration repeats failed approaches and loses progress. The notes bridge the gap between independent invocations.

**Rules**: Agent reads `.rune/task-notes.md` at start (Step 1 of Load Mode), updates at end. Keep concise — max 50 lines. Prune completed items.

#### Step 5.7 — Instinct Extraction (Project-Scoped Learning)

Extract atomic "instincts" — learned trigger→action patterns — from this session and persist to `.rune/instincts.md`. Instincts are project-scoped by default to prevent cross-project contamination.

**Instinct format:**

```markdown
## [YYYY-MM-DD] Instinct: <short name>

**Trigger:** <when this pattern applies — specific condition>
**Action:** <what to do — specific behavior>
**Confidence:** <0.3–0.9>
**Evidence:** <what happened that taught this — file, error, outcome>
```

**Extraction rules:**

| Signal | Example | Confidence |
|--------|---------|------------|
| Repeated manual correction by user | "Don't use X, use Y here" (2+ times) | 0.7–0.9 |
| Failed approach → successful pivot | Tried approach A, failed, approach B worked | 0.5–0.7 |
| Project-specific convention discovered | "This codebase uses X pattern for Y" | 0.4–0.6 |
| One-off preference (may not generalize) | User chose a specific library once | 0.3–0.4 |

**Promotion to global**: When the same instinct (matching trigger+action) appears in `.rune/instincts.md` across 2+ projects at confidence ≥0.8, promote it to Neural Memory via Step 6 with tag `[cross-project, instinct]`. Until then, it stays project-local.

**Pruning**: At session start (Load Mode Step 1), review instincts older than 30 days with confidence <0.5 — remove them. Instincts that conflict with current conventions should be removed immediately.

**Max instincts**: Keep `.rune/instincts.md` under 20 entries. When full, evict the lowest-confidence entry.

#### Step 5.8 — Learnings Log (Structured JSONL)

Append structured learning entries to `.rune/learnings.jsonl` — an append-only log that captures decisions, insights, and error resolutions in a machine-queryable format. Unlike markdown state files (which are for human reading), JSONL enables fast filtering and "latest winner" lookups.

**Entry schema** — one JSON object per line:

```json
{"ts":"2026-04-04T14:30:00Z","skill":"cook","type":"decision","key":"state-lib","insight":"Chose Zustand over Redux — fewer re-renders in dashboard with 50+ real-time widgets","confidence":0.8,"files":["src/store/index.ts"]}
```

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO 8601 | When the learning was captured |
| `skill` | string | Which skill produced this learning |
| `type` | enum | `decision` · `error` · `insight` · `convention` · `performance` |
| `key` | string | Dedup key — latest entry per key+type wins on read |
| `insight` | string | 1-2 sentences, causal language ("Chose X because Y", "Root cause was X") |
| `confidence` | 0.1–1.0 | How certain this learning is (0.3=hunch, 0.7=validated, 0.9=battle-tested) |
| `files` | string[] | Optional — affected file paths |

**Write rules:**
- Append only — never edit or delete lines in the JSONL file
- Max 1-3 entries per session (only genuinely transferable learnings)
- Use causal/comparative language, not flat facts
- Key must be kebab-case, descriptive (e.g., `auth-lib`, `db-migration-strategy`, `react-hook-pitfall`)

**Read rules (latest-winner):**
- When loading learnings, group by `key+type` and take the entry with the latest `ts`
- This means updating a learning = just append a new entry with the same key+type
- No dedup needed on write — dedup happens on read

**Query patterns** (for other skills or session-start):
- All learnings: read `.rune/learnings.jsonl`, parse line-by-line
- By type: filter `type === "error"` to surface past mistakes before coding
- By skill: filter `skill === "cook"` to see cook-specific learnings
- By recency: sort by `ts` descending, take top N
- Surface top 5 learnings at session start if file has 10+ entries

**Pruning**: When file exceeds 100 entries, compact by keeping only the latest-winner per key+type. Write compacted entries to a new file, replace original.

**Why**: Markdown state files (decisions.md, conventions.md) are great for human reading but hard to query programmatically. JSONL enables structured recall — "show me all errors from last week" or "what did we decide about auth?" — without parsing markdown headers.

#### Step 5.9 — Cumulative Project Notes (Structured Memory)

Maintain a running **cumulative notes** file at `.rune/cumulative-notes.md` that evolves across sessions. Unlike `progress.md` (which tracks tasks) or `decisions.md` (which logs choices), cumulative notes capture the **living understanding** of the project — patterns learned, relationships discovered, recurring themes, and open threads.

**Format** — use these fixed sections (add content, never remove prior entries):

```markdown
# Cumulative Project Notes

## Project Profile
- [Core purpose of the project — 1 sentence]
- [Primary users/audience]
- [Key technical constraints — e.g., "must run offline", "latency-critical", "multi-tenant"]

## Architecture Map
- [Key modules and their responsibilities — discovered over sessions]
- [Critical data flows — e.g., "user input → validation → API → DB → cache invalidation"]
- [Integration points — external APIs, services, databases]

## Recurring Themes
- [Patterns that keep coming up across sessions — e.g., "auth edge cases", "migration complexity"]
- [Common failure modes — what breaks and why]
- [Technical debt hotspots — areas that repeatedly cause issues]

## Active Topics
- [What's currently being worked on — updated each session]
- [Open questions that haven't been resolved yet]
- [Experiments in progress]

## Relationship Map
- [Key files and their dependencies — "changing X requires updating Y"]
- [People and their areas — "Alice owns auth, Bob owns payments"]
- [External service dependencies — "Stripe webhook → order.complete handler"]

## Follow-Up Items
- [ ] [Things noted but not yet addressed — carry forward until done]
- [ ] [Ideas that came up during work but were out of scope]

## Attention Points
- [Things the next session should be aware of — fragile areas, pending PRs, deadlines]
- [Temporary workarounds that need proper fixes]
```

**Update rules:**
- **Create** the file on first session-bridge save if it doesn't exist
- **Append** to existing sections — never overwrite prior entries (they represent accumulated knowledge)
- **Prune** entries older than 60 days in Recurring Themes and Relationship Map — these may be stale
- **Move** completed Follow-Up Items to a `## Resolved` section at the bottom (keep last 10)
- **Keep under 200 lines** — if approaching limit, summarize older entries in each section

**Why**: Individual state files (decisions.md, progress.md) capture discrete events. Cumulative notes capture the **emergent understanding** that develops over many sessions — the kind of knowledge that's lost when context resets. This is the project's "institutional memory."

#### Step 6 — Cross-Project Knowledge Extraction (Neural Memory Bridge)

Before committing, extract generalizable patterns from this session for cross-project reuse:

1. Review the session's decisions, conventions, and completed tasks
2. Identify 1-3 patterns that are NOT project-specific but would help in OTHER projects:
   - Technology choices with reasoning ("Chose Redis over Memcached because X")
   - Architecture patterns ("Fan-out queue pattern solved Y")
   - Failure modes discovered ("React 19 useEffect cleanup breaks when Z")
   - Performance insights ("N+1 query pattern in Prisma solved by include")
3. For each generalizable pattern, save to Neural Memory:
   - Use `nmem_remember` with rich cognitive language (causal, comparative, decisional)
   - Tags: `[cross-project, <technology>, <pattern-type>]`
   - Priority: 6-7 (important enough to surface in other projects)
4. Skip if session was purely project-specific (config changes, bug fixes with no transferable insight)

**Why**: This turns every project session into learning that compounds across ALL projects. A pattern discovered in Project A auto-surfaces when Project B faces a similar problem.
