# Boundary Artifacts (Contracts-First)

> Reference for `plan` skill — Step 3.7.
> Load when the feature crosses a UI↔data boundary.

The single most common incomplete-implementation failure is a UI element wired to nothing —
the button renders, the endpoint doesn't exist. Boundary artifacts make the interface surface
a REVIEWABLE ARTIFACT at plan time, so a missing backend is visible before any code is written.

## Detection

Emit boundary artifacts when BOTH are true:
1. `requirements.md` has a `## Key Entities` section (feature involves data)
2. Any user story renders a UI surface — page, screen, form, component — OR the task
   implies user interaction with persisted data (submit, save, login, search, checkout)

Skip (and announce the skip) for: pure-UI features (styling, layout, static content),
pure-backend (cron jobs, migrations, CLI), libraries with no UI.

## Artifact 1: data-model.md

Save to `.rune/features/<name>/data-model.md`. Expand each Key Entity from the spec:

```markdown
# Data Model: [Feature Name]

## Order
| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| id | uuid | generated | PK |
| userId | uuid | must reference existing User | FK → User |
| status | enum | draft \| submitted \| fulfilled | state machine below |
| items | OrderItem[] | min 1 item | |

**State transitions**: draft → submitted (on user submit, validates items) → fulfilled
(on admin action). No transition skips submitted. Invalid transition = 409.

**Relationships**: User 1—N Order. Order 1—N OrderItem.
```

Rules: every entity from the spec's Key Entities appears here. Every state named in the
spec has an explicit transition trigger. Validation rules come from AC error cases.

## Artifact 2: contracts/

Save one file per interface to `.rune/features/<name>/contracts/`. Filename: `<verb>-<resource>.md`
(e.g., `create-order.md`, `list-orders.md`).

```markdown
# Contract: POST /api/orders

**Serves**: US-1 (AC-1.1, AC-1.2)

## Request
```json
{ "items": [{ "productId": "uuid", "quantity": 1 }] }
```
Validation: items non-empty; quantity ≥ 1; productId exists.

## Response 201
```json
{ "id": "uuid", "status": "submitted", "items": [...] }
```

## Errors
| Case | Status | Body |
|------|--------|------|
| empty items (AC-1.2) | 422 | `{ "error": "items must not be empty" }` |
| unknown productId | 404 | `{ "error": "product not found" }` |
| unauthenticated | 401 | — |

## Consumers
- `OrderForm` component (US-1 UI task) — submit handler calls this endpoint
```

Rules:
- Every contract names the `US-n` it serves and the AC cases its errors cover
- Every contract names its **Consumers** — the UI component or caller that will invoke it.
  A contract with no consumer, or a UI task with no contract, is an orphan → fix the plan
- Non-HTTP interfaces (IPC, function boundary, event) use the same shape: input, output, errors, consumers

## Artifact 3: quickstart.md

Save to `.rune/features/<name>/quickstart.md`. This is EXECUTABLE, not prose — the
final phase carries a "run quickstart validation" task (see Task derivation below),
so the feature cannot be declared done without these steps passing.

```markdown
# Quickstart: [Feature Name]

## Prerequisites
- `npm install` done, DB running (`docker compose up -d db`)
- Migrations applied: `npm run db:migrate`

## Validate US-1 (P1): submit an order
1. `npm run dev`
2. `curl -s -X POST localhost:3000/api/orders -H 'content-type: application/json' \
     -d '{"items":[{"productId":"<seed-id>","quantity":1}]}'`
   **Expect**: 201, body contains `"status":"submitted"`
3. `curl -s localhost:3000/api/orders` — **Expect**: list contains the new order
4. UI path: open /orders/new → add item → Submit → **Expect**: redirect to /orders,
   new order visible in list

## Validate US-1 error path (AC-1.2)
1. Submit with empty items → **Expect**: 422, form shows "items must not be empty"
```

Rules:
- One validation block per P1 story (P2/P3 optional), derived from the story's Independent Test
- Every step has an **Expect** with an observable outcome — status code, body content, visible UI state
- Commands must actually run in the project's environment; if the env can't run them
  (no browser, no DB), say so in Prerequisites and give the closest executable check

## Task derivation

After emitting the three artifacts, derive tasks:

| Source | Derived tasks |
|--------|---------------|
| Each entity in data-model.md | 1 schema/model task (in Foundational if shared by 2+ stories, else in its story) |
| Each contract file | 1 contract test task + 1 implementation task, inside the story it serves, BEFORE that story's UI task |
| Each contract's Consumers line | the UI task's Logic field references the contract file |
| quickstart.md | 1 "run quickstart validation" task in the final phase |

Cross-check before Coverage Gate (Step 5.7): every contract implemented, every consumer wired,
every quickstart block runnable. An unimplemented contract = the dead button, caught at plan time.
