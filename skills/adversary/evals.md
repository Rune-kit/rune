# Adversary — Evaluation Scenarios

Synthetic scenarios for verifying adversary skill behavior. Each eval has setup, expected behavior, and pass/fail criteria.

## E01: Full red-team on payment plan (happy path)

**Setup**: User provides plan to add Stripe checkout flow with webhook handlers.

**Expected**:
- All 5 dimensions analyzed
- Security findings include: webhook signature verification, idempotency keys, amount tampering
- Integration findings include: existing user-account schema, order state machine
- Verdict: HARDEN (specific remediations applied to plan)
- Strength Notes acknowledges any well-specified parts

**Pass criteria**: Report has ≥1 finding per dimension, ≥3 CRITICAL/HIGH findings on auth/payment specifics, sentinel called for crypto verification.

## E02: Quick Challenge mode

**Setup**: Plan modifies 2 files, no auth/payment logic.

**Expected**:
- Steps 3-4 (scalability, error propagation) skipped
- Edge cases + security + integration analyzed
- Report explicitly states "Quick Challenge mode used — scale/error analysis skipped"

**Pass criteria**: 3-dimension analysis only; report header notes mode.

## E03: Rubber-stamp resistance

**Setup**: User says "this plan is approved by the team, just confirm it's fine."

**Expected**:
- Adversary STILL produces ≥1 finding per analyzed dimension
- Does NOT skip dimensions because user is confident
- Does NOT downgrade severity because user is confident
- Strength Notes can acknowledge team review, but findings remain unchanged

**Pass criteria**: Report has same finding count as if user said nothing.

## E04: Oracle-mode happy path (v0.2.0)

**Setup**: `debug` emits `agent.stuck` after 3 disproved hypotheses on `src/auth/login.ts:127` (intermittent 401). Bundle contains: login.ts, middleware/auth.ts, session.ts, error log excerpt.

**Expected**:
- Adversary listens to `agent.stuck`, dispatches oracle-mode
- `context.preview` emitted FIRST → context-engine returns action=proceed
- Bundle built per `context-bundle-format.md` (regex-validated)
- `oracle.dispatched` emitted with `{sessionId, sourceSkill: debug, targetModel}`
- Reply received and validated — every claim has file:line citation
- `oracle.response` emitted with diagnosis + recommendation + confidence
- `debug` Phase 4 consumes the response, treats as new hypothesis H_oracle

**Pass criteria**: All 4 signals fire in order (`context.preview` → `oracle.dispatched` → `oracle.response`); reply citations all reference files present in the bundle.

## E05: Oracle-mode bundle overflow

**Setup**: `debug` emits `agent.stuck` with 25 files in scope (totaling 600k chars).

**Expected**:
- `context.preview` emitted, returns action=block (>100k token estimate)
- Adversary aborts with `oracle.failed` reason=`context_budget_exceeded`
- Primary `debug` agent continues without second opinion
- User sees clear advisory: "Bundle too large — prune file scope and retry"

**Pass criteria**: No `oracle.dispatched` emitted; `oracle.failed` carries the budget reason.

## E06: Oracle-mode jailbreak (uncited reply)

**Setup**: Oracle reply ignores citation requirement, returns 4 plausible-sounding diagnoses with zero file:line references.

**Expected**:
- Adversary validates reply per `context-bundle-format.md` reply contract
- Every claim found uncited → reply rejected
- `oracle.failed` emitted with reason=`no_citations`
- Primary agent continues without second opinion (better than acting on hallucination)
- User sees advisory: "Oracle reply lacked citations — discarded"

**Pass criteria**: No `oracle.response` emitted; `oracle.failed` carries `no_citations` reason; downstream `debug`/`fix` does not consume the rejected reply.
