# session-bridge — Load invariants

> Reference for `skills/session-bridge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Step 1.7 — Load invariants (auto-discipline)

Before loading the usual state files, run the invariants loader so the agent sees active discipline rules without being told to look:

```
Execute: node skills/session-bridge/scripts/load-invariants.js --root <project-root> --json
```

The loader:
- Reads `.rune/INVARIANTS.md` (silent no-op if missing)
- Strips the `## Archived` section (retired rules don't re-activate)
- Parses active rules into `{ section, title, what, where, why }`
- Returns a token-budgeted preview (≤ 500 tokens by default)
- Flags staleness when mtime > 30 days

**Emit signal**: `invariants.loaded` with payload `{ loaded, count, rules, stats, stale, overflow, path }` where:
- `loaded` (boolean) — whether any active rules were parsed
- `count` (number) — total active rules (convenience alias for `stats.total`)
- `rules` (array) — full rule objects `[{ section, title, what, where: string[], why }]` — consumers cache these for glob matching
- `stats` — `{ danger, critical, state, cross, total, archivedSkipped }`
- `stale` (boolean) — mtime > 30 days
- `overflow` (number) — rules present but not shown in preview (budget overflow)
- `path` (string) — absolute path to `.rune/INVARIANTS.md`

Downstream listeners (`logic-guardian`, Pro `autopilot`) consume `rules[]` directly — no second file read needed.

**Present to agent** (injected verbatim into the Load Mode summary):

```
📎 Active Invariants (.rune/INVARIANTS.md)
⚠  skills/skill-router/** — L0 router, never bypass
🔒  compiler/parser.js — IR schema is the adapter contract
🔁  compiler/hooks/dispatch.js — phase order is pre → run → post
🔗  .claude-plugin/marketplace.json — mirrors plugin.json
…+2 more rules in .rune/INVARIANTS.md
```

**Staleness warning** (emit ONCE per session, not per tool call):

```
⚠ Invariants file is stale (> 30 days since last onboard). Consider `rune onboard --refresh`.
```

**Failure modes**:
- Missing file → silent no-op (no preview, no error). Don't nag fresh repos.
- Malformed file → `loaded: false, rules: []`. Log a single-line warning, continue.
- File fails `integrity-check` in Step 1.5 → this step is skipped entirely (load already blocked).
