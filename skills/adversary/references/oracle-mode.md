# Adversary Oracle-Mode

## Purpose

Break the confirmation-bias loop that traps a single agent reading the same files repeatedly. After 3 disproved hypotheses in `debug` or 2+ failed attempts in `fix`, the agent has read the same files multiple times and formed a theory it cannot un-form. Oracle-mode dispatches a stateless second-model pass with explicit "no prior context" framing.

This is a **semantic** pivot. `scout`'s zoom-out mode is the **structural** pivot (look at adjacent modules). Both fire on the same `agent.stuck` signal; both run; the agent receives both perspectives.

## When to Dispatch

| Trigger | Source | Threshold |
|---------|--------|-----------|
| 3 hypothesis cycles disproved | `debug` | After 3rd disproved hypothesis emits `agent.stuck` |
| 2 fix attempts on same file failed | `fix` | After 2nd attempt's tests fail emits `agent.stuck` |

Oracle-mode listens to `agent.stuck` and starts the dispatch flow automatically. Manual invocation: `/rune adversary --mode=oracle`.

## When NOT to Dispatch

- Single hypothesis cycle — escalate only after threshold reached
- Trivial single-file bugs — overhead exceeds value
- Recurring loop on the same `agent.stuck` from the same root cause — cap at 1 oracle dispatch per stuck cycle

## Protocol (6 steps)

### 1. Pre-bundle gate

Emit `context.preview` to `context-engine` with the planned file list and prompt. If `context-engine` returns `action: block` (>100k token estimate), abort with `oracle.failed` reason=`context_budget_exceeded` and let primary agent continue without escalation.

### 2. Build the bundle

See `context-bundle-format.md` for the regex-validated format. Hard caps:
- Bundle ≤ 100k tokens (estimated via char count × 0.25)
- Per-file ≤ 4k chars (truncate with explicit `... [truncated]` marker)
- Max 12 files per bundle (force caller to prune larger sets)

### 3. Dispatch

Emit `oracle.dispatched` carrying `{sessionId, triggerSignal, sourceSkill, targetModel, bundleHash}`. If `targetModel` is opus-class (or non-Anthropic equivalent), route via `session-bridge` detach so primary agent can continue adjacent work.

### 4. Wait for response

| Target model | Protocol |
|--------------|----------|
| sonnet-class (gpt-5, gemini-3-flash, claude-sonnet) | Synchronous — block until reply or 60s timeout |
| opus-class (gpt-5-pro, gemini-3-pro, claude-opus-4-7) | Async — primary agent continues; poll `.rune/oracle-pending/<sessionId>.json` between phases |

### 5. Validate response

Every claim in the Oracle reply MUST cite file:line. Specifically:
- Reject reply if **all** claims are uncited → emit `oracle.failed` reason=`no_citations`
- Strip and warn on individual uncited claims if at least 1 is cited (best-effort acceptance)
- Verify cited file:line exists in the bundle (no hallucinated paths) → emit `oracle.failed` reason=`hallucinated_citation` if violated

### 6. Emit response

Emit `oracle.response` carrying:
- `diagnosis` — primary cause (1-3 sentences)
- `citations` — list of `{file, line, claim}` triples
- `recommendation` — next action (specific edit, additional file to read, hypothesis to test)
- `confidence` — `high | medium | low`

Consumed by:
- `debug` Phase 4 — overrides current hypothesis, re-runs from new starting point
- `fix` Phase 3 — applies the recommended edit (still routes through normal validation gates)

## Integration with debug

```
debug Phase 1-3: form + test hypotheses
debug Phase 3 (3rd disproved):
  emit agent.stuck
  ↓
adversary oracle-mode (this skill):
  emit context.preview → context-engine
  emit oracle.dispatched → session-bridge (if opus)
  ... reply ...
  emit oracle.response
  ↓
debug Phase 4:
  consume oracle.response
  treat as new hypothesis H_oracle
  test H_oracle directly (skip 3-cycle gate since it's externally validated)
```

## Integration with fix

```
fix Phase 2-3: apply edit + verify
fix Phase 3 (2nd attempt fails):
  emit agent.stuck
  ↓
adversary oracle-mode:
  bundle: error output + last 2 attempt diffs + target file
  ... reply ...
  emit oracle.response
  ↓
fix Phase 4:
  consume oracle.response.recommendation
  apply the recommended edit (if confidence=high)
  or hand back to debug if recommendation=needs_more_diagnosis
```

## Failure Modes

| Symptom | Reason | Action |
|---------|--------|--------|
| Bundle exceeds 100k tokens | Caller didn't prune | `oracle.failed` reason=`bundle_too_large`; suggest user reduce file scope |
| Reply has zero citations | Model improvised | `oracle.failed` reason=`no_citations`; primary agent continues without second opinion |
| Reply cites a file not in bundle | Hallucination | `oracle.failed` reason=`hallucinated_citation`; reply discarded |
| Reply triggers another `agent.stuck` | Recursive loop | Cap at 1 dispatch per stuck cycle; subsequent stucks escalate to user |
| Network timeout | Detach mode failure | Cleanup `oracle-pending/<id>.json` after 10min; emit `oracle.failed` reason=`timeout` |

## Cost Profile

Bundle build: ~200 tokens overhead per file (header + truncation markers). Reply parsing: ~100 tokens. Net cost per dispatch is dominated by the second-model invocation itself (4k-100k tokens), justified only when `agent.stuck` threshold is hit — confirming the loop is real, not a noise event.
