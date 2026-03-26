# Secret Patterns — Extended Gitleaks Reference

Extended secret detection patterns for Step 1 (Secret Scan).

## 1b. Extended Gitleaks Patterns

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

## 1c. Git History Scan (First Run Only)

If no `.rune/sentinel-baseline.md` exists, run a historical scan:

```bash
git log --all --diff-filter=A -- '*.env*' '*.key' '*.pem' '*.p12' '*credentials*' '*secret*'
```

Result: any output → **WARN** — historical secret files detected. Recommend BFG/git-filter-repo cleanup.

For subsequent runs, scan only the current diff (incremental).

## Core Patterns (always active)

Scan for these patterns in all changed files:

- `sk-`, `AKIA`, `ghp_`, `ghs_`, `-----BEGIN`
- `password\s*=\s*["']`, `secret\s*=\s*["']`
- `api_key\s*=\s*["']`, `token\s*=\s*["']`
- `.env` file contents committed directly (lines matching `KEY=value` outside `.env` files)
- High-entropy strings: length > 40, entropy > 4.5 → HIGH_ENTROPY candidate

Any match = **BLOCK**.
