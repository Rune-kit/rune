# Review Rules — Index

Rule files scoped by file type. Step 1 of `review` loads **only** the entries matching extensions
actually present in the scope list, plus `default.md`. Loading all of them reintroduces exactly the
noise this split exists to remove.

## Mapping

| Pattern | Rule file |
|---------|-----------|
| `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` | `ts-js.md` |
| `*.py` | `python.md` |
| `*.go` | `go.md` |
| `*.rs` | `rust.md` |
| `*.sql`, migration files | `sql.md` |
| `*.yml`, `*.yaml`, `*.json`, `*.toml`, CI workflows, Dockerfile | `config.md` |
| everything else | `default.md` |

## Loading protocol

1. Collect the distinct extensions across the Step 1 scope list.
2. Read the matching rule files — at most one per language present.
3. Always read `default.md`; it carries the dimensions every file is judged on.
4. Stop there. A rule file for a language absent from the diff cannot produce a finding about it.

## What a rule file is, and is not

Every section ends with a `Do not report when…` line. That line is the point of the file — a rule
that only says when to fire will fire on everything, and a review that fires on everything gets
skimmed. The negative clause binds as hard as the positive one.

Rule files do **not** restate what `SKILL.md` already owns:

- **Review Policy** — precision over recall, the blocking split, never guessing at missing
  context. Rules inherit it rather than repeating it.
- **Evidence Contract** — verbatim snippets and line numbers resolved by the Anchor Pass.
- **Claim types** — `OBSERVED` / `DERIVED` / `ASSUMED`, and the rule that `ASSUMED` never reaches
  CRITICAL.
- **Severity meanings** — defined once. A rule file may say a finding is *typically* HIGH; it never
  invents a severity, a gate, or a verdict of its own.

A rule fires a finding. Whether that finding survives is the Falsification Pass's call, not the
rule's.
