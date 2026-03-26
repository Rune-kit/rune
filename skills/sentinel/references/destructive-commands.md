# Destructive Command Guard — Pattern Table and Safe Exceptions

Reference for Step 4b. Real-time command guard patterns for agent workflows.


## Pattern Table

Any skill executing Bash commands SHOULD check against these patterns before execution:

| Pattern | Risk | Action |
|---------|------|--------|
| `rm -rf` / `rm -r` / `rm --recursive` | Recursive delete | WARN — confirm target is expected |
| `DROP TABLE` / `DROP DATABASE` / `TRUNCATE` | Data loss | BLOCK — require explicit confirmation |
| `git push --force` / `git push -f` | History rewrite | WARN — confirm branch is correct |
| `git reset --hard` | Uncommitted work loss | WARN — verify no unsaved changes |
| `git checkout .` / `git restore .` | Working tree wipe | WARN — verify intent |
| `kubectl delete` / `docker system prune` | Production impact | BLOCK — require namespace/context confirmation |
| `chmod 777` / `chmod -R 777` | Permission escalation | WARN — almost never correct |

## Safe Exceptions (do NOT warn)

- `rm -rf node_modules`, `.next`, `dist`, `__pycache__`, `.cache`, `build`, `.turbo`, `coverage`, `target`
- `git push --force-with-lease` (safe force push)
- `docker rm` on explicitly named test containers

## Static Scan Targets (Step 4a)

Scan changed files for:
- Destructive shell commands in scripts: `rm -rf /`, `DROP TABLE`, `DELETE FROM` without `WHERE`, `TRUNCATE`
- File operations using absolute paths outside the project root (e.g., `/etc/`, `/usr/`, `C:\Windows\`)
- Direct production database connection strings (`prod`, `production` in DB host names)

Destructive command on production path = **BLOCK**. Suspicious path = **WARN**.

## Composable Modes (future — advisory only)

- **Careful mode**: warn before any destructive command (all patterns above)
- **Freeze mode**: restrict file edits to a specific directory (scope lock)
- **Guard mode**: careful + freeze combined
