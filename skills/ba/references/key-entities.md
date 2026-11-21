# ba — Key entities

> Reference for `skills/ba/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Step 5.5 — Key Entities (mandatory if feature involves data)

If ANY user story creates, reads, updates, or deletes data, list the key entities — WHAT the data is, not HOW it's stored (no table names, no column types, no ORM detail):

```
## Key Entities
- **Order**: what a customer submits — items, quantities, status (draft → submitted → fulfilled). One User has many Orders.
- **User**: the person placing orders — identity, contact. Referenced by Order.
```

Rules:
- One line per entity: name, what it represents, key attributes (plain language), relationships
- State-bearing entities name their lifecycle states — these become the state machine in requirements.mermaid
- This section SEEDS `plan`'s data-model.md — a story that touches data but has no entity here is a spec gap (plan will bounce it back)
- Skip entirely for stateless features (pure computation, styling, config)
