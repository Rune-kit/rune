---
name: safeguard
description: Build safety nets before refactoring. Creates characterization tests, boundary markers, config freezes, and rollback points.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: rescue
---

# safeguard

## Purpose

Build safety nets before any refactoring begins. Safeguard creates characterization tests that capture current behavior, adds boundary markers to distinguish legacy from new code, freezes config files, and creates git rollback points. Nothing gets refactored without safeguard running first.

<HARD-GATE>
Characterization tests MUST pass on the current (unmodified) code before any refactoring starts. If they do not pass, safeguard is not complete.
</HARD-GATE>

## Called By (inbound)

- `rescue` (L1): Phase 1 SAFETY NET — build protection before surgery
- `surgeon` (L2): untested module found during surgery

## Calls (outbound)

- `scout` (L2): find all entry points and public interfaces of the target module
- `verification` (L3): verify characterization tests pass on current code

## Cross-Hub Connections

- `surgeon` → `safeguard` — untested module found during surgery

## Execution Steps

### Step 1 — Identify module boundaries

Call `rune:scout` targeting the specific module. Ask scout to return:
- All public functions, classes, and exported symbols
- All files that import from this module (consumers)
- All files this module imports from (dependencies)
- Existing test files for this module (if any)

Use `Read` to open the module entry file and confirm the public interface.

### Step 2 — Write characterization tests

Create a test file at `tests/char/<module-name>.test.ts` (or `.js`, `.py` matching project convention).

Use `Write` to create the characterization test file. Rules for characterization tests:
- Tests MUST capture what the code CURRENTLY does, not what it should do
- Include edge cases that currently produce surprising output — test for that actual output
- Do NOT fix bugs in characterization tests — if the current code returns wrong data, test for that wrong data
- Cover every public function in the module
- Include at least one integration test calling the module as an external consumer would

Example structure:
```typescript
// tests/char/<module>.test.ts
// CHARACTERIZATION TESTS — DO NOT MODIFY without running safeguard again
// These tests capture existing behavior as of: [date]

describe('<module> — characterization', () => {
  it('existing behavior: [function] with [input] returns [actual output]', () => {
    // ...
  })
})
```

### Step 3 — Add boundary markers

Use `Edit` to add boundary comments at the top of the module file and at key function boundaries:

```typescript
// @legacy — rune-safeguard [date] — do not refactor without characterization tests passing
```

For functions flagged by autopsy as high-risk, add:
```typescript
// @do-not-touch — coupled to [module], change both or neither
```

For planned new implementations, mark insertion points:
```typescript
// @bridge — new-v2 will replace this interface
```

### Step 4 — Config freeze

Use `Bash` to record current config state:

```bash
mkdir -p .rune
cp tsconfig.json .rune/tsconfig.frozen.json 2>/dev/null || true
cp .eslintrc* .rune/ 2>/dev/null || true
cp package-lock.json .rune/package-lock.frozen.json 2>/dev/null || true
echo "Config frozen at $(date)" > .rune/freeze.log
```

This preserves the baseline config so surgery can be verified against it.

### Step 5 — Create rollback point

Use `Bash` to create a git tag:

```bash
git add -A
git commit -m "chore: safeguard checkpoint before [module] surgery" --allow-empty
git tag rune-safeguard-<module>
```

Replace `<module>` with the actual module name. Confirm the tag was created.

### Step 6 — Verify

Call `rune:verification` and explicitly pass the characterization test file path.

```
If characterization tests fail on the CURRENT (unchanged) code → STOP.
Fix the tests to match actual behavior before proceeding.
Characterization tests MUST pass on current code. This is non-negotiable.
```

Only after verification passes, declare the safety net complete.

## Output Format

```
## Safeguard Report
- **Module**: [module name]
- **Tests Added**: [count] characterization tests
- **Coverage**: [before]% → [after]%
- **Markers Added**: [count] boundary comments
- **Rollback Tag**: rune-safeguard-[module]
- **Config Frozen**: [list of files in .rune/]
- **Hard Gate**: PASSED — all characterization tests pass on current code

### Characterization Tests
- `tests/char/[module].test.ts` — [count] tests capturing current behavior

### Boundary Markers
- `@legacy`: [count] files marked
- `@do-not-touch`: [count] files protected
- `@bridge`: [count] insertion points marked

### Config Frozen
- [list of locked config files in .rune/]

### Next Step
Safe to proceed with: `rune:surgeon` targeting [module]
```

## Constraints

1. MUST write characterization tests that pass on CURRENT code before any refactoring
2. MUST NOT proceed to surgery if characterization tests fail — the safety net is broken
3. MUST cover critical paths identified by autopsy — not just easy-to-test functions
4. MUST verify tests are meaningful — tests that always pass regardless of code are useless

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Characterization tests that always pass regardless of code (trivial asserts) | CRITICAL | Constraint 4: tests must fail if the module is deleted or its logic is changed |
| Not covering critical paths identified by autopsy | HIGH | Constraint 3: cover high-risk functions first — autopsy flags which ones |
| Characterization tests written to "correct" behavior instead of current behavior | HIGH | Tests capture ACTUAL output, including bugs — do not fix behavior in the tests |
| Skipping config freeze step | MEDIUM | Step 4 is required — baseline config needed for comparison after surgery |
| No git tag created before declaring safeguard complete | MEDIUM | Tag `rune-safeguard-<module>` must exist before surgery begins |

## Done When

- Module boundaries identified via scout (public functions, consumers, dependencies)
- Characterization tests written for all public functions
- Tests PASS on current (unmodified) code — HARD-GATE verified
- Boundary markers added (@legacy, @bridge, @do-not-touch)
- Config files frozen to .rune/
- Git tag `rune-safeguard-<module>` created
- Safeguard Report emitted with test count, coverage, and rollback tag

## Cost Profile

~2000-5000 tokens input, ~1000-2000 tokens output. Sonnet for test writing quality.
