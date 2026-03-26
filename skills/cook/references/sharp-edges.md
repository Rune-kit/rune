# Sharp Edges — Known Failure Modes

Check these before declaring done. These are the most common ways cook goes wrong.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Skipping scout to "save time" on a simple task | CRITICAL | Scout Gate blocks this — Phase 1 is mandatory regardless of perceived simplicity |
| Writing code without user-approved plan | HIGH | Plan Gate: do NOT proceed to Phase 3 without explicit approval ("go", "proceed", "yes") |
| Claiming "all tests pass" without showing output | HIGH | Constraint 7 blocks this — show actual test runner output via completion-gate |
| Entering debug↔fix loop more than 3 times without escalating | MEDIUM | After 3 loops → re-plan → if still blocked → Approach Pivot Gate → brainstorm(rescue) |
| Surrendering "no solution" without triggering Approach Pivot Gate | CRITICAL | MUST invoke brainstorm(rescue) before telling user "can't be done" — pivot to different category first |
| Re-planning with the same approach category after it fundamentally failed | HIGH | Re-plan = revise steps within same approach. If CATEGORY is wrong → Approach Pivot Gate, not re-plan |
| Not escalating to sentinel:opus on security-sensitive tasks | MEDIUM | Auth, crypto, payment code → sentinel must run at opus, not sonnet |
| Running Phase 5 checks sequentially instead of parallel | MEDIUM | Launch preflight+sentinel+review as parallel Task agents for speed |
| Saying "done" without evidence trail | CRITICAL | completion-gate validates claims — UNCONFIRMED = BLOCK |
| Analysis paralysis — 5+ reads without writing | HIGH | Analysis Paralysis Guard: act on incomplete info or report BLOCKED with specific missing piece |
| Fast mode on security-relevant code | HIGH | Fast mode auto-excludes auth/crypto/payments — never fast-track security code |
| Loading all phase files at once into context | HIGH | Phase File Gate: load ONLY the active phase file — one phase per session |
| Resuming without checking master plan | MEDIUM | Phase 0 (RESUME CHECK) runs before Phase 1 — detects existing plans |
| Treating user "stop"/"cancel" as scope change | CRITICAL | Mid-Run Signal Detection: Cancel/Pause are safety signals with absolute priority — never reinterpret as Steer or NewTask |
| Same tool+args+result called 3+ times without progress | HIGH | Hash-Based Loop Detection: 3x warn, 5x force stop. Only same-input-AND-same-output counts |
| Ignoring mid-run user messages during autonomous execution | HIGH | Two-stage intent classification: keyword fast-path for simple signals, context for longer. Never queue messages. |
| Breaking change shipped without RFC review | CRITICAL | Phase 2.5 RFC Gate: any breaking change MUST have RFC artifact + user approval before implementation |
| Runaway fix loop — fix introduces more bugs than it resolves | HIGH | fix v0.5.0 WTF-likelihood self-regulation: >20% decay = STOP. Hard cap 30 fixes/session via MAX_FIXES exit condition |
