# skill-forge — Quality checklist, adapting skills, token efficiency

> Reference for `skills/skill-forge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Skill Quality Checklist

**Format:**
- [ ] Name is kebab-case, max 64 chars, letters/numbers/hyphens only
- [ ] Description starts with "Use when...", does NOT summarize workflow
- [ ] All template sections present
- [ ] Constraints are specific (not generic "write good code")
- [ ] Sharp edges have severity + mitigation

**Content:**
- [ ] Baseline test run BEFORE skill was written
- [ ] At least one observed failure documented
- [ ] Anti-rationalization table from real test failures
- [ ] Mesh connections bidirectional (calls AND called-by both updated)
- [ ] Data flow mapped (Feeds Into / Fed By / Feedback Loops)
- [ ] Self-Validation has 3-5 domain-specific checks (not generic)
- [ ] Output format is structured and parseable by other skills
- [ ] `evals.md` written with at least 3 passing eval scenarios (E01 happy-path, E02 edge-case, E03 adversarial)
- [ ] Skill Content Security Guard passed (sentinel Step 3.5 — no destructive ops or injection patterns in SKILL.md)

**Architecture:**
- [ ] Layer assignment correct (L1=orchestrate, L2=workflow, L3=utility)
- [ ] Model assignment correct (haiku=scan, sonnet=code, opus=architect)
- [ ] No >70% overlap with existing skills
- [ ] ARCHITECTURE.md updated
- [ ] CLAUDE.md updated

**Output-format skills only (recommended, not blocking):**
- [ ] `examples/` directory present with ≥ 2 scenario examples
- [ ] `examples/README.md` indexes which example fits which scenario
- [ ] Each example renders without error in its target environment
- [ ] No lorem ipsum in any example (use real-looking data)

**Extension-specific (if building an extension):**
- [ ] EXTENSION.md manifest present with extends, requires, install_method
- [ ] install.sh + install.ps1 tested (non-destructive merge)
- [ ] uninstall.sh + uninstall.ps1 tested (clean removal)
- [ ] Extension skill has dependency pre-flight check (Step 1)
- [ ] Fallback behavior documented when external dependency unavailable
- [ ] Cost warning present if extension calls paid APIs

## Adapting Existing Skills

When editing, not creating:

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

"Just adding a section" is not an excuse to skip testing.

## Token Efficiency Guidelines

Skills are loaded into context when invoked. Every word costs tokens.

| Skill Type | Target | Notes |
|---|---|---|
| L3 utility (haiku) | <300 words | Runs frequently, keep lean |
| L2 workflow hub | <500 words | Moderate frequency |
| L1 orchestrator | <800 words | Runs once per workflow |
| Reference sections | Extract to separate file | >100 lines → own file |

Techniques:
- Reference `--help` instead of documenting all flags
- Cross-reference other skills instead of repeating content
- One excellent example > three mediocre ones
- Inline code only if <50 lines, otherwise separate file
