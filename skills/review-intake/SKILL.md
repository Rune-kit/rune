---
name: review-intake
description: Use when receiving code review feedback, PR comments, or external suggestions before implementing any changes. Prevents blind implementation, enforces verification-first discipline.
metadata:
  author: runedev
  version: "1.0.0"
  layer: L2
  model: sonnet
  group: quality
---

# review-intake

## Purpose

The counterpart to `review`. While `review` finds issues in code, `review-intake` handles the response when someone finds issues in YOUR code. Enforces a verification-first discipline: understand fully, verify against codebase reality, then act. Prevents the common failure mode of blindly implementing suggestions that break things or don't apply.

## Triggers

- `/rune review-intake` — manual invocation when processing feedback
- Auto-trigger: when `cook` or `fix` receives PR review comments
- Auto-trigger: when user pastes review feedback into session

## Calls (outbound)

- `scout` (L3): verify reviewer claims against actual codebase
- `fix` (L2): apply verified changes
- `test` (L2): add tests for edge cases reviewers found
- `hallucination-guard` (L3): verify suggested APIs/packages exist
- `sentinel` (L2): re-check security if reviewer flagged concerns

## Called By (inbound)

- `cook` (L1): Phase 5 quality gate when external review arrives
- `review` (L2): when self-review surfaces issues to address

## Workflow

### Phase 1 — ABSORB

Read ALL feedback items before reacting. Do not implement anything yet.

Classify each item:

| Type | Example | Priority |
|---|---|---|
| BLOCKING | Security vuln, data loss, broken build | P0 — fix now |
| BUG | Logic error, off-by-one, race condition | P1 — fix soon |
| IMPROVEMENT | Better pattern, cleaner API, perf gain | P2 — evaluate |
| STYLE | Naming, formatting, conventions | P3 — quick fix |
| OPINION | "I would do it differently" | P4 — evaluate |

### Phase 2 — COMPREHEND

For each item, restate the technical requirement in your own words.

```
HARD-GATE: If ANY item is unclear → STOP entirely.
Do not implement clear items while unclear ones remain.
Items may be interconnected — partial understanding = wrong implementation.

Ask: "I understand items [X]. Need clarification on [Y] before proceeding."
```

### Phase 3 — VERIFY

Before implementing ANY suggestion, verify it against the codebase:

```
For each item:
  1. Does the file/function reviewer references actually exist?
  2. Is the reviewer's understanding of current behavior correct?
  3. Will this change break existing tests?
  4. Does it conflict with architectural decisions already made?
  5. If suggesting a package/API — does it actually exist? (hallucination-guard)
```

Use `scout` to check claims. Use `grep` to find actual usage patterns.

### Phase 4 — EVALUATE

For each verified item, decide:

| Verdict | Action |
|---|---|
| **CORRECT + APPLICABLE** | Queue for implementation |
| **CORRECT + ALREADY DONE** | Reply with evidence |
| **CORRECT + OUT OF SCOPE** | Acknowledge, defer to backlog |
| **INCORRECT** | Push back with technical reasoning |
| **YAGNI** | Check if feature is actually used — if unused, propose removal |

**YAGNI check:**
```bash
# Reviewer says "implement this properly"
# First: is anyone actually using it?
grep -r "functionName" --include="*.{ts,tsx,js,jsx}" src/
# Zero results? → "This isn't called anywhere. Remove it (YAGNI)?"
```

### Phase 5 — RESPOND

**What to say:**
```
CORRECT:  "Fixed. [Brief description]." or "Good catch — [issue]. Fixed in [file]."
PUSHBACK: "[Technical reason]. Current impl handles [X] because [Y]."
UNCLEAR:  "Need clarification on [specific aspect]."
```

**What NEVER to say:**
```
BANNED: "You're absolutely right!"
BANNED: "Great point!" / "Great catch!"
BANNED: "Thanks for catching that!"
BANNED: Any performative gratitude — actions speak, not words.
```

When replying to GitHub PR comments, reply in the thread:
```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies \
  -f body="Fixed — [description]"
```

### Phase 6 — IMPLEMENT

Execute in priority order: P0 → P1 → P2 → P3 → P4.

For each fix:
1. Apply change via `fix`
2. Run tests — verify no regression
3. If fix touches security → run `sentinel`
4. Move to next item only after current passes

## Source Trust Levels

| Source | Trust | Approach |
|---|---|---|
| **Project owner / user** | High | Implement after understanding. Still verify scope. |
| **Team member** | Medium | Verify against codebase. Implement if correct. |
| **External reviewer** | Low | Skeptical by default. Verify everything. Push back if wrong. |
| **AI-generated review** | Lowest | Double-check every suggestion. High hallucination risk. |

When external feedback conflicts with owner's prior architectural decisions → **STOP. Discuss with owner first.**

## Pushback Framework

Push back when:
- Suggestion breaks existing functionality (show failing test)
- Reviewer lacks context on WHY current impl exists
- YAGNI — feature isn't used
- Technically incorrect for this stack/version
- Conflicts with owner's documented decisions

How to push back:
- Lead with technical evidence, not defensiveness
- Reference working tests, actual behavior, or docs
- Ask specific questions that reveal the gap
- If wrong after pushback → "Verified, you were right. [Reason]. Fixing."

## Output Format

```
## Review Intake Report

### Summary
- **Items received**: [count]
- **Blocking**: [count] | Bugs: [count] | Improvements: [count] | Style: [count]

### Verdicts
| # | Item | Type | Verdict | Action |
|---|------|------|---------|--------|
| 1 | [description] | BUG | CORRECT | Fixed in [file] |
| 2 | [description] | IMPROVEMENT | YAGNI | Proposed removal |
| 3 | [description] | OPINION | PUSHBACK | [reason] |

### Changes Applied
- `path/to/file.ts` — [description]

### Verification
- Tests: PASS ([n] passed)
- Regressions: none
```

## Constraints

1. MUST read ALL items before implementing ANY — partial processing causes rework
2. MUST verify reviewer claims against actual codebase — never trust blindly
3. MUST NOT use performative language ("Great point!", "You're right!") — just fix it
4. MUST push back with technical reasoning when suggestion is wrong — correctness > comfort
5. MUST run tests after each individual fix — not batch-and-pray
6. MUST STOP and ask if any item is unclear — do not implement clear items while unclear ones remain

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Comprehension | All items understood | Ask clarifying questions, block implementation |
| Verification | Claims checked against codebase | Run scout + grep before implementing |
| Test pass | Each fix passes tests individually | Revert fix, re-diagnose |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Implementing suggestion that breaks existing feature | CRITICAL | Phase 3 verify: check existing tests before changing |
| Blindly trusting external reviewer | HIGH | Source Trust Levels: external = skeptical by default |
| Implementing 4/6 items, leaving 2 unclear | HIGH | HARD-GATE: all-or-nothing comprehension |
| Performative agreement masking misunderstanding | MEDIUM | Banned phrases list + restate-in-own-words requirement |
| Fixing tests instead of code to make review pass | HIGH | Defer to `fix` constraints: fix CODE, not TESTS |

## Done When

- All feedback items classified by type and priority
- Each item verified against codebase reality
- Verdicts assigned (correct/pushback/yagni/defer)
- Approved items implemented in priority order
- Tests pass after each individual fix
- Review Intake Report emitted

## Cost Profile

~2000-5000 tokens depending on feedback volume. Sonnet for evaluation logic, haiku for scout/grep verification.
