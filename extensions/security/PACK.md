---
name: "@rune/security"
description: Deep security analysis — OWASP audit, penetration testing patterns, secret management, compliance checking, supply chain security, and API hardening.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: "$15"
  target: Security engineers
tools:
  - Read
  - Grep
  - Bash
  - Edit
  - Write
---

# @rune/security

## Purpose

@rune/security delivers manual-grade security analysis for teams that need more than an automated gate. Where `sentinel` (L2) runs fast checks on every commit, this pack runs thorough, on-demand audits: threat modeling entire auth flows, mapping real attack surfaces, designing vault strategies, auditing supply chain integrity, hardening API surfaces, and producing compliance audit trails. All six skills share the same threat mindset — assume breach, prove safety, document evidence.

## Triggers

- `/rune security` — manual invocation, full pack audit
- `/rune owasp-audit` | `/rune pentest-patterns` | `/rune secret-mgmt` | `/rune compliance` | `/rune supply-chain` | `/rune api-security` — single skill invocation
- Called by `cook` (L1) when auth, crypto, payment, or PII-handling code is detected
- Called by `review` (L2) when security-critical patterns are flagged during code review
- Called by `deploy` (L2) before production releases when security scope is active

## Skills Included

### owasp-audit

Deep OWASP Top 10 (2021) + API Security Top 10 (2023) audit — goes beyond sentinel's automated checks with manual code review of authentication flows, session management, access control logic, cryptographic patterns, and CI/CD pipeline security. Produces exploitability-rated findings.

#### Workflow

**Step 1 — Threat Model**
Use Read to load entry points (routes, controllers, middleware). Map which OWASP categories apply to this codebase (A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A07 Auth Failures, A08 Software and Data Integrity Failures). Build a risk matrix before touching any code. Tag each route with applicable threat categories.

**Step 2 — Manual Code Review (OWASP Web Top 10)**
Use Grep to locate auth middleware, session setup, role checks, and crypto calls. Read each file. Manually verify: Are authorization checks applied consistently? Are sessions invalidated on logout? Are crypto primitives current (no MD5/SHA1 for passwords)? Check deserialization endpoints for A08 — untrusted data deserialized without type constraints is a critical integrity failure.

**Step 3 — CI/CD Pipeline Security Check**
Audit GitHub Actions / GitLab CI / Bitbucket Pipelines yaml files. Check for: expression injection in `run:` steps using untrusted `${{ github.event.* }}` context, env variables printed in logs, third-party actions pinned to mutable tags (use SHA pins), overly broad `permissions:` blocks, secrets exposed via `env:` at workflow level instead of step level.

**Step 4 — OWASP API Security Top 10 (2023)**
Specifically check:
- **API1:2023 BOLA** — does every object-level endpoint verify the requesting user owns/has permission for that specific resource ID?
- **API2:2023 Broken Authentication** — are API keys rotatable? Are JWTs validated (signature, expiry, audience claim)?
- **API5:2023 Broken Function Level Authorization** — are admin/internal API functions gated by role, not just authentication? Can a regular user reach `/admin/*` or `/internal/*` endpoints by guessing paths?
- **A08:2021 Integrity Failures** — are deserialized payloads schema-validated before use? Are CI/CD pipelines pulling unverified artifacts?

**Step 5 — Verify Exploitability and Report**
For each finding, confirm it is reachable from an unauthenticated or low-privilege context. Rate severity (CRITICAL/HIGH/MEDIUM/LOW). Emit a structured report with file:line references and concrete remediation steps.

#### Example

```typescript
// FINDING: API1:2023 BOLA — missing object-level ownership check
// File: src/routes/documents.ts, Line: 28

// VULNERABLE: fetches document by ID without verifying ownership
router.get('/documents/:id', requireAuth, async (req, res) => {
  const doc = await db.documents.findById(req.params.id) // any user can fetch any doc
  res.json(doc)
})

// REMEDIATION: filter by both id AND authenticated user
router.get('/documents/:id', requireAuth, async (req, res) => {
  const doc = await db.documents.findOne({
    id: req.params.id,
    ownerId: req.user.id,  // enforces ownership at query level
  })
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

// FINDING: CI/CD injection — GitHub Actions workflow
// File: .github/workflows/pr-check.yml, Line: 14
// VULNERABLE: untrusted PR title interpolated directly into run: step
//   run: echo "PR: ${{ github.event.pull_request.title }}"
// REMEDIATION: assign to env var first — GitHub sanitizes env var expansion
//   env:
//     PR_TITLE: ${{ github.event.pull_request.title }}
//   run: echo "PR: $PR_TITLE"
```

---

### pentest-patterns

Penetration testing methodology — attack surface mapping, vulnerability identification, proof-of-concept construction, automated fuzzing setup, JWT attack pattern detection, GraphQL hardening, and remediation verification. Outputs actionable PoC code, not just advisories.

#### Workflow

**Step 1 — Map Attack Surface**
Use Grep to enumerate all HTTP endpoints, WebSocket handlers, file upload paths, and external-facing inputs. List trust boundaries: what data crosses from client to server without validation? Identify highest-value targets (auth endpoints, admin APIs, payment flows). Note GraphQL endpoints — they require separate analysis.

**Step 2 — Identify and Construct PoC**
For each attack vector, use Read to inspect input handling. Write minimal PoC code (curl command, script, or payload) that demonstrates the vulnerability — SSRF via URL parameter, SQL injection via unsanitized filter, IDOR via predictable ID enumeration. Keep PoCs minimal and clearly scoped to the finding.

**Step 3 — JWT Attack Pattern Review**
Inspect all JWT creation and validation code. Check for:
- **Algorithm confusion (alg:none)** — does the validator accept `"alg":"none"` tokens?
- **Key confusion (RS256 → HS256)** — if the public key is accessible, can an attacker sign HS256 tokens with it?
- **Token replay** — is `jti` (JWT ID) tracked and blacklisted on logout? Is token expiry enforced server-side, not just client-side?
- **Audience/issuer validation** — are `aud` and `iss` claims verified to prevent cross-service token reuse?

**Step 4 — Automated Fuzzing Setup**
Use property-based testing to fuzz input boundaries. Set up `fast-check` (TypeScript) or `hypothesis` (Python) to generate adversarial inputs for parsers, validators, and business logic. Focus on: integer overflows in numeric fields, Unicode normalization in string comparisons, path traversal in file name parameters, prototype pollution in object merge operations.

**Step 5 — GraphQL Security Review**
If a GraphQL endpoint exists: Is introspection disabled in production? Are deeply nested queries limited (max depth/complexity)? Are batch queries rate-limited independently? Check for field-level authorization — a resolver that returns user data must enforce the same ownership checks as a REST equivalent.

**Step 6 — Suggest Remediation and Verify Fix**
Pair each PoC with a concrete fix. After fix is applied, use Bash to re-run the PoC and confirm it no longer succeeds. Document the before/after in the security report.

#### Example

```typescript
// FINDING: SSRF — user-supplied URL fetched server-side without allowlist
// File: src/api/webhook.ts, Line: 34

// VULNERABLE: attacker can probe internal services
const response = await fetch(req.body.callbackUrl)
// POC: curl -X POST /api/webhook -d '{"callbackUrl":"http://169.254.169.254/latest/meta-data/"}'

// REMEDIATION: validate against allowlist before fetching
const ALLOWED_HOSTS = new Set(['api.partner.com', 'hooks.stripe.com'])
const parsed = new URL(req.body.callbackUrl)
if (!ALLOWED_HOSTS.has(parsed.hostname)) {
  throw new ForbiddenError('callbackUrl host not in allowlist')
}

// FINDING: JWT algorithm confusion
// File: src/middleware/auth.ts, Line: 19
// VULNERABLE: accepts any algorithm the token declares
import jwt from 'jsonwebtoken'
const payload = jwt.verify(token, secret) // no algorithm pin

// REMEDIATION: pin algorithm explicitly
const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })

// FUZZING SETUP: fast-check for path traversal in file name param
import * as fc from 'fast-check'
fc.assert(
  fc.property(fc.string(), (filename) => {
    const result = sanitizeFilename(filename)
    return !result.includes('..') && !result.includes('/')
  })
)

// GRAPHQL: max depth guard (graphql-depth-limit)
import depthLimit from 'graphql-depth-limit'
const server = new ApolloServer({
  validationRules: [depthLimit(5)],
})
```

---

### secret-mgmt

Secret management patterns — audit current secret handling, design vault or environment strategy, implement rotation policies, detect secrets in pre-commit hooks, and verify zero leaks in logs, errors, and source history.

#### Workflow

**Step 1 — Scan Current Secret Handling**
Use Grep to search for hardcoded credentials, API keys, connection strings, and JWT secrets across all source files and config files. Check git history with Bash (`git log -S 'password' --source --all`) to surface secrets ever committed. Catalog every secret by type and location. Check for base64-encoded secrets (`grep -r 'base64' | grep -i 'key\|secret\|pass'`).

**Step 2 — Design Vault or Env Strategy**
Based on project type (serverless, container, bare metal), prescribe a secret backend: AWS Secrets Manager, HashiCorp Vault, Doppler, or `.env` + CI/CD injection. Define which secrets are per-environment vs per-service. Write the access pattern (IAM role, token scope, least privilege).

**Step 3 — .env File Safety Audit**
Verify `.env` and `.env.*` files are in `.gitignore`. Check that a `.env.example` exists with placeholder values (not real secrets). Audit CI/CD environment variable lists — flag any variable that contains `SECRET`, `KEY`, `TOKEN`, or `PASSWORD` that is not masked. Verify `.env.example` is kept in sync with application startup validation schema.

**Step 4 — Secret Rotation Automation**
Document rotation schedule per secret type. For AWS: use Secrets Manager rotation Lambda triggered on schedule. For GitHub Actions: document secret rotation runbook (rotate in provider → update in repo Settings → verify deployment). Add startup validation that fails fast if any required env var is absent or malformed. Set up gitleaks or trufflehog as pre-commit hook to catch accidental commits before they hit remote.

**Step 5 — Verify No Leaks in Runtime**
Use Grep to confirm secrets never appear in log statements, error responses, or exception stack traces. Check error serialization — does the global error handler accidentally serialize `process.env` or full request headers into the response body?

#### Example

```typescript
// PATTERN: startup validation — fail fast on missing secrets
import { z } from 'zod'

const SecretsSchema = z.object({
  DATABASE_URL:    z.string().url(),
  JWT_SECRET:      z.string().min(32),
  STRIPE_SECRET:   z.string().startsWith('sk_'),
  OPENAI_API_KEY:  z.string().startsWith('sk-'),
})

export const secrets = SecretsSchema.parse(process.env) // throws at boot if absent/malformed

// NEVER log secrets — use masked representation
logger.info(`DB connected to ${new URL(secrets.DATABASE_URL).hostname}`)

// PRE-COMMIT: .gitleaks.toml — scan for secrets before commit
// [[rules]]
// id = "generic-api-key"
// description = "Generic API Key"
// regex = '''(?i)(api_key|apikey|secret)[^\w]*[=:]\s*['"]?[0-9a-zA-Z\-_]{16,}'''
// entropy = 3.5

// ROTATION LAMBDA: AWS Secrets Manager rotation handler skeleton
export async function handler(event: SecretsManagerRotationEvent) {
  const { SecretId, ClientRequestToken, Step } = event
  switch (Step) {
    case 'createSecret':  await createNewVersion(SecretId, ClientRequestToken); break
    case 'setSecret':     await updateDownstreamService(SecretId, ClientRequestToken); break
    case 'testSecret':    await validateNewSecret(SecretId, ClientRequestToken); break
    case 'finishSecret':  await finalizeRotation(SecretId, ClientRequestToken); break
  }
}
```

---

### compliance

Compliance checking — identify applicable standards (SOC 2, GDPR, HIPAA, PCI-DSS v4.0), map requirements to code patterns, perform gap analysis, automate evidence collection, and generate audit-ready evidence packages.

#### Workflow

**Step 1 — Identify Applicable Standards**
Read project README, data model, and infrastructure config to determine which standards apply: does the app handle health data (HIPAA), payment card data (PCI-DSS v4.0), EU personal data (GDPR 2016/679), or serve enterprise customers (SOC 2 Type II)? Output a compliance scope document before analysis. Reference standard versions explicitly to prevent stale guidance.

**Step 2 — Map Requirements to Code**
Use Grep to locate data retention logic, consent flows, access logging, encryption at rest/transit, and data deletion endpoints. Cross-reference each requirement against actual implementation. For each gap, record: requirement (with section number), current state, risk level, and remediation effort estimate.

**Step 3 — Generate Audit Trail**
Use Read to verify logging coverage on sensitive operations (login, data export, admin actions, PII access). Confirm logs are tamper-evident, include actor identity and timestamp, and are retained for required duration. Emit a structured compliance report suitable for auditor review.

**Step 4 — Automated Evidence Collection**
For SOC 2 / PCI-DSS audits: automate evidence gathering rather than manual screenshots. Export access logs covering the audit period. Generate a cryptographically signed summary of security controls in place (encryption algorithms, TLS versions, auth mechanisms). For PCI-DSS v4.0 specifically: document Targeted Risk Analysis (TRA) for each customized approach control, verify MFA is enforced on ALL access to the cardholder data environment (not just admin accounts — PCI v4.0 requires it universally), and document compensating controls where requirements cannot be met natively.

**Step 5 — Gap Report and Remediation Roadmap**
For each compliance gap: assign severity (blocker for certification vs. advisory), estimated remediation effort (hours), and owner. Output a prioritized remediation roadmap with estimated time-to-compliance.

#### Example

```typescript
// PATTERN: GDPR-compliant audit trail for PII access
interface AuditEvent {
  eventId:    string      // UUID, immutable
  actor:      string      // userId or serviceAccount
  action:     string      // 'READ_PII' | 'EXPORT_DATA' | 'DELETE_USER'
  resource:   string      // 'users/{id}'
  timestamp:  string      // ISO 8601 UTC
  ip:         string      // requestor IP for breach tracing
  outcome:    'SUCCESS' | 'DENIED'
}

// Log to append-only store — never DELETE or UPDATE audit rows
async function logAuditEvent(event: AuditEvent): Promise<void> {
  await db.auditLog.create({ data: event })
  // Also emit to SIEM (Splunk, Datadog) for real-time alerting
}

// PATTERN: PCI-DSS v4.0 — MFA enforcement check at login
// Verify ALL users (not just admin) are challenged with MFA
// Gap example: MFA only on /admin routes → FAIL for PCI v4.0 Req 8.4.2
async function authenticateUser(credentials: LoginDto): Promise<AuthResult> {
  const user = await verifyPassword(credentials)
  // PCI v4.0 Req 8.4.2: MFA required for ALL interactive logins to CDE
  const mfaRequired = isInCDE(user) // must be true for any CDE-touching user
  if (mfaRequired && !credentials.mfaToken) {
    throw new UnauthorizedError('MFA required')
  }
  return issueSession(user)
}

// EVIDENCE COLLECTION: export access log summary for SOC 2 auditor
// bash: aws cloudtrail lookup-events \
//   --start-time $(date -d '90 days ago' +%s) \
//   --query 'Events[*].{Time:EventTime,User:Username,Action:EventName}' \
//   --output json > soc2-evidence-access-log.json
```

---

### supply-chain

Supply chain security analysis — detect dependency confusion attacks, typosquatting, lockfile injection, manifest confusion, and verify SLSA provenance attestations. Generates a complete supply chain risk report.

#### Workflow

**Step 1 — Inventory Dependencies**
Use Read on `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`. Build a complete dependency graph including devDependencies and indirect (transitive) dependencies via `npm ls --all --json` or `pip-audit --format json`. Flag phantom dependencies — packages used in source code (via import) but not declared in the manifest.

**Step 2 — Check Naming Collisions (Dependency Confusion)**
For any private/internal package names (scoped like `@company/internal-lib` OR unscoped names that look internal), verify they also exist on the public registry (npm, PyPI, RubyGems). If a package name is registered internally but NOT on the public registry, an attacker can register it there — package managers may prefer the public version depending on configuration. Flag all such packages for private registry enforcement.

**Step 3 — Typosquatting Detection**
Compare each dependency name against a known-popular packages list. Flag names with edit distance ≤ 2 from a popular package: `lodas` (lodash), `requets` (requests), `coloers` (colors), `expres` (express). Also flag: packages with unusual character substitution (zero vs letter o, l vs 1), recently published packages with very high download counts but no GitHub stars, and packages with install scripts that execute shell commands.

**Step 4 — Verify Lockfile Integrity**
Check that `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` exists and is committed. Verify resolved hashes match between manifest and lockfile. Detect lockfile injection: compare resolved URLs — any `file:`, `git+`, or non-registry URL in the lockfile for a package expected to come from the registry is a red flag. Run `npm audit signatures` (npm ≥ 9.5) to verify package signatures against the registry's public key.

**Step 5 — Audit Transitive Dependencies and Known Malicious Packages**
Run `npm audit --all` / `pip-audit` / `cargo audit`. Cross-reference against OSV (Open Source Vulnerabilities) database. Check install scripts: `cat node_modules/<pkg>/package.json | jq '.scripts.install,.scripts.postinstall'` — any install script running `curl | sh` or spawning child processes is HIGH severity.

**Step 6 — SLSA Provenance and Report**
For critical dependencies, check if SLSA provenance attestations are available (`npm install @sigstore/bundle` / cosign verify-attestation). Emit `.rune/security/supply-chain-report.md` with: dependency inventory, collision risks, typosquatting flags, lockfile anomalies, install script warnings, and remediation steps.

#### Example

```bash
# STEP 1: Full dependency inventory with phantom dep check
npm ls --all --json 2>/dev/null | jq '[.. | objects | select(.version) | {name: .name, version: .version}]' > deps-inventory.json

# STEP 2: Check if internal package exists on public registry
# VULNERABLE: @company/utils exists internally but NOT on npm → dependency confusion risk
curl -s https://registry.npmjs.org/@company/utils | jq '.error'
# If returns null (package exists publicly) → verify it's YOUR package, not an attacker's

# STEP 3: Detect install scripts in dependencies
for pkg in node_modules/*/package.json; do
  scripts=$(jq -r '(.scripts.install // "") + " " + (.scripts.postinstall // "")' "$pkg")
  if echo "$scripts" | grep -qE 'curl|wget|exec|spawn|child_process'; then
    echo "WARN: install script in $pkg: $scripts"
  fi
done

# STEP 4: Verify lockfile integrity (npm ≥ 9.5)
npm audit signatures
# Expected: "audited X packages, 0 packages have invalid signatures"
```

```typescript
// PATTERN: enforce private registry for scoped packages (.npmrc)
// @company:registry=https://npm.company.internal
// //npm.company.internal/:_authToken=${NPM_INTERNAL_TOKEN}

// PATTERN: detect phantom dependencies in TypeScript
// Any import from a package not in dependencies/devDependencies = phantom dep
// Tool: depcheck → npx depcheck --json | jq '.missing'
```

---

### api-security

API hardening patterns — rate limiting strategies, input sanitization beyond schema validation, CORS configuration, Content Security Policy generation, and security headers middleware. Outputs ready-to-use middleware code for Express, Fastify, and Next.js.

#### Workflow

**Step 1 — Enumerate API Endpoints**
Use Grep to list all route definitions across the codebase. Categorize by: public (unauthenticated), authenticated, admin, and internal (service-to-service). For each endpoint, note: whether it accepts user-controlled input, whether it has rate limiting applied, and whether it can trigger expensive operations (DB writes, external API calls, file I/O).

**Step 2 — Audit Rate Limiting**
Check if rate limiting is applied per-endpoint or only globally. Global rate limits are bypassable — an attacker can flood a single expensive endpoint within the global budget. Verify rate limits are enforced at the infrastructure level (not just in-process) so they survive server restarts and work across horizontally scaled instances. Recommend: Redis-backed sliding window for authenticated endpoints, token bucket for public endpoints. Set tighter limits on auth endpoints (login, password reset, OTP verify) to prevent brute force.

**Step 3 — Audit Input Validation**
Schema validation (Zod, Joi) is necessary but not sufficient. Additionally check:
- **HTML inputs** — is DOMPurify or equivalent used before any user content is rendered as HTML?
- **File uploads** — is MIME type validated from magic bytes (not just the `Content-Type` header)? Is file size capped before reading into memory?
- **Path parameters** — could `req.params.filename` be `../../etc/passwd`? Normalize with `path.resolve` and verify it stays within the allowed base directory.
- **Numeric IDs** — are they validated as integers to prevent NoSQL/ORM injection via object payloads?

**Step 4 — Verify CORS Configuration**
Check that `Access-Control-Allow-Origin` is not `*` for authenticated endpoints. Verify origins are defined per-environment (development allows localhost, production allows only the production domain). Check credentials handling — `credentials: true` must never be paired with `origin: '*'`. Verify preflight caching (`Access-Control-Max-Age`) is set to reduce OPTIONS request overhead without being too long.

**Step 5 — Generate CSP Policy**
Build a Content Security Policy tailored to the application's actual resource origins. Use `script-src 'nonce-{random}'` for inline scripts rather than `'unsafe-inline'`. Generate nonces server-side per request. Define `connect-src` to only allow the actual API and WebSocket origins. Add `upgrade-insecure-requests` for HTTPS-only deployments.

**Step 6 — Emit Security Headers Middleware**
Produce a complete security headers middleware file. Include: HSTS with preload, X-Content-Type-Options, X-Frame-Options, Referrer-Policy (strict-origin-when-cross-origin), and Permissions-Policy to restrict camera/mic/geolocation access. Output the middleware as a ready-to-paste file for the detected framework.

#### Example

```typescript
// EXPRESS: complete security headers middleware
// File to create: src/middleware/security-headers.ts

import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.locals.cspNonce = nonce

  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader(
    'Content-Security-Policy',
    [
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' wss://api.yourdomain.com",
      "img-src 'self' data: https:",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ')
  )
  next()
}

// RATE LIMITING: Redis-backed sliding window (express-rate-limit + ioredis)
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// Tight limit on auth endpoints — brute force prevention
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                     // 10 attempts per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  message: { error: 'Too many attempts, please try again later' },
})

// General API limit — per-user sliding window
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 req/min per IP
  keyGenerator: (req) => req.user?.id ?? req.ip,  // per-user when authenticated
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
})

// INPUT: path traversal prevention for file name parameters
import path from 'path'

function safeFilePath(baseDir: string, userFilename: string): string {
  const normalized = path.resolve(baseDir, userFilename)
  if (!normalized.startsWith(path.resolve(baseDir))) {
    throw new ForbiddenError('Path traversal attempt detected')
  }
  return normalized
}

// CORS: environment-aware origin allowlist
const CORS_ORIGINS: Record<string, string[]> = {
  production:  ['https://app.yourdomain.com'],
  staging:     ['https://staging.yourdomain.com'],
  development: ['http://localhost:3000', 'http://localhost:5173'],
}

export const corsOptions = {
  origin: (origin: string | undefined, cb: Function) => {
    const allowed = CORS_ORIGINS[process.env.NODE_ENV ?? 'development']
    if (!origin || allowed.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
  maxAge: 600,  // cache preflight for 10 minutes
}
```

```typescript
// NEXT.JS: security headers in next.config.ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

export default {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}
```

---

## Connections

```
Calls → scout (L2): scan codebase for security patterns before audit
Calls → verification (L3): run security tooling (Semgrep, Trivy, npm audit, gitleaks)
Calls → @rune/backend (L4): auth pattern overlap — security audits reference backend auth flows
Called By ← review (L2): when security-critical code detected during review
Called By ← cook (L1): when auth/input/payment/PII code is in scope
Called By ← deploy (L2): pre-release security gate when security scope active
```

## Constraints

1. MUST use opus model for auth, crypto, and payment code review — these domains require maximum reasoning depth.
2. MUST NOT rely solely on automated tool output — every finding requires manual confirmation of exploitability before reporting.
3. MUST produce actionable findings: each issue includes file:line reference, severity rating, and concrete remediation steps.
4. MUST differentiate scope from sentinel — @rune/security does deep on-demand analysis; sentinel does fast automated gates on every commit. Never duplicate sentinel's job.
5. MUST generate defensive examples only — no offensive exploit code beyond minimal PoC sufficient to confirm exploitability.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Reporting false positives as confirmed vulnerabilities | HIGH | Always verify exploitability manually before including in final report |
| Auditing only code, missing infra/config attack surface | HIGH | Include Dockerfile, CI/CD yaml, nginx/CDN config, and .npmrc in scope |
| Secret scan misses base64-encoded or env-injected secrets | HIGH | Scan both raw and decoded forms; check CI/CD variable lists |
| Compliance gap analysis based on outdated standard version | MEDIUM | Reference standard version explicitly (e.g., GDPR 2016/679, PCI-DSS v4.0) |
| OWASP audit skips indirect dependencies (transitive vulns) | MEDIUM | Run `npm audit --all` or `pip-audit` to surface transitive CVEs |
| Pentest PoC accidentally run against production | CRITICAL | Confirm target environment before executing any PoC — add env guard to scripts |
| Supply chain: only checking direct deps, missing transitive | HIGH | Use `npm ls --all` or `pip-audit` — transitive deps are equally exploitable |
| Rate limits enforced in-process only (bypassed at scale) | HIGH | Use Redis-backed store; in-process limits don't survive horizontal scaling |
| CSP nonce reuse across requests | CRITICAL | Generate a new `crypto.randomBytes(16)` nonce per request, never cache |
| BOLA check missed on bulk/list endpoints | HIGH | List endpoints that return multiple objects must also filter by authenticated user's scope |

## Difference from sentinel

`sentinel` = lightweight automated gate (every commit, fast, cheap, blocks bad merges)
`@rune/security` = deep manual-grade audit (on-demand, thorough, expensive, produces audit-ready reports)

sentinel catches: known CVEs in deps, hardcoded secrets, obvious injection patterns.
@rune/security catches: logic flaws in auth flows, missing authorization on specific routes, supply chain confusion attacks, API rate limiting gaps, compliance gaps, attack chains spanning multiple services.

## Done When

- All OWASP Top 10 (2021) + API Security Top 10 (2023) categories explicitly assessed (confirmed safe or finding raised)
- Every HIGH/CRITICAL finding has a PoC or reproduction steps confirming exploitability
- Secret audit covers source history, not just current HEAD; pre-commit hook configured
- Supply chain report emitted to `.rune/security/supply-chain-report.md` with all collision/typosquatting risks
- Security headers middleware generated and wired into the application
- Compliance report maps each applicable standard requirement to a code location or gap, with remediation roadmap
- Structured security report emitted with severity ratings and remediation steps

## Cost Profile

~10,000–28,000 tokens per full pack audit depending on codebase size and number of skills invoked. opus default for auth/crypto/payment/compliance review — these require maximum reasoning depth. haiku for initial pattern scanning (scout phase) and dependency inventory. sonnet for supply-chain analysis and API hardening code generation. Expect 5–10 minutes elapsed for a mid-size application running the full pack.
