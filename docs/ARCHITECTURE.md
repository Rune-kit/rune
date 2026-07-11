# Rune Architecture

## 5-Layer Model

| Layer | Name | Count | Can Call | Called By | State |
|-------|------|-------|----------|----------|-------|
| **L0** | **Router** | **1** | **L1-L3 (routing)** | **Every message** | **Stateless (rule-based)** |
| L1 | Orchestrators | 5 | L2, L3 | L0, User | Stateful (workflow) |
| L2 | Workflow Hubs | 30 | L2 (cross-hub), L3 | L1, L2 | Stateful (task) |
| L3 | Utilities | 28 | Nothing (pure)* | L1, L2 | Stateless |
| L4 | Extension Packs | 14 free + 9 pro + 4 business | L3 | L2 (domain match) | Config-based |

### L0 — The Enforcement Layer

`skill-router` is the only L0 skill. It enforces a single discipline: **check the routing table before every response**. It doesn't do work — it ensures the right skill does the work.

- Loaded via plugin description, always active
- Routes user intent to the correct L1-L3 skill
- Prevents agents from bypassing skills ("I'll just do it manually")
- See `skills/skill-router/SKILL.md` for the full routing table and anti-rationalization gate

### L4 — Extension Packs (Activation Protocol)

L4 packs are domain-specific instruction sets stored as `extensions/*/PACK.md` files. They are activated (read) in two ways:

**1. Explicit invocation** — User runs `/rune <pack-skill>` (e.g., `/rune rag-patterns`)
   - `skill-router` detects the L4 trigger in Tier 4 routing table
   - Agent reads `extensions/<pack>/PACK.md`
   - Agent follows the matching skill's Workflow steps

**2. Implicit detection** — `cook` detects domain context in Phase 1.5
   - Scout output reveals domain signals (e.g., `three.js` in dependencies)
   - Cook matches against L4 pack mapping table
   - Agent reads matching PACK.md and applies its constraints/patterns
   - Domain patterns supplement cook's standard phases

**L4 calling rules:**
- L4 CAN call L3 utilities (scout, verification, hallucination-guard)
- L4 CANNOT call L1 or L2 skills
- L4 CANNOT call other L4 packs (no cross-pack dependencies)
- If L4 pack file not found on disk, skip silently (graceful degradation)

### Exceptions

- `team` (L1) can call other L1 orchestrators — meta-orchestration pattern.
- *L3→L3 coordination: `context-engine` → `session-bridge`, `hallucination-guard` → `research`, `session-bridge` → `integrity-check` (documented in SKILL.md).

## Mesh Protocol

### Loop Prevention

```
Rule 1: No self-calls (history[-1] !== target)
Rule 2: Max 2 visits to same skill per chain
Rule 3: Max chain depth: 8
Rule 4: If blocked → escalate to L1 orchestrator
```

### Model Auto-Selection

```
Read-only / scan?           → haiku   (cheapest)
Write / edit / generate?    → sonnet  (default)
Architecture / security?    → opus    (deep reasoning, ceiling)

Override: priority=critical → always opus
Override: budget constraint → downgrade
Override: user preference   → manual in config
```

The three tiers map to what a subscription runtime (Claude Code, Cursor, etc.)
can actually run. `opus` is the routing ceiling on purpose. A hypothetical
"most-capable" tier above opus (Anthropic Fable, API-only) is **not** a routing
tier — it is unavailable to subscription users and would resolve to nothing on
the primary audience. Fable-class API models belong in **oracle-mode /
cross-model-escalation** (adversary, session-bridge), where Rune deliberately
calls OUT to an external, colder, different-architecture model for a second
opinion — see `skills/adversary/references/oracle-mode.md`.

The starting model is irrelevant to routing correctness: a skill's `model:`
hint pins the tier when the skill is spawned as a subagent, so an orchestrator
running at any tier delegates execution down to the hinted tier. A more capable
starting model just means richer top-level planning before work is delegated
down — the ideal shape for the hardest tasks (state the full goal up front, run
high-effort, delegate to sub-agents).

### Behavioral Modes (v2.16+)

Mode-based execution variants that activate inside existing skills based on signals or input context. Modes do NOT add new skills — they expand the behavior surface of existing skills.

| Mode | Skill | Activation | Behavior |
|------|-------|------------|----------|
| **Caveman Output** | `context-engine` (broadcast) | Auto on context ORANGE / RED, manual via `/caveman` / "be brief" | Strips filler / articles / hedging while preserving full technical accuracy. ~75% output reduction. Auto-clarity exception for security warnings, irreversible-action confirmations, multi-step sequences. |
| **Synthesis** | `ba` (Step 1.4) | Pasted spec > 200 words, conversation > 1000 words, continuation session, filled issue template, explicit "synthesize" | Extract Requirements Document from existing context with mandatory source citations, then confirm instead of re-interview. Skip 5-question elicitation if all 5 dimensions filled. |
| **Vertical Slice** | `plan` (Step 3) | Default for any feature with 3+ phases | Tracer-bullet task decomposition: each task = end-to-end path through schema + API + UI + test, demoable on its own. AFK / HITL classification. Replaces horizontal layer planning. |
| **Feedback Loop (Step 0)** | `debug` | Repro is slow / non-deterministic / multi-component / intermittent | Construct fast deterministic pass/fail signal from 10-rank ladder BEFORE forming hypotheses. Skip if existing repro is one command, deterministic, < 5s. > 10 min construction → 3-Fix Escalation (architecture, not bug). |
| **Issue Triage** | `review-intake` | Input is issue tracker item (not PR comment), `--inbox` flag, or "triage" / "process the inbox" | State machine (needs-triage → needs-info / ready-for-agent / ready-for-human / wontfix). Repro-first HARD-GATE for bugs. AGENT-BRIEF emission for `ready-for-agent`. Wontfix-enhancement writes `.out-of-scope/<slug>.md`. |
| **Agent Brief Variant** | `context-pack` | Async / durable handoff (issue tracker queue, autopilot, scheduled cron, > 1 hour delay) | Behavioral over procedural; type names over file:line; survives codebase drift between handoff and execution. Adds Category / Current behavior / Desired behavior / Out of scope sections. |
| **Out-of-Scope WRITE (Step 1.6)** | `ba` | Mid-elicitation explicit rejection ("scrap it", "drop it") | HARD-GATE writes `.out-of-scope/<slug>.md` before session end. Confirms durable rejection vs deferral. Lexical-similarity gate appends to existing files. Closes the read/write loop on `.out-of-scope/` records (Step 1.5 reads them). |

Mode discovery is automatic via signals + input pattern matching. Cook / team / rescue do NOT need to manually select modes — the called skill detects activation conditions and switches behavior.

### Cross-Provider Model Mapping (v2.15+)

SKILL.md frontmatter uses Anthropic-native tier names (`opus`/`sonnet`/`haiku`) as the canonical authoring vocabulary. Adapters translate this hint to provider-correct model names so the field is meaningful in every compiled output:

| Tier | claude / cursor / windsurf | codex | antigravity | opencode / openclaw / generic / qoder | qwen | gemini | aider / copilot |
|------|---------------------------|-------|-------------|---------------------------------------|------|--------|------------------|
| opus | claude-opus-4-8 (no-op) | gpt-5.6-sol | gemini-3-pro | tier:heavy | qwen3-coder-plus | gemini-2.5-pro | tier-hint inline |
| sonnet | claude-sonnet-5 (no-op) | gpt-5.6-terra | gemini-3-flash | tier:mid | qwen3-coder | gemini-2.5-flash | tier-hint inline |
| haiku | claude-haiku-4-5 (no-op) | gpt-5.6-luna | gemini-3-flash-lite | tier:light | qwen3-coder-flash | gemini-2.0-flash-lite | tier-hint inline |

> **Verified at source (2026-07): Claude** (Opus 4.8 / Sonnet 5 / Haiku 4.5,
> Anthropic catalog) and **Codex** (GPT-5.6 sol/terra/luna, developers.openai.com/codex/models).
> Codex also gained a per-config reasoning control — `model_reasoning_effort =
> minimal|low|medium|high|xhigh` (and `plan_mode_reasoning_effort`). The codex
> adapter now surfaces a suggested tier→effort mapping (opus→high, sonnet→medium,
> haiku→low) in the generated `AGENTS.md` — not as per-skill frontmatter, since
> `model_reasoning_effort` is a global `config.toml` key. **Still pending verification:**
> gemini and qwen provider IDs. Note: **Gemini CLI retired 2026-06-18 → Antigravity
> CLI** (free/individual tier); the `gemini` adapter target is legacy for that
> audience. **Windsurf is now Devin Desktop (2026-06-02)** — rules moved to
> `.devin/rules/` (with `.windsurf/rules/` fallback), skills to `.devin/skills/`.

Rules:
- Anthropic-backed adapters (claude/cursor/windsurf) understand the native names — adapter is no-op
- Concrete-provider adapters (codex/antigravity/qwen/gemini) emit recognizable provider model names
- Provider-agnostic adapters (opencode/openclaw/generic/qoder) emit `tier:heavy|mid|light` semantic hints — the consuming runtime resolves to its configured provider model
- Hint-only adapters (aider/copilot) embed the tier as a comment / inline text — those CLIs read model from their own config, not from rule files
- Skills without `model:` produce no model field in any adapter
- Unknown tier values pass through unchanged (forward-compatibility for new tiers)

### Cross-Platform Adapter Coverage (v2.18+)

Rune compiles core skills + extension packs into 13 platform-native formats. Each adapter targets a documented file convention; Rune emits the files, the platform's native loader picks them up.

| Adapter | Output | Skill Format | Extra Files | Source Doc |
|---------|--------|--------------|-------------|------------|
| **claude** | (passthrough) | native SKILL.md | — | Anthropic Claude Code |
| **cursor** | `.cursor/skills/rune-<n>/SKILL.md` | dir-per-skill Agent Skills (Cursor 2.4+) | — | cursor.com/docs/skills |
| **windsurf** | `.windsurf/skills/rune-<n>/SKILL.md` | dir-per-skill Cascade Skills | — | docs.devin.ai (Windsurf → Devin Desktop 2026-06-02; `.devin/skills` preferred, `.windsurf/` still read as fallback — emission kept for max compat) |
| **antigravity** | `.agents/skills/rune-<n>/SKILL.md` | dir-per-skill, Gemini model map | — | antigravity.google/docs/skills |
| **codex** | `.agents/skills/rune-<n>/SKILL.md` | dir-per-skill, OpenAI tier | `AGENTS.md` | developers.openai.com/codex/skills |
| **opencode** | `.opencode/skills/rune-<n>/SKILL.md` | dir-per-skill, tier hints | — | opencode.ai/docs |
| **openclaw** | `.openclaw/.../SKILL.md` | bundled with manifest + TS entry | `openclaw.plugin.json`, `src/index.ts` | OpenClaw |
| **generic** | `.ai/rules/rune-<n>.md` | portable markdown | — | (fallback) |
| **aider** | `aider/rules/rune-<n>.md` | flat markdown + tier inline | `.aider.conf.yml` (read[]), `CONVENTIONS.md` | aider.chat |
| **copilot** | `.github/skills/rune-<n>/SKILL.md` | dir-per-skill Agent Skills | `.github/copilot-instructions.md`, `AGENTS.md` | docs.github.com |
| **gemini** | `.gemini/skills/rune-<n>/SKILL.md` | dir-per-skill, lazy-loaded natively | `GEMINI.md` (slim pointer) | geminicli.com/docs/cli/skills |
| **qoder** | `.qoder/skills/rune-<n>/SKILL.md` | dir-per-skill, YAML w/ tier:* | `AGENTS.md` | docs.qoder.com |
| **qwen** | `.qwen/skills/rune-<n>/SKILL.md` | dir-per-skill, Qwen model hint | `QWEN.md` (slim pointer) | qwenlm.github.io |

Adapters with `generateExtraFiles()` emit additional context files alongside per-skill rules — this generic hook (added v2.18) replaces ad-hoc `if (adapter.name === ...)` special cases in the emitter.

### Parallel Execution

| Context | Max Parallel | Reason |
|---------|-------------|--------|
| L3 utilities (haiku) | 5 | Cheap, fast, independent |
| L2 hubs (sonnet) | 3 | Moderate cost, may share context |
| L1 orchestrators | 1 | Only one orchestrator at a time |

### Error Handling & Resilience

| If this fails... | Try this instead... |
|-------------------|---------------------|
| debug can't find cause | problem-solver (different reasoning) |
| docs-seeker can't find | research (broader web search) |
| browser-pilot can't capture | verification (CLI checks) |
| scout can't find files | research + docs-seeker |
| test can't run (env broken) | deploy fix env → test again |
| review finds too many issues | plan re-scope → fix priorities |

## Skill Groups

### L1 Orchestrators

| Skill | Model | Role |
|-------|-------|------|
| cook | sonnet | Feature implementation orchestrator (v0.5.0 — phase-aware execution) |
| team | opus | Multi-agent parallel orchestrator |
| launch | sonnet | Deploy + marketing orchestrator |
| rescue | sonnet | Legacy refactoring orchestrator |
| scaffold | sonnet | Project bootstrap orchestrator (BA-powered, 9-phase pipeline) |

### L2 Workflow Hubs

| Group | Skills |
|-------|--------|
| CREATION | plan, scout, brainstorm, design, skill-forge, ba, mcp-builder, graft |
| DEVELOPMENT | debug, fix, test, review, db |
| QUALITY | sentinel, preflight, onboard, audit, perf, review-intake, logic-guardian |
| DELIVERY | deploy, marketing, incident, docs |
| RESCUE | autopsy, safeguard, surgeon |
| SECURITY | adversary |
| VELOCITY | retro |

### L3 Utilities

| Group | Skills |
|-------|--------|
| KNOWLEDGE | research, docs-seeker, trend-scout |
| REASONING | problem-solver, sequential-thinking, council |
| VALIDATION | verification, hallucination-guard, integrity-check, completion-gate, constraint-check, sast, converge |
| STATE | context-engine, context-pack, journal, session-bridge, neural-memory |
| MONITORING | watchdog, scope-guard |
| MEDIA | browser-pilot, asset-creator, video-creator, slides |
| DEPS | dependency-doctor |
| WORKSPACE | worktree |
| GIT | git |
| DOCUMENTS | doc-processor |
| SECURITY | sentinel-env |

## Runtime Layer (v2.12.0)

The mesh ships as a **library** (invoke via slash commands) and as a **runtime** (native hooks that auto-fire on tool use). The runtime converts passive advice into enforced discipline.

### Hook adapter registry

`compiler/adapters/hooks/{claude,cursor,windsurf,antigravity}.js` — one adapter per platform. Each accepts:

- `preset` — `strict` | `gentle` | `off`
- `tierManifests` — loaded declarative hook specs from Pro/Business

The adapter translates the preset + tier manifests into the platform's native hook format (Claude `.claude/settings.json`, Cursor `.cursor/rules`, Windsurf workflow+rule, Antigravity rule-inject). Free-core adapters are tier-agnostic — they receive already-parsed manifests and do not hardcode Pro/Business awareness.

### Tier-tagged manifest

Paid tiers ship a declarative spec at `$<TIER>_ROOT/hooks/manifest.json`:

```json
{
  "tier": "pro",
  "version": "1.0",
  "hooks": [
    { "id": "context-inject", "event": "UserPromptSubmit", "command": "...", "claudeOnly": false },
    { "id": "context-sense", "event": "PreToolUse", "matcher": "Edit|Write", "command": "..." }
  ],
  "overrides": { "context-watch": "context-sense" }
}
```

`Free/compiler/commands/hooks/tiers.js` resolves `$<TIER>_ROOT` via env var with monorepo sibling fallback (`<projectRoot>/../<Capitalized-Tier>/hooks/manifest.json`), sanitizes the tier name (`^[a-z][a-z0-9-]{0,31}$`), and re-anchors paths to prevent traversal.

### Layered merge

`mergePreset()` strips all Rune-managed entries once, then `appendHookBlock()` layers Free preset → Pro → Business additively. `isRuneManaged()` combines `RUNE_DISPATCH_RE` (npx shape) and `RUNE_TIER_RE` (`${RUNE_*_ROOT}` shape) so uninstall/re-install is idempotent. User-authored hooks in the same events are preserved verbatim.

### Invocation

```bash
rune hooks install --preset gentle                            # Free only
rune hooks install --preset gentle --tier pro                 # Free + Pro
rune hooks install --preset gentle --tier pro --tier business # full stack
rune hooks status                                             # inspect wiring
rune hooks uninstall                                          # remove Rune entries only
```

## Mesh Signals (v2.10.0)

Event-driven skill communication via frontmatter declarations. Skills declare what signals they `emit` and `listen` to — the compiler builds a signal graph and validates consistency.

### Frontmatter

```yaml
metadata:
  emit: code.changed, tests.passed
  listen: plan.ready, codebase.scanned
```

### Signal Naming

Lowercase, dot-separated: `<domain>.<event>` (e.g. `code.changed`, `tests.failed`, `deploy.complete`).

### Signal Catalog

| Signal | Emitters | Listeners |
|--------|----------|-----------|
| `code.changed` | fix | test, sentinel, review, preflight, verification |
| `tests.passed` | test | deploy |
| `tests.failed` | test | debug |
| `tdd.horizontal.violation` | test | completion-gate, preflight |
| `architecture.shallow.flagged` | improve-architecture, audit | surgeon, review |
| `architecture.deletion.passed` | improve-architecture | audit |
| `outofscope.match` | ba | review-intake, cook, plan |
| `agent.stuck` | fix, debug | scout, adversary |
| `oracle.dispatched` | adversary | session-bridge |
| `oracle.response` | adversary | debug, fix |
| `oracle.failed` | adversary, session-bridge | debug, fix |
| `context.preview` | context-engine | adversary, team, review, audit |
| `security.passed` | sentinel | deploy |
| `security.blocked` | sentinel | fix, plan |
| `review.complete` | review | cook |
| `review.issues` | review | fix |
| `plan.ready` | plan | cook |
| `codebase.scanned` | scout | plan, brainstorm |
| `phase.complete` | cook, team | session-bridge |
| `deploy.complete` | deploy | watchdog |
| `bug.diagnosed` | debug | fix |
| `docs.updated` | docs | — |
| `audit.complete` | audit | — |
| `db.migrated` | db | — |
| `verification.complete` | verification | cook, converge |
| `integration.verified` | verification | deploy |
| `convergence.gaps` | converge | cook |
| `convergence.clean` | converge | cook, deploy |
| `graft.complete` | graft | cook |
| `ideas.ready` | brainstorm | cook |
| `preflight.passed` | preflight | cook |
| `project.onboarded` | onboard | plan |
| `incident.detected` | — | incident |
| `media.request` | — | @rune-pro/media: image-generator, prompt-engineer |
| `media.prompt.optimized` | @rune-pro/media: prompt-engineer | @rune-pro/media: image-generator |
| `media.image.generated` | @rune-pro/media: image-generator | @rune-pro/media: asset-pipeline |
| `media.assets.processed` | @rune-pro/media: asset-pipeline | @rune-pro/growth: landing-builder, slides |
| `growth.activation.audited` | @rune-pro/growth: activation-cro | @rune-pro/growth: experiment-designer, cro-analyst |
| `growth.experiment.designed` | @rune-pro/growth: experiment-designer | @rune-pro/growth: cro-analyst (post-test feedback) |
| `growth.acquisition.loop.designed` | @rune-pro/growth: acquisition-loops | @rune-pro/growth: launch-playbook, post-writer, landing-builder |
| `growth.launch.phase.shipped` | @rune-pro/growth: launch-playbook | @rune-pro/growth: activation-cro, post-writer, landing-builder, cro-analyst |
| `growth.paid.campaign.planned` | @rune-pro/growth: paid-acquisition | @rune-pro/growth: post-writer, experiment-designer; @rune-pro/media: asset-pipeline |
| `business.pricing.band.set` | @rune-pro/finance: pricing-architect | @rune-pro/growth: paid-acquisition |

> **Cross-pack signal payload schemas** (versioned for safe evolution):
>
> `business.pricing.band.set` (v1) — first cross-TIER signal (Business → Pro):
> ```yaml
> signal_version: v1
> arpu_usd: float                    # ARPU at recommended tier (typically "Better")
> margin_rate: float                 # gross margin rate
> payback_months: int                # informational — Pro consumer uses its own operator-input payback target
> churn_delta_pp: float              # projected churn impact from any price change (informational)
> pmc: float                         # Van Westendorp PMC
> pme: float                         # Van Westendorp PME
> opp: float                         # Van Westendorp OPP
> idp: float                         # Van Westendorp IDP
> n_respondents: int                 # PSM sample size (≥ 50 minimum)
> recommended_tier_prices: [float]   # Good / Better / Best
> ```
> Schema changes require version bump + listener-compatibility shim. Listeners (paid-acquisition) read fields by name; missing fields fall back to cost-floor.
| `output.density.set` | context-engine | *(orchestrators dynamically — cook, team, rescue)* |
| `triage.classified` | review-intake | *(observability)* |
| `agent.brief.ready` | review-intake | *(external — issue tracker)* |
| `outofscope.recorded` | ba, review-intake | *(observability — discovered via .out-of-scope/ file scan)* |
| `quarantine.notice.emitted` | quarantine | sentinel, integrity-check |
| `external.content.received` | *(external — runtime hook on `mcp__*` / WebFetch / upload-Read)* | quarantine |
| `council.dispatched` | council | *(observability — Pro Cockpit reads `.rune/council/run-*.json` directly)* |
| `council.result` | council | *(observability — Pro Cockpit reads `.rune/council/run-*.json` directly)* |

### Validation

- `node scripts/validate-signals.js` — checks all signals for consistency
- Every `listen` must have a matching `emit` (hard error)
- Unlistened emitters generate warnings (acceptable for external consumers)
- Two whitelists for intentional exceptions:
  - `INTENTIONAL_BROADCAST_SIGNALS` — emitted but no skill listens (observability, cross-tier, dynamically-consumed by orchestrators). Examples: `output.density.set`, `triage.classified`, `agent.brief.ready`, `outofscope.recorded`, `autopilot.downgraded`.
  - `EXTERNAL_TRIGGER_SIGNALS` — listened but no skill emits (entry points fired by users / orchestrators / hooks from outside the mesh). Examples: `marketing.campaign.start`, `business.context.loaded`.
- Signal graph compiled into `skill-index.json` under the `signals` key

### Design Principles

1. **Declarative, not runtime** — signals are metadata for discovery and validation, not a pub/sub bus
2. **Graph-based, not linear** — one signal can trigger multiple listeners in parallel (vs. before/after hooks)
3. **Layer-agnostic** — any skill at any layer can emit or listen
4. **Extensible** — extension packs can declare their own signals

## Cross-Hub Mesh (L2 ↔ L2)

```
plan ↔ brainstorm     (creative ↔ structure)
fix ↔ debug           (fix ↔ root cause)
test → debug          (unexpected failure)
review → test         (untested edge case found)
review → fix          (bug found during review)
review → review-intake (external feedback received on reviewed code)
review-intake → fix   (verified feedback → apply changes)
review-intake → test  (reviewer found untested edge case)
review-intake → sentinel (reviewer flagged security concern)
fix → test            (verify after fix)
deploy → test         (pre-deploy verification)
debug → scout         (find related code)
marketing → scout     (analyze assets)
plan → scout          (scan before planning)
fix → review          (self-review complex fix)
review → scout        (more context needed)
surgeon → safeguard   (untested module found)
preflight → sentinel  (security sub-check)
audit → sentinel      (security phase delegation)
audit → autopsy       (complexity/health phase)
audit → dependency-doctor (deps phase delegation)
audit → scout         (discovery phase)
audit → journal       (save audit report)

# perf
perf ← cook           (Phase 5 quality gate)
perf ← audit          (performance dimension delegation)
perf ← review         (performance patterns detected in diff)
perf ← deploy         (pre-deploy perf regression check)
perf → scout          (find hotpath files)
perf → browser-pilot  (Lighthouse / Core Web Vitals)
perf → verification   (run benchmark scripts if configured)

# db
db ← cook             (schema change detected in diff)
db ← deploy           (pre-deploy migration safety check)
db ← audit            (database health dimension)
db → scout            (find schema/migration files)
db → verification     (run migration in test env)
db → hallucination-guard (verify SQL syntax and ORM methods)

# incident
incident ← launch     (watchdog alerts during Phase 3 VERIFY)
incident ← deploy     (health check fails post-deploy)
incident → watchdog   (current system state — what's down)
incident → autopsy    (root cause after containment)
incident → journal    (record incident timeline)
incident → sentinel   (check for security dimension)

# design
design ← cook         (frontend task detected, no design-system.md)
design ← review       (AI anti-pattern detected in diff)
design ← perf         (Lighthouse Accessibility BLOCK)
design → scout        (detect platform, tokens, component library)
design → asset-creator (generate base visual assets from design system)

# skill-forge
skill-forge ← cook    (feature being built IS a new skill)
skill-forge ← plan    (plan identifies need for reusable skill)
skill-forge → scout   (scan existing skills for overlap)
skill-forge → plan    (structure complex multi-phase skills)
skill-forge → hallucination-guard (verify referenced skills exist)
skill-forge → verification (validate SKILL.md format)
skill-forge → journal (record skill creation ADR)

# review-intake
review-intake ← cook  (Phase 5: external review arrives)
review-intake ← review (self-review surfaces issues to address)
review-intake → scout  (verify reviewer claims against codebase)
review-intake → fix    (apply verified changes)
review-intake → test   (add tests for reviewer-found edge cases)
review-intake → hallucination-guard (verify suggested APIs exist)
review-intake → sentinel (re-check security if reviewer flagged)

# completion-gate
completion-gate ← cook    (Phase 5d: validate agent claims)
completion-gate ← team    (validate cook reports from streams)

# worktree
worktree ← team           (Phase 2: create worktrees for streams)
worktree ← cook           (optional isolation for complex features)

# sast
sast ← sentinel           (deep analysis beyond regex patterns)
sast ← audit              (security dimension in full audit)
sast ← cook               (security-sensitive code paths)
sast ← review             (security patterns detected in diff)

# constraint-check
constraint-check ← cook   (end-of-workflow discipline audit)
constraint-check ← team   (verify stream agent compliance)
constraint-check ← audit  (quality dimension assessment)

# logic-guardian
logic-guardian ← cook     (Phase 1.5: complex logic project detected)
logic-guardian ← fix      (pre-edit gate on manifested files)
logic-guardian ← surgeon  (pre-refactor on logic modules)
logic-guardian ← team     (validate logic integrity across streams)
logic-guardian ← review   (check if diff removes manifested logic)
logic-guardian → scout    (scan project for logic files)
logic-guardian → verification (run tests after logic edits)
logic-guardian → hallucination-guard (verify references after edit)
logic-guardian → journal  (record logic changes as ADRs)
logic-guardian → session-bridge (save manifest for cross-session)

# ba (Business Analyst)
ba ← cook             (Phase 1 BA gate — feature requests, integrations, greenfield)
ba ← scaffold         (Phase 1 requirement elicitation)
ba → plan             (hand-off: requirements.md → implementation planning)
ba → brainstorm       (explore approaches when requirements are ambiguous)
ba → research         (domain research for hidden requirements)

# scaffold (Project Bootstrap)
scaffold → ba         (Phase 1: requirement elicitation)
scaffold → research   (Phase 2: tech stack research)
scaffold → plan       (Phase 3: architecture planning)
scaffold → design     (Phase 4: design system generation)
scaffold → fix        (Phase 5: code generation)
scaffold → test       (Phase 6: test generation)
scaffold → docs       (Phase 7: documentation)
scaffold → git        (Phase 8: initial commit)
scaffold → verification (Phase 9: build + test verification)
scaffold → sentinel   (Phase 9: security scan)

# docs (Documentation Lifecycle)
docs ← cook           (Phase 8: auto-update docs after feature)
docs ← scaffold       (Phase 7: generate initial docs)
docs → scout          (scan codebase for doc-worthy exports)
docs → doc-processor  (generate PDF/DOCX from markdown)
docs → git            (commit doc changes)

# git (Semantic Git Operations)
git ← cook            (Phase 7: semantic commit generation)
git ← scaffold        (Phase 8: initial commit)
git ← docs            (commit doc changes)
git ← launch          (tag and release)

# mcp-builder (MCP Server Builder)
mcp-builder ← cook    (building an MCP server)
mcp-builder → scout   (scan for existing MCP patterns)
mcp-builder → test    (generate MCP server tests)
mcp-builder → docs    (generate MCP server documentation)
mcp-builder → hallucination-guard (verify SDK imports exist)

# doc-processor (Document Format Utility)
doc-processor ← docs  (PDF/DOCX generation)
doc-processor ← marketing (generate branded PDFs)

# graft (Repo Porting)
graft → scout         (scan target repo before porting)
graft → review        (validate grafted code quality)
graft → journal       (record grafting decision as ADR)
graft → sentinel      (security check on ported code)

# New connections (v2.10.0)
brainstorm → design   (ideas feed into design system generation)
ba → design           (requirements feed into UI design)
rescue → retro        (post-rescue retrospective)
launch → retro        (post-launch retrospective)
scaffold → skill-forge (scaffold identifies reusable skill patterns)
sentinel → plan       (security.blocked triggers re-planning)

# council (decorrelated multi-perspective primitive)
council ← adversary       (Step 0.6: CRITICAL-tier plan critique — one-way-door decisions, auth/payment/crypto/user-data)
council ← review          (Step 1.6: high-blast-radius bug-finding — 50+ callers + HIGH severity)
council ← brainstorm      (Step 3.75: Design-It-Twice candidate judgment — N=4 remote/external dependency, marginal diversity band, or explicit user request)
council ← problem-solver  (Step 6.5: high-stakes conclusion judgment — one-way-door decision with high-impact solution, or severe ethical concern)
```

## Master Plan + Phase Files (Amateur-Proof Architecture)

The `plan` skill (v0.4.0) produces structured plans designed for **any model to execute with high accuracy**.

### Design Principle

> Plan for the weakest coder. If Haiku (Amateur) can execute the phase file, every model benefits.

### Structure

```
.rune/
  plan-<feature>.md          ← Master plan: overview (<80 lines)
  plan-<feature>-phase1.md   ← Phase 1: self-contained execution detail (<200 lines)
  plan-<feature>-phase2.md   ← Phase 2: self-contained execution detail
  ...
```

### Phase File Template (Amateur-Proof)

Every phase file MUST include these 7 mandatory sections:

| Section | Purpose | Why Amateur Needs It |
|---------|---------|---------------------|
| Data Flow | ASCII diagram of data movement | Prevents wrong function call order |
| Code Contracts | Function signatures, interfaces | Prevents wrong return types |
| Tasks | File paths, logic, edge cases | Prevents missed files |
| Failure Scenarios | When/Then/Error table | Prevents missing error handling |
| Rejection Criteria | Explicit DO NOTs | Prevents common anti-patterns |
| Cross-Phase Context | Imports from prior, exports for future | Prevents broken dependencies |
| Acceptance Criteria | Testable conditions | Prevents "done" without proof |

### Execution Flow

```
1. cook Phase 0: check for existing master plan → resume from current phase
2. cook Phase 2: plan produces master + phase files → user approves
3. cook Phase 3-7: load ONLY current phase file → test → implement → quality → commit
4. cook Phase 7: mark phase ✅ in master plan → announce next phase
5. Next session: Phase 0 detects master plan → loads next phase → executes
```

**One phase per session = small context = better code from any model.**

## Context Bus

Each workflow maintains a shared context managed by L1:

```
L1: full bus (complete picture)
L2: relevant subset (only what they need)
L3: minimal query (stateless, no history)
L4: domain-filtered subset
```

## Comprehension Dashboard

`rune dashboard` generates `.rune/comprehension.html` — a fully self-contained HTML artifact (no CDN, no external requests) that surfaces project health from real session, gate, and mesh data.

**Five tabs:**
- **Verdict** — health score (0–100), gate coverage, compliance pct, active skills KPIs
- **Govern** — gate ledger, compliance coverage map, decision provenance
- **Measure** — skill frequency bars, model mix, skill ROI (active vs dormant), activity heatmap, session timeline
- **Understand** — interactive mesh graph (module or skill fallback), domain view, guided tour, node inspector
- **Improve** — data-driven anti-pattern cards derived from real gate events and session patterns

**Tier gating** (detected via `$RUNE_PRO_ROOT` / `$RUNE_BUSINESS_ROOT` env vars, sibling monorepo paths, or well-known install paths):
- **Free** — Verdict, Measure, Understand, Improve fully available. Govern shows an honest upsell (no fabricated data).
- **Pro** — Adds "My Lens" persona: personal cost, gates fired, and skill-ROI curated view.
- **Business** — Full Govern: compliance coverage, gate ledger, decision provenance.

XSS safety: all data embedded via `safeJson` (every `<` → `<`, U+2028/U+2029 escaped — prevents `</script>` breakout). Self-contained: no `<link>`, no `@import`, no external fonts.
