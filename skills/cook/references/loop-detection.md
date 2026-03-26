# Hash-Based Loop Detection — Content-Aware Stuck Detection

The Analysis Paralysis Guard (5-read counter in SKILL.md) catches obvious paralysis.
This catches **same-input-same-output loops** — where the agent keeps calling the same tool
with the same arguments and getting the same result, making zero progress.

Source: goclaw (832★) — SHA256-based loop detection distinguishes true stuck loops from productive retries.

## Detection Logic

Track mentally (no actual SHA256 required):

```
For each tool call, track:
  argsHash = fingerprint(tool_name + arguments)
  resultHash = fingerprint(result content)

IF same argsHash AND same resultHash seen before:
  consecutive_identical += 1
ELSE:
  consecutive_identical = 0

Thresholds:
  3 identical calls → WARN: "Loop detected — same tool, same args, same result 3x. Change approach."
  5 identical calls → FORCE STOP: "True stuck loop. Must try different tool or different arguments."
```

## Key Distinction

Retry-with-different-result is **NOT** a loop (e.g., re-running tests after a fix).
Only same-input-AND-same-output counts.

## Common Loop Patterns

| Pattern | Looks Like | Actually |
|---------|-----------|----------|
| Re-reading same file after failed edit | `Read(file.ts)` → same content 3x | Agent forgot what it read — act on existing knowledge |
| Re-running same failing test without code change | `Bash(npm test)` → same failure 3x | No code was changed between runs — fix first, then test |
| Grepping same pattern across different paths | `Grep("pattern", src/)` → `Grep("pattern", lib/)` → same 0 results | Pattern doesn't exist — change search terms |
