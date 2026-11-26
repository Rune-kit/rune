# Rune Hooks — Multi-Platform Auto-Discipline

Rune skills are libraries by default. `rune hooks install` turns them into a **runtime**: your IDE auto-invokes `preflight`, `sentinel`, `dependency-doctor`, `completion-gate`, and `quarantine` at the right moments — before you commit insecure code, before you weaken the tests that were supposed to protect a rewrite, before you forget to run tests, before you ship a half-finished change, before you trust an untrusted external content blob.

Different AI IDEs expose different primitives. This doc explains what "auto-fire" actually means on each platform so you know what you're getting.

## Quick start (recommended)

```bash
# One command — interactive wizard auto-detects Pro/Business, asks scope/preset
rune setup
```

The wizard handles 95% of cases. Use the explicit flags below only for CI / scripting / advanced multi-platform setups.

## Manual flags

```bash
# Auto-detect platforms (.claude/, .codex/, .cursor/, .windsurf/, .agents/, .grok/, .gemini/)
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

### What is enforced and what is advisory

`rune hook-dispatch <skill>` runs the same scripts the Claude plugin ships (`hooks/<script>/index.cjs`) and translates their verdict into the runtime's reply format (`--format claude|cursor|gemini|antigravity`).

| Gate | Script | Can block? |
|---|---|---|
| preflight | `pre-tool-guard` — private keys / certificates (`*.pem`, `id_rsa`, `id_ed25519`, …). Also **test-integrity** on Edit/Write of test files (assertion removal, new skips, changed expected literals, frozen-path edits). | **yes, under `strict`** |
| sentinel | `secrets-scan` — secrets in a `git commit`. Also **test-integrity** on the staged test-file diff. | **yes, under `strict`** |
| quarantine | `quarantine` — marks fetched / MCP content as data | no (advisory context) |
| dependency-doctor | built in — notes a manifest edit (`package.json`, `requirements.txt`, …) | no |
| completion-gate | built in — notes uncommitted changes at the end of a turn | no |

On Claude Code (and runtimes that read its settings), `strict` also adds a separate `Read` matcher group that runs only preflight, so a private key is stopped before it is read into context, not just before it is edited. Tier hooks that join `Edit|Write` never run on reads.

Every verdict is appended to `.rune/metrics/gate-outcomes.jsonl` (`blocked`, `bypassed` = gentle would-block, `passed`, `error`), which Business's Govern tab reads. Passes are only logged in projects that already have a `.rune/` folder; set `RUNE_GATE_LOG=0` to turn the log off.

Under `gentle` a would-be block is printed as `would block (strict preset)` and the call goes through. If a script crashes or takes longer than 20 s the dispatcher allows the call (fail-open) — a broken hook must never wedge the agent. Hooks only enforce on runtimes that run them; on Windsurf (and anywhere Rune compiles to rules) the same checks are guidance the model may ignore.

Installed commands pin the Rune version (`npx --yes @rune-kit/rune@<version> hook-dispatch …`, e.g. `@2.33.0`), so a hook never silently picks up a newer release; `rune doctor --hooks` reports drift after an upgrade.

## Test-integrity gate

The same analyzer runs from the CLI and from the preflight / sentinel hooks:

```bash
rune verify --integrity              # worktree + index vs HEAD
rune verify --integrity --staged     # what a commit would land
rune verify --integrity --base main  # vs a branch or tag
rune verify --integrity --json       # machine-readable fingerprints
```

It inspects diffs of test files (Jest/Vitest/Mocha, pytest/unittest, Go, Rust, JUnit) and flags deleted or commented assertions, loosened matchers, added skip/only/xfail/todo, snapshot updates, changed expected literals, deleted tests, a net assertion-count drop, and mocks that replace a previously real call. Each finding is a fingerprint `{file, line, rule, before, after}`.

**Strict blocks** on `assert-removed`, `skip-added`, `expected-changed`, and any edit under a frozen path. **Gentle** warns. Adding tests or assertions, renaming a test, and formatting-only changes are designed to stay clean.

Frozen paths default to `tests/char/**` (characterization tests from `safeguard`) and `tests/holdout/**` (a suite the implementer does not own). Override the list in `.rune/test-integrity.json`:

```json
{ "frozenPaths": ["tests/char/**", "tests/holdout/**"] }
```

An intentional test change (safeguard re-baseline, a human-approved new expectation) needs an auditable override. The reason must be at least three characters. The hook logs `outcome: overridden` plus the reason to `.rune/metrics/gate-outcomes.jsonl`.

```bash
# environment, for a single hook invocation
RUNE_TEST_CHANGE_APPROVED="safeguard rebase of billing characterization"

# or a git commit trailer
git commit -m "test(char): rebase billing" \
  -m "Test-Change-Approved: safeguard rebase of billing characterization"
```

The hook message tells the agent to fix the code, not the tests, or to get that human approval. A broken integrity check fails open (the call runs) like the other gates.

## Platform capability matrix

| Platform    | Maturity     | Pre-edit  | Pre-Bash   | Post-edit | Stop (completion-gate) | Native artifact                     |
|-------------|--------------|-----------|------------|-----------|------------------------|-------------------------------------|
| Claude Code | **stable**   | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.claude/settings.json` (JSON)      |
| OpenAI Codex | **stable**  | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.codex/hooks.json` (JSON)          |
| Cursor      | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.cursor/hooks.json` (JSON, also run by Grok Build) |
| Windsurf    | beta         | workflow + cascade-rule | workflow | — | —                      | `.windsurf/workflows/` + `.windsurf/rules/` |
| Antigravity | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.agents/hooks.json` + `.agents/rules/` |
| Grok Build  | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.grok/hooks/rune.json` — or the shared `.cursor/hooks.json` |
| Gemini CLI  | beta         | auto-fire | auto-fire  | auto-fire | **auto-fire**          | `.gemini/settings.json` (JSON)      |

### Pro tier (`--tier pro`)

| Entry | Claude | Codex | Grok Build | Cursor | Antigravity | Gemini CLI | Windsurf |
|----------------|------------|-----------|------------|------------|-------------|------------|----------|
| context-inject | auto-fire UserPromptSubmit | auto-fire | auto-fire (additionalContext is discarded) | auto-fire `beforeSubmitPrompt` | auto-fire `PreInvocation` | auto-fire `BeforeAgent` | workflow + cascade-rule |
| context-sense | auto-fire PreToolUse | auto-fire | auto-fire | auto-fire `preToolUse` | auto-fire `PreToolUse` | auto-fire `BeforeTool` | workflow + cascade-rule |
| context-reset | PreCompact + SessionStart | auto-fire | auto-fire | `preCompact` + `sessionStart` | SessionStart only (no compact event) | `PreCompress` + SessionStart | — |
| context-pulse | — | — | — | — | — | auto-fire `AfterModel` (token ingest) | — |
| loop-circuit-breaker | auto-fire | auto-fire | — | — | — | — | — |
| rune-pulse | project `statusLine` (real %) | built-in footer + Pro HUD | user `~/.grok/config.toml` `[ui.status_line]` (real %; a repo file cannot set this) | CLI: user `~/.cursor/cli-config.json` `statusLine`; IDE: context ring + `preCompact` | user `~/.gemini/antigravity-cli/settings.json` `statusLine` (real %) | built-in footer only (enable `ui.footer.hideContextPercentage=false`); hook % is an estimate | — |

**Capability reading:**

- `auto-fire` = a native lifecycle primitive with true runtime behavior.
- Claude's executable `statusLine` can run the full Rune Pulse renderer inside the native footer.
- Grok Build, Antigravity CLI and Cursor CLI also support a command status line, but only in **user-level** config. After `rune hooks install --tier pro`, run `node "$RUNE_PRO_ROOT/hooks/rune-pulse/index.cjs" setup`. The command never overwrites a status line you wrote.
- Codex's `[tui].status_line` supports built-in footer items only. The full rich Rune Pulse display runs separately as the Pro watcher/HUD (`node "$RUNE_PRO_ROOT/hooks/rune-pulse-codex/index.cjs" watch`); it is not a native executable status-line hook. `setup` writes the built-in items (`context-used` included).
- When a runtime does not expose a real percentage, the pulse labels the number `est`.
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

Merges into the `hooks` object, preserving any user-authored entries. Rune entries are identified by the `npx --yes @rune-kit/rune[@<version>] hook-dispatch <skill>` command signature — no comment markers needed.

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune@<version> hook-dispatch preflight --gentle", "async": true }] },
      { "matcher": "Bash",        "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune@<version> hook-dispatch sentinel --gentle" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune@<version> hook-dispatch dependency-doctor --gentle" }] }
    ],
    "Stop": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune@<version> hook-dispatch completion-gate --gentle" }] }
    ]
  }
}
```

### Cursor and Grok Build (`.cursor/hooks.json`)

Native hooks (cursor.com/docs/hooks). Rune merges its entries into the file and leaves your own hooks alone:

| Skill | Event | Matcher |
|---|---|---|
| preflight | `preToolUse` | `Read\|Write\|StrReplace` |
| sentinel | `preToolUse` | `Shell` |
| dependency-doctor | `postToolUse` | `Write\|StrReplace` |
| quarantine | `postToolUse` | `MCP:.*\|mcp__.*\|Read\|WebFetch\|Fetch` |
| completion-gate | `stop` | — |

Each entry is written in a **hybrid shape** that both runtimes accept:

```json
{ "command": "npx --yes @rune-kit/rune@<version> hook-dispatch sentinel --format cursor", "matcher": "Shell", "timeout": 30,
  "hooks": [{ "type": "command", "command": "npx --yes @rune-kit/rune@<version> hook-dispatch sentinel --format cursor", "timeout": 30 }] }
```

Cursor reads the flat `command` / `matcher` / `timeout`; Grok Build reads `.cursor/hooks.json` too, runs only the nested matcher-group `hooks`, and would otherwise report "this Cursor hook won't run" for a flat entry. Grok maps Cursor's tool names (`Shell`, `StrReplace`, `Write`, `Read`) to its own, so one file drives both. Sentinel uses `preToolUse` + `Shell` rather than `beforeShellExecution`, because that event's matcher means the command text in Cursor and the tool name in Grok. Older `beforeShellExecution` / `afterFileEdit` Rune entries are removed on reinstall.

`--format cursor` matters: Cursor blocks the action when a permission hook prints anything that is not valid JSON, so the dispatcher prints `{"permission":"allow"}` for permission events and `{}` for events it knows are not (`postToolUse`, `stop`, …). A strict BLOCK prints `{"permission":"deny", …}`, writes the reason to stderr and exits 2, which both Cursor and Grok treat as deny.

- `rune hooks install --platform cursor,grok` writes `.cursor/hooks.json` only and removes `.grok/hooks/rune.json`, so Grok does not register every gate twice. The same happens with `--platform grok` when `.cursor/hooks.json` already carries Rune entries (unless a paid tier needs `.grok/hooks`).
- Project hooks run from the project root and only in a trusted workspace (Cursor: Settings → Hooks; Grok: `/hooks-trust` or `grok --trust`).
- Cursor and Grok also import Claude hooks from `.claude/settings.json`. With Rune hooks in both files they fire twice; the installer warns. Keep one.
- Earlier versions wrote `rune-preflight.mdc` / `rune-sentinel.mdc` / `rune-dependency-doctor.mdc`. Install now deletes those (the hooks replace them); tier rules that inject guidance text (`rune-<tier>-*.mdc`) stay, because a hook cannot add prompt text.
- The Cursor plugin's `.cursor-plugin/hooks.json` is deliberately empty: plugin hooks would run `npx` on every tool call for everyone who installs the plugin. Hooks stay opt-in per project through the installer.
- Verified with the `grok` CLI (1.0.92, `grok inspect --json`: 5 hooks, no `hookLoadErrors`; CI job `grok-build-compat`). Cursor's acceptance of the extra nested `hooks` key follows its documented schema but has not been run in the Cursor IDE.

### Windsurf (`.windsurf/workflows/` + `.windsurf/rules/`)

Two artifacts per skill:

- **Workflows** (`rune-preflight.md`, etc.) — user-invoked via `/rune-preflight` slash command.
- **Cascade rules** (`rune-preflight-rule.md`, etc.) — inject "run /rune-preflight first" into the agent prompt when editing matching globs.

Cascade rules approximate auto-fire but the user still has to run the workflow command. This is a Windsurf platform limitation.

### Antigravity (`.agents/hooks.json` + `.agents/rules/`)

Native hooks (antigravity.google/docs/hooks), read by the Antigravity IDE and Antigravity CLI. Each top-level key of `.agents/hooks.json` is a named hook; Rune owns the `rune-<skill>` keys and keeps any others:

| Hook | Event | Matcher |
|---|---|---|
| `rune-preflight` | `PreToolUse` | `view_file\|write_to_file\|replace_file_content\|multi_replace_file_content` |
| `rune-sentinel` | `PreToolUse` | `run_command` |
| `rune-dependency-doctor` | `PostToolUse` | `write_to_file\|replace_file_content\|multi_replace_file_content` |
| `rune-quarantine` | `PostToolUse` | `read_url_content\|search_web\|mcp_.*\|view_file` |
| `rune-completion-gate` | `Stop` | — |

Commands are `npx --yes @rune-kit/rune@<version> hook-dispatch <skill> --format antigravity --event <Event> [--gentle]` (Antigravity's payload carries no event name, hence `--event`). The dispatcher answers `{"decision":"allow"}` / `{"decision":"deny","reason":…}` on `PreToolUse`, `{}` on `PostToolUse`, and never asks `Stop` to continue. Pro/Business guidance rules go to `.agents/rules/rune-<tier>-*.md`; the old `.antigravity/rules/rune-*.md` files are removed on install. Gemini CLI is now Google's enterprise (Gemini Code Assist) CLI; individual users are on Antigravity CLI, which reads these same files. Not yet run in a signed-in Antigravity session.

### Grok Build (`.grok/hooks/rune.json`)

Native hooks (docs.x.ai/build/features/hooks). Grok reads project hooks from `.grok/hooks/*.json` with the same shape as Claude's `hooks` block and maps Claude tool names in `matcher`, so Rune writes the Claude preset into its own file, drops Claude's `async` flag (not in Grok's schema) and sets `timeout: 30` (Grok's default of 5 s is too short for a cold `npx`). Strict mode blocks through exit code 2, which Grok treats as deny; anything else is fail-open. Project hooks run only after the folder is trusted (`/hooks-trust` or `grok --trust`). Grok also reads `.claude/settings.json` and `.cursor/hooks.json` — if Rune hooks are installed there too they fire twice: the installer skips `.grok/hooks/rune.json` when `.cursor/hooks.json` already has the Free preset (see above) and warns about `.claude/settings.json`. Uninstall deletes `rune.json` and leaves other hook files alone.

### Gemini CLI (`.gemini/settings.json`)

Native hooks (geminicli.com docs/hooks). Gemini reads project hooks from the `hooks` key of `.gemini/settings.json`, Claude-shaped but with Gemini event and tool names and `timeout` in milliseconds. Rune merges these entries and keeps every other setting:

| Skill | Gemini event | Matcher |
|---|---|---|
| preflight | `BeforeTool` | `write_file\|replace` |
| sentinel | `BeforeTool` | `run_shell_command` |
| dependency-doctor | `AfterTool` | `write_file\|replace` |
| quarantine | `AfterTool` | `web_fetch\|read_file\|read_many_files\|mcp_.*` |
| completion-gate | `AfterAgent` | — |

Each entry has `name: "rune-<skill>"` (so `/hooks disable rune-sentinel` works), `timeout: 30000` and the command `npx --yes @rune-kit/rune@<version> hook-dispatch <skill> --format gemini [--gentle]`. Gemini parses stdout as JSON and shows stray text as a system message, so `--format gemini` prints `{}`. Exit 2 blocks the tool (`BeforeTool`) or asks for a retry (`AfterAgent`). Gemini fingerprints project hooks and asks you to trust them on first run. Claude Code and Grok never read this file. The Rune Gemini extension ships separate lifecycle hooks (`hooks/hooks.json`), which do not overlap with these. Pro/Business tier entries are not mapped to Gemini yet; the installer skips them with a note.

## Idempotency & safety

- **Signature-based detection**: JSON hooks (Claude, Codex, Cursor, Grok, Gemini, Antigravity) are identified by the dispatch command signature; Cursor/Antigravity tier rules and Windsurf files by `rune-managed: true` frontmatter + `@rune-kit/rune hook-dispatch` signature. No HTML-comment markers.
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

- `Stop` (completion-gate) auto-fires on Claude Code, Codex, Cursor (`stop`), Grok, Antigravity and Gemini CLI (`AfterAgent`). Windsurf needs a manual `/rune completion-gate`.
- Windsurf and the Cursor / Antigravity tier rules are best-effort — the underlying LLM still decides whether to read and apply the rule. `strict` mode on these platforms is advisory, not enforced.
- `rune hooks status --platform all` is the single source of truth for "what am I actually getting on this machine." Check it after install.

See also: `docs/MULTI-PLATFORM.md` (skill compilation matrix), `.rune/plan-rune-autodiscipline.md` (design rationale).
