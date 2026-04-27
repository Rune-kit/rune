---
name: improve-architecture
description: "Find architectural friction in a codebase and propose deepening opportunities. Use when user wants to improve architecture, find refactor candidates, consolidate shallow modules, or make a codebase more testable. Outputs scored proposals (depth/leverage/locality) that surgeon and review can consume."
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: opus
  group: quality
  tools: "Read, Glob, Grep"
  emit: architecture.shallow.flagged, architecture.deletion.passed
  listen: codebase.scanned
---

# improve-architecture

## Purpose

Surface architectural friction in a codebase and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. Output is structured (numeric scores + JSON proposal payloads) so `surgeon`, `review`, and `audit` can consume it programmatically without re-reading the codebase.

The goal is **testability and AI-navigability**: a deep module presents a small interface that hides large machinery, so tests target one surface and future agents can reason about the system without traversing N small wrappers.

## Vocabulary (controlled — use exactly)

These eight terms have precise meanings. Banned aliases: "boundary" (overloaded with DDD), "component" (UI-specific), "service" (microservice-specific), "layer" (too generic). See [references/language.md](references/language.md) for full definitions.

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — everything a caller must know to use the module: types, invariants, ordering, error modes, config.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface; large behavior behind a small interface.
- **Seam** — where an interface lives; place behavior can be altered without editing in place.
- **Adapter** — concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth.

## Triggers

- Called by `cook` Phase 5 (quality gate) when refactor signals appear in scout output
- Called by `surgeon` before any deepening session — produces the proposal surgeon executes
- Called by `audit` to compute the architecture sub-score
- Called by `review` when a reviewer flag mentions "shallow", "wrapper", "indirection"
- Manual: `/rune improve-architecture <module-path>`

## Calls (outbound)

- `scout` (L2): re-scan target module + callers when input context is stale
- `brainstorm` (L2): when the deepened module needs a new interface, hand off in `design-it-twice` mode (see brainstorm v0.6+)
- `journal` (L3): record an ADR if the user rejects a candidate with a load-bearing reason

## Called By (inbound)

- `cook` (L1): Phase 5 quality gate
- `surgeon` (L2): pre-refactor input; consumes the proposal payload
- `audit` (L2): Phase 4 architecture sub-score
- `review` (L2): when shallow-module flag fires during review
- User: manual invocation

## Cross-Hub Connections

- `improve-architecture` → `surgeon` — proposal payload feeds surgeon's deepening session
- `improve-architecture` ↔ `brainstorm` — when interface needs design-it-twice exploration
- `improve-architecture` → `audit` — emits architecture sub-score
- `improve-architecture` → `journal` — records ADRs for rejected candidates with load-bearing reasons

## Inputs

- Required: target module path (e.g. `src/auth/`) OR signal `codebase.scanned` from a recent scout pass
- Optional: existing `CONTEXT.md` (domain glossary, used to name modules in their domain language)
- Optional: `docs/adr/` directory (existing ADRs that constrain proposals — do not re-litigate)

## Executable Steps

### Step 1 — Read existing context

Read in order, silently skipping any that don't exist:

1. `CONTEXT.md` (or `CONTEXT-MAP.md` + per-bounded-context `CONTEXT.md`)
2. Relevant `docs/adr/` files
3. The target module's source files (use `Glob` to enumerate, cap at 30 files)
4. Direct callers of the module (grep for imports / require / use)

If `CONTEXT.md` is missing, do not flag it — treat as "no domain glossary yet". If an ADR contradicts a candidate you're forming, mark it and only surface the candidate if the friction is genuine enough to warrant ADR revision.

### Step 2 — Score the candidate(s)

For each candidate module, compute three numeric scores (1–5) and one verdict (enum):

| Metric | Formula / Rubric |
|--------|------------------|
| **Depth** | `clamp_1_5(implementation_complexity / interface_complexity)` — 1 = shallow wrapper, 5 = small interface hides large machine |
| **Leverage** | `clamp_1_5(num_callers * unique_use_cases / interface_method_count)` — 1 = thin caller benefit, 5 = many callers, fewer methods to learn |
| **Locality** | `clamp_1_5(code_concentration_index)` — 1 = logic spread across N callers, 5 = logic concentrated in one place |
| **Deletion test** | enum: `vanish` (was pass-through) \| `concentrate` (was earning keep) \| `redistribute` (mixed) |

Rubric details and edge cases: see [references/scoring.md](references/scoring.md).

### Step 3 — Classify dependencies

For each candidate's external dependencies, classify into one of four categories. The category determines test strategy:

| Category | Definition | Test Strategy |
|----------|------------|---------------|
| `in-process` | Pure computation, in-memory state, no I/O | Test through deepened interface directly |
| `local-substitutable` | Has local test stand-in (PGLite, in-memory FS) | Use stand-in in tests; no port at module seam |
| `remote-owned` | Your own module deployed across a network seam | Define a port; in-memory adapter for tests, HTTP adapter for prod |
| `true-external` | Third-party (Stripe, Twilio) | Inject as port; mock adapter in tests |

Full doctrine in [references/deepening.md](references/deepening.md).

### Step 4 — Apply seam discipline

Before recommending a port:

- **One adapter = hypothetical seam. Two adapters = real seam.** Don't introduce a port unless ≥2 adapters are justified (typically prod + test).
- Single-adapter "seams" are flagged "indirection-only" and dropped from the proposal.
- Internal seams (private to the implementation) MAY exist for the deepened module's own tests; they don't appear in the public interface.

### Step 5 — Emit proposal payload

For each surviving candidate, produce a structured proposal in YAML:

```yaml
architecture.proposal:
  module_path: src/auth/
  current:
    depth: 2
    leverage: 3
    locality: 2
    deletion_test: redistribute
  target:
    depth: 4
    leverage: 4
    locality: 4
  dependency_category: remote-owned
  suggested_seam: AuthPort
  adapters_planned: [HttpAuthAdapter, InMemoryAuthAdapter]   # 2 = real seam ✅
  tests_to_replace: [auth/login.test.ts, auth/session.test.ts]
  tests_to_write_new: [auth/AuthPort.test.ts]
  domain_terms_used: [Customer, Session]   # from CONTEXT.md if present
  adr_conflicts: []
```

### Step 6 — Present candidates to user

Numbered list, each candidate showing:
- **Files involved** — file paths (+ key types/exports for durability)
- **Problem** — friction in the current architecture, in vocab terms (depth/leverage/locality)
- **Solution** — plain English, naming the deepened module by its domain term if `CONTEXT.md` provides one
- **Benefits** — leverage gain (caller-side) + locality gain (maintainer-side) + test surface change
- **Score delta** — current → target

Do NOT propose interfaces yet. Ask: "Which candidate to explore?"

### Step 7 — On user pick

When user picks a candidate, hand off:
- To `brainstorm` in `design-it-twice` mode if the new interface is non-obvious (multiple credible shapes)
- To `surgeon` with the proposal payload otherwise

If user rejects a candidate with a load-bearing reason ("we don't want to centralize auth because of compliance audit isolation"), offer to record an ADR via `journal` (only if `score >= 11` per journal v0.4 criteria).

## Output Format

```
## Architecture Improvement Report

### Target
- **Path**: src/auth/
- **CONTEXT.md present**: yes / no
- **ADRs reviewed**: 3 (none conflicting)

### Candidates

#### 1. Auth port consolidation (depth 2 → 4)
- **Files**: src/auth/login.ts, src/auth/session.ts, src/auth/middleware.ts
- **Problem**: 3 shallow modules each handle one HTTP-flavored verb; logic about `Customer` identity is split across all three (locality = 2)
- **Solution**: collapse into AuthPort exposing `authenticate`, `revoke`, `verify` — 3 methods, deep impl
- **Benefits**: callers learn 3 methods instead of N free functions; auth logic concentrated; tests target the port
- **Score delta**: depth 2→4, leverage 3→4, locality 2→4
- **Deletion test**: redistribute (current modules ARE doing work, just spread)

#### 2. ...

### Recommendation
Candidate 1 — strongest leverage gain. Hand off to `brainstorm` design-it-twice for the AuthPort shape (3 credible alternatives), then `surgeon`.

### Architecture sub-score
- Current: 58/100
- Projected after candidate 1: 78/100
```

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Architecture Improvement Report | Markdown | inline |
| Proposal payloads | YAML | inline (per candidate) |
| Architecture sub-score | integer 0-100 | inline + emitted to audit |
| ADR draft (if user rejects with load-bearing reason) | Markdown | `.rune/adr/ADR-NNN-<slug>-s<score>.md` via journal |

## Constraints

1. MUST use the 8 controlled vocabulary terms exactly — no aliases ("boundary", "component", "service", "layer" are banned in skill output)
2. MUST include numeric scores (depth/leverage/locality 1-5 each) on every candidate — soft prose claims are rejected
3. MUST apply deletion test verdict — "vanish" candidates may be removed entirely; "concentrate" candidates are deepening targets
4. MUST apply two-adapter rule — single-adapter seams are flagged "indirection-only" and dropped
5. MUST NOT propose interfaces in the same step as candidate selection — present candidates first, hand to brainstorm Design-It-Twice if interface is non-obvious
6. MUST silently skip missing `CONTEXT.md` / ADR directory — do not flag as project gap
7. MUST emit JSON-shaped proposal payload — downstream skills (surgeon) consume it programmatically

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Recommending a deepening that contradicts a documented ADR | HIGH | Step 1 reads ADRs; if conflict, surface only if friction is real enough to revise the ADR |
| Single-adapter seam slips into proposal | HIGH | Step 4 rule — drop or downgrade to "internal seam" |
| Vocabulary drift (using "boundary"/"component"/"service") | MEDIUM | Constraint 1 + linter pass in compiler/__tests__/vocabulary-discipline.test.js |
| Score inflation to make weak candidate look strong | HIGH | Each metric has rubric in scoring.md; judges show formula inputs |
| Missing CONTEXT.md domain terms — generic naming ("AuthService") | MEDIUM | If CONTEXT.md exists, names MUST come from it; otherwise OK |
| Proposing interface in same pass as candidates | MEDIUM | Step 6 hard-stops at candidate list; interface design = brainstorm Design-It-Twice |
| User rejects all candidates → no ADR recorded → next session re-litigates | MEDIUM | If reason is load-bearing AND score >= 11, offer journal ADR write |

## Self-Validation

```
SELF-VALIDATION (run before emitting Report):
- [ ] Every candidate has depth + leverage + locality scores (1-5 each)
- [ ] Every candidate has deletion-test verdict (vanish | concentrate | redistribute)
- [ ] Every candidate names a dependency category (in-process | local-substitutable | remote-owned | true-external)
- [ ] No banned vocabulary (grep candidate text for: boundary, component, service, layer in narrative)
- [ ] No interfaces drafted yet — that's brainstorm's job
- [ ] CONTEXT.md domain terms used if file present
- [ ] Each adapter list has >=2 entries OR seam is marked "internal-only"
IF ANY check fails → fix before reporting done.
```

## Done When

- Target module read + callers mapped
- ≥1 candidate scored on all 3 axes + deletion test
- Proposal payload(s) emitted in valid YAML
- Architecture sub-score computed (0-100)
- User has either picked a candidate (handed to brainstorm/surgeon) or rejected with reason (ADR offered)
- Report emitted with vocabulary discipline intact

## Cost Profile

~3000-7000 tokens input (codebase scan), ~2000-4000 tokens output (analysis + proposals). Opus model — architectural reasoning depth is the value. Called at most once per `audit` session, on-demand from `cook` / `surgeon`.

## Chain Metadata

```yaml
chain_metadata:
  skill: "rune:improve-architecture"
  version: "0.1.0"
  status: "[DONE]"
  domain: "[module path scored]"
  exports:
    architecture_subscore: 0-100
    candidates: [{ module, depth, leverage, locality, verdict }]
    proposal_payloads: [<yaml-per-candidate>]
  suggested_next:
    - skill: "rune:brainstorm"
      mode: "design-it-twice"
      reason: "Top candidate has multiple credible interface shapes — need diverse exploration before commit"
      consumes: ["proposal_payloads"]
    - skill: "rune:surgeon"
      reason: "User picked candidate; interface shape is obvious; ready for deepening session"
      consumes: ["proposal_payloads"]
    - skill: "rune:journal"
      reason: "User rejected candidate with load-bearing reason; record ADR (score >=11)"
      consumes: ["candidates", "rejection_reason"]
```

**Scope guardrail**: improve-architecture proposes and scores. It NEVER edits code. Refactor execution belongs to `surgeon`. Interface exploration belongs to `brainstorm` Design-It-Twice mode.
