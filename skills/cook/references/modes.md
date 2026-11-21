# cook — Workflow chains, nano and fast modes

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Workflow Chains (Predefined)

Cook supports predefined workflow chains for common task types. Use these as shortcuts instead of manually determining phases:

```
/rune cook feature    → Full TDD pipeline (all phases)
/rune cook bugfix     → Diagnose → fix → verify (Phase 1 → 4 → 6 → 7)
/rune cook refactor   → Understand → plan → implement → quality (Phase 1 → 2 → 4 → 5 → 6 → 7)
/rune cook security   → Full pipeline + sentinel@opus + sast (all phases, security-escalated)
/rune cook hotfix     → Production Hotfix Protocol: contain → fix → verify → deploy → watchdog → postmortem (see below)
/rune cook nano       → Trivial: do → verify → done (no phases, ≤3 steps)
/rune cook --template <name> → Load pre-built workflow template from installed Pro/Business packs
```

### Production Hotfix Protocol

> Full detail moved to [`references/workflow-variants.md`](workflow-variants.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:deploy`, `rune:fix`, `rune:incident`, `rune:journal`, `rune:neural-memory`, `rune:sentinel`, `rune:verification`, `rune:watchdog`.

### Template Workflows (Pro/Business)

> Full detail moved to [`references/workflow-variants.md`](workflow-variants.md) (progressive disclosure). **Read that file before executing this section.** Mesh links used there: `rune:graft`.

## Nano Mode (Auto-Detect)

For trivial tasks that don't need any pipeline at all:

```
IF all of these are true:
  - Task is ≤3 discrete steps (e.g., run command, edit 1 file, commit)
  - Task description < 60 chars OR user prefixes with "quick:", "just", "chỉ cần"
  - No code logic changes (copy files, config edits, version bumps, git ops, run scripts)
  - No new functions/classes/components created
THEN: Nano Mode activated
  - Execute directly: DO → VERIFY → DONE
  - No phases. No plan. No test. No review.
  - Still verify output (check exit codes, confirm file exists, etc.)
  - Still use semantic commit message if committing
```

**Announce**: "Nano mode: trivial task, executing directly."
**Override**: User can say "full pipeline" or "cook feature" to force phases.
**Escape hatch**: If during execution the task turns out more complex than expected → announce upgrade: "Upgrading to Fast/Full mode — task is more complex than detected." Resume from Phase 1.

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

## Fast Mode (Auto-Detect)

Cook auto-detects small changes and streamlines the pipeline:

```
IF all of these are true:
  - Total estimated change < 30 LOC
  - Single file affected
  - No security-relevant code (auth, crypto, payments, .env)
  - No public API changes
  - No database schema changes
THEN: Fast Mode activated
  - Skip Phase 2 (PLAN) — change is too small for a formal plan
  - Skip Phase 3 (TEST) — unless existing tests cover the area
  - Skip Phase 5b (SENTINEL) — non-security code
  - Skip Phase 8 (BRIDGE) — not worth persisting
  - KEEP Phase 5a (PREFLIGHT) and Phase 6 (VERIFY) — always run quality checks
```

**Announce fast mode**: "Fast mode: small change detected (<30 LOC, single file, non-security). Streamlined pipeline."
**Override**: User can say "full pipeline" to force all phases even on small changes.
