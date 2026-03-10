---
name: git
description: Specialized git operations — semantic commits, PR descriptions, branch management, conflict resolution guidance. Replaces ad-hoc git commands with a dedicated, convention-aware utility.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: haiku
  group: utility
---

# git

## Purpose

Specialized git operations utility. Handles semantic commits, PR descriptions, branch naming, and changelog generation with consistent conventions. Replaces scattered git logic across cook Phase 7 and other skills with a single, convention-aware utility.

## Triggers

- Called by `cook` Phase 7 for commit creation
- Called by `scaffold` Phase 8 for initial commit
- Called by `team` for parallel branch/PR management
- Called by `docs` for changelog generation
- Called by `launch` for release tagging
- `/rune git commit` — manual semantic commit
- `/rune git pr` — manual PR generation
- `/rune git branch <description>` — generate branch name
- `/rune git changelog` — generate changelog from commits

## Calls (outbound)

None — pure L3 utility. Reads git state, produces git commands/output.

## Called By (inbound)

- `cook` (L1): Phase 7 — create semantic commit after implementation
- `scaffold` (L1): Phase 8 — initial commit with generated project
- `team` (L1): parallel PR management across workstreams
- `launch` (L1): release tagging and changelog
- `docs` (L2): changelog generation sub-workflow
- User: `/rune git` direct invocation

## Modes

### Commit Mode (default)

Analyze staged changes and produce a semantic commit.

### PR Mode

Analyze full branch diff against base and produce a pull request.

### Branch Mode

Generate a branch name from a task description.

### Changelog Mode

Generate changelog entries from commit history.

## Executable Steps

### Commit Mode

#### Step 1 — Analyze Staged Changes

Read `git diff --staged` and `git status`. Classify the change:

| Type | Signal | Prefix |
|------|--------|--------|
| New feature | New files, new exports, new routes | `feat` |
| Bug fix | Changed logic in existing code, test fix | `fix` |
| Refactor | Structural change, no behavior change | `refactor` |
| Test | Only test files changed | `test` |
| Documentation | Only .md, comments, JSDoc changed | `docs` |
| Build/CI | Config files, CI pipelines, Dockerfile | `chore` |
| Performance | Optimization, caching, query improvement | `perf` |

#### Step 2 — Detect Scope

Extract scope from file paths:
- `src/auth/*` → scope: `auth`
- `src/components/Button.tsx` → scope: `ui`
- `api/routes/users.ts` → scope: `api`
- Multiple directories → omit scope or use most relevant
- Root config files → scope: `config`

#### Step 3 — Generate Commit Message

Format: `<type>(<scope>): <description>`

Rules:
- Description: imperative mood, lowercase first letter, no period
- Max 72 characters for subject line
- If > 5 files changed → add body with bullet summary
- If breaking change detected (removed export, changed API signature, schema change) → add `!` suffix and `BREAKING CHANGE:` footer

```
feat(auth): add JWT refresh token rotation

- Add refresh token endpoint with sliding window expiry
- Store token family for reuse detection
- Add middleware to validate refresh tokens

BREAKING CHANGE: /api/auth/refresh now requires refresh_token in body instead of cookie
```

#### Step 4 — Execute

Run `git commit` with the generated message. If pre-commit hooks fail → report the failure, do not `--no-verify`.

### PR Mode

#### Step 1 — Analyze Branch

Read ALL commits on the current branch vs base branch using `git log <base>..HEAD` and `git diff <base>...HEAD`.

Do NOT just look at the latest commit — PRs include ALL branch commits.

#### Step 2 — Generate PR

```markdown
## Summary
<1-3 bullet points covering ALL changes, not just the last commit>

## Changes
- [grouped by feature/area]

## Test Plan
- [ ] [specific test scenarios]

## Breaking Changes
- [if any — list explicitly]
```

Title: < 70 characters, descriptive of the full change set.

#### Step 3 — Execute

Run `gh pr create` with generated title and body. If no remote branch → push with `-u` first.

### Branch Mode

#### Step 1 — Parse Task

Extract key intent from task description:
- Feature → `feat/short-kebab-description`
- Bug fix → `fix/issue-number-or-description`
- Refactor → `refactor/module-name`
- Chore → `chore/description`

Rules:
- Max 50 characters total
- Kebab-case, no uppercase
- Include issue number if referenced: `fix/123-login-crash`

#### Step 2 — Execute

Run `git checkout -b <branch-name>` from current branch.

### Changelog Mode

#### Step 1 — Read History

Read commits since last tag (`git log $(git describe --tags --abbrev=0)..HEAD`) or since specified reference.

#### Step 2 — Group and Format

Group commits by conventional commit type. Format as [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [Unreleased]

### Added
- New feature description (#PR)

### Fixed
- Bug fix description (#PR)

### Changed
- Change description (#PR)

### Removed
- Removed feature (#PR)
```

Link to PRs/issues when references found in commit messages.

## Constraints

1. MUST use conventional commit format — no freeform messages
2. MUST analyze full diff before generating message — don't guess from file names alone
3. MUST detect breaking changes — missing BREAKING CHANGE footer causes downstream issues
4. MUST NOT use `--no-verify` — if hooks fail, report and fix
5. MUST NOT force push unless explicitly requested by user
6. PR mode MUST analyze ALL commits on branch, not just the latest
7. MUST respect project's existing commit conventions if detected (check recent git log)

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Commit message doesn't match actual changes | HIGH | Step 1 reads full diff, not just file names |
| PR description covers only last commit | HIGH | Step 1 reads ALL commits on branch |
| Missing breaking change detection | HIGH | Check: removed exports, changed function signatures, schema changes |
| Branch name too long or has special characters | LOW | Max 50 chars, kebab-case only |
| Force push without user consent | CRITICAL | Constraint 5: never force push unless explicitly requested |
| Ignoring project's existing conventions | MEDIUM | Check recent `git log --oneline -10` for existing style |

## Done When

### Commit Mode
- Staged diff analyzed and change type classified
- Scope extracted from file paths
- Semantic commit message generated (subject + body if needed)
- Breaking changes detected and flagged
- Commit executed (or failure reported)

### PR Mode
- All branch commits analyzed (not just latest)
- Summary covers full change set
- Test plan included
- PR created with `gh pr create`

### Branch Mode
- Branch name follows convention
- Branch created from current HEAD

### Changelog Mode
- All commits since last tag grouped by type
- Formatted as Keep a Changelog
- PR/issue references linked

## Cost Profile

~500-2000 tokens input, ~200-800 tokens output. Haiku — git operations are mechanical and convention-based, no deep reasoning needed.
