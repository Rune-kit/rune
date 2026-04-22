# Contributing to Rune

Thanks for helping build a disciplined AI coding mesh! This guide explains how to contribute skills, packs, fixes, and docs.

> **TL;DR:** Fork → branch → write tests → make changes → `npm run ci` → PR with template filled.

---

## Ways to Contribute

| What | Where | Effort |
|------|-------|--------|
| **Report a bug** | [Issues — Bug Report](https://github.com/rune-kit/rune/issues/new?template=bug_report.md) | 5 min |
| **Request a feature / new skill** | [Issues — Feature Request](https://github.com/rune-kit/rune/issues/new?template=feature_request.md) | 10 min |
| **Fix a bug** | PR with `fix:` prefix | small |
| **Improve a skill** (enrichment) | PR to `skills/<name>/SKILL.md` + references | medium |
| **Add a new skill** | PR with new `skills/<name>/` directory + tests | large |
| **Add a new pack** (L4) | PR with new `extensions/<pack-name>/` | large |
| **Improve docs** | PR to `docs/` or `README.md` | small |
| **Platform adapter** (new IDE support) | PR to `compiler/adapters/` | medium |

---

## Before You Start

1. **Search existing issues + PRs** — someone might already be working on it
2. **For large changes** — open an issue first to discuss the approach
3. **Read the architecture** — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains the 5-layer mesh
4. **Read the philosophy** — [`docs/VISION.md`](docs/VISION.md) explains what Rune is and isn't

---

## Dev Setup

```bash
git clone https://github.com/rune-kit/rune.git
cd rune
npm install
npm test                   # 1,152+ tests should pass
npm run ci                 # lint + test + doctor
```

**Requirements:** Node 18, 20, or 22 (all tested in CI).

---

## Workflow

### 1. Create a branch

```bash
git checkout -b feat/my-skill           # new skill
git checkout -b fix/signal-validator    # bug fix
git checkout -b docs/getting-started    # docs
```

### 2. Make changes

Follow the conventions in the section below.

### 3. Test locally

```bash
npm run lint                                # Biome
npm run lint:fix                            # auto-fix
npm test                                    # all tests
node scripts/validate-skills.js             # skill structure
node scripts/validate-signals.js            # mesh signals
node scripts/validate-mesh.js               # mesh connections
node compiler/bin/rune.js doctor            # end-to-end validation
```

### 4. Commit

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat(skills): add cache-warmer skill
fix(validate-signals): handle CRLF line endings
docs(getting-started): add Windows troubleshooting section
refactor(compiler): extract platform adapters to separate modules
chore(deps): bump biome to 1.9.0
```

### 5. Open a PR

Fill the [PR template](.github/pull_request_template.md) completely. PRs with incomplete checklists may be closed without review.

---

## Conventions

### Skills

Every skill lives at `skills/<name>/SKILL.md`. Structure is enforced by `docs/SKILL-TEMPLATE.md`.

**Required frontmatter:**

```yaml
---
name: skill-name
description: One-line description, max 120 chars
layer: L2                    # L0 | L1 | L2 | L3 (L4 lives in packs, not here)
tags: [workflow, testing]    # searchable keywords
connections:                 # other skills this one calls
  - rune:scout
  - rune:fix
mesh:
  emit: skill.complete       # events this skill emits (dot-separated, lowercase)
  listen: code.changed       # events this skill listens to
---
```

**Layer rules:**
- L1 calls L2/L3 (exception: `team` calls L1 for meta-orchestration)
- L2 calls L2/L3
- L3 calls nothing (exception: documented L3→L3 coordination)

**Naming:**
- Skill name: lowercase kebab-case, max 64 chars
- Signal name: `lowercase.dot.separated` (e.g. `code.changed`, not `codeChanged`)

### Packs (L4 Extensions)

Packs live at `extensions/<pack-name>/` with a `PACK.md` entry. Follow `docs/EXTENSION-TEMPLATE.md`.

Paid packs (Pro/Business) live in separate private repos — see [`docs/CONTRIBUTING-L4.md`](docs/CONTRIBUTING-L4.md) for L4 guidelines.

### Signals

Adding or changing a signal:

1. Update the emitter's `emit:` in frontmatter
2. Update at least one listener's `listen:` (or whitelist in `INTENTIONAL_BROADCAST_SIGNALS`)
3. Document in [`docs/SIGNALS.md`](docs/SIGNALS.md)
4. Run `node scripts/validate-signals.js` — must pass

### Code Style

- **No `any`** in TypeScript code (project is mostly JS + Markdown but this applies where TS exists)
- **No `console.log`** in shipped code (use `debug` npm package or structured logging)
- **No hardcoded secrets** — `.env` + `.env.example`
- **Files under 500 LOC** (300 for components)
- **Semantic commits** (see above)
- **Biome** handles formatting — `npm run lint:fix`

### Commit Messages

- `feat:` new feature / skill / pack
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding/updating tests
- `chore:` tooling, deps, CI
- `perf:` performance improvement
- `ci:` CI config changes only

---

## Testing

**Minimum:**
- New skills: at least 1 test in `compiler/__tests__/` validating parser accepts it
- New packs: validator test (`scripts/__tests__/validate-pack.test.js`)
- New signals: `scripts/__tests__/validate-signals.test.js` must pass
- Bug fixes: regression test proving the bug is fixed

**Target:**
- 80%+ coverage for new code (`npm run test:coverage`)

---

## Review Process

1. **CI must pass** — lint + test + doctor on Node 18/20/22
2. **PR template complete** — all checkboxes addressed
3. **At least 1 maintainer review** for non-trivial changes
4. **Squash merge** — keep history clean

Maintainers may push small fixes directly to your branch. If you prefer not, mention it in the PR description.

---

## Code of Conduct

Be kind. Assume good intent. Disagreements are fine — disrespect is not.

- **Feedback:** on the code, not the person
- **Decisions:** driven by evidence (benchmarks, tests, user reports), not opinions alone
- **Discussion:** stays in the PR/issue, not DMs

Violations: open a private Security advisory or email maintainers.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License (same as the project).

---

## Getting Help

- [Telegram](https://t.me/xlabs_updates) — fastest response
- [GitHub Issues](https://github.com/rune-kit/rune/issues) — bug reports and feature requests
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — common issues

Welcome to Rune. Less skills. Deeper connections.
