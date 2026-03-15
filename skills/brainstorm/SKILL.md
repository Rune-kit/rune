---
name: brainstorm
description: Creative ideation and solution exploration. Generates multiple approaches with trade-offs, uses structured frameworks (SCAMPER, First Principles), and hands off to plan for structuring.
metadata:
  author: runedev
  version: "0.4.0"
  layer: L2
  model: opus
  group: creation
  tools: "Read, Glob, Grep"
---

# brainstorm

## Purpose

Creative ideation and solution exploration. Brainstorm is the creative engine of the Creation group — it generates multiple approaches with trade-offs, explores alternatives using structured frameworks, and hands the selected approach to plan for structuring. Uses opus for deep creative reasoning.

<HARD-GATE>
Do NOT invoke any implementation skill or write any code until the user has approved the design.
This applies to EVERY task regardless of perceived simplicity.
"This is too simple to need a design" is a rationalization. Simple tasks get simple designs (a few sentences), but they still get designs.
</HARD-GATE>

## Modes

### Discovery Mode (default)
Normal brainstorming at the start of a task — generate approaches before any code is written.

### Vision Mode
Activated for product-level rethinks — not "how to implement X" but "should we even build X?" Forces 10x thinking instead of incremental improvement.

**Vision Mode triggers:**
- Manual: `/rune brainstorm vision <product area>`
- Called by `@rune-pro/product.feature-spec` when requirements feel incremental
- When the user says "rethink", "reimagine", "what if we", "step back"

**Vision Mode constraints:**
1. MUST restate the user's REAL problem (not their proposed solution) — "you asked for a settings page, but your real problem is users can't find the right config"
2. MUST generate 2-3 approaches where at least 1 eliminates the need for the feature entirely
3. MUST apply the "10-star experience" lens: what would a 1-star, 5-star, and 10-star version look like?
4. MUST challenge assumptions: "why does this need to be a page?" "why does the user need to do this at all?"

### Rescue Mode
Activated when an approach has been tried and **fundamentally failed** — not a bug, but a wrong approach. Rescue mode forces **category-diverse** alternatives instead of variants of the failed approach.

**Rescue Mode triggers:**
- `cook` Phase 4: Approach Pivot Gate fires (3 debug-fix loops exhausted + re-plan still fails)
- `debug`: 3-Fix Escalation Rule fires AND root cause is "approach doesn't work" (not a bug in implementation)
- `fix`: 3 fix attempts fail AND each attempt reveals a different blocker (systemic, not localized)
- Manual: `/rune brainstorm rescue <what failed and why>`

**Rescue Mode input:**
```
mode: "rescue"
failed_approach: string     — what was tried
failure_evidence: string[]  — concrete reasons it failed (error messages, blockers, dead ends)
original_goal: string       — what we're still trying to achieve
```

**Rescue Mode constraints:**
1. MUST generate 3-5 approaches (more than Discovery's 2-3 — wider net)
2. Each approach MUST be a **different category**, not a variant of the failed one
3. At least 1 approach must be "unconventional" (hacky, wrapper, reverse-engineer, proxy, etc.)
4. MUST use Collision-Zone Thinking or Inversion Exercise — conventional thinking already failed
5. MUST explicitly state why each approach is a **different category** from the failed one
6. Failed approach MUST be listed as "Option X (FAILED)" — visible reminder not to loop back

**Category examples** (approaches in different categories):
```
Direct API call ≠ Wrapper/middleware layer ≠ Reverse engineering ≠ Browser automation
  ≠ Extension/plugin ≠ Proxy/bridge service ≠ Alternative tool entirely
```

## Triggers

- Called by `cook` when multiple valid approaches exist for a feature (Discovery Mode)
- Called by `cook` Approach Pivot Gate when current approach fundamentally fails (Rescue Mode)
- Called by `debug` 3-Fix Escalation when root cause is architectural, not a bug (Rescue Mode)
- Called by `plan` when architecture decision needs creative exploration (Discovery Mode)
- `/rune brainstorm <topic>` — manual brainstorming (Discovery Mode)
- `/rune brainstorm rescue <context>` — manual rescue (Rescue Mode)
- Auto-trigger: when task description is vague or open-ended (Discovery Mode)

## Calls (outbound)

- `plan` (L2): when idea is selected and needs structuring into actionable steps
- `research` (L3): gather data for informed brainstorming (existing solutions, benchmarks)
- `trend-scout` (L3): market context and trends for product-oriented brainstorming
- `problem-solver` (L3): structured reasoning frameworks (SCAMPER, First Principles, 6 Hats)
- `sequential-thinking` (L3): evaluating approaches with many variables

## Called By (inbound)

- `cook` (L1): when multiple valid approaches exist for a feature (Discovery Mode)
- `cook` (L1): Approach Pivot Gate — current approach failed, need category-diverse alternatives (Rescue Mode)
- `debug` (L2): 3-Fix Escalation when root cause is "wrong approach" not "wrong code" (Rescue Mode)
- `plan` (L2): when architecture decision needs creative exploration (Discovery Mode)
- User: `/rune brainstorm <topic>` direct invocation (Discovery Mode)
- User: `/rune brainstorm rescue <context>` manual rescue (Rescue Mode)

## Cross-Hub Connections

- `brainstorm` ↔ `plan` — bidirectional: brainstorm generates options → plan structures the chosen one, plan needs exploration → brainstorm ideates

## Reasoning Frameworks

### Analytical Frameworks
```
SCAMPER          — Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse
FIRST PRINCIPLES — Break down to fundamentals, rebuild from ground up
6 THINKING HATS  — Facts, Emotions, Caution, Benefits, Creativity, Process
CRAZY 8s         — 8 ideas in 8 minutes (rapid ideation)
```

### Breakthrough Frameworks (when conventional thinking fails)

**Collision-Zone Thinking** — Force unrelated concepts together: "What if we treated X like Y?"
- Pick two unrelated domains (e.g., services + electrical circuits → circuit breakers)
- Explore emergent properties from the collision
- Test where the metaphor breaks → those boundaries reveal design constraints
- Best source domains: physics, biology, economics, psychology
- Use when: conventional approaches feel inadequate, need innovation not optimization

**Inversion Exercise** — Flip every assumption: "What if the opposite were true?"
- List core assumptions ("cache reduces latency", "handle errors when they occur")
- Invert each: "add latency" → debouncing; "make errors impossible" → type systems
- Valid inversions expose context-dependence in "obvious" truths
- Use when: feeling forced into "the only way", stuck on unquestioned assumptions

**Scale Game** — Test at extremes (1000x bigger/smaller) to expose fundamentals
- Pick a dimension: volume, speed, users, duration, failure rate
- Test minimum (1000x smaller) AND maximum (1000x bigger)
- What breaks reveals algorithmic limits; what survives is fundamentally sound
- Use when: unsure about production scale, edge cases unclear, "it works in dev"

## Executable Steps

### Step 0 — Detect Mode

Check the invocation context:
- If `mode="vision"` is set, or user says "rethink/reimagine/step back" → **Vision Mode**
- If `mode="rescue"` is set, or caller is Approach Pivot Gate / 3-Fix Escalation → **Rescue Mode**
- Otherwise → **Discovery Mode**

If Rescue Mode: read `failed_approach` and `failure_evidence` before proceeding. These become anti-constraints — approaches that MUST NOT repeat the failed category.

### Step 1 — Frame the Problem
State the decision to be made in one clear sentence: "We need to decide HOW TO [achieve X] given [constraints Y]." Identify:
- Hard constraints (cannot change): budget, existing tech stack, deadlines
- Soft constraints (prefer to avoid): complexity, breaking changes, unfamiliar tech
- Success criteria: what does a good solution look like?
- **[Rescue Mode only]** Anti-constraints: "Approach X was tried and failed because Y — do NOT generate variants of X"

If the problem is unclear, ask the user ONE clarifying question before proceeding.

### Step 1.5 — Problem Restatement (MANDATORY)

After framing the problem, restate it back to the user for confirmation:

```
"Let me confirm: you want to [X] because [Y],
and the main constraint is [Z]. Correct?"
```

DO NOT generate approaches until user confirms the restatement. This prevents wasted ideation on a misunderstood problem — the most expensive brainstorm failure mode.

**Skip conditions** (Rescue Mode only):
- Rescue Mode: problem is already well-defined by `failure_evidence` — restatement is implicit in the failed approach summary.

### Step 1.75 — Dynamic Questioning (When Clarification Needed)

When Step 1 or Step 1.5 reveals gaps, ask structured clarifying questions using this format:

```
### [P0|P1|P2] **[DECISION POINT]**

**Question:** [Clear, specific question]

**Why This Matters:**
- [Architectural consequence — what changes based on the answer]
- [Affects: cost | complexity | timeline | scale | security]

**Options:**
| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| A      | [+]  | [-]  | [scenario] |
| B      | [+]  | [-]  | [scenario] |

**If Not Specified:** [Default choice + rationale]
```

**Priority levels:**
- **P0**: Blocking — cannot generate approaches without this answer
- **P1**: High-leverage — significantly changes the recommended approach
- **P2**: Nice-to-have — refines the recommendation but doesn't change direction

**Rules:**
1. Ask maximum 3 questions per round (avoid overwhelming the user)
2. Each question MUST connect to a specific decision point (no generic "what do you want?")
3. MUST provide a default answer — if user says "you decide", the default is used
4. Questions generate data, not assumptions — each eliminates implementation paths

### Step 2 — Generate Approaches

**Discovery Mode**: Produce exactly 2–3 distinct approaches.
**Rescue Mode**: Produce exactly 3–5 approaches, each a **different category** from the failed approach.

Each approach must be meaningfully different — not just variations of the same idea. For each approach provide:
- **Name**: short memorable label
- **Description**: 2–4 sentences on how it works
- **Pros**: concrete advantages (not generic "simple" — be specific)
- **Cons**: concrete disadvantages and failure modes
- **Effort**: low (< 1 day) | medium (1–3 days) | high (> 3 days)
- **Risk**: low | medium | high + one-line explanation of the main risk

If the domain is unfamiliar or data is needed, invoke `rune:research` before generating options. For product/market context, invoke `rune:trend-scout`.

### Step 3 — Evaluate

**Discovery Mode** — Apply the most relevant framework:
- Use **SCAMPER** when exploring variations of an existing solution
- Use **First Principles** when the problem looks unsolvable with conventional approaches
- Use **6 Thinking Hats** when stakeholder perspectives matter (product vs. engineering vs. user)
- Use **Crazy 8s** (rapid listing) when time-boxed exploration is needed
- Use **Collision-Zone** when innovation is needed, not just optimization — force cross-domain metaphors
- Use **Inversion** when all options feel forced or there's an unquestioned "must be this way"
- Use **Scale Game** when validating which approach survives production reality

**Rescue Mode** — MUST use at least one of these (conventional thinking already failed):
- **Collision-Zone Thinking** (mandatory first pick) — force cross-domain metaphors to break out of the failed category
- **Inversion Exercise** — flip assumptions that led to the failed approach
- **First Principles** — strip to fundamentals, rebuild without the assumption that caused failure

Additionally in Rescue Mode:
- Invoke `rune:research` to search for how others solved similar problems (repos, articles, workarounds)
- At least 1 approach must be "hacky/unconventional" — wrappers, reverse engineering, browser automation, proxy layers, debug mode abuse, etc.
- Label each approach with its **category tag** to prove diversity: `[Direct API]`, `[Wrapper]`, `[Reverse-Engineer]`, `[Proxy]`, `[Extension]`, `[Alternative Tool]`, etc.

For approaches with many interacting variables, invoke `rune:sequential-thinking` to reason through trade-offs systematically.

### Step 4 — Recommend
Select ONE approach as the recommendation. State:
- Which option is recommended
- Primary reason (1 sentence)
- Conditions under which a different option would be better (hedge case)

Do not recommend "it depends" without a concrete decision rule.

### Step 5 — Return to Plan
Pass the recommended approach back to `rune:plan` for structuring into an executable implementation plan. Include:
- The chosen option name
- Key constraints to honor in the plan
- Any risks identified that the plan must mitigate

If the user rejects the recommendation, return to Step 2 with adjusted constraints and regenerate.

## Constraints

1. MUST propose 2-3 approaches (Discovery) or 3-5 approaches (Rescue) — never present only one option
2. MUST include your recommendation and reasoning for why
3. MUST ask one question at a time — don't overwhelm with multiple questions
4. MUST save approved design to docs/plans/ before transitioning to plan
5. MUST NOT jump to implementation — brainstorm → plan → implement is the order
6. [Rescue Mode] MUST NOT generate variants of the failed approach — each approach must be a different CATEGORY
7. [Rescue Mode] MUST use Collision-Zone or Inversion framework — conventional thinking already failed
8. [Rescue Mode] MUST include at least 1 unconventional/hacky approach — sometimes the "dirty" solution is the only one that works

## Output Format

```
## Brainstorm: [Topic]

### Context
[Problem statement and constraints]

### Option A: [Name] (Recommended)
- **Approach**: [description]
- **Pros**: [advantages]
- **Cons**: [disadvantages]
- **Effort**: low | medium | high
- **Risk**: low | medium | high — [main risk]

### Option B: [Name]
- **Approach**: [description]
- **Pros**: [advantages]
- **Cons**: [disadvantages]
- **Effort**: low | medium | high
- **Risk**: low | medium | high — [main risk]

### Option C: [Name] (if needed)
...

### Recommendation
Option A — [one-line primary reason].
Choose Option B if [specific hedge condition].

### Next Step
Proceeding to rune:plan with Option A. Constraints to honor: [list].
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating only one option instead of 2-3 | HIGH | Always present multiple approaches — the value is in the comparison, not the recommendation |
| Proceeding to plan without user approval on the approach | CRITICAL | Brainstorm MUST get explicit sign-off before calling plan — no silent "going with Option A" |
| Options are variations of the same approach (fake diversity) | HIGH | Options must differ in architecture, not just naming — different trade-offs, not just different words |
| [Rescue] Generating variants of the failed approach | CRITICAL | Each approach MUST have a different category tag — if two share a tag, one must be replaced |
| [Rescue] Skipping Collision-Zone/Inversion frameworks | HIGH | Conventional thinking already failed — MUST use at least one breakthrough framework |
| [Rescue] All approaches are "clean/proper" — no hacky option | MEDIUM | At least 1 must be unconventional — wrappers, reverse-engineering, debug mode abuse, proxy layers |
| Calling plan directly instead of presenting options first | CRITICAL | Steps 2-3 are mandatory — present options, get approval, THEN call plan |
| "Creative" options that ignore stated constraints | MEDIUM | Every option must satisfy the constraints declared in Step 1 |

## Done When

- Context scan complete (project files read, existing patterns identified)
- 2-3 genuinely different approaches presented with trade-offs
- User has explicitly approved an approach (not implied or assumed)
- Selected option documented with rationale
- Constraints for plan phase listed explicitly
- `plan` (L2) called with the approved approach and constraints

## Cost Profile

~2000-5000 tokens input, ~1000-2500 tokens output. Opus for creative reasoning depth. Runs infrequently — only when creative exploration is needed.
