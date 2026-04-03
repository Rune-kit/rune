# Repo Analysis Patterns

Reference for autopsy Step 0 (repo intelligence) and cross-cutting analysis.

## GitHub API Metrics Interpretation

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Commits/week (avg last 12w) | > 5 | 1-5 | < 1 |
| Contributors (all-time) | > 5 | 2-4 | 1 (bus factor) |
| Open issues / total issues | < 30% | 30-60% | > 60% |
| Days since last push | < 14 | 14-90 | > 90 |
| Stars/fork ratio | > 5:1 | 2-5:1 | < 2:1 (fork-heavy = fragmentation) |

## Bus Factor Assessment

Bus factor = number of contributors who authored > 10% of recent commits (last 6 months).

```bash
# Bus factor calculation
git shortlog -sn --since="6 months ago" | awk '{total+=$1; print}' | \
  awk -v t=$(git shortlog -sn --since="6 months ago" | awk '{s+=$1}END{print s}') \
  '{pct=$1/t*100; if(pct>10) count++} END{print "Bus factor:", count}'
```

| Bus Factor | Risk | Action |
|-----------|------|--------|
| 1 | Critical | Flag in report — single point of failure |
| 2-3 | Moderate | Note in report — knowledge concentration |
| 4+ | Low | Healthy distribution |

## Hotspot-Complexity Correlation

Files that are BOTH hotspots (high change frequency) AND high complexity are the highest-priority rescue targets. Plot on a 2x2 matrix:

```
                High Complexity
                     |
    Refactor NOW     |    Monitor
    (hot + complex)  |    (cold + complex)
  -------------------+-------------------
    Leave alone      |    Review
    (hot + simple)   |    (cold + simple)
                     |
                Low Complexity
        High Churn ←————→ Low Churn
```

Priority order: hot+complex > cold+complex > hot+simple > cold+simple.

## Dependency Health Signals

### Outdated packages
```bash
# Node.js
npx npm-check-updates --format group 2>/dev/null | head -40

# Python
pip list --outdated --format columns 2>/dev/null | head -20
```

### Known vulnerabilities
```bash
# Node.js
npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities'

# Python
pip-audit --format json 2>/dev/null | jq '.dependencies | length'
```

### Circular dependency detection
```bash
# Node.js (madge)
npx madge --circular --extensions ts,js src/ 2>/dev/null

# Python (pydeps)
pydeps --no-output --show-cycles . 2>/dev/null
```

## Dead Code Heuristics

A file is likely dead code if ALL of these are true:
1. No other file imports it (check with grep/madge)
2. Not referenced in any config (webpack entry, tsconfig paths, package.json bin/main)
3. Last modified > 6 months ago
4. Not a test file, fixture, or migration

False positive checklist (do NOT flag these as dead):
- Dynamic imports (`import()`, `require(variable)`)
- Plugin/middleware loaded by config (e.g., babel plugins, ESLint rules)
- CLI entry points referenced in package.json `bin`
- Database migrations (executed by ORM, not imported)
- Template files loaded by path string

## Velocity Trend Analysis

Compare commit counts across 3-month windows to detect trajectory:

| Pattern | Signal | Interpretation |
|---------|--------|---------------|
| M1 > M2 > M3 | Decelerating | Project may be winding down or blocked |
| M1 < M2 < M3 | Accelerating | Active development, check for quality regression |
| M1 ~ M2 ~ M3 | Stable | Healthy maintenance pace |
| Spiky (high variance) | Irregular | Deadline-driven development — check quality around spikes |

```bash
# Monthly commit counts for last 6 months
for i in 0 1 2 3 4 5; do
  month=$(date -d "$i months ago" +%Y-%m 2>/dev/null || date -v-${i}m +%Y-%m)
  count=$(git log --after="$month-01" --before="$month-31" --oneline 2>/dev/null | wc -l)
  echo "$month: $count commits"
done
```
