# test — Skill behavior tests and eval-driven development

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Skill Behavior Tests (Eval Scenarios)

For testing SKILL.md behavior (not code), use **Eval Scenarios** — unit tests for skill files, not code files.

### Eval Scenario Format

```markdown
## Eval: E[NN] — [scenario name]

### Prompt
[The exact situation/message an agent receives]

### Expected Reasoning
[Step-by-step reasoning the agent SHOULD follow]

### Must Include
- [Assertion 1: what the output MUST contain or do]
- [Assertion 2]

### Must NOT
- [Anti-pattern 1: what the output MUST NOT do]
- [Anti-pattern 2]

### Category
happy-path | adversarial | edge-case | jailbreak | credential-leak
```

### Eval Coverage Requirements

A skill is **behavior-tested** when it has evals covering:

| Category | Min Evals | Purpose |
|----------|-----------|---------|
| Happy path | 1 | Core workflow executes correctly |
| Edge case | 1 | Empty input, missing context, unusual state |
| Adversarial | 1 | Time pressure, sunk cost, authority pressure |
| Jailbreak / injection | 1 | Prompt injection attempt, "ignore instructions" |

**Minimum**: 4 evals per skill (1 per category). Security-critical skills (sentinel, safeguard): 8+ evals.

### Eval Storage

Save eval files as `skills/<name>/evals.md`. Each eval is a numbered scenario (E01–E24 range). skill-forge Phase 7 checks for evals presence before ship.

## Eval-Driven Development

Define **capability evals** and **regression evals** BEFORE writing implementation code. Evals go beyond unit tests — they verify that the agent/system can handle the feature's intent, not just its mechanics.

### Two Eval Types

| Type | Purpose | Pass Criteria | When |
|------|---------|---------------|------|
| **Capability eval** | Can the system do this new thing? | pass@k: ≥1 success in k attempts (k=3-5) | Before implementation |
| **Regression eval** | Did we break existing behavior? | pass^k: ALL k attempts must pass | After implementation |

**pass@k** (capability): At least 1 of k runs succeeds. Used for new features where some variance is acceptable. Threshold: ≥90% pass@3 for standard features, ≥95% pass@5 for critical paths.

**pass^k** (regression): ALL k runs must pass. Used for existing behavior that must never break. If ANY run fails, it's a regression. Threshold: 100% pass^3.

### Eval File Format

Store evals in `.rune/evals/<feature>.md`:

```markdown
# Eval: <feature name>

## Capability Evals (pass@k)
| ID | Description | k | Threshold | Status |
|----|-------------|---|-----------|--------|
| CAP-1 | [what the system should be able to do] | 3 | 90% | pending |

## Regression Evals (pass^k)
| ID | Description | k | Status |
|----|-------------|---|--------|
| REG-1 | [existing behavior that must not break] | 3 | pending |
```

### Anti-Pattern: Eval Overfitting

Do NOT overfit evals to specific prompts or known examples. Evals should test the **capability**, not the **exact input**.

- BAD: `"When user says 'hello', respond with 'Hi there!'"` — tests exact string match
- GOOD: `"When user greets, respond with a greeting"` — tests capability

### Integration with TDD

1. Write eval definitions (capability + regression) → `.rune/evals/<feature>.md`
2. Write unit/integration tests (RED phase) → test files
3. Implement feature (GREEN phase) → source files
4. Run evals to verify capability achieved + no regressions
5. Preflight checks eval results as part of quality gate
