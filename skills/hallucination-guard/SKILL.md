---
name: hallucination-guard
description: Verify AI-generated imports, API calls, and packages actually exist. Catches phantom functions, non-existent packages, and slopsquatting attacks.
metadata:
  author: runedev
  version: "0.1.0"
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

## Workflow

1. **Extract references** — parse import statements, require calls, API endpoints from changed files
2. **Internal reference check** — verify imported files/functions/classes exist in the codebase, check function signatures match usage
3. **External package check** — verify npm/pip/cargo packages exist in registries, flag suspicious package names (typosquatting patterns)
4. **API call validation** — verify endpoint URL patterns, check HTTP methods, validate request/response shapes if docs available
5. **Type compatibility check** — verify type assertions match actual types, flag unsafe type casts
6. **Generate report** with verified/unverified/suspicious references

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

## Cost Profile

~500-1500 tokens input, ~200-500 tokens output. Haiku for speed — this runs frequently as a sub-check.
