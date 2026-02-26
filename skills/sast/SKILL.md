---
name: sast
description: "Static analysis tool runner. Wraps ESLint, Semgrep, Bandit, Clippy, and language-specific analyzers with unified severity output. Use when deeper code analysis needed beyond pattern matching."
metadata:
  author: runedev
  version: "1.0.0"
  layer: L3
  model: haiku
  group: validation
---

# sast

## Purpose

Unified static analysis tool runner. While `sentinel` does regex-based security pattern matching and `verification` runs lint/type/test/build, SAST goes deeper — running dedicated static analysis tools that understand data flow, taint tracking, and language-specific vulnerability patterns.

Sentinel catches obvious patterns (hardcoded secrets, SQL string concat). SAST catches subtle ones (tainted data flowing through 3 function calls to a sink, unsafe deserialization behind a wrapper).

## Triggers

- Called by `sentinel` (L2) when deep analysis needed beyond pattern matching
- Called by `audit` (L2) during security dimension assessment
- Called by `cook` (L1) on security-sensitive code (auth, crypto, payments)
- `/rune sast` — manual static analysis scan

## Calls (outbound)

None — pure runner using Bash for all tools.

## Called By (inbound)

- `sentinel` (L2): deep analysis beyond regex patterns
- `audit` (L2): security dimension in full audit
- `cook` (L1): security-sensitive code paths
- `review` (L2): when security patterns detected in diff

## Execution

### Step 1 — Detect Language and Tools

Use `Glob` to detect project language and available tools:

| Indicator | Language | Primary Tool | Fallback |
|---|---|---|---|
| `package.json` | JavaScript/TypeScript | `npx eslint --ext .js,.ts,.tsx` | `npx oxlint` |
| `tsconfig.json` | TypeScript | `npx tsc --noEmit` + ESLint | — |
| `pyproject.toml` / `setup.py` | Python | `bandit -r . -f json` | `ruff check --select S .` |
| `Cargo.toml` | Rust | `cargo clippy -- -D warnings` | `cargo audit` |
| `go.mod` | Go | `govulncheck ./...` | `go vet ./...` |
| `.semgrep.yml` / any | Any | `semgrep --config auto` | — |

Check tool availability:
```
Bash: command -v <tool> 2>/dev/null
→ If not installed: mark as SKIP with install instruction
→ If installed: proceed with scan
```

### Step 2 — Run Primary Analysis

Run the detected primary tool on changed files (or full project if no diff):

```
For each available tool:
  Bash: <tool command> 2>&1
  → Capture stdout + stderr
  → Parse output into unified format (see Step 4)
  → Record: exit code, finding count, execution time
```

**Tool-specific commands:**

```bash
# ESLint (JS/TS) — security-focused rules
npx eslint --no-eslintrc --rule '{"no-eval": "error", "no-implied-eval": "error"}' <files>

# Bandit (Python) — security scanner
bandit -r <path> -f json -ll  # medium+ severity only

# Semgrep (any language) — pattern-based analysis
semgrep --config auto --json --severity ERROR --severity WARNING <path>

# Clippy (Rust) — lint + security
cargo clippy --all-targets -- -D warnings -W clippy::unwrap_used

# govulncheck (Go) — vulnerability check
govulncheck ./...
```

### Step 3 — Run Semgrep (If Available)

Semgrep provides cross-language analysis with community rules. Run regardless of primary language tool:

```
IF semgrep is installed:
  Bash: semgrep --config auto --json <changed-files-or-project>
  → Parse JSON output
  → Map severity: error→BLOCK, warning→WARN, info→INFO
```

If semgrep is NOT installed, log INFO: "semgrep not installed — install with `pip install semgrep` for deeper cross-language analysis."

### Step 4 — Normalize to Unified Format

Map all tool outputs to unified severity:

```
BLOCK (must fix):
  - Bandit: HIGH confidence + HIGH severity
  - ESLint: error-level security rules
  - Semgrep: ERROR severity
  - Clippy: deny-level warnings
  - govulncheck: any known vulnerability

WARN (should fix):
  - Bandit: MEDIUM confidence or MEDIUM severity
  - ESLint: warning-level rules
  - Semgrep: WARNING severity
  - Clippy: warn-level suggestions

INFO (informational):
  - Bandit: LOW severity
  - Semgrep: INFO severity
  - Style/convention suggestions
```

### Step 5 — Report

```
## SAST Report
- **Status**: PASS | WARN | BLOCK
- **Tools Run**: [list with versions]
- **Tools Skipped**: [list with install instructions]
- **Files Scanned**: [count]
- **Findings**: [count by severity]

### BLOCK (must fix)
- `path/to/file.py:42` — [tool] Possible SQL injection via string formatting (B608)
- `path/to/auth.ts:15` — [semgrep] JWT token not verified before use

### WARN (should fix)
- `path/to/utils.py:88` — [bandit] Use of `subprocess` with shell=True (B602)

### INFO
- `path/to/config.ts:10` — [eslint] Prefer `const` over `let` for unchanging variable

### Tool Coverage
| Tool | Status | Findings | Duration |
|------|--------|----------|----------|
| ESLint | RAN | 2 WARN | 1.2s |
| Semgrep | SKIPPED | — | — (not installed) |
| Bandit | N/A | — | — (not Python) |
```

## Constraints

1. MUST run all available tools for the detected language — not just one
2. MUST attempt Semgrep regardless of primary language (if installed)
3. MUST normalize all outputs to unified BLOCK/WARN/INFO — don't dump raw tool output
4. MUST show install instructions for missing tools — not silently skip
5. MUST report which tools ran and which were skipped — transparency
6. MUST NOT block on missing tools — SKIP with instruction, not FAIL

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Tool not installed → entire scan skipped silently | HIGH | Constraint 4: show install instruction, continue with available tools |
| Raw tool output dumped without normalization | MEDIUM | Step 4: always normalize to unified format |
| Only running one tool when multiple apply | MEDIUM | Constraint 1: run ALL available tools for the language |
| Semgrep community rules producing noise | LOW | Filter to ERROR+WARNING severity only — skip INFO-level Semgrep |
| Long-running scan on large codebase | MEDIUM | Run on changed files only when diff available, full scan only on manual invocation |

## Done When

- Language detected from project config files
- All available tools executed (or SKIP with install instruction)
- Findings normalized to unified BLOCK/WARN/INFO format
- Tool coverage table showing what ran and what was skipped
- SAST Report emitted with overall verdict

## Cost Profile

~300-800 tokens input, ~200-500 tokens output. Haiku + Bash commands. Tool execution time varies (1-30s depending on project size).
