---
name: db
description: Database workflow specialist. Generates migration files with rollback scripts, detects breaking schema changes, and validates query parameterization.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: development
  tools: "Read, Write, Edit, Bash, Glob, Grep"
---

# db

## Purpose

Database workflow specialist. Handles the parts of database work that cause production incidents — breaking schema changes, migrations without rollback, raw SQL injection vectors, and missing indexes on growing tables. Acts as a pre-deploy gate for any schema change, and generates correct migration files (up + down) for common ORMs.

## Triggers

- `/rune db` — manual invocation when schema changes are planned
- Called by `cook` (L1): schema change detected in diff
- Called by `deploy` (L2): pre-deploy migration safety check
- Called by `audit` (L2): database health dimension

## Calls (outbound)

- `scout` (L2): find schema files, migration files, ORM config
- `verification` (L3): run migration in test environment if configured
- `hallucination-guard` (L3): verify SQL syntax and ORM method names

## Called By (inbound)

- `cook` (L1): schema change detected in diff
- `deploy` (L2): pre-deploy migration safety check
- `audit` (L2): database health dimension

## Executable Steps

### Step 1 — Discovery

Invoke `scout` to locate:
- Schema definition files: `*.sql`, `schema.prisma`, `models.py`, `*.migration.ts`, `db/migrate/*.rb`
- Migration directory and existing migration files (to determine next migration number)
- ORM in use: **Prisma** | **TypeORM** | **SQLAlchemy/Alembic** | **Django ORM** | **ActiveRecord** | **raw SQL** | **unknown**
- Database type: **PostgreSQL** | **MySQL** | **SQLite** | **MongoDB** | **unknown**

If ORM cannot be determined with confidence, fall back to generic SQL migration format.

### Step 2 — Diff Analysis

Read current schema and compare against previous version (git diff if available):
- List all **added** columns, tables, indexes, constraints
- List all **removed** columns, tables, indexes
- List all **modified** columns (type changes, nullability changes, default changes)
- List all **renamed** columns or tables

### Step 3 — Breaking Change Detection

Classify each change by impact:

| Change | Classification | Why |
|--------|---------------|-----|
| ADD COLUMN NOT NULL without DEFAULT | **BREAKING** | Fails on existing rows |
| DROP COLUMN | **BREAKING** | Irreversible data loss |
| RENAME COLUMN or TABLE | **BREAKING** | Breaks all existing queries |
| CHANGE column type (e.g. VARCHAR→INT) | **BREAKING** | Data truncation risk |
| ADD COLUMN nullable | SAFE | Existing rows get NULL |
| ADD TABLE | SAFE | No impact on existing data |
| ADD INDEX | SAFE (but may lock table) | Lock risk on large tables |
| DROP INDEX | SAFE | Slight query slowdown |
| DROP TABLE | **BREAKING** | Irreversible data loss |

For any **BREAKING** change: output `BREAKING: [change description]` and require explicit user confirmation before generating migration.

<HARD-GATE>
Migration adding NOT NULL column to existing table without DEFAULT value = BLOCK.
Column rename or type change on data-bearing table = BREAKING — emit warning and require confirmation before proceeding.
Empty downgrade/rollback function = BLOCK — every migration MUST have a working down/rollback path.
</HARD-GATE>

### Step 4 — Migration Generation

For each schema change, generate a migration file with **up** (apply) and **down** (rollback) scripts.

**Prisma:**
```typescript
// migrations/[timestamp]_[description]/migration.sql
-- Up
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- Down (in separate migration file or comment)
ALTER TABLE "users" DROP COLUMN "avatar_url";
```

**Django / Alembic:**
```python
def upgrade():
    op.add_column('users', sa.Column('avatar_url', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('users', 'avatar_url')
# NEVER leave downgrade() empty — HARD-GATE blocks this
```

**TypeORM:**
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({
        name: 'avatar_url', type: 'text', isNullable: true
    }));
}
public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'avatar_url');
}
```

**Raw SQL:**
```sql
-- up.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
-- down.sql
ALTER TABLE users DROP COLUMN avatar_url;
```

Use `hallucination-guard` to verify syntax of generated SQL and ORM method names before writing.

### Step 5 — Index Analysis

For every new table or column added, check:
- Foreign key columns without index → flag `MISSING_INDEX: [column] — add index for JOIN performance`
- High-cardinality columns used in WHERE clauses (email, user_id, status) without index → flag `CONSIDER_INDEX`
- Composite indexes: if queries filter on (A, B), index should be on (A, B) not just A

For existing tables with new query patterns:
- If query uses ORDER BY [column] on large table without index → flag `SORT_INDEX_MISSING`

### Step 6 — Query Parameterization Scan

Scan migration files and any raw SQL files for injection vectors:

```python
# BAD: string interpolation in SQL
query = f"SELECT * FROM users WHERE email = '{email}'"

# GOOD: parameterized
query = "SELECT * FROM users WHERE email = %s"
cursor.execute(query, (email,))
```

Finding: `SQL_INJECTION_RISK — [file:line] — string interpolation in query — use parameterized query`

### Step 7 — Schema Documentation

Update or create `.rune/schema-changelog.md` with a human-readable entry:

```markdown
## [date] — [migration name]
- Added: [column list]
- Removed: [column list — note if data was migrated]
- Breaking: [yes/no] — [details if yes]
- Rollback: [migration name or "manual"]
```

### Step 8 — Report

Emit structured report:

```
## DB Report: [scope]

### Schema Changes
- [SAFE|BREAKING] [change description]

### Breaking Changes Requiring Confirmation
- BREAKING: [description] — requires explicit approval before migration runs

### Generated Files
- [migration file path] (up + down)

### Index Recommendations
- MISSING_INDEX: [table.column] — [reason]

### Query Safety
- SQL_INJECTION_RISK: [file:line] — [description]
- Clean: [list of checked files with no issues]

### Verdict: PASS | WARN | BLOCK
```

## Output Format

```
## DB Report: schema.prisma diff

### Schema Changes
- SAFE: Added users.avatar_url (TEXT, nullable)
- BREAKING: Renamed users.created → users.created_at

### Breaking Changes Requiring Confirmation
- BREAKING: Column rename users.created → users.created_at
  Impact: all queries referencing 'created' will break
  Confirm before proceeding? [yes/no]

### Generated Files
- migrations/20260224_add_avatar_url/migration.sql (up + down)

### Index Recommendations
- MISSING_INDEX: users.email — high-cardinality FK, add for login query performance

### Verdict: BLOCK (breaking change unconfirmed)
```

## Constraints

1. MUST generate both up and down scripts for every migration — empty rollback = BLOCK
2. MUST flag NOT NULL without DEFAULT as BLOCK — never silently generate broken migration
3. MUST NOT run migration in production — only in test environment (via verification)
4. MUST use hallucination-guard to verify SQL syntax before writing migration files
5. MUST NOT rename columns silently — always present impact and require confirmation

## Mesh Gates (L1/L2 only)

| Gate | Requires | If Missing |
|------|----------|------------|
| ORM Gate | ORM identified before migration generation | Fall back to raw SQL format + note |
| Breaking Gate | User confirmation before proceeding on BREAKING changes | BLOCK and await response |
| Rollback Gate | Working down() / rollback script before writing migration | BLOCK — prompt for rollback logic |
| Safety Gate | hallucination-guard verified SQL before Write | Re-verify or flag as unverified |

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Empty downgrade() written silently | CRITICAL | HARD-GATE: never write empty rollback — always prompt for rollback logic |
| NOT NULL column added without DEFAULT on existing table | CRITICAL | HARD-GATE: BLOCK and explain that this will fail on existing rows |
| Migration generated for wrong ORM (TypeORM syntax in Django project) | HIGH | hallucination-guard verifies method names match detected ORM |
| Index recommendations skipped on large tables | MEDIUM | Always run Step 5 — never skip index analysis |
| Schema changelog not updated after migration | LOW | Step 7 runs always — log INFO if skipped due to no .rune/ directory |

## Done When

- All schema changes classified (SAFE vs BREAKING)
- Breaking changes surfaced and confirmed (or BLOCK issued)
- Migration files generated with working up + down scripts
- hallucination-guard verified SQL syntax
- Index recommendations listed
- Query parameterization scan complete
- Schema changelog updated in .rune/schema-changelog.md
- Structured DB Report emitted with PASS/WARN/BLOCK verdict

## Cost Profile

~2000-6000 tokens input, ~800-2000 tokens output. Sonnet for migration generation quality.
