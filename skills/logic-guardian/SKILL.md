---
name: logic-guardian
description: Protects complex business logic from accidental deletion or overwrite. Maintains a logic manifest, enforces pre-edit gates, and validates post-edit diffs.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: quality
  tools: "Read, Write, Edit, Glob, Grep"
---

# logic-guardian

## Purpose

Complex projects (trading bots, payment systems, game engines, state machines) contain interconnected logic that AI agents routinely destroy by accident. The pattern is always the same: new session starts, agent doesn't know existing logic, rewrites or deletes working code, project regresses. `logic-guardian` breaks this cycle by maintaining a machine-readable logic manifest, enforcing a pre-edit gate on logic files, and validating that edits don't silently remove existing logic. It is the "institutional memory" for business logic.

## Triggers

- `/rune logic-guardian` — manual invocation (scan project, generate/update manifest)
- Auto-trigger: when `cook` or `fix` targets a file listed in `.rune/logic-manifest.json`
- Auto-trigger: when `surgeon` plans refactoring on logic-heavy modules
- Auto-trigger: when `.rune/logic-manifest.json` exists in project root

## Calls (outbound connections)

- `scout` (L2): scan project to discover logic files and extract function signatures
- `verification` (L3): run tests after logic edits to confirm no regression
- `hallucination-guard` (L3): verify that referenced functions/imports actually exist after edit
- `journal` (L3): record logic changes as ADRs for cross-session persistence
- `session-bridge` (L3): save manifest state so next session loads it immediately

## Called By (inbound connections)

- `cook` (L1): Phase 1.5 — when complex logic project detected, load manifest before planning
- `fix` (L2): pre-edit gate — before modifying any file in the manifest
- `surgeon` (L2): pre-refactor — before restructuring logic modules
- `team` (L1): validate logic integrity across parallel workstreams
- `review` (L2): check if reviewed diff removes or modifies manifested logic

## Workflow

### Phase 0 — Load or Initialize Manifest

1. Use `Read` on `.rune/logic-manifest.json`
2. If file exists:
   - Parse manifest, display summary: "Loaded logic manifest: N components, M functions, K parameters"
   - Proceed to Phase 1 (Validate)
3. If file does NOT exist:
   - Announce: "No logic manifest found. Scanning project to generate one."
   - Proceed to Phase 3 (Generate)

### Phase 1 — Validate Manifest Against Codebase

Ensure the manifest matches the actual code (detect drift):

1. For each component in the manifest:
   - Use `Read` on the component's `file_path`
   - Verify each listed function exists (by name + signature match)
   - Check if any NEW functions exist in the file that aren't in the manifest
2. Report:
   - `SYNCED` — manifest matches code perfectly
   - `DRIFT_DETECTED` — list specific discrepancies (missing functions, new unlisted functions, changed signatures)
3. If drift detected: ask user whether to update manifest or investigate changes

### Phase 2 — Pre-Edit Gate (called by fix/surgeon/cook)

Before ANY edit to a manifested file:

1. Load the manifest (Phase 0)
2. Display the affected component's current spec:
   ```
   COMPONENT: [name]
   STATUS: ACTIVE | TESTING | DEPRECATED
   FUNCTIONS: [list with one-line descriptions]
   PARAMETERS: [configurable values with current settings]
   DEPENDENCIES: [what other components depend on this]
   LAST_MODIFIED: [date]
   ```
3. Require the agent to explicitly state:
   - What it intends to change
   - What it will NOT change
   - Which existing functions/logic will be preserved
4. If the agent cannot list the existing functions → BLOCK the edit. Force a `Read` of the file first.

### Phase 3 — Generate Manifest (first-time or rescan)

Scan the project and build the manifest:

1. Use `scout` to find logic-heavy files:
   - Search for files with complex conditionals, state machines, strategy patterns
   - Look for files matching: `**/logic/**`, `**/strategy/**`, `**/engine/**`, `**/core/**`, `**/scenarios/**`, `**/rules/**`, `**/pipeline/**`, `**/trailing/**`, `**/signals/**`
   - Also search for files with high cyclomatic complexity (many if/else/switch branches)
2. For each discovered file:
   - `Read` the file
   - Extract: functions/methods, their parameters, return types, key conditionals
   - Classify the component's role: ENTRY_LOGIC, EXIT_LOGIC, FILTER, VALIDATOR, STATE_MACHINE, PIPELINE, CALCULATOR, etc.
   - Determine status: ACTIVE (has callers + tests), TESTING (no production callers), DEPRECATED (commented out or unused)
3. Map dependencies between components:
   - Which component calls which
   - Which share state or config
   - Which must be modified together (co-change groups)
4. Write manifest to `.rune/logic-manifest.json`
5. Save summary to neural memory via `session-bridge`

### Phase 4 — Post-Edit Validation

After any edit to a manifested file:

1. Re-read the edited file
2. Compare against the manifest's function list:
   - Any function REMOVED? → ALERT: "Function [name] was removed. Was this intentional?"
   - Any function SIGNATURE changed? → WARN: "Signature of [name] changed. Check callers."
   - Any PARAMETERS changed? → WARN: "Parameter [name] changed from [old] to [new]. Verify downstream."
3. Run `verification` to execute tests
4. If all checks pass: update the manifest with new state
5. If function was removed unintentionally: offer to restore from git

### Phase 5 — Cross-Session Handoff

Ensure the next session can pick up where this one left off:

1. Update `.rune/logic-manifest.json` with:
   - Current component states
   - Last validation timestamp
   - Any pending changes or known issues
2. Save key decisions to `journal` as ADRs
3. Save manifest summary to neural memory:
   - "Project X has N active logic components: [list]. Last validated [date]."
   - "Component Y was modified: [what changed and why]"

## Output Format

### Manifest Schema (`.rune/logic-manifest.json`)

```json
{
  "version": "1.0",
  "project": "project-name",
  "last_validated": "2026-03-05T10:00:00Z",
  "components": [
    {
      "name": "rsi-entry-detector",
      "file_path": "src/scenarios/rsi_entry/detect.py",
      "role": "ENTRY_LOGIC",
      "status": "ACTIVE",
      "functions": [
        {
          "name": "detect_entry_signal",
          "signature": "(df: DataFrame, ticket: Ticket, config: Settings) -> Signal | None",
          "description": "3-step RSI entry detection: challenge -> zone check -> entry point",
          "critical": true
        }
      ],
      "parameters": [
        { "name": "rsi_period", "value": 7, "source": "settings.py" },
        { "name": "challenge_threshold_long", "value": 65, "source": "settings.py" }
      ],
      "dependencies": ["trend-pass-tracker", "indicator-calculator"],
      "dependents": ["production-worker", "backtest-engine"],
      "last_modified": "2026-03-01",
      "last_modifier": "human",
      "checksum": "sha256:abc123..."
    }
  ],
  "co_change_groups": [
    {
      "name": "entry-pipeline",
      "components": ["trend-pass-tracker", "rsi-entry-detector", "indicator-calculator"],
      "reason": "These components share RSI parameters and must be modified together"
    }
  ]
}
```

### Validation Report

```
## Logic Guardian Report

### Manifest Status: SYNCED | DRIFT_DETECTED
- Components: N active, M testing, K deprecated
- Last validated: [timestamp]

### Pre-Edit Gate
- File: [path]
- Component: [name] (ACTIVE)
- Functions preserved: [list]
- Intended change: [description]
- Impact: [downstream effects]

### Post-Edit Validation
- Functions removed: [none | list]
- Signatures changed: [none | list]
- Parameters changed: [none | list]
- Tests: PASS | FAIL
- Manifest: UPDATED | NEEDS_REVIEW
```

## Constraints

1. MUST load manifest before ANY edit to a manifested file — the entire point is pre-edit awareness
2. MUST NOT allow edits to ACTIVE logic without the agent explicitly listing what will be preserved — prevents silent overwrites
3. MUST alert on function removal — the #1 failure mode is deleting working logic
4. MUST run tests after editing manifested files — logic changes without test verification are blind
5. MUST update manifest after validated edits — stale manifests provide false confidence
6. MUST NOT auto-generate manifest for files the agent hasn't read — manifest must reflect actual understanding

## Mesh Gates

| Gate | Requires | If Missing |
|------|----------|------------|
| PRE_EDIT | `.rune/logic-manifest.json` loaded + component spec displayed | BLOCK edit. Run Phase 0 + Phase 2 first. |
| POST_EDIT | All manifest functions still present OR removal explicitly acknowledged | ALERT + offer git restore |
| CROSS_SESSION | Manifest updated + summary saved to journal/nmem | WARN: next session will lack context |

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Agent edits manifested file without loading manifest first | CRITICAL | Phase 2 gate: cook/fix MUST call logic-guardian before editing manifested files |
| Manifest drifts from actual code (manual edits not tracked) | HIGH | Phase 1 validation on every load — detect and reconcile drift |
| Agent acknowledges existing logic but still overwrites it | HIGH | Post-edit Phase 4 diff check catches removed functions regardless of agent claims |
| Manifest becomes too large (100+ components) | MEDIUM | Group related functions into composite components; track at module level not function level |
| False sense of security — manifest exists but is outdated | MEDIUM | Checksum comparison on every load; warn if file hash doesn't match manifest |
| Agent treats manifest generation as a one-time task | LOW | Phase 5 cross-session handoff ensures manifest stays alive across sessions |

## Done When

- `.rune/logic-manifest.json` exists and passes Phase 1 validation (SYNCED)
- All manifested components have status (ACTIVE/TESTING/DEPRECATED) and function listings
- Pre-edit gate blocks edits without manifest awareness (Phase 2 enforced)
- Post-edit validation confirms no unintended function removal (Phase 4 passed)
- Manifest summary saved to journal + neural memory for cross-session handoff
- Tests pass after any logic edit

## Returns

| Artifact | Format | Location |
|----------|--------|----------|
| Logic manifest | JSON | `.rune/logic-manifest.json` |
| Validation report (SYNCED / DRIFT) | Markdown | inline |
| Pre-edit gate summary | Structured text | inline |
| ADR entries for logic changes | Markdown | via `journal` L3 |

## Cost Profile

~1,000-2,000 tokens for manifest load + pre-edit gate. ~3,000-5,000 tokens for full project scan (Phase 3). Sonnet for code analysis; haiku for file scanning via scout.

**Scope guardrail:** logic-guardian protects existing logic — it does not implement new features or refactor code.
