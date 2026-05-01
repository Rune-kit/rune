# Agent Brief (Durable Handoff Variant)

A context-pack variant designed for **async handoff to AFK agents** — one-shot agents that pick up work hours or days later, without the live conversation context. The standard context-pack is for immediate sub-agent dispatch; the agent brief is for the handoff that may sit in a queue (issue tracker, task board, scheduled run).

> The standard packet is a system prompt. The agent brief is a contract. Both must survive without the originating conversation; the brief must also survive code drift.

## When to use agent-brief vs standard packet

| Variant | Use when |
|---------|----------|
| **Standard packet** (`Output Format` in SKILL.md) | Immediate dispatch — sub-agent runs in the same session, < 1 hour delay, codebase will not drift |
| **Agent brief** (this file) | Async dispatch — task posted to issue tracker, scheduled run, or external worker. May sit for days. Codebase may rename/move files in the meantime. |

Both share the same compression discipline. Agent brief adds **durability rules** to survive drift.

## The two extra principles

### 1. Durability over precision

The brief may execute days later. Files renamed, moved, refactored. Write so the brief stays useful.

| Do | Don't |
|----|-------|
| Describe interfaces, types, behavioral contracts | Reference file paths in narrative ("change `src/auth/login.ts`") |
| Name specific types, function signatures, config shapes the agent should look for | Reference line numbers ("on line 42") |
| Describe what to find ("the function that validates JWT tokens") | Assume current implementation structure stays the same |

File paths can appear in `### Files Touched` (locator-only, may rename). They cannot appear in narrative.

### 2. Behavioral, not procedural

Describe **what** the system should do, not **how** to implement it. The agent will explore the codebase fresh and make implementation decisions.

| Behavioral (good) | Procedural (bad) |
|-------------------|------------------|
| `SkillConfig` should accept an optional `schedule: CronExpression` field | Open `src/types/skill.ts` and add a `schedule` field on line 42 |
| When user runs `/triage` with no args, show a summary of issues needing attention | Add a switch statement in the main handler |
| Truncated descriptions end at last word boundary before 1024 chars and append `...` | Modify the `truncate()` function to check word boundaries |

## Template

```markdown
## Agent Brief

**Category:** bug | enhancement | refactor
**Summary:** one-line description of what needs to happen

**Current behavior:**
What happens now. For bugs: the broken behavior. For enhancements: the status quo.

**Desired behavior:**
What should happen after the work is complete. Be specific about edge cases and error conditions.

**Key interfaces:**
- `TypeName` — what needs to change and why
- `functionName(input: T): Result<O, E>` — current contract vs desired contract
- Config shape — any new options needed

**Acceptance criteria:**
- [ ] Specific, independently testable criterion 1
- [ ] Specific, independently testable criterion 2
- [ ] Specific, independently testable criterion 3

**Out of scope:**
- Thing that should NOT be changed
- Adjacent feature that might seem related but is separate
- (or "(none)" if explicitly empty)

**Files Touched (locator hints, may rename):**
- `path/to/file.ts` (`TypeName`, `functionName`) — behavioral hint
```

## Worked example — bug

```markdown
## Agent Brief

**Category:** bug
**Summary:** Skill description truncation drops mid-word, producing broken output

**Current behavior:**
When a skill description exceeds 1024 characters, it is truncated at exactly 1024
characters regardless of word boundaries. Output ends mid-word
(e.g. "Use when the user wants to confi").

**Desired behavior:**
Truncation should break at the last word boundary before 1024 characters and
append "..." to indicate truncation. Total length including "..." must not
exceed 1024 chars.

**Key interfaces:**
- The `SkillMetadata` type's `description` field — no type change, but the
  validation/processing logic that populates it needs to respect word boundaries
- Any function that reads SKILL.md frontmatter and extracts the description

**Acceptance criteria:**
- [ ] Descriptions under 1024 chars are unchanged
- [ ] Descriptions over 1024 chars are truncated at the last word boundary before 1024 chars
- [ ] Truncated descriptions end with "..."
- [ ] Total length including "..." does not exceed 1024 chars

**Out of scope:**
- Changing the 1024 char limit itself
- Multi-line description support

**Files Touched:**
- `compiler/parser.js` (`extractDescription`) — likely truncation site
- `compiler/__tests__/skill-description-quality.test.js` — add coverage
```

## Worked example — enhancement

```markdown
## Agent Brief

**Category:** enhancement
**Summary:** Add `.out-of-scope/` directory support for tracking rejected feature requests

**Current behavior:**
Rejected feature requests are closed with a `wontfix` label and a comment.
No persistent record of decision or reasoning. Future similar requests require
the maintainer to recall or search prior discussion.

**Desired behavior:**
Rejected feature requests are documented in `.out-of-scope/<concept>.md` files
capturing decision, reasoning, and links to all issues that requested the
feature. New issues are matched against these files during triage.

**Key interfaces:**
- Markdown file format in `.out-of-scope/` — each file has a `# Concept Name`
  heading, `**Decision:**` line, `**Reason:**` line, `**Prior requests:**` list
- The triage workflow reads all `.out-of-scope/*.md` files early and matches
  incoming issues by concept similarity

**Acceptance criteria:**
- [ ] Closing a feature as wontfix creates/updates a file in `.out-of-scope/`
- [ ] File includes the decision, reasoning, link to the closed issue
- [ ] If a matching `.out-of-scope/` file already exists, the new issue is appended
      to its "Prior requests" list rather than creating a duplicate
- [ ] During triage, existing `.out-of-scope/` files are checked and surfaced
      when a new issue matches a prior rejection

**Out of scope:**
- Automated matching (human confirms the match)
- Reopening previously rejected features
- Bug reports (only enhancement rejections go to `.out-of-scope/`)
```

## Anti-pattern (what makes a brief rot)

```markdown
## Agent Brief

**Summary:** Fix the triage bug

**What to do:**
The triage thing is broken. Look at the main file and fix it.
The function around line 150 has the issue.

**Files to change:**
- src/triage/handler.ts (line 150)
- src/types.ts (line 42)
```

Rots because:
- No category
- Vague summary ("the triage thing")
- Line numbers in narrative — go stale on first edit
- File paths in narrative without behavioral hint
- No acceptance criteria
- No scope boundaries
- No current vs desired behavior split

## Smell test additions for agent-brief

In addition to the BLOCK-tier smell tests in `context-pack/SKILL.md`, agent briefs MUST also pass:

| Check | Tier | Reason |
|-------|------|--------|
| Has `**Category:**` line with `bug`, `enhancement`, or `refactor` | BLOCK | Agent uses category for routing decisions |
| Has `**Current behavior:**` AND `**Desired behavior:**` sections | BLOCK | Without both, agent can't verify the delta |
| Acceptance criteria are independently testable (each can pass/fail alone) | BLOCK | Bundled criteria hide partial completion |
| `**Key interfaces:**` names actual types/functions, not file paths | BLOCK | The whole point of the brief — drift survival |
| `**Out of scope:**` present (even `(none)`) | BLOCK | Prevents gold-plating |

## Integration

Use agent-brief when delegating to:
- An issue tracker (GitHub issue, Linear, Jira) for an AFK agent to pick up
- `rune:autopilot` (Pro) for autonomous multi-session work
- A scheduled cron agent (`/schedule` for one-time follow-up)
- Any handoff where the receiver may not see the originating conversation

Use the standard packet for in-session subagent dispatch (cook → fix, team → workstream).
