# CONTEXT.md — Project Glossary Format

Persistent vocabulary for the project's domain — what nouns mean, how concepts relate, which words are aliases of which. Lives at the repo root (or per-bounded-context root in multi-context repos).

## Where it lives

```
<repo-root>/
├── CONTEXT.md                   ← single-context repo
└── src/

# OR for multi-context repos:
<repo-root>/
├── CONTEXT-MAP.md               ← lists each context + relationships
└── src/
    ├── ordering/CONTEXT.md
    └── billing/CONTEXT.md
```

If `CONTEXT-MAP.md` exists at root, the repo has multiple contexts; otherwise it's single-context.

## Lazy creation

CONTEXT.md is created **only when there's a non-trivial term to record**. Empty file = bad signal. Absent file = silent OK.

`ba` checks via Glob; absence is **not** flagged as a project gap. Don't suggest "you should create one." Wait until a term needs sharpening.

## Format

```markdown
# Project Glossary

One-line description of what this project is and why this glossary exists.

## Language

| Term | Definition | Aliases to avoid | Status |
|------|------------|-------------------|--------|
| **Order** | A customer's request to purchase items | Purchase, transaction | canonical |
| **Invoice** | A request for payment sent after delivery | Bill, payment request | canonical |
| **Customer** | A person or organization that places orders | Client, buyer, account | canonical |
| **User** | An authentication identity in the system | Login, account | canonical |

## Relationships

- An **Order** produces one or more **Invoices**
- An **Invoice** belongs to exactly one **Customer**
- A **Customer** may or may not be a **User** (guests can place orders)

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is generated once a **Fulfillment** is confirmed. A single **Order** can produce multiple **Invoices** if items ship in separate **Shipments**."

## Flagged ambiguities

- "account" was used for both **Customer** and **User** — resolved: distinct concepts. **Customer** places orders; **User** is an authentication identity.
- "transaction" sometimes meant **Order** and sometimes **Payment** — resolved: avoid the word entirely.
```

## Term schema

Each row in the **Language** table:

| Column | Required | Description |
|--------|----------|-------------|
| Term | ✅ | Bold, kebab-case-friendly singular noun (or short phrase) |
| Definition | ✅ | One sentence. Defines what it IS, not what it does. |
| Aliases to avoid | optional | Other words the team has used; agents and humans must avoid them in code, comments, and conversation |
| Status | ✅ | `canonical` (settled) \| `pending` (waiting on domain-expert confirmation) \| `conflicted` (active disagreement, needs resolution) |

## Update protocol

### Inline sharpen (during a BA session)

When the user uses a term whose meaning is ambiguous, propose a precise canonical version. When confirmed, update CONTEXT.md right there. Don't batch.

> "You used 'account' twice — once meaning **Customer** (the person ordering), once meaning **User** (the login). I'll record these as distinct in CONTEXT.md."

### Cross-reference (HARD-GATE)

When the user asserts behavior — "the system cancels Orders when X" — `ba` MUST grep the codebase to verify before recording in CONTEXT.md. If grep contradicts the user, surface the conflict and ask which is canonical.

> User: "Yes, partial cancellation is supported."
> Agent (after grepping `src/orders/cancel.ts`): "The code path I see only handles full cancellation (`cancel(orderId)` returns `Order` with status `cancelled`, no partial-quantity argument). Either the code is incomplete, or partial cancellation isn't implemented yet. Which is the canonical behavior?"

This gate stops AI agents from silently recording user-asserted behavior that contradicts the code — a frequent source of "the docs say X but the code does Y" drift.

### Conflict gate

When a new term has ≥0.7 token overlap with an existing one, force a user choice:

| Choice | Action |
|--------|--------|
| Merge | Combine the new term's aliases into the existing entry |
| Rename | Pick a distinct slug for the new term |
| Keep distinct | Confirm the overlap is coincidental; record both |

Agents must NOT silently re-define existing terms.

## Single vs multi-context

**Single context (most repos)**: one `CONTEXT.md` at the repo root.

**Multiple contexts**: a `CONTEXT-MAP.md` at the root lists where each context lives:

```markdown
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments

## Relationships

- **Ordering → Billing**: Ordering emits `OrderPlaced` events; Billing consumes them
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

`ba` infers structure:
- If `CONTEXT-MAP.md` exists → multi-context; read it to find the right CONTEXT.md
- If only root `CONTEXT.md` exists → single-context
- If neither exists → silent skip; create root CONTEXT.md lazily on first term resolution

## What does NOT belong in CONTEXT.md

- Generic programming concepts (timeouts, error types, function signatures) — these aren't domain terms.
- Module / class names — they belong in code, not glossary, unless they have meaning to a domain expert.
- Implementation details — CONTEXT.md is the *what* (concept), not the *how* (data shape).

Before adding a term, ask: would a non-engineer domain expert recognize this and care? If no, don't add it.

## Relationship to CLAUDE.md

CLAUDE.md describes *how to work in this repo* — conventions, danger zones, deploy commands. CONTEXT.md describes *what these words mean* — the domain glossary. The scopes are mutually exclusive; never duplicate.
