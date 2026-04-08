# Challenge Framework

5-dimension evaluation gate. Score each dimension before grafting code into your project.

## Scoring

| Score | Meaning | Action |
|-------|---------|--------|
| ✅ Pass | No concerns | Proceed |
| ⚠️ Warn | Minor concerns | Proceed with documented caveats |
| ❌ Fail | Blocking concern | Requires user override or blocks graft |

**Decision matrix**: 0 ❌ → PROCEED. 1 ❌ → WARN + require explicit user override. 2+ ❌ → BLOCK.

## Dimensions

### 1. License Compatibility

| Source License | Your Project MIT | Your Project Apache-2.0 | Your Project GPL |
|---------------|-----------------|------------------------|-----------------|
| MIT | ✅ | ✅ | ✅ |
| Apache-2.0 | ✅ | ✅ | ✅ |
| BSD-2/3 | ✅ | ✅ | ✅ |
| ISC | ✅ | ✅ | ✅ |
| GPL-2.0/3.0 | ❌ | ❌ | ✅ |
| AGPL | ❌ | ❌ | ⚠️ |
| SSPL/BSL | ❌ | ❌ | ❌ |
| No license | ❌ | ❌ | ❌ |
| Unlicense | ✅ | ✅ | ✅ |

**Check**: Read LICENSE file in repo root. If missing → ❌ (no license = all rights reserved).

### 2. Stack Fit

| Scenario | Score |
|----------|-------|
| Identical stack (same framework + language + version) | ✅ |
| Same language, different framework (React→Svelte) | ⚠️ — port mode recommended |
| Same framework, major version gap (Next 13→15) | ⚠️ — API changes likely |
| Different language entirely (Python→TypeScript) | ❌ — port is a rewrite |
| Incompatible paradigm (OOP→FP, REST→GraphQL) | ❌ — fundamental rethink needed |

### 3. Scope

| Scenario | Score |
|----------|-------|
| ≤5 files, ≤500 LOC | ✅ — manageable |
| 6-15 files, 500-2000 LOC | ⚠️ — consider narrowing |
| >15 files or >2000 LOC | ❌ — too broad, must narrow scope |
| Feature has clear boundaries (self-contained module) | ✅ bonus |
| Feature is deeply entangled with source codebase | ❌ — extraction risk high |

### 4. Quality

| Signal | Score |
|--------|-------|
| Has tests with >60% coverage | ✅ |
| Has tests but minimal | ⚠️ |
| No tests | ❌ |
| TypeScript strict / fully typed | ✅ bonus |
| Uses `any` extensively or untyped | ⚠️ |
| Well-documented (JSDoc, README for module) | ✅ bonus |
| No documentation | ⚠️ |
| Known anti-patterns (mutations, god classes, deep nesting) | ⚠️ — improve mode recommended |

**Composite**: ≥2 ✅ signals → ✅. 1 ✅ + warnings → ⚠️. No tests + untyped → ❌.

### 5. Maintenance

| Signal | Score |
|--------|-------|
| Last commit < 3 months ago | ✅ |
| Last commit 3-12 months ago | ⚠️ |
| Last commit > 12 months ago | ❌ |
| Active issues being addressed | ✅ |
| 50+ open issues, no response | ⚠️ |
| Archived or deprecated | ❌ |
| Multiple contributors | ✅ |
| Solo maintainer, inactive | ⚠️ |

**Note**: For compare mode, maintenance is informational only — not blocking.

## Presentation Format

```markdown
## Challenge Gate Results

| # | Dimension | Score | Detail |
|---|-----------|-------|--------|
| 1 | License | ✅ | MIT — compatible with your MIT project |
| 2 | Stack Fit | ⚠️ | React 18 → React 19 — minor API changes |
| 3 | Scope | ✅ | 4 files, ~350 LOC — well-scoped |
| 4 | Quality | ✅ | Typed, 12 tests, documented |
| 5 | Maintenance | ⚠️ | Last commit 5 months ago, but stable |

**Verdict**: PROCEED with caveats (0 ❌, 2 ⚠️)
Caveats: React 18→19 useEffect changes, verify repo still works with latest deps.
```
