---
name: autopsy
description: "Full codebase health assessment. Use when diagnosing project health or starting a rescue workflow on legacy code — OR when evaluating an external GitHub repo for dependency / fork / contribution decisions (--external mode). Analyzes complexity, dependencies, dead code, tech debt, and git hotspots. Produces a health score and rescue plan."
metadata:
  author: runedev
  version: "0.5.0"
  layer: L2
  model: opus
  group: rescue
  tools: "Read, Bash, Glob, Grep"
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

### Step 0 — Repo intelligence (if GitHub-hosted)

If the project is a GitHub repository, gather repo-level metrics before diving into code:

```bash
# Fetch via GitHub API (requires gh CLI or curl + GITHUB_TOKEN)
gh api repos/{owner}/{repo} --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count, license: .license.spdx_id, language: .language, topics: .topics, created: .created_at, pushed: .pushed_at}'

# Contributor count and top contributors
gh api repos/{owner}/{repo}/contributors --jq 'length' 
gh api repos/{owner}/{repo}/contributors --jq '.[0:5] | .[] | "\(.login): \(.contributions)"'

# Commit frequency (last 52 weeks)
gh api repos/{owner}/{repo}/stats/commit_activity --jq '[.[] | .total] | add'

# Language byte distribution
gh api repos/{owner}/{repo}/languages
```

Record in working notes:
- **Activity signal**: commits/week (>5 = active, 1-5 = maintained, <1 = stale)
- **Bus factor**: contributor count (1 = critical risk, 2-3 = low, >5 = healthy)
- **Community signal**: stars/forks ratio, open issue count, staleness of latest push

Skip this step for local-only projects with no remote.

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

# Commit velocity by month (trend detection)
git log --format="%Y-%m" | sort | uniq -c | tail -12

# Issue/PR close rate (GitHub only)
gh api repos/{owner}/{repo}/issues --jq '[.[] | select(.pull_request == null)] | length'
```

Identify:
- Circular dependencies (A imports B, B imports A)
- God files (> 500 LOC with many importers)
- Hotspot files (changed most often = highest bug density)
- Dead files (no importers, no recent commits)
- Velocity trend: accelerating, stable, or decelerating (compare last 3 months)

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
[Mermaid flowchart of module coupling — use subgraphs for clusters]

## Language Distribution
[Mermaid pie chart — e.g., pie title Languages "TypeScript" : 65 "JavaScript" : 20 "CSS" : 15]

## Commit Velocity (Last 12 Months)
[Trend: accelerating / stable / decelerating — include monthly commit counts]

## Repo Intelligence (GitHub only)
| Metric | Value | Signal |
|--------|-------|--------|
| Stars | [n] | [community interest level] |
| Contributors | [n] | [bus factor: critical/low/healthy] |
| Open issues | [n] | [maintenance signal] |
| Commits/week | [n] | [activity: active/maintained/stale] |
| Last push | [date] | [freshness] |

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

## Confidence Scoring

Every finding in the autopsy report MUST carry a confidence level:

| Level | Range | Criteria |
|-------|-------|----------|
| High | 90-100% | Measured directly from code/git — LOC counted, tests run, deps parsed |
| Medium | 70-89% | Inferred from strong signals — file patterns, naming conventions, partial git data |
| Low | 50-69% | Estimated from weak signals — no git history, binary files, generated code |

Rules:
- Health scores backed by actual code metrics → High confidence
- Health scores using git archaeology only (no code read) → Medium confidence
- Health scores for modules where files couldn't be read (binary, encrypted, too large) → Low confidence
- **Overall report confidence** = weighted average of module confidences (by LOC weight)
- Include confidence in RESCUE-REPORT.md header: `Confidence: [High|Medium|Low] ([n]%)`

## Multi-Round Analysis

Autopsy follows a broad-to-narrow pattern to avoid missing systemic issues:

1. **Round 1 — Surface scan** (Steps 0-1): Repo metrics + structure map. Goal: identify scope and major clusters.
2. **Round 2 — Module deep dive** (Steps 2-3): Read and score each module. Goal: quantified health per module.
3. **Round 3 — Cross-cutting analysis** (Step 4): Git archaeology + dependency graph. Goal: find systemic risks invisible at module level (circular deps, hotspot clusters, bus factor).
4. **Round 4 — Synthesis** (Steps 5-6): Combine all rounds into prioritized report. Findings from later rounds may revise earlier scores.

Do NOT skip rounds. Round 3 cross-cutting analysis frequently reveals risks that per-module analysis misses (e.g., a "healthy" module that is the single point of failure for 10 others).

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

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Health score per module | Scored table (0-100) | inline |
| RESCUE-REPORT.md | Markdown + Mermaid | project root |
| Surgery queue (priority order) | Ordered list | RESCUE-REPORT.md |
| Git archaeology findings | Bash output + summary | inline |
| Journal entry | Text | via `journal` L3 |

## Cost Profile

~5000-10000 tokens input, ~2000-4000 tokens output. Opus for deep analysis. Most expensive L2 skill but runs once per rescue.

**Scope guardrail:** autopsy assesses — it does not refactor. All surgery is delegated to `surgeon` after the report is complete.

## Executive Mode (--executive)

When invoked as `/rune autopsy --executive`, generate a board-ready HTML health assessment. Requires Business tier.

### Executive Execution Steps

1. **Standard Autopsy**: Run Steps 1-5 (structure scan, module analysis, health scoring, risk assessment, RESCUE-REPORT.md)
2. **Org Context**: Read `.rune/org/org.md` for team structure and governance level
3. **Cross-Domain Impact**: Map module health to business domains (which team owns which modules)
4. **Business Risk Translation**: Convert technical health scores to business risk language:
   - Critical modules in revenue path → "Revenue infrastructure at risk"
   - Low test coverage on auth → "Security compliance gap"
   - High churn in customer-facing code → "Customer experience degradation risk"
5. **HTML Render**: Load `report-templates/autopsy-executive.html` from Business pack and populate all `{{placeholder}}` fields:
   - SVG health ring (score → stroke-dasharray calculation: `score / 100 * 440`)
   - Dimension bars (6 dimensions with color coding)
   - Module table (sorted by priority)
   - Surgery queue (top 5 modules)
   - Risk matrix (6 categories)
   - Git archaeology summary
   - Cross-domain impact table
   - Recommended actions (numbered, prioritized)
6. **Save**: Write HTML to `EXECUTIVE-HEALTH.html` at project root

### Executive Output

```
EXECUTIVE-HEALTH.html          — Board-ready HTML report
RESCUE-REPORT.md               — Detailed technical report (standard autopsy)
.rune/retros/{date}.json       — Health metrics for trend tracking
```

### Color Coding

| Score Range | Color | Tier |
|-------------|-------|------|
| 80-100 | var(--success) #10b981 | Healthy |
| 60-79 | var(--warning) #f59e0b | Watch |
| 40-59 | #f97316 (orange) | At-risk |
| 0-39 | var(--danger) #ef4444 | Critical |

### Graceful Degradation

- If no Business pack installed: skip executive mode, produce standard RESCUE-REPORT.md only
- If `.rune/org/org.md` missing: skip team mapping, show modules without domain ownership
- If org teams don't map to code modules: show "Unmapped" in cross-domain table

## External Repo Mode (--external)

When invoked as `/rune autopsy --external <github-url>`, evaluate someone else's repo for dependency / fork / contribution decisions. Different use case from rescue mode: you cannot run their tests, cannot rely on local Read, and the decision frame is "should I trust this?" not "how do I rescue this?".

### When to use --external

- Evaluating a library before adding it as a dependency
- Deciding whether to fork an abandoned project
- Choosing between competing implementations (`autopsy --external A vs B`)
- Diligence on a candidate acquisition target
- Pre-graft assessment (cross-skill: feeds into `graft`)

### External Execution Steps

#### Step 1 — Repo Intelligence (no local clone needed)

Use `gh api` exclusively — do NOT `git clone`. Faster + cleaner.

```bash
URL="$1"  # e.g., github.com/anthropics/claude-code
OWNER_REPO=$(echo "$URL" | sed -E 's|https?://github.com/||; s|/$||')

# Core metadata
gh api "repos/${OWNER_REPO}" --jq '{
  name, full_name, description, language, license: .license.spdx_id,
  stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count,
  open_issues: .open_issues_count, default_branch,
  created: .created_at, updated: .updated_at, pushed: .pushed_at,
  archived, disabled, topics
}'

# Maintainer responsiveness (issue + PR close rates)
gh api "repos/${OWNER_REPO}/issues?state=closed&per_page=100" --jq '
  [.[] | select(.pull_request == null) | (.closed_at | fromdateiso8601) - (.created_at | fromdateiso8601)] | add / length / 86400'   # avg days-to-close

gh api "repos/${OWNER_REPO}/pulls?state=closed&per_page=100" --jq '
  [.[] | select(.merged_at != null) | (.merged_at | fromdateiso8601) - (.created_at | fromdateiso8601)] | add / length / 86400'   # avg PR merge time

# Release cadence (last 10 releases)
gh api "repos/${OWNER_REPO}/releases?per_page=10" --jq '[.[] | {tag: .tag_name, published: .published_at, prerelease}]'

# Security advisories
gh api "repos/${OWNER_REPO}/security-advisories" --jq 'length' 2>/dev/null || echo "0"

# Dependabot alerts (if accessible — usually not for external repos)
gh api "repos/${OWNER_REPO}/dependabot/alerts" --jq 'length' 2>/dev/null || echo "n/a"
```

#### Step 2 — Decision Rubric (not Health Scoring)

External evaluation uses a DIFFERENT rubric than internal rescue. Internal cares about complexity; external cares about TRUST.

Score 0-100 across five dimensions:

| Dimension | Weight | Scoring criteria |
|---|---|---|
| **Activity** | 25% | Last push < 30d = 100, < 90d = 80, < 1yr = 50, < 2yr = 20, > 2yr = 0 |
| **Maintainership** | 25% | Avg issue-close < 7d = 100, < 30d = 70, < 90d = 40, > 90d = 10. Contributor count: > 10 = bonus +15, 2-10 = no change, 1 = penalty -20 (bus factor) |
| **Adoption** | 15% | Stars × (production-use signal from dependents): > 10k = 100, > 1k = 70, > 100 = 40, < 100 = 10. Dependent-repo count (via `gh api repos/X/Y/network/dependents` if available) is the production-use proxy |
| **License** | 20% | Permissive (MIT/Apache/BSD) = 100. Weak copyleft (MPL/LGPL) = 80. Strong copyleft (GPL) = 40. None / proprietary = 0. Verify SPDX field; flag if `null` |
| **Security** | 15% | 0 open advisories + recent CVEs addressed = 100. 1-2 unaddressed = 50. > 3 OR critical unaddressed > 30 days = 0. Audit log: check for force-push to default branch, suspicious release commits |

Composite score with same risk tiers as internal mode (80+ healthy, 60-79 watch, 40-59 at-risk, 0-39 critical).

#### Step 3 — Architecture Extraction (without reading every file)

You can't Read every file in an external repo. Extract architecture via metadata:

- **Top-level structure** via `gh api repos/X/Y/contents/` (folder names = module boundaries)
- **Tech stack** via root manifest files: `package.json` (deps), `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`. Fetch with `gh api repos/X/Y/contents/package.json --jq .content | base64 -d`
- **Test infrastructure** via existence of `tests/`, `__tests__/`, `*_test.go`, etc. (use `gh api repos/X/Y/git/trees/HEAD?recursive=1 --jq '.tree[].path' | grep -E '_test|spec'`)
- **CI config** via `.github/workflows/`, `.gitlab-ci.yml`, etc. (presence = quality signal; recent green builds via `gh api repos/X/Y/actions/runs?status=success&per_page=5`)
- **Documentation depth** via README size + `docs/` folder existence
- **ADRs** via search: `gh api search/code -X GET --field q="repo:owner/repo path:docs filename:adr*"`

#### Step 4 — Comparative Mode (optional)

When called as `/rune autopsy --external A --external B`, produce side-by-side comparison:

```markdown
| Dimension       | Repo A        | Repo B        | Winner |
|-----------------|---------------|---------------|--------|
| Activity        | 95 (active)   | 30 (stale)    | A      |
| Maintainership  | 80            | 60            | A      |
| Adoption        | 70            | 90            | B      |
| License         | 100 (MIT)     | 40 (GPL)      | A      |
| Security        | 100 (clean)   | 85 (1 open)   | A      |
| **Composite**   | **89**        | **57**        | **A**  |

Recommendation: A — significantly healthier on 4/5 dimensions.
```

#### Step 5 — Output

Write `EXTERNAL-REPO-REPORT.md` at project root (or operator-specified path):

```markdown
# External Repo Evaluation: [owner/repo]
Generated: [date]
Decision: [DEPEND | FORK | CONTRIBUTE | AVOID]
Composite Score: [N]/100 ([tier])

## Quick Verdict
[1-2 sentence summary of why this score]

## Decision Rubric (5 dimensions)
[Table per Step 2]

## Activity Signal
- Last push: [date]
- Commits last 90 days: [N]
- Trend: [accelerating | stable | decelerating]

## Maintainership Signal
- Contributor count: [N] ([bus factor: critical/low/healthy])
- Avg issue close: [N] days
- Avg PR merge: [N] days
- Top contributor: [@user] ([N]% of commits — concentration risk if > 80%)

## Adoption Signal
- Stars: [N] · Forks: [N] · Watchers: [N]
- Dependent repos: [N]
- Notable users: [list if known via gh dependents API or readme mentions]

## License
- SPDX: [identifier]
- Compatibility: [compatible with our project's license | flag legal review]

## Security
- Open advisories: [N]
- Recent CVEs: [count + latest date]
- Audit log flags: [force-push events / suspicious releases / none]

## Architecture (extracted, not read)
- Tech stack: [languages + frameworks from manifest]
- Test infrastructure: [present | absent]
- CI status: [N recent green builds | failing | none configured]
- Documentation depth: [README size + docs/ folder presence]

## Confidence
[High | Medium | Low] — based on API data completeness; external mode confidence rarely exceeds Medium because we cannot run tests or read every file.

## Recommendation
[DEPEND | FORK | CONTRIBUTE | AVOID] with rationale grounded in the dimensions above. If FORK is recommended, link to the activity signal showing why (e.g., "last push > 1 year + 12 unaddressed PRs + critical bug filed").
```

### External Mode Constraints

1. MUST use `gh api` only — do NOT `git clone` (external mode is API-driven by design; clones add ~30 seconds + disk usage for no analytical gain)
2. MUST compute all 5 dimensions OR explicitly mark "insufficient data" for any that can't be measured (e.g., no advisories endpoint access)
3. MUST cap confidence at Medium for external evaluations — internal Read-based scoring is High; external API-only is Medium at best
4. MUST output decision verdict (DEPEND / FORK / CONTRIBUTE / AVOID) — not "needs more research"
5. MUST flag license compatibility if SPDX is `null`, GPL, or proprietary
6. MUST NOT skip Security dimension even if API returns empty — explicitly note "no advisories found" vs "advisories endpoint inaccessible"

### Graceful Degradation (External Mode)

- If `gh` CLI not authenticated: fall back to `curl` with `GITHUB_TOKEN` env var; document rate-limit risk (60 unauth / 5000 auth per hour)
- If repo is private + no auth: report partial — public-API-only signals; flag confidence as Low
- If repo is fork: trace upstream and offer "compare with upstream" sub-option
- If repo is archived: auto-flag — composite caps at 30 regardless of other dimensions; archived repos are AVOID by default unless operator overrides

### Hand-offs (External Mode)

External evaluation produces a verdict that flows to other skills:

- DEPEND → cross-skill: `dependency-doctor` for vulnerability scan integration
- FORK → cross-skill: `graft` to plan the fork + adapt
- CONTRIBUTE → cross-skill: `review-intake` (PR-style workflow for the contribution)
- AVOID → terminate; document rationale in `.rune/decisions/`
