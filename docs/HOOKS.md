# Rune Hooks — Multi-Platform Auto-Discipline

Rune skills are libraries by default. `rune hooks install` turns them into a **runtime**: your IDE auto-invokes `preflight`, `sentinel`, `dependency-doctor`, `completion-gate`, and `quarantine` at the right moments — before you commit insecure code, before you forget to run tests, before you ship a half-finished change, before you trust an untrusted external content blob.

Different AI IDEs expose different primitives. This doc explains what "auto-fire" actually means on each platform so you know what you're getting.

## Quick start (recommended)

```bash
# One command — interactive wizard auto-detects Pro/Business, asks scope/preset
rune setup
```

The wizard handles 95% of cases. Use the explicit flags below only for CI / scripting / advanced multi-platform setups.

## Manual flags

```bash
# Auto-detect platforms (.claude/, .codex/, .cursor/, .windsurf/, .antigravity/, .grok/, .gemini/)
rune hooks install --preset gentle

# Install GLOBALLY — every Claude Code session, regardless of project
rune hooks install --preset gentle --global

# Install globally for Codex
rune hooks install --preset gentle --global --platform codex

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

# Drift report — does installed match the canonical preset?
rune doctor --hooks
```

## `rune setup` — interactive wizard

Run once per machine (or per project) to wire everything in one shot:

```
$ rune setup

  Rune Setup Wizard
  ──────────────────
  Free version:    2.17.0 (cached)
  Pro detected:    sibling (../Pro) (v1.1.0)
  Business:        not detected

  Where to install hooks?
    [c] Current project — D:/MyProject/.claude/settings.json
    [g] Global          — ~/.claude/settings.json
         (every Claude Code session, regardless of project)

  Scope [c/g] (default c): g

  Which tiers to install?
    [x] Free (always — required)
    [?] Pro      — detected sibling (../Pro) (v1.1.0)

  Install Pro tier? [Y/n]: y

  Preset:
    [g] gentle — advisory mode, hooks warn but never block (recommended)
    [s] strict — hooks BLOCK on violations (CI/AFK use)

  Preset [g/s] (default g): g

  Rune Setup Complete
  ──────────────────
  Scope:     GLOBAL (~/.claude/settings.json)
  Tiers:     Free + pro
  Preset:    gentle
  Platforms: claude

  Verify:
    rune doctor --hooks   # check drift
    rune hooks status     # show wired skills
```

### Wizard scope options

| Choice    | Writes to                     | Use when                                                    |
|-----------|-------------------------------|-------------------------------------------------------------|
| `current` | `<cwd>/.claude/settings.json` | Project-specific config — different rules per project       |
| `global`  | `~/.claude/settings.json`     | One-shot for all Claude Code sessions, regardless of cwd    |

**Global mode** is what most users want for first-time setup. Smart hooks self-disable when context doesn't fit (e.g., `loop-circuit-breaker` only fires when `.rune/autopilot-state.json` exists in the active project — silent in personal scratch projects).

### Wizard tier auto-detection

The wizard searches for tier manifests in this order:

1. `$RUNE_PRO_ROOT/hooks/manifest.json` (env var)
2. `<cwd>/../Pro/hooks/manifest.json` (monorepo sibling — typical for Rune dev clones)
3. Well-known paths: `D:/Project/Rune/Pro`, `~/rune-pro`, `~/Project/Rune/Pro`

Same logic for `--tier business`. If detected, the wizard pre-fills the prompt with the detected version.

### Non-interactive mode (CI / scripts)

Pass flags to skip prompts:

```bash
# Project install with Pro tier, gentle preset
rune setup --here --tier pro --preset gentle

# Global install with both tiers, strict preset
rune setup --global --tier pro,business --preset strict

# Free-only, no tiers
rune setup --here --no-tier --preset gentle

# Dry-run (preview without writing)
rune setup --here --dry
```

Presets:

- `gentle` → WARN on findings, don't block the user.
- `strict` → BLOCK on findings, require explicit override.
- `off`    → equivalent to `rune hooks uninstall`.

## Platform capability matrix

| Platform    | Maturity     | Pre-edit  | Pre-Bash   | Post-edit | Stop (completion-gate) | Native artifact                     |
|-------------|--------------|-----------|------------|-----------|------------------------|-------------------------------------|
| Claude Code | **stable**   | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.claude/settings.json` (JSON)      |
| OpenAI Codex | **stable**  | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.codex/hooks.json` (JSON)          |
| Cursor      | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.cursor/hooks.json` (JSON)         |
| Windsurf    | beta         | workflow + cascade-rule | workflow | — | —                      | `.windsurf/workflows/` + `.windsurf/rules/` |
| Antigravity | experimental | rule-inject | —        | —         | —                      | `.antigravity/rules/rune-*.md`      |
| Grok Build  | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.grok/hooks/rune.json` (JSON)      |
| Gemini CLI  | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.gemini/settings.json` (JSON)      |

### Pro tier (`--tier pro`)

| Entry          | Claude     | Codex     | Cursor         | Windsurf                 | Antigravity    | Notes                                      |
|----------------|------------|-----------|----------------|--------------------------|----------------|--------------------------------------------|
| context-inject | auto-fire  | auto-fire | rule-alwaysApply | workflow + cascade-rule | rule-alwaysApply | UserPromptSubmit event, runs per prompt   |
| context-sense  | auto-fire  | auto-fire | rule-glob      | workflow + cascade-rule  | rule-glob      | PreToolUse edit matcher, session-keyed     |
| loop-circuit-breaker | auto-fire | auto-fire | — | — | — | Claude/Codex tool names share one budget guard |
| rune-pulse     | native executable `statusLine` | built-in `[tui].status_line` footer / external Pro HUD | — | — | — | Codex does not expose an arbitrary executable status-line hook |

**Capability reading:**

- `auto-fire` = a native lifecycle primitive with true runtime behavior.
- Claude's executable `statusLine` can run the full Rune Pulse renderer inside the native footer.
- Codex's `[tui].status_line` supports built-in footer items only. The full rich Rune Pulse display runs separately as the Pro watcher/HUD (`node "$RUNE_PRO_ROOT/hooks/rune-pulse-codex/index.cjs" watch`); it is not a native executable status-line hook.
- `rule-alwaysApply` / `rule-glob` = best-effort rule injection, agent still decides.
- `workflow + cascade-rule` = user-invoked `/rune-pro-context-inject` + a cascade reminder.
- `—` = platform can't host the entry. `rune hooks status` lists skipped entries per-tier.

Install with:

```bash
# Set tier root (required so hook commands can find the tier's runtime)
export RUNE_PRO_ROOT=~/rune-pro        # or monorepo sibling path
rune hooks install --preset gentle --tier pro
rune hooks install --preset gentle --tier pro --tier business   # stacked tiers
```

If `RUNE_PRO_ROOT` is unset, `install` still writes the hooks but warns — the dispatched commands will no-op until the env var is set.

### Version compatibility

Tier manifests may declare a `minFreeVersion` field. When set, `rune hooks install --tier <name>` checks the local Free compiler version and aborts with an actionable upgrade message if too old — no silent mismatches.

| Tier        | Tier version | Requires Free ≥ | Behavior when Free < min |
|-------------|--------------|-----------------|--------------------------|
| Pro         | 1.0.1+       | 2.12.1          | `install` throws with `npm i -g @rune-kit/rune@latest` hint |
| Pro         | 1.0.0        | (none)          | installs against any Free ≥ 2.12.0 |
| Business    | (reserved)   | —               | — |

**Upgrade flow:**

```bash
# If you see: "Tier 'pro' requires Rune Free >= 2.12.1 but the installed compiler is 2.12.0"
npm i -g @rune-kit/rune@latest
rune hooks install --tier pro  # re-run, version check now passes
```

If a tier manifest is missing entirely, `install` now prints all search locations (env var + monorepo sibling) plus three concrete fixes (set env, clone sibling, or drop `--tier` for Free-only mode).

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

### Cursor (`.cursor/hooks.json`)

Native hooks (cursor.com/docs/hooks): `{ "version": 1, "hooks": { "<event>": [{ "command", "matcher", "timeout" }] } }`. Rune merges its entries into the file and leaves your own hooks alone:

| Skill | Cursor event | Matcher |
|---|---|---|
| preflight | `preToolUse` | `Write` |
| sentinel | `beforeShellExecution` | — |
| dependency-doctor | `afterFileEdit` | — |
| quarantine | `postToolUse` | `MCP:.*\|Read` |
| completion-gate | `stop` | — |

Each command is `npx --yes @rune-kit/rune hook-dispatch <skill> --format cursor [--gentle]` with `timeout: 30` (seconds). `--format cursor` matters: Cursor blocks the action when a permission hook (`preToolUse`, `beforeShellExecution`, …) prints anything that is not valid JSON, so the dispatcher prints `{"permission":"allow"}` there and `{}` elsewhere, with its advisory line on stderr. Strict BLOCK exits 2, which Cursor treats as deny.

- Project hooks run from the project root and only in a trusted workspace; check Settings → Hooks.
- Cursor also imports Claude hooks from `.claude/settings.json` (Settings → Agents → Third-Party Imports, on by default). With Rune hooks in both files they fire twice; the installer warns. Keep one.
- Earlier versions wrote `rune-preflight.mdc` / `rune-sentinel.mdc` / `rune-dependency-doctor.mdc`. Install now deletes those (the hooks replace them); tier rules that inject guidance text (`rune-<tier>-*.mdc`) stay, because a hook cannot add prompt text.
- The Cursor plugin's `.cursor-plugin/hooks.json` is deliberately empty: plugin hooks would run `npx` on every tool call for everyone who installs the plugin, and Rune's lifecycle scripts emit the Claude/Codex envelope, which Cursor's permission hooks would reject. Hooks stay opt-in per project through the installer.

### Windsurf (`.windsurf/workflows/` + `.windsurf/rules/`)

Two artifacts per skill:

- **Workflows** (`rune-preflight.md`, etc.) — user-invoked via `/rune-preflight` slash command.
- **Cascade rules** (`rune-preflight-rule.md`, etc.) — inject "run /rune-preflight first" into the agent prompt when editing matching globs.

Cascade rules approximate auto-fire but the user still has to run the workflow command. This is a Windsurf platform limitation.

### Antigravity (`.antigravity/rules/rune-*.md`)

Experimental — mirrors Cursor's rule-injection pattern because Antigravity doesn't yet expose a tool-level hook primitive. Status may change as the platform matures.

### Grok Build (`.grok/hooks/rune.json`)

Native hooks (docs.x.ai/build/features/hooks). Grok reads project hooks from `.grok/hooks/*.json` with the same shape as Claude's `hooks` block and maps Claude tool names in `matcher`, so Rune writes the Claude preset into its own file, drops Claude's `async` flag (not in Grok's schema) and sets `timeout: 30` (Grok's default of 5 s is too short for a cold `npx`). Strict mode blocks through exit code 2, which Grok treats as deny; anything else is fail-open. Project hooks run only after the folder is trusted (`/hooks-trust` or `grok --trust`). Grok also reads `.claude/settings.json` — if Rune hooks are installed there too they fire twice, and the installer warns. Uninstall deletes `rune.json` and leaves other hook files alone.

### Gemini CLI (`.gemini/settings.json`)

Native hooks (geminicli.com docs/hooks). Gemini reads project hooks from the `hooks` key of `.gemini/settings.json`, Claude-shaped but with Gemini event and tool names and `timeout` in milliseconds. Rune merges these entries and keeps every other setting:

| Skill | Gemini event | Matcher |
|---|---|---|
| preflight | `BeforeTool` | `write_file\|replace` |
| sentinel | `BeforeTool` | `run_shell_command` |
| dependency-doctor | `AfterTool` | `write_file\|replace` |
| quarantine | `AfterTool` | `web_fetch\|read_file\|read_many_files\|mcp_.*` |
| completion-gate | `AfterAgent` | — |

Each entry has `name: "rune-<skill>"` (so `/hooks disable rune-sentinel` works), `timeout: 30000` and the command `npx --yes @rune-kit/rune hook-dispatch <skill> --format gemini [--gentle]`. Gemini parses stdout as JSON and shows stray text as a system message, so `--format gemini` prints `{}`. Exit 2 blocks the tool (`BeforeTool`) or asks for a retry (`AfterAgent`). Gemini fingerprints project hooks and asks you to trust them on first run. Claude Code and Grok never read this file. The Rune Gemini extension ships separate lifecycle hooks (`hooks/hooks.json`), which do not overlap with these. Pro/Business tier entries are not mapped to Gemini yet; the installer skips them with a note.

## Idempotency & safety

- **Signature-based detection**: JSON hooks (Claude, Codex, Cursor, Grok, Gemini) are identified by the dispatch command signature; Cursor tier rules and Windsurf/Antigravity files by `rune-managed: true` frontmatter + `@rune-kit/rune hook-dispatch` signature. No HTML-comment markers.
- **User entries preserved**: Every adapter's `uninstall` walks the artifact directory and removes only files that carry the Rune signature. User-authored rules, workflows, and hooks in the same directory are untouched.
- **Re-run safe**: `install` replaces Rune entries in-place; two consecutive runs produce byte-identical output.
- **Malformed JSON**: `.claude/settings.json` with broken JSON throws an actionable error instead of overwriting — fix manually or delete and re-install.

## Choosing a preset

- Start with `gentle` while you learn how the hooks feel. WARN mode surfaces findings in your terminal without blocking work.
- Switch to `strict` once you trust the signal. BLOCK mode refuses the tool call until you address the finding.
- Use `--platform all --preset strict` for team/shared machines where you want maximum discipline everywhere.

## Doctor tier-coverage check

`rune doctor` emits an advisory WARN when a paid tier's hooks are installed unevenly:

- **Gap detected**: Pro hooks present on `.claude/settings.json` but no `rune-pro-*` files under `.cursor/rules/` (and `.cursor/` is a detected platform) → doctor suggests `rune hooks install --preset gentle --tier pro --platform all`.
- **Missing env var**: tier manifest declares `requires: ["RUNE_PRO_ROOT"]` but the var is unset → doctor warns that installed commands will FAIL at runtime.

These are warnings only — doctor never fails the pipeline for tier-coverage issues. Silent when no tier is installed.

## Context watch and the Pro hint

The Free plugin's `context-watch` hook (PreToolUse, all tools) counts tool calls as a context-pressure proxy: a yellow note at 80 calls, a red one at 120 (repeating every 20), each pointing at `rune:context-engine`.

On the **first red warning of a session**, and only then, it adds one line about Rune Pro's statusline with the pricing link. It is never shown when a paid tier is wired (`RUNE_PRO_ROOT` or `RUNE_BUSINESS_ROOT` set — Pro replaces `context-watch` with `context-sense` anyway), it makes no network call, and you can turn it off for good:

```bash
export RUNE_PRO_HINT=0   # also accepts false / off / no
```

## Limitations

- `Stop` (completion-gate) auto-fires on Claude Code, Codex, Cursor (`stop`), Grok and Gemini CLI (`AfterAgent`). Windsurf and Antigravity need a manual `/rune completion-gate`.
- Windsurf/Antigravity (and Cursor tier rules) rule-injection is best-effort — the underlying LLM still decides whether to read and apply the rule. `strict` mode on these platforms is advisory, not enforced.
- `rune hooks status --platform all` is the single source of truth for "what am I actually getting on this machine." Check it after install.

See also: `docs/MULTI-PLATFORM.md` (skill compilation matrix), `.rune/plan-rune-autodiscipline.md` (design rationale).
