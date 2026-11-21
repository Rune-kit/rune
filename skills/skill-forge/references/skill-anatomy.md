# skill-forge — SKILL.md anatomy and frontmatter rules

> Reference for `skills/skill-forge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### SKILL.md Anatomy — WHY vs HOW Split

A skill file answers WHY and WHEN — not HOW. Code examples, syntax references, and implementation patterns belong in separate files:

```
skills/[name]/
├── SKILL.md          ← WHY: purpose, triggers, constraints, sharp edges (~150-300 lines)
├── references/       ← HOW: code patterns, syntax tables, API examples
│   ├── patterns.md   ← Implementation patterns with code blocks
│   └── gotchas.md    ← Language/framework-specific pitfalls
└── scripts/          ← WHAT: deterministic operations (shell, node)
```

**Rules:**
1. SKILL.md MUST NOT contain code blocks longer than 10 lines — move to `references/`
2. One excellent inline example (≤10 lines) is OK for clarity — more than that is a smell
3. Format templates (Output Format section) are NOT code — they stay in SKILL.md
4. Pressure test scenarios (Phase 2) are NOT code — they stay in SKILL.md
5. If a skill has >3 code blocks → create `references/` and extract them

**Why this matters:** Code blocks in SKILL.md inflate context tokens on EVERY invocation. References are loaded only when needed. A 500-line SKILL.md with 200 lines of code examples should be a 300-line SKILL.md + a 200-line references file.

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

#### Frontmatter Rules

```yaml
---
name: kebab-case-max-64-chars    # letters, numbers, hyphens only
description: Use when [specific triggers]. [Symptoms that signal this skill applies].
metadata:
  layer: L1|L2|L3
  model: haiku|sonnet|opus       # haiku=scan, sonnet=code, opus=architecture
  group: [see template]
---
```

**Description rules (CSO Discipline):**
- MUST start with "Use when..."
- MUST describe triggering conditions, NOT workflow
- MUST be third person
- MUST NOT summarize what the skill does internally
- AI reads description → decides whether to invoke → if description contains workflow summary, AI skips reading the full SKILL.md content (it thinks it already knows)
- Test: if you can execute the skill from the description alone, the description leaks too much

Bad: "Analyzes code quality through 6-step process: scan files, check patterns, run linters, compare metrics, generate report, suggest fixes"
Good: "Use when code changes need quality review before commit. Symptoms: PR ready, refactor complete, pre-release check."

```yaml
# BAD: Summarizes workflow — agent reads description, skips full content
description: TDD workflow that writes tests first, then code, then refactors

# GOOD: Only triggers — agent must read full content to know workflow
description: Use when implementing any feature or bugfix, before writing code
```

**Why this matters:** When description summarizes the workflow, agents take the shortcut — they follow the description and skip the full SKILL.md. Tested and confirmed.
