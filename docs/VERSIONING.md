# Versioning Policy

> **H2 Document** — Semver policy for Rune core and L4 extension packs.

---

## Core Plugin Versioning

The Rune plugin uses semantic versioning (`MAJOR.MINOR.PATCH`):

| Version | When to bump | Example |
|---------|-------------|---------|
| **PATCH** (`1.0.N`) | Bug fixes, content corrections in SKILL.md | Fixing a wrong command in `verification`, correcting a Sharp Edge |
| **MINOR** (`1.N.0`) | New features, new connections, new sections added | Adding a new `## Done When` condition, new mesh connection |
| **MAJOR** (`N.0.0`) | Breaking change to skill interface or output contract | Renaming a skill, changing output format structure, removing a section |

**Current version:** `1.0.0` (H1 complete — 40 skills, full mesh, all constraints)

---

## What Counts as a Breaking Change?

A breaking change is any modification that would cause a **calling skill to fail or produce incorrect output** without code changes on its end.

### Breaking (MAJOR bump required)
- Renaming a skill (e.g., `sentinel` → `security-guard`)
- Changing the structure of `## Output Format` in a way callers depend on
- Removing a section that callers parse (e.g., removing `## Calls`)
- Changing skill layer assignment (L2 → L3 changes invocation context)
- Removing an existing connection from `## Calls` or `## Called By`

### Non-breaking (MINOR or PATCH)
- Adding new skills (MINOR)
- Adding new connections (MINOR)
- Adding `## Sharp Edges`, `## Done When`, or documentation content (PATCH)
- Fixing incorrect commands or examples (PATCH)
- Clarifying constraint wording without changing behavior (PATCH)
- Updating `## Cost Profile` estimates (PATCH)

---

## Skill API Stability Contract

Each skill's **stable API** consists of:
1. Skill name (used in `## Calls` references across the mesh)
2. `## Output Format` structure (the contract for calling skills)
3. Layer assignment (L1/L2/L3)
4. Required input parameters (documented in `## Executable Steps`)

Everything else (Sharp Edges, Done When, Cost Profile, wording improvements) is non-API and can change freely.

---

## L4 Extension Pack Versioning

L4 packs version independently of the core. Each `PACK.md` has its own `metadata.version`.

L4 packs start at `0.1.0` (experimental). When stable:
- `1.0.0` = skill interface is locked, callers can rely on output format
- Minor bumps = new skills added to pack (additive, non-breaking)
- Major bumps = skill renamed, removed, or output format changed

**L4 packs MUST NOT change their mesh connection interface (how they connect to L1-L3 core) in a patch release.** Connection changes are at minimum a minor version bump.

---

## Version in SKILL.md Frontmatter

Every `SKILL.md` has a `metadata.version` field:

```yaml
metadata:
  version: "0.2.0"
```

This tracks the individual skill's version, independent of the plugin version. Use it to:
- Track which skills have been updated in a release
- Help users identify if their cached version is outdated
- Signal to CI that a skill's contract changed

**Convention:** When the plugin bumps MAJOR, all skill versions bump to match (e.g., all skills go to `1.0.0`). For MINOR/PATCH, only the modified skills bump.

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| `0.1.0` | 2026-01-15 | Initial release — 36 core skills (Waves 0-4) |
| `0.2.0` | 2026-02-10 | Add perf, db, incident, design skills. Behavioral constraints. HARD-GATE pattern. |
| `1.0.0` | 2026-02-25 | H1 complete — 40 skills, Sharp Edges + Done When on all skills, 0 broken mesh connections |
