# Claim Discipline

The gate catches a false claim *after* the work is done, by demanding evidence for it. Claim
discipline stops the false claim from being written in the first place, by fixing the
grammar a statement is allowed to wear.

**The rule: hallucination is an unverified claim wearing the grammar of an observation.**
The grammar is the tell — and it is visible in the sentence itself, before any gate runs.

## The four claim types

Type every load-bearing statement — the ones that, if wrong, collapse the answer. Ignore
the rest; typing everything uniformly wastes the budget on trivia.

| Type | Meaning | Allowed grammar |
|------|---------|-----------------|
| **OBSERVED** | You saw it *this session*: ran it, read it, measured it | "X is / does / returns …" |
| **DERIVED** | Follows from OBSERVED facts through a mechanism you can state | "X should / will / implies …" — plus the why |
| **PRIOR** | Training knowledge; may be stale | "X is typically … / was, as of …" — verify if load-bearing |
| **ASSUMED** | Unverified and required by the conclusion | "I am assuming X — if wrong, then …" |

## Rules

1. **Promotion happens by tool, never by restatement.** Checking a PRIOR makes it OBSERVED.
   Saying it again more confidently does not. Confidence that rose from effort, repetition,
   or fluent prose resets to the last evidence-backed level.
2. **Downgrade honestly.** When the environment changes, an earlier OBSERVED becomes PRIOR —
   a test that passed before an edit is not evidence about the code after it.
3. **Version-sensitive claims are PRIOR until checked.** APIs, flags, defaults, prices,
   model names, package versions. These decay silently.
4. **"I don't know", followed by what would settle it, is a first-class answer.** An
   answer-shaped non-answer is worse than an honest gap.
5. **A claim about your own output is not OBSERVED until it is checked against the exact
   delivered text.** Re-reading your own work and agreeing with yourself is the weakest
   possible evidence: it always passes.

## How this pairs with the gate

| | Claim discipline | The gate (Steps 1–3) |
|---|---|---|
| When | While writing the claim | After the work, before merge |
| Mechanism | Grammar must match evidence level | Claim must match an evidence artifact |
| Catches | Confident phrasing of an unverified thing | A claim with no artifact behind it at all |

They are the same discipline at two moments. A claim typed honestly in the first place
usually arrives at the gate already carrying its evidence; a claim that had to be softened
to stay honest ("I am assuming the migration ran") is one the gate can then chase.

**Gate consequence:** a claim delivered as ASSUMED or PRIOR is not a gate failure — it is
the correct output when the check was not run. A claim delivered as OBSERVED with no
artifact is a FAIL. Do not let a hedge be treated as the same defect as a lie.

## Interaction with output styles

Output styles (`context-engine` → `references/output-modes.md`) compress prose. They must
never compress a claim into a stronger grammar than its evidence supports — deleting
"I am assuming" to save four tokens manufactures confidence. Calibration outranks brevity;
that precedence is stated in `output-modes.md` and enforced here.
