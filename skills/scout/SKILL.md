---
name: scout
description: "Fast codebase scanner. Use when any skill needs codebase context. Finds files, patterns, dependencies, project structure. Pure read-only — never modifies files."
metadata:
  author: runedev
  version: "0.2.0"
  layer: L2
  model: haiku
  group: creation
---

# scout

Fast, lightweight codebase scanning. Scout is the eyes of the Rune ecosystem.

## Instructions

When invoked, perform these steps:

### Phase 1: Structure Scan

Map the project layout:

1. Use `Glob` with `**/*` to understand directory structure
2. Use `Bash` to run `ls` on key directories (root, src, lib, app)
3. Identify framework by detecting these files:
   - `package.json` → Node.js/TypeScript
   - `Cargo.toml` → Rust
   - `pyproject.toml` / `setup.py` → Python
   - `go.mod` → Go
   - `pom.xml` / `build.gradle` → Java

```
TodoWrite: [
  { content: "Scan project structure", status: "in_progress" },
  { content: "Run targeted file search", status: "pending" },
  { content: "Map dependencies", status: "pending" },
  { content: "Detect conventions", status: "pending" },
  { content: "Generate scout report", status: "pending" }
]
```

### Phase 2: Targeted Search

Based on the scan request, run focused searches:

1. Use `Glob` to find files matching the target domain:
   - Auth domain: `**/*auth*`, `**/*login*`, `**/*session*`
   - API domain: `**/*.controller.*`, `**/*.route.*`, `**/*.handler.*`
   - Data domain: `**/*.model.*`, `**/*.schema.*`, `**/*.entity.*`
2. Use `Grep` to search for specific patterns:
   - Function names: `pattern: "function <name>"` or `"def <name>"`
   - Class definitions: `pattern: "class <Name>"`
   - Import statements: `pattern: "import.*<module>"` or `"from <module>"`
3. Use `Read` to examine the most relevant files (max 10 files, prioritize by relevance)

**Verification gate**: At least 1 relevant file found, OR confirm the target does not exist.

### Phase 3: Dependency Mapping

1. Use `Grep` to find import/require/use statements in identified files
2. Map which modules depend on which (A → imports → B)
3. Identify the blast radius of potential changes: which files import the target file

### Phase 4: Convention Detection

1. Check for config files using `Glob`:
   - `.eslintrc*`, `eslint.config.*` → ESLint rules
   - `tsconfig.json` → TypeScript config
   - `.prettierrc*` → Prettier config
   - `ruff.toml`, `.ruff.toml` → Python linter
2. Check naming conventions by reading 2-3 representative source files
3. Find existing tests with `Glob`: `**/*.test.*`, `**/*.spec.*`, `**/test_*`
4. Determine test framework: `jest.config.*`, `vitest.config.*`, `pytest.ini`

### Phase 5: Generate Report

Produce structured output for the calling skill. Update TodoWrite to completed.

## Constraints

- **Read-only**: NEVER use Edit, Write, or Bash with destructive commands
- **Fast**: Max 10 file reads per scan. Prioritize by relevance score
- **Focused**: Only scan what is relevant to the request, not the entire codebase
- **No side effects**: Do not cache, store, or modify anything

## Error Recovery

- If `Glob` returns 0 results: try broader pattern, then report "not found"
- If a file fails to `Read`: skip it, note in report, continue with remaining files
- If project type is ambiguous: check multiple config files, report all candidates

## Calls (outbound)

None — pure scanner using Glob, Grep, Read, and Bash tools directly. Does not invoke other skills.

## Called By (inbound)

- `plan` (L2): scan codebase before planning
- `debug` (L2): find related code for root cause analysis
- `review` (L2): find related code for context during review
- `fix` (L2): understand dependencies before changing code
- `cook` (L1): Phase 1 UNDERSTAND — scan codebase
- `team` (L1): understand full project scope
- `sentinel` (L2): scan changed files for security issues
- `preflight` (L2): find affected code paths
- `onboard` (L2): full project scan for CLAUDE.md generation
- `autopsy` (L2): comprehensive health assessment
- `surgeon` (L2): scan module before refactoring
- `marketing` (L2): scan codebase for feature descriptions
- `safeguard` (L2): scan module boundaries before adding safety net
- `audit` (L2): Phase 0 project structure and stack discovery
- `db` (L2): find schema and migration files
- `design` (L2): scan UI component library and design tokens
- `perf` (L2): find hotpath files and performance-critical code

## Output Format

```
## Scout Report
- **Project**: [name] | **Framework**: [detected] | **Language**: [detected]
- **Files**: [count] | **Test Framework**: [detected]

### Relevant Files
| File | Why Relevant | LOC |
|------|-------------|-----|
| `path/to/file` | [reason] | [lines] |

### Dependencies
- `module-a` → imports → `module-b`

### Conventions
- Naming: [pattern detected]
- File structure: [pattern]
- Test pattern: [pattern]

### Observations
- [pattern or potential issue noticed]
```

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Reading all files instead of targeted search (50+ files scanned) | MEDIUM | Max 10 file reads enforced — prioritize by relevance to the caller's domain |
| Reporting "nothing found" without trying a broader pattern | MEDIUM | Try broader glob first (e.g. `**/*auth*` → `**/auth*` → `**/*login*`), then report not found |
| Wrong framework detection affects all downstream planning | HIGH | Check multiple config files; report all candidates if ambiguous, don't guess |
| Missing dependency blast radius in Phase 3 | MEDIUM | Phase 3 is mandatory — callers need to know what else imports the target |

## Done When

- Project structure mapped (directory layout, entry points)
- Framework detected from config files (or "ambiguous" with candidates listed)
- Targeted file search completed for the caller's domain
- Dependency blast radius identified for target files
- Conventions detected (naming, test framework, linting config)
- Scout Report emitted in structured format with Relevant Files table

## Cost Profile

~500-2000 tokens input, ~200-500 tokens output. Always haiku. Cheapest skill in the mesh.
