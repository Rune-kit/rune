# Rune CLI

The Rune CLI compiles 61 AI coding skills into any IDE platform. One skill mesh, every editor.

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

That's it. 62 skills are now active in your AI assistant.

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
  -> Built 62 skills + 14 extensions to .cursor/rules/
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
  [emit]      62 skills + 14 extensions

  -> Built 67 files to .cursor/rules/
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

### `rune help`

Show available commands and flags.

```bash
npx @rune-kit/rune help
```

---

## Platforms

Rune compiles to 8 platforms. Each gets skills in its native format.

| Platform | Output Directory | File Format | Detection Marker |
|----------|-----------------|-------------|------------------|
| Claude Code | _(native plugin)_ | `.md` (SKILL.md) | `.claude-plugin/` |
| Cursor | `.cursor/rules/` | `.mdc` | `.cursor/` |
| Windsurf | `.windsurf/rules/` | `.md` | `.windsurf/` |
| Antigravity | `.agent/rules/` | `.md` | `.agent/` |
| Codex | `.codex/` | `.md` | `.codex/` |
| OpenCode | `.opencode/rules/` | `.md` | `.opencode/` |
| Generic | `.ai/rules/` | `.md` | _(fallback)_ |
| OpenClaw | `.openclaw/rune/` | `.md` + manifest | `.openclaw/` |

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

Skills compile to `.cursor/rules/*.mdc` (Cursor's rule format).

```bash
npx @rune-kit/rune init --platform cursor
```

Output: `.cursor/rules/rune-cook.mdc`, `.cursor/rules/rune-plan.mdc`, etc.

Each skill file gets a Cursor-compatible header with `alwaysApply: false` frontmatter. Cross-references between skills are rewritten to `rune-<skill-name>` format.

### Windsurf

Skills compile to `.windsurf/rules/*.md`.

```bash
npx @rune-kit/rune init --platform windsurf
```

Output: `.windsurf/rules/rune-cook.md`, `.windsurf/rules/rune-plan.md`, etc.

### Antigravity

Skills compile to `.agent/rules/*.md` (Google Antigravity format).

```bash
npx @rune-kit/rune init --platform antigravity
```

Output: `.agent/rules/rune-cook.md`, `.agent/rules/rune-plan.md`, etc.

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
| `platform` | string | Target platform (cursor, windsurf, antigravity, generic) |
| `source` | string | Path to Rune installation (auto-set by init) |
| `skills.disabled` | string[] | Skills to exclude from compilation |
| `extensions.enabled` | string[] or null | Extension packs to include (`null` = all) |
| `output.index` | boolean | Generate index file listing all compiled skills |

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

**Keep Updated** -- Pull latest skills and recompile:

```bash
cd /path/to/rune && git pull
cd /your/project && npx @rune-kit/rune build
```

---

## Troubleshooting

**"No platform configured"** when running `rune build`:
- Run `rune init` first to create `rune.config.json`.

**"Unknown platform"** during init:
- Check available platforms: `cursor`, `windsurf`, `antigravity`, `generic`.
- Claude Code users don't need the CLI -- install as a plugin instead.

**Skills not loading in Cursor**:
- Verify files exist in `.cursor/rules/`.
- Check that files have `.mdc` extension.
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
