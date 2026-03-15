# Phase 1: skill-router Enforcement Upgrade

## Goal
Add 3 new enforcement sections to skill-router: Request Classifier (Step 0.25), File Ownership Matrix (Step 1.5), and Self-Verification Trigger (bottom). These close 70% of the enforcement gap vs Antigravity.

## Tasks
- [ ] Add Request Classifier (Step 0.25) — 5-type fast-path filter before intent classification
- [ ] Add File Ownership Matrix (Step 1.5) — constraint inheritance for file types
- [ ] Add Self-Verification Trigger — 3-point mandatory check at bottom of SKILL.md
- [ ] Add Routing Proof requirement to Output Format section
- [ ] Bump version 1.1.0 → 1.2.0

## Code Contracts

### Request Classifier (Step 0.25)
```
Types: CODE_CHANGE | QUESTION | DEBUG_REQUEST | REVIEW_REQUEST | EXPLORE
Rules:
- CODE_CHANGE → FULL enforcement (cook mandatory)
- QUESTION → LITE (check if skill has domain knowledge)
- DEBUG_REQUEST → FULL (debug skill mandatory)
- REVIEW_REQUEST → FULL (review skill mandatory)
- EXPLORE → LITE (scout if codebase, skip if general)
- Escape hatch: TRIVIAL (< 5 LOC, clear intent) → fast mode in cook
```

### File Ownership Matrix (Step 1.5)
```
| File Pattern                | Owner Skill       | Constraint |
|-----------------------------|-------------------|------------|
| *.test.*, *.spec.*, __tests__/ | rune:test      | test patterns apply |
| migrations/, schema.*       | rune:db           | migration safety rules |
| Dockerfile, *.yml (CI/CD)   | rune:deploy       | deployment checklist |
| *.md (docs/)                | rune:docs         | docs patterns apply |
| SKILL.md, PACK.md           | rune:skill-forge  | skill template rules |
| .env*, secrets              | rune:sentinel     | security scan mandatory |

Ownership = constraints apply, NOT exclusive access.
cook can modify test files during Phase 4 if it applies test constraints.
```

### Self-Verification Trigger
```
3-point check before EVERY response:
1. Did I classify this request? (Step 0.25)
2. Did I route through a skill? (Step 1-2)
3. Am I about to write code without skill invocation? → STOP

Block on: CODE_CHANGE or DEBUG_REQUEST without routing.
Pass on: QUESTION, EXPLORE, routing exceptions.
```

### Routing Proof
```
Every code response MUST begin with:
> Routed: rune:<skill> | Type: <classifier> | Confidence: HIGH|MEDIUM|LOW

User-visible accountability. Missing = routing violation.
```

## Acceptance Criteria
- [ ] skill-router SKILL.md has Step 0.25 (Request Classifier)
- [ ] skill-router SKILL.md has Step 1.5 (File Ownership Matrix)
- [ ] skill-router SKILL.md has Self-Verification section at bottom
- [ ] Output Format section includes routing proof line
- [ ] Version bumped to 1.2.0
- [ ] No breaking changes to existing Steps 0, 1, 2, 3, 4, 5

## Files Touched
- `skills/skill-router/SKILL.md` — modify (add 3 sections + routing proof)

## Dependencies
- None — this is the first phase
