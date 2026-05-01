# Issue Triage Mode

A second mode for `review-intake`. The default mode (PR comments) processes inbound review feedback. **Issue Triage Mode** processes inbound issue tracker items (GitHub Issues, Linear tickets, bug reports, feature requests) and routes them through a state machine.

> The standard PR mode answers "should I implement this suggestion?". Issue Triage Mode answers "what state is this issue in, and who should pick it up next?".

## When to use Issue Triage Mode

Activate when input is an **issue** (not a PR review). Triggers:

| Signal | Threshold |
|--------|-----------|
| User passes an issue reference (`/rune review-intake gh-42`, URL, or path) | Always |
| User says "triage", "intake this issue", "process the inbox" | Explicit |
| User pastes an issue body + comments rather than PR review feedback | Auto-detect — issue has reporter, not reviewer |
| Batch mode: `/rune review-intake --inbox` queries unlabeled + needs-triage issues | Inbox sweep |

Skip if input is PR review comments → use default PR Review Mode.

## State machine

Two dimensions per issue:

| Category (1 of) | State (1 of) |
|-----------------|--------------|
| `bug` | `needs-triage` (unlabeled, never evaluated) |
| `enhancement` | `needs-info` (waiting on reporter for more detail) |
|  | `ready-for-agent` (fully specified, AFK agent can execute) |
|  | `ready-for-human` (specified but needs human judgment — design decision, OAuth setup, copy approval) |
|  | `wontfix` (explicit decision not to action) |

Every triaged issue carries exactly one category and one state. Conflicts → flag and ask the maintainer before acting.

State transitions (typical):

```
unlabeled  →  needs-triage  →  needs-info  →  needs-triage (after reporter replies)
                            →  ready-for-agent
                            →  ready-for-human
                            →  wontfix
```

Maintainer can override at any time (quick state override below).

## Workflow

### Step T1 — Inbox view (if batch mode)

Query the issue tracker for three buckets, oldest first:

1. **Unlabeled** — never triaged
2. **`needs-triage`** — evaluation in progress
3. **`needs-info` with reporter activity since last triage notes** — needs re-evaluation

Show counts + one-line summary per issue. Maintainer picks one.

### Step T2 — Gather context (per-issue)

Read the full issue: body, comments, labels, reporter, dates. Parse any prior triage notes so you don't re-ask resolved questions.

Then scan:
- `CONTEXT.md` — apply project glossary terms in your understanding
- `docs/adr/` — respect Architecture Decision Records in the affected area
- `.out-of-scope/*.md` — check for prior rejection that resembles this issue

If the issue matches a prior `.out-of-scope/` entry (≥0.7 lexical overlap), surface it: *"This matches a prior rejection (`<slug>`). Recommend `wontfix` unless circumstances changed."* Wait for maintainer direction.

### Step T3 — Recommend

Tell the maintainer your category + state recommendation with reasoning. Include a brief codebase summary relevant to the issue. Wait for direction. Do not act unilaterally.

### Step T4 — Reproduce (bugs only — HARD-GATE)

<HARD-GATE>
Bugs MUST attempt reproduction before being marked `ready-for-agent`. A confirmed repro is what makes the agent-brief strong; without it, the agent will guess.
</HARD-GATE>

Process:
1. Read the reporter's repro steps
2. Trace the relevant code via `rune:scout` / `rune:debug`
3. If the repro is a HTTP request / CLI invocation / browser flow → run it
4. Report outcome:
   - **Confirmed repro** with code path → strong `ready-for-agent` signal
   - **Failed repro** → likely `needs-info` (ask for env, version, exact steps)
   - **Insufficient detail** → `needs-info` with specific questions

If the bug is multi-component or intermittent, route to `rune:debug` Step 0 (build a feedback loop) instead of guessing.

### Step T5 — Grill (if vague)

If the issue lacks specifics for both bug and enhancement paths, run a grilling pass via `rune:ba` synthesis-mode (Step 1.4):
- Synthesis-mode reads the issue body + comments as the "rich context"
- Asks targeted follow-ups ONLY on dimensions with genuine gaps
- Produces a Requirements Document the agent-brief can cite

### Step T6 — Apply outcome

Match state to action:

| State | Action |
|-------|--------|
| `ready-for-agent` | Post AGENT-BRIEF comment on issue (use `rune:context-pack` agent-brief variant — see `context-pack/references/agent-brief.md`). Apply `ready-for-agent` label. |
| `ready-for-human` | Post AGENT-BRIEF + explicit "why this can't be delegated" reason (judgment call, external access, design decision, manual testing). Apply `ready-for-human` label. |
| `needs-info` | Post triage notes (template below). Apply `needs-info` label. |
| `wontfix` (bug) | Post a polite explanation comment, then close. **No `.out-of-scope/` write** — bug rejections (already fixed, not reproducible, not a bug) get a comment, not a KB file. |
| `wontfix` (enhancement) | Trigger Phase 4.5 (existing) — write `.out-of-scope/<slug>.md`, link from a comment, then close. |
| `needs-triage` | Apply the role. Optional comment if there's partial progress. |

Every comment posted by triage MUST start with the disclaimer:

```
> *This was generated by AI during triage.*
```

### Step T7 — Quick state override

If the maintainer says "move #42 to ready-for-agent", trust them and apply the state directly. Confirm what you're about to do (label changes, comment, close), then act. Skip grilling. If moving to `ready-for-agent` without a grilling session, ask whether they want to write an agent-brief.

## Templates

### Needs-info comment

```markdown
> *This was generated by AI during triage.*

## Triage Notes

**What we've established so far:**
- [point 1]
- [point 2]

**What we still need from you (@reporter):**
- [specific, actionable question 1]
- [specific, actionable question 2]
```

Capture everything resolved during grilling under "established so far" so the work isn't lost. Questions must be specific and actionable, not "please provide more info".

### Ready-for-agent comment

```markdown
> *This was generated by AI during triage.*

(AGENT-BRIEF block — see `context-pack/references/agent-brief.md`)
```

### Wontfix-bug comment

```markdown
> *This was generated by AI during triage.*

Closing as wontfix:
- [Reason: already fixed in #X / not reproducible / not a bug — explain briefly]
- [If "not reproducible": link the failed repro evidence]
- [If user disagrees: reopen and provide new details]
```

### Wontfix-enhancement comment (links to .out-of-scope/)

```markdown
> *This was generated by AI during triage.*

Closing as wontfix. Recorded in `.out-of-scope/<slug>.md` for future reference.

[1-line summary of the durable reason — full reasoning lives in the file]
```

## Resuming a previous triage session

If prior triage notes exist on the issue, read them, check whether the reporter has answered any outstanding questions, and present an updated picture before continuing. Don't re-ask resolved questions.

## State machine output (per issue triaged)

```yaml
issue: <id>
category: bug | enhancement
state: needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix
repro: confirmed | failed | insufficient-info | n/a   # bugs only
agent_brief_posted: true | false
out_of_scope_written: <slug>.md | null
```

This payload travels alongside the existing Verdicts table when emit `triage.classified` fires.

## Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Marking `ready-for-agent` without confirmed repro (bugs) | Agent guesses, fixes wrong thing, bug returns |
| Auto-applying `wontfix` without maintainer confirmation | Triage recommends; only maintainer decides |
| Re-asking questions already answered in prior triage notes | Wastes reporter trust; read existing notes first |
| Writing `.out-of-scope/` for bug rejections | Per format spec, only enhancement rejections produce KB files |
| Posting triage comments without the AI-generated disclaimer | Reporter assumes human voice; trust degrades when caught |
| Quick state override without confirmation summary | "Move to ready-for-agent" can mean "label only" or "label + brief" — confirm before acting |

## Integration with Phase 4.5 (existing)

Phase 4.5 (Rejection KB Write) already exists in `review-intake/SKILL.md` for OUT OF SCOPE verdicts in PR Mode. In Issue Triage Mode, `wontfix-enhancement` outcome triggers the **same** Phase 4.5 — no duplicate logic. The slug, lexical-similarity check, and write procedure are identical.

## Required external tools

- `gh` CLI (GitHub Issues) OR Linear MCP — without an issue-tracker integration, Issue Triage Mode falls back to local-only mode: maintainer pastes the issue body, triage produces classification + draft comments, maintainer copies the comments back to the tracker manually.
