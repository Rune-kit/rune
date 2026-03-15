# Phase 2: OpenClaw Adapter

## Goal
Add OpenClaw as the 6th compiler adapter. The adapter generates an OpenClaw plugin structure (manifest + TypeScript entry point + skill files) from Rune's SKILL.md sources, following the same pattern as the NeuralMemory OpenClaw plugin. Update CLI detection, adapter registry, and the CLI guide's OpenClaw section.

## Data Flow
```
rune build --platform openclaw --output <project>
  -> discoverSkills() -> parseSkill() (existing)
  -> transformSkill(ir, openclawAdapter) (existing pipeline)
  -> openclaw adapter emits:
       .openclaw/rune/openclaw.plugin.json   (manifest)
       .openclaw/rune/src/index.ts            (register entrypoint)
       .openclaw/rune/skills/*.md             (transformed skill files)
```

## Code Contracts

### Adapter interface (must match existing adapter shape)
```javascript
// compiler/adapters/openclaw.js
export default {
  name: 'openclaw',
  outputDir: '.openclaw/rune',
  fileExtension: '.md',
  skillPrefix: 'rune-',
  skillSuffix: '',
  transformReference(skillName, raw) -> string,
  transformToolName(toolName) -> string,
  generateHeader(skill) -> string,
  generateFooter() -> string,
  transformSubagentInstruction(text) -> string,
  postProcess(content) -> string,
  // OpenClaw-specific: generate manifest + entry point
  generateManifest(skills, pluginJson) -> object,
  generateEntryPoint(skills) -> string,
};
```

### Generated openclaw.plugin.json structure
```json
{
  "id": "rune",
  "kind": "skills",
  "name": "Rune",
  "description": "55-skill mesh for AI coding assistants",
  "version": "<from plugin.json>",
  "configSchema": {
    "jsonSchema": {
      "type": "object",
      "properties": {
        "disabledSkills": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

### Generated src/index.ts structure
```typescript
const plugin = {
  id: 'rune',
  name: 'Rune',
  register(api) {
    // Inject skill-router instructions via before_prompt_build
    api.on('before_agent_start', async (event) => {
      return { systemPrompt: SKILL_ROUTER_INSTRUCTIONS };
    });
    // Register skill directory for file-based loading
    api.registerSkillDirectory('./skills');
  }
};
export default plugin;
```

### Updated adapter registry
```javascript
// compiler/adapters/index.js -- add openclaw import
import openclaw from './openclaw.js';
const adapters = { claude, cursor, windsurf, antigravity, generic, openclaw };
```

### Updated CLI detection
```javascript
// compiler/bin/rune.js -- detectPlatform()
if (existsSync(path.join(projectRoot, '.openclaw'))) return 'openclaw';
```

## Tasks
- [x] Task 1 -- Create OpenClaw adapter
  - File: `compiler/adapters/openclaw.js` (new, ~120 lines)
  - Implement all standard adapter methods (same shape as cursor.js / generic.js)
  - TOOL_MAP: map Claude Code tool names to OpenClaw equivalents (Read -> read_file, Write -> write_file, Bash -> run_command, etc.)
  - `outputDir`: `.openclaw/rune`
  - `transformReference`: reference as `rune-<skillName>` skill file
  - Add `generateManifest(skills, pluginJson)`: returns openclaw.plugin.json object
  - Add `generateEntryPoint(skills)`: returns TypeScript source string for register(api)
  - The entry point injects skill-router SKILL.md content via `before_agent_start` hook -> `systemPrompt`
  - Edge: OpenClaw uses `api.on()` not shell hooks -- generated code must use TS hook API
- [x] Task 2 -- Register adapter in index
  - File: `compiler/adapters/index.js` (modify)
  - Add: `import openclaw from './openclaw.js';`
  - Add: `openclaw` to adapters object
  - This auto-updates `listPlatforms()` and `getAdapter()` -- no other changes needed
- [x] Task 3 -- Update CLI detection
  - File: `compiler/bin/rune.js` (modify)
  - Add to `detectPlatform()`: `if (existsSync(path.join(projectRoot, '.openclaw'))) return 'openclaw';`
  - Add before the generic fallback (after antigravity check)
  - Update help text to include openclaw in platform list
- [x] Task 4 -- Update emitter for OpenClaw extras
  - File: `compiler/emitter.js` (modify)
  - After standard skill file emission, if adapter is openclaw:
    - Call `adapter.generateManifest(skills, pluginJson)` -> write `openclaw.plugin.json`
    - Call `adapter.generateEntryPoint(skills)` -> write `src/index.ts`
  - Read `pluginJson` from `.claude-plugin/plugin.json` for version/description
  - Edge: only generate extras for openclaw adapter, not others
- [x] Task 5 -- Update CLI guide OpenClaw section
  - File: `docs/guides/cli.md` (modify -- created in Phase 1)
  - Replace "Coming Soon" placeholder with actual usage:
    - Detection: `.openclaw/` directory
    - Build command: `rune build --platform openclaw --output .`
    - Output structure: `.openclaw/rune/` with manifest + entry + skills
    - Integration: how to add Rune to openclaw.json plugins config
- [x] Task 6 -- Write adapter tests
  - File: `compiler/__tests__/openclaw-adapter.test.js` (new)
  - Cases:
    - transformReference returns correct skill file reference
    - transformToolName maps all Claude Code tools
    - generateHeader/generateFooter produce valid markdown
    - generateManifest returns valid openclaw.plugin.json structure
    - generateEntryPoint returns valid TypeScript with register(api)
    - postProcess strips Claude-specific directives

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| User runs `rune build --platform openclaw` before adapter exists | getAdapter throws "Unknown platform" | Error (expected before Phase 2) |
| Generated openclaw.plugin.json has invalid schema | OpenClaw rejects plugin on load | Validation -- test manifest against NM reference |
| Generated index.ts has syntax errors | TypeScript compilation fails | Syntax -- test output parses as valid TS |
| Adapter misses a standard method | emitter crashes during build | TypeError -- test adapter has all required methods |
| OpenClaw API changes hook names | Generated code uses wrong hook | Compatibility -- document OpenClaw version target |
| `detectPlatform` returns openclaw when .openclaw/ exists but user wants different platform | Wrong platform auto-selected | Priority -- openclaw detection should be AFTER claude/cursor/windsurf |

## Performance Constraints
| Metric | Requirement | Why |
|--------|-------------|-----|
| Build time | < 5s for 55 skills on openclaw | Same as other adapters |
| Generated files | < 100 total (55 skills + manifest + entry) | Reasonable output size |

## Rejection Criteria (DO NOT)
- DO NOT add OpenClaw as a runtime dependency -- Rune is a compiler, output is standalone
- DO NOT hardcode skill list in generated index.ts -- read from skill directory
- DO NOT copy NeuralMemory's MCP client pattern -- Rune doesn't need MCP, it's file-based skills
- DO NOT modify existing adapter behavior -- only add new openclaw adapter
- DO NOT skip the manifest generation -- OpenClaw requires openclaw.plugin.json
- DO NOT use `any` type in generated TypeScript

## Cross-Phase Context
- **Assumes**: Phase 1 created `docs/guides/cli.md` with an OpenClaw "Coming Soon" section
- **Exports**: After this phase, `rune build --platform openclaw` works end-to-end
- **Interface contract**: Adapter must implement the same interface as cursor.js/generic.js (name, outputDir, fileExtension, skillPrefix, skillSuffix, transformReference, transformToolName, generateHeader, generateFooter, transformSubagentInstruction, postProcess)

## Acceptance Criteria
- [ ] `compiler/adapters/openclaw.js` exists and exports valid adapter object
- [ ] `compiler/adapters/index.js` includes openclaw in registry
- [ ] `rune build --platform openclaw` runs without error on 55 skills
- [ ] Output includes `openclaw.plugin.json` with correct id, kind, version
- [ ] Output includes `src/index.ts` with `register(api)` and `before_agent_start` hook
- [ ] Output includes 55 transformed skill .md files in skills/ subdirectory
- [ ] `detectPlatform()` returns 'openclaw' when `.openclaw/` exists
- [ ] CLI help text lists openclaw as available platform
- [ ] `docs/guides/cli.md` OpenClaw section updated with real instructions
- [ ] All tests in `compiler/__tests__/openclaw-adapter.test.js` pass
- [ ] No changes to existing adapters (cursor, windsurf, antigravity, generic, claude)
