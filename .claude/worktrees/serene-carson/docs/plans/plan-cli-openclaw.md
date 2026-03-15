# Feature: CLI Guide + OpenClaw Adapter + Spawn-Agent

## Overview
Add a comprehensive CLI guide, extend the compiler with OpenClaw as the 6th adapter, and integrate spawn-agent delegation pattern for platforms without native subagent support.

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | CLI Guide | ✅ Done | plan-cli-openclaw-phase1.md | Create docs/guides/cli.md covering init, build, doctor, all platforms |
| 2 | OpenClaw Adapter | ✅ Done | plan-cli-openclaw-phase2.md | New adapter, manifest gen, TS entry point, CLI integration |
| 3 | Spawn-Agent Integration | ⬚ Pending | plan-cli-openclaw-phase3.md | Context delegation for Antigravity/Windsurf/Generic via spawn-agent |

## Key Decisions
- CLI guide lives at `docs/guides/cli.md` (new directory) -- matches VividKit's /guides/cli pattern
- OpenClaw adapter follows NeuralMemory plugin pattern: `openclaw.plugin.json` manifest + `register(api)` entry point
- OpenClaw adapter is a compiler target (like cursor/windsurf) -- it generates output files, not a full plugin project
- Adapter generates `openclaw.plugin.json` + `src/index.ts` + skill files into `.openclaw/rune/` output dir
- Hooks mapping: Rune shell hooks (hooks.json) map to OpenClaw `api.on()` TypeScript hooks
- Detection: `~/.openclaw/` directory or `.openclaw/` in project root
- Spawn-agent pattern (from khanhbkqt/spawn-agent) for non-Claude platforms: shell-based worker delegation to Gemini/Codex/Claude CLI
- Only Antigravity, Windsurf, Generic get spawn-agent; Claude/Cursor/OpenClaw have native subagent support

## Architecture
```
rune build --platform openclaw --output <project>
  -> parser (SKILL.md -> IR)
  -> transformer (cross-refs, tool-names, etc.)
  -> openclaw adapter (IR -> openclaw.plugin.json + src/index.ts + skill .md files)
  -> output to .openclaw/rune/
```

## Dependencies
- Node.js >= 18 (existing requirement)
- OpenClaw plugin API types (inlined, no external dep)

## Risks
- OpenClaw API may change (pre-1.0) -- mitigation: adapter is isolated, easy to update
- No OpenClaw test environment available -- mitigation: unit test adapter output, manual validation
