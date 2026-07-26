# SQL and migrations

Blocking here: anything irreversible, anything that takes a long lock on a live table, and anything
that concatenates input into a statement. A migration is reviewed as an operation on production
data, not as a file — the question is always "what happens when this runs against the real table".

## Reversibility

- A migration with no down path, or a down path that does not restore what the up path removed
- A destructive step and a data backfill in the same migration — a rollback loses the data
- A down path that recreates a column but not its constraints, defaults, or index

Do not report a missing down migration in a project whose visible convention is forward-only
migrations — check the neighbouring files first; if they are all forward-only, this is the pattern,
not the defect.

## Locking and online safety

- `ALTER TABLE` that rewrites a large table: changing a column type, adding a `NOT NULL` column with
  a volatile default
- `CREATE INDEX` without a concurrent variant on an engine that supports one
- Adding a foreign key without a `NOT VALID` / validate split where the engine offers it
- A migration that holds a transaction open across a long backfill

Do not report lock risk on a table that is demonstrably small or new — a table created earlier in
the same migration takes no meaningful lock.

## Destructive operations

- `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` with no evidence the data is already migrated
- `UPDATE` or `DELETE` with no `WHERE`, or a `WHERE` on a column that is not selective
- A column dropped in the same release that deploys the code which stops reading it — old instances
  are still running during the rollout

Do not report a drop that is explicitly the second half of an expand-migrate-contract sequence when
the earlier migration in the same directory did the expand.

## Query correctness

- `NOT IN` against a subquery whose column is nullable — a single NULL makes the result empty
- An outer join whose `WHERE` clause filters the outer side, silently making it an inner join
- `LIMIT` with no `ORDER BY` — the rows returned are whatever the plan produced
- Aggregates mixed with ungrouped columns
- Implicit cross joins from a missing join condition

Do not report a missing `ORDER BY` on a query whose result is fed to an aggregate or an existence
check, where row order cannot affect the outcome.

## Indexing and performance

- A `WHERE` clause wrapping an indexed column in a function or a cast — the index goes unused
- `LIKE` with a leading wildcard on a large table
- A foreign key with no index on the referencing side, where the parent gets deleted
- `SELECT *` in application code that will break when a column is added

Do not report a missing index on a table that is small, append-only, or read once per deployment.

## Injection and privileges

- A statement assembled by string concatenation or interpolation instead of bind parameters
- Dynamic SQL built from input inside a stored procedure or a function
- A `GRANT` broader than the operation needs, or a migration that runs as a superuser role

Do not report interpolation of an identifier drawn from a fixed allowlist in the same file — many
drivers cannot parameterize identifiers, and the allowlist is the correct mitigation.
