# audit — DX review principles

> Reference for `skills/audit/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### DX Principle 1: Time to Hello World

Measure: How many steps from `git clone` to running the project?

```
1. Read README.md — extract setup instructions
2. Count discrete steps (clone, install, config, build, run)
3. Check: are ALL commands copy-pasteable? (no placeholders without explanation)
4. Check: does `npm start` / `python main.py` / equivalent work immediately after install?
5. If browser-pilot available: attempt to follow the README steps literally
```

| Steps to Run | Score | Verdict |
|--------------|-------|---------|
| 1-2 commands | 10/10 | Excellent — "clone and go" |
| 3-4 commands | 7/10 | Good — reasonable setup |
| 5-7 commands | 4/10 | Fair — friction will lose contributors |
| 8+ commands | 2/10 | Poor — significant onboarding barrier |
| Cannot run from README | 0/10 | Broken — README is lying or incomplete |

### DX Principle 2: First-Time Setup Friction

Check for common setup traps:

- Missing `.env.example` → new dev has no idea what env vars are needed
- Missing system dependency docs (e.g., needs Redis/Postgres but README doesn't say)
- Node version mismatch (no `.nvmrc` or `engines` field)
- Python version mismatch (no `python-version` in `pyproject.toml`)
- Failing install on clean machine (native deps, missing build tools)
- No `--help` or usage message when running CLI with no args

Score: count friction points. 0 = 10/10, 1-2 = 7/10, 3-4 = 4/10, 5+ = 2/10.

### DX Principle 3: Error Message Quality

Sample 5 error paths in the codebase (auth failure, invalid input, missing config, network error, permission denied). For each:

- Does the error message say WHAT went wrong? (not just "Error" or "Something went wrong")
- Does it say WHY? (context: which input, which config key)
- Does it suggest HOW to fix? (actionable: "set X in .env" not "check configuration")

| Quality | Score |
|---------|-------|
| All 3 (what + why + how) | 10/10 |
| What + why, no how | 6/10 |
| What only | 3/10 |
| Generic errors | 1/10 |

### DX Principle 4: CLI Help Quality

If project has a CLI entry point:

```
1. Run `<cli> --help` — capture output
2. Check: does it list all commands with descriptions?
3. Check: does each subcommand have `--help` with examples?
4. Check: is there a quickstart example in help output?
5. Check: are flags named predictably (--verbose not --v, --output not --o)?
```

Score: 2 points each for: command listing, subcommand help, examples, consistent naming, error on unknown flag.

If no CLI: score as N/A (does not count toward total).

### DX Principle 5: Documentation Navigation

Can a developer find answers in under 60 seconds?

- README has a table of contents or clear section headers
- API endpoints / functions have a reference page or inline docs
- Search works (if docs site): try 3 common queries
- Cross-references between related concepts exist
- No dead links (use `Grep` for `](` patterns and spot-check 5 links)

If `browser-pilot` available: navigate the docs site, time how long to find "how to authenticate" and "how to deploy".

### DX Principle 6: API Consistency

For the top 10 exported functions / API endpoints:

- Naming convention consistent? (all camelCase, or all snake_case — not mixed)
- Return type pattern consistent? (all return `{ data, error }` or all throw — not mixed)
- Parameter ordering consistent? (required first, optional last — across all functions)
- HTTP methods correct? (GET for reads, POST for creates — no GET with side effects)

Score: consistency percentage across the 10 sampled APIs.

### DX Principle 7: Progressive Disclosure

- Simple use case achievable with 1-3 lines of code? (check README examples)
- Advanced config available but not required? (sensible defaults exist)
- Configuration is layered? (env vars → config file → CLI flags → defaults)
- Type hints / IDE completion available? (`d.ts` files, JSDoc, type stubs)

### DX Principle 8: Recovery from Mistakes

- Can the user undo/rollback? (migrations have `down`, deploys have rollback, git-based workflows)
- Do destructive operations have confirmation prompts? (`--force` required for dangerous ops)
- Are error states recoverable? (retry guidance, not just "failed")
- Does `--dry-run` exist for risky operations?

### DX Review Output

```markdown
## DX Review: [Project Name]

| # | Principle | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Time to Hello World | ?/10 | [steps count + blocker if any] |
| 2 | Setup Friction | ?/10 | [friction points found] |
| 3 | Error Messages | ?/10 | [quality level + worst example] |
| 4 | CLI Help | ?/10 | [coverage + gaps] |
| 5 | Doc Navigation | ?/10 | [findability + dead links] |
| 6 | API Consistency | ?/10 | [consistency % + violations] |
| 7 | Progressive Disclosure | ?/10 | [simple path exists? defaults?] |
| 8 | Recovery | ?/10 | [undo/rollback/dry-run support] |
| **Overall DX** | | **?/10** | **[verdict]** |

### Quick Wins (fix in <1 hour)
1. [specific, actionable improvement]
2. [specific, actionable improvement]
3. [specific, actionable improvement]

### Structural Improvements (plan needed)
1. [deeper change needed]
```

Grade thresholds: 9-10 Excellent DX, 7-8 Good DX, 5-6 Fair DX (losing contributors), 3-4 Poor DX (significant barrier), 1-2 Hostile DX.

---
