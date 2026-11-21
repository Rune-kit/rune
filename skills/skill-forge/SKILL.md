---
name: skill-forge
description: "Use when creating new Rune skills, editing existing skills, or verifying skill quality before deployment. Applies TDD discipline to skill authoring — test before write, verify before ship."
metadata:
  author: runedev
  version: "1.9.0"
  layer: L2
  model: opus
  group: creation
  tools: "Read, Write, Edit, Bash, Glob, Grep"
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
- `scaffold` (L1): when scaffolded project includes custom skills

## References

- `references/claude-skill-reference.md` — Claude Code skill system: frontmatter fields, variables, shell injection, invocation control matrix, skill type patterns (task/research/knowledge/dynamic), file structure, and quality checklist. Load when creating or editing any skill.

## Workflow

### Phase 1 — DISCOVER

Before writing anything, understand the landscape:

1. **Scan existing skills** via `scout` — is this already covered?
2. **Check for overlap** — will this duplicate or conflict with existing skills?
3. **Identify layer** — L1 (orchestrator), L2 (workflow hub), L3 (utility)?
4. **Identify mesh connections** — what calls this? What does this call?

<HARD-GATE>
If a skill with >70% overlap already exists → extend it, don't create new.
The mesh grows stronger by deepening connections, not by adding nodes.
</HARD-GATE>

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

<HARD-GATE>
You MUST observe at least one failure before writing the skill.
No failure observed = you don't understand the problem well enough to write the solution.
</HARD-GATE>

### Phase 3 — GREEN (Write Minimal Skill)

Write the SKILL.md addressing ONLY the failures observed in Phase 2.

Follow `docs/SKILL-TEMPLATE.md` format. Required sections:

| Section | Required | Purpose |
|---|---|---|
| Frontmatter | YES | Name, description, metadata |
| Purpose | YES | One paragraph, ecosystem role |
| Triggers | YES | When to invoke |
| Calls / Called By | YES | Mesh connections (control flow) |
| Data Flow | YES | Feeds Into / Fed By / Feedback Loops (data flow) |
| Workflow | YES | Step-by-step execution |
| Output Format | YES | Structured, parseable output |
| Constraints | YES | 3-7 MUST/MUST NOT rules |
| Sharp Edges | YES | Known failure modes |
| Self-Validation | YES | Domain-specific QA checklist (per-skill, not centralized) |
| Done When | YES | Verifiable completion criteria |
| Cost Profile | YES | Token estimate |
| Mesh Gates | L1/L2 only | Progression guards |

#### SKILL.md Anatomy — WHY vs HOW Split

> Full detail moved to [`references/skill-anatomy.md`](references/skill-anatomy.md) (progressive disclosure). **Read that file before executing this section.**

<HARD-GATE>
Code blocks in SKILL.md > 10 lines = review failure.
Extract to references/ or scripts/. No exceptions.
</HARD-GATE>

#### Frontmatter Rules

> Full detail moved to [`references/skill-anatomy.md`](references/skill-anatomy.md) (progressive disclosure). **Read that file before executing this section.**

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

<HARD-GATE>
If agent still fails with skill loaded → skill is insufficient.
Go back to Phase 3, strengthen the weak section. Do NOT ship.
</HARD-GATE>

### Phase 5 — REFACTOR (Close Loopholes)

Run additional pressure scenarios with varied pressures. For each new failure:

1. Identify the rationalization
2. Add it to the anti-rationalization table
3. Add explicit constraint or sharp edge
4. Re-run verification

Repeat until no new failures emerge in 2 consecutive test runs.

#### Pressure Types for Test Scenarios

> Full detail moved to [`references/refactor-techniques.md`](references/refactor-techniques.md) (progressive disclosure). **Read that file before executing this section.**

#### Scenario Quality Requirements

> Full detail moved to [`references/refactor-techniques.md`](references/refactor-techniques.md) (progressive disclosure). **Read that file before executing this section.**

#### Meta-Testing (When GREEN Isn't Working)

> Full detail moved to [`references/refactor-techniques.md`](references/refactor-techniques.md) (progressive disclosure). **Read that file before executing this section.**

#### Bulletproof Criteria

> Full detail moved to [`references/refactor-techniques.md`](references/refactor-techniques.md) (progressive disclosure). **Read that file before executing this section.**

#### Persuasion Principles for Skill Language

> Full detail moved to [`references/refactor-techniques.md`](references/refactor-techniques.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 5.25 — SCRIPT CONTRACT (skills with helper scripts only)

If the skill bundles executable scripts in its `scripts/` directory, those scripts MUST follow the Rune script output contract. This is a testable contract — orchestrators (cook, team, marketing) rely on it for piping and retry logic.

#### The Three-Mode Contract

> Full detail moved to [`references/script-contract.md`](references/script-contract.md) (progressive disclosure). **Read that file before executing this section.**

#### Required Flags

> Full detail moved to [`references/script-contract.md`](references/script-contract.md) (progressive disclosure). **Read that file before executing this section.**

#### Semantic Exit Codes

> Full detail moved to [`references/script-contract.md`](references/script-contract.md) (progressive disclosure). **Read that file before executing this section.**

#### Default Artifact Directory Resolution

> Full detail moved to [`references/script-contract.md`](references/script-contract.md) (progressive disclosure). **Read that file before executing this section.**

#### Sensitive-Data Redaction

> Full detail moved to [`references/script-contract.md`](references/script-contract.md) (progressive disclosure). **Read that file before executing this section.**

#### Contract Test

> Full detail moved to [`references/script-contract.md`](references/script-contract.md) (progressive disclosure). **Read that file before executing this section.**

<HARD-GATE>
Scripts that don't honor the contract cannot be shipped.
Specifically:
- Mixing paths and progress on stdout = BLOCK
- Silent failure (no install guidance on miss) = BLOCK
- Logging credentials in trace = CRITICAL-BLOCK
- Binary exit code (0/1 only) when timeout semantics apply = BLOCK
</HARD-GATE>

### Phase 5.5 — SECURITY MODEL

Every skill that touches external systems, user data, or destructive operations MUST define an explicit Security Model section. This is a contract — not aspirational, but testable.

**Add to SKILL.md after Sharp Edges:**

```markdown
## Security Model

### Trust Boundaries
- [What this skill reads] — e.g., "Reads .env files, user source code, git history"
- [What this skill writes] — e.g., "Writes to .rune/ only, never modifies source code"
- [What this skill executes] — e.g., "Runs npm test, never runs arbitrary shell commands"

### This Skill Will NEVER
- [Explicit denial 1] — e.g., "Execute user-provided strings as shell commands"
- [Explicit denial 2] — e.g., "Read or log credential files (.env, secrets.json)"
- [Explicit denial 3] — e.g., "Send data to external endpoints"

### Threat Surface
| Threat | Mitigated By |
|--------|-------------|
| Prompt injection via user input | Input validated before processing |
| Credential exposure in output | Secrets pattern detection before emit |
| Destructive operation on wrong target | Confirmation gate before delete/overwrite |
```

**When to require Security Model:**
- Skill uses `Bash` tool → REQUIRED (can execute arbitrary commands)
- Skill reads `.env` or credentials → REQUIRED
- Skill writes/deletes files outside `.rune/` → REQUIRED
- Skill calls external APIs or MCP tools → REQUIRED
- Skill is read-only analysis (review, audit, scout) → OPTIONAL but recommended

**Eval integration**: Phase 7 evals for skills with Security Model MUST include:
- E05: Attempt to make skill execute unintended command
- E06: Attempt to make skill expose credentials in output
- E07: Attempt to make skill write outside its declared boundary

If Security Model is required but missing → Phase 7 EVAL HARD-GATE blocks ship.

### Phase 6 — INTEGRATE

Wire the skill into the mesh:

1. **Update `docs/ARCHITECTURE.md`** — add to correct layer/group table
2. **Update `CLAUDE.md`** — increment skill count, add to layer list
3. **Add mesh connections** — update SKILL.md of skills that should call/be called by this one
4. **Map data flow** — identify which skills consume this skill's output (Feeds Into) and which skills' outputs this skill needs (Fed By). Look for feedback loops where two skills refine each other's work
5. **Write Self-Validation** — 3-5 domain-specific checks unique to this skill's output. Ask: "What quality issues can ONLY this skill catch?"
6. **Verify no conflicts** — new skill's output format compatible with consumers?

### Phase 6.25 — EXAMPLES (output-format skills only)

> Full detail moved to [`references/examples-phase.md`](references/examples-phase.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 6.5 — EXTENSION AUTHORING (if building an extension, not a skill)

Extensions augment existing skills with optional capabilities. Unlike skills (standalone workflow units) or packs (domain bundles), extensions ADD features to skills that already exist — without modifying the core skill file.

#### Extension vs Skill vs Pack

> Full detail moved to [`references/extension-authoring.md`](references/extension-authoring.md) (progressive disclosure). **Read that file before executing this section.**

#### Extension Directory Structure

> Full detail moved to [`references/extension-authoring.md`](references/extension-authoring.md) (progressive disclosure). **Read that file before executing this section.**

#### EXTENSION.md Manifest

> Full detail moved to [`references/extension-authoring.md`](references/extension-authoring.md) (progressive disclosure). **Read that file before executing this section.**

#### Extension Rules

> Full detail moved to [`references/extension-authoring.md`](references/extension-authoring.md) (progressive disclosure). **Read that file before executing this section.**

#### When to Build an Extension (vs a Skill or Pack)

> Full detail moved to [`references/extension-authoring.md`](references/extension-authoring.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 7 — EVAL (Behavior Tests)

Before shipping, write **Eval Scenarios** — behavior tests for the SKILL.md itself. These are "unit tests for skill files, not code."

Save evals to `skills/<name>/evals.md`. Minimum 4 evals per skill:

| Eval ID | Category | Required? |
|---------|----------|-----------|
| E01 | Happy path — core workflow | YES |
| E02 | Edge case — unusual/empty input | YES |
| E03 | Adversarial — pressure scenario | YES |
| E04 | Jailbreak/injection attempt | YES for security-critical skills |

Each eval follows the format defined in `rune:test` → "Skill Behavior Tests" section:
- **Prompt**: exact situation the agent faces
- **Expected Reasoning**: step-by-step reasoning agent SHOULD follow
- **Must Include**: what the output MUST contain or do
- **Must NOT**: anti-patterns the output MUST NOT produce

Run each eval with a subagent. An eval FAILS if the agent produces a Must NOT output.

**Pre-ship gate**: At least E01–E03 must PASS before committing. Security-critical skills (touching auth/secrets/destructive ops) require 8+ evals including jailbreak and credential-leak scenarios.

Also run the **Skill Content Security Guard** (sentinel Step 3.5) on the new SKILL.md content before commit — blocks destructive ops, prompt injection, and jailbreak patterns embedded in skill instructions.

<HARD-GATE>
No evals.md → skill is behavior-untested. Do NOT ship untested skills.
Eval file with 0 passing evals = same as no evals.
</HARD-GATE>

### Phase 8 — SHIP

```bash
git add skills/[skill-name]/SKILL.md
git add skills/[skill-name]/evals.md
git add docs/ARCHITECTURE.md CLAUDE.md
# Add any updated existing skills
git commit -m "feat: add [skill-name] — [one-line purpose]"
```

## Skill Quality Checklist

> Full detail moved to [`references/quality-checklist.md`](references/quality-checklist.md) (progressive disclosure). **Read that file before executing this section.**

## Adapting Existing Skills

> Full detail moved to [`references/quality-checklist.md`](references/quality-checklist.md) (progressive disclosure). **Read that file before executing this section.**

<HARD-GATE>
Same TDD cycle applies to edits.
1. Write a test that exposes the gap in the current skill
2. Run baseline — confirm the skill fails on this scenario
3. Edit the skill to address the gap
4. Verify the edit fixes the gap WITHOUT breaking existing behavior
</HARD-GATE>

## Token Efficiency Guidelines

> Full detail moved to [`references/quality-checklist.md`](references/quality-checklist.md) (progressive disclosure). **Read that file before executing this section.**

## Output Format

```
## Skill Forge Report
- **Skill**: [name] (L[layer])
- **Action**: CREATE | EDIT
- **Status**: SHIPPED | NEEDS_WORK | BLOCKED

### Baseline Test
- Scenario: [test scenario description]
- Result WITHOUT skill: [observed failure]
- Result WITH skill: [observed success or remaining gap]

### Quality Checklist
- Format: [pass/fail count]
- Content: [pass/fail count]
- Architecture: [pass/fail count]

### Files Created/Modified
- skills/[name]/SKILL.md — [created | modified]
- docs/ARCHITECTURE.md — [updated | skipped]
- CLAUDE.md — [updated | skipped]

### Mesh Impact
- New connections: [count] ([list of skills])
- Bidirectional check: PASS | FAIL
- Data flow mapped: [count] feeds-into, [count] fed-by, [count] feedback loops
- Self-Validation: [count] domain-specific checks written
```

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
| Code blocks in SKILL.md bloat every invocation | HIGH | WHY vs HOW split: SKILL.md ≤10-line code blocks, extract rest to references/ |
| Writing skill without TDD (no observed failures first) | CRITICAL | Skill TDD: RED (run scenario WITHOUT skill → document failures) → GREEN (write skill targeting failures) → REFACTOR (find bypasses → add blocks) |
| Description leaks workflow → agent skips full content | HIGH | CSO Discipline: description = triggers only. Test: can you execute from description alone? If yes, it leaks too much |
| Self-Validation copies completion-gate checks | HIGH | Self-Validation is DOMAIN-specific: "assertions per test", "dependency ordering". NOT generic: "tests pass", "build succeeds" — those belong to completion-gate |
| Data Flow confused with Calls | MEDIUM | Calls = runtime invocation (skill A calls skill B). Feeds Into = artifact persistence (skill A writes .rune/X.md, skill B reads it later). If it's a direct function call → Calls. If it's via files/context → Data Flow |
| Feedback Loop missing one direction | MEDIUM | Every Feedback Loop ↻ must document BOTH directions: what A sends to B AND what B sends back to A. One-way = Feeds Into, not a loop |

## Done When

- Baseline test documented with observed failures (TDD RED phase)
- SKILL.md follows template format completely
- Skill passes pressure test (agent complies with skill loaded)
- No new failures in 2 consecutive varied-pressure test runs
- Mesh connections wired (ARCHITECTURE.md, CLAUDE.md, related skills)
- Git committed with conventional commit message

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| New or updated skill file | Markdown (SKILL.md) | `skills/<name>/SKILL.md` |
| Eval scenarios | Markdown | `skills/<name>/evals.md` |
| Reference files (if needed) | Markdown | `skills/<name>/references/` |
| Architecture docs update | Markdown | `docs/ARCHITECTURE.md` |
| Skill Forge Report | Markdown | inline |

## Cost Profile

~3000-8000 tokens per skill creation (opus for Phase 2-5 reasoning, haiku for scout/verification). Most cost is in the iterative test-refine loop (Phase 4-5). Budget 2-4 test iterations per skill.

**Scope guardrail:** skill-forge authors and tests skill files — it does not implement the features those skills describe.
