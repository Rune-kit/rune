# cook — Structured output contract

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Structured Output Contract (Prompt-as-API Pattern)

When cook invokes sub-skills that produce structured output (e.g., `ba` for requirements, `plan` for implementation plans, `test` for test specs), use the **Prompt-as-API-Contract** pattern: specify the exact output schema in the invocation prompt so the sub-skill returns machine-parseable results, not free-form prose.

### Pattern

```
INVOCATION: "Analyze [X] and return results as JSON matching this schema:
{
  "insights": [{ "id": string, "category": string, "description": string, "actionable": string }],
  "confidence": number,
  "next_steps": string[]
}
Do NOT include explanatory text outside the JSON block."
```

### When to Apply

| Phase | Sub-skill | Output Contract |
|-------|-----------|----------------|
| Phase 1 | `ba` | `{ requirements: [{id, priority, description, acceptance_criteria}], ambiguities: string[] }` |
| Phase 2 | `plan` | `{ phases: [{name, tasks: [{description, files, effort}], dependencies}] }` |
| Phase 3 | `test` | `{ test_cases: [{name, type, file, assertion}], coverage_targets: string[] }` |
| Phase 5 | `review` | `{ findings: [{severity, file, line, description, fix}], verdict: "PASS"|"WARN"|"BLOCK" }` |

### Rules

- Include 1-2 concrete examples in the prompt — examples are worth more than schema descriptions
- Always specify "Do NOT include explanatory text outside the JSON/markdown block" — LLMs default to wrapping structured output in prose
- When the output will be consumed by another skill (not displayed to user), ALWAYS use this pattern
- When the output will be displayed to the user, use markdown format instead — humans don't read JSON

### Why

Free-form sub-skill output forces the calling skill to parse natural language — fragile and lossy. Structured contracts make skill-to-skill communication reliable, enable automated validation, and reduce the tokens wasted on parsing instructions.
