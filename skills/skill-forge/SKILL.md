---
name: skill-forge
description: Use when creating new Rune skills, editing existing skills, or verifying skill quality before deployment. Applies TDD discipline to skill authoring — test before write, verify before ship.
metadata:
  author: runedev
  version: "1.0.0"
  layer: L2
  model: opus
  group: creation
---

# skill-forge

## Purpose

The skill that builds skills. Applies Test-Driven Development to skill authoring: write a pressure test first, watch agents fail without the skill, write the skill to fix those failures, then close loopholes until bulletproof. Ensures every Rune skill is battle-tested before it enters the mesh.

## Triggers

- `/rune skill-forge` — manual invocation to create or edit a skill
- Auto-trigger: when user says "create a skill", "new skill", "add skill to rune"
- Auto-trigger: when editing any `skills/*/SKILL.md` file

## Calls (outbound)

- `scout` (L3): scan existing skills for patterns and naming conventions
- `plan` (L2): structure complex skills with multiple phases
- `hallucination-guard` (L3): verify referenced skills/tools actually exist
- `verification` (L3): validate SKILL.md format compliance
- `journal` (L3): record skill creation decisions in ADR

## Called By (inbound)

- `cook` (L1): when the feature being built IS a new skill
- `plan` (L2): when plan identifies need for a new reusable skill

## Workflow

### Phase 1 — DISCOVER

Before writing anything, understand the landscape:

1. **Scan existing skills** via `scout` — is this already covered?
2. **Check for overlap** — will this duplicate or conflict with existing skills?
3. **Identify layer** — L1 (orchestrator), L2 (workflow hub), L3 (utility)?
4. **Identify mesh connections** — what calls this? What does this call?

```
HARD-GATE: If a skill with >70% overlap already exists → extend it, don't create new.
The mesh grows stronger by deepening connections, not by adding nodes.
```

### Phase 2 — RED (Baseline Test)

**Write the test BEFORE writing the skill.**

Create a pressure scenario that exposes the problem the skill solves:

```markdown
## Pressure Scenario: [skill-name]

### Setup
[Describe the situation an agent faces]

### Pressures (combine 2-3)
- Time pressure: "This is urgent, just do it"
- Sunk cost: "I already wrote 200 lines, can't restart"
- Complexity: "Too many moving parts to follow process"
- Authority: "Senior dev says skip testing"
- Exhaustion: "We're 50 tool calls deep"

### Expected Failure (without skill)
[What the agent will probably do wrong]

### Success Criteria (with skill)
[What the agent should do instead]
```

Run the scenario with a subagent WITHOUT the skill. Document:
- **Exact behavior** — what did the agent do?
- **Rationalizations** — verbatim excuses for skipping discipline
- **Failure point** — where exactly did it go wrong?

```
HARD-GATE: You MUST observe at least one failure before writing the skill.
No failure observed = you don't understand the problem well enough to write the solution.
```

### Phase 3 — GREEN (Write Minimal Skill)

Write the SKILL.md addressing ONLY the failures observed in Phase 2.

Follow `docs/SKILL-TEMPLATE.md` format. Required sections:

| Section | Required | Purpose |
|---|---|---|
| Frontmatter | YES | Name, description, metadata |
| Purpose | YES | One paragraph, ecosystem role |
| Triggers | YES | When to invoke |
| Calls / Called By | YES | Mesh connections |
| Workflow | YES | Step-by-step execution |
| Output Format | YES | Structured, parseable output |
| Constraints | YES | 3-7 MUST/MUST NOT rules |
| Sharp Edges | YES | Known failure modes |
| Done When | YES | Verifiable completion criteria |
| Cost Profile | YES | Token estimate |
| Mesh Gates | L1/L2 only | Progression guards |

#### Frontmatter Rules

```yaml
---
name: kebab-case-max-64-chars    # letters, numbers, hyphens only
description: Use when [specific triggers]. [Symptoms that signal this skill applies].
metadata:
  layer: L1|L2|L3
  model: haiku|sonnet|opus       # haiku=scan, sonnet=code, opus=architecture
  group: [see template]
---
```

**Description rules:**
- MUST start with "Use when..."
- MUST describe triggering conditions, NOT workflow
- MUST be third person
- MUST NOT summarize what the skill does internally

```yaml
# BAD: Summarizes workflow — agent reads description, skips full content
description: TDD workflow that writes tests first, then code, then refactors

# GOOD: Only triggers — agent must read full content to know workflow
description: Use when implementing any feature or bugfix, before writing code
```

**Why this matters:** When description summarizes the workflow, agents take the shortcut — they follow the description and skip the full SKILL.md. Tested and confirmed.

#### Writing Constraints

Every constraint MUST block a specific failure mode observed in Phase 2:

```markdown
# BAD: Generic rule
1. MUST write good code

# GOOD: Blocks specific failure with consequence
1. MUST run tests after each fix — batch-and-pray causes cascading regressions
```

#### Anti-Rationalization Table

Capture every excuse from Phase 2 baseline testing:

```markdown
| Excuse | Reality |
|--------|---------|
| "[verbatim excuse from test]" | [why it's wrong + what to do instead] |
```

### Phase 4 — VERIFY (Green Check)

Run the SAME pressure scenario from Phase 2, now WITH the skill loaded.

Check:
- Does the agent follow the skill's workflow?
- Are all constraints respected under pressure?
- Does the output match the defined format?

```
HARD-GATE: If agent still fails with skill loaded → skill is insufficient.
Go back to Phase 3, strengthen the weak section. Do NOT ship.
```

### Phase 5 — REFACTOR (Close Loopholes)

Run additional pressure scenarios with varied pressures. For each new failure:

1. Identify the rationalization
2. Add it to the anti-rationalization table
3. Add explicit constraint or sharp edge
4. Re-run verification

Repeat until no new failures emerge in 2 consecutive test runs.

### Phase 6 — INTEGRATE

Wire the skill into the mesh:

1. **Update `docs/ARCHITECTURE.md`** — add to correct layer/group table
2. **Update `CLAUDE.md`** — increment skill count, add to layer list
3. **Add mesh connections** — update SKILL.md of skills that should call/be called by this one
4. **Verify no conflicts** — new skill's output format compatible with consumers?

### Phase 7 — SHIP

```bash
git add skills/[skill-name]/SKILL.md
git add docs/ARCHITECTURE.md CLAUDE.md
# Add any updated existing skills
git commit -m "feat: add [skill-name] — [one-line purpose]"
```

## Skill Quality Checklist

**Format:**
- [ ] Name is kebab-case, max 64 chars, letters/numbers/hyphens only
- [ ] Description starts with "Use when...", does NOT summarize workflow
- [ ] All template sections present
- [ ] Constraints are specific (not generic "write good code")
- [ ] Sharp edges have severity + mitigation

**Content:**
- [ ] Baseline test run BEFORE skill was written
- [ ] At least one observed failure documented
- [ ] Anti-rationalization table from real test failures
- [ ] Mesh connections bidirectional (calls AND called-by both updated)
- [ ] Output format is structured and parseable by other skills

**Architecture:**
- [ ] Layer assignment correct (L1=orchestrate, L2=workflow, L3=utility)
- [ ] Model assignment correct (haiku=scan, sonnet=code, opus=architect)
- [ ] No >70% overlap with existing skills
- [ ] ARCHITECTURE.md updated
- [ ] CLAUDE.md updated

## Adapting Existing Skills

When editing, not creating:

```
HARD-GATE: Same TDD cycle applies to edits.
1. Write a test that exposes the gap in the current skill
2. Run baseline — confirm the skill fails on this scenario
3. Edit the skill to address the gap
4. Verify the edit fixes the gap WITHOUT breaking existing behavior
```

"Just adding a section" is not an excuse to skip testing.

## Token Efficiency Guidelines

Skills are loaded into context when invoked. Every word costs tokens.

| Skill Type | Target | Notes |
|---|---|---|
| L3 utility (haiku) | <300 words | Runs frequently, keep lean |
| L2 workflow hub | <500 words | Moderate frequency |
| L1 orchestrator | <800 words | Runs once per workflow |
| Reference sections | Extract to separate file | >100 lines → own file |

Techniques:
- Reference `--help` instead of documenting all flags
- Cross-reference other skills instead of repeating content
- One excellent example > three mediocre ones
- Inline code only if <50 lines, otherwise separate file

## Constraints

1. MUST run baseline test BEFORE writing skill — no skill without observed failure
2. MUST verify skill fixes the observed failures — green check required before ship
3. MUST NOT create skill with >70% overlap with existing — extend instead
4. MUST follow SKILL-TEMPLATE.md format — all required sections present
5. MUST update ARCHITECTURE.md and CLAUDE.md on every new skill
6. MUST NOT ship skill that fails its own pressure test
7. MUST write description as triggers only — never summarize workflow in description

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Writing skill without baseline test | CRITICAL | Phase 2 HARD-GATE: must observe failure first |
| Description summarizes workflow → agents skip content | HIGH | Phase 3 description rules: "Use when..." triggers only |
| New skill duplicates existing skill | HIGH | Phase 1 HARD-GATE: >70% overlap → extend, don't create |
| Skill passes test but breaks mesh connections | MEDIUM | Phase 6 integration: verify output compatibility |
| Editing skill without testing the edit | MEDIUM | Adapting section: same TDD cycle for edits |
| Overly verbose skill burns context tokens | MEDIUM | Token efficiency guidelines: layer-based word targets |

## Done When

- Baseline test documented with observed failures
- SKILL.md follows template format completely
- Skill passes pressure test (agent complies with skill loaded)
- No new failures in 2 consecutive varied-pressure test runs
- Mesh connections wired (ARCHITECTURE.md, CLAUDE.md, related skills)
- Git committed with conventional commit message

## Cost Profile

~3000-8000 tokens per skill creation (opus for Phase 2-5 reasoning, haiku for scout/verification). Most cost is in the iterative test-refine loop (Phase 4-5). Budget 2-4 test iterations per skill.
