# Rune CLI

The Rune CLI compiles 66 AI coding skills into 13 platform-native formats. One skill mesh, every editor.

---

## Quick Start

**Step 1** -- Install and initialize in your project:

```bash
cd your-project
npx @rune-kit/rune init
```

Rune auto-detects your platform (Cursor, Windsurf, Antigravity) and compiles skills into the correct format.

**Step 2** -- Start your AI assistant:

```bash
# Cursor / Windsurf / Antigravity / Generic
# Open your editor -- skills are loaded automatically from the rules directory.

# Claude Code -- no compilation needed, Rune runs as a native plugin:
claude
```

**Step 3** -- Verify the setup:

```bash
npx @rune-kit/rune doctor
```

That's it. 66 skills are now active in your AI assistant.

> **Pro Tip**: For Claude Code, skip the CLI entirely. Install Rune as a plugin:
> `claude plugin add rune-kit/rune` -- skills load natively with zero compilation.

---

## Commands

### `rune init`

Interactive setup. Detects your platform, creates `rune.config.json`, and compiles all skills in one step.

```bash
npx @rune-kit/rune init
```

```
  +----------------------------------------------+
  |  Rune -- Less skills. Deeper connections.      |
  +----------------------------------------------+

  -> Detected: cursor
  -> Created rune.config.json
  -> Built 66 skills + 14 extensions to .cursor/skills/
```

**Flags**:

| Flag | Description | Example |
|------|-------------|---------|
| `--platform <name>` | Override auto-detection | `rune init --platform windsurf` |
| `--extensions <list>` | Enable specific extension packs | `rune init --extensions @rune/ui,@rune/backend` |
| `--disable <skills>` | Disable specific skills | `rune init --disable video-creator,asset-creator` |

If Claude Code is detected (`.claude-plugin/` exists), init exits early with a message -- no compilation needed.

---

### `rune build`

Recompile skills using existing config. Run after updating Rune or changing `rune.config.json`.

```bash
npx @rune-kit/rune build
```

```
  [parse]     Discovering skills...
  [transform] Platform: cursor
  [transform] Resolved 142 cross-references
  [transform] Resolved 87 tool-name references
  [emit]      66 skills + 14 extensions

  -> Built 67 files to .cursor/skills/
```

**Flags**:

| Flag | Description | Example |
|------|-------------|---------|
| `--platform <name>` | Override config platform | `rune build --platform windsurf` |
| `--output <dir>` | Override output directory | `rune build --output ../other-project` |
| `--disable <skills>` | Disable specific skills | `rune build --disable trend-scout` |

> **Pro Tip**: Use `--output` to compile Rune into multiple projects from a single source.

---

### `rune doctor`

Validate compiled output. Checks that all skill files exist, cross-references resolve, and config is valid.

```bash
npx @rune-kit/rune doctor
```

Exits with code 0 if healthy, code 1 if issues found. Useful in CI pipelines.

**Flags**:

| Flag | Description |
|------|-------------|
| `--platform <name>` | Override config platform |

---

### `rune update`

Update an existing install in one command. Mirrors the manual "Updating" flow from the README:

1. **Pull paid tier repos** -- any detected Pro/Business checkout gets `git pull --ff-only`. Detection matches `rune setup`: `$RUNE_PRO_ROOT` / `$RUNE_BUSINESS_ROOT` env vars first, then sibling dirs (`../Pro`, `../Business`). Absent tiers and non-git checkouts are skipped with a note; a **failed** pull (dirty tree, auth, diverged branch) aborts the update with a non-zero exit -- nothing is silently half-updated.
2. **Re-run the managed setup rewrite in place** -- non-interactive. The installed platforms, preset, and tiers are detected from your project's existing hook config, so there are no prompts and nothing you didn't install gets added.
3. **Verify** -- compiled-output doctor (build-pipeline projects) + hook drift report, then a short summary of what was updated.

```bash
npx @rune-kit/rune@latest update
```

```
  Rune Update
  ────────────
  Tier repos:
    ✓ pro — pulled: Already up to date.
    · business — not detected — skipping
  Setup rewrite:
    Platforms: claude | Preset: gentle | Tiers: Free + pro
  Verify:
    Doctor: skipped — no rune.config.json — compiled-output check skipped
    Hook drift: 0 drifted, 0 missing, 0 error(s)
```

**Flags**:

| Flag | Description | Example |
|------|-------------|---------|
| `--no-pull` | Skip the tier `git pull` step | `rune update --no-pull` |
| `--preset <p>` | Override the detected preset | `rune update --preset strict` |
| `--tier <list>` | Override the detected tier list | `rune update --tier pro,business` |
| `--dry` | Preview -- no pulls, no writes | `rune update --dry` |

On Codex, if `.codex/hooks.json` changed, the summary reminds you to open `/hooks` and re-trust the definitions.

---

### `rune help`

Show available commands and flags.

```bash
npx @rune-kit/rune help
```

---

## Platforms

Rune compiles to 13 platforms. Each gets skills in its native format.

| Platform | Output Directory | File Format | Detection Marker |
|----------|-----------------|-------------|------------------|
| Claude Code | _(native plugin)_ | `.md` (SKILL.md) | `.claude-plugin/` |
| Cursor | `.cursor/skills/` | SKILL.md (dir-per-skill) | `.cursor/` |
| Windsurf | `.windsurf/skills/` | SKILL.md (dir-per-skill) | `.windsurf/` |
| Antigravity | `.agents/skills/` | SKILL.md (dir-per-skill) | `.agents/` |
| Codex | `.agents/skills/` | SKILL.md + managed `AGENTS.md` + `.codex/agents/*.toml` + `.codex/hooks.json` | `.codex/` |
| OpenCode | `.opencode/skills/` | SKILL.md (dir-per-skill) | `.opencode/` |
| Generic | `.ai/rules/` | `.md` | _(fallback)_ |
| OpenClaw | `.openclaw/rune/` | `.md` + manifest + TS entry | `.openclaw/` |
| Aider | `aider/rules/` | `.md` + `.aider.conf.yml` (read array) | `.aider.conf.yml` |
| GitHub Copilot | `.github/skills/` | SKILL.md (dir-per-skill) + `.github/copilot-instructions.md` | `.github/copilot-instructions.md` |
| Gemini CLI | `.gemini/skills/` | SKILL.md (dir-per-skill) + slim `GEMINI.md` | `GEMINI.md` |
| Qoder | `.qoder/skills/` | SKILL.md (dir-per-skill) + `AGENTS.md` | `.qoder/` |
| Qwen Coder | `.qwen/skills/` | SKILL.md (dir-per-skill) + slim `QWEN.md` | `QWEN.md` |

### Claude Code

Rune is a native Claude Code plugin. No compilation needed.

```bash
# Install as plugin (recommended)
claude plugin add rune-kit/rune

# Or use Rune as a local plugin during development
claude --plugin-dir /path/to/rune
```

Skills load directly from `skills/*/SKILL.md`. The CLI detects `.claude-plugin/` and skips compilation:

```
  -> Claude Code detected -- Rune works as a native plugin. No compilation needed.
```

### Cursor

Skills compile to `.cursor/skills/rune-<name>/SKILL.md` (Cursor 2.4+ Agent Skills — loaded on demand).

```bash
npx @rune-kit/rune init --platform cursor
```

Output: `.cursor/skills/rune-cook/SKILL.md`, `.cursor/skills/rune-plan/SKILL.md`, etc.

Each SKILL.md gets standard Agent Skills frontmatter (`name` + `description`). Cross-references between skills are rewritten to `rune-<skill-name>` format.

### Windsurf

Skills compile to `.windsurf/skills/rune-<name>/SKILL.md` (Cascade Skills).

```bash
npx @rune-kit/rune init --platform windsurf
```

Output: `.windsurf/skills/rune-cook/SKILL.md`, `.windsurf/skills/rune-plan/SKILL.md`, etc.

### Antigravity

Skills compile to `.agents/skills/rune-<name>/SKILL.md` (Google Antigravity Agent Skills).

```bash
npx @rune-kit/rune init --platform antigravity
```

Output: `.agents/skills/rune-cook/SKILL.md`, `.agents/skills/rune-plan/SKILL.md`, etc.

### OpenAI Codex

Install Rune as a native Codex plugin, then compile project-scoped roles and wire synchronous hooks:

```bash
codex plugin marketplace add rune-kit/rune
codex plugin add rune@rune-kit
npx @rune-kit/rune setup --here --platform codex
```

Inside Codex, open `/hooks` to review and trust the installed definitions. Project output includes `.agents/skills/`, a Rune-managed block in `AGENTS.md`, `.codex/agents/rune-{heavy,standard,fast}.toml`, and `.codex/hooks.json`.

If you only want source compilation without installing the plugin:

```bash
npx @rune-kit/rune init --platform codex
```

Codex's `[tui].status_line` supports built-in footer items only. The full rich Pro Pulse display runs as an external watcher/HUD, not as an arbitrary executable status-line hook.

### Generic

Fallback for any AI IDE that reads markdown rules from a directory.

```bash
npx @rune-kit/rune init --platform generic
```

Output: `.ai/rules/rune-cook.md`, `.ai/rules/rune-plan.md`, etc.

### OpenClaw

Skills compile to an OpenClaw plugin structure with manifest, TypeScript entry point, and skill files.

```bash
npx @rune-kit/rune init --platform openclaw
```

Output structure:

```
.openclaw/rune/
  openclaw.plugin.json       # Plugin manifest
  src/index.ts               # register(api) entry point
  skills/                    # Compiled skill files
    rune-cook.md
    rune-plan.md
    rune-skill-router.md
    ...
```

After building, add Rune to your OpenClaw config (`openclaw.json`):

```json
{
  "plugins": {
    "load": {
      "paths": ["./.openclaw/rune"]
    },
    "entries": {
      "rune": {
        "enabled": true
      }
    }
  }
}
```

The generated `src/index.ts` registers a `before_agent_start` hook that injects the skill-router instructions, so OpenClaw routes tasks through Rune skills automatically.

> **Pro Tip**: If you also use the NeuralMemory plugin, Rune coexists with it --
> NeuralMemory occupies the `memory` slot while Rune occupies `skills`.

---

## Auto-Detection

When you run `rune init` without `--platform`, Rune checks for these markers in order:

| Priority | Marker | Platform |
|----------|--------|----------|
| 1 | `.claude-plugin/` | Claude Code (exits early) |
| 2 | `.cursor/` | Cursor |
| 3 | `.windsurf/` | Windsurf |
| 4 | `.agent/` | Antigravity |
| 5 | _(none found)_ | Prompts for selection |

If no marker is found, Rune shows the available platforms and asks you to choose. Unknown input defaults to `generic`.

---

## Configuration

`rune init` creates a `rune.config.json` in your project root:

```json
{
  "$schema": "https://rune-kit.github.io/rune/config-schema.json",
  "version": 1,
  "platform": "cursor",
  "source": "/path/to/rune",
  "skills": {
    "disabled": []
  },
  "extensions": {
    "enabled": null
  },
  "output": {
    "index": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `platform` | string | One of the 13 targets listed above |
| `source` | string | Path to Rune installation (auto-set by init) |
| `skills.disabled` | string[] | Skills to exclude from compilation |
| `extensions.enabled` | string[] or null | Extension packs to include (`null` = all) |
| `output.index` | boolean | Generate index file listing all compiled skills |
| `tiers.pro` | string | Optional path to the Pro `extensions/` directory |
| `tiers.business` | string | Optional path to the Business `extensions/` directory |

Edit this file directly, then run `rune build` to recompile.

> **Pro Tip**: Commit `rune.config.json` to your repo so teammates get the same skill configuration.

---

## Extension Packs

Rune ships 14 free extension packs (L4 layer). Each adds domain-specific skills.

| Pack | Skills | Domain |
|------|--------|--------|
| `@rune/ui` | 10 | UI component patterns, design systems, accessibility |
| `@rune/backend` | 8 | API design, database patterns, auth, caching |
| `@rune/devops` | 9 | CI/CD, Docker, Kubernetes, edge/serverless |
| `@rune/mobile` | 9 | React Native, Flutter, deep linking, OTA |
| `@rune/security` | 7 | OWASP, pen testing, threat modeling, supply chain |
| `@rune/trading` | 7 | Backtesting, quant analysis, market data |
| `@rune/saas` | 6 | Multi-tenancy, billing, onboarding, feature flags |
| `@rune/ecommerce` | 7 | Cart, checkout, inventory, payments, tax |
| `@rune/ai-ml` | 10 | LLM architecture, prompt patterns, RAG, agents |
| `@rune/gamedev` | 12 | Game loops, ECS, physics, multiplayer, audio |
| `@rune/content` | 8 | CMS, SEO, i18n, MDX, video repurpose |
| `@rune/analytics` | 7 | SQL patterns, A/B testing, funnels, dashboards |
| `@rune/chrome-ext` | 6 | MV3 scaffold, messaging, storage, CWS publish |
| `@rune/zalo` | 7 | Zalo OA messaging, webhooks, rate limiting |

**Enable specific packs**:

```bash
npx @rune-kit/rune init --extensions @rune/ui,@rune/backend,@rune/trading
```

**Enable all packs** (default):

```bash
npx @rune-kit/rune init
# extensions.enabled = null means all packs are included
```

**Disable via config**:

```json
{
  "extensions": {
    "enabled": ["@rune/ui", "@rune/backend"]
  }
}
```

---

## Pro Tips

**CI Integration** -- Add Rune build to your CI pipeline to keep skills in sync:

```yaml
# .github/workflows/rune.yml
- name: Compile Rune skills
  run: npx @rune-kit/rune build
- name: Validate output
  run: npx @rune-kit/rune doctor
```

**Monorepo Setup** -- Compile to multiple packages from one Rune source:

```bash
npx @rune-kit/rune build --output packages/frontend --platform cursor
npx @rune-kit/rune build --output packages/backend --platform generic
```

**Selective Skills** -- Disable skills you don't need to reduce noise:

```bash
npx @rune-kit/rune init --disable video-creator,asset-creator,trend-scout
```

**Keep Updated** -- One command pulls tier repos, re-runs the managed rewrite, and verifies:

```bash
npx @rune-kit/rune@latest update
```

---

## Troubleshooting

**"No platform configured"** when running `rune build`:
- Run `rune init` first to create `rune.config.json`.

**"Unknown platform"** during init:
- Check available platforms: `cursor`, `windsurf`, `antigravity`, `generic`.
- Claude Code users don't need the CLI -- install as a plugin instead.

**Skills not loading in Cursor**:
- Verify files exist in `.cursor/skills/`.
- Check that each skill dir contains a `SKILL.md`.
- Restart Cursor to pick up new rule files.

**Skills not loading in Windsurf / Antigravity**:
- Verify files exist in the correct rules directory.
- Check that your editor version supports the rules feature.

**"No rune.config.json found"** when running `rune doctor`:
- Run `rune init` to generate the config file.

**Build errors on specific skills**:
- Check the error output for the skill name and issue.
- Use `--disable <skill>` to skip problematic skills temporarily.
- Report issues at https://github.com/rune-kit/rune/issues.
