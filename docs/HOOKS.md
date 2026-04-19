# Rune Hooks — Multi-Platform Auto-Discipline

Rune skills are libraries by default. `rune hooks install` turns them into a **runtime**: your IDE auto-invokes `preflight`, `sentinel`, `dependency-doctor`, and `completion-gate` at the right moments — before you commit insecure code, before you forget to run tests, before you ship a half-finished change.

Different AI IDEs expose different primitives. This doc explains what "auto-fire" actually means on each platform so you know what you're getting.

## Quick start

```bash
# Auto-detect platforms (.claude/, .cursor/, .windsurf/, .antigravity/)
rune hooks install --preset gentle

# Target a specific platform (force-creates the platform dir if missing)
rune hooks install --preset strict --platform cursor

# Install into every *detected* platform (safe — never creates new platform dirs)
rune hooks install --platform all

# Preview without writing
rune hooks install --dry

# Remove all Rune-managed entries (keeps your own)
rune hooks uninstall

# Inspect wiring
rune hooks status --platform all
```

Presets:

- `gentle` → WARN on findings, don't block the user.
- `strict` → BLOCK on findings, require explicit override.
- `off`    → equivalent to `rune hooks uninstall`.

## Platform capability matrix

| Platform    | Maturity     | Pre-edit  | Pre-Bash   | Post-edit | Stop (completion-gate) | Native artifact                     |
|-------------|--------------|-----------|------------|-----------|------------------------|-------------------------------------|
| Claude Code | **stable**   | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.claude/settings.json` (JSON)      |
| Cursor      | beta         | rule-inject | —        | —         | —                      | `.cursor/rules/rune-*.mdc`          |
| Windsurf    | beta         | workflow + cascade-rule | workflow | — | —                      | `.windsurf/workflows/` + `.windsurf/rules/` |
| Antigravity | experimental | rule-inject | —        | —         | —                      | `.antigravity/rules/rune-*.md`      |

### Pro tier (`--tier pro`)

| Entry          | Claude     | Cursor         | Windsurf                 | Antigravity    | Notes                                      |
|----------------|------------|----------------|--------------------------|----------------|--------------------------------------------|
| context-inject | auto-fire  | rule-alwaysApply | workflow + cascade-rule | rule-alwaysApply | UserPromptSubmit event, runs per prompt   |
| context-sense  | auto-fire  | rule-glob      | workflow + cascade-rule  | rule-glob      | PreToolUse Edit\|Write, glob-scoped        |
| rune-pulse     | statusLine | —              | —                        | —              | Claude statusline only — other IDEs skip   |

**Capability reading:**

- `auto-fire` / `statusLine` = native Claude primitive, true runtime behavior.
- `rule-alwaysApply` / `rule-glob` = best-effort rule injection, agent still decides.
- `workflow + cascade-rule` = user-invoked `/rune-pro-context-inject` + a cascade reminder.
- `—` = platform can't host the entry (e.g., no statusLine primitive). `rune hooks status` lists skipped entries per-tier.

Install with:

```bash
# Set tier root (required so hook commands can find the tier's runtime)
export RUNE_PRO_ROOT=~/rune-pro        # or monorepo sibling path
rune hooks install --preset gentle --tier pro
rune hooks install --preset gentle --tier pro --tier business   # stacked tiers
```

If `RUNE_PRO_ROOT` is unset, `install` still writes the hooks but warns — the dispatched commands will no-op until the env var is set.

**Reading the matrix:**

- `auto-fire` = the IDE invokes Rune automatically on the matching event (true hook parity).
- `rule-inject` = the IDE injects guidance text into the agent prompt when editing matching files. Best-effort — the agent may skip it.
- `workflow` = user-triggered only (`/rune-preflight`). Rune also installs a cascade-rule to remind the agent to invoke it.
- `—` = not supported by the platform. `rune hooks status` flags this so you know which guarantees are missing.

## What gets installed

For each platform, Rune writes artifacts that can be re-run idempotently and removed cleanly.

### Claude Code (`.claude/settings.json`)

Merges into the `hooks` object, preserving any user-authored entries. Rune entries are identified by the `npx --yes @rune-kit/rune hook-dispatch <skill>` command signature — no comment markers needed.

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune hook-dispatch preflight --gentle" }] },
      { "matcher": "Bash",        "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune hook-dispatch sentinel --gentle" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune hook-dispatch dependency-doctor --gentle" }] }
    ],
    "Stop": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune hook-dispatch completion-gate --gentle" }] }
    ]
  }
}
```

### Cursor (`.cursor/rules/rune-*.mdc`)

Three auto-attach rules:

- `rune-preflight.mdc` — `alwaysApply: true`, fires before any source-file edit.
- `rune-sentinel.mdc` — glob-scoped to `**/*.sh`, `Dockerfile`, `.github/workflows/*.yml`, `.env*`.
- `rune-dependency-doctor.mdc` — scoped to manifest / lockfile edits.

No `completion-gate` equivalent — Cursor has no Stop-hook primitive. Invoke manually via `/rune completion-gate` before wrapping up.

### Windsurf (`.windsurf/workflows/` + `.windsurf/rules/`)

Two artifacts per skill:

- **Workflows** (`rune-preflight.md`, etc.) — user-invoked via `/rune-preflight` slash command.
- **Cascade rules** (`rune-preflight-rule.md`, etc.) — inject "run /rune-preflight first" into the agent prompt when editing matching globs.

Cascade rules approximate auto-fire but the user still has to run the workflow command. This is a Windsurf platform limitation.

### Antigravity (`.antigravity/rules/rune-*.md`)

Experimental — mirrors Cursor's rule-injection pattern because Antigravity doesn't yet expose a tool-level hook primitive. Status may change as the platform matures.

## Idempotency & safety

- **Signature-based detection**: Claude hooks are identified by command substring, Cursor/Windsurf/Antigravity files by `rune-managed: true` frontmatter + `@rune-kit/rune hook-dispatch` signature. No HTML-comment markers.
- **User entries preserved**: Every adapter's `uninstall` walks the artifact directory and removes only files that carry the Rune signature. User-authored rules, workflows, and hooks in the same directory are untouched.
- **Re-run safe**: `install` replaces Rune entries in-place; two consecutive runs produce byte-identical output.
- **Malformed JSON**: `.claude/settings.json` with broken JSON throws an actionable error instead of overwriting — fix manually or delete and re-install.

## Choosing a preset

- Start with `gentle` while you learn how the hooks feel. WARN mode surfaces findings in your terminal without blocking work.
- Switch to `strict` once you trust the signal. BLOCK mode refuses the tool call until you address the finding.
- Use `--platform all --preset strict` for team/shared machines where you want maximum discipline everywhere.

## Limitations

- Only Claude Code gets `Stop` (completion-gate) auto-fire. Every other platform requires manual `/rune completion-gate` invocation.
- Cursor/Windsurf/Antigravity rule-injection is best-effort — the underlying LLM still decides whether to read and apply the rule. `strict` mode on these platforms is advisory, not enforced.
- `rune hooks status --platform all` is the single source of truth for "what am I actually getting on this machine." Check it after install.

See also: `docs/MULTI-PLATFORM.md` (skill compilation matrix), `.rune/plan-rune-autodiscipline.md` (design rationale).
