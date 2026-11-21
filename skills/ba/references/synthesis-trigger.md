# ba — Synthesis trigger check

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 1.4 — Synthesis Trigger Check
<MUST-READ path="references/synthesis-mode.md" trigger="when prior conversation already contains rich requirement context (pasted spec, > 1000 words discussion, continuation session, filled issue template)"/>

Before proceeding to elicitation, check whether the requirements are **already in context**. Re-asking what the user already told you is the second-most expensive bug.

Activate **Synthesis Mode** instead of standard elicitation if ANY of:

| Signal | Threshold |
|--------|-----------|
| User pasted a spec / PRD / brief | > 200 words describing the feature |
| Conversation has > 1000 words on this feature | Sufficient context already gathered |
| User said "synthesize" / "I already explained" / "just write the spec" | Explicit synthesis request |
| Continuation — `.rune/features/<name>/requirements.md` exists with prior answers | Re-elicitation would duplicate |
| Issue tracker has filled-in template (problem, story, acceptance criteria) | Source already structured |

In Synthesis Mode: extract answers from existing context, draft the Requirements Document with **source citations** for every section, then **confirm** rather than re-interview. Ask follow-ups ONLY on the 1-2 dimensions with genuine gaps. Skip steps 2, 2.5 if all 5 dimensions are filled or partial-but-acceptable.

Workflow detail + anti-patterns: [references/synthesis-mode.md](synthesis-mode.md).
