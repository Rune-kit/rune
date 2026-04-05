# Shared Formulas — Cross-Skill Computation Standards

Version: 1.0.0 | Since: v2.9.0

## Purpose

When multiple skills compute the same metric, they MUST use the same formula. Inconsistent scoring across skills produces conflicting recommendations — "review says quality is 72/100 but audit says 85/100" erodes trust.

This document defines shared formulas that any skill can reference. Skills MUST cite this document when using these formulas, and MUST NOT invent local variants.

## Formula Registry

### 1. Quality Score (0-100)

Used by: `review`, `audit`, `cook` (quality_gates summary), `autopsy`

```
quality_score = (
  correctness × 0.30 +
  security × 0.25 +
  performance × 0.20 +
  maintainability × 0.15 +
  test_coverage × 0.10
) × 100
```

Each component is scored 0.0-1.0:
- **correctness** (0.30): Does it do what it claims? Type safety, edge case handling, spec compliance
- **security** (0.25): OWASP top 10, input validation, secret handling, auth checks
- **performance** (0.20): N+1 queries, sync-in-async, unnecessary allocations, missing indexes
- **maintainability** (0.15): Cyclomatic complexity, file size, naming clarity, coupling
- **test_coverage** (0.10): Line coverage %, branch coverage %, critical path coverage

**Interpretation:**
| Score | Label | Action |
|-------|-------|--------|
| 90-100 | Excellent | Ship it |
| 75-89 | Good | Minor improvements, ship-ready |
| 60-74 | Acceptable | Address HIGH findings before ship |
| 40-59 | Concerning | Significant work needed |
| 0-39 | Critical | Do not ship — major remediation required |

### 2. Finding Priority Score

Used by: `review`, `sentinel`, `preflight`, `audit`, `content-decay-detector` (adapted)

```
priority = severity_weight × confidence × blast_radius
```

Where:
- **severity_weight**: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1
- **confidence**: HIGH=1.0, MEDIUM=0.7, LOW=0.4
- **blast_radius**: number of direct dependents (d=1 from impact analysis), capped at 10

**Interpretation:** Higher score = fix first. Used to sort findings when a review produces 10+ items.

**Example:**
```
HIGH severity, MEDIUM confidence, 5 dependents:
priority = 3 × 0.7 × 5 = 10.5

CRITICAL severity, HIGH confidence, 2 dependents:
priority = 4 × 1.0 × 2 = 8.0

→ HIGH finding with wider blast radius gets fixed first
```

### 3. Complexity Score

Used by: `autopsy`, `review`, `audit`, `surgeon`

```
complexity = cyclomatic_complexity × 0.4 + cognitive_complexity × 0.4 + dependency_count × 0.2
```

Where:
- **cyclomatic_complexity**: McCabe complexity (branches, loops, conditions) — normalized 0-1 via `min(cc / 20, 1.0)`
- **cognitive_complexity**: Nesting depth, break in linear flow — normalized 0-1 via `min(cog / 15, 1.0)`
- **dependency_count**: Import count — normalized 0-1 via `min(deps / 20, 1.0)`

**Interpretation:**
| Score | Label | Action |
|-------|-------|--------|
| 0.0-0.3 | Simple | No action needed |
| 0.3-0.6 | Moderate | Monitor, refactor if touching |
| 0.6-0.8 | Complex | Refactor candidate |
| 0.8-1.0 | Dangerous | Priority refactor target |

### 4. Context Pressure Score

Used by: `context-engine`, `cook` (budget-aware progression), `team` (agent allocation)

```
pressure = tokens_used / context_limit
```

**Thresholds:**
| Pressure | Label | Action |
|----------|-------|--------|
| 0.0-0.5 | GREEN | Normal operation |
| 0.5-0.7 | YELLOW | Consider compaction at next natural boundary |
| 0.7-0.85 | ORANGE | Compact now, defer non-essential work |
| 0.85-1.0 | RED | Emergency compact, save state, prepare to pause |

### 5. Observation/Effect Ratio

Used by: `cook` (budget tracking), `completion-gate` (execution loop audit)

```
oe_ratio = observation_actions / total_actions
```

Where:
- **observation_actions**: Read, Glob, Grep, Bash (read-only commands)
- **effect_actions**: Write, Edit, Bash (write commands)
- **total_actions**: observation + effect

**Interpretation:**
| Ratio | Label | Action |
|-------|-------|--------|
| > 0.8 | Analysis paralysis | Too much reading, not enough doing |
| 0.5-0.8 | Healthy exploration | Normal for early phases |
| 0.3-0.5 | Productive | Optimal for implementation phases |
| < 0.3 | Cowboy coding | Writing without understanding — slow down |

### 6. Info Saturation Score

Used by: `scout` (saturation detection), `research` (diminishing returns)

```
saturation = 1 - (new_entities / total_entities)
```

Where:
- **new_entities**: unique entities (files, functions, patterns) discovered in the latest search round
- **total_entities**: all unique entities discovered across all rounds

**Interpretation:**
| Score | Label | Action |
|-------|-------|--------|
| < 0.7 | Still discovering | Continue research |
| 0.7-0.85 | Diminishing returns | One more round max |
| > 0.85 | Saturated | Stop — additional searches waste tokens |

## Adding New Formulas

When a formula is used by 2+ skills:
1. Extract it here with clear variable definitions
2. Add interpretation table (what do the numbers mean?)
3. List all consuming skills
4. Update each consuming skill to reference this document
5. Formulas MUST be deterministic — same inputs always produce same output, no randomness

## Anti-Patterns

- **Local formula variants**: If review uses `severity × confidence` but sentinel uses `severity + confidence`, findings can't be compared. Use the shared formula.
- **Magic numbers without interpretation**: A score of 0.73 means nothing without a threshold table.
- **Unbounded scores**: All formulas must have a defined range (0-1, 0-100, etc.) — unbounded scores resist comparison.
