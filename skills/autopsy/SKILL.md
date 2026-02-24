---
name: autopsy
description: Full codebase health assessment. Analyzes complexity, dependencies, dead code, tech debt, and git hotspots. Produces a health score and rescue plan.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: opus
  group: rescue
---

# autopsy

## Purpose

Full codebase health assessment for legacy projects. Autopsy analyzes complexity, dependency coupling, dead code, tech debt, and git hotspots to produce a health score per module and a prioritized rescue plan. Uses opus for deep analysis quality.

## Called By (inbound)

- `rescue` (L1): Phase 0 RECON — assess damage before refactoring
- `onboard` (L2): when project appears messy during onboarding
- `audit` (L2): Phase 3 code quality and complexity assessment
- `incident` (L2): root cause analysis after containment

## Calls (outbound)

- `scout` (L2): deep structural scan — files, LOC, entry points, imports
- `research` (L3): identify if tech stack is outdated
- `trend-scout` (L3): compare against current best practices
- `journal` (L3): record health assessment findings

## Execution Steps

### Step 1 — Structure scan

Call `rune:scout` with a request for a full project map. Ask scout to return:
- All source files with LOC counts
- Entry points and main modules
- Import/dependency graph (who imports who)
- Test files and their coverage targets
- Config files (tsconfig, eslint, package.json, etc.)

### Step 2 — Module analysis

For each major module identified by scout, use `Read` to open the file and assess:
- LOC (flag anything over 500 as a god file)
- Function count and average function length
- Maximum nesting depth (flag > 4 levels)
- Cyclomatic complexity signals (deep conditionals, many branches)
- Test file presence and estimated coverage

Record findings per module in a working table.

### Step 3 — Health scoring

Score each module 0-100 across six dimensions:

| Dimension | Weight | Scoring criteria |
|---|---|---|
| Complexity | 20% | Cyclomatic < 5 = 100, 5-10 = 70, 10-20 = 40, > 20 = 0 |
| Test coverage | 25% | > 80% = 100, 50-80% = 60, 20-50% = 30, < 20% = 0 |
| Documentation | 15% | README + inline comments = 100, partial = 50, none = 0 |
| Dependencies | 20% | Low coupling = 100, medium = 60, high/circular = 0 |
| Code smells | 10% | No god files, no deep nesting = 100, each violation -20 |
| Maintenance | 10% | Regular commits = 100, stale > 6 months = 50, untouched > 1yr = 0 |

Compute weighted score per module. Assign risk tier:
- 80-100 = healthy (green)
- 60-79 = watch (yellow)
- 40-59 = at-risk (orange)
- 0-39 = critical (red)

### Step 4 — Risk assessment

Use `Bash` to gather git archaeology data:

```bash
# Most changed files (hotspots)
git log --format=format: --name-only | sort | uniq -c | sort -rg | head -20

# Files not touched in over a year
git log --before="1 year ago" --format="%H" | head -1 | xargs -I{} git diff --name-only {}..HEAD

# Authors per file (high author count = high churn risk)
git log --format="%an" -- <file> | sort -u | wc -l
```

Identify:
- Circular dependencies (A imports B, B imports A)
- God files (> 500 LOC with many importers)
- Hotspot files (changed most often = highest bug density)
- Dead files (no importers, no recent commits)

### Step 5 — Generate RESCUE-REPORT.md

Use `Write` to save `RESCUE-REPORT.md` at the project root with this structure:

```markdown
# Rescue Report: [Project Name]
Generated: [date]

## Overall Health: [score]/100

## Module Health
| Module | Score | Complexity | Coverage | Coupling | Risk | Priority |
|--------|-------|-----------|----------|----------|------|----------|
| [name] | [n]   | [low/med/high] | [%] | [low/med/high] | [tier] | [1-N] |

## Dependency Graph
[Mermaid diagram of module coupling]

## Surgery Queue (Priority Order)
1. [module] — Score: [n] — [primary reason] — Suggested pattern: [pattern]
2. ...

## Git Archaeology
- Hotspot files: [list with change frequency]
- Stale files: [list with age]
- Dead code candidates: [list]

## Immediate Actions (Before Surgery)
- [action 1]
- [action 2]
```

Call `rune:journal` to record that autopsy ran, the overall health score, and the surgery queue.

### Step 6 — Report

Output a summary of the findings:

- Overall health score and tier
- Count of critical, at-risk, watch, and healthy modules
- Top 3 worst modules with scores and recommended patterns
- Confirm RESCUE-REPORT.md was saved
- Recommended next step: call `rune:safeguard` on the top-priority module

## Health Score Factors

```
CODE QUALITY    — cyclomatic complexity, nesting depth, function length
DEPENDENCIES    — coupling, circular deps, outdated packages
TEST COVERAGE   — line coverage, branch coverage, test quality
DOCUMENTATION   — inline comments, README, API docs
MAINTENANCE     — git hotspots, commit frequency, author count
DEAD CODE       — unused exports, unreachable branches
```

## Output Format

```
## Autopsy Report: [Project Name]

### Overall Health: [score]/100 — [tier: healthy | watch | at-risk | critical]

### Module Summary
| Module | Score | Risk | Priority |
|--------|-------|------|----------|
| [name] | [n]   | [tier] | [1-N] |

### Top Issues
1. [module] — [primary finding] — Recommended pattern: [pattern]

### Next Step
Run rune:safeguard on [top-priority module] before any refactoring.
```

## Constraints

1. MUST scan actual code metrics — not estimate from file names
2. MUST produce quantified health score — not vague "needs improvement"
3. MUST identify specific modules with highest technical debt — ranked by severity
4. MUST NOT recommend refactoring everything — prioritize by impact
5. MUST check: test coverage, cyclomatic complexity, dependency freshness, dead code

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Health scores estimated without reading actual code metrics | CRITICAL | Constraint 1: scan actual code — open files, count LOC, assess nesting depth |
| Recommending refactoring everything without prioritization | HIGH | Constraint 4: rank by severity — worst health score modules first, max top-5 |
| Missing git archaeology (no hotspot/stale file analysis) | MEDIUM | Step 4 bash commands are mandatory — git log data is part of the health picture |
| Skipping RESCUE-REPORT.md write (only verbal summary) | HIGH | Step 5 write is mandatory — persistence is the point of autopsy |
| Health score not backed by all 6 dimensions scored | MEDIUM | All 6 dimensions (complexity, test coverage, docs, deps, smells, maintenance) required |

## Done When

- scout completed with full project map (all files, entry points, import graph)
- All major modules scored across all 6 dimensions
- Git archaeology run (hotspots, stale files, dead code candidates identified)
- RESCUE-REPORT.md written to project root with Mermaid dependency diagram
- journal called with health score and surgery queue
- Autopsy Report emitted with overall health tier and top-3 issues

## Cost Profile

~5000-10000 tokens input, ~2000-4000 tokens output. Opus for deep analysis. Most expensive L2 skill but runs once per rescue.
