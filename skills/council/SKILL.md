---
name: council
description: "Gathers N independent, decorrelated perspectives across model families (external CLIs when present, subagents when not) and arbitrates inline. Use when a decision needs genuine debate — not same-model echo — for critique, review, or judge calls. Honest about degradation: never claims 'consensus' from a single model family."
user-invocable: true
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: sonnet
  group: reasoning
  tools: "Read, Write, Bash, Grep, Glob, Task"
  emit: council.dispatched, council.result
---

# council

## Purpose

One coordination primitive that gathers N INDEPENDENT perspectives for any skill needing debate or multi-view judgment. Detects installed AI CLIs → fans a question across distinct model families → degrades gracefully to subagents when no bridge exists → gates off-topic/malformed voices → normalizes claims → **arbitrates INLINE** (no separate arbiter skill — single producer→single consumer is YAGNI).

Council's entire value proposition is *decorrelated* model bias — two different architectures independently reaching the same conclusion is signal; two instances of the same model agreeing is an echo. council refuses to launder the second case as the first.

<HARD-GATE>
If fewer than 2 distinct real `model_family` values answered (excluding `is_fallback` voices AND voices with `model_family: "unknown"` — unconfirmed wrapper-CLI backends, see `references/dispatch-protocol.md` §Detect), council MUST stamp the run `NO_DECORRELATION` and the Arbitrate step MUST NOT use consensus language ("voices agree", "consensus view", "the panel concludes"). Say what happened instead: "N subagents of the same model family produced overlapping output — treat as one perspective, not independent confirmation."
</HARD-GATE>

## Triggers

- Called by `adversary` — Step 0.6, mode=critique, for plans flagged high-risk/critical-path/expensive-to-reverse
- Called by `review` — Step 1.6, mode=review, when blast radius is 50+ callers with a HIGH-severity change
- `/rune council <question>` — manual multi-perspective gathering on any question
- Auto-trigger: none (always explicit — council is expensive relative to a single pass, callers opt in)

## Calls (outbound)

None at the skill level — council dispatches via `Bash` (external CLI bridge) and `Task` (subagent fallback) directly. It does not call other Rune skills.

## Called By (inbound)

- `adversary` (L2): Step 0.6 — decorrelated critique before red-teaming a high-risk plan
- `review` (L2): Step 1.6 — decorrelated bug-finding when blast radius escalation fires
- User: `/rune council` direct invocation

## Data Flow

### Feeds Into →

- `adversary` (L2): `CouncilResult.agreement` → seeds Step 6 Verdict with cross-family-verified findings instead of (or alongside) single-pass analysis
- `review` (L2): `CouncilResult.agreement` → seeds Step 6 Report's CRITICAL/HIGH findings for the escalated symbol
- `.rune/council/run-*.json`: every run's full result — free tier owns this schema; Pro Council Cockpit (deferred, Phase 2) reads it for a live panel

### Fed By ←

- Caller's `PerspectiveRequest` — question, mode, n, diversity constraints, evidence requirements (see `.rune/council-voice-contract.md`)
- `.rune/runtimes.json` — cached CLI detection from the current session

## Workflow

Contract source of truth: `.rune/council-voice-contract.md` (Voice v2). This section is the executable protocol; the contract file is the schema. If the two disagree, the contract wins — update this file to match, don't silently drift.

### Step 1: DETECT

1. Check for a cached runtime report at `.rune/runtimes.json`. If it exists and is from the current session (same date), reuse it — skip to Step 2.
2. Otherwise probe for the `1devtool-agent` bridge (the local CLI that fans prompts out to installed AI coding agents — Claude, Codex, Gemini, Antigravity, Cline, Amp, OpenCode, Qwen, Grok, Aider). Detection and family-mapping details: `references/dispatch-protocol.md` §Detect.
3. Write `.rune/runtimes.json`: `{ detected: [{runtime, status, model_family, version}], checked_at: <session marker>, bridge_path: <resolved path> }` — exact field list owned by `references/dispatch-protocol.md` §Detect, keep the two in sync.
4. No bridge found → `runtime_report.detected = []`. This is not an error — proceed straight to subagent-only mode (Step 3 DEGRADE).

### Step 2: ALLOCATE

1. Read `request.n` (2-5) and `request.diversity.prefer_model_families`.
2. Rank available runtimes by distinct `model_family` — prefer 1 voice per distinct family before doubling up on any family.
3. Reserve mandatory slots per the Voice Contract's correlated-agreement guards, scaled to `n`:
   - **`n >= 3`**: reserve both — **Perturbation slot** (inverted framing — argue the opposite starting position) and **Devil's-advocate slot** (mandated to argue AGAINST the majority as it forms; voices run independently/blind, so this is a *framing* instruction, not a sequencing one).
   - **`n == 2`**: reserve the Perturbation slot only, leave the second slot answering the question plainly. Reserving both at `n=2` would leave zero voices reading the question at face value, which starves ARBITRATE of a baseline reading to compare the perturbation against.
4. If falling back to subagents for some/all slots (Step 3), pin each subagent to a distinct persona/constraint using the `brainstorm` Design-It-Twice technique (each subagent pinned to exactly ONE stance — enforced via prompt template) — this does NOT create real decorrelation (same model family), but it reduces prose-verbatim groupthink, which matters for the correlated-agreement guards in Step 5.
5. Compose each voice's prompt as **fully self-contained** — external voices have zero conversation context. Include: the question, the mode, evidence requirements, and (for critique/review modes) the artifact or plan text inline. Never say "see above" or "as discussed."

### Step 3: DISPATCH + DEGRADE

For each allocated slot:

1. **External slot** (`source: external-cli`): dispatch per `references/dispatch-protocol.md` §Dispatch, with `budget.per_voice_timeout_s` enforced. On timeout or non-zero exit → mark `is_fallback: true` and immediately dispatch a subagent for that slot instead (do not drop the slot).
2. **Subagent slot** (`source: subagent`): dispatch via `Task` with the persona/constraint from Step 2.4 baked into the prompt. `runtime: "internal"`, `model_family: "anthropic"`, `is_fallback: false` if this was the slot's original allocation, `is_fallback: true` if it's covering a dead external slot.
3. Run all slots in parallel (single message, multiple tool calls) — sequential dispatch defeats the purpose of gathering independent perspectives at reasonable cost.
4. Record `latency_ms` per voice and populate `runtime_report.used` / `runtime_report.degraded_to_subagent`.

### Step 4: GATE

For each raw voice response, before it counts toward anything:

1. **Well-formed check**: does the response parse into the expected Voice shape (stance + claims, each claim with `text` and optionally `anchor`/`evidence`)? Malformed → `validity.well_formed: fail`, `dropped_by: "council.gate"`, add to `voices_dropped[]` with the raw-output reason. Do not attempt to salvage a malformed response by re-prompting mid-run — that's a retry loop the contract doesn't budget for.
2. **On-topic check (the Agy fix)**: extract what the voice *thinks* it answered into `question_echo`, compare against `request.question`. If the voice answered a different question than asked (common failure mode for wrapper CLIs that inject their own system framing) → `validity.on_topic: fail`, `dropped_by: "council.gate"`, drop it.
3. Every dropped voice MUST appear in `voices_dropped[]` with `{runtime, reason, dropped_by}` — no silent drops. A voice that fails gate is not "missing," it's "dropped for reason X" — the caller and any human reading the run file need to know a slot was spent and produced nothing usable.

### Step 5: NORMALIZE (claim-matching)

Determines whether two voices made "the same claim" — meaningless until defined, so apply this exact strategy, in order:

1. **Anchor match (deterministic, cheap)**: two claims match if they share the same `anchor` (`file:line`, `plan-step-id`, or `symbol`). No inference needed.
2. **Arbiter cluster (fallback for keyless claims)**: for claims without a matching anchor, group by semantic similarity — but a cluster is only a valid match if the grouped claims **share at least one `evidence.ref`**. Prose/wording similarity ALONE never establishes a match — two voices using similar phrasing because they were trained on similar data is exactly the correlation this primitive exists to detect and discount, not average away.
3. Record `matched_by: {method: "anchor"|"arbiter", model: <this council run's identity>}` on every match.
4. **Verification gate**: a claim's `evidence.verified` MUST be set by a `verified_by` that is NOT the voice that produced the claim (mechanical check — run the test/repro yourself, or have a different-family voice check it — never trust self-certification). Claims with `verified: unchecked` or self-certified `verified_by` do not count toward consensus, regardless of how many voices repeated them.
5. **Correlated-agreement penalty**: if 2+ voices' claim text is near-verbatim (same phrasing, same examples), treat this as a correlation signal — **regardless of what `model_family` label those voices carry.** Do NOT gate this check on "same family or unknown family" — `model_family` is itself an unverified, CLI-brand-based label (see Sharp Edges: "confirmed" family is not runtime-verified), so requiring the labels to already look correlated before checking for textual correlation defeats the one heuristic that could catch a family-label error behaviorally. Near-verbatim text from voices with DIFFERENT confirmed families is not proof of a mislabeling, but it is not free confirmation either — flag it in `agreement.dissent` as "near-verbatim across confirmed-distinct families — either genuine convergent reasoning or a sign the family labels don't reflect the actual backends" and do NOT let it anchor a `consensus_claims` entry on textual similarity alone (Step 5.2's anchor/shared-evidence.ref requirement still applies). Near-verbatim text from the same family or an unconfirmed wrapper is the stronger, unambiguous case — note it in `agreement.dissent` even if the claim itself is correct, so the caller doesn't over-weight it.

### Step 6: ARBITRATE (inline)

1. Apply the min-decorrelation gate (see HARD-GATE above): count distinct real `model_family` values among voices that passed GATE, **excluding both `is_fallback` voices AND voices with `model_family: "unknown"`** (unconfirmed wrapper-CLI backends — see `references/dispatch-protocol.md` §Detect; an unconfirmed wrapper is not evidence of a distinct architecture, it may be the same backend as another voice in the run). `< 2` → `decorrelation: NO_DECORRELATION`. `>= 2` → `decorrelation: MULTI_FAMILY`.
2. Build `agreement.consensus_claims`: clusters (from Step 5) with **>= 2 voices from >= 2 distinct, confirmed `model_family` (never `unknown`), all evidence `verified: true`**. Anything short of this bar is NOT consensus — label it `unverified agreement` and put it in `agreement.dissent` with that label, not in `consensus_claims`.
3. Build `agreement.dissent`: everything else — genuine disagreement, unverified agreement, single-voice claims, and the correlated-agreement-penalty notes from Step 5.5. Dissent is surfaced, NEVER averaged away or silently dropped in favor of a "majority view."
4. Check the perturbation slot (Step 2.3): did the claims that survive the inverted framing match the claims from the standard framing? Agreement that survives inversion is trustworthy; agreement that doesn't is flagged in dissent as "framing-sensitive."
5. Check the devil's-advocate slot (skip if `n == 2` — no such slot was reserved per Step 2.3): if it produced no substantive counter-claims after genuinely trying, note that in Strength Notes-equivalent (the forming majority held up under a mandated attack) — this is useful positive signal, not a wasted slot.
6. Set `needs_decision: true` if dissent contains a CRITICAL/HIGH-severity claim that no consensus resolves — the caller (adversary/review) should surface this to the user rather than silently picking a side.
7. Write `.rune/council/run-<request.id>.json` with the full `CouncilResult` (schema: `.rune/council-voice-contract.md`).
8. Emit `council.dispatched` at Step 3 start, `council.result` after Step 6 write completes.

## Output Format

```
## Council Result: [request.id]
- **Question**: [request.question]
- **Mode**: critique | generate | judge | review
- **Decorrelation**: MULTI_FAMILY | NO_DECORRELATION
- **Voices**: [voices_valid]/[voices_requested] valid ([N] dropped)
- **Runtime**: [detected families] → [used] (degraded: [N])

### Consensus (verified, cross-family)
- [claim] — voices: [ids], families: [list]

### Dissent
- [claim] — [voice id] — [reason: disagreement | unverified | correlated-penalty | framing-sensitive]

### Needs Decision
[If true: the specific unresolved CRITICAL/HIGH claim, framed for the caller to surface to the user]
```

## Returns

| Field | Type | Description |
|-------|------|-------------|
| `result` | CouncilResult (JSON) | Full structured result per Voice Contract v2 — see `.rune/council-voice-contract.md` |
| `decorrelation` | enum | `MULTI_FAMILY` \| `NO_DECORRELATION` — the honesty stamp, always present |
| `agreement.consensus_claims` | array | Only cross-family, verified claims — may be empty |
| `agreement.dissent` | array | Never empty if any voice disagreed or agreement was unverified/correlated |
| `voices_dropped` | array | Every gated-out voice with reason — never silent |
| `run_file` | path | `.rune/council/run-<id>.json` — full artifact for caller or Pro Cockpit |

## Constraints

1. MUST stamp `NO_DECORRELATION` and strip consensus language when < 2 distinct real model families answered — this is the HARD-GATE, not a suggestion
2. MUST NOT count prose/wording similarity alone as a claim match — anchor or shared evidence.ref only
3. MUST NOT accept self-certified verification — `verified_by` must differ from the producing voice
4. MUST record every dropped voice in `voices_dropped[]` with a reason — no silent drops
5. MUST run all allocated voices in parallel, not sequentially — the value is independence, not throughput, but sequential dispatch adds latency without adding independence
6. MUST NOT retry a malformed or off-topic voice mid-run — drop it via GATE and move on; retries reintroduce correlation with the prompt that just failed
7. MUST NOT dispatch an external CLI without going through `references/dispatch-protocol.md` safety properties (authorization, read-only sandbox, stdin-not-args, binary preflight)
8. MUST operate in JUDGMENT mode only (critique/review/judge) — `generate` mode is declared in the contract but deferred; if a caller requests `mode: generate`, respond with `NOT_IMPLEMENTED` rather than improvising artifact generation across voices

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Request Gate | Caller supplies a self-contained `PerspectiveRequest` (question, mode, n) | Cannot run — ask caller for a well-formed request |
| Runtime Gate | None — council works with zero external CLIs by design | N/A — subagent-only mode is a valid, first-class outcome |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Caller (or a future reader) treats `NO_DECORRELATION` output as consensus anyway | CRITICAL | HARD-GATE strips consensus wording at the source; Output Format always prints the decorrelation stamp first line |
| Wrapper CLI (Cline/Amp/OpenCode/Aider) misreported as a distinct model family when its backend is actually Claude | HIGH | `references/dispatch-protocol.md` family map defaults unconfirmed wrapper backends to `unknown` — excluded from distinct-family count until confirmed |
| Prose-similarity claims counted as consensus because arbiter clustering got lazy | CRITICAL | Step 5.2 hard requirement: shared `evidence.ref`, not text similarity, gates the arbiter-cluster match |
| Self-certified verification (voice grades its own claim) | CRITICAL | Step 5.4: `verified_by` must differ from producing voice, mechanically checked |
| Off-topic voice counted toward `n` because its answer merely looked substantive | HIGH | Step 4.2 `question_echo` vs `request.question` gate — the Agy fix — before anything downstream sees the voice |
| External CLI hangs past `per_voice_timeout_s`, stalling the whole run | MEDIUM | Step 3.1: timeout triggers immediate subagent fallback for that slot, not a wait-and-retry |
| Devil's-advocate/perturbation slots quietly reused as regular voices under time pressure | MEDIUM | Step 2.3 reserves them explicitly in ALLOCATE — Step 6.4/6.5 checks they were actually applied before arbitrating |
| Bundle/prompt interpolated into shell args for external dispatch | CRITICAL | `references/dispatch-protocol.md` inherits adversary's stdin-only transport — never inline `-p "<bundle>"` |
| Council invoked for every trivial decision, burning cost on low-stakes calls | MEDIUM | Triggers section: council is opt-in per caller (adversary high-risk gate, review blast-radius gate) — never auto-fires on every plan/diff |
| **"Confirmed" `model_family` is CLI-brand identity, not verified runtime-backend identity** — a user pointing 2+ "confirmed" CLIs (e.g. `claude` + `codex`, or an IDE CLI like `agy` with a model picker) at the same actual backend via BYOK/proxy/gateway override collapses the real distinct-family count without tripping the `is_fallback`/`unknown` exclusions. Found via a real council self-test dispatch (2026-07-11, grok + 2 subagent voices independently converged on this). | CRITICAL, currently UNCLOSED | Step 5.5's near-verbatim check now fires regardless of family label (previous version only fired for same-family/unknown, which this exact scenario bypassed). There is no mechanical way to verify a CLI's actual serving backend from user-space today — council cannot cryptographically close this gap, only flag the behavioral symptom. Documented here rather than falsely claimed solved. |
| GATE's `question_echo` on-topic check is self-reported by the same voice being graded — a shallow-but-parseable non-answer that echoes the question passes | MEDIUM | Partial: the arbiter reads the echoed question against the actual answer content at Step 6, not just the schema shape, so an echo with no substantive claims behind it still contributes little to consensus/dissent even if it technically passes GATE |

## Self-Validation

```
SELF-VALIDATION (run before emitting output):
- [ ] Decorrelation stamp computed from ACTUAL distinct model_family count, excluding is_fallback AND model_family:"unknown" (unconfirmed wrapper CLIs), not assumed
- [ ] Every voice that reached ARBITRATE passed GATE (on_topic: pass, well_formed: pass)
- [ ] Every dropped voice appears in voices_dropped[] with a reason
- [ ] Every consensus_claims entry has >=2 voices from >=2 distinct CONFIRMED families (never unknown), all verified:true
- [ ] No consensus_claims entry backed only by prose similarity (check matched_by.method)
- [ ] No claim's verified_by equals its producing voice id
- [ ] Perturbation slot dispatched with its reserved framing; devil's-advocate slot too (unless n==2, where only perturbation is reserved per Step 2.3)
- [ ] .rune/council/run-<id>.json written with full CouncilResult
IF ANY check fails → fix before reporting done. Do NOT defer to completion-gate.
```

## Done When

- All allocated voices dispatched in parallel (external where available, subagent fallback where not)
- Every voice gated (dropped or valid, never ambiguous)
- Claims normalized via anchor-first/arbiter-cluster-with-shared-evidence strategy
- Decorrelation honestly stamped (`MULTI_FAMILY` or `NO_DECORRELATION`)
- Consensus built only from cross-family, mechanically-verified claims; everything else in dissent
- `.rune/council/run-<id>.json` written
- `council.result` emitted
- Self-Validation checklist: all checks passed

## Cost Profile

~1500-4000 tokens input per voice (self-contained prompt, no shared conversation context) × N voices (2-5), plus ~500-1000 tokens for arbitration. External-CLI voices cost real wall-clock (subject to `per_voice_timeout_s`) but zero incremental Claude token cost. Sonnet model for the orchestrating pass (gate/normalize/arbitrate reasoning); dispatched voices use whatever model each runtime/subagent resolves to.

**Scope guardrail**: council gathers and arbitrates perspectives — it does not implement fixes, does not rewrite the artifact under discussion, and does not run in `generate` mode (deferred to Phase 2 cockpit work). If asked to produce code or a revised plan, hand the arbitrated findings back to the caller (`adversary`/`review`) to act on.
