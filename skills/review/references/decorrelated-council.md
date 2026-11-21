# review — Decorrelated bug-finding (council)

> Reference for `skills/review/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 1.6: Decorrelated Bug-Finding (council, high-blast-radius only)

review's own pass is one model reading the diff once. For the same 50+ caller / HIGH-severity
symbols that trigger the Step 1.5 HARD-GATE, call `rune:council` (mode=review) on the diff
itself BEFORE writing up Step 2's findings — a second architecture reading the same code
independently catches bugs a single pass rationalizes past.

This is complementary to (not a replacement for) the existing adversary escalation: council
here examines the ALREADY-WRITTEN diff for bugs; adversary examines plan-level risk before
code exists. Both can fire on the same high-blast-radius change.

**Request**: `{ question: <the diff, symbol name, and blast radius context — self-contained>,
mode: "review", n: 3, diversity: { prefer_model_families: true },
evidence_required: [repro, reasoning] }`.

**Consume**: fold `agreement.consensus_claims` into Step 2's CRITICAL/HIGH findings, tagged
`[council-verified]`. Fold `agreement.dissent` into MEDIUM findings or the report's NEEDS
DISCUSSION section, tagged `[council-dissent]`. If `decorrelation: NO_DECORRELATION`, do not
claim independent confirmation in the report — say plainly that no second model family was
reachable.

**Skip if**: blast radius is under 50 callers, or the change is not HIGH-severity — council is
opt-in overhead reserved for the same tier that already requires adversarial escalation, not a
default tax on every review.
