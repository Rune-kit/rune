---
name: review
description: "Code quality review: patterns, security, performance, correctness. Use after implementation, before merging, or when the user asks to 'review' or 'check this code'. Finds bugs with file:line evidence, suggests improvements, and triggers fix for issues found. Escalates security-critical code to the heavy reasoning tier."
metadata:
  author: runedev
  version: "1.5.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Glob, Grep"
  emit: review.complete, review.issues
  listen: code.changed, docs.updated, context.preview
---

# review

## Purpose

Code quality analysis. Review finds bugs, bad patterns, security issues, and untested code. It does NOT fix anything — it reports findings and delegates: bugs go to rune:fix, untested code goes to rune:test, security-critical code goes to rune:sentinel.

<HARD-GATE>
A review that says "LGTM" or "code looks good" without specific file:line references is NOT a review.
Every review MUST cite at least one specific concern, suggestion, or explicit approval per file changed.
</HARD-GATE>

## Triggers

- Called by `cook` Phase 5 REVIEW — after implementation complete
- Called by `fix` for self-review on complex fixes
- `/rune review` — manual code review
- Auto-trigger: when PR is created or significant code changes committed

## Calls (outbound)

- `scout` (L2): find related code for fuller context during review
- `test` (L2): when untested edge cases found — write tests for them
- `fix` (L2): when bugs found during review — trigger fix
- `sentinel` (L2): when security-critical code detected (auth, input, crypto)
- `docs-seeker` (L3): verify API usage is current and correct
- `hallucination-guard` (L3): verify imports and API calls in reviewed code
- `design` (L2): when UI anti-patterns suggest missing design system — recommend design skill invocation
- `perf` (L2): when performance patterns detected in frontend diff
- `review-intake` (L2): structured intake for complex multi-file reviews
- `sast` (L3): static analysis security scan on reviewed code
- L4 extension packs: domain-specific review patterns when context matches (e.g., @rune/ui for frontend, @rune/security for auth code)
- `neural-memory` | After review complete | Capture code quality insight
- `council` (L3): Step 1.6 — decorrelated bug-finding on the diff when blast radius is 50+ callers with a HIGH-severity change, mode=review

## Called By (inbound)

- `cook` (L1): Phase 5 REVIEW — post-implementation quality check
- `fix` (L2): complex fix requests self-review
- User: `/rune review` direct invocation
- `surgeon` (L2): review refactored code quality
- `rescue` (L1): review refactored code quality
- `design` (L2): review UI/design implementation quality
- `graft` (L2): review grafted code integration

## Cross-Hub Connections

- `review` → `test` — untested edge case found → test writes it
- `review` → `fix` — bug found during review → fix applies correction
- `review` → `scout` — needs more context → scout finds related code
- `review` → `improve-architecture` — when reviewer flag mentions "shallow", "wrapper", "indirection", or pass-through pattern
- `review` ← `fix` — complex fix requests self-review
- `review` → `sentinel` — security-critical code → sentinel deep scan
- `review` → `council` — blast radius 50+ callers with HIGH-severity change → decorrelated bug-finding on the diff

## Execution

### Review Policy

Three rules govern every step below. When a later step seems to conflict with one of these, the policy wins.

**1. Precision over recall.** A false alarm costs more reviewer trust than a missed LOW finding. One wrong CRITICAL teaches the developer to skim the next report; a missed style nit costs nothing. Optimise for a report where every line is worth reading — not for coverage.

**2. Blocking split.** Correctness and security findings are blocking. Style and idiom findings are non-blocking and never gate a merge on their own. Report both; only the first kind may produce REQUEST CHANGES.

**3. Never guess at missing context.** When the surrounding code, caller, or convention needed to judge a line is not in front of you, either go read it (`Read`, `Grep`, `rune:scout`) or stay silent. A finding invented to fill a gap in your own reading is the single most expensive kind of false alarm.

### Step 1: Scope

Determine what to review.

- If triggered by a commit or PR: use `Bash` with `git diff main...HEAD` or `git diff HEAD~1` to see exactly what changed
- If triggered by a specific file or feature: use `Read` on each named file
- If context is unclear: use `rune:scout` to identify all files touched by the change
- List every file in scope before proceeding — do not review files outside the stated scope

**Strict Focus Rule** — the scope list you just wrote is the only set of files this review may produce findings about.

- Reads outside that list are for **understanding only**. Open any file you need to judge the diff correctly (callers, types, config, conventions) — that is encouraged, not scope creep.
- A finding whose subject is a file outside scope is **dropped, not reported** — not downgraded to LOW, not filed under "while I was in there". Dropped.
- If you spot a genuine issue elsewhere while gathering context, record it as a **one-line follow-up in the report footer**, never as a review finding. It carries no severity and does not affect the verdict.

The reason is trust, not bureaucracy: a review that wanders produces findings the author cannot act on in this change, and trains them to skim the ones they can.

**Rule Loading** — pick the checklists this diff actually needs, then stop.

1. Collect the distinct file extensions across the scope list you just wrote.
2. `Read` `references/rules/index.md` and follow its mapping to the matching rule files — at most one per language present in the diff.
3. Always read `references/rules/default.md`. It carries the five dimensions every file is judged on.
4. Read nothing further. **Never read all rule files** — a Go rule cannot produce a true finding about a diff with no Go in it, only a plausible-looking one, and that is the noise this split exists to remove.

Every rule in those files ends with a `Do not report when…` clause. That clause is as binding as the rule above it: a rule that only says when to fire will fire on everything. Rules do not restate the Review Policy, the Evidence Contract, or the claim types — they inherit all three from this file, and a rule never invents a severity or a gate of its own.

### Step 1.5: Blast Radius Assessment

For each modified function/class, estimate its blast radius before reviewing.

```
Use Grep to count direct callers/importers of each modified symbol:
  blast_radius = count(files importing or calling this symbol)
```

| Blast Radius | Risk | Review Depth |
|-------------|------|-------------|
| 1-5 callers | Low | Standard review |
| 6-20 callers | Medium | Check all callers for compatibility |
| 21-50 callers | High | Thorough review + regression test check |
| 50+ callers | Critical | MUST escalate to adversarial analysis (rune:adversary) even in quick triage |

<HARD-GATE>
Modifying a symbol with 50+ callers + HIGH severity change (logic, types, behavior) → adversarial analysis REQUIRED. Quick review is NOT sufficient for high-blast-radius changes.
</HARD-GATE>

### Step 1.6: Decorrelated Bug-Finding (council, high-blast-radius only)

> Full detail moved to [`references/decorrelated-council.md`](references/decorrelated-council.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:council`.

### Step 2: Logic Check (Production-Critical Focus)

Read each changed file. Prioritize bugs that **pass CI but break production** — these are the highest-value findings because linters and type checkers already catch the rest.

- Use `Read` on every file in scope
- **Race conditions**: async operations without proper sequencing, shared mutable state, missing locks
- **State corruption**: mutations that affect other consumers, cache invalidation gaps, stale closures
- **Silent failures**: caught errors that swallow context, empty catch blocks, promises without rejection handling
- **Data loss paths**: write operations without confirmation, delete without soft-delete, truncation without backup
- **Edge cases**: empty input, null/undefined, zero, negative numbers, empty arrays, Unicode, timezone boundaries
- Check for: logic errors, off-by-one errors, incorrect conditionals, broken async/await patterns
- Flag each finding using the **Evidence Contract** below — a snippet you copied, not a line number you remembered

#### Evidence Contract

Every finding carries these five fields. The line number is the one field you do **not** produce yourself.

| Field | Required | Source |
|-------|----------|--------|
| `path` | yes | the Step 1 scope list |
| `evidence` | yes | verbatim snippet copied out of the file |
| `line` | resolved | `Grep` on `evidence` at report time — never model recall |
| `severity` | yes | your judgement |
| `claim` | yes | `OBSERVED` / `DERIVED` / `ASSUMED` (Step 6) |

A line number recalled from a long context drifts, and a correct finding pointing at the wrong line is unactionable — the reader looks, sees nothing, and stops trusting the report. A snippet can be checked against the file; a remembered number cannot. So produce what you can copy, and let a tool resolve the rest (Step 6, Anchor Pass).

**Evidence rules:**

- Copy the lines **verbatim** — no rewriting, reformatting, re-indenting, or tidying
- Strip diff markers (`+`, `-`, and the leading space on context lines) before recording
- Include only the lines directly involved — no surrounding context padding
- Cap at **5 lines**. A finding that needs more than 5 lines to show is a design comment, not a defect — report it without evidence at MEDIUM or below
- Multiple disjoint locations → pick the single most relevant one and file the rest as separate findings

Evidence blocks are **substance, not shape**. Under `context-engine`'s `caveman` output mode the prose around a finding compresses; the evidence block does not (`../context-engine/references/output-modes.md` — "shape is negotiable, substance is not").

**Strict Focus applies here** (restated from Step 1, because this is the step that breaks it): reading a caller or a helper outside the diff to decide whether a changed line is correct is *expected*. Reporting a bug you noticed in that caller is not — that finding is dropped, or goes to the report footer as a one-line follow-up. The question this step answers is only ever "is the **changed** code correct?"

**Language-specific patterns** for the files in scope come from the rule files loaded in Step 1 — each carries the concrete triggers *and* the conditions under which they must not be reported.

### Step 3: Pattern Check

Check consistency with project conventions.

- Compare naming against existing codebase patterns (use `Grep` to sample similar code)
- Check file structure: is it in the right layer/directory per project conventions?
- Check for mutations — all state changes should use immutable patterns
- Check for hardcoded values that should be constants or config
- Check TypeScript: no `any`, full type coverage, no non-null assertions without justification
- Flag inconsistencies as MEDIUM or LOW depending on impact

Mutation, type-escape, and idiom triggers are language-specific — take them from the Step 1 rule files rather than applying one language's conventions to another's.

### Step 4: Security Check

Check for security-relevant issues.

- Scan for: hardcoded secrets, API keys, passwords in code or comments
- Scan for: unvalidated user input passed to queries, file paths, or shell commands
- Scan for: missing authentication checks on new routes or functions
- Scan for: XSS vectors (unsanitized HTML output), CSRF exposure, open redirects
- If any security-sensitive code found (auth logic, input handling, crypto, payment): call `rune:sentinel` for deep scan
- Sentinel escalation is mandatory — do not skip it for auth or crypto code

**Optional cross-model second opinion** (security-critical / opus-escalated reviews only): a same-family reviewer shares blind spots with the author. For genuinely irreversible or attacker-facing changes (auth, crypto, payment, data migration), you MAY *offer* the user a different-architecture second pass via an external CLI (Gemini/Codex). This is opt-in and interactive-only — **offer, never auto-invoke**; skip in non-interactive runs (CI, `/loop`, scheduled) and announce the skip. If the user accepts, follow the safe transport in `../adversary/references/cross-model-escalation.md` (per-call authorization, read-only sandbox, stdin not inline args), pass the diff + the security contract (not your verdict), and reconcile the reply as data — not a ruling.

### Step 4.5: API Pit-of-Success Check

> Full detail moved to [`references/api-checks.md`](references/api-checks.md) (progressive disclosure). **Read that file before executing this section.**

### Step 4.7: API Contract / Breaking Change Check

> Full detail moved to [`references/api-checks.md`](references/api-checks.md) (progressive disclosure). **Read that file before executing this section.**

### Step 5: Test Coverage

Identify gaps in test coverage.

- Use `Bash` to check if a test file exists for each changed file
- Use `Glob` to find test files: `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`
- Read the test file and verify: are the new functions covered? are edge cases tested?
- If untested code found: call `rune:test` with specific instructions on what to test
- Flag as HIGH if business logic is untested, MEDIUM if utility code is untested

#### Per-Function Test Gap Analysis

> Full detail moved to [`references/test-gap-analysis.md`](references/test-gap-analysis.md) (progressive disclosure). **Read that file before executing this section.**

### Step 5.5: Two-Stage Review Gate

Separate spec compliance from code quality. Most reviews conflate both — this gate forces the distinction.

**Stage 1 — Spec Compliance (check FIRST)**

Before evaluating code quality, verify the implementation matches what was asked:

- Load the originating plan, task, ticket, or `requirements.md` if available
- Does the implementation cover every acceptance criterion? Check each one explicitly
- Is there **under-engineering** — requirements stated but not implemented?
- Is there **over-engineering** — abstractions, generalization, or features beyond scope?
- Does the file/function structure match what the plan specified?

Flag spec deviations as HIGH — clean code that misses requirements ships broken products.

```
# Spec Compliance Checklist
[ ] All acceptance criteria from plan/ticket covered
[ ] No stated requirements missing from implementation
[ ] No unrequested features added (scope creep)
[ ] API surface matches what was specified (signatures, endpoints, return types)
[ ] File structure matches plan (no renamed or relocated files without justification)
```

If spec violations found: document them separately from code quality findings in the report. Label as `SPEC-MISS` or `SPEC-CREEP`.

**Stage 2 — Code Quality**

Proceed to Step 6 only after Stage 1 passes. Code quality findings (bugs, patterns, security, coverage) are the existing Steps 2–5 above.

The review report MUST show both stages: spec compliance verdict first, then code quality findings.

### Step 5.7: Subtractive Pass (over-engineering lens)

Stage 1 catches SPEC-CREEP (unrequested *features*). This pass goes further: it hunts complexity worth **deleting** even inside requested scope, and reports it as a one-line-per-finding cut list with a net-lines total. Run it on any diff that adds a class, wrapper, config option, or dependency. Skip for pure config/docs/style diffs.

Tag each finding, one line: `<file>:L<line>: <tag> <what>. <replacement>.`

| Tag | Cuts | Replacement |
|-----|------|-------------|
| `delete:` | Dead code, unused flexibility, speculative feature | Nothing |
| `stdlib:` | Hand-rolled thing the standard library ships | Name the function |
| `native:` | Dependency or code doing what the platform already does | Name the feature |
| `yagni:` | Abstraction with one implementation, config nobody sets, layer with one caller | Inline it until a 2nd caller exists |
| `shrink:` | Same logic, fewer lines | Show the shorter form |

End with the only metric that matters: `net: -<N> lines, -<M> deps possible.` Nothing to cut → `Lean already.` and move on.

**Ranking discipline**: these are LOW/MEDIUM findings (complexity, not correctness) — a subtractive suggestion NEVER outranks a real bug. A single smoke test or assert-based self-check is the ponytail minimum, not bloat — never flag it for deletion. This pass lists cuts; it does not apply them (route to `rune:fix`).

### Step 6: Report

Produce a structured severity-ranked report.

#### Falsification Pass (run before writing the report)

> Full detail moved to [`references/report-passes.md`](references/report-passes.md) (progressive disclosure). **Read that file before executing this section.**

#### Anchor Pass (run per surviving finding)

> Full detail moved to [`references/report-passes.md`](references/report-passes.md) (progressive disclosure). **Read that file before executing this section.**

### Step 6.5: Fix-First Triage

A review that produces 20 findings and delegates every one of them back to the user has moved work, not done it.

Classify each finding as **AUTO-FIX** or **ASK** before reporting:

| Category | Auto-Fix? | Examples |
|----------|-----------|---------|
| Dead imports, unused variables | AUTO-FIX | `import { foo } from './bar'` where foo is never used |
| Missing error handling on obvious paths | AUTO-FIX | `await fetch()` without try/catch in production code |
| Console.log in production code | AUTO-FIX | Remove `console.log` from non-CLI production files |
| Architectural concern, trade-off | ASK | "This bypasses the auth middleware — intentional?" |
| Ambiguous intent | ASK | "Is this fallback behavior correct for null users?" |
| Style/convention disagreement | ASK | "Project uses camelCase but this file uses snake_case" |

**After classification:**
- Apply AUTO-FIX findings directly via `rune:fix` — include all in a single batch
- Collect ASK findings into ONE `AskUserQuestion` — not 5 separate questions
- Report both: "Auto-fixed 4 issues. 2 findings need your input: [...]"

**Rationalization prevention**: "This looks fine" is NOT acceptable without evidence. If you cannot cite a specific file:line or convention that justifies the code, do not wave it through — report it as an `ASSUMED` finding naming the premise you could not check.

This is the same asymmetry as the Falsification Pass, applied in the other direction: uncertainty never justifies **dropping** a finding, and it never justifies **clearing** code either. Both resolve by reading, or by saying plainly what was not read.

### Step 6.6: Scope Drift Detection

> Full detail moved to [`references/scope-drift.md`](references/scope-drift.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:fix`, `rune:test`.

## UI/UX Anti-Pattern Checks

> Full detail moved to [`references/ui-ux-checks.md`](references/ui-ux-checks.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:design`.

## Motion Craft Checks

> Full detail moved to [`references/ui-ux-checks.md`](references/ui-ux-checks.md) (progressive disclosure). **Read that file before executing this section.**

## Weighted Composite Scoring

> Full detail moved to [`references/composite-scoring.md`](references/composite-scoring.md) (progressive disclosure). **Read that file before executing this section.**


## Severity Levels

```
CRITICAL  — security vulnerability, data loss risk, crash bug
HIGH      — logic error, missing validation, broken edge case
MEDIUM    — code smell, performance issue, missing error handling
LOW       — style inconsistency, naming suggestion, minor refactor opportunity
```

## Output Format

````
## Code Review Report
- **Files Reviewed**: [count]
- **Findings**: [count by severity]
- **Review Commit**: [git hash at time of review]
- **Council**: [not invoked | MULTI_FAMILY (N families) | NO_DECORRELATION — same-family subagents only]
- **Unanchored**: [count — findings whose evidence did not resolve to a line]
- **Overall**: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION

### Spec Compliance
- [PASS/FAIL]: [acceptance criteria coverage]

### CRITICAL
- `src/auth/session.ts:42` — [OBSERVED] loose equality on the session token: a request with no token and a session with no token are both `undefined`, and `undefined == undefined` is true, so an anonymous caller is granted that session's user
  ```ts
  if (req.token == session.token) return grant(session.user);
  ```

### HIGH
- `src/db/users.ts:85` — [DERIVED] create is not awaited, so the handler returns success before the write lands; a failed insert is reported to the client as 201
  ```ts
  db.users.create(data);
  return { success: true };
  ```

### MEDIUM
- `src/cache/store.ts (unanchored)` — [ASSUMED: caller in worker.ts not read] cache write has no TTL; if the worker path also writes this key the entry never expires
  ```ts
  cache.set(key, value)
  ```

### Blast Radius
- [High-impact symbols with caller counts]

### Positive Notes
- [good patterns observed]

### Verdict
[Summary and recommendation]

### Follow-ups (outside this scope)
- `other/file.ts` — [one line, no severity, does not affect the verdict; omit section if none]
````

Read the MEDIUM entry above as the shape of an honest weak finding: unanchored (so `path (unanchored)`, already downgraded one level), `ASSUMED` with its unchecked premise named, and still reported — because none of that is counter-evidence.

Every finding carries its claim type from the Falsification Pass and its evidence block from the Evidence Contract. `ASSUMED` findings name the premise that was not checked and never appear under CRITICAL. A finding over the 5-line evidence cap is a design comment — it ships without a block, at MEDIUM or below. The Follow-ups section is the only place an out-of-scope observation may appear.

### Review Staleness Detection

Track the git commit hash at review time. If code changes after review → review is STALE.

```
Review commit: abc123 → Code changed to def456 → Review is STALE, re-review required
```

When `cook` or `ship` checks review status: compare review commit hash with current HEAD. If different → WARN: "Review is stale — code changed since last review."


### Junk-match and ship-worthiness

After the suite is green, run `rune verify --junk` (and `--integrity` if tests changed) on this diff. HIGH findings are blocking. Then do the judgment pass in [junk-match](references/junk-match.md): special-case `if`s that only exist for the test’s inputs, golden files copied into runtime paths, production reads of fixtures/snapshots. A match that is junk is not APPROVE. Recurring findings go in `.rune/review-findings.jsonl` for `rune verify --reflect`.

## Constraints

1. MUST read the full diff — not just the files the user pointed at
2. MUST give every finding a verbatim evidence snippet, and resolve its line via the Anchor Pass rather than recall — an unresolved finding is reported `(unanchored)` and downgraded, never renumbered by guess
3. MUST NOT rubber-stamp with generic praise ("well-structured", "clean code") without evidence
4. MUST check: correctness, security, performance, conventions, test coverage
5. MUST categorize findings: CRITICAL (blocks commit) / HIGH / MEDIUM / LOW
6. MUST escalate to sentinel if auth/crypto/secrets code is touched
7. MUST flag untested code paths and recommend tests via rune:test

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Code review report | Markdown | inline (chat output) |
| Severity-ranked findings | Markdown table | inline |
| Spec compliance verdict | Markdown | inline |
| Composite quality score | Markdown table | inline (when `mode: "scored"`) |
| Blast radius assessment | Markdown table | inline |

## Chain Metadata

Append to Code Review Report when invoked standalone. Suppress when called as sub-skill inside an L1 orchestrator (cook, team, etc.) — the orchestrator emits a consolidated block. See `docs/references/chain-metadata.md`.

```yaml
chain_metadata:
  skill: "rune:review"
  version: "1.5.0"
  status: "[DONE | DONE_WITH_CONCERNS]"
  domain: "[area reviewed]"
  files_changed: []  # review doesn't change files
  exports:
    findings_count: { critical: [N], high: [N], medium: [N], low: [N] }
    findings:
      - { severity: "[level]", file: "[path]", line: [N or null when unanchored], anchored: [true | false], evidence: "[verbatim snippet, ≤5 lines]", message: "[issue]", claim_type: "[OBSERVED | DERIVED | ASSUMED]" }
    verdict: "[APPROVE | REQUEST_CHANGES | NEEDS_DISCUSSION]"
    quality_score: [0-100]  # when mode: "scored"
  suggested_next:
    - skill: "rune:fix"
      reason: "[grounded in findings — e.g., '2 HIGH findings in api/users.ts need remediation']"
      consumes: ["findings"]
```

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Finding flood — 20+ findings overwhelm developer | MEDIUM | Falsification Pass drops disproven findings; consolidate similar issues per file |
| "LGTM" without file:line evidence | HIGH | HARD-GATE blocks this — cite at least one specific item per changed file |
| Expanding review scope beyond the diff | MEDIUM | Strict Focus Rule (Step 1) — read anything for context, but findings about out-of-scope files are dropped or become footer follow-ups |
| Dropping a true finding because it could not be confirmed | HIGH | Falsification Pass — only counter-evidence drops a finding; "unsure" reports it as `ASSUMED` |
| Line number recalled from context instead of resolved — points at the wrong line, reader finds nothing, stops trusting the report | HIGH | Evidence Contract (Step 2) produces a copyable snippet; the Anchor Pass (Step 6) resolves the number with `Grep`. Never write a line number you did not get back from a tool |
| Dropping a finding because its evidence would not anchor | MEDIUM | Anchoring resolves, it never filters — `UNANCHORED` downgrades one level and reports with the snippet inline. A failed `Grep` is not counter-evidence |
| Reading every rule file regardless of the diff's languages | MEDIUM | Step 1 Rule Loading — load only the files matching extensions in scope, plus `default.md`. A rule for a language absent from the diff can only produce a plausible-looking false finding |
| Applying a rule's trigger while ignoring its `Do not report when…` clause | HIGH | The negative clause is part of the rule, not commentary on it. A rule cited without checking its exclusion is the single most common source of confident false alarms |
| Security finding without sentinel escalation | HIGH | Any auth/crypto/payment code touched → MUST call rune:sentinel |
| Skipping UI anti-pattern checks for frontend changes | MEDIUM | Any .tsx/.jsx/.svelte/.vue in diff → MUST run UI/UX Anti-Pattern Checks section |
| Skipping spec compliance check (Step 5.5 Stage 1) | HIGH | Code quality without spec check ships clean code that does the wrong thing — always load the plan/ticket before reviewing quality |
| Treating purple/indigo accent as "just a color choice" | MEDIUM | It is a documented AI-generated UI signature — always flag for domain justification |
| Suggesting "add X" without checking if X is used | MEDIUM | YAGNI pushback: grep codebase for the suggested feature → if uncalled anywhere → respond "Not called anywhere. Remove? (YAGNI)". Valid pushback, not laziness |
| Adding abstractions "for future flexibility" | MEDIUM | Three similar lines > premature abstraction. Only abstract when there are 3+ concrete callers today |
| Missing cross-phase integration check at phase boundary | MEDIUM | When reviewing a phase completion: check orphaned exports, uncalled routes, auth gaps, E2E flow continuity. Delegate to completion-gate Step 4.5 |
| Review loop exceeds 3 iterations without resolution | MEDIUM | Cap at 3 review loops. After 3rd iteration with unresolved findings → surface to user with "these findings persist after 3 fix attempts — needs human decision" |
| Auto-fixing something that should have been ASK | HIGH | When in doubt, ASK. AUTO-FIX only for mechanical issues (dead imports, console.log). Anything involving intent or trade-offs = ASK |
| Scope drift flagged on intentional refactoring | LOW | Scope drift is informational, not blocking. User can override with "intentional" — don't re-flag after override |
| (council) Reporting council output as consensus when decorrelation is NO_DECORRELATION | CRITICAL | Step 1.6 consume rule: report the decorrelation stamp plainly, never imply independent confirmation from same-family subagents |
| (council) Calling council on every review, not just high-blast-radius | MEDIUM | Step 1.6 skip condition matches the existing Step 1.5 HARD-GATE threshold exactly — no separate lower bar |

## Done When

- All changed files in the diff read and analyzed
- Rule files matching the diff's extensions loaded (plus `default.md`), and no others
- Every finding carries a verbatim evidence snippet and a severity label, with its line resolved by the Anchor Pass or marked `(unanchored)` and downgraded
- Security-critical code escalated to sentinel (or confirmed not present)
- Test coverage gaps identified and documented
- UI anti-pattern checks ran for any frontend files in diff (or confirmed not applicable)
- Structured report emitted with APPROVE / REQUEST CHANGES / NEEDS DISCUSSION verdict
- `rune verify --junk` ran (HIGH findings are REQUEST CHANGES); ship-worthiness judgment recorded when tests were green
- (council) If blast radius 50+ with HIGH severity: council invoked on the diff, decorrelation stamp reported plainly, consensus/dissent folded into findings

## Cost Profile

~3000-6000 tokens input, ~1000-2000 tokens output. Sonnet default, opus for security-critical reviews. Runs once per implementation cycle. When Step 1.6 fires (high-blast-radius only): add council's cost profile (~1500-4000 tokens per voice × 2-5 voices) — reserved for the same tier that already requires adversarial escalation.
