# Language

Shared vocabulary every output of this skill uses. These eight terms are precise. Substitutes ("component", "service", "API", "boundary", "layer") are banned in skill output because they carry baggage from other paradigms (DDD, microservices, n-tier).

## Terms

### Module
Anything with an interface and an implementation. Scale-agnostic on purpose: a function, a class, a package, or a tier-spanning slice can each be a module.
*Avoid*: unit, component, service.

### Interface
Everything a caller must know to use the module correctly. Includes the type signature plus invariants, ordering constraints, error modes, required configuration, and performance characteristics.
*Avoid*: API, signature (those refer only to the type-level surface).

### Implementation
The body of code inside the module. Distinct from **adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake).

### Depth
Leverage at the interface — how much behavior a caller can exercise per unit of interface they have to learn.
- **Deep**: large behavior, small interface.
- **Shallow**: interface nearly as complex as the implementation (often a wrapper or pass-through).

Numeric scoring rubric (1–5):
| Score | Interface Complexity vs Implementation |
|-------|----------------------------------------|
| 1 | Wrapper / pass-through (interface ≈ impl) |
| 2 | Thin (interface > 50% of impl) |
| 3 | Modest (interface ≈ 1/3 of impl) |
| 4 | Deep (interface ≈ 1/5 of impl) |
| 5 | Very deep (interface ≪ impl) |

### Seam *(from Michael Feathers)*
A place where you can alter behavior without editing in that place. The *location* of an interface. Choosing where to put the seam is its own design decision, distinct from what goes behind it.
*Avoid*: boundary (overloaded with DDD's bounded context).

### Adapter
A concrete thing that satisfies an interface at a seam. Describes role (what slot it fills), not substance (what's inside).

### Leverage
What callers get from depth. More capability per unit of interface they have to learn. One implementation pays back across N call sites and M tests.

### Locality
What maintainers get from depth. Change, bugs, knowledge, and verification concentrate at one place rather than spreading across callers. Fix once, fixed everywhere.

## Principles

### Depth is a property of the interface, not the implementation
A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its public interface.

### The deletion test
Imagine deleting the module.
- If complexity vanishes, the module wasn't hiding anything — it was a pass-through. Verdict: `vanish`.
- If complexity reappears across N callers, the module was earning its keep. Verdict: `concentrate`.
- If complexity moves to some callers and dissolves at others — verdict: `redistribute`. Common case for partially-deepened modules.

### The interface is the test surface
Callers and tests cross the same seam. If you want to test *past* the interface (peek at internal state, count internal calls), the module is the wrong shape — not the test.

### One adapter is hypothetical, two are real
Don't introduce a port unless something actually varies across it (typically prod + test). A single-adapter seam is just indirection that costs comprehension without buying flexibility.

## Relationships

- A **Module** has exactly one **Interface** (its public surface).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Banned framings (and why)

- **Depth as ratio of impl-lines to interface-lines** — rewards padding the implementation. Use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods** — too narrow. Interface here includes every fact a caller must know, including invariants and error modes.
- **"Boundary"** — overloaded with DDD's bounded context. Say *seam* or *interface* instead.
- **"Component"** — UI-centric. Use *module*.
- **"Service"** — microservice-centric. Use *module*.
- **"Layer"** — too generic, often confused with horizontal n-tier slicing. Use *module* + *seam*.

## Vocabulary discipline (mechanical check)

The compiler test `compiler/__tests__/vocabulary-discipline.test.js` greps this skill's body and references for the banned aliases. Any hit fails the build. Fix by substituting the precise term.
