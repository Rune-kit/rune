---
name: sentinel
description: Automated security gatekeeper. Blocks unsafe code before commit — secret scanning, OWASP top 10, dependency audit, permission checks. A GATE, not a suggestion.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L2
  model: sonnet
  group: quality
  tools: "Read, Bash, Glob, Grep"
---

# sentinel

## Purpose

Automated security gatekeeper that blocks unsafe code BEFORE commit. Unlike `review` which suggests improvements, sentinel is a hard gate — it BLOCKS on critical findings. Runs secret scanning, OWASP top 10 pattern detection, dependency auditing, and destructive command checks. Escalates to opus for deep security audit when critical patterns detected.

<HARD-GATE>
If status is BLOCK, output the report and STOP. Do not hand off to commit. The calling skill (`cook`, `preflight`, `deploy`) must halt until the developer fixes all BLOCK findings and re-runs sentinel.
</HARD-GATE>

## Triggers

- Called automatically by `cook` before commit phase
- Called by `preflight` as security sub-check
- Called by `deploy` before deployment
- `/rune sentinel` — manual security scan
- Auto-trigger: when `.env`, auth files, or security-critical code is modified

## Calls (outbound)

- `scout` (L2): scan changed files to identify security-relevant code
- `verification` (L3): run security tools (npm audit, pip audit, cargo audit)
- `integrity-check` (L3): agentic security validation of .rune/ state files
- `sast` (L3): deep static analysis with Semgrep, Bandit, ESLint security rules

## Called By (inbound)

- `cook` (L1): auto-trigger before commit phase
- `review` (L2): when security-critical code detected
- `deploy` (L2): pre-deployment security check
- `preflight` (L2): security sub-check in quality gate
- `audit` (L2): Phase 2 full security audit
- `incident` (L2): security dimension check during incident response
- `review-intake` (L2): security scan on code submitted for structured review

## Severity Levels

```
BLOCK    — commit MUST NOT proceed (secrets found, critical CVE, SQL injection)
WARN     — commit can proceed but developer must acknowledge (medium CVE, missing validation)
INFO     — informational finding, no action required (best practice suggestion)
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

## Executable Steps

### Step 1 — Secret Scan (Gitleaks-Enhanced)

Use `Grep` to search all changed files (or full codebase if no diff available) for secret patterns.

**1a. Current file scan:**
- Patterns: `sk-`, `AKIA`, `ghp_`, `ghs_`, `-----BEGIN`, `password\s*=\s*["']`, `secret\s*=\s*["']`, `api_key\s*=\s*["']`, `token\s*=\s*["']`
- Also scan for `.env` file contents committed directly (grep for lines matching `KEY=value` outside `.env` files)
- Flag any string with entropy > 4.5 and length > 40 characters as HIGH_ENTROPY candidate

**1b. Extended gitleaks patterns:**
```
SLACK_TOKEN:      xox[bpors]-[0-9a-zA-Z]{10,}
STRIPE_KEY:       [sr]k_(live|test)_[0-9a-zA-Z]{24,}
SENDGRID:         SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}
TWILIO:           SK[0-9a-fA-F]{32}
FIREBASE:         AIza[0-9A-Za-z_-]{35}
PRIVATE_KEY:      -----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
JWT:              eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}
GENERIC_API_KEY:  (?i)(apikey|api_key|api-key)\s*[:=]\s*["'][A-Za-z0-9_-]{16,}
```

**1c. Git history scan (first run only):**
If this is the first sentinel scan on this repo (no `.rune/sentinel-baseline.md` exists):
```
Bash: git log --all --diff-filter=A -- '*.env*' '*.key' '*.pem' '*.p12' '*credentials*' '*secret*'
→ If any results: WARN — historical secret files detected. Recommend BFG/git-filter-repo cleanup.
```

For subsequent runs, scan only the current diff (incremental).

Any match = **BLOCK**. Do not proceed to later steps if BLOCK findings exist — report immediately.

### Step 2 — Dependency Audit
Use `Bash` to run the appropriate audit command for the detected package manager:
- npm/pnpm/yarn: `npm audit --json` (parse JSON, extract critical + high severity)
- Python: `pip-audit --format=json` (if installed) or `safety check`
- Rust: `cargo audit --json`
- Go: `govulncheck ./...`

Critical CVE (CVSS >= 9.0) = **BLOCK**. High CVE (CVSS 7.0–8.9) = **WARN**. Medium/Low = **INFO**.

If audit tool is not installed, log **INFO**: "audit tool not found, skipping dependency check" — do NOT block on missing tooling.

### Step 3 — OWASP Check
Use `Read` to scan changed files for:
- **SQL Injection**: string concatenation or interpolation inside SQL query strings (e.g., `"SELECT * FROM users WHERE id = " + userId`, f-strings with SQL). Flag = **BLOCK**
- **XSS**: `innerHTML =`, `dangerouslySetInnerHTML`, `document.write(` with non-static content. Flag = **BLOCK**
- **CSRF**: HTML `<form>` elements without CSRF token fields; `Set-Cookie` headers without `SameSite`. Flag = **WARN**
- **Missing input validation**: new route handlers or API endpoints that directly pass `req.body` / `request.json()` to a database call without a validation schema. Flag = **WARN**

**SQL Injection examples:**
```python
# BAD — string interpolation in SQL → BLOCK
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
query = "SELECT * FROM users WHERE name = '" + name + "'"
# GOOD — parameterized query
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

**XSS examples:**
```typescript
// BAD — renders raw user content → BLOCK
element.innerHTML = userComment;
<div dangerouslySetInnerHTML={{ __html: userInput }} />
// GOOD — safe alternatives
element.textContent = userComment;
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

**Input validation examples:**
```typescript
// BAD — raw body to DB → WARN
app.post('/users', async (req, res) => { await db.users.create(req.body); });
// GOOD — validate at boundary
app.post('/users', async (req, res) => {
  const validated = CreateUserSchema.parse(req.body);
  await db.users.create(validated);
});
```

### Step 4 — Permission Check
Use `Grep` to scan for:
- Destructive shell commands in scripts: `rm -rf /`, `DROP TABLE`, `DELETE FROM` without `WHERE`, `TRUNCATE`
- File operations using absolute paths outside the project root (e.g., `/etc/`, `/usr/`, `C:\Windows\`)
- Direct production database connection strings (e.g., `prod`, `production` in DB host names)

Destructive command on production path = **BLOCK**. Suspicious path = **WARN**.

### Step 4.5 — Framework-Specific Security Patterns

Apply only if the framework is detected in changed files:

**Django** (detect: `django` in requirements or imports)
- `DEBUG = True` in non-development settings → **BLOCK**
- Missing `permission_classes` on ModelViewSet → **WARN**
- CSRF middleware removed from `MIDDLEWARE` list → **BLOCK**

**React / Next.js** (detect: `.tsx` / `.jsx` files)
- JWT stored in `localStorage` instead of `httpOnly` cookie → **WARN**
- `dangerouslySetInnerHTML` without `DOMPurify.sanitize()` → **BLOCK**

**Node.js / Express / Fastify** (detect: `express`, `fastify` imports)
- CORS set to `origin: '*'` on authenticated endpoints → **WARN**
- Missing `helmet` middleware for HTTP security headers → **WARN**

**Python** (detect: `.py` files)
- `pickle.loads(user_input)` or `eval(user_expression)` → **BLOCK**
- `yaml.load()` without `Loader` arg (uses unsafe loader) → **WARN**

### Step 4.6 — Config Protection (3-Layer Defense)

Detect attempts to weaken code quality or security configurations. Agents and developers sometimes disable checks to "fix" build errors — sentinel blocks this.

**Layer 1 — Linter/Formatter Config Drift:**
Scan diff for changes to these files:
- `.eslintrc*`, `eslint.config.*`, `biome.json` → rules disabled or removed
- `tsconfig.json` → `strict` changed to `false`, `any` allowed, `skipLibCheck` added
- `ruff.toml`, `.ruff.toml`, `pyproject.toml [tool.ruff]` → rules removed from select list
- `.prettierrc*` → significant format changes without team discussion

Detection patterns:
```
# ESLint rule disable
"off" or 0 in rule config (compare with previous)
// eslint-disable added to >3 lines in same file

# TypeScript strictness weakening
"strict": false
"noImplicitAny": false
"skipLibCheck": true (added, not already present)

# Ruff rule removal
select = [...] with fewer rules than before
```

Match = **WARN** with message: "Config change weakens code quality — verify this is intentional."

**Layer 2 — Security Middleware Removal:**
Scan for removal of security-critical middleware/imports:
- `helmet` removed from Express/Fastify middleware chain
- `csrf` middleware removed or commented out
- `cors` configuration changed to `origin: '*'`
- `SecurityMiddleware` removed from Django `MIDDLEWARE`
- `@csrf_protect` decorator removed from Django views

Match = **BLOCK** with message: "Security middleware removed — this must be explicitly justified."

**Layer 3 — CI/CD Safety Bypass:**
Scan for weakening of CI/CD safety checks:
- `--no-verify` added to git commands in scripts
- `--force` added to deployment scripts
- Test steps removed or marked `continue-on-error: true`
- Coverage thresholds lowered

Match = **WARN** with message: "CI safety check weakened — verify this is intentional."

### Step 4.7 — Agentic Security Scan

If `.rune/` directory exists in the project, invoke `integrity-check` (L3) to scan for adversarial content:

```
REQUIRED SUB-SKILL: rune:integrity-check
→ Invoke integrity-check on all .rune/*.md files + any state files in the commit diff.
→ Capture: status (CLEAN | SUSPICIOUS | TAINTED), findings list.
```

Map integrity-check results to sentinel severity:
- `TAINTED` → sentinel **BLOCK** (adversarial content in state files)
- `SUSPICIOUS` → sentinel **WARN** (review recommended before commit)
- `CLEAN` → no additional findings

If `.rune/` directory does not exist, skip this step (log INFO: "no .rune/ state files, agentic scan skipped").

### Step 5 — Report
Aggregate all findings. Apply the verdict rule:
- Any **BLOCK** finding → overall status = **BLOCK**. List all BLOCK items first.
- No BLOCK but any **WARN** → overall status = **WARN**. Developer must acknowledge each WARN.
- Only **INFO** → overall status = **PASS**.

If status is BLOCK, output the report and STOP. Do not hand off to commit. The calling skill (`cook`, `preflight`, `deploy`) must halt until the developer fixes all BLOCK findings and re-runs sentinel.

### WARN Acknowledgment Protocol

WARN findings do not block the commit but MUST be explicitly acknowledged:

```
For each WARN item, developer must respond with one of:
  - "ack" — acknowledged, will fix later (logged to .rune/decisions.md)
  - "fix" — fixing now (sentinel re-runs after fix)
  - "wontfix [reason]" — intentional, with documented reason

Silent continuation past WARN = VIOLATION.
The calling skill (cook) must present WARNs and wait for acknowledgment.
```

### Step 5 — Domain Hook Templates

Generate domain-specific pre-commit hook scripts when requested. These hooks run as git pre-commit hooks and enforce domain-level quality gates BEFORE code enters the repository.

#### Hook Architecture

```
hooks/
├── pre-commit-security.sh      # Always — secret scan, OWASP basics (generated by sentinel)
├── pre-commit-<domain>.sh      # Domain-specific — generated on request
└── validate-<domain>.py        # Complex validation scripts (Python for portability)
```

#### Hook Generation Rules

1. **Exit 0 if no relevant files staged** — prevents false positives when committing unrelated changes
2. **ERRORS block commit** (exit 1) — critical violations that must be fixed
3. **WARNINGS alert but allow** (exit 0 with stderr) — non-critical issues the developer should review
4. **List specific files and line numbers** — actionable output, not vague warnings
5. **Fast execution** (<5 seconds) — hooks that slow down commits get disabled by developers

#### Domain Hook Template

```bash
#!/usr/bin/env bash
# Pre-commit hook: <domain> quality gate
# Generated by rune:sentinel — do not edit manually

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
DOMAIN_FILES=$(echo "$STAGED_FILES" | grep -E '<file-pattern>')

# Exit early if no relevant files staged
if [ -z "$DOMAIN_FILES" ]; then
  exit 0
fi

ERRORS=0
WARNINGS=0

for file in $DOMAIN_FILES; do
  # ERROR checks (block commit)
  # <domain-specific-error-patterns>

  # WARNING checks (alert only)
  # <domain-specific-warning-patterns>
done

if [ $ERRORS -gt 0 ]; then
  echo "❌ $ERRORS error(s) found — commit blocked. Fix before retrying."
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo "⚠️  $WARNINGS warning(s) found — review recommended."
fi

exit 0
```

#### Built-in Domain Hook Patterns

| Domain | File Pattern | ERROR Checks | WARNING Checks |
|--------|-------------|-------------|----------------|
| **Schema/API** | `*.graphql`, `*.proto`, `openapi.*` | Breaking field removal, type changes | Deprecated field usage |
| **Database** | `migrations/*.sql`, `*.migration.*` | DROP TABLE without backup, DELETE without WHERE | Missing rollback script |
| **Config** | `*.env*`, `*config*`, `tsconfig*` | Secrets in config, strict mode disabled | New env var without docs |
| **Dependencies** | `package.json`, `requirements.txt`, `Cargo.toml` | Known vulnerable version pinned | Major version bump without changelog |
| **Legal/Compliance** | `docs/policies/*`, `PRIVACY*`, `TERMS*` | Placeholder text ([Company Name], [Date]) | Review date >12 months old |
| **Financial** | `**/invoice*`, `**/billing*`, `**/payment*` | Hardcoded prices/rates, missing decimal precision | Currency without locale formatting |

When a pack or skill requests domain hooks (via `sentinel` integration), generate the appropriate hook script using the template above, customized with domain-specific patterns.

## Output Format

```
## Sentinel Report
- **Status**: PASS | WARN | BLOCK
- **Files Scanned**: [count]
- **Findings**: [count by severity]

### BLOCK (must fix before commit)
- `path/to/file.ts:42` — Hardcoded API key detected (pattern: sk-...)
- `path/to/api.ts:15` — SQL injection: string concatenation in query

### WARN (must acknowledge)
- `package.json` — lodash@4.17.20 has known prototype pollution (CVE-2021-23337, CVSS 7.4)

### INFO
- `auth.ts:30` — Consider adding rate limiting to login endpoint

### Verdict
BLOCKED — 2 critical findings must be resolved before commit.
```

## Constraints

1. MUST scan ALL files in scope — not just the file the user pointed at
2. MUST check: hardcoded secrets, SQL injection, XSS, CSRF, auth bypass, path traversal
3. MUST list every file checked in the report — "no issues found" requires proof of what was examined
4. MUST NOT say "the framework handles security" as justification for skipping checks
5. MUST NOT say "this is an internal tool" as justification for reduced security
6. MUST flag any .env, credentials, or key files found in git-tracked directories
7. MUST use opus model for security-critical code (auth, crypto, payments)

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| False positive on test fixtures with fake secrets | MEDIUM | Verify file path — `test/`, `fixtures/`, `__mocks__/` patterns; check string entropy |
| Skipping framework checks because "the framework handles it" | HIGH | CONSTRAINT blocks this rationalization — apply checks regardless |
| Dependency audit tool missing → silently skipped | LOW | Report INFO "tool not found, skipping" — never skip silently |
| Stopping after first BLOCK without aggregating all findings | MEDIUM | Complete ALL steps, aggregate ALL findings, then report — developer needs the full list |
| Missing agentic security scan when .rune/ exists | HIGH | Step 4.7 is mandatory when .rune/ directory detected — never skip |
| Domain hook too slow (>5s) → developers disable it | MEDIUM | Keep hooks fast — grep-based patterns only, no network calls. Complex validation goes in CI, not pre-commit |
| Domain hook blocks on test fixtures / mock data | MEDIUM | Check file path context — `test/`, `fixtures/`, `__mocks__/` directories get relaxed rules |

## Done When

- All files in scope scanned for secret patterns
- OWASP checks applied (SQL injection, XSS, CSRF, input validation)
- Dependency audit ran (or "tool not found" reported as INFO)
- Framework-specific checks applied for every detected framework
- Structured report emitted with PASS / WARN / BLOCK verdict and all files scanned listed

## Cost Profile

~1000-3000 tokens input, ~500-1000 tokens output. Sonnet default, opus for deep audit on critical findings.
