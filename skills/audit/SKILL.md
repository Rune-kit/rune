---
name: audit
description: "Comprehensive project audit — security, dependencies, code quality, architecture, performance, infra, docs, and mesh analytics. Use when needing a full 8-dimension health-score snapshot before a major release, M&A diligence, or quarterly review. Delegates to specialist skills (sentinel, dependency-doctor, perf, autopsy, etc.)."
metadata:
  author: runedev
  version: "0.5.0"
  layer: L2
  model: opus
  group: quality
  tools: "Read, Bash, Glob, Grep"
  emit: audit.complete
  listen: context.preview
---

# audit

## Purpose

Comprehensive project health audit across 8 dimensions (7 project + 1 mesh analytics). Delegates security scanning to `sentinel`, dependency analysis to `dependency-doctor`, and code complexity to `autopsy`, then directly audits architecture, performance, infrastructure, and documentation. Applies framework-specific checks (React/Next.js, Node.js, Python, Go, Rust, React Native/Flutter) based on detected stack. Produces a consolidated health score and prioritized action plan saved to `AUDIT-REPORT.md`.

## Triggers

- `/rune audit` — full 8-dimension project health audit
- `/rune audit dx` — DX Review Mode (Addy Osmani 8 principles, see below)
- User says "audit", "review project", "health check", "project assessment"
- User says "developer experience", "DX audit", "onboarding experience", "time to hello world"

## Calls (outbound)

- `scout` (L2): Phase 0 — project structure and stack discovery
- `dependency-doctor` (L3): Phase 1 — vulnerability scan and outdated dependency check
- `sentinel` (L2): Phase 2 — security audit (OWASP Top 10, secrets, config)
- `autopsy` (L2): Phase 3 — code quality and complexity assessment
- `improve-architecture` (L2): Phase 3.5 — architecture sub-score (depth / leverage / locality across top modules)
- `perf` (L2): Phase 4 — performance regression check
- `db` (L2): Phase 5 — database health dimension (schema, migrations, indexes)
- `journal` (L3): record audit date, overall score, and verdict
- `constraint-check` (L3): audit HARD-GATE compliance across project skills
- `sast` (L3): Phase 2 — deep static analysis (Semgrep, Bandit, ESLint security rules)
- `retro` (L2): Phase 6 — engineering velocity and health dimension (rune:retro)
- `browser-pilot` (L3): DX Review Mode — real browser testing of docs, setup guides, error pages

## Called By (inbound)

- `cook` (L1): pre-implementation audit gate
- `launch` (L1): pre-launch health check
- User: `/rune audit` direct invocation

## Executable Instructions

### Phase 0: Project Discovery

Call `rune:scout` for a full project map. Then use `Read` on:
- `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.editorconfig` (if they exist)

Determine:
- Language(s) and version(s)
- Framework(s) — determines which Framework-Specific Checks below apply
- Package manager, build tool(s), test framework(s), linter/formatter config
- Project type: `API/backend` | `frontend/SPA` | `fullstack` | `CLI tool` | `library` | `mobile` | `infra/IaC`
- Monorepo setup (workspaces, turborepo, nx, etc.)

**Output before proceeding:** Brief project profile, stack summary, and which Framework-Specific Checks will be applied.

### Phase 0.5: Context-Building (Pure Understanding)

<HARD-GATE>
This phase is FORBIDDEN from producing findings. No BLOCKs, no WARNs, no issues. Context-building only.
Rushed context = hallucinated vulnerabilities. Slow is fast.
</HARD-GATE>

For each critical module (entry points, auth, data layer, core business logic):
1. Read line-by-line. Note at minimum:
   - **3 invariants**: What MUST always be true for this code to work? (e.g., "user is authenticated before reaching this handler")
   - **5 assumptions**: What does this code assume about its inputs, environment, and callers?
   - **3 risks**: What could break if assumptions are violated?
2. Record findings as context notes — these feed into Phases 1-7, NOT into the final report directly

**Why**: Without this phase, the auditor pattern-matches against known vulnerability lists and hallucinates findings that don't exist in THIS specific codebase. The invariants + assumptions ground all later analysis in reality.

---

### Phase 1: Dependency Audit

Delegate to `dependency-doctor`. The dependency-doctor report covers:
- Vulnerability scan (CVEs by severity)
- Outdated packages (patch / minor / major)
- Unused dependencies
- Dependency health score

Pass the full dependency-doctor report through to the final audit.

---

### Phase 2: Security Audit

Delegate to `sentinel`. Request a full security scan covering:
- Hardcoded secrets, API keys, tokens, passwords in source code
- OWASP Top 10: injection, broken auth, sensitive data exposure, XSS, CSRF, insecure deserialization, broken access control
- Configuration security (debug mode in prod, CORS `*`, missing HTTP security headers)
- Input validation at API boundaries
- `.gitignore` coverage of sensitive files

Pass the full sentinel report through to the final audit.

---

### Phase 3: Code Quality Audit

> Full detail moved to [`references/phase-checklists.md`](references/phase-checklists.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 4: Architecture Audit

> Full detail moved to [`references/phase-checklists.md`](references/phase-checklists.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 5: Performance Audit

> Full detail moved to [`references/phase-checklists.md`](references/phase-checklists.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 6: Infrastructure & DevOps Audit

> Full detail moved to [`references/phase-checklists.md`](references/phase-checklists.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 7: Documentation Audit

Use `Glob` and `Read` to check:

**7.1 Project Documentation**
- README completeness: description, prerequisites, setup, usage, deployment, contributing
- API documentation (OpenAPI/Swagger spec, or documented endpoints)
- Can a new developer get running from README alone?
- Architecture Decision Records (ADRs) for non-obvious choices

**7.2 Code Documentation**
- Public API / exported functions documented
- Complex business logic with explanatory comments
- `CHANGELOG.md` maintained
- `LICENSE` file present

---

### Framework-Specific Checks

> Full detail moved to [`references/phase-checklists.md`](references/phase-checklists.md) (progressive disclosure). **Read that file before executing this section.**

### Phase 8: Mesh Analytics (H3 Intelligence)

**Goal**: Surface insights about skill usage, chain patterns, and mesh health from accumulated metrics.

**Data source**: `.rune/metrics/` directory (populated by hooks automatically).

1. Check if `.rune/metrics/` exists. If not, emit INFO: "No metrics data yet — run a few cook sessions first."
2. Read `.rune/metrics/skills.json` — extract per-skill invocation counts, last used dates
3. Read `.rune/metrics/sessions.jsonl` — extract session count, avg duration, avg tool calls
4. Read `.rune/metrics/chains.jsonl` — extract most common skill chains
5. Read `.rune/metrics/routing-overrides.json` (if exists) — list active routing overrides

Compute and report:
- **Top 10 most-used skills** (by total invocations)
- **Unused skills** (0 invocations across all tracked sessions) — potential dead nodes
- **Most common skill chains** (top 5 patterns from chains.jsonl)
- **Average session stats** (duration, tool calls, skill invocations)
- **Active routing overrides** and their application count
- **Mesh density check**: cross-reference invocation data with declared connections — skills that are declared as "Called By" but never actually invoked may indicate broken mesh paths

**Propose routing overrides**: If patterns suggest inefficiency (e.g., debug consistently called 3+ times in a chain for the same session), propose a new routing override for user approval.

Output as a section in the final audit report:

```
### Mesh Analytics
| Skill | Invocations | Last Used | Chains Containing |
|-------|-------------|-----------|-------------------|
| cook  | 47          | 2026-02-28| 34                |
| scout | 89          | 2026-02-28| 42                |
| ...   | ...         | ...       | ...               |

**Common Chains**:
1. cook → scout → plan → test → fix → quality → verify (34x)
2. debug → scout → fix → verification (12x)

**Session Stats**: 23 sessions, avg 35min, avg 52 tool calls
**Unused Skills**: [list or "none"]
**Routing Overrides**: [count] active
```

**Shortcut**: `/rune metrics` invokes ONLY this phase, not the full 7-phase audit.

---

---

## DX Review Mode (Addy Osmani 8 Principles)

Triggered by `/rune audit dx`. Evaluates **developer experience** — how easy it is for a new contributor to understand, set up, use, and recover from mistakes in this project. Inspired by Addy Osmani's DX framework.

<HARD-GATE>
DX Review is a SEPARATE mode — it does NOT run the 8-phase health audit above.
If the user wants both, run `/rune audit` then `/rune audit dx` separately.
</HARD-GATE>

### DX Principle 1: Time to Hello World

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 2: First-Time Setup Friction

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 3: Error Message Quality

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 4: CLI Help Quality

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 5: Documentation Navigation

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 6: API Consistency

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 7: Progressive Disclosure

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Principle 8: Recovery from Mistakes

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### DX Review Output

> Full detail moved to [`references/dx-review.md`](references/dx-review.md) (progressive disclosure). **Read that file before executing this section.**

### Final Report

After all phases complete:

Use `Write` to save `AUDIT-REPORT.md` to the project root with the full findings from all phases.

Call `rune:journal` to record: audit date, overall health score, verdict, and CRITICAL count.

## Weighted Composite Scoring

Each dimension score feeds into a weighted composite formula that produces a single comparable health score. Use this formula to compute **Overall Health** — not a simple average.

### Scoring Formula

```
Overall = (Security × 0.25) + (Code Quality × 0.20) + (Architecture × 0.15)
        + (Dependencies × 0.15) + (Performance × 0.10) + (Infrastructure × 0.08)
        + (Documentation × 0.07)
```

Mesh Analytics (Phase 8) is advisory — it contributes 0 to the weighted score but informs the verdict narrative.

### Grade Thresholds

| Score Range | Grade | Verdict | Action |
|-------------|-------|---------|--------|
| 90–100 | Excellent | PASS | Routine audit in 3 months |
| 75–89 | Good | PASS | Address MEDIUM items next sprint |
| 60–74 | Fair | WARNING | Fix HIGH items within 2 weeks |
| 40–59 | Poor | FAIL | Fix CRITICAL + HIGH within 1 week |
| 0–39 | Critical | FAIL | Emergency response — CRITICAL items block all new work |

### Why Weighted (not average)

Security issues cause exponential blast — a 3/10 security score with all other dimensions at 9/10 = overall 72 (Fair), not 8.1 (Good). The formula ensures security and code quality dominate the verdict. Comparable across runs: if Overall moves from 68 → 74 after fixes, the project measurably improved.


## Severity Levels

```
CRITICAL — Must fix immediately. Security vulnerabilities, data loss, broken builds.
HIGH     — Should fix soon. Performance bottlenecks, CVEs, major code smells.
MEDIUM   — Plan to fix. Code duplication, missing tests, outdated deps.
LOW      — Nice to have. Style inconsistencies, minor refactors, doc gaps.
INFO     — Observation only. Architecture notes, tech debt acknowledgment.
```

Apply the Falsification Pass (`../review/SKILL.md` → Step 6): drop a finding only when what you read contains direct counter-evidence against its key claim — never merely because you are unsure. A finding you cannot disprove is reported and typed `ASSUMED` with the unchecked premise named. Consolidate similar issues (e.g., "12 functions missing error handling in src/services/" — not 12 separate findings). Adapt judgment to project type (a `console.log` in a CLI tool is fine; in a production API handler, it's not).

## Output Format

```
## Audit Report: [Project Name]

- **Verdict**: PASS | WARNING | FAIL
- **Overall Health**: [score]/10
- **Total Findings**: [n] (CRITICAL: [n], HIGH: [n], MEDIUM: [n], LOW: [n])
- **Framework Checks Applied**: [list]

### Health Score
| Dimension      | Score    | Notes              |
|----------------|:--------:|--------------------|
| Security       |   ?/10   | [brief note]       |
| Code Quality   |   ?/10   | [brief note]       |
| Architecture   |   ?/10   | [brief note]       |
| Performance    |   ?/10   | [brief note]       |
| Dependencies   |   ?/10   | [brief note]       |
| Infrastructure |   ?/10   | [brief note]       |
| Documentation  |   ?/10   | [brief note]       |
| Mesh Analytics |   ?/10   | [brief note]       |
| **Overall**    | **?/10** | **[verdict]**      |

### Phase Breakdown
| Phase          | Issues |
|----------------|--------|
| Dependencies   | [n]    |
| Security       | [n]    |
| Code Quality   | [n]    |
| Architecture   | [n]    |
| Performance    | [n]    |
| Infrastructure | [n]    |
| Documentation  | [n]    |
| Mesh Analytics | [n]    |

### Composite Score
- **Formula**: (Security×0.25) + (Code Quality×0.20) + (Architecture×0.15) + (Dependencies×0.15) + (Performance×0.10) + (Infrastructure×0.08) + (Documentation×0.07)
- **Weighted Score**: [computed value] → Grade: [Excellent/Good/Fair/Poor/Critical]

### Top Priority Actions
1. [action] — [file:line] — [why it matters]

### Positive Findings
- [at least 3 things the project does well]

### Follow-up Timeline
- FAIL → re-audit in 1-2 weeks after CRITICAL fixes
- WARNING → re-audit in 1 month
- PASS → routine audit in 3 months

Report saved to: AUDIT-REPORT.md
```

## Constraints

1. MUST complete all 8 phases (Phase 8 may report "no data" if .rune/metrics/ doesn't exist yet) — if any phase is skipped, state explicitly which phase and why
2. MUST delegate Phase 1 to dependency-doctor and Phase 2 to sentinel — no manual replacements
3. MUST apply the Falsification Pass — drop findings only on direct counter-evidence, never on uncertainty; consolidate similar issues
4. MUST include at least 3 positive findings — an audit with no positives is incomplete
5. MUST produce quantified health scores (1-10 per dimension) — not vague "needs work"
6. MUST NOT fabricate findings — every finding requires a specific file:line citation
7. MUST save AUDIT-REPORT.md before declaring completion

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Discovery Gate | Phase 0 project profile completed before Phase 1 | Run scout and read config files first |
| Security Gate | sentinel report received before assembling final report | Invoke rune:sentinel — do not skip |
| Deps Gate | dependency-doctor report received before assembling final report | Invoke rune:dependency-doctor — do not skip |
| Report Gate | All 8 phases completed before writing AUDIT-REPORT.md | Complete all phases, note skipped ones |

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Audit report | Markdown | `AUDIT-REPORT.md` (project root) |
| 8-dimension health score | Markdown table | `AUDIT-REPORT.md` + inline |
| Weighted composite score + grade | Markdown | inline + `AUDIT-REPORT.md` |
| Mesh analytics section | Markdown table | inline + `AUDIT-REPORT.md` |
| Journal entry | Text | `.rune/adr/` (via `rune:journal`) |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating health scores from file name patterns instead of actual reads | CRITICAL | Phase 0 scout run is mandatory — never score without reading actual code |
| Skipping a phase because "there are no changes in that area" | HIGH | All 7 phases run for every audit — partial audits produce misleading scores |
| Health score inflation — no negative findings in any dimension | MEDIUM | CONSTRAINT: minimum 3 positive AND 3 improvement areas required |
| Dependency-doctor or sentinel sub-call times out → skipped silently | MEDIUM | Mark phase as "incomplete — tool timeout" with N/A score, do not fabricate |

## Done When

- All 8 phases completed (or explicitly marked N/A with reason)
- Health score calculated from actual file reads per dimension (not estimated)
- At least 3 positive findings and 3 improvement areas documented
- AUDIT-REPORT.md written to project root
- Journal entry recorded with audit date, score, and CRITICAL count
- Structured report emitted with overall health score and verdict

## Cost Profile

~8000-20000 tokens input, ~3000-6000 tokens output. Sonnet orchestrating; sentinel (sonnet/opus) and autopsy (opus) are the expensive sub-calls. Full audit runs 4 sub-skills. Most thorough L2 skill — run on demand, not on every cycle.
