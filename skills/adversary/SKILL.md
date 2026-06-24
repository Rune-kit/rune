---
name: adversary
description: "Pre-implementation red-team analysis. Use when a plan is high-risk, critical path, or expensive to reverse. Challenges plans before code is written — finds edge cases, security holes, scalability bottlenecks, error propagation risks, and integration conflicts. Catches flaws at plan time (10x cheaper than post-implementation)."
metadata:
  author: runedev
  version: "0.4.0"
  layer: L2
  model: opus
  group: quality
  tools: "Read, Glob, Grep"
  emit: oracle.dispatched, oracle.response, oracle.failed
  listen: agent.stuck, context.preview
---

# adversary

## Purpose

Pre-implementation adversarial analysis. After a plan is approved but BEFORE code is written, adversary stress-tests the plan across 5 dimensions: edge cases, security, scalability, error propagation, and integration risk. It does NOT fix or redesign — it reports weaknesses so the plan can be hardened before implementation begins.

This fills the only gap in the plan-to-ship pipeline: all other quality skills (review, preflight, sentinel) operate AFTER code exists. Catching a flaw in a plan costs minutes; catching it in implementation costs hours.

<HARD-GATE>
adversary MUST NOT approve a plan without at least one specific challenge per dimension analyzed.
A report that says "plan looks solid" without concrete attack vectors is NOT a red-team analysis.
Every finding MUST reference the specific plan section, file, or assumption it challenges.
</HARD-GATE>

## Triggers

- Called by `cook` Phase 2.5 — after plan approved, before Phase 3 (TEST)
- `/rune adversary` — manual red-team analysis of any plan or design document
- Auto-trigger: when plan files are created in `.rune/` or `docs/plans/`

## Calls (outbound)

- `sentinel` (L2): deep security scan when adversary identifies auth/crypto/payment attack vectors in the plan
- `perf` (L2): scalability analysis when adversary identifies potential bottleneck patterns
- `scout` (L2): find existing code that might conflict with planned changes
- `docs-seeker` (L3): verify framework/API assumptions in the plan are correct and current
- `hallucination-guard` (L3): verify that APIs, packages, or patterns referenced in the plan actually exist
- `context-engine` (L3): (oracle-mode) emit `context.preview` before bundle build to gate token cost
- `session-bridge` (L3): (oracle-mode) detach protocol when target model is opus-class for non-blocking dispatch

## Called By (inbound)

- `cook` (L1): Phase 2.5 — after plan approval, before TDD
- `plan` (L2): optional post-step for critical features
- `team` (L1): when decomposing large tasks, adversary validates the decomposition
- `debug` (L2): (oracle-mode) listens to `agent.stuck` from debug after 3 disproved hypotheses
- `fix` (L2): (oracle-mode) listens to `agent.stuck` from fix after 2+ failed attempts
- User: `/rune adversary` direct invocation

## Cross-Hub Connections

- `adversary` ← `cook` — plan produced → adversary challenges it → hardened plan feeds Phase 3
- `adversary` → `sentinel` — security attack vector identified → sentinel validates depth
- `adversary` → `perf` — scalability concern raised → perf quantifies the bottleneck
- `adversary` → `scout` — integration risk flagged → scout finds affected code
- `adversary` → `plan` — CRITICAL findings → plan revises before implementation

## Execution

### Step 0: Load Context

1. Read the plan document (from `.rune/features/<name>/plan.md`, phase file, or user-specified path)
2. Read the requirements document if it exists (`.rune/features/<name>/requirements.md` from BA)
3. Use `scout` to identify existing code files that the plan will touch or depend on
4. Identify the plan's core assumptions — what MUST be true for this plan to work?

### Step 0.5: Steelman + Pick a Reasoning Lens
<MUST-READ path="references/reasoning-modes.md" trigger="before challenging any plan — to steelman the thesis and select the reasoning lens per dimension"/>

Before attacking, **steelman the plan's core thesis** — restate it in its strongest
form (strip weak framing, supply the strongest implied evidence, name what's genuinely
good). Attacking a weak paraphrase produces findings the author dismisses with "that's
not what I meant." The steelman also seeds the Strength Notes section (Step 6).

The 5 dimensions below answer *what* to attack. The 5 **reasoning modes** answer *how*:

| Mode | Core question | Reach for when |
|------|---------------|----------------|
| **Red Team** (default) | "How would someone break/exploit/game this?" | auth, payment, user data, public input, perverse incentives. NB: this is *persona framing* (who attacks, their capability/motivation) — it composes with Step 2's attack-surface inventory, not a duplicate of it |
| **Pre-mortem** | "It's 6 months out and this failed — why?" | migrations, infra, architecture, cascading failure |
| **Evidence Audit** | "Does the evidence actually support this claim?" | benchmark/"X is faster"/capacity-number justifications |
| **Dialectic** | "What's the strongest case for the opposite choice?" | tech/vendor/architecture one-way-door decisions |
| **Socratic** | "What is this plan taking for granted?" | vague scope, consensus-driven plans, thin specs |

Default to **Red Team**. Switch or add a second lens when the plan's shape calls for it
(signal→mode table + mode mechanics in `references/reasoning-modes.md`). State which lens
you applied per dimension — don't ask the user to pick. Dialectic's synthesis usually
produces concrete remediations (likely HARDEN), but maps to REVISE if it exposes a
structural flaw in the chosen approach; Socratic's surfaced assumptions and Pre-mortem's
narratives become findings.

### Step 1: Edge Case Analysis

Challenge the plan's handling of boundary conditions.

For each input/output/state transition in the plan, ask:
- **Empty/zero**: What happens with no data, zero items, empty strings, null users?
- **Overflow**: What happens at MAX — 10K items, 1MB payload, 1000 concurrent users?
- **Race conditions**: What if two operations happen simultaneously? Can state become inconsistent?
- **Partial failure**: What if step 3 of 5 fails? Is there rollback? Or orphaned state?
- **Invalid combinations**: What input combinations are technically possible but semantically nonsensical?

```
EDGE_CASE_TEMPLATE:
- Scenario: [specific edge case]
- Plan assumption: [what the plan assumes]
- Attack: [how this breaks]
- Impact: [what fails — data loss, crash, wrong result, security breach]
- Remediation: [1-sentence fix suggestion]
```

### Step 2: Security Attack Vectors

Analyze the plan for security weaknesses BEFORE any code exists.

- **Input trust boundaries**: Where does the plan accept external input? Is validation specified?
- **Authentication gaps**: Does the plan assume auth exists? Are there unprotected routes or actions?
- **Data exposure**: Could the planned API responses leak sensitive fields? Are there over-fetching risks?
- **Privilege escalation**: Can a normal user reach admin functionality through the planned flow?
- **Injection surfaces**: Does the plan involve dynamic queries, template rendering, or shell commands?
- **Dependency risk**: Does the plan introduce new dependencies? Are they well-maintained and trusted?

If any auth, crypto, or payment logic is in the plan: MUST call `rune:sentinel` for deep analysis.

```
SECURITY_TEMPLATE:
- Vector: [attack type — OWASP category if applicable]
- Entry point: [which part of the plan is vulnerable]
- Exploit scenario: [how an attacker would use this]
- Severity: CRITICAL | HIGH | MEDIUM
- Remediation: [what the plan should specify to prevent this]
```

### Step 3: Scalability Stress Test

Project the plan forward — what happens at 10x and 100x scale?

- **N+1 queries**: Does the plan describe data fetching that will create N+1 database calls?
- **Missing pagination**: Does the plan handle lists without specifying limits?
- **Synchronous bottlenecks**: Are there blocking operations in the hot path?
- **Cache invalidation**: If caching is planned, what happens when data changes? Stale reads?
- **State growth**: Does the plan accumulate state (in-memory, database, file system) without cleanup?
- **External service limits**: Does the plan account for rate limits on third-party APIs?

If bottleneck patterns detected: call `rune:perf` for quantitative analysis.

```
SCALE_TEMPLATE:
- Bottleneck: [what breaks at scale]
- Current plan: [what the plan specifies]
- At 10x: [what happens]
- At 100x: [what happens]
- Remediation: [what to add to the plan]
```

### Step 4: Error Propagation Analysis

Trace failure paths through the planned system.

- **Cascade failures**: If Service A fails, does the plan specify what happens to B, C, D?
- **Retry storms**: Does the plan include retries? Could retries amplify the failure?
- **Silent failures**: Are there operations that could fail without anyone knowing?
- **Inconsistent state**: If a multi-step operation fails midway, is the data left in a valid state?
- **User experience**: When things fail, what does the user see? Is there a degraded mode?
- **Recovery path**: After failure + fix, can the system resume? Or does it require manual intervention?

```
ERROR_TEMPLATE:
- Failure point: [where in the plan]
- Propagation: [what else breaks]
- User impact: [what the user experiences]
- Recovery: [how to get back to good state]
- Missing in plan: [what the plan should specify]
```

### Step 5: Integration Risk Assessment

Check for conflicts with existing code and architecture.

- Use `rune:scout` to find all files the plan will modify or depend on
- **Breaking changes**: Does the plan modify shared interfaces, types, or APIs that other code depends on?
- **Migration gaps**: Does the plan require database migrations? Are they reversible?
- **Configuration drift**: Does the plan add new environment variables, feature flags, or config files?
- **Test invalidation**: Will existing tests break from the planned changes?
- **Deployment ordering**: Does the plan require specific deployment sequence? (DB first, then API, then frontend?)

```
INTEGRATION_TEMPLATE:
- Conflict: [what clashes]
- Existing code: [file:line that would be affected]
- Plan assumption: [what the plan assumes about existing code]
- Reality: [what the existing code actually does]
- Remediation: [how to resolve the conflict]
```

### Step 6: Verdict and Report

Synthesize all findings into an actionable report.

**Before reporting, apply rigor filter:**
- Only report findings you can justify with specific references to the plan or codebase
- Do NOT report theoretical concerns that require 3+ unlikely conditions to trigger
- Prioritize findings that would cause the MOST wasted implementation time if discovered later
- Consolidate related findings — "auth is underspecified" not 5 separate auth findings

**Verdict logic:**
- Any CRITICAL finding → **REVISE** (plan must be updated before Phase 3)
- 3+ HIGH findings → **REVISE**
- HIGH findings with clear remediations → **HARDEN** (add remediations to plan, then proceed)
- Only MEDIUM/LOW findings → **PROCEED** (note findings for implementation awareness)

After reporting:
- If verdict is REVISE: return to `plan` with findings attached as constraints
- If verdict is HARDEN: present remediations to user for plan update
- If verdict is PROCEED: pass findings to cook Phase 3 as implementation notes

## Output Format

```
## Adversary Report: [feature/plan name]
- **Plan analyzed**: [path to plan file]
- **Dimensions checked**: [which of the 5 were relevant]
- **Reasoning lens**: [Red Team | Pre-mortem | Evidence Audit | Dialectic | Socratic — and why]
- **Findings**: [count by severity]
- **Verdict**: REVISE | HARDEN | PROCEED

### CRITICAL
- [ADV-001] [dimension]: [description with plan reference]
  - Attack: [how this breaks]
  - Remediation: [specific fix]

### HIGH
- [ADV-002] [dimension]: [description with plan reference]
  - Attack: [how this breaks]
  - Remediation: [specific fix]

### MEDIUM
- [ADV-003] [dimension]: [description]

### Strength Notes
- [what the plan does well — adversary is harsh but fair]

### Verdict
[Summary: why REVISE/HARDEN/PROCEED, what to do next]
```

## Workflow Modes

### Full Red-Team (default)
All 5 dimensions analyzed. Used for new features, architectural changes, security-sensitive plans.

### Quick Challenge (for smaller plans)
Skip Steps 3-4 (scalability, error propagation). Focus on edge cases, security, and integration.
Trigger: plan modifies < 3 files AND no auth/payment/data logic.

### Security-Focused
Steps 2 and 5 only (security + integration). Used when `sentinel` requests adversarial pre-analysis.
Trigger: plan involves auth, crypto, payment, or user data handling.

### Mode: oracle (v0.2.0)

**Triggered by**: `agent.stuck` signal — emitted by `debug` (after 3 disproved hypotheses) or `fix` (after 2+ failed attempts on the same file).

**Purpose**: Break confirmation-bias loops. The same agent that read `auth.ts` 3 times has formed a theory it cannot un-form. Oracle-mode dispatches a stateless second-model pass with explicit "no prior context" framing, breaking the semantic loop that `scout`'s zoom-out mode (structural pivot) cannot.

**When NOT to use**:
- Single hypothesis cycle — escalate only after 3 cycles in `debug` or 2 attempts in `fix`
- Trivial single-file bugs — overhead exceeds value
- When the user already knows the answer — they're trying to validate, not diagnose

**Protocol**:

1. **Pre-bundle gate** — emit `context.preview` to `context-engine` first; abort if action=block
2. **Build context bundle** — see `references/context-bundle-format.md` for exact format
3. **Dispatch** — emit `oracle.dispatched` signal; route via `session-bridge` detach if target model is opus-class (non-blocking). **For genuine architectural independence** (security-critical logic, irreversible ops, a loop the in-mesh model cannot break), prefer a **different-architecture external CLI** (Gemini/Codex) over another Claude instance — a same-family reviewer shares blind spots with the author. Invoke it via the safe transport in `references/cross-model-escalation.md`: explicit per-call user authorization, read-only sandbox, stdin not inline args, binary pre-flight. Never auto-invoke an external CLI in non-interactive contexts — skip and announce.
4. **Wait for response** — synchronous if model is sonnet-class, polled via `.rune/oracle-pending/<id>.json` if opus-class
5. **Validate response** — every claim MUST cite file:line. Strip + warn on uncited claims (`oracle.failed` if all claims uncited)
6. **Emit response** — `oracle.response` carries the validated diagnosis, consumed by `debug`/`fix` to override or refine their current hypothesis

**Bundle format** (mandatory regex-validated):

```
[SYSTEM] You are Oracle, a focused one-shot problem solver. You have NO prior context — assume zero project knowledge. Cite file:line for every claim. Reject any claim you cannot ground in the provided files.

[USER] <agent stuck after N hypothesis cycles. What is the most likely root cause not yet considered?>

### File 1: <relative/path/to/file.ts>
<file content, normalized whitespace, max 4k chars per file>

### File 2: <...>
<...>
```

**Hard caps**:
- Bundle ≤ 100k tokens (estimated via char count × 0.25)
- Per-file ≤ 4k chars (truncate with explicit `... [truncated]` marker)
- Max 12 files per bundle (force caller to prune larger sets)

**Response contract** — Oracle reply MUST contain:
- A primary diagnosis (1-3 sentences)
- At least 1 file:line citation per claim
- An action recommendation (specific edit, additional file to read, hypothesis to test)

Replies failing this contract are rejected — `oracle.failed` emitted, primary agent continues without second opinion.

See `references/oracle-mode.md` for the full protocol and integration with `debug`/`fix`. See `references/cross-model-escalation.md` for the safe external-CLI transport when the second opinion should come from a different model architecture.

## Constraints

1. MUST challenge every plan — no rubber-stamping. At minimum, one finding per analyzed dimension
2. MUST NOT modify the plan or write code — adversary is read-only analysis
3. MUST reference specific plan sections or existing code for every finding
4. MUST escalate to sentinel when auth/crypto/payment attack vectors are identified
5. MUST use concrete attack scenarios, not vague warnings ("could be a problem" is NOT a finding)
6. MUST NOT block on MEDIUM/LOW findings — only CRITICAL and HIGH trigger REVISE verdict
7. MUST include Strength Notes — adversary finds weaknesses AND acknowledges what's well-designed
7b. SHOULD steelman the plan's core thesis before challenging it (Step 0.5) — a challenge that only lands against a weaker paraphrase is a weak finding, not a CRITICAL/HIGH. If steelmanning reveals a dimension is genuinely solid, record "No findings after steelman" for that dimension — that satisfies the per-dimension HARD-GATE
8. (oracle-mode) MUST emit `context.preview` BEFORE building the bundle — abort if context-engine action=block
9. (oracle-mode) MUST validate every Oracle reply citation against the provided files — reject uncited claims as `oracle.failed`

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Plan Gate | A plan document exists (from plan skill or user-provided) | Cannot run — ask for plan first |
| Codebase Gate | Access to existing codebase (for integration checks) | Skip Step 5, note in report |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Over-challenging — nitpicking every line of the plan | HIGH | Rigor filter: only findings you can justify with specific references. Skip theoretical 3+ condition chains |
| Strawmanning — attacking a weaker version of the plan than what's written | HIGH | Step 0.5: steelman the thesis first; a challenge that only lands against the weak reading is dropped |
| One-lens tunnel vision — red-teaming a decision that needed dialectic/evidence-audit | MEDIUM | Step 0.5 signal→mode table: match the reasoning lens to the plan's shape, state which lens you applied |
| False security alarms — flagging secure patterns as vulnerable | HIGH | Call sentinel for validation before reporting security findings as CRITICAL |
| Analysis paralysis — too many findings block all progress | MEDIUM | Max 3 CRITICAL + 5 HIGH. If more found, consolidate or prioritize top impact |
| Missing context — challenging plan without understanding existing codebase | HIGH | Step 0 MUST load existing code context via scout before challenging |
| Scope creep — reviewing existing code quality instead of plan quality | MEDIUM | Adversary reviews THE PLAN, not the codebase. Existing code is context only |
| Redundancy with review/preflight — duplicating post-implementation checks | MEDIUM | Adversary operates PRE-implementation only. Never run adversary on existing code |
| (oracle-mode) Bundle exceeds token cap — caller didn't prune | HIGH | Caller MUST run `context.preview` first; adversary fails fast with `oracle.failed` instead of silently truncating signal |
| (oracle-mode) Oracle reply has no citations — model improvised | CRITICAL | Reject reply with `oracle.failed`. Primary agent continues without second opinion (better than acting on hallucination) |
| (oracle-mode) Loop: oracle reply triggers another `agent.stuck` | HIGH | Cap at 1 oracle dispatch per primary-agent stuck cycle. Subsequent stucks must escalate to user |
| (cross-model) External CLI invoked without authorization or in non-interactive run | CRITICAL | Per-call user authorization required; non-interactive → skip + announce. See `references/cross-model-escalation.md` |
| (cross-model) Bundle interpolated into shell args — embedded `$(...)` executes | CRITICAL | Always pass via stdin from a temp file; read-only sandbox. Never inline `-p "<bundle>"` |
| (cross-model) Rubber-stamping the external reviewer's verdict | MEDIUM | Reply is data, not ruling — reconcile against the artifact; classify each finding |

## Done When

- Plan thesis steelmanned before challenging (Step 0.5) — reasoning lens(es) selected and stated
- All relevant dimensions analyzed (minimum: edge cases + security + integration)
- Every finding references specific plan section or codebase file
- Security-sensitive plans escalated to sentinel (or confirmed not security-relevant)
- Verdict rendered: REVISE, HARDEN, or PROCEED
- Findings formatted for consumption by cook Phase 3 (if PROCEED) or plan (if REVISE)
- Strength Notes section acknowledges well-designed aspects of the plan
- (oracle-mode) If dispatched: response cited file:line for each claim, or `oracle.failed` emitted with rejection reason

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Adversary Report | Markdown | inline (stdout) |
| Threat findings | Structured list (CRITICAL/HIGH/MEDIUM) | inline |
| Risk matrix per dimension | Table | inline |
| Verdict + remediation list | Markdown | inline |
| Hardened plan notes (if PROCEED) | Text | passed to cook Phase 3 |

## Cost Profile

~4000-8000 tokens input (plan + codebase context), ~2000-3000 tokens output. Opus model for adversarial depth. Runs once per feature plan — high cost justified by preventing wasted implementation cycles.

**Scope guardrail:** adversary reviews THE PLAN only — never audits existing codebase quality or rewrites code.
