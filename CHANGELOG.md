# Changelog

All notable changes to Rune are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.22.0] - 2026-07-03

"Convergence, Dogfooded" — the v2.21.0 gates were run against a live fixture by fresh executor agents (no author context); 16 executor-reported ambiguities became spec fixes, and the dogfood fixture became the seed of a permanent skill-behavior eval harness.

### Added — Skill behavior evals (`npm run eval`)

- **`evals/` + `scripts/run-evals.js`** — behavioral eval runner: each case copies a fixture repo to a temp dir, runs a FRESH headless agent whose only instruction source is the skill's SKILL.md, and asserts transcript markers + file-mutation contracts (`fileUntouched` for append-only/no-write guarantees). Not part of `npm run ci` (each case = a full agent run); run after any edit to an evaled skill.
- **2 seed cases** (the actual dogfood fixture, verbatim): `converge/dead-button` (P1 submit → absent route, plan claims done, declared-debt icon, unrequested button, navigation-anchor bait) and `converge/clean-pass` (fully wired — must emit clean and write nothing).
- Dogfood round-1 results: both verification Level 3.5 and converge caught the dead button with file:line evidence, zero false positives on navigation anchors, `addEventListener` bindings recognized, dedup collapsed 7 intent keys into 1 CV task.

### Fixed — converge v0.2.0 (dogfood findings)

- **`deferred-debt` class**: Unwired Elements with an EXTERNAL wiring owner (asset pass, future feature) are reported but get no CV task and never block `convergence.clean` — previously a decorative placeholder could force a round-cap escalation. Owner inside this feature's plan → still `missing`.
- **Report gains 3 sections**: `Unrequested` (surfaced, never CV tasks — explicit now), `Deferred (declared debt)`, and `Plan Claims vs Reality` (tasks marked `[x]` whose artifact is absent — the lie surfaced first-class).
- US-n verdicts are DERIVED (worst of ACs); task IDs + quickstart are evidence, not verdict keys; `convergence.gaps` payload adds `cv_tasks` (deduped work-item count) so consumers don't misread per-key inflation.
- cook v2.6.1: closes stale CV tasks as `(resolved — superseded)` when converge reports clean — append-only means only cook may touch them.

### Fixed — verification v0.7.0 (dogfood findings)

- FAIL precedence: a 3-Level/3.5 FAIL dominates — Overall=FAIL even when command checks were validly skipped.
- Entry-point exemption covers server entrypoints (package.json `main`/`start`/`bin`) and statically-served root pages; config/manifest files get explicit L2/L3 rules.
- Level 3.5 element list includes action-style anchors (`href="#"`, `javascript:`) with pure-navigation exemption; reverse check is per-ROUTE, not per-file.

### Changed — Pro `autopilot` v1.6.0

- Phase 6.5 CONVERGE explicitly NOT skipped in autonomous mode — that's exactly where dead buttons hide. Converge severity maps into autopilot's stricter thresholds (P1 partial = BLOCK); unconverged P1 gap after round cap = BLOCKED, never committed.

### Ops

- `npm run ci` now includes `version-sync-check.js` — full parity with the CI publish gate (a local-CI-passes/publish-fails gap caused a re-tag during the v2.21.0 release).

## [2.21.0] - 2026-07-03

"Convergence" — kill the dead-button failure mode: a spec↔code gap scan (`converge`, the 65th skill) plus a traceability chain from spec IDs to contracts to coverage gates, so "UI renders but the backend never existed" can no longer pass the pipeline.

### Added — `converge` skill (L3, the dead-button detector)

- **What it does.** Post-implementation, re-reads spec/plan/contracts as the SOLE source of intent, scans the ACTUAL codebase (present state, not the diff), and classifies every intent key: `implemented` / `missing` / `partial` / `contradicts` / `unrequested`. Dead-interaction trace walks element → handler → service → route → entity; the first broken link is a `partial` gap keyed to the story's AC. APPEND-ONLY remediation: `CV-<round>.<seq>` tasks with intent keys; zero gaps = zero writes + `convergence.clean`. Refuses to run without a spec (`NO_SPEC` — "converge without a spec is vibes").
- **cook v2.6.0 — Phase 6.5 CONVERGE.** After VERIFY, before COMMIT, for feature chains with `requirements.md`. Gaps → execute CV tasks → re-verify → re-converge, max 2 rounds then Structured Escalation. Unrequested-only gaps surface in the Cook Report without triggering the loop. HARD-GATE: a P1 CRITICAL convergence gap is never committed as "done". Quickstart execution wired into Phase 6 VERIFY.
- **Fixtures.** `references/eval-fixtures.md` — 7 behavioral fixtures (dead button, clean pass, contradicted decision, scope creep, placeholder honesty, NO_SPEC refusal, round-2 escalation).

### Added — Traceability backbone (`ba` v1.2.0, `plan` v1.7.0)

- **`ba` v1.2.0.** User stories carry `[P1|P2|P3]` priority + per-story **Independent Test** (one concrete action proving the story end-to-end); new Step 5.5 **Key Entities** (mandatory for data-touching features); `tasks.md` artifact restructured from layer-grouped to **story-grouped vertical slices** (Data → Logic → Endpoint → UI → Test inside each `US-n` section) — layer-grouped backbones were inviting "finish the UI layer and stop". AC rule: a THEN that stops at widget state for a data-touching story is incomplete.
- **`plan` v1.7.0.** New Step 3.7 **Boundary Artifacts** — features crossing a UI↔data boundary emit `data-model.md` + `contracts/` (each contract names its `Serves:` story and `Consumers:`) + `quickstart.md` (executable per-story validation) BEFORE phase files; tasks derive from contracts. New Step 5.7 **Coverage Gate** — every `FR-n`/`US-n` maps to task IDs (`P<phase>-T<seq>` scheme); a P1 story with zero coverage means the plan cannot be presented. Ordering law: UI is structurally LAST within each slice. Phase file cap unified at 200 lines.

### Added — Deep wiring gates (work even WITHOUT a spec)

- **`verification` v0.6.0.** Level 2 stub table catches dead handlers (`onClick={() => {}}`, `href="#"` action links, `preventDefault()`-only submits). New **Level 3.5 INTERACTION WIRED**: framework-aware (React/Svelte/Vue/plain-HTML syntax; prop-origin handlers and navigation handlers PASS) trace of every interactive element in the diff's UI files — handler bound → resolves → target route/service exists; reverse check: new routes need ≥1 caller. Diff-scoped: legacy dead UI warns, new work fails. Emits `integration.verified` on UI+data diffs that pass.
- **`completion-gate` v1.9.0.** Step 4.5 Integration Check is now MANDATORY (not "optional for single-phase") when the diff touches UI+data files, the spec has Key Entities, or the task contains interaction keywords — with mechanical trigger definitions. Uncalled routes: WARN → **BLOCK** when the route was created in this task and a story references it; deferral requires a NAMED future-phase task.
- **`preflight` v1.2.0.** Step 4 cross-layer pairing: a new interactive component whose handler chain reaches no real endpoint (and isn't explicitly scoped UI-only) = BLOCK. Step 4.5 dead-interactive check = BLOCK. Step 6 verdict aggregation updated so these BLOCKs survive to the final verdict.
- **`design` v0.7.0.** Placeholder Ownership: every inert/placeholder element ships with a row in `.rune/ui-spec.md` `## Unwired Elements` (element, location, why, wiring owner) — the line between declared debt (preflight skips, verification reports INFO) and accidental dead UI (converge counts as `missing`). New Placeholder-Ownership mesh gate + Constraint 14.

### Added — Test + deploy layer

- **`test` v1.4.0.** Spec→Test Traceability keys on `US-n/AC-n.m`/`FR-n` and is mandatory when `requirements.md` exists ("no plan file" is no longer a skip); **cross-boundary minimum**: every UI↔data story needs ≥1 L2 integration test with the real route wired — mocking the entire chain doesn't count; contract tests written BEFORE endpoint implementation when `contracts/` exist; advisory browser-pilot click-through of each story's Independent Test.
- **`deploy` v0.8.0.** Advisory wiring-evidence check: feature deploys touching UI+data with neither `integration.verified` nor `convergence.clean` → explicit WARN + user confirmation (hotfix chain exempt).
- **Signals.** +3: `convergence.gaps` (converge → cook), `convergence.clean` (converge → cook, deploy), `integration.verified` (verification → deploy). Mesh: 65 skills, 204 connections, 43 signals (55 edges).

## [2.20.0] - 2026-07-02

"Spec Discipline" — close the plan-without-spec gap so a `brainstorm → plan → cook` chain can no longer skip `ba`; ship the `ba` EARS functional-requirements layer and `adversary` reasoning-mode catalog; key context hooks by `session_id`.

### Fixed — Spec no longer dropped on `brainstorm → plan → cook`

- **Root cause.** A `brainstorm → plan → cook` chain silently skipped `ba` (the spec/requirements step). `brainstorm` Step 5 handed the chosen approach straight to `plan`; `plan` reads `requirements.md` only if it already exists (it never invokes `ba`); then `cook` Phase 0's resume-gate saw the `.rune/plan-*.md` file and jumped to Phase 4 — so `ba` never ran. Result: a plan with no spec behind it (no EARS `FR-n`, no user stories, no acceptance criteria) — the "plan without spec" vibe-coding gap.
- **Fix (two gates).** `brainstorm` Step 5 now runs a **spec-presence gate** — a standalone brainstorm that picks a new-feature approach with no `requirements.md` routes to `ba` FIRST (loop-guard: skipped when `ba`/`cook` is the caller). `cook` Phase 0 adds **Step 0.55 Spec-Backfill Gate** (HARD-GATE): a feature/greenfield resume that finds a plan but no `requirements.md` invokes `ba` to backfill, reconciles the plan, THEN resumes — the hard stop that closes every bypass path, not just brainstorm's. Registered the `brainstorm ↔ ba` reciprocal connection (mesh 203 → 204 connections).
- **Tests.** 1,559 pass; `doctor` mesh healthy (64 skills / 204 connections / 40 signals). Doc stats swept 203 → 204 (README, landing, guides, VISION, branding, CLAUDE.md).

### Fixed — Context hooks key temp files by session_id (no more false "100% compact")

- **Root cause.** The context pressure hooks keyed their temp files by `base64url(process.cwd())`. The statusline (Pro `rune-pulse`) and the PreToolUse / UserPromptSubmit hooks could run with different working directories, so the hooks never found the statusline's real-percentage pulse file. They fell back to a tool-call counter that **never reset across sessions/projects**, and the 1M-window scaling was defeated (the unreadable pulse couldn't supply `size`) — pinning the estimate at "100% URGENT, run /compact" while the real context was a fraction of that.
- **Fix.** New `hooks/lib/context-key.cjs` keys all context state files by the Claude Code `session_id` (passed on stdin to the statusline AND every hook, identical within a session, unique per session). `context-watch` + `metrics-collector` now derive their files from `session_id`; counters reset automatically per session, so `session-start` no longer needs to pre-reset them. Falls back to a cwd hash only when `session_id` is absent. (Pro `rune-pulse` / `context-sense` / `context-inject` get the same fix in the Pro repo.)
- **Tests.** `scripts/__tests__/hooks.test.js` — metrics attribution now exercises the session-keyed path + a no-cross-session-bleed guard. 1,559 pass.

### Added — Skill enrichments (advisory, no mesh change)

- **`ba` v1.1.0 — EARS functional-requirements layer.** New Step 4.5 writes atomic, testable functional requirements in EARS format (Easy Approach to Requirements Syntax) — the `FR-n` layer between user stories (WHY) and acceptance criteria (HOW). New `references/ears-format.md`; AC↔FR traceability + Logic Consistency check `1b`; `## Functional Requirements` in the requirements.md artifact. Skipped for Bug Fix/Refactor. Format recommendation, not a gate.
- **`adversary` v0.4.0 — reasoning-mode catalog + steelman-first.** New Step 0.5 steelmans the plan's thesis before challenging it and selects a reasoning lens (Red Team / Pre-mortem / Evidence Audit / Dialectic / Socratic) per dimension — the 5 lenses (HOW to attack) compose with the existing 5 dimensions (WHAT to attack). New `references/reasoning-modes.md` with signal→mode selection; lens auto-selected (no interactive picker). No new HARD-GATE.

## [2.19.0] - 2026-06-20

"Comprehension" — the flagship human-visible artifact. `rune dashboard` renders a self-contained HTML "Codebase Briefing + Governance Scorecard": a single file a buyer can open in a meeting with no server, no CDN, no telemetry, nothing leaving the machine. The headline is the governance/value **verdict** (not a code graph — the buyer's codebase graph lives in the Understand tab). Tier-aware: Free sees the verdict + measure; Pro adds a "My Lens" cost/ROI persona; Business unlocks the full Governance Scorecard + compliance coverage. Built entirely on existing generators (onboard / autopsy / analytics / mesh) — original work, no external dependency.

### Added — `rune dashboard` comprehension dashboard

- **New `rune dashboard` CLI verb + `compiler/comprehension.js`** — emits one self-contained HTML document (Signal Teal palette, Verdict hero, 5-tab IA: Verdict → Govern / Measure / Understand / Improve). No external requests of any kind; XSS-hardened (data embedded as JSON with `</`→`<\/`, U+2028/U+2029 line-terminator escaping, every dynamic string escaped).
- **Verdict hero** — plain-language governance/value verdict with a 0-100 score (count-up animation) and an honest empty-state (renders `—` when there is no session data or no real basis, never a fabricated number).
- **Govern tab (Business)** — gate-outcome ledger with BLOCK capture, compliance coverage by pack, decision-provenance scaffold, and persona-scoped report profiles. Free/Pro see an honest upsell that *describes* the feature's value — never fake data.
- **Measure tab** — KPI row, model distribution, skill-ROI (active vs dormant of all installed skills), skill heatmap, session timeline, and skill-chain frequency. `BLOAT_THRESHOLD`-based workflow-bloat detection.
- **Understand tab** — the *buyer's* codebase graph (from onboard/autopsy), with node-type + edge-category filters, a domain view with flow steps, a guided tour, a node inspector, and export to PNG / SVG / JSON. The canvas is keyboard-accessible (tabindex, arrow-key navigation, sr-only node list).
- **Improve tab** — data-driven finding cards (blocks caught, repeated chains with count ≥ 3, workflow bloat) with an honest empty state when session data is thin — no boilerplate masquerading as findings.
- **Tier gating** — `hasPro` / `hasBusiness` embedded in the data blob; the Pro "My Lens" persona (keyboard-operable, `aria-pressed`) is gated to `hasPro`, the full Govern scorecard to `hasBusiness`. Default (empty) data resolves to Free.

### Fixed — Session metrics attribution (dashboard data foundation)

- **`metrics-collector` now captures Task/Agent subagents.** Matcher widened from `Skill` to `Skill|Task|Agent` (`hooks/hooks.json`) and the hook reads `tool_input.subagent_type` (rune:* only) in addition to `tool_input.skill`. Previously skills run as subagents (the dominant path in Rune) were never recorded, leaving `skills_used[]` empty in `sessions.jsonl`. Generic agents (general-purpose, Explore, …) are excluded.
- **`context-watch` now counts ALL tool calls.** Matcher widened from `Edit|Write` to `.*` so `tool_calls` / `tool_distribution` reflect real activity, and the warning thresholds were aligned to the context-engine model (ORANGE ~80, RED ~120). The fabricated ">85%" claim in the RED message was removed (tool count is directional, not a context percentage).
- **⚠ Metric scale change:** because `context-watch` previously counted only Edit/Write, `tool_calls` values in `sessions.jsonl` rows written BEFORE this change are Edit/Write-scaled and roughly 2-3x lower than rows written after. Analytics/dashboard trend lines will show a one-time discontinuity at the cutover; old rows are not migrated.

### Added — Dashboard data contracts

- `compiler/schemas/comprehension.schema.json` + `compiler/schemas/governance.schema.json` — JSON Schema contracts for the upcoming dashboard.
- `compiler/governance-collector.js` — assembles `.rune/governance.json` (gates/signals/compliance) best-effort; documents 6 capture gaps (gate outcomes, per-fire timestamps, signal runtime counts, compliance verification, decision provenance, fired=invocation-not-outcome). `onboard`/`autopsy` now also emit `.rune/comprehension.json`.

### Changed — comprehension.js split

- **`compiler/comprehension.js` split (3584 → 1255 lines).** The 2.3k-line embedded browser application was extracted to a new `compiler/comprehension-client.js` as a `CLIENT_SCRIPT` template-literal asset; the generator interpolates it after the embedded data line. Output is byte-identical (golden-hash verified across empty / sample / Business / Pro / XSS fixtures). No behavior change.

### Verification

- 1,558 tests pass — the dashboard suite covers XSS / script-injection, self-containment (no http(s):// / `<link>` / `@import`), tier gating, NaN guards, all five tab panels, and the client-script split. Biome clean, doctor healthy, mesh 64 skills / 203 connections / 40 signals.

## [2.18.1] - 2026-05-17

Fix: `rune setup --tier pro|business` now also installs the tier's `skills/` directories into the Free plugin's `skills/` folder — previously only hooks were wired, which left paid-tier skills invisible to the Claude Code runtime (`rune:autopilot` returned `Unknown skill: rune:autopilot`).

### Fixed — Tier skill installation

- **New `installTierSkills` function** in `compiler/commands/setup.js`. Called by `runSetup` after `installHooks` succeeds. For each requested tier, resolves the manifest via existing `resolveTier`, derives the tier root from `manifest.source` (must be absolute — explicit guard), and copies every subdirectory under `<tierRoot>/skills/` into `<runeRoot>/skills/`. Idempotent: existing target directories are SKIPPED (protects Free skills from same-named-Pro-skill clobber AND protects user edits of previously-installed Pro skills from being stomped on re-run).
- **Security hardening built into the copy loop**:
  - Path-traversal guard rejects skill directory names containing `/`, `\\`, `..`, or `.` (covers `entry.name` adversarial cases not caught by `assertSafeTierName` in `tiers.js`, which only validates tier names).
  - Symlink rejection — `entry.isSymbolicLink()` short-circuits with `rejected: symlink (would escape sandbox)` BEFORE `cp` runs. POSIX `cp` would otherwise recreate symlinks at `dst`, letting the runtime follow them outside `runeRoot/skills/` at read time.
  - `cp({ recursive: true, dereference: true })` — belt-and-suspenders alongside the symlink-entry reject. Catches nested symlinks one level deep inside a legitimate skill dir.
  - Partial-copy cleanup — `cp` is wrapped in try/catch; on failure, `rm(dst, { recursive: true, force: true })` removes the half-written directory so the next run isn't silently locked-out by `existsSync(dst)`.
- **Version-drift detection**: when target already exists, `readSkillVersion` parses `metadata.version` from both source and installed `SKILL.md` (minimal regex scoped under `metadata:` block — no YAML dependency, immune to multiline description false positives). Skip messages distinguish `already present (v1.0.0)` from `stale: installed v1.0.0, source has v1.5.0 — delete target dir to upgrade`.
- **`formatSetupResult` partitions skipped entries**: benign skips (`N already present`) vs security rejections (`M rejected`) reported in separate counts. Each rejection surfaces a `⚠ <skill>: <reason>` line so operators can audit a compromised tier repo.

### Honesty Constraints

- The fix lands tier skills into `<runeRoot>/skills/` at `rune setup --tier <tier>` time. If a user upgrades the Pro repo (new skill added at `Pro/skills/<new>/SKILL.md`) WITHOUT re-running `rune setup`, the new skill won't appear in the plugin cache. Re-run after pulling tier updates.
- Existing skills are SKIPPED — no automatic upgrade. Version-drift detection only WARNS via the skip message; user must manually delete the target skill directory and re-run setup to apply an upgraded Pro skill. This is intentional (protects user edits) but may surprise users expecting auto-upgrade. A `--force-skills` flag is deferred to a future release.
- When `runeRoot` resolves to the Free source repo itself (e.g. `node compiler/bin/rune.js setup` run inline from `D:/Project/Rune/Free/`), Pro skills get copied INTO `Free/skills/`. The maintainer would notice on `git status`. Production `npx @rune-kit/rune setup` resolves `runeRoot` to the plugin cache, not the source — pollution only happens in dev-mode direct invocation.

### Verification

- 26 setup-suite tests: 25 pass, 1 skipped on Windows (symlink test needs admin/dev-mode). All-platform suite at `npm test` 1444 total (1 pre-existing flaky perf test in `detect-invariants.test.js`, 5294ms > 5000ms threshold under load, passes 542ms in isolation — unrelated to this fix).
- Paired with Pro autopilot v1.5.0 (`Pro/CHANGELOG.md` entry `[autopilot-v1.5.0]`) — autopilot SKILL.md Step 0 LOAD now reads user message context for plan path, closing the "args not picked up" symptom users saw before this fix.

---

## [2.18.0] - 2026-05-15

Cross-platform reach + discipline tightening — adopted a curated subset of patterns from `nexu-io/html-anything` (Apache-2.0). Five new compiler adapters (gemini / copilot / aider / qoder / qwen) lift platform coverage from 8 → 13. Anti-AI-slop discipline tightened in `design` (vague directives become measurable) and `skill-forge` (literal-example convention for output-format skills). Sentinel-env's binary detection learned about Bun / Cargo / Deno / Volta / asdf / proto. CONTRIBUTING got an explicit non-goals section.

### Added — Compiler Adapters (13 total)

- **`gemini`** — bundled `GEMINI.md` at project root with all 64 skills + 14 packs concatenated under `## rune-<name>` H2 sections. Per-skill files staged at `gemini/skills/` for forward-compat if Gemini CLI adds `@import` support. Model map: opus→gemini-2.5-pro, sonnet→gemini-2.5-flash, haiku→gemini-2.0-flash-lite.
- **`copilot`** — per-skill `.github/instructions/rune-<name>.instructions.md` with documented `applyTo: "**"` YAML frontmatter (description + tier-hint moved to body — only `applyTo` is a documented Copilot frontmatter key). Plus `.github/copilot-instructions.md` index + `AGENTS.md`.
- **`aider`** — per-skill `aider/rules/rune-<name>.md` plus auto-generated `.aider.conf.yml` with `read:` array listing every rule file. Aider auto-loads them per session. Plus `CONVENTIONS.md` summary.
- **`qoder`** — per-skill `.qoder/rules/rune-<name>.md` with YAML frontmatter (model: tier:heavy/mid/light) + `AGENTS.md` (open AGENTS.md standard).
- **`qwen`** — per-skill `qwen/skills/rune-<name>.md` plus root `QWEN.md` with `@qwen/skills/...` import lines (Qwen Code's hierarchical loader). Model map: opus→qwen3-coder-plus, sonnet→qwen3-coder, haiku→qwen3-coder-flash.

### Added — Compiler Architecture

- **`adapter.generateExtraFiles({ parsedSkills, stats, runeRoot, outputRoot, outputDir }) → Array<{path, content}>`** — generic emitter hook for adapters that need to emit additional context / index / bundle files alongside per-skill files. Replaces ad-hoc `if (adapter.name === 'codex')` special-casing. Path-traversal-safe (rejects absolute paths, asserts containment within `outputRoot`), receives a frozen `stats` snapshot for deterministic reads.
- **codex AGENTS.md migrated to `generateExtraFiles`** — retired the emitter's hardcoded codex special-case. Codex still emits the same AGENTS.md, now via the generic hook. Adapter logic is fully self-contained.

### Added — Discipline Tightening

- **`design` v0.6.0** — three new universal anti-AI rules under Step 2.9: **Rule 4 Measurable Constraints** (vague vs measurable rejection table — "use modern typography" → "Inter 96/64/40/24/16 px on an 8 px grid"), **Rule 5 No-Pure-No-Lorem** (no `#000` / `#fff` defaults, no lorem ipsum, no `outline:none` without `:focus-visible`), **Rule 6 CJK-First Font Stack** (multi-language products list CJK-capable family first). Constraints #11-13, two new Mesh Gates, four new Sharp Edges. Pre-Delivery Checklist expanded.
- **`skill-forge` v1.9.0** — new **Phase 6.25 EXAMPLES** convention. Output-format skills (design, asset-creator, slides, marketing, video-creator, doc-processor) SHOULD ship `examples/<scenario>.html` (or domain-equivalent) so the agent has a literal copy target. Soft recommendation, not HARD-GATE — per Rune's no-discipline-heavy-grafts policy.
- **`sentinel-env` v0.4.0** — Tier 8 binary detection learned modern PATH locations: Unix `~/.bun/bin`, `~/.cargo/bin`, `~/.deno/bin`, `~/.volta/bin`, `~/.asdf/shims`, `~/.proto/bin`, `/usr/local/bin`. Windows `%USERPROFILE%\.bun\bin`, `%USERPROFILE%\.cargo\bin`, `%USERPROFILE%\.deno\bin`. Catches Bun / Cargo / Deno / Volta / asdf / proto users that the prior 8-tier list missed.

### Added — Tests + Docs

- **62 new tests** — adapter contract per platform (5 adapters × shape + extra-files), model mapping per platform, codex `generateExtraFiles` migration, and a path-traversal guard test that exercises every adapter's hook for absolute-path returns. 1,435 tests pass (was 1,376).
- **`docs/ARCHITECTURE.md`** — new "Cross-Platform Adapter Coverage" table documenting all 13 adapters, their output paths, frontmatter format, extra files, and source documentation links. Cross-Provider Model Mapping table extended with the 5 new adapters.
- **`README.md` + `CLAUDE.md`** — platform list updated to 13.
- **`CONTRIBUTING.md`** — new "What We Don't Accept" section with 8 explicit non-goals (no skills without measurable Done-When, no L0/L1 without ADR, no vague constraints, no `--no-verify` bypasses, no XLabs coupling, no discipline-heavy grafts, no source attribution lines, no missing examples for output-format skills).

### Source

- Pattern adapted from [`nexu-io/html-anything`](https://github.com/nexu-io/html-anything) (Apache-2.0). Rune adapts the file-convention philosophy and discipline patterns; `html-anything`'s CLI invocation / SSE rendering / WeChat export pipelines are out of Rune's scope.

## [2.17.1] - 2026-05-06

UX patch — `rune setup` interactive wizard replaces the multi-step `cd <project> && export RUNE_PRO_ROOT && rune hooks install --preset gentle --tier pro` workflow with one command. Source: bro flagged the v2.17.0 install flow as "rắc rối" (complicated) and asked for "one-click chọn scope > finish" UX.

### Added

- **`rune setup`** (new top-level command) — interactive wizard. Auto-detects Pro/Business tiers across 3 paths in priority order: env var → monorepo sibling → well-known paths (`D:/Project/Rune/Pro`, `~/rune-pro`, `~/Project/Rune/Pro`). Asks 3 questions: scope (current/global) → tiers (free/pro/business) → preset (gentle/strict). Non-interactive mode via `--here` / `--global` / `--tier` / `--preset` / `--dry` flags for CI / scripting.
- **`rune hooks install --global`** — new flag. Writes Rune-managed entries to `~/.claude/settings.json` (every Claude Code session, regardless of project) instead of the default per-project `<cwd>/.claude/settings.json`. Implementation passes `os.homedir()` as projectRoot to existing claude adapter — no new emission infrastructure. Forces `--platform claude` (cursor/windsurf/antigravity rule files are inherently per-project).
- **`compiler/commands/setup.js`** — exports `runSetup()`, `detectTiers()`, `formatSetupResult()`, `WELL_KNOWN_TIER_PATHS`. `detectTiers()` accepts `{ wellKnownPaths }` opt for test isolation (so the maintainer's `D:/Project/Rune/Pro` doesn't pollute test runs on the same machine).
- **9 new tests** in `compiler/__tests__/setup.test.js` — detectTiers (env var precedence, sibling, business), runSetup (--here, --tier, --dry), formatSetupResult (current/global scope rendering).

### Documentation

- **`README.md`** — new "One-Command Setup (recommended)" section above existing Install/Quick Start. Sample wizard transcript inline. Non-interactive mode examples for CI.
- **`docs/HOOKS.md`** — major restructure. New "Quick start (recommended)" → `rune setup`. Existing flag docs moved to "Manual flags" section. New `rune setup` section with full transcript example, scope comparison table, tier auto-detection priority, non-interactive mode flags.
- **`docs/index.html`** — Install card "Claude Code" updated with 3-step flow (marketplace → install → setup). Wizard mention in subtitle.
- **`CLAUDE.md`** — Commands list now leads with `rune setup`. Mandatory Skill Routing table adds row: "set up rune / install hooks / wire hooks / configure rune / first-time setup" → tell user to run `npx @rune-kit/rune setup`.

### Why the wizard, not just a sleeker flag combo

Bro's v2.17.0 install pain points (paraphrased): "rắc rối" (complicated) — multiple flags to remember, env var to set, must `cd` per project. The wizard collapses 4 decision points (scope / tier / preset / platform) into 3 prompts with sensible defaults + auto-detection. Operators new to Rune get a working setup in 30 seconds without reading docs first; CI scripts get the same flags they had before plus `--here` / `--global` toggle for scope.

Anti-paywall placement: lives in **Free** repo, NOT Pro/Business. Tier-agnostic infrastructure UX shouldn't be paywalled — even free-only users need scope/preset picker. Auto-detect logic lives where tier resolution code already lives (`compiler/commands/hooks/tiers.js`).

### Tests

- **1376 / 1376 pass** (was 1367 — added 9 setup-wizard tests).
- `node compiler/bin/rune.js doctor`: 64 skills, 203 connections, 40 signals, mesh healthy.
- `node compiler/bin/rune.js doctor --hooks`: clean.

---

## [2.17.0] - 2026-05-06

"Quarantine + Hook Drift Reporter" — graft pass from `criznguyen/skills-pack` (operator-owned, Apache 2.0). Adds two diagnostic-focused additions: (1) a Rune-native L3 prompt-injection advisory hook for untrusted external content (MCP user-content, WebFetch, upload Reads), and (2) a hook-drift reporter that compares actual `.claude/settings.json` Rune-managed entries against canonical `buildPreset()` output. Both deliberately scoped as advisories / reporters — neither blocks workflow. One new free skill (63 → 64), 2 new mesh signals, 1 new doctor flag (`--hooks`). Pro pack ships autopilot v1.4.0 split-counter circuit breaker (auto-engages in autopilot mode only — silent in interactive cook).

### Added

- **`quarantine` (L3, new) v0.1.0** — PostToolUse advisory on `mcp__.*|WebFetch|Read` of `**/uploads/**`. Emits `[QUARANTINE-NOTICE: tool_name=… untrusted_surface=true source=…]` into next-turn `hookSpecificOutput.additionalContext`. Default trusted-MCP allowlist (linear, github, jira, atlassian, claude_ai_Google_Drive, neural-memory) skips advisory; operator extends at `~/.claude/quarantine.d/trusted-mcp-allowlist.txt` (read fresh every call — no daemon restart). Per-session disable via `QUARANTINE_DISABLE=1`. Telemetry: 1 JSONL line per matched call to `~/.claude/telemetry.jsonl` — privacy invariant logs only `tool_name + decision + source + session_id` (NEVER tool_input or tool_response body). Hard self-timeout 5000 ms; advisory mode never blocks tool dispatch (always exit 0). Two reference docs: `trusted-mcp-allowlist.md` (default trusted list + customization rules), `quarantine-discipline.md` (`<UNTRUSTED>` author-time pedagogy + layered defense pattern + honest framing of advisory-only nature).
- **`Free/hooks/quarantine/index.cjs`** — Node hook implementation. Reads stdin event JSON, applies tool/path matcher logic (mcp__ namespace check, WebFetch always, Read only for `**/uploads/**` segment match), emits PostToolUse `additionalContext`, appends telemetry. No LLM spawn (independence-of-reviewer principle — hook scans data destined for the LLM, calling LLM from hook collapses audit chain).
- **2 new mesh signals** — `quarantine.notice.emitted` (quarantine → sentinel, integrity-check), `external.content.received` (runtime hook → quarantine, registered in `EXTERNAL_TRIGGER_SIGNALS` whitelist as the entry-point fired by Claude Code's PostToolUse, not by an in-mesh skill).
- **`HOOK_CONSTRAINTS` quarantine entry** — `compiler/transforms/hooks.js` adds inline MUST instruction for non-Claude platforms (cursor / windsurf / antigravity / codex / opencode / generic) attached to skills that use `Read` or `WebFetch` — gives cross-platform fidelity since those platforms have no PostToolUse equivalent.

### Changed

- **`presets.js`** — `WIRED_SKILLS` extended (4 → 5) to include `quarantine`. `buildPreset()` adds PostToolUse block on matcher `mcp__.*|WebFetch|Read` calling `npx @rune-kit/rune hook-dispatch quarantine`. `rune hooks install --preset gentle|strict` now wires quarantine alongside preflight / sentinel / dependency-doctor / completion-gate.
- **`Free/hooks/hooks.json`** — registers Claude Code native plugin path PostToolUse matcher `mcp__.*|WebFetch|Read` → `run-hook.cjs quarantine`.
- **`sentinel` SKILL.md** — listens `quarantine.notice.emitted` (escalate when same untrusted MCP namespace quarantined ≥5× in session — suggests prompt-injection attempt).
- **`integrity-check` SKILL.md** — listens `quarantine.notice.emitted` (bias toward stricter scanning of state files that incorporated quarantined external content).
- **`docs/ARCHITECTURE.md`** — Signal Catalog adds `quarantine.notice.emitted` and `external.content.received` rows.
- **`scripts/validate-signals.js`** — `external.content.received` added to `EXTERNAL_TRIGGER_SIGNALS` whitelist (entry point from PostToolUse runtime hook, not in-mesh emitter).

### Added (Hook Drift Reporter)

- **`rune doctor --hooks`** — new CLI flag. Reads `.claude/settings.json`, compares Rune-managed Free-preset entries against canonical `buildPreset(detectedPreset).hooks`, reports missing canonical entries (preset wired more than installed) + drifted entries (installed command shape differs from canonical). Tier-emitted entries (`${RUNE_PRO_ROOT}` / `${RUNE_BUSINESS_ROOT}`) filtered out — those are tier-managed and have separate check paths. Exit 0 always (reporter, not gate — operator decides what to do with findings). Use case: diagnostic before users file "skill is broken" issues; local drift is a common cause of unexplained hook behavior.
- **`compiler/commands/hooks/drift.js`** — new module exporting `checkHookDrift(projectRoot)` + `formatHookDriftResult(result)`. Sniffs preset from existing `detectPreset()`, falls back to gentle on mixed-preset (with explicit warning).
- **12 new tests** in `compiler/__tests__/hooks-drift.test.js` — clean preset, drift detection, missing entry detection, tier-entry filtering, parse-error handling, mixed-preset warning.

### Pro Pack (separate repo, separate version)

- **`@rune-pro/autopilot v1.3.0 → v1.4.0`** ships in parallel — new Step 8.7 ITERATION BUDGET AUDIT with split read-class (cap 600) / write-class (cap 150) circuit breaker. Auto-engages only when `.rune/autopilot-state.json` is present and unblocked — interactive cook sessions get a single existsSync no-op (~1ms) per tool call. Pro hooks manifest 1.0.1 → 1.1.0, `minFreeVersion: 2.17.0`. See `Pro/CHANGELOG.md` `autopilot-v1.4.0` entry.

### Tests

- 1367 / 1367 pass (was 1355 — added 12 hook-drift tests).
- `node compiler/bin/rune.js doctor`: 64 skills, 203 connections, mesh healthy, 0 errors.
- `node compiler/bin/rune.js doctor --hooks`: drift reporter clean on canonical install.
- `node scripts/validate-signals.js`: 108 signals, all signals valid.

### Honesty Constraints

- Advisory-only — hook fires AFTER model ingested raw `tool_response` body. An attacker who lands directive-shaped content in MCP output, fetched HTML, or uploaded markdown CAN still influence the model's first-turn behavior. The `[QUARANTINE-NOTICE]` only constrains turn 2 onward.
- NOT a replacement for `permissions.deny` egress control. The complete defense is layered: egress (deny) + content advisory (quarantine) + state validation (integrity-check). All three orthogonal — none replaces another.
- `<UNTRUSTED>...</UNTRUSTED>` markers are author-time pedagogy only. Adversarial close-tag spoofing in payloads defeats them as structural defense. Document call-out in `references/quarantine-discipline.md`.
- Structural quarantine (rewrite `tool_response` at boundary before model sees it) is NOT implementable in user-space until Anthropic ships a `PreToolResultCommit` hook. This skill upgrades to structural rewrite when that ships; until then, advisory + egress + state-scan is the honest stack.

---

## [2.16.1] - 2026-05-02

Maturity + housekeeping patch. No new features. Promotes `ba` to its first stable major (v1.0.0) after 10+ months and 13 minor cycles of production use across Pro autopilot multi-session handoffs and the v2.16 Synthesis Mode + Out-of-Scope WRITE workflow. Cleans 4 stale doc lines + 4 dead-signal warnings.

### Changed

- **`ba` v0.13.0 → v1.0.0** — first stable major. No functional changes. The skill has shipped 13 minor releases since first introduced (v0.1.0 → v0.13.0 covering Logic Consistency Check, Artifact Triad, Decision Stop-Loss, Synthesis Mode, Out-of-Scope WRITE, Step 1.5/1.6 read+write loop). Production-stable across BA solo runs, plan-handoff chain, autopilot Pro multi-session handoff, and review-intake Issue Triage Mode → BA grilling fork. Doctor `version maturity` warning now resolves.
- **`Free/CLAUDE.md`** — "Current Wave" caption synced to v2.16.0 (was stale at v2.15.0); test count line synced to 1,349 (was 1,152).
- **`scripts/validate-signals.js`** — added 4 Free-tier terminal-observability signals to `INTENTIONAL_BROADCAST_SIGNALS`: `oracle.failed`, `architecture.shallow.flagged`, `architecture.deletion.passed`, `invariants.seeded`. Cuts CI signal warnings from 30 to 26 (remaining 26 are paid-pack terminals that may gain future listeners — leaving as warnings preserves the dead-signal detector).

### Tests

- 1349 / 1349 pass, doctor clean (zero warnings — `ba` no longer flagged), mesh integrity ✓.

---

## [2.16.0] - 2026-05-01

"Skill Enrichment + Triage Workflow + Output Modes" — second graft pass from `mattpocock/skills` (MIT). Five workflow skills enriched with new behavioral patterns (feedback-loop ladder, vertical-slice planning, caveman output mode, synthesis-mode for BA, agent-brief variant for AFK handoff). Two skills extended into a triage workflow (review-intake Issue Triage Mode + ba Step 1.6 out-of-scope WRITE) — closes the read/write loop on `.out-of-scope/` records and adds a state machine for issue tracker intake. Zero new skills (62 → 62 free), honoring the "less skills, deeper connections" axis.

### Added

- **`debug` v1.2.0 — Step 0: Build Feedback Loop** — new `references/feedback-loop-ladder.md` with a 10-rank ladder (failing test → curl → CLI snapshot → headless browser → trace replay → throwaway harness → fuzz → bisection → differential → HITL script). Step 0 fires before hypothesis formation when repro is slow / non-deterministic / multi-component. Skip if existing repro is already one command, deterministic, < 5s. If loop construction takes > 10 min → triggers 3-Fix Escalation (architecture is the problem, not the bug). Codifies "the loop is the speed limit" — fast deterministic pass/fail signal turns debugging into mechanical bisection.
- **`plan` v1.6.0 — Vertical Slice Mode** — new `references/vertical-slice.md` with tracer-bullet decomposition rules, AFK / HITL slice classification, granularity rules (3-7 files / 1 acceptance criterion / fits in one phase file), per-task slice template. MUST-READ wired in Step 3 (Decompose into Phases). Each task = end-to-end path through schema + API + UI + test, demoable on its own. Stops "horizontal layer" planning that blocks on the slowest layer.
- **`context-engine` v1.2.0 — Caveman Output Mode** — new `references/caveman-mode.md`. Auto-activates on context ORANGE / RED via new `output.density.set` signal; manual trigger via "/caveman" / "be brief" / "less tokens". Strips filler, articles, hedging, pleasantries while preserving full technical accuracy (~75% reduction). Auto-clarity exceptions (revert ONE response, then resume): security warnings, irreversible-action confirmations, multi-step sequences, "explain"/"clarify" requests, root-cause diagnosis. First-response exemption (verbose first, caveman from response 2+).
- **`ba` v0.13.0 — Synthesis Mode (Step 1.4) + Out-of-Scope WRITE (Step 1.6)** — two complementary additions:
  - **Step 1.4 Synthesis Mode** (new `references/synthesis-mode.md`) — when prior conversation contains rich context (pasted spec > 200 words, > 1000 words discussion, continuation session, filled issue template), extract Requirements Document with **mandatory source citations**, then **confirm** instead of re-interview. Skip elicitation if all 5 dimensions filled. Re-asking what the user already told you is the second-most expensive bug.
  - **Step 1.6 Mid-Elicitation Reject WRITE** — complement to existing Step 1.5 READ. When user explicitly rejects a feature mid-elicitation ("scrap it", "drop it", "won't do this"), HARD-GATE writes `.out-of-scope/<slug>.md` before session end. Confirms durable rejection vs. deferral (deferrals route to backlog, not the rejection KB). Lexical-similarity gate (≥0.7 overlap) appends to existing files instead of duplicating. New emit `outofscope.recorded`. +1 tool (`Write`).
- **`context-pack` v0.3.0 — Agent Brief Variant** — new `references/agent-brief.md` for **async / durable handoff** (issue tracker queues, autopilot multi-session work, scheduled cron agents). Adds two principles on top of the standard packet: **durability over precision** (no line numbers in narrative, file paths only in Files Touched) and **behavioral, not procedural** (describe WHAT not HOW). Extra BLOCK-tier smell tests: Category line, Current/Desired behavior split, independently-testable acceptance criteria, type-named Key interfaces.
- **`review-intake` v1.3.0 — Issue Triage Mode** — new `references/issue-triage.md`. Modes split: PR Review (default) vs Issue Triage. State machine: needs-triage → needs-info / ready-for-agent / ready-for-human / wontfix. HARD-GATE: bugs MUST attempt reproduction before `ready-for-agent` (calls `rune:debug` Step 0 if multi-component or intermittent). Vague issues route to `rune:ba` Synthesis Mode for grilling. AGENT-BRIEF emission via `rune:context-pack` agent-brief variant. Wontfix-enhancement reuses Phase 4.5 (existing) `.out-of-scope/` write. Local-only fallback for users without `gh` / Linear MCP. New emits `triage.classified`, `agent.brief.ready`. +1 tool (`Bash`).
- **5 new mesh signals** — `output.density.set` (context-engine → orchestrators), `triage.classified` + `agent.brief.ready` (review-intake → observability + external issue tracker), `outofscope.recorded` (ba / review-intake → observability — discovered downstream via `.out-of-scope/` file scan, not signal listen). All registered in Signal Catalog.
- **`EXTERNAL_TRIGGER_SIGNALS` whitelist** — new validation concept in `validate-signals.js`. External-trigger signals are listened by skills but emitted by users / orchestrators from outside the mesh (entry points like `marketing.campaign.start`, `business.context.loaded`). Symmetrical to existing `INTENTIONAL_BROADCAST_SIGNALS` (emitted but no listener). Both whitelists are intentional skip-lists.

### Changed

- **`debug` Constraints** — added rule 10: MUST run Step 0 (Build Feedback Loop) before forming hypotheses on non-trivial bugs.
- **`plan` Sharp Edges** — added 3 entries: horizontal layer planning, slice-not-demoable, HITL marked liberally.
- **`context-engine` Step 4-5** — emit `output.density.set` to auto-activate caveman on ORANGE / RED.
- **`ba` Step 1.5** — relabeled "(READ)" to clarify split from new Step 1.6 "(WRITE)".
- **`context-pack` Output Format** — added "Variant: Agent Brief" section linking the new reference.
- **`review-intake` description** — broadened from "PR comments / external suggestions" to "PR comments OR issue tracker items"; Modes section added.
- **`marketing-psych` (Pro pack)** — removed `emit: null` / `listen: null` from frontmatter. The skill is reference-only and doesn't participate in the signal mesh; explicit nulls were producing validator errors.
- **`validate-skills.js` Done When check** — regex relaxed from line-anchored (`## Done When[^\n]*\n\n- `) to scope-aware (extract section, test for `\n- ` anywhere within). Fixes false-positive errors on skills using mode-based subsections (cook, doc-processor, docs, git, neural-memory).
- **`docs/SIGNALS.md`** — added 4 new signals to Workflow Lifecycle section.

### Tests

- 1331/1331 tests pass. No new test files added in this batch — enrichments hook into existing skill workflows. Two follow-up test additions queued for next minor: Done-When-with-parens regression test and INTENTIONAL_BROADCAST_SIGNALS membership assertions.

### Provenance

Patterns adapted from [`mattpocock/skills`](https://github.com/mattpocock/skills) (MIT). Round 1 (silent graft, undated): improve-architecture skill, CONTEXT.md format, design-it-twice, scout zoom-out, oracle-mode, grill one-at-a-time, out-of-scope-format. Round 2 (this release): the 5 enriched skills above. Round 2b (this release): triage workflow into review-intake + ba.

## [2.15.0] - 2026-04-27

"Second Opinion + Cross-Provider + Routing Clarity" — extends the `agent.stuck` chain with a stateless second-model semantic pivot, adds an async escalation primitive so heavy-model calls don't block the primary agent, gates expensive context bundles with a token-cost preview, fixes the silent Anthropic bias in 5 non-Anthropic adapters, and improves skill discoverability with quoted descriptions + "Use when…" hints on 13 ambiguous-name skills.

### Added

- **`adversary` v0.2.0 — Mode: oracle** — triggered by `agent.stuck` from `debug` (3 disproved hypotheses) or `fix` (2+ failed attempts). Dispatches a stateless second-model pass with explicit "no prior context" framing to break confirmation-bias loops. Bundle format is regex-validated (`[SYSTEM]` / `[USER]` / `### File N`), token-capped (100k bundle, 4k per file, 12 files max), citation-required reply contract. Secrets auto-redacted before dispatch. 2 new reference docs (oracle-mode, context-bundle-format), 3 new evals.
- **`session-bridge` v0.8.0 — Detach Mode** — async escalation protocol. When oracle-mode dispatches an opus-class second-opinion call, session-bridge writes `.rune/oracle-pending/<sessionId>.json` (pending record schema with idempotency hash, 10min default timeout, status state machine: pending → complete | failed). Primary agent (`cook` Phase 4 / `team` Phase 3) reattaches via filesystem poll between adjacent tasks instead of blocking. Cleanup of orphaned records (>24h) on every session start. 1 new reference doc (detach-protocol).
- **`context-engine` v1.1.0 — Mode: preview** — pre-flight cost gate. Caller (adversary/team/review/audit) emits `context.preview` BEFORE bundle build with file list + estimated token count. context-engine resolves caller-specific threshold and returns action (`proceed | warn | block`). Per-caller defaults: adversary 50k/100k, team 30k/80k, review 40k/100k, audit 60k/120k. Env override via `RUNE_CONTEXT_THRESHOLDS_<CALLER>`. 1 new reference doc (preview-gate).
- **Cross-provider model mapping** — 5 non-Anthropic adapters translate `model: opus|sonnet|haiku` to provider-correct names. codex → gpt-5-pro/gpt-5/gpt-5-mini. antigravity → gemini-3-pro/gemini-3-flash/gemini-3-flash-lite. opencode/openclaw/generic → tier:heavy/mid/light (provider-agnostic). claude/cursor/windsurf remain no-op (Anthropic backend understands native names).
- **Routing clarity sweep** — 43 SKILL.md descriptions now double-quoted (YAML safety). 13 ambiguous-name skills got explicit "Use when…" routing hints: ba, completion-gate, constraint-check, doc-processor, integrity-check, logic-guardian, onboard, preflight, sentinel-env, watchdog, worktree, hallucination-guard, mcp-builder.
- **4 new mesh signals**: `oracle.dispatched`, `oracle.response`, `oracle.failed`, `context.preview`. All registered in Signal Catalog with full emit/listen mapping.

### Changed

- **`debug` v1.1.0** — listens to `oracle.response`. After 3 disproved hypotheses, oracle-mode (semantic pivot) and scout zoom-out (structural pivot) fire in parallel. If `oracle.response` arrives with confidence=high + file:line citations, treated as new hypothesis H_oracle and tested directly (skip 3-cycle gate).
- **`fix` v1.0.x** — listens to `oracle.response`. After 2+ same-file fix failures, oracle-mode dispatches in parallel with scout zoom-out. Recommendations applied through normal validation gates.
- **`cook` Phase 4** — between tasks, glob `.rune/oracle-pending/*.json`; reattach pending dispatches to consume responses or continue with adjacent tasks.
- **`team` Phase 3** — pre-merge oracle reattach sweep ensures no worker stream is blocked on a pending dispatch before coordination.
- **5 adapters get MODEL_MAP**: codex.js, antigravity.js, opencode.js, openclaw.js, generic.js.

### Tests

- +71 tests across 5 new test files: `adapter-model-mapping.test.js` (18), `oracle-bundle-format.test.js` (19), `oracle-pending-schema.test.js` (16), `context-preview-signal.test.js` (13), `skill-description-quality.test.js` (5). Existing 1,260 tests remain green. Total: 1,331.

### Docs

- `docs/ARCHITECTURE.md` — new "Cross-Provider Model Mapping" subsection (tier mapping table, no-op rules, fallback behavior). Signal Catalog +4 (`oracle.dispatched`, `oracle.response`, `oracle.failed`, `context.preview`); `agent.stuck` listeners updated to include adversary.
- `CLAUDE.md` — version reference updated.
- `README.md` — What's New section for v2.15.0.

## [2.14.0] - 2026-04-27

"Deep Modules" — interface as test surface. Adds the `improve-architecture` skill with controlled vocabulary + numeric depth/leverage/locality scoring, hardens TDD against horizontal slicing, persists rejected feature requests in `.out-of-scope/`, makes context-pack handoffs durable, forces real diversity in brainstorm parallel exploration, and adds zoom-out + explore-first micro-utilities.

### Added

- **`improve-architecture` skill v0.1.0** (NEW L2, opus) — surfaces deepening opportunities with controlled vocabulary (Module/Interface/Implementation/Depth/Seam/Adapter/Leverage/Locality), numeric scoring (1-5 per axis), 4 dependency categories (in-process / local-substitutable / remote-owned / true-external), deletion-test verdicts (vanish/concentrate/redistribute), and structured YAML proposal payloads for `surgeon` to consume. 5 reference docs (language, deepening, interface-design, scoring, evals).
- **`test` v1.3.0** — Vertical Slicing HARD-GATE blocks horizontal-test-batching (`bulk_test_count <= 1` enforced), commit-pair audit trail (`test:` + `feat:` per cycle) verified by completion-gate, shape-test smell detector (banned: returns/has property/is defined; required: accepts/rejects/produces/...). 3 new reference docs (vertical-tdd, mocking-policy, test-quality), 5 evals.
- **`ba` v0.11.0** — Step 1.5 Out-of-Scope Match Check (≥0.8 confidence surfaces prior rejection), Step 2.0 Explore-First HARD-GATE (questions require prior tool-call evidence), Step 2.6 CONTEXT.md Cross-Reference Gate (grep verifies user assertions before recording), Step 7.5 Glossary Sharpen with conflict gate (≥0.7 overlap → user choice). 3 new reference docs (out-of-scope-format, context-md-format, explore-first).
- **`journal` v0.4.0** — 3-criteria ADR scoring gate (reversibility + surprisingness + tradeoff_strength, sum >= 11, each axis >= 3), counter-test (rejected alternative required), score-bearing filename pattern `ADR-NNN-<slug>-s<score>.md`. 1 new reference doc (adr-criteria).
- **`review-intake` v1.2.0** — Phase 4.5 Rejection KB Write — every OUT OF SCOPE verdict produces a durable `.out-of-scope/<concept>.md` (or appends to existing); lexical-similarity gate prevents duplicate concepts.
- **`context-pack` v0.2.0** — v2 brief template with mandatory `### Out of scope` and `### Type Surface (durable)` sections, Phase 4.5 regex smell tests (BLOCK on file:line / "line N" / narrative paths; WARN on bare path mentions), behavioral-verb whitelist for Acceptance Criteria. 2 new reference docs (durability-rules, brief-template), 5 evals.
- **`brainstorm` v0.6.0** — Design-It-Twice mode for parallel-subagent interface exploration, 4 standard constraints (C1 minimize / C2 maximize-flexibility / C3 optimize-common-case / C4 ports-and-adapters), diversity-score gate (Jaccard over feature vectors, floor 0.4, threshold 0.6), opt-in hybrid synthesis. 1 new reference doc (design-it-twice).
- **`scout` v0.4.0** — Phase 4.5 Zoom-Out Mode triggered by `agent.stuck` signal; 3-layer ascent (target / siblings / callers) capped at 8 modules per layer, output is Mermaid map.
- **`fix` v1.0.x** — emits `agent.stuck` after 2+ consecutive same-file fix failures.
- **`debug` v1.1.x** — emits `agent.stuck` after 3 disproved hypothesis cycles.
- **`surgeon`** — Calls/Called By updated to consume `improve-architecture.proposal` payloads; replace-don't-layer rule for tests after deepening.
- **5 new mesh signals** registered in Signal Catalog: `tdd.horizontal.violation`, `architecture.shallow.flagged`, `architecture.deletion.passed`, `outofscope.match`, `agent.stuck`.

### Tests

- +81 tests across 6 new test files: `improve-architecture.test.js` (17), `out-of-scope-format.test.js` (9), `adr-scoring.test.js` (10), `context-md-format.test.js` (7), `context-pack-smell-tests.test.js` (13), `diversity-score.test.js` (11), `zoom-out-output.test.js` (8). Existing 1,179 tests remain green. Total: 1,260.

### Docs

- `docs/ARCHITECTURE.md` — Signal Catalog +5, skill counts updated (L2 29 → 30, total 62 → 63), Project Artifacts section adds `.out-of-scope/`, `CONTEXT.md`, score-bearing ADR filenames.
- `CLAUDE.md` — skill counts updated, improve-architecture added to L2 list.
- `README.md` — What's New section for v2.14.0.

## [2.13.0] - 2026-04-23

Script Contract + @rune-pro/media pack. Formalizes the helper-script output contract across the ecosystem, adds 9-tier binary detection to sentinel-env, and ships the long-planned Media pack closing the raster-image gap in Pro.

### Added

- **`@rune-pro/media` pack v1.0.0** — 3 skills (image-generator, prompt-engineer, asset-pipeline), 9 reference files, 3 helper scripts. Supports 5 providers (Codex CLI / DALL-E / Replicate / Stability AI / local SD). 4-gate safety check on prompts (trademark, public-figure, prompt-injection, uncanny-precondition). Multi-resolution + WebP/AVIF + EXIF strip pipeline. Seeds from [darkamenosa/codex-imagen](https://github.com/darkamenosa/codex-imagen) (MIT).
- **`sentinel-env` v0.3.0** — 9-tier binary detection pattern (explicit → skill env → tool env → generic env → platform bundle → PATH → package-manager prefix → platform common dirs → release archive names). Replaces flat `which` lookup.
- **`skill-forge` v1.8.0** — Phase 5.25 "Script Contract": mandatory stdout=paths / stderr=diagnostics / `--json` / `--debug` / `--smoke` / `--prompt-file` / `--dry-run` / semantic exit codes (0/1/2/3/4/124) / OpenClaw artifact-dir resolution for all helper scripts. HARD-GATE on pre-ship.
- **OpenClaw adapter artifact convention** — `generateManifest` emits `artifactConvention` field (output-dir priority + output contract + exit codes). Formalizes cross-adapter de-facto convention.
- **Skill-count-aware description** — OpenClaw manifest description now templated on actual skill count.

### Tests

- +2 tests in `openclaw-adapter.test.js` (artifactConvention field, description-scaling)
- Existing 1,177 tests remain green

### Docs

- `docs/ARCHITECTURE.md` — 4 new signals in catalog (media.request, media.prompt.optimized, media.image.generated, media.assets.processed)
- `CLAUDE.md` — Pro pack list updated with @rune-pro/media
- `README.md` — What's New section for v2.13.0

## [2.12.3] - 2026-04-20

Advisory doctor check for cross-platform tier hook coverage. Closes the Phase 5 Auto-Discipline L2 backlog — the acceptance criterion was marked ✅ in v2.12.0 but never implemented. Non-breaking, advisory only (never flips `healthy: false`).

### Added
- **`rune doctor` tier-coverage check** — warns when a paid tier's hooks are installed unevenly across detected platforms. Example: Pro hooks present in `.claude/settings.json` but no `rune-pro-*` files under `.cursor/rules/` → doctor suggests `rune hooks install --preset gentle --tier pro --platform all`.
- **Required env var check** — when a tier manifest declares `requires: ["RUNE_PRO_ROOT"]` but the var is unset, doctor warns that installed commands will fail at runtime.
- **`listDetectedTiers(projectRoot)`** in `compiler/commands/hooks/tiers.js` — iterates `TIER_ENV_VARS`, returns per-tier status (found, manifestPath, version, requires, requiresOk, requiresMissing).
- **`checkTierCoverage({projectRoot})`** in `compiler/doctor.js` — per tier, checks every `detectPlatforms()` result via `platformHasTier()`. Claude scans settings.json for `${RUNE_<TIER>_ROOT}` substring; Cursor/Windsurf/Antigravity scan rule/workflow dirs for `rune-<tier>-*` files (Windsurf also checks `.windsurf/rules/`).

### Tests
- +30 tests (10 new in `compiler/__tests__/hooks-doctor-tier.test.js`, +20 from downstream wiring)
- 1,177 total (up from 1,147)

### Docs
- `docs/HOOKS.md` — new "Doctor tier-coverage check" section

## [2.12.2] - 2026-04-19

Hotfix for v2.12.1 — version sync across ancillary manifests. Same functionality as v2.12.1, no API changes.

### Fixed
- **Version sync drift**: `plugin.json`, `marketplace.json`, `docs/index.html`, and `ROADMAP.md` were left at 2.12.0 during the v2.12.1 bump, causing `npm run doctor` (and therefore CI + Publish Release workflows) to fail. v2.12.1 tag is retained on GitHub but was never published to npm — v2.12.2 is the first npm-published release of the cross-tier compatibility wave.

## [2.12.1] - 2026-04-19

Cross-tier compatibility polish — same release wave as v2.12.0. No breaking changes.

### Added
- **`minFreeVersion` manifest field** — tier manifests can declare a minimum Free compiler version. `rune hooks install --tier pro` now throws an actionable upgrade error when the local Free is too old (e.g. installing Pro v1.0.1+ against Free < 2.12.1). Prevents silent-failure combinations.
- **`assertFreeVersionCompat()` / `parseSemver()` / `compareSemver()` / `getFreeVersion()`** — exported from `compiler/commands/hooks/tiers.js` for downstream tooling
- **Intentional broadcast signal allowlist** (`INTENTIONAL_BROADCAST_SIGNALS` in `scripts/validate-signals.js`) — signals legitimately fire-and-forget across tiers (e.g. `autopilot.downgraded` emitted by Pro for observability) no longer trigger "unlistened signal" warnings

### Changed
- **"Could not locate tier manifest" error** rewritten with actionable guidance — shows both search locations (env var + monorepo sibling), suggests three concrete fixes (set env, clone sibling, drop `--tier` flag), and links to docs. Replaces the previous one-liner

### Tests
- +13 regression tests (8 for minFreeVersion gate, 2 for error message shape, 3 for signal allowlist)
- 1,165 total (up from 1,152)

## [2.12.0] - 2026-04-19 — "Auto-Discipline"

Rune shifts from **library** to **runtime**. Any agent with Rune installed now auto-fires quality gates at the right moment — no manual skill recall required. 5-phase auto-discipline plan complete.

### Added
- **`rune hooks install`** — writes native hook entries for `.claude/settings.json` (Claude Code). `PreToolUse` / `PostToolUse` / `Stop` auto-invoke preflight, sentinel, dependency-doctor, completion-gate. Presets: `gentle` (WARN), `strict` (BLOCK), `off` (uninstall)
- **Multi-platform hooks** — same install command targets Cursor (`.cursor/rules/rune-*.mdc`), Windsurf (workflow + cascade-rule pair), Antigravity (rule-inject). `--platform all` auto-detects installed IDEs
- **`rune hooks install --tier pro[,business]`** — tier-tagged hook manifests. Pro ships `context-inject` / `context-sense` / `rune-pulse` across all four platforms via declarative `$RUNE_PRO_ROOT/hooks/manifest.json`. Free compiler stays tier-agnostic
- **`rune hooks status --tier pro`** — per-tier coverage report (installed / missing / requires-env)
- **`rune onboard`** INVARIANTS.md seeding — scans project for load-bearing rules, writes scaffold to `.rune/INVARIANTS.md`, injects marker into CLAUDE.md
- **logic-guardian v0.3.0** — consumes `.rune/INVARIANTS.md` in pre-edit gate
- **session-bridge v0.7.0** — emits `invariants.loaded` signal at session start
- **autopilot v1.1.0** (Pro) — listens to `invariants.loaded`, downgrades autonomous → semi-auto on invariant match
- **docs/HOOKS.md** — capability matrix per platform (Free + Pro tiers)

### Security
- Tier-name validator (`TIER_NAME_RE`) prevents path traversal via `--tier ../etc`
- Env-sourced tier roots re-anchored via `path.resolve` so `RUNE_*_ROOT=../` can't escape
- `isRuneStatusLine()` tightened to installer-produced shapes only — user statusLines containing the `rune-pulse` substring no longer silently deleted on uninstall
- Manifest `overrides` field now consumed (`stripHooksBySkill`) — migrates legacy tier entries to new skill names

### Positioning
- **Library → Runtime**: skills no longer passive. `cook`, `preflight`, `sentinel`, `completion-gate` auto-invoke at their natural trigger points
- Differentiator vs ClaudeKit (80 passive skills) and gstack (35 passive skills)

### Stats
- +1152 tests (was 1091 — +26 Phase 5 + 5 review-fix regression + 30 prior phases)
- 4 new compiler modules: `commands/hooks/{install,status,uninstall,tiers,merge,presets}.js`, `adapters/hooks/{claude,cursor,windsurf,antigravity,tier-emitter}.js`
- Biome lint clean, doctor healthy, mesh 62 skills / 194 reciprocal connections

## [2.11.0] - 2026-04-12

### Added
- **DX Review Mode** — audit v0.4.0: Addy Osmani's 8 developer experience principles with scoring rubric and browser-pilot integration
- **Autopilot routing** — skill-router Tier 1 entry for Pro autopilot (keywords: auto, autopilot, autonomous, "làm hết", "đi ngủ")
- **plan v1.5.0** — autopilot as suggested_next after plan approval (Pro-conditional)
- **cook v2.4.0** — remediation cycle counter, upstream inconsistency protocol
- **problem-solver v0.4.0** — Cynefin, SWOT, PESTLE, Porter's Five Forces, ethics framework
- **Auto-publish CI** — GitHub Actions workflow for npm + ClawHub on tag push

### Fixed
- **8 dead mesh wires** — asymmetric Calls/Called By entries across retro, incident, sentinel, onboard, marketing, scaffold
- **5 workflow gaps** — hotfix chain (cook), API versioning check (review), monorepo mode (team+scaffold), progressive rollout (deploy), upgrade campaign (dependency-doctor)
- Stale 61-skill references in landing page thumbnail

## [2.10.0] - 2026-04-06

### Added
- **graft skill** (NEW L2) — port features from external repos with 5-dimension challenge gate
- **plan v1.4.0** — Feature Map system: auto-maintained `.rune/features.md`
- **Mesh Signals v2** — 23 active signals, 14 mesh gaps fixed, signal dispatch ordering

## [2.9.0] - 2026-04-04

### Added
- **marketing v0.4.0** — anti-AI copy rules, expanded SEO audit with schema markup guide
- **Pro growth pack v1.1.0** — 3 new skills + 6 enriched with SEO Machine patterns

## Wave: Design & Quality Enrichment — 2026-04-02

> Enrichment-only work folded into the v2.9.0 release tag (no dedicated version bump at the time). Logged here retroactively on 2026-04-22 for changelog completeness.

### Design
- **design skill** enriched with mood-to-constraint mapping (moods → design tokens), UI-SPEC contract as frontend skill input, 6-pillar audit rubric (accessibility, hierarchy, motion, contrast, typography, spacing), bento archetypes, animation timing ladder
- **UI preflight hook** — design-system token drift check before component generation

### Quality
- **review** — per-function test gap detection (flags functions with no direct test coverage, not just module-level)
- **sentinel** — config leak detection in `.env`, `config/*`, shell history files
- **skill-forge** — Security Model section required per new skill (threat surface, secrets handling, input validation)

## [2.8.0] - 2026-04-01

### Added
- **Anti-Loop Intelligence** — 7 core skills enriched with Memento-Skills patterns
- **cook v2.1.0** — observation/effect ratio tracking, budget-aware phase progression
- **debug v1.0.0** — known error pattern catalog (8 archetypes + fingerprinting)
- **fix v0.8.0** — recovery policy matrix (8 error types → structured actions)

## [2.7.0] - 2026-03-31

### Added
- **Deep Knowledge** — OpenGnothia + Pro enrichment wave
- **context-engine v0.8.0** — compaction technique + stream processing
- **session-bridge v0.5.0** — structured cumulative memory
- **retro v0.3.0** — milestone progressive analysis
- **mcp-builder v0.4.0** — multi-provider adapter pattern
- **onboard v0.4.0** — AI-driven interview mode
- **cook v2.0.0** — prompt-as-API-contract pattern
- **perf v0.3.0** — token budget tracking

## [2.6.0] - 2026-03-30

### Added
- **Mesh Signals** — event-driven skill communication, 17 signals, 15 skills wired
- **`rune status`** — CLI neofetch dashboard (tiered Free/Pro/Biz, --json)
- **`rune visualize`** — interactive mesh graph (Canvas 2D, hover/click/filter)
- **566 tests** → **946 tests** (signals, hooks, status, visualizer)

## [2.5.0] - 2026-03-25

### Added
- **Compiled Intent Mesh (CIM)** — compile-time `skill-index.json` generation with intent keywords, adjacency graph, and chain predictions
- **intent-router hook** — UserPromptSubmit hook that auto-suggests skill routing based on prompt analysis against compiled index
- **Privacy Mesh** — three-tier pre-tool guard (ALLOW/WARN/BLOCK) with content scanning for AWS keys, GitHub tokens, Stripe keys, etc.
- **Per-project privacy config** — `.rune/privacy.json` for custom BLOCK/WARN/ALLOW patterns and elevated skills
- **Skill-aware elevation** — sentinel, review, audit bypass WARN tier; BLOCK tier cannot be bypassed
- **Split pack auto-discovery** — compiler discovers skill files from `skills/` subdir when `format: split` packs have no explicit manifest
- **550 tests** — 18 new tests for skill-index generation, hook behavior, and split pack discovery

### Fixed
- **Command injection** in `version-sync-check.js` — replaced `execSync` with `execFileSync`
- **Dynamic doctor threshold** — skill count no longer hardcoded, scans source directory
- **Split pack builds** — packs with `format: split` but no `skills:` YAML array now build correctly

### Changed
- Skill count: 60→61 (L3: +1 slides)
- Hook count: 8→10 (intent-router, pre-tool-guard rewrite)
- Pre-tool-guard: simple WARN → three-tier Privacy Mesh with content scanning

## [2.4.0] - 2026-03-24

### Added
- **Scripts Bundling** — compiler copies `scripts/` directories and resolves `{scripts_dir}` placeholders in skill output
- **slides** skill (L3) — presentation/slide generation utility
- **Mesh Contract** — `.rune/contract.md` enforced by cook and sentinel

### Changed
- Skill count: 59→60 (L3: 26→27)

## [2.3.0] - 2026-03-22

### Added
- **Tier Override** — compiler resolves Pro/Business skills over Free counterparts with `discoverTieredPacks()`
- Skill-level merging for tiered packs (Pro overrides Free, Business overrides both)
- 8 tests for tier override functionality

### Changed
- Compiler emitter supports multi-tier pack resolution

## [2.2.6] - 2026-03-18

### Improved
- **cook v1.0.0** — Two-stage Mid-Run Signal Detection (keyword fast-path for Cancel/Pause/Status/Steer + context classification for longer messages), Hash-Based Tool Loop Detection (3x warn, 5x force stop, content-aware stuck detection)
- **debug v0.6.0** — Hash-Based Evidence Loop Detection (re-read/re-test/re-grep detection), hypothesis category diversity rule (Data/Control Flow/Environment/State must rotate across cycles)

### Sources
- nextlevelbuilder/goclaw (832★) — two-stage intent classification, SHA256-based loop detection

## [2.2.5] - 2026-03-18

### Improved
- **ba v0.3.0** — Structured Elicitation Frameworks (PICO, INVEST, Jobs-to-be-Done) with decision table for framework selection per requirement type
- **research v0.3.0** — Minimum 3 Complementary Sources HARD-GATE, source type taxonomy, domain diversity rule, triangulation-based synthesis
- **completion-gate v1.4.0** — Default-FAIL QA mindset HARD-GATE, adversarial validation checklist, skeptic sweep on weakest claims

### Sources
- K-Dense claude-scientific-skills (170 skills, literature-review PICO pattern)
- msitarzewski/agency-agents (50.8k★, Default-FAIL QA mindset)

## [2.2.4] - 2026-03-17

### Improved
- **plan v0.6.0** — Workflow Registry 4-view (by Workflow, Component, User Journey, State)
- **team v0.5.0** — NEXUS Handoff Templates with metadata/context/deliverables/quality/evidence
- **cook v0.9.0** — NEXUS-enhanced Cook Report with Deliverables table + Acceptance Criteria tracking

### Sources
- msitarzewski/agency-agents (50.8k★)

## [2.2.3] - 2026-03-15

### Improved
- **7 core skills enriched** from CLI-Anything (17.4k★), GSD (30.8k★), taste-skill (3.4k★)
- test v0.5.0, verification v0.5.0, cook v0.8.0, plan v0.5.0, hallucination-guard v0.3.0, sentinel-env v0.2.0, completion-gate v1.3.0

## [2.2.2] - 2026-03-14

### Improved
- **4 core skills enriched** from superpowers (89k★)
- review v0.3.0, review-intake v1.1.0, skill-forge v1.2.0, completion-gate v1.2.0

## [2.2.1] - 2026-03-14

### Added
- **Enforcement Upgrade** — Antigravity-level IDE compliance across all platforms
  - skill-router v1.2.0: 5-type Request Classifier (CODE_CHANGE|QUESTION|DEBUG|REVIEW|EXPLORE), File Ownership Matrix, Self-Verification HARD-GATE, Routing Proof line
  - brainstorm v0.4.0: Problem Restatement requirement, Dynamic Questioning (P0/P1/P2)
  - cook v0.6.0: Clarification Gate (2-question minimum), Phase Transition Protocol
  - `compiler/transforms/compliance.js`: distributes enforcement preamble to all non-Claude platform builds
- **L4 Pack Enrichment** — all 13 free packs now rated Deep (500+ lines)
  - @rune/ecommerce 675→1212: multi-currency, fraud detection, checkout optimization, search/filtering, webhooks
  - @rune/content 382→1567: search integration, newsletter, scheduling, accessibility, rich media, analytics
  - @rune/gamedev 393→1513: multiplayer/networking, audio, input, ECS, particles, camera, scene management
- Antigravity Kit gap analysis documentation

### Changed
- Compiler pipeline: 7→8 stages (added compliance transform after subagents, before hooks)
- Free pack total lines: 8,253→11,096
- Grand total across 19 packs: 14,170→17,013

## [2.2.0] - 2026-03-09

### Added
- **OpenCode adapter** — 8th supported platform
- **Skills catalog page** — browsable skill listing
- Guides and documentation updates

## [2.1.1] - 2026-03-12

### Added
- **tools: field** on all 55 skills — permission scope per skill
- **@rune-pro/sales** pack (6 skills, private repo)
- **@rune-pro/data-science** pack (7 skills, 1356 lines)
- **@rune-pro/support** pack (6 skills, 802 lines)
- **@rune/chrome-ext** pack (6 skills, 995 lines, FREE)

### Changed
- L4 Tier 1 packs enriched: ui 225→947, security 216→536, backend 257→678, saas 276→805
- Pricing model: subscription → lifetime ($49 Pro, $149 Business)
- Pro packs moved to private repo (rune-kit/rune-pro)

## [2.1.0] - 2026-03-11

### Added
- **6 new skills** (55→58 after adversary + sentinel-env later): ba, scaffold, docs, git, mcp-builder, doc-processor
- **cook v0.5.0**: Phase-aware execution, phase-file resume, master plan tracking
- **plan v0.4.0**: Amateur-Proof Template with master plan + phase files
- **@rune-pro/product** pack (6 skills, 1253 lines)
- **@rune/trading**: experiment-loop skill

### Changed
- Skill count: 49→55 (L1: 4→5, L2: 23→26, L3: 21→23)
- Mesh connections: 170+→200+

## [2.0.0] - 2026-03-08

### Added
- **Multi-platform compiler** — 3-stage pipeline (Parse → Transform → Emit)
- 6 compiler transforms: cross-refs, tool-names, frontmatter, subagents, hooks, branding
- 5 platform adapters: claude, cursor, windsurf, antigravity, generic
- CLI: `npx @rune-kit/rune init|build|doctor`
- All 49 skills compile to ALL platforms with zero knowledge loss

### Changed
- Architecture: from Claude-Code-only to multi-platform mesh

## [1.5.1] - 2025-03-05

### Added
- **Agent Skills standard compliance** — adopted frontmatter fields from Anthropic's official skills spec.
- `context: fork` on all L1 orchestrators (cook, team, launch, rescue) — run in isolated subagent context.
- `disable-model-invocation: true` on side-effect skills (launch, deploy, incident) — prevents Claude from auto-triggering deployments or incident responses.
- `user-invocable: false` on internal L3 utilities (completion-gate, constraint-check, integrity-check, context-engine, scope-guard, worktree, skill-router) — Claude-only background skills.
- Dynamic context injection (`!`command``) on skill-router — injects live routing overrides and skill metrics before Claude reads the routing table.
- Pushy descriptions on all L1 orchestrators — prevents undertriggering per Anthropic's best practice.
- Explicit `skills[]` array in marketplace.json listing all 49 skill paths.

## [1.5.0] - 2025-03-05

### Added
- **logic-guardian** (L2, Quality group) — protects complex business logic from accidental AI deletion/overwrite. Maintains `.rune/logic-manifest.json`, enforces pre-edit gates, validates post-edit diffs.
- **trade-logic** skill in `@rune/trading` extension — trading-specific logic preservation: entry/exit specs, indicator parameter registry, production-backtest sync, state machine documentation, backtest result linkage.
- **docs/TRADE-MATRIX.md** — complete NxN skill-to-skill delegation matrix (4 matrices: L1->L2, L2<->L2, L1/L2->L3, L3->L3 exceptions).
- Plugin instruction feed for proactive skill usage across all projects.
- Session-start hook loads `logic-manifest.json` when present.
- CHANGELOG.md (this file).

### Changed
- Skill count: 48 -> 49 (L2 hubs: 22 -> 23).
- Mesh connections: 160+ -> 170+.
- Updated skill-router routing table with logic-guardian entry.
- Updated ARCHITECTURE.md, README.md, marketplace.json with new counts.

## [1.4.0] - 2025-03-03

### Added
- Behavioral contexts (dev, research, review modes) injected via `.rune/active-context.md`.
- Pre-compact hook preserves critical context before auto-compaction.
- Enhanced cook with L4 extension pack detection (Phase 1.5).
- Enhanced launch with artifact dependency scanning.
- Cross-IDE analysis documentation.

## [1.3.0] - 2025-02-28

### Added
- H3 Intelligence: mesh analytics, adaptive routing, community packs.
- metrics-collector hook captures skill invocations to tmpdir JSONL.
- context-watch extended with tool counters and session timestamp.
- post-session-reflect flushes metrics to `.rune/metrics/`.
- audit Phase 8: Mesh Analytics (`/rune metrics`).
- skill-router Step 0: adaptive routing via `routing-overrides.json`.
- cook Phase 8: skill-sourced metrics and auto routing overrides.
- `/rune pack` commands for community L4 packs.
- `docs/COMMUNITY-PACKS.md` guide.

## [1.2.0] - 2025-02-27

### Added
- Wave 2: SAST skill, constraint-check skill.
- Pre-tool-guard hook, secrets-scan hook.
- Updated plugin manifest with hook definitions.

## [1.1.0] - 2025-02-26

### Added
- Option A lean upgrade: 10 patches across existing skills, 2 new skills, 1 hook.
- skill-forge and review-intake skills.

## [1.0.0] - 2025-02-25

### Added
- Initial release: 44 core skills across 5-layer mesh architecture.
- L0 Router (skill-router), L1 Orchestrators (cook, team, launch, rescue).
- L2 Workflow Hubs and L3 Utilities.
- 12 L4 Extension Packs.
- Cross-session persistence via `.rune/` directory.
