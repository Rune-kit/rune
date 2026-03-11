---
name: problem-solver
description: "Structured reasoning frameworks for complex problems. 14 analytical frameworks, 12 cognitive bias detectors, 10 decomposition methods, 8 mental models, and 6 communication patterns. McKinsey-grade problem solving for AI coding assistants."
metadata:
  author: runedev
  version: "0.3.0"
  layer: L3
  model: sonnet
  group: reasoning
---

# problem-solver

## Purpose

Structured reasoning utility for problems that resist straightforward analysis. Receives a problem statement, detects cognitive biases, selects the appropriate analytical framework, applies it step-by-step with evidence, and returns ranked solutions with a communication structure. Stateless — no memory between calls.

Inspired by McKinsey problem-solving methodology and cognitive science research on decision-making errors.

## Calls (outbound)

None — pure L3 reasoning utility.

## Called By (inbound)

- `debug` (L2): complex bugs that resist standard debugging
- `brainstorm` (L2): structured frameworks for creative exploration
- `plan` (L2): complex architecture decisions with many trade-offs
- `ba` (L2): requirement analysis when scope is ambiguous

## Execution

### Input

```
problem: string         — clear statement of the problem to analyze
context: string         — (optional) relevant background, constraints, symptoms observed
goal: string            — (optional) desired outcome or success criteria
mode: string            — (optional) "analyze" | "decide" | "decompose" | "communicate"
```

### Step 1 — Receive and Classify

Read the `problem` and `context` inputs. Restate the problem in one sentence to confirm understanding.

Classify the problem type:

| Type | Signal Words | Primary Approach |
|------|-------------|-----------------|
| Root cause / diagnostic | "why", "broken", "failing", "declining" | 5 Whys, Fishbone, Root Cause |
| Decision / choice | "should I", "choose", "compare", "vs" | Decision Frameworks (Step 3b) |
| Decomposition | "break down", "understand", "structure" | Decomposition Methods (Step 3c) |
| Creative / stuck | "stuck", "no ideas", "exhausted options" | SCAMPER, Collision-Zone, Inversion |
| Architecture / scale | "design", "architecture", "will it scale" | First Principles, Scale Game |

### Step 2 — Bias Check (ALWAYS RUN)

<HARD-GATE>
NEVER skip bias detection. Every problem has biases — explicitly address them.
This is the #1 value-add from structured reasoning. Without it, solutions are just dressed-up gut feelings.
</HARD-GATE>

Scan the problem statement and context for bias indicators. Check the top 6 most dangerous biases:

| Bias | Detection Question | Debiasing Strategy |
|------|-------------------|-------------------|
| **Confirmation Bias** | Have we actively sought evidence AGAINST our preferred option? Are we explaining away contradictory data? | Assign devil's advocate. Explicitly seek disconfirming evidence. Require equal analysis of all options. |
| **Anchoring Effect** | Would our evaluation change if we saw options in a different order? Is the first number/proposal dominating? | Generate evaluation criteria BEFORE seeing options. Score independently before group discussion. |
| **Sunk Cost Fallacy** | If we were starting fresh today with zero prior investment, would we still choose this? Are we justifying by pointing to past spend? | Evaluate each option as if starting fresh (zero-based). Separate past investment from forward-looking decision. |
| **Status Quo Bias** | Are we holding the current state to the SAME standard as alternatives? Would we actively choose the status quo if starting from scratch? | Explicitly include status quo as an option evaluated with same rigor. Calculate the cost of inaction. |
| **Overconfidence** | What is our confidence level, and what is it based on? Have we been right about similar predictions before? | Use pre-mortem to stress-test. Track calibration. Seek outside perspectives. |
| **Planning Fallacy** | Are our estimates based on best-case assumptions? Have similar projects in the past taken longer or cost more? | Use reference class forecasting — compare to actual outcomes of similar past efforts rather than bottom-up estimates. |

Additional biases to check when relevant:
- **Framing Effect**: Would our preference change if framed as a gain vs. a loss?
- **Availability Heuristic**: Are we basing estimates on vivid anecdotes rather than systematic data?
- **Groupthink**: Has anyone expressed strong disagreement? Are we reaching consensus suspiciously fast?
- **Loss Aversion**: Are we avoiding an option primarily because of what we might lose, rather than evaluating the full picture?
- **Survivorship Bias**: Are we only looking at successful cases? Who tried this approach and failed?
- **Recency Bias**: Are we extrapolating from the last few data points instead of looking at 5-10 years of data?

**Output**: List 2-3 biases most likely to affect THIS specific problem, with their debiasing strategy. Weave these warnings into the analysis.

### Step 3a — Select Analytical Framework

Choose the framework based on what is unknown about the problem:

| Situation | Framework |
|-----------|-----------|
| Root cause unknown — symptoms clear | **5 Whys** |
| Multiple potential causes from different domains | **Fishbone (Ishikawa)** |
| Standard assumptions need challenging | **First Principles** |
| Creative options needed for known problem | **SCAMPER** |
| Must prioritize among known solutions | **Impact Matrix** |
| Conventional approaches exhausted, need breakthrough | **Collision-Zone Thinking** |
| Feeling forced into "the only way" | **Inversion Exercise** |
| Same pattern appearing in 3+ places | **Meta-Pattern Recognition** |
| Complexity spiraling, growing special cases | **Simplification Cascades** |
| Unsure if approach survives production scale | **Scale Game** |
| High-stakes irreversible decision — need to find blind spots | **Pre-Mortem** |
| Need to determine how much analysis effort is warranted | **Reversibility Filter** |
| Quantifiable outcomes with estimable probabilities | **Expected Value Calculation** |
| Key assumptions uncertain, need to know what flips the decision | **Sensitivity Analysis** |

State which framework was selected and why.

### Step 3b — Decision Frameworks (when mode = "decide")

When the problem is a decision/choice, use these specialized frameworks:

**Reversibility Filter** (always apply first):
- Is this a one-way door (irreversible) or two-way door (reversible)?
- Two-way door → decide quickly, set review date, iterate
- One-way door → invest in thorough analysis, use other frameworks
- Proportional effort: analysis depth should match reversibility

**Weighted Criteria Matrix** (multi-option comparison):
1. List all options
2. Define 3-5 evaluation criteria (max 5 — more causes choice overload)
3. Assign weights (must sum to 100)
4. Score each option 1-5 on each criterion
5. Calculate weighted scores
6. Run sensitivity: which weight changes would flip the decision?

**Pros-Cons-Fixes** (binary or few-option, quick):
1. List pros and cons for each option
2. For each con: can it be fixed, mitigated, or is it permanent?
3. Re-evaluate with fixable cons addressed
4. Decide based on remaining permanent trade-offs

**Pre-Mortem** (high-stakes, irreversible):
1. Assume the decision has already failed catastrophically (12 months later)
2. List what went wrong (work backward)
3. Categorize by likelihood and severity
4. Develop mitigation plans for high-risk failures

**Expected Value** (quantifiable outcomes):
1. List possible outcomes for each option
2. Estimate probability of each
3. Estimate value (monetary or utility) of each
4. Calculate EV = Σ(probability × value)
5. Choose highest EV adjusted for risk tolerance

### Step 3c — Decomposition Methods (when mode = "decompose")

When the problem needs structuring before analysis:

| Method | When to Use | Pattern |
|--------|------------|---------|
| **Issue Tree** | Don't have a hypothesis yet, exploring | Root Question → Sub-questions (why/what) → deeper |
| **Hypothesis Tree** | Have domain expertise, need speed | Hypothesis → Conditions that must be true → Evidence needed |
| **Profitability Tree** | Business performance problem | Profit → Revenue (Price × Volume) → Costs (Fixed + Variable) |
| **Process Flow** | Operational/efficiency problem | Step 1 → Step 2 → ... → find bottleneck |
| **Systems Map** | Complex with feedback loops | Variables → causal links (+/-) → reinforcing/balancing loops |
| **Customer Journey** | User/customer problem | Awareness → Consideration → Purchase → Experience → Retention |

All decompositions MUST pass the MECE test:
- **ME** (Mutually Exclusive): branches don't overlap
- **CE** (Collectively Exhaustive): branches cover all possibilities

### Step 4 — Apply Framework

Execute the selected framework with discipline. For each framework, follow the steps defined in Step 3a/3b/3c.

At each step, apply the bias debiasing strategies identified in Step 2.

### Step 5 — Apply Mental Models

Cross-check the framework output against relevant mental models:

| Model | Core Question | When It Helps |
|-------|--------------|---------------|
| **Second-Order Thinking** | "And then what?" — consequences of consequences | Decisions with delayed effects |
| **Bayesian Updating** | How should we update our beliefs given this new evidence? | When new data arrives during analysis |
| **Margin of Safety** | What buffer do we need for things going wrong? | Planning timelines, budgets, capacity |
| **Opportunity Cost** | What's the best alternative we're giving up? | Resource allocation, project prioritization |
| **Occam's Razor** | Among competing explanations, prefer the simplest | Multiple possible root causes |
| **Leverage Points** | Where does small effort produce large effect? | System redesign, process improvement |
| **Hanlon's Razor** | Never attribute to malice what can be explained by incompetence or misaligned incentives | Organizational problems, team conflicts |
| **Regression to the Mean** | Is this extreme result likely to revert to average? | After exceptional performance (good or bad) |

Apply 1-2 most relevant models. State which and why.

### Step 6 — Generate Solutions

From the framework output, derive 2-3 actionable solutions. For each:
- Describe what to do concretely
- Estimate impact: high / medium / low
- Estimate effort: high / medium / low
- State any preconditions or risks
- Note which biases might affect evaluation of this solution

Rank solutions by impact/effort ratio.

### Step 7 — Select Communication Structure

Choose how to present the analysis based on audience:

| Audience | Pattern | Format |
|----------|---------|--------|
| Executive / senior | **Pyramid Principle** | Lead with recommendation → support with 3 arguments → evidence |
| Mixed / unfamiliar | **SCR** | Situation (context) → Complication (tension) → Resolution (recommendation) |
| Technical / peers | **Day-1 Answer** | State best hypothesis → list evidence for/against → confidence level |
| Quick update | **BLUF** | Bottom Line Up Front → background → details → action required |

Structure the output report using the selected pattern.

## Constraints

- MUST run bias check (Step 2) for EVERY problem — the bias layer IS the differentiator
- Never skip the framework — the structure is the value
- Use Sonnet, not Haiku — reasoning depth matters
- If problem is underspecified, state assumptions explicitly before proceeding
- Do not produce more than 3 recommended solutions — prioritize quality over quantity
- Max 5 evaluation criteria in Weighted Matrix — more causes choice overload
- Decompositions MUST pass MECE test — no overlapping or missing branches

## Output Format

```
## Analysis: [Problem Statement]
- **Type**: [root cause / decision / decomposition / creative / architecture]
- **Framework**: [chosen framework and reason]
- **Confidence**: high | medium | low

### Bias Warnings
- ⚠️ [Bias 1]: [how it might affect this analysis] → [debiasing action taken]
- ⚠️ [Bias 2]: [how it might affect this analysis] → [debiasing action taken]

### Reasoning Chain
1. [step with evidence or reasoning]
2. [step with evidence or reasoning]
3. [step with evidence or reasoning]
...

### Mental Model Cross-Check
- [Model applied]: [insight gained]

### Root Cause / Core Finding
[what the framework reveals as the fundamental issue or conclusion]

### Recommended Solutions (ranked)
1. **[Solution Name]** — Impact: high/medium/low | Effort: high/medium/low
   [concrete description of what to do]
   ⚠️ Bias risk: [which bias might make us over/under-value this]
2. **[Solution Name]** — Impact: high/medium/low | Effort: high/medium/low
   [concrete description of what to do]
3. **[Solution Name]** — Impact: high/medium/low | Effort: high/medium/low
   [concrete description of what to do]

### Next Action
[single most important immediate step]
```

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Skipping bias check and jumping to framework | CRITICAL | HARD-GATE: Step 2 is mandatory — biases ARE the value-add |
| Skipping the framework and jumping to solutions | CRITICAL | Solutions without structured analysis are guesses |
| Proceeding with underspecified problem | HIGH | Step 1: restate in one sentence — if ambiguous, state interpretation |
| Producing more than 3 solutions | MEDIUM | Max 3 ranked — prioritize quality over quantity |
| Framework mismatch (5 Whys for a creative problem) | MEDIUM | Use selection table — match framework to "what is unknown" |
| Weighted Matrix with > 5 criteria | MEDIUM | Choice overload — max 5 criteria, focus on what matters |
| Pre-Mortem without debiasing strategies | MEDIUM | Pre-Mortem reveals risks — MUST include mitigation plans |
| Decomposition failing MECE test | HIGH | Every branch must be ME (no overlap) and CE (no gaps) |
| Ignoring second-order effects in recommendations | MEDIUM | Apply Second-Order Thinking: "and then what?" |
| Presenting analysis without communication structure | LOW | Step 7: match output pattern to audience |

## Done When

- Problem restated in one sentence (understanding confirmed)
- Bias check completed — 2-3 biases identified with debiasing strategies
- Framework selected with explicit reason stated
- Framework applied step-by-step with evidence at each step
- Mental models cross-checked (1-2 relevant models applied)
- 2-3 solutions ranked by impact/effort ratio with bias risk noted
- Next Action identified (single most important immediate step)
- Analysis Report emitted with communication structure

## Cost Profile

~500-1500 tokens input, ~800-1500 tokens output. Sonnet for reasoning quality. Opus recommended for high-stakes irreversible decisions.
