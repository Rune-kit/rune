---
name: review
description: Code quality review — patterns, security, performance, correctness. Finds bugs, suggests improvements, triggers fix for issues found. Escalates to opus for security-critical code.
metadata:
  author: runedev
  version: "1.1.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Glob, Grep"
  emit: review.complete, review.issues
  listen: code.changed, docs.updated
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
- `review` ← `fix` — complex fix requests self-review
- `review` → `sentinel` — security-critical code → sentinel deep scan

## Execution

### Step 1: Scope

Determine what to review.

- If triggered by a commit or PR: use `Bash` with `git diff main...HEAD` or `git diff HEAD~1` to see exactly what changed
- If triggered by a specific file or feature: use `Read` on each named file
- If context is unclear: use `rune:scout` to identify all files touched by the change
- List every file in scope before proceeding — do not review files outside the stated scope

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

### Step 2: Logic Check (Production-Critical Focus)

Read each changed file. Prioritize bugs that **pass CI but break production** — these are the highest-value findings because linters and type checkers already catch the rest.

- Use `Read` on every file in scope
- **Race conditions**: async operations without proper sequencing, shared mutable state, missing locks
- **State corruption**: mutations that affect other consumers, cache invalidation gaps, stale closures
- **Silent failures**: caught errors that swallow context, empty catch blocks, promises without rejection handling
- **Data loss paths**: write operations without confirmation, delete without soft-delete, truncation without backup
- **Edge cases**: empty input, null/undefined, zero, negative numbers, empty arrays, Unicode, timezone boundaries
- Check for: logic errors, off-by-one errors, incorrect conditionals, broken async/await patterns
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

### Step 4.5: API Pit-of-Success Check

For code that exposes APIs, shared utilities, or reusable interfaces, evaluate through 3 adversary personas:

| Adversary | Mindset | What They Reveal |
|-----------|---------|-----------------|
| **The Scoundrel** | Malicious — controls config, crafts inputs, exploits edge cases | Security holes, privilege escalation, injection surfaces |
| **The Lazy Developer** | Copy-pastes from docs, skips error handling, uses defaults | Unsafe defaults, missing validation, footgun APIs |
| **The Confused Developer** | Misunderstands API semantics, passes wrong types, ignores return values | Ambiguous interfaces, poor naming, missing type safety |

**Pit-of-Success principle**: Secure, correct usage should be the path of least resistance. If the API makes it EASIER to use it wrong than right → WARN.

Check: Does the API have sensible defaults? Does misuse fail loudly (not silently)? Is the happy path obvious from the signature?

**Skip if**: Code is internal-only (no external consumers), single-use utility, or test-only.

### Step 4.7: API Contract / Breaking Change Check

For any change that modifies exported functions, REST endpoints, event schemas, or shared types, check for backward-compatibility violations before proceeding.

**Breaking change signals** — flag any of these as HIGH:

| Signal | Example | Why it Breaks |
|--------|---------|---------------|
| Removed export | `export function getUser` deleted | Callers crash at import |
| Renamed parameter | `id: string` → `userId: string` | Named-argument callers break |
| Narrowed return type | `User \| null` → `User` (null removed) | Callers that handle null crash |
| Required arg added | `fn(a)` → `fn(a, b: string)` | All existing callers missing `b` |
| Status code changed | 200 → 204 on success | Clients checking for body break |
| Event schema changed | `{ userId }` → `{ user_id }` | Consumers miss the field |
| Endpoint path renamed | `/users/:id` → `/users/:userId` | All client URLs broken |

**Versioning check:**
1. Run `git diff main...HEAD` — list every changed exported symbol
2. For each changed export: check if old signature still exists as an alias or overload
3. If breaking and no version bump → WARN: "Breaking change detected in [symbol] — needs CHANGELOG entry and version bump"
4. If `CHANGELOG.md` found: check that breaking changes are documented in the current version entry

**Skip if**: Change is internal-only (no exports changed, no public API surface affected), or in test files only.

### Step 5: Test Coverage

Identify gaps in test coverage.

- Use `Bash` to check if a test file exists for each changed file
- Use `Glob` to find test files: `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`
- Read the test file and verify: are the new functions covered? are edge cases tested?
- If untested code found: call `rune:test` with specific instructions on what to test
- Flag as HIGH if business logic is untested, MEDIUM if utility code is untested

#### Per-Function Test Gap Analysis

Go beyond "test file exists" — check coverage at function granularity:

1. **Extract changed functions** — from the diff, list every function/method that was added or modified (name + file:line)
2. **Map to test assertions** — for each changed function, Grep the test file for its name. Count distinct test cases (look for `it(`, `test(`, `describe(` blocks that reference the function)
3. **Classify gap severity**:

| Function Type | 0 tests | 1 test | 2+ tests |
|--------------|---------|--------|----------|
| Business logic (money, auth, state) | BLOCK | WARN: "only happy path" | PASS |
| Data transform (parse, format, map) | HIGH | PASS | PASS |
| Event handler (onClick, onSubmit) | MEDIUM | PASS | PASS |
| Pure utility (string, math, date) | MEDIUM | PASS | PASS |

4. **Output per-function table** in review report:

```
### Test Gap Analysis
| Function | File | Tests Found | Verdict |
|----------|------|-------------|---------|
| calculateTotal | src/billing.ts:42 | 3 (happy, zero, overflow) | PASS |
| processRefund | src/billing.ts:89 | 0 | BLOCK — business logic untested |
| formatCurrency | src/utils.ts:12 | 1 | PASS |
```

5. **Flag untested edge cases** — for functions with only 1 test, check if the test covers: empty/null input, boundary values, error path. If only happy path → WARN: "only happy path tested for {function}"

**Skip if**: Diff only touches config, docs, styles, or test files themselves.

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

### Step 6.5: Fix-First Triage

> From gstack (garrytan/gstack, 50.9k★): "Reviews that produce 20 findings and delegate all to the user waste everyone's time."

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

**Rationalization prevention**: "This looks fine" is NOT acceptable without evidence. If you can't cite a specific file:line or convention that justifies the code, flag it as UNVERIFIED — don't rationalize away uncertainty.

### Step 6.6: Scope Drift Detection

> From gstack (garrytan/gstack, 50.9k★): "Intent vs diff catches scope creep that plan-based guards miss."

After reviewing code, compare **stated intent** vs **actual diff**:

1. Read the originating source: TODO list, PR description, commit messages, or plan file
2. Extract stated intent: "what was this change supposed to do?"
3. Run `git diff --stat` to see actual file changes
4. Compare:

| Result | Meaning | Action |
|--------|---------|--------|
| **CLEAN** | All changed files serve the stated intent | Note in report |
| **DRIFT** | 1-2 files changed that don't relate to stated intent | WARN — "These files were modified but aren't mentioned in the task: [list]" |
| **REQUIREMENTS_MISSING** | Stated intent mentions files/features not in the diff | WARN — "Task mentions X but it's not in the diff" |

**This is informational, not blocking.** Scope drift is common and sometimes intentional — but making it visible prevents silent creep.

After reporting:
- If any CRITICAL findings: call `rune:fix` immediately with the finding details
- If any HIGH findings: call `rune:fix` with the finding details
- If untested code: call `rune:test` with specific coverage gaps identified
- Call `neural-memory` (Capture Mode) to save any novel code quality patterns or recurring issues found.

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

## UI/UX Anti-Pattern Checks

Apply **only** when `.tsx`, `.jsx`, `.svelte`, `.vue`, or `.html` files are in the diff. Skip for backend-only changes.

These are the **"AI UI signature"** — patterns that make AI-generated frontends visually identifiable as non-human-designed. Flag each as MEDIUM severity.

**Preamble — load design contract first:**
If `.rune/design-system.md` exists, read it first. Pull the project's **Scale Minimums** block (if authored by `rune:design` v0.5.0+) and apply those thresholds instead of the defaults below. Missing design-system.md → use defaults and add a LOW finding: "Project has no design-system.md — run `rune design` to lock visual decisions." Never enforce stale defaults against a project that has already declared stricter/looser minimums.

**AI_ANTIPATTERN — Purple/indigo default accent with no domain justification:**
```tsx
// BAD: LLM default color bias — signals "AI-generated" to experienced designers
className="bg-indigo-600 text-white"  // every button/CTA is indigo
// GOOD: domain-appropriate — trading → neutral dark, healthcare → trust blue,
//        e-commerce → conversion-optimized warm. Purple is only appropriate for
//        AI-native tools and creative platforms.
```

**AI_ANTIPATTERN — Card-grid monotony (every section is 3-col cards, zero layout variation):**
```tsx
// BAD: every section uses the same grid pattern
<div className="grid grid-cols-3 gap-6">  // features
<div className="grid grid-cols-3 gap-6">  // testimonials
<div className="grid grid-cols-3 gap-6">  // pricing
// GOOD: mix layouts — split sections, bento grids, full-bleed hero, list+detail
```

**AI_ANTIPATTERN — Centeritis (everything centered, no directional flow):**
```tsx
// BAD: no visual tension, no reading direction
<div className="text-center flex flex-col items-center">  // hero
<div className="text-center">  // every feature section
// GOOD: left-align body copy, use centering intentionally for hero/CTAs only
```

**AI_ANTIPATTERN — Numeric/financial values in non-monospace font:**
```tsx
// BAD: prices, stats, metrics in Inter/Roboto
<span className="text-2xl font-bold">${price}</span>
// GOOD: monospace for all numbers that need alignment
<span className="font-mono text-2xl font-bold">${price}</span>
```

**AI_ANTIPATTERN — Scale Minimum violations (AI boilerplate tell):**
```tsx
// BAD: body text at 14px (AI default) — primary content must be ≥16px
<p className="text-sm">Welcome to the dashboard.</p>

// BAD: hero/display text below 40px — reads as "section heading", not "hero"
<h1 className="text-3xl font-bold">Ship Faster</h1>  // 30px

// BAD: touch target below 44×44px on mobile
<button className="w-8 h-8"><XIcon /></button>  // 32px — WCAG 2.5.8 failure

// GOOD: hero ≥48px, body ≥16px, touch ≥44×44px
<h1 className="text-5xl md:text-6xl font-bold">Ship Faster</h1>   // 48-60px
<p className="text-base">Welcome to the dashboard.</p>             // 16px
<button className="w-11 h-11"><XIcon /></button>                   // 44px
```
Pull project-specific overrides from `.rune/design-system.md` § Scale Minimums.

**AI_ANTIPATTERN — Hand-rolled SVG for standard iconography:**
```tsx
// BAD: custom <svg> for dashboard/menu/close/chevron — AI geometry almost always malformed
<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z M3 9h18 M9 3v18"/></svg>

// GOOD: Phosphor Icons (preferred) or Huge Icons
import { House, List, X } from '@phosphor-icons/react';
<House weight="bold" size={24} />

// GOOD: labeled placeholder when no icon library available yet
<span className="icon-placeholder" aria-label="Dashboard icon — design pass needed">
  [ ICON: dashboard ]
</span>
```
Exceptions: inline SVG for project-unique logos, data visualizations (charts/graphs), or decorative illustrations generated by a human designer — these are not "standard iconography."

**AI_ANTIPATTERN — Manual hex shading for accent states (oklch() violation):**
```css
/* BAD: hand-darkened hex — breaks perceived lightness consistency */
--accent: #3b82f6;
--accent-hover: #2563eb;    /* guessed darker */
--accent-pressed: #1d4ed8;  /* guessed even darker */

/* GOOD: relative oklch() derivation */
--accent: oklch(62% 0.19 258);
--accent-hover:   oklch(from var(--accent) calc(l - 0.08) c h);
--accent-pressed: oklch(from var(--accent) calc(l - 0.15) c h);
--accent-subtle:  oklch(from var(--accent) calc(l + 0.3) calc(c * 0.4) h);
```
Flag any CSS file defining 2+ hover/pressed/active variants with sibling hex literals. Not a finding if accent uses a design-token library (Radix Colors, Tailwind palette) that already ships perceptually-tuned scales.

**AI_ANTIPATTERN — Missing UI states (only happy path rendered):**
```tsx
// BAD: data rendering without empty/error/loading states
{data.map(item => <Card key={item.id} {...item} />)}
// GOOD: all 4 states covered
{isLoading && <CardSkeleton />}
{error && <ErrorState message={error.message} />}
{!data.length && <EmptyState />}
{data.map(item => <Card key={item.id} {...item} />)}
```

**Accessibility — flag as HIGH (these are WCAG 2.2 failures):**
```tsx
// BAD: icon button with no accessible name
<button onClick={close}><XIcon /></button>
// GOOD
<button onClick={close} aria-label="Close dialog"><XIcon aria-hidden="true" /></button>

// BAD: placeholder as label
<input placeholder="Email address" type="email" />
// GOOD
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

// BAD: removes focus ring without replacement
className="focus:outline-none"
// GOOD: must have focus-visible replacement
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"

// BAD: color as sole information conveyor
<span className="text-red-500">{errorMessage}</span>
// GOOD: icon + color + text
<span className="text-red-500 flex gap-1"><ErrorIcon aria-hidden />Error: {errorMessage}</span>
```

**WCAG 2.2 New Rules — flag as MEDIUM:**
- `position: sticky` or `position: fixed` header/footer without `scroll-padding-top` → Focus Not Obscured (2.4.11)
- Interactive elements with `width < 24px` or `height < 24px` without 8px spacing → Target Size (2.5.8)
- Multi-step form re-asking for previously entered data → Redundant Entry (3.3.7)

**Platform-Specific — flag as MEDIUM when platform is detectable:**
- iOS target: solid-background cards (iOS 26 Liquid Glass deprecates this visual language) — should use translucent/blur surfaces
- Android target: hardcoded hex colors instead of `MaterialTheme.colorScheme` tokens → not adaptive to dynamic color

## Weighted Composite Scoring

When a review is part of a recurring quality-gate cycle (e.g., sprint review, pre-release gate), produce a **composite quality score** alongside the findings list. This makes review output numeric and comparable across runs.

### Formula

```
Quality Score = (Correctness × 0.35) + (Security × 0.30) + (Test Coverage × 0.20) + (Conventions × 0.15)
```

Each dimension is scored 0–100 based on findings count and severity:
- 0 CRITICAL/HIGH findings → 100 for that dimension
- 1 CRITICAL → dimension capped at 40
- 1 HIGH → dimension capped at 70
- Each additional MEDIUM → subtract 5 (floor: 50)

### Grade Thresholds

| Score | Grade | Verdict |
|-------|-------|---------|
| 90–100 | Excellent | APPROVE |
| 75–89 | Good | APPROVE with notes |
| 60–74 | Fair | REQUEST CHANGES (MEDIUM issues) |
| 40–59 | Poor | REQUEST CHANGES (HIGH issues present) |
| 0–39 | Critical | REQUEST CHANGES (CRITICAL present) |

**When to include**: Only when `mode: "scored"` is passed by the caller, or when invoked by `audit`. Default review output uses the standard severity-ranked report without the score.


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
- **Review Commit**: [git hash at time of review]
- **Overall**: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION

### Spec Compliance
- [PASS/FAIL]: [acceptance criteria coverage]

### CRITICAL
- `path/to/file.ts:42` — [description of critical issue]

### HIGH
- `path/to/file.ts:85` — [description of high-severity issue]

### MEDIUM
- `path/to/file.ts:120` — [description of medium issue]

### Blast Radius
- [High-impact symbols with caller counts]

### Positive Notes
- [good patterns observed]

### Verdict
[Summary and recommendation]
```

### Review Staleness Detection

Track the git commit hash at review time. If code changes after review → review is STALE.

```
Review commit: abc123 → Code changed to def456 → Review is STALE, re-review required
```

When `cook` or `ship` checks review status: compare review commit hash with current HEAD. If different → WARN: "Review is stale — code changed since last review."


## Constraints

1. MUST read the full diff — not just the files the user pointed at
2. MUST reference specific file:line for every finding
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
  version: "1.0.0"
  status: "[DONE | DONE_WITH_CONCERNS]"
  domain: "[area reviewed]"
  files_changed: []  # review doesn't change files
  exports:
    findings_count: { critical: [N], high: [N], medium: [N], low: [N] }
    findings:
      - { severity: "[level]", file: "[path]", line: [N], message: "[issue]" }
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
| Finding flood — 20+ findings overwhelm developer | MEDIUM | Confidence filter: only >80% confidence, consolidate similar issues per file |
| "LGTM" without file:line evidence | HIGH | HARD-GATE blocks this — cite at least one specific item per changed file |
| Expanding review scope beyond the diff | MEDIUM | Limit to `git diff` scope — do not creep into adjacent unchanged files |
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

## Done When

- All changed files in the diff read and analyzed
- Every finding references specific file:line with severity label
- Security-critical code escalated to sentinel (or confirmed not present)
- Test coverage gaps identified and documented
- UI anti-pattern checks ran for any frontend files in diff (or confirmed not applicable)
- Structured report emitted with APPROVE / REQUEST CHANGES / NEEDS DISCUSSION verdict

## Cost Profile

~3000-6000 tokens input, ~1000-2000 tokens output. Sonnet default, opus for security-critical reviews. Runs once per implementation cycle.
