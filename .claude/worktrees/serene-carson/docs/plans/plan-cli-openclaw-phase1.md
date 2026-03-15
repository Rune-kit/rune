# Phase 1: CLI Guide

## Goal
Create a comprehensive CLI guide at `docs/guides/cli.md` that covers installation, all commands, all platforms, configuration, extension packs, and troubleshooting. Comparable to VividKit's CLI guide but tailored for Rune's multi-platform skill mesh.

## Data Flow
```
User reads docs/guides/cli.md
  -> follows Quick Start (install -> init -> code)
  -> references Command docs (init, build, doctor)
  -> checks Platform-specific sections (Claude, Cursor, Windsurf, Antigravity, Generic, OpenClaw)
  -> configures rune.config.json
  -> troubleshoots via FAQ section
```

## Code Contracts
No code contracts -- this phase produces documentation only. The guide must accurately reflect the existing CLI behavior in `compiler/bin/rune.js`.

Key CLI signatures to document:
```bash
npx @rune-kit/rune init [--platform <name>] [--extensions <list>] [--disable <skills>]
npx @rune-kit/rune build [--platform <name>] [--output <dir>] [--disable <skills>]
npx @rune-kit/rune doctor [--platform <name>]
npx @rune-kit/rune help
```

Config schema to document:
```json
{
  "$schema": "https://rune-kit.github.io/rune/config-schema.json",
  "version": 1,
  "platform": "cursor | windsurf | antigravity | generic | openclaw",
  "source": "<path-to-rune>",
  "skills": { "disabled": ["skill-name"] },
  "extensions": { "enabled": ["@rune/ui", "@rune/backend"] },
  "output": { "index": true }
}
```

## Tasks
- [x] Task 1 -- Create docs/guides/ directory
  - File: `docs/guides/` (new directory)
  - Just ensure it exists before writing the guide
- [x] Task 2 -- Write CLI guide
  - File: `docs/guides/cli.md` (new, 368 lines)
  - Sections (in order):
    1. Title + intro paragraph (Rune CLI = multi-platform compiler)
    2. Quick Start (3 steps): install via npx, run init in project, start coding
    3. Commands reference:
       - `rune init` -- platform detection logic, interactive flow, flags
       - `rune build` -- incremental rebuild, flags, config-based vs flag-based
       - `rune doctor` -- validation checks, exit codes
       - `rune help` -- usage display
    4. Platform Guide (table + per-platform subsections):
       - Claude Code: native plugin, no compilation needed
       - Cursor: .cursor/rules/*.mdc files
       - Windsurf: .windsurf/rules/*.md files
       - Antigravity: .agent/rules/*.md files
       - Generic: .ai/rules/*.md files
       - OpenClaw: coming soon (teaser paragraph, link to Phase 2)
    5. Auto-Detection: which markers trigger which platform (.claude-plugin, .cursor, .windsurf, .agent)
    6. Configuration (rune.config.json): full schema explanation, examples
    7. Extension Packs: listing available packs, enabling/disabling, L4 pack list
    8. Pro Tips callout boxes: CI integration, monorepo setup, selective skills
    9. Troubleshooting / FAQ: common errors and fixes
  - Edge: Claude Code section must explain no compilation needed (passthrough)
  - Edge: OpenClaw section is "Coming Soon" placeholder (Phase 2 fills it)
- [x] Task 3 -- Verify accuracy against source code
  - File: `compiler/bin/rune.js` (read-only reference)
  - Cross-check: every flag, every platform, detection logic, config keys
  - Verify: platform list matches `compiler/adapters/index.js`
  - Verify: output directories match each adapter's `outputDir` property

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| Guide documents a flag that doesn't exist in CLI | Reader runs invalid command | Documentation bug -- verify against rune.js |
| Guide shows wrong output directory for a platform | Reader looks in wrong folder for compiled skills | Documentation bug -- verify against adapter files |
| Guide omits Claude Code "no compile needed" behavior | Reader tries to compile for Claude Code unnecessarily | Missing info -- explicitly document passthrough |
| OpenClaw section implies it works now | Reader tries --platform openclaw before Phase 2 | Misleading -- mark clearly as "Coming Soon" |

## Rejection Criteria (DO NOT)
- DO NOT invent CLI flags that don't exist in `compiler/bin/rune.js`
- DO NOT copy VividKit's exact wording -- write original content for Rune
- DO NOT include code examples that haven't been tested against the real CLI
- DO NOT document OpenClaw as functional -- it's Phase 2 (mark "Coming Soon")
- DO NOT use emojis in the guide
- DO NOT exceed 400 lines -- keep it scannable

## Cross-Phase Context
- **Assumes**: Nothing -- this is Phase 1
- **Exports for Phase 2**: The OpenClaw "Coming Soon" section in the guide will be updated by Phase 2 with actual usage instructions after the adapter is built
- **Interface contract**: Guide structure (section headings) should be stable -- Phase 2 only adds content to the OpenClaw section

## Acceptance Criteria
- [ ] `docs/guides/cli.md` exists with all 9 sections listed above
- [ ] Every CLI flag documented matches `compiler/bin/rune.js` source
- [ ] Every platform's output directory matches its adapter's `outputDir`
- [ ] Quick Start section has exactly 3 steps (install, init, code)
- [ ] OpenClaw section is clearly marked "Coming Soon"
- [ ] No broken markdown formatting (headers, code blocks, tables)
- [ ] File is under 400 lines
