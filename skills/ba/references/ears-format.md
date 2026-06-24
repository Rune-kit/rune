# EARS — Easy Approach to Requirements Syntax

EARS (Mavin et al., Rolls-Royce) constrains a functional requirement to one of a
few sentence templates. The constraint is the value: every requirement becomes a
single, atomic, testable "shall" statement with an explicit trigger or condition —
which kills the two classic requirement defects, **ambiguity** and **compound scope**.

EARS sits **between** user stories and acceptance criteria:

```
User Story  (WHY)   →  EARS Functional Requirement  (WHAT the system shall do)  →  Acceptance Criterion  (HOW we prove it)
As a user, I want…  →  When X, the system shall Y.                              →  GIVEN … WHEN … THEN …
```

A user story is intent. An AC is a test. EARS is the contract in between — the
precise behavior the test verifies. Skipping it lets vague stories ("make login
smooth") flow straight into vague tests.

## The 5 Templates (+ 1 combined)

Give each requirement a stable ID (`FR-1`, `FR-2`, …). Pick the **simplest**
template that fits — escalate only when the behavior genuinely needs it.

| # | Type | Template | Use when |
|---|------|----------|----------|
| 1 | **Ubiquitous** | The `<system>` shall `<response>`. | Always-active behavior, no trigger or precondition. |
| 2 | **Event-driven** | When `<trigger>`, the `<system>` shall `<response>`. | A discrete event/input causes the behavior. |
| 3 | **State-driven** | While `<state>`, the `<system>` shall `<response>`. | Behavior holds for the duration of a state. |
| 4 | **Optional** | Where `<feature is included>`, the `<system>` shall `<response>`. | Behavior exists only when an optional feature/config is present. |
| 5 | **Unwanted** | If `<unwanted condition>`, then the `<system>` shall `<response>`. | Error handling, failure modes, abuse, invalid input. |
| 6 | **Complex** | While `<state>`, when `<trigger>`, the `<system>` shall `<response>`. | A trigger handled differently depending on state. |

### Examples (good)

```
FR-1  (ubiquitous)   The API shall return responses in JSON.
FR-2  (event-driven) When a request omits a valid auth token, the API shall respond with HTTP 401.
FR-3  (state-driven) While the account is in maintenance mode, the system shall reject all write operations.
FR-4  (optional)     Where rate limiting is enabled, the API shall reject the 101st request per minute with HTTP 429.
FR-5  (unwanted)     If the payment provider times out, then the system shall mark the order pending and queue a retry.
FR-6  (complex)      While a checkout is in progress, when the cart total changes, the system shall recompute tax before payment.
```

## Rules for a well-formed EARS requirement

1. **Named subject, never "it".** The `<system>` is a concrete component ("the
   API", "the scheduler", "the login form") — not a pronoun.
2. **One shall per requirement.** Two behaviors → two `FR-n`. Compound "shall do A
   and B" hides one of them from testing.
3. **Testable response.** "shall respond with HTTP 401" is testable; "shall handle
   it gracefully" / "shall be fast" is not. Move measurable limits into the response
   ("within 200 ms", "with HTTP 429"). Pure performance targets stay in NFRs (Step 6).
4. **Trigger/condition is observable.** "When the user clicks Submit" — yes. "When
   appropriate" — no.
5. **Active voice.** "the system shall reject…" not "requests are rejected".
6. **Don't smuggle HOW.** EARS captures observable behavior, not implementation
   ("…shall store the token in Redis" → leave Redis to plan; say "…shall persist the
   session token").

## Anti-patterns

| Smell | Why it fails | Fix |
|-------|--------------|-----|
| "The system shall be user-friendly." | Not testable, no trigger. | Reframe as a concrete event/response, or move to NFR/UX. |
| "When X, the system shall do A and B and C." | Compound — partial passes hide. | Split into 3 EARS requirements. |
| "It shall validate input." | "It" is ambiguous; "validate" is vague. | "If a field fails validation, then the form shall display the field-level error." |
| Every requirement is Ubiquitous. | Triggers/states were dropped → context lost. | Most real requirements are event- or unwanted-behavior. Look for the trigger. |
| EARS restates the user story verbatim. | No added precision. | The story is WHY; the EARS line is the specific observable behavior. |

## Traceability (feeds Step 3.6 Logic Consistency)

EARS is only worth the ceremony if it chains:

- Every `FR-n` traces **up** to at least one User Story (it exists for a reason).
- Every `FR-n` traces **down** to at least one Acceptance Criterion (it gets proven).
- Every **unwanted-behavior** requirement (`If …`) should map to an error-path AC —
  this is where EARS earns its keep, by forcing failure modes to be named, not assumed.

An `FR-n` with no AC is an untested promise. An AC with no `FR-n` is a test for a
behavior nobody specified. Both are consistency failures.

## When to keep it light

- **Bug fix / Refactor** → skip EARS entirely (no new behavior to specify).
- **Plumbing / Integration** → a handful of event-driven + unwanted-behavior lines is
  usually enough; don't manufacture ubiquitous requirements to pad the list.
- **Small feature** → 3–7 requirements is typical. If you have 30, the feature is an
  epic — hand the split to `plan`.

EARS is a **format recommendation**, not a gate. The goal is precision per
requirement, not requirement count.
