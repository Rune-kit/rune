# Synthesis Mode (Chat → Requirements Without Re-Interview)

When the conversation already contains rich context — user described the feature in detail, pasted a spec, or worked through requirements iteratively — running the 5 Questions again wastes attention and breaks rapport. Synthesis mode extracts the Requirements Document from existing context, then **confirms** rather than re-interviewing.

> Re-asking what the user already told you is the second-most expensive bug after wrong requirements. The first is wrong requirements shipped correctly.

## When to use synthesis (skip the 5 Questions)

Trigger synthesis instead of elicitation if ANY of:

| Signal | Threshold |
|--------|-----------|
| User pasted a spec / PRD / brief | Any document > 200 words describing the feature |
| Conversation has > 1000 words discussing this feature | Sufficient context already gathered |
| User said "I already explained — just write the spec" / "synthesize" / "build the requirements" | Explicit synthesis request |
| Session is a continuation — prior session captured most answers in `.rune/features/<name>/requirements.md` | Re-elicitation would duplicate |
| Issue tracker / external ticket has filled-in template (problem, user story, acceptance criteria) | Source already structured |

If NONE match → fall back to standard elicitation (Step 2 — 5 Questions).

## Synthesis workflow

### Step S1 — Sweep context

Pull from in this order:
1. The current conversation (every message from user, in order)
2. Pasted documents (spec, PRD, ticket body)
3. `.rune/features/<feature>/requirements.md` if continuation
4. Codebase signals (only if needed for inference — `package.json`, `README.md`)

### Step S2 — Extract answers to the 5 dimensions

Map existing context onto the same 5 dimensions used in elicitation:

| Dimension | Where to look |
|-----------|---------------|
| **WHO** (user, technical level, surrounding workflow) | "users who...", personas, role mentions |
| **WHAT** (specific outcome, definition of done) | Acceptance criteria, "should", "must", success metrics |
| **WHY** (problem, consequence of not building) | "because", "to avoid", problem statement, motivation |
| **BOUNDARIES** (out of scope) | "not", "won't", "later", "v2", "future" |
| **CONSTRAINTS** (tech, perf, security, deadline) | Tech stack mentions, perf targets, deadlines, integrations |

For each dimension, mark **filled** | **partial** | **gap**.

### Step S3 — Identify ONLY the gaps

If all 5 dimensions are **filled** or **partial-but-acceptable** → skip directly to Step S4. No questions.

If 1-2 dimensions are **gap** → ask ONLY those questions, single round, multiple-choice format. Never ask all 5 over again.

If 3+ dimensions are **gap** → synthesis context wasn't actually rich; fall back to standard elicitation (Step 2).

### Step S4 — Draft Requirements Document

Use the standard Requirements Document format (same as elicitation output). For every dimension, cite the source:

```markdown
### Who
[Synthesized statement]

> _Source: user message at [timestamp/turn], "..."_
```

Citations are mandatory in synthesis mode — they let the user verify nothing was misread or invented.

### Step S5 — Confirm, don't re-elicit

Present the Requirements Document with this exact framing:

> "I synthesized requirements from our conversation. **Read each section** — if anything is wrong or missing, tell me which line. If it's correct, say 'go' and I'll lock it for plan."

Wait for explicit confirmation. Do NOT auto-proceed to plan handoff.

User responses:
- `"go"` / `"locked"` / `"correct"` → emit Requirements Document, hand off to plan
- `"section X is wrong"` → revise that section only, re-confirm
- `"add Y"` / `"actually..."` → treat as additional gap; ask multiple-choice if specific, otherwise add to Open Questions

## Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Running 5 Questions after user pasted a 500-word spec | Burns trust — user already gave you the answers |
| Synthesizing without citations | User can't verify; one misread becomes a downstream bug |
| Auto-proceeding to plan after synthesis without confirmation | Synthesis is interpretation, not transcription. Confirmation prevents drift. |
| Asking all 5 questions even when 4 dimensions are filled | Defeats the purpose. Ask 1, not 5. |
| Treating "looks fine" as confirmation | Need explicit "go" or "locked" — vague approval = ambiguous handoff |

## Integration with Step 1 (Intake & Classify)

After classifying requirement type, branch:

```
Feature Request | Greenfield | Integration:
  → Check synthesis triggers
    → All filled (S2): synthesize + confirm (S4-S5)
    → Partial (1-2 gaps): synthesize + targeted questions (S3-S5)
    → Mostly empty (3+ gaps): fall back to standard elicitation (Step 2)
Bug Fix:
  → Skip BA entirely
Refactor:
  → Light BA (synthesis usually fits)
```

Synthesis mode is **opt-in via context detection**, not via user flag — the trigger is "rich context exists", not "user asked for it". The user shouldn't have to know which mode is active.
