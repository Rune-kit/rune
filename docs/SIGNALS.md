# Mesh Signals — Canonical Inventory

> **Event-driven skill communication**. Skills emit signals when they finish work; other skills listen and auto-trigger. No central orchestrator required.

**Status:** 25 signals in Free tier · all emitters have listeners · 0 orphans
**Enforced by:** `scripts/validate-signals.js` (run in CI)
**Last updated:** v2.12.3 (2026-04-22)

## How Signals Work

```yaml
# skills/fix/SKILL.md
---
mesh:
  emit: code.changed
  listen: bug.diagnosed, review.issues, preflight.blocked
---
```

When `debug` finishes and emits `bug.diagnosed`, the mesh routes the event to every skill listening — `fix` picks it up and runs.

**Naming rule:** `lowercase.dot.separated` segments. Enforced by `SIGNAL_NAME_PATTERN` in `scripts/validate-signals.js`.

## Signal Catalog

### Workflow lifecycle

| Signal | Emitted by | Listened by | Meaning |
|--------|-----------|-------------|---------|
| `codebase.scanned` | scout | brainstorm, plan, graft | Scout finished reading the codebase |
| `ideas.ready` | brainstorm | cook | Brainstorm produced approach options |
| `plan.ready` | plan | cook | Phase plan approved and saved |
| `phase.complete` | cook, team | session-bridge | A phase finished; checkpoint state |
| `checkpoint.request` | cook | session-bridge | Context pressure — save before compact |
| `project.onboarded` | onboard | plan | First-session setup done |
| `invariants.seeded` | onboard | *(logic-guardian cross-tier)* | `.rune/INVARIANTS.md` populated |
| `invariants.loaded` | session-bridge | logic-guardian | Invariants read at session start |

### Code change cycle

| Signal | Emitted by | Listened by | Meaning |
|--------|-----------|-------------|---------|
| `code.changed` | fix | preflight, sentinel, review, test, verification | Code was edited |
| `review.complete` | review | cook | Review done, no issues |
| `review.issues` | review | fix | Review found problems |
| `bug.diagnosed` | debug | fix | Root cause identified |
| `preflight.passed` | preflight | cook | Quality gate green |
| `preflight.blocked` | preflight | fix, plan | Quality gate blocked |
| `tests.passed` | test | deploy | Test suite green |
| `tests.failed` | test | debug | Test suite red |
| `verification.complete` | verification | cook | Lint + types + tests all passed |

### Security & audit

| Signal | Emitted by | Listened by | Meaning |
|--------|-----------|-------------|---------|
| `security.passed` | sentinel | deploy | No security issues found |
| `security.blocked` | sentinel | fix, plan | Security gate blocked |
| `audit.complete` | audit | deploy, launch | Full audit finished |

### Data & integration

| Signal | Emitted by | Listened by | Meaning |
|--------|-----------|-------------|---------|
| `db.migrated` | db | deploy, test | DB migration applied |
| `docs.updated` | docs | deploy, review | Docs regenerated |
| `graft.complete` | graft | journal | External code ported in |

### Deploy & incident

| Signal | Emitted by | Listened by | Meaning |
|--------|-----------|-------------|---------|
| `deploy.complete` | deploy | watchdog | Deploy finished |
| `incident.detected` | watchdog | incident | Post-deploy health check failed |

## Validation

Run locally before commit:

```bash
node scripts/validate-signals.js
```

Checks:
- Every `listen:` has a matching `emit:` somewhere in the mesh (no orphan listeners)
- Signal names follow `a.b.c` naming pattern
- No duplicate emitters for the same signal
- `INTENTIONAL_BROADCAST_SIGNALS` whitelist for cross-tier events (e.g. Pro-only listeners)

CI runs this on every PR (`.github/workflows/ci.yml`).

## Adding a New Signal

1. Pick a name following `<domain>.<verb>` (e.g. `cache.invalidated`, not `cacheInvalidated`)
2. Add `emit:` to the source skill's `mesh:` block
3. Add `listen:` to at least one consumer skill (or add to `INTENTIONAL_BROADCAST_SIGNALS` in `scripts/validate-signals.js` with a comment explaining why)
4. Run `node scripts/validate-signals.js` — must pass
5. Document the signal in this file under the appropriate section

## Cross-Tier Signals

Pro/Business tiers emit additional signals (e.g. `autopilot.downgraded`) that are listened to only by paid-tier skills. These are whitelisted in `INTENTIONAL_BROADCAST_SIGNALS` so Free-tier validation doesn't flag them as orphans.

See `Pro/extensions/*/SKILL.md` and `Business/extensions/*/SKILL.md` for tier-specific signals.
