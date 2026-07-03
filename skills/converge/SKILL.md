---
name: converge
description: "Spec↔code convergence scan. Use after implementation to verify the ACTUAL codebase matches the spec/plan — detects missing backends, dead buttons, partial wiring, scope creep. Classifies gaps (missing/partial/contradicts/unrequested), appends remediation tasks, loops until converged. The direct answer to 'the UI renders but nothing works' syndrome."
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: sonnet
  group: verification
  tools: "Read, Glob, Grep"
  emit: convergence.gaps, convergence.clean
  listen: verification.complete
---

# converge

## Purpose

Post-implementation gap detector. Re-reads the spec, plan, and tasks as the **sole source of intent**, inspects the ACTUAL codebase (present state, not the diff), and classifies every intent key as implemented or gapped. Where verification asks "does it build?", converge asks "**is everything the spec promised actually in the code?**"

This is the skill that catches the most expensive silent failure: a P1 story's UI exists, renders, passes lint/type/build — and its backend was never written.

<HARD-GATE>
Converge DETECTS — it never fixes. No Edit, no Write to source files.
Its ONLY write is APPENDING a `## Convergence` task section to the plan's task file.
Existing file content is never rewritten, reordered, or deleted. Zero gaps = zero writes.
</HARD-GATE>

## Called By (inbound)

- `cook` (L1): Phase 6.5 CONVERGE — after VERIFY, before COMMIT, for feature/greenfield chains with a requirements.md
- User: `/rune converge` — "did it fully implement the spec?", "check completeness", "does the code match the spec?"

## Calls (outbound)

None — pure L3 verification utility. Reports gaps; cook decides what to execute.

## Executable Steps

### Step 1 — Build the Intent Inventory

Load intent sources (all that exist; requirements.md is mandatory — without it, STOP and report `NO_SPEC`):

1. `.rune/features/<name>/requirements.md` — extract keys: every `FR-n`, every `US-n` with priority + Independent Test, every `AC-n.m` (as `US-n/AC-n.m`), every Key Entity
2. `.rune/plan-<feature>.md` + phase files — Key Decisions, Coverage Summary, task list with `P<phase>-T<seq>` IDs
3. `.rune/features/<name>/contracts/*.md` — each contract: its endpoint, its `Serves:` story, its `Consumers:` list
4. `.rune/features/<name>/data-model.md` — entities, state transitions
5. `.rune/features/<name>/quickstart.md` — per-story validation steps
6. `.rune/ui-spec.md` `## Unwired Elements` (if present) — designed placeholders that MUST NOT count as implemented

The inventory is a flat list of keys: `FR-3`, `US-1/AC-1.2`, `contract:create-order`, `entity:Order`, `decision:<slug>`.

Rules:
- **Task IDs (`P<phase>-T<seq>`) and quickstart.md are EVIDENCE, not verdict keys** — tasks feed the code-scope map (Step 2), quickstart steps feed pass/fail evidence for story rows. Neither gets its own verdict row
- **US-n verdict is DERIVED**: worst verdict among its `AC-n.m` rows (all ACs implemented → story implemented; any partial/missing → story inherits it). Don't independently re-assess the story
- **Plan Claims vs Reality**: while reading tasks, note every task marked `[x]` whose artifact is missing/partial in code — these go in a dedicated report section (informational; `completion-gate` owns claim enforcement, converge just surfaces the lie)

### Step 2 — Build the Code-Scope Map

Map intent → code locations. NO full-repo read — targeted lookups only:

1. `Glob` every file path named in plan tasks — does it exist?
2. `Grep` entity names (from data-model.md) across schema/model directories
3. `Grep` each contract's endpoint path/route across the codebase — implementation AND callers
4. `Grep` component names from UI tasks — definition AND the handler symbols they bind

### Step 3 — Classify Gaps

For every intent key, assign exactly one verdict:

| Verdict | Meaning | Example |
|---------|---------|---------|
| `implemented` | Code fully realizes the key | Endpoint exists, has logic, has a caller |
| `missing` | Required work absent entirely | Contract file exists, no route implements it |
| `partial` | Started but a link in the chain is dead | Button + handler exist; handler's fetch targets a route that doesn't exist |
| `contradicts` | Code diverges from a locked decision or AC | Spec says soft-delete; code hard-deletes |
| `unrequested` | Code maps to NO intent key (scope creep — surfaced, not blocked) | New admin page no story asked for |

**Dead-interaction trace** (run for every UI element an AC references):

```
element → handler bound? → handler body non-trivial? → calls service/fetch?
        → target route/function EXISTS in codebase? → route touches the entity the AC names?
```

First broken link = `partial`, keyed to that element's `US-n/AC-n.m`. Heuristics: `onClick={() => {}}`, `href="#"` on action links, `console.log`-only handlers, `preventDefault()`-only submits, `fetch('/api/...')` where no route file matches — all break the chain.

**Unwired Elements (declared debt)** — elements listed in `.rune/ui-spec.md` `## Unwired Elements`:
- Owner of wiring is a task/story IN THIS feature's plan → `missing`, keyed to that story (in-scope debt)
- Owner is external (asset-creator pass, future feature, human) → **`deferred-debt`**: report in a separate `### Deferred (declared debt)` section, do NOT append a CV task, do NOT count in gap counts, does NOT block `convergence.clean`. Declared debt with a named owner is tracked honesty, not a convergence failure

**Precedence**: an element that maps to NO intent key takes the `unrequested` path — the dead-interaction trace runs only for AC-referenced elements.

### Step 4 — Assign Severity

| Severity | Condition |
|----------|-----------|
| CRITICAL | `missing` or `contradicts` gap that blocks a **P1 story's** acceptance scenario or Independent Test |
| HIGH | `partial` on a P1 story, or `missing`/`contradicts` on P2 |
| MEDIUM | Any gap on P3; `unrequested` code touching shared modules |
| LOW | `unrequested` isolated code; cosmetic divergence |

### Step 5 — Append Remediation Tasks (APPEND-ONLY)

If gaps exist, append to the ACTIVE phase file (or master plan task section if no phase file):

```markdown
## Convergence (round N)
> Appended by converge — spec↔code gaps found. Do not edit rows above this section.
- [ ] CV-N.1 [CRITICAL] Implement POST /api/orders route per contract:create-order (missing) — `src/api/orders.ts`
- [ ] CV-N.2 [HIGH] Wire OrderForm submit to POST /api/orders per US-1/AC-1.1 (partial: handler fetches nonexistent route) — `src/components/OrderForm.tsx`
```

Task format: `CV-<round>.<seq> [severity] <imperative> per <intent-key> (<gap-type>) — <file path>`. Every task cites its intent key — a remediation task with no key is itself a converge violation.

**Deduplication**: when multiple intent keys trace to the SAME absent/broken artifact (e.g., `contract:create-order` missing AND `US-1/AC-1.1` partial, both resolved by implementing `src/api/orders.ts`), emit ONE combined CV task citing all keys — `CV-1.1 [CRITICAL] Implement POST /api/orders per contract:create-order + US-1/AC-1.1 (missing/partial) — src/api/orders.ts`. One target file = one task; the report table still lists every key's verdict separately.

**No CV tasks for `unrequested` findings** — they are surfaced for human decision (Constraint 6), never converted to work items. **No CV tasks for `deferred-debt`** — the named owner owns it.

If ZERO gaps (missing/partial/contradicts on spec keys — deferred-debt and unrequested don't count): write nothing (task file stays byte-identical), emit `convergence.clean`.

### Step 6 — Emit Verdict

- Gaps found → emit `convergence.gaps` with `{feature, round, counts: {missing, partial, contradicts, unrequested}, critical: N, cv_tasks: N}`
- Clean → emit `convergence.clean` with `{feature, round, keys_checked: N}`

Payload notes: `counts` are PER-KEY (one absent route can inflate several keys — that's fine for zero-checks, which is all cook needs); `cv_tasks` is the DEDUPED work-item count — consumers judging workload use `cv_tasks` + `critical`, not raw counts.

The caller (cook Phase 6.5) executes appended tasks and re-invokes converge — loop until clean, max 2 remediation rounds before escalation.

## Output Format

```
## Convergence Report — <feature> (round N)

Intent keys checked: 23 | implemented: 19 | gaps: 4
(keys checked = spec keys only; unrequested and deferred-debt listed separately below)

| Key | Verdict | Severity | Evidence |
|-----|---------|----------|----------|
| contract:create-order | missing | CRITICAL | contracts/create-order.md exists; no route matches POST /api/orders (grep: 0 hits in src/) |
| US-1/AC-1.1 | partial | HIGH | OrderForm.tsx:42 fetch('/api/orders') → route absent |
| US-3/AC-3.1 | implemented | — | route src/api/list.ts:12, caller OrderList.tsx:8 |

### Unrequested (surfaced, no CV tasks)
- src/pages/admin-stats.tsx — maps to no story

### Deferred (declared debt, no CV tasks)
- [ ICON: sparkle ] (ui-spec Unwired Elements, owner: asset-creator)

### Plan Claims vs Reality
- P1-T2 marked [x] but POST /api/orders absent — see contract:create-order gap

Verdict: 2 gaps blocking P1 → convergence.gaps emitted, 1 task appended (CV-1.1, deduped)
```

Every row needs `file:line` evidence or a grep result count — verdicts without evidence are hallucinations.

## Constraints

1. MUST treat spec/plan/contracts as the sole source of intent — never infer intent from the code itself
2. MUST inspect present codebase state, not the git diff — earlier phases may have broken older work
3. MUST give every gap an intent key, a gap-type, a severity, and file-level evidence
4. MUST append remediation tasks — never rewrite, reorder, or delete existing task content
5. MUST NOT edit source code — converge detects, fix/cook remediate
6. MUST surface `unrequested` code as findings, never silently delete or block on it
7. MUST report `NO_SPEC` and stop when no requirements.md exists — converge without a spec is vibes

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Inferring intent from code ("this helper implies a story") | CRITICAL | Intent inventory comes ONLY from Step 1 artifacts — code is evidence, never intent |
| Verdict without file:line or grep evidence | CRITICAL | Output format requires Evidence column — no evidence, no verdict |
| Rewriting the task file instead of appending | CRITICAL | HARD-GATE: append-only; zero gaps = zero writes (byte-identical file) |
| Marking `implemented` because the file exists | HIGH | Existence ≠ implementation — run the dead-interaction trace; a route with `res.status(501)` is `partial` |
| Counting a designed placeholder as implemented | HIGH | `.rune/ui-spec.md` Unwired Elements are automatically `missing` |
| Infinite converge loop (gaps never reach zero) | HIGH | Caller caps at 2 remediation rounds → Structured Escalation Report; same gap surviving 2 rounds = approach is wrong, not effort |
| Fixing the gap itself "since it's small" | HIGH | Converge never edits source — emit the task, let fix own the change |
| Scanning the whole repo (context blowout) | MEDIUM | Step 2 is targeted Glob/Grep from intent keys — not a repo read |
| Treating `unrequested` as an error to delete | MEDIUM | Scope creep is surfaced for human decision — it may be wanted, undocumented work |
| Declared debt (Unwired Elements, external owner) blocks convergence.clean forever | HIGH | deferred-debt class: reported, never a CV task, never blocks clean — a decorative icon must not cause a round-cap escalation |
| Appending CV tasks for unrequested findings | MEDIUM | Step 5: unrequested = surfaced only; converting scope creep into work items without user decision IS scope creep |
| Double-assessing US-n independently of its ACs | LOW | Story verdict is derived — worst of its AC rows |

## Done When

- Intent inventory built from requirements.md + plan + contracts (or NO_SPEC reported)
- Every intent key has a verdict with file-level evidence
- Dead-interaction trace run for every AC-referenced UI element
- Gaps appended as `CV-*` tasks with intent keys (or task file byte-identical when clean)
- `convergence.gaps` or `convergence.clean` emitted with counts
- Convergence Report rendered with evidence column

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Convergence Report | Markdown table with evidence | inline |
| Remediation tasks | `CV-<round>.<seq>` checklist (append-only) | active phase file / master plan |
| Signal | `convergence.gaps` \| `convergence.clean` with counts | mesh |

## Cost Profile

~2000-5000 tokens input (spec + plan + targeted greps), ~500-1500 tokens output. Sonnet — the dead-interaction trace needs code comprehension, not just pattern matching. Runs once per feature (plus ≤2 remediation rounds).
