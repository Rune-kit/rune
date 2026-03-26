# RFC Template — Breaking Change Gate

This file contains the RFC artifact format used in Phase 2.5 (RFC GATE).
Write this artifact to `.rune/rfc/RFC-<NNN>-<slug>.md` whenever a breaking change is detected.

## Auto-Trigger Conditions (ANY triggers this gate)

- Plan includes `BREAKING CHANGE` annotation
- Plan modifies a public API signature (added/removed/changed parameters)
- Plan alters database schema (migration required)
- Plan removes or renames an exported function/type used by other modules
- Plan changes authentication/authorization flow

## Skip Conditions

Non-breaking changes, internal refactors, new features with no API surface change.

## RFC Artifact Format

```markdown
# RFC-<NNN>: <Title>

**Date**: [YYYY-MM-DD]
**Author**: [agent or user]
**Status**: Proposed | Approved | Rejected
**Impact**: [list affected consumers — modules, services, users]

## What Changes
[Specific breaking change — old behavior → new behavior]

## Why
[Business/technical justification — why breaking is necessary]

## Migration Path
[Step-by-step guide for consumers to adapt]
[Include code examples: before → after]

## Rollback Plan
[How to revert if the change causes issues]

## Affected Systems
| System | Impact | Migration Effort |
|--------|--------|-----------------|
| [module/service] | [description] | [low/medium/high] |
```

## Gate Protocol

Present RFC to user for approval. User responds:
- **"approved"** → proceed to Phase 3
- **"rejected"** → revise plan
- **"deferred"** → skip breaking change, implement non-breaking alternative
