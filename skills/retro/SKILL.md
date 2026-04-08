---
name: retro
description: Engineering retrospective. Analyzes commit history, work patterns, and code quality metrics with trend tracking. Per-person breakdowns, shipping streaks, and actionable improvements. Use when asked for "retro", "weekly review", "what did we ship", or "engineering retrospective".
metadata:
  author: runedev
  version: "0.3.0"
  layer: L2
  model: sonnet
  group: knowledge
  tools: "Read, Bash, Glob, Grep"
---

# retro

## Purpose

Engineering retrospective engine. Analyzes git history, work patterns, and code quality signals to produce actionable retrospectives with per-person breakdowns, shipping streaks, and concrete improvement habits. Fills a gap in the Rune ecosystem — cook builds, review checks, but nothing reflects on HOW the team works.

<HARD-GATE>
Retro is READ-ONLY. It analyzes and reports — it does NOT modify code, create PRs, or change any files except its own output artifacts (.rune/retros/).
Retro is ENCOURAGING but CANDID. Every critique is anchored in specific commits, not vague impressions.
</HARD-GATE>

## Triggers

- `/rune retro` — default 7-day retrospective
- `/rune retro 24h` — daily standup review
- `/rune retro 14d` — sprint retro (2 weeks)
- `/rune retro 30d` — monthly review
- `/rune retro compare` — current vs previous period side-by-side
- `/rune retro --business` — cross-domain executive retrospective with HTML report (Business tier)
- Called by `audit` (L2) for engineering health dimension
- Auto-suggest: end of work week (Friday sessions)

## Calls (outbound)

- `scout` (L2): scan codebase for test file counts, project structure
- `neural-memory` (L3): recall past retro insights for trend comparison

## Called By (inbound)

- `audit` (L2): engineering velocity and health dimension
- `cook` (L1): optional — after completing a multi-phase feature, suggest retro
- `rescue` (L1): post-rescue retrospective
- `launch` (L1): post-launch retrospective
- User: `/rune retro` direct invocation

## Data Flow

### Feeds Into →

- `plan` (L2): retro insights inform future sprint planning (e.g., "fix ratio too high → allocate debugging time")
- `journal` (L3): retro findings → ADR entries for team patterns
- `neural-memory` (external): retro insights → persistent cross-session memory

### Fed By ←

- `git` history: commits, authors, timestamps, file changes
- `.rune/retros/` history: previous retro JSON for trend comparison
- `neural-memory` (external): past retro insights for pattern recognition

### Feedback Loops ↻

- `retro` ↔ `plan`: retro identifies bottlenecks → plan adjusts estimation and phase sizing → next retro measures improvement

## Execution

### Step 1 — Gather Raw Data

Run these git commands to collect metrics for the specified time window:

```bash
# Core metrics (run in parallel)
git log --since="<window-start>" --format="%H|%an|%ae|%aI|%s" --shortstat
git log --since="<window-start>" --format="%H" --numstat
git log --since="<window-start>" --format="%aI" # timestamps for session detection
git log --since="<window-start>" --format="%an" | sort | uniq -c | sort -rn  # per-author
git shortlog --since="<window-start>" -sn  # author leaderboard
```

**Time window alignment**: For day/week units, align to midnight: `--since="YYYY-MM-DDT00:00:00"`. This prevents partial-day skew.

**Identify "You"**: `git config user.name` = current user. All others are teammates.

Also gather:
- Test file count: `find . -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" | wc -l`
- `.rune/retros/` for prior retro history (if exists)
- TODOS.md for backlog health

### Step 2 — Compute Summary Metrics

| Metric | How to compute |
|--------|---------------|
| Commits | Count from git log |
| Contributors | Unique authors |
| LOC added/removed | Sum from numstat |
| Test LOC ratio | test files LOC / total LOC changed |
| Active days | Unique dates with commits |
| Sessions | Detected via 45-min gap threshold (Step 4) |
| LOC/session-hour | Total LOC / total session hours |
| Fix ratio | `fix:` commits / total commits |

### Step 3 — Hourly Activity Histogram

Build an ASCII bar chart showing commit distribution by hour (local timezone):

```
Hour  Commits
 06   ██ 3
 07   ████ 7
 08   ██████ 12
 ...
```

Identify: peak hours, dead zones, bimodal patterns (morning + evening coder).

### Step 4 — Session Detection

Group commits into sessions using a **45-minute gap threshold**:

- Commits within 45 min of each other = same session
- Gap > 45 min = new session

Classify sessions:
- **Deep** (50+ min): focused work blocks
- **Medium** (20-50 min): moderate focus
- **Micro** (<20 min): quick fixes, drive-bys

### Step 5 — Commit Type Breakdown

Parse conventional commit prefixes and show percentage bar:

```
feat ████████████████ 45%
fix  ████████         22%
ref  ████             11%
test ████             11%
docs ██                5%
chore██                6%
```

**Flag**: if `fix` ratio > 50% → "High fix ratio suggests reactive mode. Consider investing in test coverage."

### Step 6 — Hotspot Analysis

Top 10 most-changed files in the window:

| File | Changes | Test Coverage |
|------|---------|--------------|
| src/auth/login.ts | 8 | ✅ |
| src/api/users.ts | 6 | ❌ |

**Flag**: files with 5+ changes = **churn hotspot** — candidate for refactoring.
**Flag**: hotspot files without test coverage = **risk**.

### Step 7 — Focus Score & Ship of the Week

- **Focus Score** = % of commits in top-changed directory. High focus (>60%) = deep work. Low focus (<30%) = context switching.
- **Ship of the Week** = highest-LOC commit/PR with feat: prefix. Celebrate it.

### Step 8 — Per-Person Breakdown

For each contributor:

**Current user (deepest treatment):**
- Commits, LOC, areas of focus
- Commit type mix (builder vs fixer vs maintainer)
- Session patterns (deep vs micro ratio)
- Test discipline (% of feat commits with corresponding test commits)
- Biggest ship

**Teammates (2-3 sentences each):**
- Summary of work areas and volume
- **Specific praise** — anchored in actual commits (e.g., "Your auth refactor in 3 commits was surgically clean")
- **One growth opportunity** — constructive, based on patterns (e.g., "8 of 12 commits were fixes — consider adding tests alongside features")

### Step 9 — Trend Tracking (if prior retros exist)

Read most recent `.rune/retros/*.json`. Compute deltas:

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Commits | 45 | 52 | +15% ↑ |
| Test ratio | 0.18 | 0.24 | +33% ↑ |
| Fix ratio | 0.55 | 0.38 | -31% ↓ (improving) |
| Deep sessions | 8 | 12 | +50% ↑ |

### Step 10 — Shipping Streak

Query full history for consecutive days with at least 1 commit:
- **Team streak**: any contributor committed
- **Personal streak**: current user committed

### Step 11 — Save Retro History

Write JSON snapshot to `.rune/retros/{YYYY-MM-DD}.json`:

```json
{
  "date": "2026-03-20",
  "window": "7d",
  "metrics": {
    "commits": 52, "contributors": 3, "loc_added": 1850,
    "loc_removed": 620, "test_ratio": 0.24, "fix_ratio": 0.38,
    "active_days": 5, "sessions": 14, "deep_sessions": 8
  },
  "authors": ["user1", "user2"],
  "streak": { "team": 12, "personal": 5 },
  "summary": "Shipped auth overhaul + 3 bug fixes. Test ratio improving."
}
```

### Step 12 — Write Narrative Report

Structure (~800-1500 words — concise, not a novel):

1. **Tweetable summary** (1 sentence, <280 chars)
2. **Summary table** (Step 2 metrics)
3. **Time & session patterns** (Steps 3-4)
4. **Shipping velocity** (Step 5 commit types)
5. **Code quality signals** (Step 6 hotspots, test ratio)
6. **Focus & highlights** (Step 7)
7. **Your week** (current user deep dive from Step 8)
8. **Team breakdown** (Step 8 teammates)
9. **Top 3 wins** (specific, anchored in commits)
10. **3 things to improve** (specific, actionable)
11. **3 habits for next week** (concrete daily practices)
12. **Trends** (Step 9, if available)

**Tone**: Encouraging but candid. Specific and concrete. Anchored in actual commits, not vague impressions. Every critique paired with a specific suggestion.

## Milestone Progressive Analysis

At specific project milestones, retro automatically generates a **deeper analysis** with a different focal point per milestone. This goes beyond the standard weekly retro — it's a reflective checkpoint on the project's evolution.

### Milestone Detection

Count total retro snapshots in `.rune/retros/` (each represents ~1 retro session). Trigger milestone analysis when count reaches:

| Milestone | Retro Count | Focal Point | Depth |
|-----------|------------|-------------|-------|
| First Month | 4 | **Foundations** — Are conventions solid? Is the architecture scaling? Are early decisions holding? | Standard + foundation review |
| Quarter | 12 | **Patterns** — What recurring themes emerged? Which areas churn most? Is technical debt growing or shrinking? | Standard + theme extraction |
| Half Year | 24 | **Growth** — How has the codebase evolved? Are the original architectural bets paying off? What would you do differently? | Standard + architecture review |
| One Year | 50 | **Maturity** — Full project health assessment. Velocity trends over time. Team growth patterns. Knowledge distribution. | Standard + full evolution timeline |

### Milestone Execution

When a milestone is detected (retro count matches a threshold for the first time):

1. **Announce**: `"🏁 Milestone: [name] ([count] retros). Generating deep analysis..."`
2. **Load history**: Read ALL `.rune/retros/*.json` snapshots (not just the most recent)
3. **Compute evolution metrics**: Plot key metrics over time (commits/week, test ratio, fix ratio, session depth)
4. **Focal analysis**: Generate the milestone-specific analysis based on the focal point column above
5. **Trend narrative**: Write a 300-500 word narrative on how the project has evolved, anchored in actual data
6. **Save**: Write milestone report to `.rune/retros/{YYYY-MM-DD}-milestone-{name}.md`

### Milestone Report Structure

```markdown
## Milestone: [name] — [date]

### Evolution Timeline
[ASCII chart or table showing key metrics across all retro snapshots]

### [Focal Point] Analysis
[300-500 words anchored in data — specific commits, files, metrics]

### What's Working
- [pattern that's improving, with evidence]

### What Needs Attention
- [pattern that's degrading, with evidence]

### Recommendations
- [1-3 concrete actions based on the focal analysis]
```

### Rules

- Milestone analysis is **additive** — it runs ON TOP of the standard retro, not instead of it
- Each milestone triggers ONCE — check if `.rune/retros/*-milestone-{name}.md` already exists before generating
- If retro history is sparse (gaps >30 days), note this in the report — trends may be unreliable
- Milestone analysis does NOT count toward the retro's normal output — it's a separate artifact

## Compare Mode

When invoked as `/rune retro compare`:

1. Compute current period metrics (same as above)
2. Compute previous same-length period (e.g., if current = 7d, previous = 7d before that)
3. Side-by-side delta table
4. Highlight biggest improvements and regressions
5. Save only current-period snapshot

## Self-Validation

```
SELF-VALIDATION (run before emitting report):
- [ ] All metrics computed from actual git data — no assumptions or estimates
- [ ] Per-person praise is anchored in specific commits (not generic "great work")
- [ ] Improvement suggestions are actionable (not "write more tests" but "add tests for the 3 hotspot files without coverage")
- [ ] Retro JSON saved to .rune/retros/ for trend tracking
- [ ] No code was modified — retro is read-only
```

## Business Mode (--business)

When invoked as `/rune retro --business`, generate a cross-domain executive retrospective with HTML output. Requires Business tier (`.rune/org/org.md` should exist).

### Business Data Sources

Pull from all installed domain packs:
- **Engineering**: git history (commits, velocity, test ratio, fix ratio, hotspots)
- **Revenue** (@rune-pro/sales): pipeline metrics, deal velocity, churn risk
- **Support** (@rune-pro/support): ticket volume, SLA compliance, CSAT
- **Finance** (@rune-business/finance): burn rate, runway, budget variance
- **Compliance** (@rune-business/legal): framework status, audit dates, open items

### Business Execution Steps

1. **Gather**: Run standard retro Steps 1-10 for engineering data
2. **Org Context**: Read `.rune/org/org.md` for team structure and governance level
3. **Cross-Domain KPIs**: Aggregate metrics from domain signal history (`.rune/signals/`)
4. **Team Health**: Score each team from org config on velocity, quality, morale
5. **Compliance**: Check compliance frameworks from org security policies
6. **HTML Render**: Load `report-templates/retro-business.html` from Business pack and populate all `{{placeholder}}` fields with computed data
7. **Save**: Write HTML to `.rune/retros/{YYYY-MM-DD}-business.html`
8. **Also save** JSON snapshot (same as standard retro) for trend tracking

### Business Output

```
.rune/retros/2026-03-30-business.html  — Self-contained HTML report
.rune/retros/2026-03-30.json           — Machine-readable metrics
```

The HTML report includes: KPI cards with trend deltas, domain performance bars (engineering, revenue, support, finance), team health table, compliance status, key insights (wins + risks), and is printable to PDF via Ctrl+P.

### Graceful Degradation

- If no Business pack installed: skip business mode, fall back to standard retro
- If domain data unavailable: show "No data" for that domain, don't fail
- If `.rune/org/org.md` missing: use generic team structure, WARN in report

## Constraints

1. MUST NOT modify any code — retro is read-only analysis
2. MUST anchor all observations in specific commits — no vague impressions
3. MUST include per-person breakdown for teams with 2+ contributors
4. MUST save JSON snapshot for trend tracking across retros
5. MUST flag churn hotspots (5+ changes to same file)
6. MUST flag high fix ratio (>50%) as reactive mode signal
7. MUST include actionable habits — "test the hotspots" not "write more tests"

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generic praise not anchored in commits | HIGH | Every praise MUST reference a specific commit or PR — "great auth refactor in 3 commits" not "good job this week" |
| Vague improvement suggestions | HIGH | "Add tests for src/api/users.ts (6 changes, 0 tests)" not "consider writing more tests" |
| Counting merge commits as real work | MEDIUM | Use `--no-merges` flag to exclude merge commits from metrics |
| Timezone skew in hourly histogram | MEDIUM | Convert all timestamps to local timezone before bucketing |
| Retro on empty window (no commits) | LOW | Detect early and report: "No commits in the last {window}. Nothing to retro." |
| Discouraging tone for struggling weeks | HIGH | Even bad weeks have wins. Find the smallest positive signal and lead with it |

## Output Format

```
## Engineering Retro: [date range]

> [tweetable summary]

### Summary
| Metric | Value |
|--------|-------|
| Commits | N |
| ...     | ... |

### [remaining sections per Step 12]

### Top 3 Wins
1. [specific win anchored in commit]
2. [specific win]
3. [specific win]

### 3 Things to Improve
1. [specific, actionable]
2. [specific, actionable]
3. [specific, actionable]

### 3 Habits for Next Week
1. [concrete daily practice]
2. [concrete daily practice]
3. [concrete daily practice]
```

## Done When

- All git metrics gathered for specified time window
- Summary metrics computed (commits, LOC, test ratio, fix ratio, sessions)
- Per-person breakdown with specific praise and growth areas
- Top 3 wins and 3 improvements identified (commit-anchored)
- Retro JSON saved to `.rune/retros/` for trend tracking
- Narrative report emitted
- No code was modified

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Retrospective narrative report | Markdown (~800-1500 words) | inline |
| Retro JSON snapshot | JSON | `.rune/retros/{YYYY-MM-DD}.json` |
| Per-person breakdown | Markdown sections | inline |
| Action items + habits | Ordered lists | inline |

## Cost Profile

~3000-5000 tokens input (git history parsing), ~2000-4000 tokens output (narrative). Sonnet for analysis quality. Runs infrequently (weekly/sprint cadence).

**Scope guardrail:** retro is read-only — it analyzes and reports. It does NOT modify code, create PRs, or change any files except its own output artifacts in `.rune/retros/`.
