# Eval Scenarios — `context-pack` skill

## Eval: E01 — happy-path good packet emits cleanly

### Prompt
Cook calls context-pack to hand off a feature: "Add device_id field to login flow." Decisions: track at login, optional field. Constraints: preserve backward compat, don't touch rate limits.

### Expected Reasoning
Agent emits a v2-format packet with all required sections (Task / Parent / Scope / Decisions / Constraints / Type Surface / Files Touched / Acceptance Criteria / Out of scope). Acceptance criteria use behavior verbs. Type Surface lists `LoginInput`, `AuthService.authenticate`, `Session`. Files Touched annotated with type names.

### Must Include
- `### Type Surface (durable)` section with at least 2 type entries
- `### Out of scope` section (even if "(none)")
- All ACs start with whitelisted behavior verbs
- Files Touched entries include `(TypeName, function)` annotations

### Must NOT
- Reference file:line (e.g., `login.ts:42`)
- Use shape verbs ("should be defined", "has property")
- Skip Out of scope section

### Category
happy-path

---

## Eval: E02 — file:line BLOCK violation caught

### Prompt
A draft packet contains: "Modify the function at `src/auth/login.ts:42` to handle the new field."

### Expected Reasoning
Agent runs the smell-test regex `\b\S+\.[a-z]{1,4}:\d+\b` and matches `login.ts:42`. BLOCK tier. Refuses to emit. Rewrites the prose to use type/function names: "Modify `AuthService.authenticate` to handle the new field."

### Must Include
- Smell-test BLOCK verdict surfaced
- Specific regex match cited
- Rewrite suggestion that uses behavioral language

### Must NOT
- Emit the packet with the file:line still present
- "Just this once" exception language

### Category
adversarial

---

## Eval: E03 — narrative path WARN handling

### Prompt
A draft packet contains a narrative paragraph: "The work is centered around `src/auth/`, particularly the login flow."

### Expected Reasoning
Agent matches narrative path regex (WARN tier). Surfaces the warning, asks: is this narrative the right section? If it belongs in `### Files Touched`, move it; if it stays in narrative, rewrite to a type/module name.

### Must Include
- WARN verdict (not BLOCK — narrative paths are softer)
- Suggestion to either move or rewrite
- No automatic emission until resolved

### Must NOT
- BLOCK on a WARN-tier match
- Auto-rewrite without surfacing

### Category
edge-case

---

## Eval: E04 — missing Out of scope section

### Prompt
A draft packet has all sections except Out of scope.

### Expected Reasoning
Agent recognizes mandatory section. Either prompts the parent for the out-of-scope list, OR explicitly emits `### Out of scope\n- (none)` if the parent confirms there's nothing to exclude. Never silently omits.

### Must Include
- Either an Out of scope section (potentially empty with explicit "(none)")
- OR a request back to parent for the exclusion list
- Reference to Phase 4.5 / `completion-gate` rejection rule

### Must NOT
- Emit the packet without Out of scope
- Auto-fill with assumed exclusions

### Category
adversarial

---

## Eval: E05 — Type Surface optional for short task

### Prompt
A simple bug fix handoff: "Fix typo in error message — '404 Note Found' → '404 Not Found'." Task body is ~80 tokens.

### Expected Reasoning
Agent recognizes that the task is below the 300-token threshold where Type Surface becomes mandatory. Emits a packet without Type Surface, but still includes Out of scope and behavioral ACs.

### Must Include
- Out of scope section (mandatory regardless of task size)
- AC with behavior verb (e.g., "Returns the corrected error message on 404")
- Note in packet header that Type Surface is omitted because task is below threshold

### Must NOT
- Force a Type Surface section for a one-line text fix
- Skip Out of scope (still mandatory)

### Category
edge-case

---

## Eval Coverage

| Category | Count | Status |
|---|---|---|
| happy-path | 1 | ✅ E01 |
| edge-case | 2 | ✅ E03, E05 |
| adversarial | 2 | ✅ E02, E04 |
| **Total** | **5** | **✅ above minimum (4)** |
