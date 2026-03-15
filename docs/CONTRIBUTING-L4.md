# Contributing L4 Extension Packs

> **H2 Document** — How to create and submit community L4 extension packs for the Rune mesh.

---

## What is an L4 Extension Pack?

L4 packs add domain-specific skills on top of Rune's language-agnostic L1-L3 core. A pack is a directory containing a `PACK.md` file that defines 3-6 skills for a specific domain (React patterns, trading algorithms, mobile development, etc.).

**The core mesh (L1-L3) is frozen at 40 skills.** All growth in Rune happens through L4.

---

## The 2-Gate L4 Filter

L4 packs have a lighter filter than L1-L3 skills. A proposed pack must pass both gates:

### Gate 1 — Domain Coherence
> Do all skills in this pack serve the same domain?

The pack's skills must form a coherent unit. A pack mixing React patterns with mobile deployment has no identity. Each skill in the pack should be something a developer in this domain would invoke together.

❌ **Fail:** Pack with `react-hooks`, `django-models`, `kubernetes-deploy` — no coherent domain
✅ **Pass:** Pack with `react-hooks`, `component-patterns`, `performance-audit`, `a11y-audit` — frontend domain

### Gate 2 — Core Mesh Integration
> Does the pack connect to at least 2 existing L1-L3 skills?

L4 packs must integrate with the existing mesh — not operate as isolated utilities. Connections must be meaningful (actual data flow, not ceremonial mentions).

Typical connection patterns:
- Pack skill is called by `cook` (L1) when domain detected
- Pack skill calls `scout` (L2) for codebase scan
- Pack skill calls `verification` (L3) after changes
- Pack skill calls `sentinel` (L2) for domain-specific security

❌ **Fail:** Pack with 0 inbound connections from L1-L3 (no orchestrator calls it)
✅ **Pass:** Pack called by `cook` on stack detection, calls `scout` + `verification`

---

## Pack Structure

```
extensions/
└── your-pack-name/
    └── PACK.md
```

`PACK.md` must follow `docs/EXTENSION-TEMPLATE.md` exactly. Required sections:

```markdown
---
name: "@rune/pack-name"
description: One-line description.
metadata:
  author: your-github-username
  version: "0.1.0"
  layer: L4
  price: "$9|$12|$15"
  target: Target developer audience
---

# @rune/pack-name

## Skills Included
[3-6 skills with brief description each]

## Connections
[Explicit list of L1-L3 skills this pack calls or is called by]

## Tech Stack Support (if applicable)
[Framework/library table]
```

---

## Naming Conventions

- Pack name: `@rune/domain-name` (lowercase kebab-case)
- Pack directory: `extensions/domain-name/` (without `@rune/` prefix)
- Skill names within pack: `verb-noun` or `domain-pattern` (lowercase kebab-case)
- Max pack name length: 48 characters

**Good names:** `@rune/ui`, `@rune/trading`, `@rune/ai-ml`, `@rune/ecommerce`
**Bad names:** `@rune/my-awesome-react-hooks-pack-v2`, `@rune/FRONTEND`, `@rune/things`

---

## Connection Patterns by Pack Type

### Frontend Packs (`@rune/ui`, `@rune/mobile`)
```
cook (L1) ← detects React/Vue/Svelte/SwiftUI → calls pack skill
pack skill → scout (L2): scan component library
pack skill → verification (L3): run component tests
pack skill → sentinel (L2): check for XSS/CSRF patterns
```

### Backend Packs (`@rune/backend`, `@rune/saas`)
```
cook (L1) ← detects Express/FastAPI/Django → calls pack skill
pack skill → scout (L2): scan API routes and models
pack skill → db (L2): schema and migration check
pack skill → sentinel (L2): security audit
```

### Data/AI Packs (`@rune/ai-ml`, `@rune/analytics`)
```
cook (L1) ← detects ML framework → calls pack skill
pack skill → scout (L2): find model files and data pipelines
pack skill → perf (L2): inference performance check
pack skill → verification (L3): run model tests
```

### DevOps Packs (`@rune/devops`)
```
deploy (L2) ← calls pack skill for platform-specific deploy
launch (L1) ← calls pack skill for infrastructure setup
pack skill → watchdog (L3): setup platform monitoring
pack skill → sentinel (L2): infrastructure security scan
```

---

## Submission Process

1. **Fork** `github.com/rune-kit/rune`
2. **Create** `extensions/your-pack-name/PACK.md`
3. **Validate** your pack passes both gates (self-check below)
4. **Run** structural validator: `node scripts/validate-skills.js`
5. **Open PR** with title: `feat(l4): add @rune/pack-name — [one-line description]`

### PR Description Template

```markdown
## New L4 Pack: @rune/pack-name

### Gate 1 — Domain Coherence
[Explain: what domain does this serve? Why are these skills cohesive?]

### Gate 2 — Core Mesh Integration
Inbound: [which L1-L3 skills call this pack, and when?]
Outbound: [which L1-L3 skills does this pack call?]

### Skills
- `skill-1`: [what it does]
- `skill-2`: [what it does]

### Who needs this?
[Describe the developer audience — job title, stack, use case]
```

---

## Review Criteria

Pack PRs are reviewed against these criteria:

| Criterion | Pass | Fail |
|-----------|------|------|
| Gate 1: Domain coherence | All skills serve same domain | Mixed domains or generic skills |
| Gate 2: Mesh integration | ≥2 connections to L1-L3 | 0 or 1 connections |
| PACK.md completeness | All required sections present | Missing Skills, Connections, or metadata |
| Connection accuracy | Stated connections verified in L1-L3 SKILL.md files | Claimed connections not in L1-L3 files |
| Skill count | 3-6 skills | <3 (too thin) or >6 (too broad) |
| Naming | Lowercase kebab-case, ≤48 chars | CamelCase, numbers, or overly specific names |
| No bloat | Skills would fail Rune's core 5-gate filter | Skills duplicate existing L1-L3 functionality |

---

## What Makes a Good L4 Skill?

**Good L4 skill:**
- Domain-specific knowledge that belongs in L4 (not generic enough for L1-L3)
- Clear integration points with the core mesh
- Would be used together with other skills in the same pack

**Bad L4 skill:**
- Wraps an existing L1-L3 skill with minor variation (The Bloat)
- Generic enough to belong in the core mesh (should be a core PR instead)
- 0 mesh connections (dead node)

---

## Example: Good vs Bad Pack

```markdown
# GOOD: @rune/trading

Skills: market-data-validator, risk-calculator, backtest-runner, portfolio-analyzer
Domain: Algorithmic trading — financial data validation, risk management, backtesting
Connections: called by cook (L1), calls scout (L2) + sentinel (L2) + perf (L2)
Why L4 not L3: Trading domain knowledge is not language-agnostic — belongs in L4

# BAD: @rune/code-helpers

Skills: code-formatter, variable-renamer, comment-generator, snippet-library
Domain: Generic utilities with no domain coherence
Connections: 0 inbound, 0 outbound
Why rejected: These are Claude's base capabilities wrapped in skills. Zero mesh value.
```

---

## Version Policy

L4 packs use semver independently of the Rune core. See `docs/VERSIONING.md`.

- `0.x.y` — experimental, API may change
- `1.0.0` — stable, API contract locked
- Patch (`x.x.N`) — bug fixes, content improvements
- Minor (`x.N.0`) — new skills added to pack
- Major (`N.0.0`) — breaking change to skill interface or connection contract
