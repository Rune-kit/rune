---
name: review
description: Code quality review — patterns, security, performance, correctness. Finds bugs, suggests improvements, triggers fix for issues found. Escalates to opus for security-critical code.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: development
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

## Called By (inbound)

- `cook` (L1): Phase 5 REVIEW — post-implementation quality check
- `fix` (L2): complex fix requests self-review
- User: `/rune review` direct invocation
- `surgeon` (L2): review refactored code quality
- `rescue` (L1): review refactored code quality

## Cross-Hub Connections

- `review` → `test` — untested edge case found → test writes it
- `review` → `fix` — bug found during review → fix applies correction
- `review` → `scout` — needs more context → scout finds related code
- `review` ← `fix` — complex fix requests self-review
- `review` → `sentinel` — security-critical code → sentinel deep scan

## Execution

### Step 1: Scope

Determine what to review.

- If triggered by a commit or PR: use `Bash` with `git diff main...HEAD` or `git diff HEAD~1` to see exactly what changed
- If triggered by a specific file or feature: use `Read` on each named file
- If context is unclear: use `rune:scout` to identify all files touched by the change
- List every file in scope before proceeding — do not review files outside the stated scope

### Step 2: Logic Check

Read each changed file and check for correctness.

- Use `Read` on every file in scope
- Check for: logic errors, off-by-one errors, incorrect conditionals, broken async/await patterns
- Check for: missing error handling, uncaught promise rejections, silent failures
- Check for: edge cases — empty input, null/undefined, zero, negative numbers, empty arrays
- Flag each finding with file path, line number, and severity

**Common patterns to flag:**

```typescript
// BAD — missing await causes race condition
async function saveUser(data) {
  db.users.create(data); // caller proceeds before save completes
  return { success: true };
}
// GOOD
async function saveUser(data) {
  await db.users.create(data);
  return { success: true };
}
```

```typescript
// BAD — null deref crash
function getUsername(user) {
  return user.profile.name.toUpperCase(); // crashes if profile or name is null
}
// GOOD — safe access
function getUsername(user) {
  return user?.profile?.name?.toUpperCase() ?? 'Anonymous';
}
```

### Step 3: Pattern Check

Check consistency with project conventions.

- Compare naming against existing codebase patterns (use `Grep` to sample similar code)
- Check file structure: is it in the right layer/directory per project conventions?
- Check for mutations — all state changes should use immutable patterns
- Check for hardcoded values that should be constants or config
- Check TypeScript: no `any`, full type coverage, no non-null assertions without justification
- Flag inconsistencies as MEDIUM or LOW depending on impact

**Common patterns to flag:**

```typescript
// BAD — mutation
function addItem(cart, item) {
  cart.items.push(item); // mutates in place
  return cart;
}
// GOOD — immutable
function addItem(cart, item) {
  return { ...cart, items: [...cart.items, item] };
}
```

```typescript
// BAD — any defeats TypeScript's purpose
function process(data: any): any {
  return data.items.map((i: any) => i.value);
}
// GOOD — typed
function process(data: { items: Array<{ value: string }> }): string[] {
  return data.items.map(i => i.value);
}
```

### Step 4: Security Check

Check for security-relevant issues.

- Scan for: hardcoded secrets, API keys, passwords in code or comments
- Scan for: unvalidated user input passed to queries, file paths, or shell commands
- Scan for: missing authentication checks on new routes or functions
- Scan for: XSS vectors (unsanitized HTML output), CSRF exposure, open redirects
- If any security-sensitive code found (auth logic, input handling, crypto, payment): call `rune:sentinel` for deep scan
- Sentinel escalation is mandatory — do not skip it for auth or crypto code

### Step 5: Test Coverage

Identify gaps in test coverage.

- Use `Bash` to check if a test file exists for each changed file
- Use `Glob` to find test files: `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`
- Read the test file and verify: are the new functions covered? are edge cases tested?
- If untested code found: call `rune:test` with specific instructions on what to test
- Flag as HIGH if business logic is untested, MEDIUM if utility code is untested

### Step 6: Report

Produce a structured severity-ranked report.

**Before reporting, apply confidence filter:**
- Only report findings with >80% confidence it is a real issue
- Consolidate similar issues: "8 functions missing error handling in src/services/" — not 8 separate findings
- Skip stylistic preferences unless they violate conventions found in `.eslintrc`, `CLAUDE.md`, or `CONTRIBUTING.md`
- Adapt to project type: a `console.log` in a CLI tool is fine; in a production API handler it is not

- Group findings by severity: CRITICAL → HIGH → MEDIUM → LOW
- Include file path and line number for every finding
- Include a Positive Notes section (good patterns observed)
- Include a Verdict: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION

After reporting:
- If any CRITICAL findings: call `rune:fix` immediately with the finding details
- If any HIGH findings: call `rune:fix` with the finding details
- If untested code: call `rune:test` with specific coverage gaps identified

## Framework-Specific Checks

Apply **only** if the framework is detected in the changed files. Skip if not relevant.

**React / Next.js** (detect: `import React` or `.tsx` files)
- `useEffect` with missing dependencies (stale closure) → flag HIGH
- List items using index as key on reorderable lists: `key={i}` → flag MEDIUM
- Props drilled through 3+ levels without Context or composition → flag MEDIUM
- Client-side hooks (`useState`, `useEffect`) in Server Components (Next.js App Router) → flag HIGH

**Node.js / Express** (detect: `import express` or `require('express')`)
- Missing rate limiting on public endpoints → flag MEDIUM
- `req.body` passed directly to DB without validation schema → flag HIGH
- Synchronous operations blocking the event loop inside async handlers → flag HIGH

**Python** (detect: `.py` files with `django`, `flask`, or `fastapi` imports)
- `except:` bare catch without specific exception type → flag MEDIUM
- Mutable default arguments: `def func(items=[])` → flag HIGH
- Missing type hints on public functions (if project uses mypy/pyright) → flag LOW

## Severity Levels

```
CRITICAL  — security vulnerability, data loss risk, crash bug
HIGH      — logic error, missing validation, broken edge case
MEDIUM    — code smell, performance issue, missing error handling
LOW       — style inconsistency, naming suggestion, minor refactor opportunity
```

## Output Format

```
## Code Review Report
- **Files Reviewed**: [count]
- **Findings**: [count by severity]
- **Overall**: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION

### CRITICAL
- `path/to/file.ts:42` — [description of critical issue]

### HIGH
- `path/to/file.ts:85` — [description of high-severity issue]

### MEDIUM
- `path/to/file.ts:120` — [description of medium issue]

### Positive Notes
- [good patterns observed]

### Verdict
[Summary and recommendation]
```

## Constraints

1. MUST read the full diff — not just the files the user pointed at
2. MUST reference specific file:line for every finding
3. MUST NOT rubber-stamp with generic praise ("well-structured", "clean code") without evidence
4. MUST check: correctness, security, performance, conventions, test coverage
5. MUST categorize findings: CRITICAL (blocks commit) / HIGH / MEDIUM / LOW
6. MUST escalate to sentinel if auth/crypto/secrets code is touched
7. MUST flag untested code paths and recommend tests via rune:test

## Cost Profile

~3000-6000 tokens input, ~1000-2000 tokens output. Sonnet default, opus for security-critical reviews. Runs once per implementation cycle.
