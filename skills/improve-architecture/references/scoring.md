# Scoring Rubric

Numeric scoring is the value-add. Soft prose ("this looks shallow") doesn't compose. Numeric scores let `surgeon`, `audit`, `review` gate decisions programmatically.

Three metrics + one verdict per candidate.

## Depth (1–5)

Measures how much behavior the interface hides.

```
depth = clamp_1_5( implementation_complexity / interface_complexity )
```

**Interface complexity** — count of unique entry points (functions / methods) × average parameter count. Plus penalty (+1) for each invariant or ordering rule a caller must remember.

**Implementation complexity** — total LOC inside the module + count of distinct branches + count of distinct internal collaborators.

| Score | Description | Example |
|-------|-------------|---------|
| 1 | Wrapper / pass-through; interface ≈ impl | `getUserName(u) => u.name` |
| 2 | Thin; interface > 50% of impl | Function that does light validation + delegates |
| 3 | Modest; interface ≈ 1/3 of impl | Module with 5 methods over 200 LOC of state-machine logic |
| 4 | Deep; interface ≈ 1/5 of impl | Port with 3 methods over 800 LOC of state machine |
| 5 | Very deep; interface ≪ impl | Single-method JIT compiler interface |

## Leverage (1–5)

Measures caller benefit — how much capability callers get per unit of interface they have to learn.

```
leverage = clamp_1_5( num_callers * unique_use_cases / interface_method_count )
```

| Score | Description | Example |
|-------|-------------|---------|
| 1 | Few callers, many methods to learn | 1 caller, 8-method object |
| 2 | Modest reach per surface | 3 callers, 5 methods |
| 3 | Balanced | 10 callers, 4 methods |
| 4 | Strong leverage | 30 callers, 3 methods |
| 5 | Exceptional leverage | 100+ callers, 1-2 methods |

Edge cases:
- Internal-only modules (callers all in same package) — score capped at 4 unless used by multiple packages.
- External public API — leverage is per-consumer; cap at 5 because ecosystem reach is exponential.

## Locality (1–5)

Measures maintainer benefit — where change/bugs concentrate.

```
locality = clamp_1_5( code_concentration_index )
```

`code_concentration_index` ≈ 5 - (entropy of where related logic lives). Pragmatic scoring:

| Score | Description |
|-------|-------------|
| 1 | Logic spread across N callers; "fix once, fix N times" |
| 2 | Logic in 2-3 modules; some duplication |
| 3 | Logic mostly in one module, some leakage |
| 4 | Logic concentrated in one module; clear single source |
| 5 | Logic in one module AND callers don't reimplement it |

## Deletion test (verdict, not score)

Imagine deleting the module. What happens to the codebase?

| Verdict | Meaning |
|---------|---------|
| `vanish` | Complexity disappears; module was a pass-through. Often accompanies depth ≤ 2. Action: delete entirely, inline at callers, OR deepen by absorbing more responsibility. |
| `concentrate` | Complexity reappears across N callers. Module was earning its keep. Action: KEEP. May still benefit from deepening if depth < 4. |
| `redistribute` | Complexity moves — some absorbed by callers, some dissolved. Common case for partially-shallow modules. Action: deepen (most likely target) OR refine into a smaller, more focused module. |

## Aggregate score (architecture sub-score)

For a target module, the aggregate is:

```
candidate_score = depth + leverage + locality           # 3-15
sub_score_contribution = (candidate_score / 15) * 100   # 0-100 normalized
```

`audit` may aggregate across many candidates by averaging sub-score contributions weighted by callers (modules with more callers have more architectural impact).

## Score gating (used by other skills)

| Score Range | Interpretation | Suggested Action |
|-------------|----------------|------------------|
| 12-15 | Already deep; small gains possible | Skip deepening; tag as "healthy" |
| 8-11 | Modest; deepening yields measurable gain | Candidate for `surgeon` |
| 3-7 | Shallow; high-priority deepening target | Strong recommendation; flag in `audit` |
| 0-2 | Pass-through or wrapper; consider deletion | Verify with deletion test before delete |

## Worked scoring example

Module: `src/auth/login.ts`
- 1 function `login(email, password) → SessionToken | null`
- 30 LOC, 3 branches, calls `db.users.get` + `crypto.compare`
- Used by 4 routes

Calculate:
- Interface complexity: 1 entry × 2 params = 2; +0 invariants → 2
- Implementation complexity: 30 LOC + 3 branches + 2 collaborators = ~35
- Depth: clamp_1_5(35/2 ÷ 5) ≈ 3 (modest, not very deep)
- Leverage: clamp_1_5(4 callers × 1 use case / 1 method) = 4 (strong leverage already!)
- Locality: 5 (logic in one file)
- Deletion test: concentrate (deleting it scatters auth across 4 routes)

Aggregate: 3 + 4 + 5 = **12 / 15** = "healthy". Improvement effort better spent elsewhere.

The single-function "login" was actually fine. The shallowness signal might come from `login + refresh + logout` being three separate small modules — score them as a candidate cluster, not individually.

## Cluster scoring

When the friction is a cluster of related shallow modules (auth, session, refresh), score the *cluster as a single hypothetical deepened module*:

- Depth: what the deepened interface would be
- Leverage: callers across all current modules combined / new method count
- Locality: maintainer benefit if all logic concentrated

The current state's score is the *baseline*; the cluster score is the *target*. Delta = potential gain.
