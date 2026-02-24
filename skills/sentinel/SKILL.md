---
name: sentinel
description: Automated security gatekeeper. Blocks unsafe code before commit — secret scanning, OWASP top 10, dependency audit, permission checks. A GATE, not a suggestion.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: sonnet
  group: quality
---

# sentinel

## Purpose

Automated security gatekeeper that blocks unsafe code BEFORE commit. Unlike `review` which suggests improvements, sentinel is a hard gate — it BLOCKS on critical findings. Runs secret scanning, OWASP top 10 pattern detection, dependency auditing, and destructive command checks. Escalates to opus for deep security audit when critical patterns detected.

## Triggers

- Called automatically by `cook` before commit phase
- Called by `preflight` as security sub-check
- Called by `deploy` before deployment
- `/rune sentinel` — manual security scan
- Auto-trigger: when `.env`, auth files, or security-critical code is modified

## Calls (outbound)

- `scout` (L2): scan changed files to identify security-relevant code
- `verification` (L3): run security tools (npm audit, pip audit, cargo audit)

## Called By (inbound)

- `cook` (L1): auto-trigger before commit phase
- `review` (L2): when security-critical code detected
- `deploy` (L2): pre-deployment security check
- `preflight` (L2): security sub-check in quality gate

## Workflow

1. **Receive scan request** with list of changed files or full codebase path
2. **Secret scan** — regex patterns for API keys, tokens, credentials, entropy analysis for random strings, .env file reference check
3. **OWASP top 10 scan** — SQL injection patterns, XSS patterns (innerHTML, dangerouslySetInnerHTML), CSRF protection, input validation gaps
4. **Dependency audit** — run package manager audit commands, check for known CVEs, verify license compatibility
5. **Permission check** — detect destructive commands (rm -rf, DROP TABLE), production database access, file operations outside project
6. **Generate report** with severity levels and blocking decisions

## Severity Levels

```
BLOCK    — commit MUST NOT proceed (secrets found, critical CVE, SQL injection)
WARN     — commit can proceed but developer must acknowledge (medium CVE, missing validation)
INFO     — informational finding, no action required (best practice suggestion)
```

## Output Format

```
## Sentinel Report
- **Status**: PASS | WARN | BLOCK
- **Files Scanned**: [count]
- **Findings**: [count by severity]

### BLOCK (must fix)
- `path/to/file.ts:42` — Hardcoded API key detected (pattern: sk-...)
- `path/to/api.ts:15` — SQL injection: string concatenation in query

### WARN (should fix)
- `package.json` — lodash@4.17.20 has known prototype pollution (CVE-2021-23337)

### INFO
- `auth.ts:30` — Consider adding rate limiting to login endpoint

### Verdict
BLOCKED — 2 critical findings must be resolved before commit.
```

## Security Patterns (built-in)

```
# Secret patterns (regex)
AWS_KEY:        AKIA[0-9A-Z]{16}
GITHUB_TOKEN:   gh[ps]_[A-Za-z0-9_]{36,}
GENERIC_SECRET: (?i)(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}
HIGH_ENTROPY:   [A-Za-z0-9+/=]{40,}  (entropy > 4.5)

# OWASP patterns
SQL_INJECTION:  string concat/interpolation in SQL context
XSS:            innerHTML, dangerouslySetInnerHTML, document.write
CSRF:           form without CSRF token, missing SameSite cookie
```

## Cost Profile

~1000-3000 tokens input, ~500-1000 tokens output. Sonnet default, opus for deep audit on critical findings.
