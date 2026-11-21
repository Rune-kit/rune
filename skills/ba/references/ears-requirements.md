# ba — Functional requirements (EARS)

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 4.5 — Functional Requirements (EARS)
<MUST-READ path="references/ears-format.md" trigger="when writing the functional-requirements section for a Feature/Integration/Greenfield requirement"/>

Translate each in-scope item (Step 4) into atomic, testable **functional requirements** using EARS (Easy Approach to Requirements Syntax). EARS sits between user stories (WHY) and acceptance criteria (HOW we prove it) — it names exactly WHAT the system shall do, with an explicit trigger or condition.

Pick the simplest EARS template that fits each behavior; give each a stable ID (`FR-1`, `FR-2`, …):

| Type | Template |
|------|----------|
| Ubiquitous | The `<system>` shall `<response>`. |
| Event-driven | When `<trigger>`, the `<system>` shall `<response>`. |
| State-driven | While `<state>`, the `<system>` shall `<response>`. |
| Optional | Where `<feature is included>`, the `<system>` shall `<response>`. |
| Unwanted | If `<unwanted condition>`, then the `<system>` shall `<response>`. |
| Complex | While `<state>`, when `<trigger>`, the `<system>` shall `<response>`. |

```
FR-1  The API shall return responses in JSON.
FR-2  When a request omits a valid auth token, the API shall respond with HTTP 401.
FR-3  If the payment provider times out, then the system shall mark the order pending and queue a retry.
```

Rules (full guidance in [references/ears-format.md](ears-format.md)):
- **One `shall` per requirement** — compound "shall do A and B" splits into two `FR-n`.
- **Named subject, testable response** — never "it shall handle gracefully". Move measurable limits into the response; pure performance targets stay in NFRs (Step 6).
- **Don't smuggle HOW** — observable behavior only; leave implementation to `plan`.
- Every `FR-n` traces up to a User Story and down to an Acceptance Criterion (checked in Step 3.6).

**Skip EARS** for Bug Fix and Refactor types (no new behavior to specify). For plumbing/integration, a few event-driven + unwanted-behavior lines suffice — don't pad with ubiquitous filler. EARS is a format recommendation, not a gate.
