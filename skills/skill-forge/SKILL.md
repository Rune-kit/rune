---
name: skill-forge
description: Use when creating new Rune skills, editing existing skills, or verifying skill quality before deployment. Applies TDD discipline to skill authoring — test before write, verify before ship.
metadata:
  author: runedev
  version: "1.5.0"
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

A skill file answers WHY and WHEN — not HOW. Code examples, syntax references, and implementation patterns belong in separate files:

```
skills/[name]/
├── SKILL.md          ← WHY: purpose, triggers, constraints, sharp edges (~150-300 lines)
├── references/       ← HOW: code patterns, syntax tables, API examples
│   ├── patterns.md   ← Implementation patterns with code blocks
│   └── gotchas.md    ← Language/framework-specific pitfalls
└── scripts/          ← WHAT: deterministic operations (shell, node)
```

**Rules:**
1. SKILL.md MUST NOT contain code blocks longer than 10 lines — move to `references/`
2. One excellent inline example (≤10 lines) is OK for clarity — more than that is a smell
3. Format templates (Output Format section) are NOT code — they stay in SKILL.md
4. Pressure test scenarios (Phase 2) are NOT code — they stay in SKILL.md
5. If a skill has >3 code blocks → create `references/` and extract them

**Why this matters:** Code blocks in SKILL.md inflate context tokens on EVERY invocation. References are loaded only when needed. A 500-line SKILL.md with 200 lines of code examples should be a 300-line SKILL.md + a 200-line references file.

<HARD-GATE>
Code blocks in SKILL.md > 10 lines = review failure.
Extract to references/ or scripts/. No exceptions.
</HARD-GATE>

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

**Description rules (CSO Discipline):**
- MUST start with "Use when..."
- MUST describe triggering conditions, NOT workflow
- MUST be third person
- MUST NOT summarize what the skill does internally
- AI reads description → decides whether to invoke → if description contains workflow summary, AI skips reading the full SKILL.md content (it thinks it already knows)
- Test: if you can execute the skill from the description alone, the description leaks too much

Bad: "Analyzes code quality through 6-step process: scan files, check patterns, run linters, compare metrics, generate report, suggest fixes"
Good: "Use when code changes need quality review before commit. Symptoms: PR ready, refactor complete, pre-release check."

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

Best tests combine 3+ pressures simultaneously:

| Pressure | Example Scenario |
|----------|------------------|
| Time | "Emergency deployment, deadline in 30 min" |
| Sunk cost | "Already wrote 200 lines, can't restart" |
| Authority | "Senior dev says skip testing" |
| Economic | "Customer churning, ship now or lose $50k MRR" |
| Exhaustion | "50 tool calls deep, context filling up" |
| Social | "Looking dogmatic by insisting on process" |
| Pragmatic | "Being practical vs being pedantic" |

#### Scenario Quality Requirements

1. **Concrete A/B/C options** — force explicit choice (no "I'd ask the user" escape hatch)
2. **Real constraints** — specific times, actual consequences, named files
3. **Real file paths** — `/tmp/payment-system` not "a project"
4. **"Make agent ACT"** — "What do you do?" not "What should you do?"
5. **No easy outs** — every option has a cost

#### Meta-Testing (When GREEN Isn't Working)

If the agent keeps failing even WITH the skill loaded, ask: "How could that skill have been written differently to make the correct option crystal clear?"

Three possible responses:
1. "Skill was clear, I chose to ignore it" → foundational principle needed (stronger HARD-GATE)
2. "Skill should have said X explicitly" → add that exact phrasing verbatim
3. "I didn't see section Y" → reorganize for discoverability (move up, add header)

#### Bulletproof Criteria

A skill is bulletproof when:
- Agent chooses correct option under maximum pressure (3+ pressures combined)
- Agent CITES skill sections as justification for its choice
- Agent ACKNOWLEDGES the temptation but follows the rule anyway

#### Persuasion Principles for Skill Language

Research (Meincke et al., 2025, 28,000 conversations) shows 33% → 72% compliance with these techniques:

| Principle | Application | Use For |
|-----------|-------------|---------|
| Authority | "YOU MUST", imperative language | Eliminates decision fatigue, safety-critical rules |
| Commitment | Explicit announcements + tracked choices | Creates accountability trail |
| Scarcity | Time-bound requirements, "before proceeding" | Triggers immediate action |
| Social Proof | "Every time", universal statements | Documents what prevents failures |
| Unity | "We're building quality" language | Shared identity, quality goals |

**Prohibited in skills:**
- **Liking** ("Great job following the process!") → creates sycophancy
- **Reciprocity** ("I helped you, now follow the rules") → feels manipulative

**Ethical test**: Would this serve the user's genuine interests if they fully understood the technique?

### Phase 6 — INTEGRATE

Wire the skill into the mesh:

1. **Update `docs/ARCHITECTURE.md`** — add to correct layer/group table
2. **Update `CLAUDE.md`** — increment skill count, add to layer list
3. **Add mesh connections** — update SKILL.md of skills that should call/be called by this one
4. **Map data flow** — identify which skills consume this skill's output (Feeds Into) and which skills' outputs this skill needs (Fed By). Look for feedback loops where two skills refine each other's work
5. **Write Self-Validation** — 3-5 domain-specific checks unique to this skill's output. Ask: "What quality issues can ONLY this skill catch?"
6. **Verify no conflicts** — new skill's output format compatible with consumers?

### Phase 6.5 — EXTENSION AUTHORING (if building an extension, not a skill)

Extensions augment existing skills with optional capabilities. Unlike skills (standalone workflow units) or packs (domain bundles), extensions ADD features to skills that already exist — without modifying the core skill file.

#### Extension vs Skill vs Pack

| Concept | Purpose | Modifies Core? | Self-contained? |
|---------|---------|----------------|-----------------|
| **Skill** | Standalone workflow unit (SKILL.md) | N/A — IS core | Yes |
| **Pack** | Domain bundle of skills (PACK.md) | No — bundles existing | Yes |
| **Extension** | Augments existing skill with new capability | No — additive only | Yes — own dir with install/uninstall |

#### Extension Directory Structure

```
extensions/<extension-name>/
├── EXTENSION.md           # Manifest: what it extends, how, dependencies
├── install.sh             # Unix installer (non-destructive MCP merge)
├── install.ps1            # Windows installer
├── uninstall.sh           # Clean removal
├── uninstall.ps1          # Clean removal (Windows)
├── skills/
│   └── <skill-name>/
│       └── SKILL.md       # New skill added by extension
├── agents/                # Optional subagent definitions
│   └── <agent-name>.md
├── references/            # Domain knowledge loaded by extension skills
│   └── <topic>.md
├── scripts/               # Executable utilities
│   └── <script>.py|.sh
└── docs/
    └── SETUP.md           # Extension-specific configuration guide
```

#### EXTENSION.md Manifest

```yaml
---
name: "<extension-name>"
extends: "<target-skill-or-pack>"
description: "What capability this extension adds"
requires:
  - mcp: "<mcp-server-name>"        # Optional: MCP server dependency
  - skill: "<required-skill-name>"   # Required core skill
install_method: "non-destructive"    # MUST be non-destructive
---
```

#### Extension Rules

1. **Non-destructive install** — extension MUST NOT modify existing skill files. It adds new files alongside.
2. **Self-contained** — removing the extension directory restores the system to its pre-install state.
3. **MCP merge** — if the extension adds MCP tools, install script MUST merge into settings.json without overwriting existing entries.
4. **Fallback graceful** — if the MCP server or external dependency is unavailable, the extension skill MUST degrade gracefully (report unavailability, don't crash).
5. **Cost awareness** — if the extension calls paid APIs, the extension skill MUST warn before expensive operations and track usage.
6. **Pre-flight check** — extension skill Step 1 MUST verify dependencies are available before executing.

#### When to Build an Extension (vs a Skill or Pack)

- Build an **extension** when: the capability requires an external API/MCP, is optional, and augments an existing skill
- Build a **skill** when: the capability is self-contained and fits a layer in the mesh
- Build a **pack** when: you're bundling multiple related skills for a domain

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
- [ ] Data flow mapped (Feeds Into / Fed By / Feedback Loops)
- [ ] Self-Validation has 3-5 domain-specific checks (not generic)
- [ ] Output format is structured and parseable by other skills
- [ ] `evals.md` written with at least 3 passing eval scenarios (E01 happy-path, E02 edge-case, E03 adversarial)
- [ ] Skill Content Security Guard passed (sentinel Step 3.5 — no destructive ops or injection patterns in SKILL.md)

**Architecture:**
- [ ] Layer assignment correct (L1=orchestrate, L2=workflow, L3=utility)
- [ ] Model assignment correct (haiku=scan, sonnet=code, opus=architect)
- [ ] No >70% overlap with existing skills
- [ ] ARCHITECTURE.md updated
- [ ] CLAUDE.md updated

**Extension-specific (if building an extension):**
- [ ] EXTENSION.md manifest present with extends, requires, install_method
- [ ] install.sh + install.ps1 tested (non-destructive merge)
- [ ] uninstall.sh + uninstall.ps1 tested (clean removal)
- [ ] Extension skill has dependency pre-flight check (Step 1)
- [ ] Fallback behavior documented when external dependency unavailable
- [ ] Cost warning present if extension calls paid APIs

## Adapting Existing Skills

When editing, not creating:

<HARD-GATE>
Same TDD cycle applies to edits.
1. Write a test that exposes the gap in the current skill
2. Run baseline — confirm the skill fails on this scenario
3. Edit the skill to address the gap
4. Verify the edit fixes the gap WITHOUT breaking existing behavior
</HARD-GATE>

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
