---
name: dependency-doctor
description: Dependency health management. Detects package manager, checks outdated packages and vulnerabilities, and produces a prioritized update plan.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: deps
  tools: "Read, Bash, Glob, Grep"
---

# dependency-doctor

## Purpose

Dependency health management covering outdated packages, known vulnerabilities, and update planning. Detects the package manager automatically, runs audit commands, analyzes breaking changes for major version bumps, and outputs a prioritized update plan with risk assessment.

## Called By (inbound)

- `rescue` (L1): Phase 0 dependency health assessment
- `audit` (L2): Phase 1 vulnerability scan and outdated dependency check

## Calls (outbound)

None — pure L3 utility using Bash for package manager commands.

## Executable Instructions

### Step 1: Detect Package Manager

Use `Glob` to find dependency files in the project root:

- `package.json` → Node.js (npm, yarn, or pnpm)
- `requirements.txt` or `pyproject.toml` → Python (pip or uv)
- `Cargo.toml` → Rust (cargo)
- `go.mod` → Go (go)
- `Gemfile` → Ruby (bundler)

If multiple are found, process all of them. If none found, report NO_DEPENDENCY_FILES and stop.

For Node.js, further detect the package manager:
- `yarn.lock` present → yarn
- `pnpm-lock.yaml` present → pnpm
- `package-lock.json` present → npm
- None → default to npm

### Step 2: List Dependencies

Use `Read` to parse the dependency file and extract:
- Package name
- Current version constraint
- Whether it is a dev dependency or production dependency

For `package.json`, read both `dependencies` and `devDependencies` sections.

### Step 3: Check Outdated

Run the appropriate command via `Bash` to find outdated packages:

**npm:**
```bash
npm outdated --json
```

**yarn:**
```bash
yarn outdated --json
```

**pnpm:**
```bash
pnpm outdated
```

**pip:**
```bash
pip list --outdated --format=json
```

**cargo:**
```bash
cargo outdated
```

**go:**
```bash
go list -u -m all
```

Parse the output to extract for each outdated package:
- Current version
- Latest version
- Update type: `patch` | `minor` | `major`

### Step 4: Check Vulnerabilities

Run the appropriate audit command via `Bash`:

**npm:**
```bash
npm audit --json
```

**yarn:**
```bash
yarn audit --json
```

**pnpm:**
```bash
pnpm audit --json
```

**pip:**
```bash
pip-audit --format json
```

**cargo:**
```bash
cargo audit --json
```

If the audit tool is not installed, note it as TOOL_MISSING and skip this step (do not fail).

Parse the output to extract:
- Package name + vulnerable version
- CVE ID (if available)
- Severity: `critical` | `high` | `moderate` | `low`
- Fixed version (if available)

### Step 5: Analyze Breaking Changes

For each package with a **major** version bump (e.g. v2 → v3):

Use `rune:docs-seeker` to look up migration guides if available, or note:
- "Breaking change analysis required before updating [package] from v[X] to v[Y]"

Do not blindly recommend major updates without flagging migration risk.

### Step 6: Generate Update Plan

Create a prioritized update plan:

Priority order:
1. **CRITICAL** — packages with critical/high CVEs → update immediately
2. **SECURITY** — packages with moderate/low CVEs → update in current sprint
3. **PATCH** — patch version bumps, no breaking changes → safe to batch update
4. **MINOR** — minor version bumps, new features added → update with testing
5. **MAJOR** — major version bumps, breaking changes → plan migration separately

For each item in the plan, include:
- Package name + current → target version
- Update type and risk level
- Migration notes (for major updates)
- Suggested command to run the update

### Step 7: Report

Output the following structure:

```
## Dependency Report: [project name]

- **Package Manager**: [npm|yarn|pnpm|pip|cargo|go]
- **Total Dependencies**: [count]
- **Outdated**: [count]
- **Vulnerable**: [count] ([critical] critical, [high] high, [moderate] moderate)

### Critical — CVEs (Fix Immediately)
- [package]@[current] — [CVE-ID] ([severity]): [description]
  Fix: npm update [package]@[fixed_version]

### Security — CVEs (Fix This Sprint)
- [package]@[current] — [CVE-ID] ([severity]): [description]

### Outdated — Patch (Safe to Update)
- [package]@[current] → [latest] (patch)

### Outdated — Minor (Update with Testing)
- [package]@[current] → [latest] (minor)

### Outdated — Major (Plan Migration)
- [package]@[current] → [latest] (major) — migration guide required

### Unused Dependencies
- [package] — no imports found in src/

### Update Plan (Ordered by Risk)
1. [command] — fixes [CVE-ID]
2. [command] — patch updates (safe batch)
3. [command] — requires migration: [notes]

### Dependency Health Score
- Score: [0-100]
- Grade: A (80-100) | B (60-79) | C (40-59) | D (<40)
- Score basis: -10 per critical CVE, -5 per high CVE, -2 per outdated major, -1 per outdated minor
```

## Upgrade Campaign Mode

When health score < 60 OR CRITICAL/SECURITY items exist, dependency-doctor can orchestrate a full upgrade campaign — not just report, but execute. Triggered by: user says "upgrade all", "fix deps", "run the update plan", or health score triggers.

### Campaign Chain

```
1. TRIAGE     → Run Steps 1-7 (standard report). Identify upgrade order.
2. CHECKPOINT → Save current lock file state: `cp package-lock.json .rune/dep-backup/`
3. PER-PACKAGE LOOP (CRITICAL → SECURITY → PATCH → MINOR, skip MAJOR):
   a. Upgrade one package at a time: `npm install pkg@latest`
   b. Call `rune:verification` — run tests + build
   c. If PASS → commit: `feat(deps): upgrade {pkg} {old} → {new}`
   d. If FAIL → rollback package: `npm install pkg@{old}`, log as BLOCKED
4. MAJOR BUMPS → present to user: breaking change notes + migration guide link. Never auto-upgrade.
5. REPORT     → final health score delta, packages upgraded/skipped/blocked
```

**One package at a time** — bulk upgrades make it impossible to identify which package broke the build.

**MAJOR upgrades require:**
- User confirmation
- Breaking change summary (from npm docs or package CHANGELOG)
- Migration checklist before upgrading

### Calls (outbound — Campaign Mode only)

- `verification` (L3): test + build after each package upgrade
- `fix` (L2): when a minor/patch upgrade breaks tests and fix is straightforward

## Output Format

Dependency Report with package manager, counts, CVE findings by severity, outdated packages by risk level, unused dependencies, ordered update plan, and health score (0-100). See Step 7 Report above for full template.

## Constraints

1. MUST check for known vulnerabilities — not just version freshness
2. MUST NOT auto-upgrade major versions without user confirmation — breaking changes
3. MUST verify project still builds after any dependency change
4. MUST show what changed (added, removed, upgraded) in a clear diff format

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Recommending major version update without flagging migration risk | CRITICAL | Constraint 2: breaking changes need explicit migration notes and user confirmation |
| Silently skipping vulnerability check when tool not installed | HIGH | Report TOOL_MISSING explicitly — never skip without logging it |
| Missing dependency health score (0-100) | MEDIUM | Score is mandatory in every report — it gives callers a quick health signal |
| Reporting unused dependencies without verifying (false positive) | MEDIUM | Check actual import patterns in src/ before flagging as unused |

## Done When

- Package manager detected (npm/yarn/pnpm/pip/cargo/go)
- Outdated packages listed with current → latest versions and update type
- Vulnerability audit run (or TOOL_MISSING noted explicitly)
- Breaking changes flagged for all major version bumps
- Prioritized update plan generated (CRITICAL → SECURITY → PATCH → MINOR → MAJOR order)
- Dependency health score (0-100) calculated
- Dependency Report emitted in output format

## Cost Profile

~300-600 tokens input, ~200-500 tokens output. Haiku. Most time spent in package manager commands.
