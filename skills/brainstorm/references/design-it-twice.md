# Design-It-Twice Mode

Force genuine architectural diversity when exploring alternative interfaces or module shapes. Spawns parallel subagents, each pinned to a *radically different* design constraint, then computes a diversity score before presenting results.

## When to use

| Situation | Use Design-It-Twice |
|-----------|---------------------|
| Multiple credible interface shapes for a deepening candidate (from `improve-architecture`) | ✅ |
| User asked "what are the options for designing X?" | ✅ |
| Ports vs no-ports decision is itself a design question | ✅ |
| Cross-seam dependencies (remote-owned, true-external) where adapter choice matters | ✅ |
| One obvious interface shape — translation of existing public functions | ❌ Skip; go directly to surgeon/fix |
| Single-method utility | ❌ Skip; not enough surface to design twice |

## The four standard constraints

Each parallel subagent is pinned to exactly one constraint via the spawn prompt. The constraints are deliberately incompatible — that's where the diversity comes from.

| ID | Constraint | What it produces |
|----|------------|------------------|
| `C1` | **Minimize interface** — aim for 1–3 entry points; maximize leverage per entry | Smallest interface; deep impl; few callers learn the surface |
| `C2` | **Maximize flexibility** — support many use cases, plugin/extension surface | Wide interface; configurable; extension points |
| `C3` | **Optimize common case** — make default trivial; rare cases pay cost | Tiny default; opt-in complexity for power users |
| `C4` | **Ports & adapters** — design seams for cross-boundary swap | Explicit ports; multiple adapter slots |

For most cases pick 3 of 4. Add C4 only when the dependency category (from `improve-architecture/references/deepening.md`) is `remote-owned` or `true-external`.

## Subagent spawn template

```
You are designing an interface for: <module description>

Current state:
  files: <file list>
  callers: <caller summary>
  current_depth: <1-5>
  dependency_category: <in-process | local-substitutable | remote-owned | true-external>
  what_to_hide: <state, lifecycle, retry, error transformation>

Constraint: <C1 | C2 | C3 | C4>
  <constraint description from the table above>

Output (YAML):
  interface:
    name: <DeepenedModuleName>
    methods:
      - signature: <method signature>
        invariants: [<invariant 1>, <invariant 2>]
        errors: [<error case 1>, <error case 2>]
  usage_example: |
    <code showing how a caller invokes the interface>
  hides_behind_seam:
    - <complexity 1 hidden inside the implementation>
    - <complexity 2>
  dependency_strategy:
    category: <category>
    adapters: [<adapter1>, <adapter2>]
    seam_real: <true if adapters >= 2, false if 1 (downgrade to internal seam)>
  tradeoffs:
    leverage: <1-5 + 1-line justification>
    flexibility: <1-5 + 1-line justification>
    common_case_simplicity: <1-5 + 1-line justification>

Vocabulary: use the controlled terms from rune:improve-architecture/references/language.md
  (module, interface, seam, adapter, leverage, locality)
  Do NOT use "boundary", "component", "service", or "layer" in narrative.

Domain terms: <if CONTEXT.md present, list its glossary terms here so the design uses them>
```

## Diversity gate (machine-checked)

After all subagents return, compute pairwise similarity over feature vectors:

```
feature_vector(design) = [
  count(interface.methods),
  count(distinct_return_types),
  count(unique_adapter_kinds),
  count(unique_dependencies),
  paradigm_tag,           // "minimal" | "extensible" | "default-light" | "ports-adapters"
  has_async_methods,      // bool → 0/1
  has_streaming,          // bool → 0/1
]
```

Diversity score:
```
similarity(d_i, d_j) = jaccard(feature_vector(d_i), feature_vector(d_j))
diversity = 1 - mean(similarity(d_i, d_j) for all i < j)
```

| Diversity | Action |
|-----------|--------|
| ≥ 0.6 | Proceed to presentation |
| 0.4 – 0.59 | Marginal; surface to user — "designs are similar in [shared trait]; want me to re-spawn with different constraints?" |
| < 0.4 | Re-spawn with rotated constraints (e.g., swap C2 → C4); 1 retry max before giving up |

`diversity_floor = 0.4` is conservative; tune in v0.7+ once usage telemetry exists.

## Presentation order

1. Each design alone (sequential, so user can absorb each in isolation)
2. Comparison table contrasting designs by:
   - **Depth** — leverage at the interface
   - **Locality** — where change concentrates
   - **Seam placement** — internal vs external; ports yes/no
   - **Common-case trivial-ness** — how much work for the default path
3. **Opinionated recommendation** — strongest design + concrete hedge condition for when to pick a different one
4. **Hybrid synthesis (optional Step 4.5)** — if 2 designs have complementary strengths, propose a 4th synthesized option that combines them

Skip the comparison table if N=2 (just 1 contrast, prose handles it).

## "It depends" is BLOCKED

The recommendation step requires a concrete recommendation with a hedge:

✅ "Recommend C1 (minimize interface). Choose C3 (optimize common case) if you discover most callers only need the default path."

❌ "It depends on your priorities."

If you genuinely can't pick between two designs, propose the hybrid (Step 4.5) and recommend that as the default.

## Hybrid synthesis (Step 4.5 — optional)

When two designs have complementary strengths (e.g., C1's leverage + C4's seam discipline), propose a 4th option that combines them:

```
Option D (Hybrid C1 + C4):
  - Interface: 3 methods (from C1's minimization)
  - Adapters: HttpAdapter + InMemoryAdapter (from C4's port discipline)
  - Pros: small surface AND testable across the seam
  - Cons: more upfront design work; locks the port early
```

Hybrid synthesis is **opt-in**. If no two designs have clear complementary strengths, skip this step.

## Cost note

4 parallel opus subagents is the most expensive thing this skill does. Use Design-It-Twice mode only when `improve-architecture` flags a candidate worth deepening (multiple credible interfaces). Default Discovery mode is cheaper for ordinary brainstorming.

## Output schema (chain_metadata)

```yaml
chain_metadata:
  skill: "rune:brainstorm"
  mode: "design-it-twice"
  exports:
    designs: [<yaml-per-design>]
    diversity_score: 0-1
    constraints_used: [C1, C2, C4]
    recommendation: <design-id>
    hybrid_proposed: <true|false>
```
