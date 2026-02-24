---
name: hallucination-guard
description: Verify AI-generated imports, API calls, and packages actually exist. Catches phantom functions, non-existent packages, and slopsquatting attacks.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: haiku
  group: validation
---

# hallucination-guard

## Purpose

Post-generation validation that verifies AI-generated code references actually exist. Catches the 42% of AI code that contains hallucinated imports, non-existent packages, phantom functions, and incorrect API signatures. Also defends against "slopsquatting" — where attackers register package names that AI commonly hallucinates.

## Triggers

- Called by `cook` after code generation, before commit
- Called by `fix` after applying fixes
- Called by `preflight` as import verification sub-check
- Called by `review` during code review
- Auto-trigger: when new import statements are added to codebase

## Calls (outbound)

# Exception: L3→L3 coordination
- `research` (L3): verify package existence on npm/pypi

## Called By (inbound)

- `cook` (L1): after code generation, before commit
- `fix` (L2): after applying fixes
- `preflight` (L2): import verification sub-check
- `review` (L2): during code review

## Execution

### Step 1 — Extract imports

Use `Grep` to find all import/require/use statements in changed files:

```
Grep pattern: ^(import|require|use|from)\s
Files: changed files passed as input
Output mode: content
```

Collect every imported module name and file path. Separate into:
- Internal imports (start with `./`, `../`, `@/`, `~/`)
- External packages (bare module names)

### Step 2 — Verify internal imports

For each internal import path, use `Glob` to confirm the file exists in the codebase.

```
Glob pattern: <resolved import path>.*   (try .ts, .tsx, .js, .jsx, .py, .rs etc.)
```

If `Glob` returns no results → mark as **BLOCK** (file does not exist).

Also use `Grep` to verify that the specific exported name (function/class/const) exists in the resolved file:

```
Grep pattern: export (function|class|const|default) <name>
File: resolved file path
```

If export not found → mark as **WARN** (symbol may not be exported).

### Step 3 — Verify external packages

Use `Read` on the project's dependency manifest to confirm each external package is listed:

- JavaScript/TypeScript: `package.json` → check `dependencies` and `devDependencies`
- Python: `requirements.txt` or `pyproject.toml`
- Rust: `Cargo.toml` → `[dependencies]`

If package is **not listed** in the manifest → mark as **BLOCK** (phantom dependency).

Also check for typosquatting: if package name has edit distance ≤ 2 from a known popular package (axios/axois, lodash/lodahs, react/recat), mark as **SUSPICIOUS**.

### Step 4 — Verify API calls

For any API endpoint or SDK method call found in the diff, use `rune:docs-seeker` (Context7) to confirm:
- The method/function exists in the library's documented API
- The parameter signature matches usage in code

Mark unverifiable API calls as **WARN** (cannot confirm without docs).

### Step 5 — Report

Emit the report in the Output Format below. If any **BLOCK** items exist, return status `BLOCK` to the calling skill to halt commit/deploy.

## Check Types

```
INTERNAL    — file exists, function/class exists, signature matches
EXTERNAL    — package exists on registry, version is valid
API         — endpoint pattern valid, method correct
TYPE        — assertion matches actual type
SUSPICIOUS  — package name similar to popular package (slopsquatting)
```

## Output Format

```
## Hallucination Guard Report
- **Status**: PASS | WARN | BLOCK
- **References Checked**: [count]
- **Verified**: [count] | **Unverified**: [count] | **Suspicious**: [count]

### BLOCK (hallucination detected)
- `import { formatDate } from 'date-utils'` — Package 'date-utils' not found on npm. Did you mean 'date-fns'?
- `import { useAuth } from '@/hooks/useAuth'` — File '@/hooks/useAuth' does not exist

### WARN (verify manually)
- `import { newFunction } from 'popular-lib'` — Function 'newFunction' not found in popular-lib@3.2.0 exports

### SUSPICIOUS (potential slopsquatting)
- `import axios from 'axois'` — Typo? Similar to popular package 'axios'

### Verified
- 12/15 references verified successfully
```

## Constraints

1. MUST verify every import against actual installed packages — not just check if name looks reasonable
2. MUST verify API signatures against docs — not assume from function name
3. MUST report BLOCK verdict with specific evidence — never "looks suspicious"
4. MUST NOT say "no hallucinations found" without listing what was checked

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Declaring "no hallucinations found" without listing what was checked | CRITICAL | Constraint 4 blocks this — always list verified count vs total |
| Marking phantom package (not in manifest) as WARN instead of BLOCK | HIGH | Unlisted package in manifest = BLOCK — not installed = won't run |
| Missing typosquatting check on external packages | MEDIUM | Edit distance ≤2 check is mandatory — check every external package name |
| Only checking package name, not the specific exported symbol | MEDIUM | Step 2: verify the specific function/class is exported, not just the file exists |

## Done When

- All imports extracted from changed files (internal + external separated)
- Internal imports: file existence AND symbol export verified
- External packages: manifest presence checked for every package
- Suspicious package names flagged (edit distance ≤2 from popular packages)
- API signatures checked via docs-seeker for new SDK/library calls
- Hallucination Guard Report emitted with PASS/WARN/BLOCK and verified count

## Cost Profile

~500-1500 tokens input, ~200-500 tokens output. Haiku for speed — this runs frequently as a sub-check.
