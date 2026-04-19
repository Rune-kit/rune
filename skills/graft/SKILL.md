---
name: graft
description: "Clone, port, or convert features from any GitHub repo into your project. Understand before copy, challenge before implement. 4 modes: port (rewrite), compare (analysis), copy (transplant), improve (copy + optimize)."
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: sonnet
  group: creation
  tools: "Read, Write, Edit, Bash, Glob, Grep, WebFetch"
  emit: graft.complete
  listen: codebase.scanned
---

# graft

## Purpose

External code intelligence — structured workflow for learning from, adapting, and integrating features from any public repository into your project. Graft is NOT a copy-paste tool. It enforces understanding before adoption through a mandatory challenge gate that evaluates license compatibility, stack fit, scope, quality, and maintenance health before any code touches your codebase.

## Core Rule: The Tree is a Menu, Not the Meal

When you clone a repo you see hundreds of files. **That tree is a menu — options to order from, not a meal to eat.** Grafting the whole tree is how context windows die and foreign patterns leak into your codebase.

- Read the README + the **2-5 files that implement the target feature**. Skip the rest.
- If you cannot name the specific files you need before reading, you do not know what you want yet — go back to Step 0 and narrow scope.
- `WebFetch` on raw GitHub URLs beats `git clone` whenever you know the exact files. Use clone only when discovery is genuinely needed.
- A graft that reads >10 source files is almost always a scoping failure, not a thorough one.

This rule applies to ALL modes. Copy mode is not an excuse to import a directory wholesale — you still select files deliberately.

<HARD-GATE>
Challenge gate (Step 4) MUST complete before adaptation planning (Step 5).
No implementation without confronting trade-offs. This applies to ALL modes except compare.
Skip only with --fast flag (user accepts full responsibility).
</HARD-GATE>

## Modes

### Port (default)
Rewrite the target feature using YOUR stack and patterns. Source code is a reference, not a template. Output is idiomatic to your codebase.

**When**: Different tech stack (Vue→React, Django→FastAPI), or source patterns conflict with your conventions.

### Compare
Side-by-side analysis only. No code changes. Outputs a structured comparison report.

**When**: Evaluating whether to adopt a feature, benchmarking your implementation against another, or learning patterns without importing code.

### Copy
Pure transplant with minimal adaptation. Stays as close to the original as possible — only changes imports, paths, and config to fit your project structure.

**When**: Same tech stack, source code is high quality, you want the exact implementation.

### Improve
Copy the feature, then refactor and optimize. Fix anti-patterns, add missing tests, adapt to your codebase conventions, upgrade deprecated APIs.

**When**: Same stack but source has quality issues, or you want the feature but better.

## Speed Options

| Flag | Research | Challenge Gate | User Approval |
|------|----------|---------------|---------------|
| (default) | ✅ Full | ✅ Yes | ✅ Each step |
| `--auto` | ✅ Full | ✅ Yes | ❌ Auto-approve |
| `--fast` | ❌ Skip | ❌ Skip | ❌ Auto-approve |

**`--fast` warning**: Skipping challenge gate means no license check, no quality assessment. User accepts full responsibility. Announce: "Fast mode: skipping challenge gate. You are responsible for license and quality review."

## Smart Intent Detection

| Input Pattern | Detected Mode |
|---------------|---------------|
| Contains "compare", "vs", "diff", "analyze" | compare |
| Contains "copy", "exact", "as-is", "same" | copy |
| Contains "improve", "better", "adapt", "upgrade" | improve |
| Contains "port", "convert", "rewrite", "migrate" | port |
| URL points to specific file/dir (not repo root) | Auto-scope to that path |
| (default — no keyword match) | port |

## Triggers

- `/rune graft <url> [--port|--compare|--copy|--improve] [--auto|--fast]`
- Delegated from `cook` when task contains "graft", "port from", "copy from repo", "clone feature from"
- Auto-trigger: when user pastes a GitHub URL with context like "use this", "like this repo", "steal this"

## Calls (outbound)

- `research` (L3): fetch repo README, docs, understand purpose and architecture
- `scout` (L2): scan LOCAL codebase for conventions, patterns, stack detection
- `fix` (L2): implement adapted code (port and improve modes)
- `review` (L2): post-graft quality check (improve mode only)

## Called By (inbound)

- User: `/rune graft <url>` direct invocation
- `cook` (L1): delegation when task is "port feature from external repo"

## Data Flow

### Feeds Into →

- `fix` (L2): adaptation plan → fix's implementation targets (port/improve modes)
- `review` (L2): grafted code → review's analysis targets (improve mode)
- `test` (L2): new grafted code → test coverage targets
- `journal` (L3): graft.complete signal → auto-logged for pattern tracking

### Fed By ←

- `scout` (L2): local codebase conventions → graft's adaptation strategy
- `research` (L3): repo analysis → graft's understanding of source architecture

## Executable Steps

### Step 0 — Parse Input
<MUST-READ path="references/mode-decision.md" trigger="when auto-detecting mode"/>

Extract from user input:
1. **URL** — GitHub/GitLab/Bitbucket repo or file URL
2. **Mode** — explicit flag or auto-detect via intent detection table
3. **Speed** — `--auto` or `--fast` if present
4. **Scope** — specific dir/file path if URL points to subdirectory, or user specifies "just the auth module"

Validate URL is accessible. If private repo or URL fails → suggest raw file URLs or manual paste.

### Step 1 — Fetch & Scope

```bash
# Sparse clone for large repos (skip if small or specific files)
git clone --depth 1 --filter=blob:none --sparse <url> /tmp/graft-<hash>
cd /tmp/graft-<hash>
git sparse-checkout set <target-dir>
```

For specific files or small repos: use `WebFetch` on raw GitHub URLs instead of cloning.

**Read in this order** (stop when you have enough context — see Core Rule: the tree is a menu):
1. README.md — purpose, architecture overview
2. Target dir's files — the actual code to graft (aim for 2-5 files, hard-cap at 10)
3. package.json / pyproject.toml / Cargo.toml — dependencies and stack
4. Tests for target feature — understand expected behavior

**Scope guard**: If target feature spans >15 files or >2000 LOC → WARN user: "Feature is large. Suggest narrowing to [specific module]. Continue anyway?"

**Menu discipline**: Before reading file #6, pause and ask "do I actually need this, or am I eating the menu?" If the answer isn't a concrete reason tied to the target feature, stop reading and move to Step 2.

### Step 2 — Analyze Source

Understand the target feature's architecture:
- **What it does** — 2-3 sentence summary
- **How it works** — key patterns, data flow, core logic
- **Dependencies** — external packages required, internal imports
- **Stack** — framework, language version, tooling
- **Quality signals** — has tests? typed? documented? last commit date?

Output a brief analysis (not full report — save context for later steps).

### Step 3 — Scan Local Codebase

Invoke `rune:scout` (or use cached output if `codebase.scanned` signal received):
- Local tech stack and version
- Naming conventions (camelCase vs snake_case, file structure)
- Existing patterns that overlap with target feature
- Import style, test framework, state management approach

**Stack comparison**: Produce a quick compatibility matrix:
```
| Aspect | Source | Local | Compatible? |
|--------|--------|-------|-------------|
| Framework | Next.js 14 | Next.js 15 | ✅ Minor adaptation |
| Language | TypeScript | TypeScript | ✅ |
| State | Redux | Zustand | ⚠️ Port needed |
| Testing | Jest | Vitest | ⚠️ Port needed |
```

If stack is identical → suggest copy or improve mode (not port).
If stack differs significantly → force port mode.

### Step 4 — Challenge Gate
<MUST-READ path="references/challenge-framework.md" trigger="always (unless --fast)"/>

<HARD-GATE>
Score all 5 dimensions. If 2+ dimensions score ❌ → BLOCK graft.
If 1 dimension scores ❌ → WARN + require explicit user override.
Only --fast skips this gate entirely.
</HARD-GATE>

Present challenge results to user:
```
## Challenge Gate Results

| Dimension | Score | Detail |
|-----------|-------|--------|
| License | ✅ | MIT — compatible |
| Stack Fit | ⚠️ | Redux → Zustand migration needed |
| Scope | ✅ | 6 files, ~400 LOC — manageable |
| Quality | ✅ | Typed, tested, documented |
| Maintenance | ⚠️ | Last commit 4 months ago |

**Verdict: PROCEED with caveats** (0 ❌, 2 ⚠️)
```

Wait for user approval (unless `--auto`).

### Step 5 — Plan Adaptation

Based on mode, produce adaptation plan:

**Compare mode** → skip to output. Write comparison report and STOP.

**Copy mode** → list files to transplant, import path changes, config adjustments. Minimal changes only.

**Port mode** → for each source component, describe the rewrite:
- Source pattern → local pattern mapping
- Dependencies to replace (Redux→Zustand, Jest→Vitest)
- Files to create/modify in local project
- What to keep vs what to rewrite from scratch

**Improve mode** → copy plan + improvement list:
- Anti-patterns to fix (mutations, any types, missing error handling)
- Missing tests to add
- Deprecated APIs to upgrade
- Convention mismatches to align

Present plan to user. Wait for approval (unless `--auto`).

### Step 6 — Execute

**Compare mode**: Output report → emit `graft.complete` → done.

**Copy/Port/Improve modes**:
1. Create/modify files per adaptation plan
2. For port/improve: invoke `rune:fix` for complex rewrites
3. For improve: invoke `rune:review` on grafted code
4. Run project verification (lint, type-check, test if applicable)
5. Clean up temp clone dir

**Post-execution**: Emit `graft.complete` signal with payload:
```yaml
graft.complete:
  mode: "port|copy|improve|compare"
  source_url: "<url>"
  files_changed: ["src/auth/middleware.ts", "src/auth/types.ts"]
  challenge_score: { license: "pass", stack: "warn", scope: "pass", quality: "pass", maintenance: "warn" }
```

## Output Format

### Compare Mode Output
```markdown
## Graft Comparison: [feature] — [source repo] vs [local]

### Summary
[2-3 sentences: what was compared, key differences]

### Comparison
| Aspect | Source | Local | Winner | Notes |
|--------|--------|-------|--------|-------|
| [aspect] | [approach] | [approach] | [which] | [why] |

### Recommendations
- [what to adopt from source]
- [what to keep from local]
- [what to graft: specific files/patterns]
```

### Port/Copy/Improve Output
```markdown
## Graft Complete: [feature] from [source]

### Mode: [port|copy|improve]
### Files Changed
- `path/file.ts` — [new|modified] — [what changed]

### Adaptations Made
- [adaptation 1]
- [adaptation 2]

### Verify
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] Feature works as expected
```

## Returns

| Field | Type | Description |
|-------|------|-------------|
| `mode` | enum | port, compare, copy, improve |
| `source_url` | string | Source repository URL |
| `files_changed` | string[] | List of created/modified local files |
| `challenge_score` | object | 5-dimension scores (pass/warn/fail) |
| `status` | enum | DONE, DONE_WITH_CONCERNS, BLOCKED |
| `comparison_report` | string? | Markdown report (compare mode only) |

## Constraints

1. MUST run challenge gate before any code changes — no blind copying
2. MUST clean up temp clone directories after completion
3. MUST detect and warn about license incompatibility before proceeding
4. MUST use sparse checkout for repos >100MB — never full clone large repos
5. MUST respect local conventions — grafted code should look native, not foreign
6. MUST NOT modify the source repository — read-only access only
7. MUST NOT graft without scoping — always narrow to specific feature/module
8. MUST treat the source file tree as a menu, not a meal — read the 2-5 files the feature actually needs, not every file you can see

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| Challenge Gate | 5-dimension score with 0-1 ❌ | BLOCK if 2+ ❌, WARN if 1 ❌ |
| Scout Gate | Local codebase scanned | Invoke `rune:scout` first |
| Scope Gate | Target feature ≤15 files | WARN user, suggest narrowing |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Grafting GPL code into MIT project | CRITICAL | Challenge gate checks license — blocks incompatible |
| Blindly copying code without understanding | CRITICAL | HARD-GATE: challenge before implement |
| Context overflow from large source files | HIGH | Scope guard: >15 files or >2000 LOC triggers warning |
| Reading the whole repo instead of the feature | HIGH | "Tree is a menu" rule — pause before file #6, justify each read |
| Grafted code doesn't match local conventions | HIGH | Step 3 scans local patterns, Step 5 plans adaptation |
| Stale source (abandoned repo) | MEDIUM | Maintenance dimension in challenge gate |
| Private repo URL fails | MEDIUM | Fallback to WebFetch raw URLs or manual paste |
| Port mode when copy would suffice (wasted effort) | MEDIUM | Mode decision tree suggests optimal mode |

## Self-Validation

```
SELF-VALIDATION (run before emitting graft.complete):
- [ ] Challenge gate was executed (or --fast acknowledged)
- [ ] All grafted files follow local naming conventions
- [ ] No source-specific imports remain (wrong paths, missing packages)
- [ ] License compatibility confirmed (or user override documented)
- [ ] Temp clone directory cleaned up
- [ ] Grafted code compiles/lints without new errors
- [ ] Source files read count ≤10 (menu discipline) — if >10, document why in the output
IF ANY check fails → fix before reporting done. Do NOT defer to completion-gate.
```

## Cross-cutting Updates

If this skill is added to the repo (first time):
- [ ] `README.md` — skill count (61→62), L2 count (28→29)
- [ ] `docs/ARCHITECTURE.md` — add graft to L2 list
- [ ] `CLAUDE.md` — add graft to L2 list, routing table, skill count
- [ ] `docs/index.html` — update meta stats if applicable

## Done When

- Input parsed: URL, mode, speed flags extracted
- Source fetched and scoped (sparse clone or WebFetch)
- Source analyzed: patterns, dependencies, stack understood
- Challenge gate passed (5 dimensions scored, 0-1 ❌)
- Local codebase scanned for conventions
- Adaptation plan produced and approved
- Code grafted per mode (port/copy/improve/compare)
- Verification passed (lint, type-check, tests)
- Temp files cleaned up
- `graft.complete` signal emitted
- Self-Validation: all checks passed

## Cost Profile

~2000-4000 tokens input (SKILL.md + 1-2 references), ~3000-8000 tokens output (analysis + adaptation + code). Sonnet for execution. Heaviest when port mode rewrites significant code — but that's where the value is highest.

**Scope guardrail**: Do not become a general-purpose code review tool. Graft analyzes external code for adoption purposes only — use `rune:review` for reviewing your own code, `rune:research` for general technology research.
