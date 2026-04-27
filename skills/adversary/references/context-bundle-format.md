# Oracle Context Bundle Format

## Purpose

Define the exact, regex-validated format for context bundles dispatched by adversary oracle-mode. Strict format ensures the second model receives consistent input regardless of which primary agent (debug/fix/manual) triggered the dispatch.

## Bundle Structure

```
[SYSTEM] You are Oracle, a focused one-shot problem solver. You have NO prior context — assume zero project knowledge. Cite file:line for every claim. Reject any claim you cannot ground in the provided files.

[USER] <problem statement — see USER section spec below>

### File 1: <relative/path/to/file>
<file content, normalized whitespace, max 4k chars per file>

### File 2: <relative/path/to/file>
<...>

### File N: <relative/path/to/file>
<...>
```

## Section Specs

### `[SYSTEM]` line

**Required**, **exact text**:

```
[SYSTEM] You are Oracle, a focused one-shot problem solver. You have NO prior context — assume zero project knowledge. Cite file:line for every claim. Reject any claim you cannot ground in the provided files.
```

Validation regex: `^\[SYSTEM\] You are Oracle, a focused one-shot problem solver\.`

The framing is invariant. Do not attempt to "improve" it per-call — the second model must receive the same role-priming every time.

### `[USER]` line

**Required**, **template-driven** based on trigger source:

| Source | Template |
|--------|----------|
| `debug` agent.stuck | `[USER] Agent stuck after <N> hypothesis cycles. Disproved: <H1>; <H2>; <H3>. Error: <error_summary>. What is the most likely root cause not yet considered?` |
| `fix` agent.stuck | `[USER] Agent stuck after <N> failed fix attempts on <file>. Each attempt's tests failed with: <test_failure_summary>. What is the most likely cause of the test failure?` |
| Manual | `[USER] <free-form problem statement, max 500 chars>` |

Validation regex: `^\[USER\] .{20,2000}$`

### `### File <N>` blocks

**Optional** (zero files allowed for purely conceptual questions, but typical: 3-12 files).

Format per block:
- Header: `### File <N>: <relative-path>` — N starts at 1, increments by 1
- Body: file content, normalized whitespace (collapse 3+ blank lines to 2, trim trailing whitespace per line)
- Body cap: 4000 characters. If file exceeds, truncate at the most recent line boundary before 4000 chars and append `... [truncated]` on its own line

Validation regex per header: `^### File \d+: [^\n]+$`

## Hard Caps

| Cap | Limit | Behavior on exceed |
|-----|-------|---------------------|
| Total bundle (chars) | 400,000 (~100k tokens) | Reject before dispatch — `oracle.failed` reason=`bundle_too_large` |
| Per file (chars) | 4,000 | Truncate with `... [truncated]` marker |
| File count | 12 | Reject before dispatch — caller MUST prune via `context.preview` first |
| `[USER]` length | 2,000 chars | Truncate at sentence boundary |

## Whitespace Normalization

Applied to every file body:

1. Replace `\r\n` with `\n`
2. Collapse 3+ consecutive newlines into 2 (`\n\n\n+` → `\n\n`)
3. Trim trailing whitespace on each line (preserve indentation)
4. Remove tab characters from line ends only (preserve leading tabs)

Code blocks (lines between matching ` ``` ` fences) are exempt from collapse — preserve internal blank lines exactly.

## Forbidden Content

The following content MUST be stripped before bundle build:

- Lines matching `process\.env\.[A-Z_]+\s*=\s*["'][^"']+["']` (env-var assignments with secrets)
- Lines matching `(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']` (hardcoded creds)
- Lines matching `Authorization:\s*Bearer\s+\S{20,}` (auth headers in test fixtures)

If any match found: replace value with `<REDACTED>` and continue. Do not abort dispatch — bundle still useful for diagnosis with credentials redacted.

## Reply Contract (validation post-dispatch)

The Oracle reply MUST satisfy:

1. **Diagnosis present** — at least one paragraph stating primary cause
2. **Citations present** — at least 1 `<file>:<line>` reference per non-trivial claim
3. **Citations valid** — every cited file appears in the bundle's `### File N` blocks
4. **Recommendation present** — concrete next action (specific edit, file to read, hypothesis to test)
5. **No "I am unable to" responses** — if Oracle truly cannot diagnose, it MUST say "Insufficient context" + name what additional file/info would help

Failures of (1)-(4) emit `oracle.failed` with the corresponding reason.
Failure of (5) accepted but downgrades `oracle.response.confidence` to `low`.

## Example (compact)

```
[SYSTEM] You are Oracle, a focused one-shot problem solver. You have NO prior context — assume zero project knowledge. Cite file:line for every claim. Reject any claim you cannot ground in the provided files.

[USER] Agent stuck after 3 hypothesis cycles. Disproved: race condition on user.session; stale cache in middleware; bad type cast in handler. Error: 401 Unauthorized intermittent on POST /api/orders. What is the most likely root cause not yet considered?

### File 1: src/api/orders.ts
import { auth } from './middleware/auth';
... [content] ...

### File 2: src/middleware/auth.ts
... [content] ...

### File 3: src/services/session.ts
... [content] ...
```

The reply, post-validation, becomes the payload of `oracle.response`.
