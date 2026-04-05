# Chain Metadata — Cross-Skill Data Forwarding Contract

Version: 1.0.0 | Since: v2.9.0

## Purpose

Chain metadata is a structured YAML block appended to every skill output report. It enables:
1. **Data forwarding** — downstream skills know what data is available without parsing prose
2. **Smart routing** — skill-router uses `suggested_next` for data-driven recommendations (not just hardcoded table)
3. **Audit trail** — every skill output is tagged with origin, status, and what it produced

## When to Emit

Every L1/L2 skill MUST append a `chain_metadata` block to its final output report. L3 utilities MAY emit it when invoked standalone (not as sub-skill).

**Suppression rule** (hierarchy-based): Only the TOP-LEVEL skill emits chain_metadata. Sub-skills suppress theirs.

| Invocation Chain | Who Emits |
|-----------------|-----------|
| user → debug (standalone) | debug emits |
| user → cook → debug (sub-skill) | cook emits, debug suppresses |
| user → autopilot → cook → debug | autopilot emits, cook + debug suppress |
| user → team → cook → debug | team emits, cook + debug suppress |

**Rule**: If your calling skill is an L1 orchestrator (cook, team, launch, rescue, scaffold) or autopilot (Pro), suppress your chain_metadata — the orchestrator emits a consolidated block at the end.

## Format

```yaml
chain_metadata:
  skill: "rune:<skill-name>"
  version: "<skill version>"
  status: "DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT"
  domain: "<area worked on — e.g., auth, payments, compiler>"
  files_changed:
    - "path/to/file.ts"
  exports:
    <key>: <value>  # structured data for downstream consumption
  suggested_next:
    - skill: "rune:<skill>"
      reason: "<why — based on THIS output's data, not generic>"
      consumes: ["<export_key>"]  # which exports the suggested skill would use
```

## Field Definitions

### `skill` (required)
The skill that produced this output. Format: `rune:<name>`.

### `version` (required)
Skill version at time of execution. Enables compatibility checks.

### `status` (required)
Outcome of the skill execution. Determines what `suggested_next` makes sense:
- `DONE` — suggest improvement/next-step skills
- `DONE_WITH_CONCERNS` — suggest review/audit skills
- `BLOCKED` — suggest debug/fix skills
- `NEEDS_CONTEXT` — suggest scout/research skills

### `domain` (required)
Short label for the area of work. Used by skill-router for L4 pack auto-suggest (e.g., domain "payments" triggers `@rune-pro/finance` suggestion).

### `files_changed` (optional)
List of files created or modified. Used by downstream skills to scope their work (e.g., review only these files, test only these modules).

### `exports` (required)
Structured key-value data produced by this skill. Each skill defines its own export schema. Downstream skills reference specific keys — not the entire blob.

**Export keys are skill-specific but follow naming conventions:**

| Key Pattern | Type | Producing Skills |
|-------------|------|-----------------|
| `test_results` | `{ passed, failed, coverage }` | test, cook, verification |
| `findings` | `[{ severity, file, line, message }]` | review, sentinel, preflight, sast |
| `root_cause` | `{ file, line, explanation }` | debug |
| `fix_recommendation` | `string` | debug |
| `commit_hash` | `string` | cook, fix, git |
| `plan_file` | `string (path)` | plan |
| `phase_count` | `number` | plan, cook |
| `quality_gates` | `{ preflight, sentinel, review }` | cook |
| `fix_applied` | `{ files, description }` | fix |
| `verification` | `{ lint, types, tests }` | fix, cook |
| `coverage_delta` | `{ before, after }` | test, cook |

**Numeric exports** (quality_score, severity, etc.) MUST use formulas from `docs/references/shared-formulas.md` to ensure cross-skill consistency. See also `docs/references/data-flow-map.md` for the full producer→consumer dependency graph.

### `suggested_next` (required, 1-3 items)
Data-driven recommendations for what to do next. Unlike skill-router's hardcoded table, these are based on the ACTUAL output data.

**Rules:**
- Max 3 suggestions. Prioritize by value.
- Each suggestion MUST have a `reason` grounded in this output's data (not generic advice).
- Each suggestion MUST list `consumes` — which export keys the suggested skill would use. This enables skill-router to pass context forward.
- Status-aware: BLOCKED outputs should suggest debug/fix, not review/deploy.

## Per-Skill Export Schemas

### cook
```yaml
exports:
  commit_hash: "abc1234"
  files_changed_count: 5
  test_results: { passed: 42, failed: 0, coverage: 85 }
  quality_gates: { preflight: "PASS", sentinel: "PASS", review: "PASS" }
  phase_count: 3
  concerns: []  # empty if DONE, populated if DONE_WITH_CONCERNS
```

### debug
```yaml
exports:
  root_cause: { file: "src/auth.ts", line: 42, explanation: "Race condition in token refresh" }
  severity: "high"
  confidence: "high"
  fix_recommendation: "Add mutex lock around refresh flow"
```

### fix
```yaml
exports:
  fix_applied: { files: ["src/auth.ts"], description: "Added mutex lock" }
  verification: { lint: "PASS", types: "PASS", tests: "PASS" }
  commit_hash: "def5678"
```

### review
```yaml
exports:
  findings_count: { critical: 0, high: 1, medium: 3, low: 2 }
  findings: [{ severity: "high", file: "src/api.ts", line: 15, message: "SQL injection risk" }]
  verdict: "REQUEST_CHANGES"
  quality_score: 72
```

### plan
```yaml
exports:
  plan_file: ".rune/plan-auth-refactor.md"
  phase_count: 3
  estimated_complexity: "medium"
  risk_areas: ["auth", "session"]
```

### test
```yaml
exports:
  test_results: { passed: 15, failed: 2, coverage: 78 }
  test_files: ["src/__tests__/auth.test.ts"]
  status: "RED"  # RED = failing (TDD expected), GREEN = all pass
```

### sentinel
```yaml
exports:
  findings_count: { critical: 0, high: 0, medium: 1, low: 3 }
  findings: [{ severity: "medium", file: "src/config.ts", line: 8, message: "Env var not validated" }]
  verdict: "PASS_WITH_WARNINGS"
```

## How skill-router Consumes chain_metadata

When chain_metadata is present in the conversation context from a previous skill output:

1. **Read `status`** — if BLOCKED, override hardcoded suggestion table with debug/fix
2. **Read `suggested_next`** — prefer these over the hardcoded one-hop table (they're data-driven)
3. **Read `domain`** — trigger L4 pack auto-suggest if domain matches a pack
4. **Read `exports`** — when routing to suggested skill, include relevant export keys in the routing context so the next skill knows what data is available
5. **Announce**: "Based on [skill] output: [suggested_next.reason]. Run `rune:[skill]`? (skip to continue)"

**Conflict resolution**: If chain_metadata suggests skill A but skill-router's hardcoded table suggests skill B, prefer chain_metadata (it has more context).

## How Downstream Skills Consume Exports

When a skill is invoked and chain_metadata exists from a prior skill:

1. Check if any `exports` keys are relevant to this skill's input
2. If yes, use them to skip redundant work (e.g., review doesn't need to re-discover files — use `files_changed`)
3. If no, ignore chain_metadata and proceed normally

**The skill MUST NOT require chain_metadata to function.** It's an optimization, not a dependency. Every skill must work standalone.

## Examples

### cook → review (data-driven)
```yaml
chain_metadata:
  skill: "rune:cook"
  version: "2.2.0"
  status: "DONE"
  domain: "auth"
  files_changed:
    - "src/auth/refresh.ts"
    - "src/auth/middleware.ts"
    - "src/__tests__/auth.test.ts"
  exports:
    commit_hash: "abc1234"
    test_results: { passed: 42, failed: 0, coverage: 85 }
    quality_gates: { preflight: "PASS", sentinel: "WARN", review: "PASS" }
  suggested_next:
    - skill: "rune:sentinel"
      reason: "Sentinel returned WARN on auth middleware — deeper security review recommended"
      consumes: ["quality_gates"]
    - skill: "rune:test"
      reason: "Coverage at 85% — auth edge cases (expired tokens, concurrent refresh) not covered"
      consumes: ["test_results"]
```

### debug → fix (handoff)
```yaml
chain_metadata:
  skill: "rune:debug"
  version: "1.0.0"
  status: "DONE"
  domain: "payments"
  files_changed: []
  exports:
    root_cause: { file: "src/payments/stripe.ts", line: 87, explanation: "Webhook signature verification skipped in dev mode leaks to prod" }
    severity: "critical"
    confidence: "high"
  suggested_next:
    - skill: "rune:fix"
      reason: "Critical bug identified with high confidence — fix immediately"
      consumes: ["root_cause"]
    - skill: "rune:sentinel"
      reason: "Security-related bug — check for similar patterns across codebase"
      consumes: ["root_cause"]
```

### review → fix (findings handoff)
```yaml
chain_metadata:
  skill: "rune:review"
  version: "0.7.0"
  status: "DONE"
  domain: "api"
  files_changed: []
  exports:
    findings_count: { critical: 0, high: 2, medium: 1, low: 0 }
    findings:
      - { severity: "high", file: "src/api/users.ts", line: 23, message: "Missing input validation on email field" }
      - { severity: "high", file: "src/api/users.ts", line: 45, message: "N+1 query in user list endpoint" }
    verdict: "REQUEST_CHANGES"
  suggested_next:
    - skill: "rune:fix"
      reason: "2 HIGH findings require remediation before merge"
      consumes: ["findings"]
    - skill: "rune:perf"
      reason: "N+1 query detected — performance analysis recommended"
      consumes: ["findings"]
```
