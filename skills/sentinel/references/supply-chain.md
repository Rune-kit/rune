# Supply Chain Security Reference

> Loaded by `sentinel` when dependency changes detected (package.json, package-lock.json, requirements.txt, Cargo.toml modified).

---

## Dependency Audit

### Required Checks

On every dependency change, verify:

```bash
# Node.js
npm audit --audit-level=high
npm audit signatures  # Verify registry signatures

# Python
pip-audit
safety check

# Rust
cargo audit
```

**BLOCK**: Any `high` or `critical` severity vulnerability in direct dependencies.
**WARN**: `high`/`critical` in transitive dependencies.

---

## Lock File Rules

| Rule | Severity |
|------|----------|
| Lock file not committed | BLOCK |
| Lock file deleted | BLOCK |
| Lock file modified without package.json change | WARN (investigate) |
| Multiple lock files (package-lock + yarn.lock) | WARN |

Lock files pin exact versions. Without them, builds are non-reproducible and vulnerable to supply chain attacks.

---

## Typosquatting Prevention

Before adding ANY new dependency, check:

| Signal | Example | Risk |
|--------|---------|------|
| Name differs by 1 char | `lodsh` vs `lodash` | Typosquat |
| Extra hyphen/underscore | `react-domm` | Typosquat |
| Scoped look-alike | `@react/core` vs `react` | Impersonation |
| Very new package | Published < 7 days ago | Suspicious |
| Low download count | < 100 weekly downloads | Unvetted |
| No repository URL | Missing `repository` field | Cannot verify source |

### Scan Pattern

```javascript
// sentinel should flag new dependencies added to package.json
// Check against known package names for close matches
const KNOWN_PACKAGES = ['lodash', 'express', 'react', 'axios', ...];

function checkTyposquat(name) {
  for (const known of KNOWN_PACKAGES) {
    if (levenshteinDistance(name, known) === 1) {
      return { risk: 'HIGH', similar: known };
    }
  }
}
```

---

## Version Pinning Strategy

| Dependency Type | Strategy | Why |
|----------------|----------|-----|
| Direct (production) | `^` semver (default) | Balance updates + stability |
| Security-critical | Exact pin (`1.2.3`) | Prevent unexpected changes |
| Dev tools | `^` semver | Less risk, want updates |
| CDN resources | SRI hash required | Tamper detection |

### Subresource Integrity (SRI)

For any CDN-loaded script or stylesheet:

```html
<!-- GOOD: SRI hash verifies integrity -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous"
></script>

<!-- BLOCK: CDN resource without SRI -->
<script src="https://cdn.example.com/lib.js"></script>
```

---

## npm Security Hardening

| Practice | Priority |
|----------|----------|
| Enable 2FA on npm account | BLOCK (maintainers) |
| Use scoped packages (`@org/pkg`) | Recommended |
| `npm audit` in CI pipeline | Required |
| `npm audit signatures` | Recommended |
| Review `postinstall` scripts | Required for new deps |
| Use `--ignore-scripts` for untrusted packages | Recommended |

### Dangerous Install Scripts

**WARN** when a newly added package has `postinstall`, `preinstall`, or `install` scripts:

```json
// package.json of dependency — review these carefully
{
  "scripts": {
    "postinstall": "node setup.js"  // What does this run?
  }
}
```

---

## Automated Dependency Updates

Configure one of:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    reviewers:
      - security-team
```

**WARN** if no automated dependency update tool is configured (Dependabot, Renovate, or Snyk).

---

## Security Checklist for New Dependencies

Before approving a new dependency:

- [ ] Package name is correct (not a typosquat)
- [ ] Has significant download count (>1K/week for niche, >10K for common)
- [ ] Repository URL exists and matches claimed source
- [ ] No known vulnerabilities (`npm audit`)
- [ ] License is compatible
- [ ] Install scripts reviewed (if any)
- [ ] Maintainer has 2FA enabled (check npm profile)
- [ ] Not abandoned (last publish < 12 months)
