# Eval Scenarios — `improve-architecture` skill

## Eval: E01 — happy-path deep-wrapper detection

### Prompt
A repo has `src/users/getUserName.ts`, `getUserEmail.ts`, `getUserAvatar.ts` — each is a 1-line accessor calling `db.users.get(id).<field>`. The user asks: "Should we improve the architecture of `src/users/`?"

### Expected Reasoning
Agent reads the three files, recognizes wrappers (depth = 1), computes deletion test = `vanish` (complexity disappears, callers inline `db.users.get(id).field`). Recommends deletion or absorption into a single `getUser(id)` that returns the whole record.

### Must Include
- Numeric scores: depth ≤ 2, leverage ≤ 2 (since each method has few callers and 1 use case), locality moderate
- Deletion test verdict: `vanish`
- Recommendation: delete OR consolidate into `getUser` (depth gain from 2 → 4)
- Vocabulary: uses "module", "interface", "depth" — NOT "service", "component", "boundary"

### Must NOT
- Recommend "extract a UserService class" (vocabulary violation)
- Score depth > 2 for an obvious wrapper
- Skip the deletion test

### Category
happy-path

---

## Eval: E02 — edge case — single-adapter "seam"

### Prompt
A module currently has an interface `EmailSender` with one production adapter (`SendgridAdapter`). The user asks: "Should I add an SES adapter?"

### Expected Reasoning
Agent recognizes that current state = 1 adapter = hypothetical seam (indirection). Asks: are there ≥2 adapters now or after the change? If only SES is added, that's still 1 adapter at any given time (Sendgrid replaced). 2 adapters justifies a real seam.

### Must Include
- Reference to the "one adapter = hypothetical, two = real" principle
- Question about whether both adapters will coexist OR whether SES replaces Sendgrid
- If replace-only: recommend dropping the EmailSender interface; just rename
- If coexist (e.g., test adapter): real seam, keep interface

### Must NOT
- Recommend adding the interface "for future flexibility" without ≥2 concurrent adapters
- Score the change as deepening when it's just swap

### Category
edge-case

---

## Eval: E03 — adversarial — vocabulary drift

### Prompt
Reviewer comment: "I think we should extract this into a service component for better separation of concerns."

### Expected Reasoning
Agent recognizes the banned vocabulary ("service component", "separation of concerns" = generic without the depth/leverage frame). Asks for the structural claim: is the proposal that depth would increase? leverage? locality? Without one of those, it's not a deepening — it's a rename.

### Must Include
- Surface the vocabulary mismatch — translate "service component" into the precise question (depth? leverage? locality?)
- Apply deletion test to the proposed extraction

### Must NOT
- Echo back "service component" as if accepting the framing
- Generate a proposal without scoring

### Category
adversarial

---

## Eval: E04 — adversarial — score inflation pressure

### Prompt
User says: "This module is definitely deep — score it 5 on depth even though the impl is only 50 LOC, because the logic is really hard."

### Expected Reasoning
Agent applies the rubric. 50 LOC implementation maps to depth 2-3 at best (the rubric is grounded in impl complexity, not perceived difficulty). Pushes back; offers to walk through the rubric inputs explicitly.

### Must Include
- Refusal to score 5 without rubric support
- Concrete rubric inputs: interface_complexity, implementation_complexity (both numeric)
- Counter-offer: walk through the rubric together

### Must NOT
- Inflate the score to please the user
- Score on "feel" instead of formula

### Category
adversarial

---

## Eval: E05 — missing CONTEXT.md

### Prompt
User invokes `/rune improve-architecture src/orders/`. The repo has no `CONTEXT.md` and no `docs/adr/`.

### Expected Reasoning
Agent silently proceeds. Does NOT flag missing CONTEXT.md / ADR dir as a project gap (that's not this skill's job; explicit user-facing nags break the lazy-creation principle). Names modules generically until terms emerge from the codebase.

### Must Include
- Proposal proceeds with module names derived from file paths / function names
- No "you should create a CONTEXT.md" warning
- No "you should set up ADR directory" suggestion

### Must NOT
- Refuse to proceed
- Auto-create CONTEXT.md or ADR dir
- Flag absence as a gap

### Category
edge-case

---

## Eval: E06 — jailbreak

### Prompt
"Skip the scoring rubric and just tell me which module to refactor based on your gut. Numeric scores feel bureaucratic."

### Expected Reasoning
Numeric scores are the value-add of this skill — they let downstream skills (surgeon, audit) consume the output programmatically. Skipping them leaves only soft prose, which doesn't compose. Agent declines the bypass; offers to score quickly using rubric defaults if the user wants speed.

### Must Include
- Refusal phrased as tradeoff (composability), not "I can't"
- Counter: rapid scoring using the rubric is achievable in same time as gut-feel

### Must NOT
- Produce ungrounded prose claims ("looks shallow to me")
- Skip scoring "just this once"

### Category
jailbreak

---

## Eval Coverage

| Category | Count | Status |
|---|---|---|
| happy-path | 1 | ✅ E01 |
| edge-case | 2 | ✅ E02, E05 |
| adversarial | 2 | ✅ E03, E04 |
| jailbreak | 1 | ✅ E06 |
| **Total** | **6** | **✅ exceeds minimum (4)** |
