# Phase 2: brainstorm + cook Hardening

## Goal
Strengthen brainstorm with dynamic questioning format + problem restatement. Harden cook with clarification gate + phase transition protocol. These prevent "jump to code" and "skip phases" patterns.

## Tasks
- [ ] Add Problem Restatement to brainstorm (Step 1.5) — confirm understanding before generating approaches
- [ ] Add Dynamic Question Format to brainstorm (Step 2 enhancement) — structured format with Priority, Decision Point, Why, Options, Default
- [ ] Add Clarification Gate to cook (Phase 1 Step 3.5) — 2-question minimum before planning
- [ ] Add Phase Transition Protocol to cook — assertion checks between phases
- [ ] Bump brainstorm 0.3.0 → 0.4.0, cook 0.5.0 → 0.6.0

## Code Contracts

### Problem Restatement (brainstorm Step 1.5)
```
After Step 1 (Frame the Problem), restate back to user:
"Let me confirm: you want to [X] because [Y],
and the main constraint is [Z]. Correct?"

DO NOT generate approaches until user confirms.
Exception: Rescue Mode (problem defined by failure evidence).
```

### Dynamic Question Format (brainstorm Step 2 enhancement)
```
When asking clarifying questions, use this format:

### [P0|P1|P2] **[DECISION POINT]**

**Question:** [Clear question]
**Why This Matters:** [Architectural consequence — what changes based on the answer]
**Options:**
| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| A      | [+]  | [-]  | [scenario] |
| B      | [+]  | [-]  | [scenario] |
**If Not Specified:** [Default + rationale]
```

### Clarification Gate (cook Phase 1 Step 3.5)
```
BEFORE Phase 2 (PLAN), ask at minimum:
1. "What does success look like?" (acceptance criteria)
2. "What should NOT change?" (blast radius constraint)

Skip conditions (ALL must be true):
- Bug fix with clear reproduction steps provided
- User explicitly said "just do it" / "no questions"
- Fast mode active AND < 10 LOC
- hotfix chain active

This is NOT the full BA elicitation. It's a lightweight 2-question gate.
```

### Phase Transition Protocol (cook)
```
Before entering Phase N+1, assert:
- Phase N status == completed (in TodoWrite)
- Phase N gate condition met (see Mesh Gates table)
- No BLOCK status from any sub-skill

If assertion fails → STOP, log:
"BLOCKED at Phase N→N+1: [reason]"
```

## Acceptance Criteria
- [ ] brainstorm has Step 1.5 (Problem Restatement)
- [ ] brainstorm Step 2 has dynamic question format template
- [ ] cook has Phase 1 Step 3.5 (Clarification Gate)
- [ ] cook has Phase Transition Protocol section
- [ ] Versions bumped
- [ ] No breaking changes to existing workflows

## Files Touched
- `skills/brainstorm/SKILL.md` — modify
- `skills/cook/SKILL.md` — modify

## Dependencies
- Phase 1 complete (skill-router references classifier types)

## Cross-Phase Context
- Phase 1 introduces Request Classifier types (CODE_CHANGE, etc.) — cook's Clarification Gate references these
- Phase 1 introduces File Ownership — cook Phase 4 respects ownership constraints
