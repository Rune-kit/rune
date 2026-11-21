# review — Scope drift detection

> Reference for `skills/review/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 6.6: Scope Drift Detection

Comparing stated intent against the actual diff catches scope creep that plan-based guards miss — the plan was right, the diff simply grew past it.

After reviewing code, compare **stated intent** vs **actual diff**:

1. Read the originating source: TODO list, PR description, commit messages, or plan file
2. Extract stated intent: "what was this change supposed to do?"
3. Run `git diff --stat` to see actual file changes
4. Compare:

| Result | Meaning | Action |
|--------|---------|--------|
| **CLEAN** | All changed files serve the stated intent | Note in report |
| **DRIFT** | 1-2 files changed that don't relate to stated intent | WARN — "These files were modified but aren't mentioned in the task: [list]" |
| **REQUIREMENTS_MISSING** | Stated intent mentions files/features not in the diff | WARN — "Task mentions X but it's not in the diff" |

**This is informational, not blocking.** Scope drift is common and sometimes intentional — but making it visible prevents silent creep.

After reporting:
- If any CRITICAL findings: call `rune:fix` immediately with the finding details
- If any HIGH findings: call `rune:fix` with the finding details
- If untested code: call `rune:test` with specific coverage gaps identified
- Call `neural-memory` (Capture Mode) to save any novel code quality patterns or recurring issues found.
