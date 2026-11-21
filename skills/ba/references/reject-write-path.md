# ba — Mid-elicitation reject write path

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 1.6 — Mid-Elicitation Reject WRITE Path

If the user **explicitly rejects** the feature at any point during elicitation (Steps 2-3) — common phrases: "scrap it", "actually nah, don't build this", "we won't do this", "kill the feature", "drop it" — STOP elicitation and **write a `.out-of-scope/<slug>.md` record** before ending the session.

Without this WRITE path, oral rejections vanish — the next session re-asks the same questions and the user has to re-reject. Step 1.5 (READ) only catches matches against existing files; Step 1.6 (WRITE) is what produces those files in the first place.

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

**Procedure**:

1. **Confirm rejection is durable, not deferral**. Ask one clarifier:
   > "Just to record this correctly: is this **out of scope** (project doesn't want this), or **deferred** (not now but maybe later)? Out-of-scope gets recorded so we don't re-litigate; deferred goes to backlog instead."

   - If **deferred** → route to backlog (no `.out-of-scope/` write), end session with a one-line note
   - If **out-of-scope** → continue to step 2

2. **Capture the durable reason**. Ask:
   > "What's the reason this is out of scope? (project scope, technical constraint, strategic decision — not a temporary circumstance)"

   If the user gives a temporary reason ("we're busy"), reframe: "That's a deferral — should I route to backlog instead?"

3. **Generate slug** (kebab-case, ≤40 chars, recognizable without opening the file).

4. **Lexical-similarity check**: `Glob` `.out-of-scope/*.md`, parse each frontmatter's `concept` + `aliases`, compute overlap. If any existing concept has ≥0.7 overlap → APPEND to that file's `prior_requests` list and mark `rejected_by: ba` for this round. Do NOT create a duplicate.

5. **Write the file** using the format in [`references/out-of-scope-format.md`](out-of-scope-format.md):
   - YAML frontmatter (`concept`, `aliases`, `decision: rejected`, `rejected_at`, `rejected_by: ba`, `prior_requests`, optional `revisit_if`)
   - Markdown body: concept name, "Why out of scope" (substantive reasoning from step 2), "What would change our mind" (if user volunteered signals)

6. **Emit `outofscope.recorded`** signal carrying `{slug, rejected_by: ba, prior_requests_count}` so downstream skills know a new rejection landed.

7. **End BA session** with one-line summary:
   > "Recorded as out of scope in `.out-of-scope/<slug>.md`. Future similar requests will surface this. Override anytime by editing the file."

**When NOT to write**:

- User merely defers ("not now") → backlog, not `.out-of-scope/`
- User rejects a single requirement within a larger feature → adjust requirements doc Boundaries section, don't write a whole rejection file (the feature is still in scope)
- Bug rejections (already fixed, not reproducible) → not BA's job; route to incident or close the issue
- The match was already exact (≥0.8) and Step 1.5 surfaced it — user accepting the prior rejection just appends to `prior_requests` of the existing file (handled in Step 1.5 path)
