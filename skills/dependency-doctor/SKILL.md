---
name: dependency-doctor
description: Dependency management — health checks, safe updates, conflict resolution, and cleanup of unused packages.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: haiku
  group: deps
---

# dependency-doctor

## Purpose

Dependency management covering health checks, safe updates, conflict resolution, and cleanup. Checks for outdated packages, known vulnerabilities, license issues, and unused dependencies.

## Triggers

- Called by sentinel for dependency audit
- Called by cook during project setup phase

## Calls (outbound)

None — pure L3 utility using Bash for package manager commands.

## Called By (inbound)

- `sentinel` (L2): dependency audit as part of security gate
- `cook` (L1): setup phase dependency check
- `rescue` (L1): Phase 0 dependency health assessment

## Capabilities

```
HEALTH CHECK    — list deps with versions, flag outdated/deprecated/CVE
SAFE UPDATE     — update one package at a time, run tests after each
CONFLICT FIX    — identify version conflicts, suggest resolutions
CLEANUP         — find unused deps, duplicates, lighter alternatives
```

## Workflow

1. Scan package.json / requirements.txt / Cargo.toml to enumerate all dependencies
2. Check each dep for outdated versions, known CVEs, and deprecated status
3. Analyze breaking changes between current and latest versions
4. Generate an update plan ordered by risk (patch → minor → major)
5. Return dependency health report with critical issues, outdated list, and action items

## Output Format

```
## Dependency Report
- **Total**: [count] | **Outdated**: [count] | **Vulnerable**: [count]

### Critical (CVE)
- [package]@[version] — [CVE ID]: [description]

### Outdated
- [package]@[current] → [latest] ([major|minor|patch])

### Unused
- [package] — no imports found

### Recommendations
- [action items]
```

## Cost Profile

~300-600 tokens input, ~200-500 tokens output. Haiku. Most time in package manager commands.
