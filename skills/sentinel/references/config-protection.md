# Config Protection — 3-Layer Defense Reference

Reference for Step 4.6. Detect attempts to weaken linting, security, or CI/CD configurations.

## Layer 1 — Linter/Formatter Config Drift

Scan diff for changes to:
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

Match = **WARN** — "Config change weakens code quality — verify this is intentional."

## Layer 2 — Security Middleware Removal

Scan for removal of security-critical middleware or decorators:

- `helmet` removed from Express/Fastify middleware chain
- `csrf` middleware removed or commented out
- `cors` configuration changed to `origin: '*'`
- `SecurityMiddleware` removed from Django `MIDDLEWARE`
- `@csrf_protect` decorator removed from Django views

Match = **BLOCK** — "Security middleware removed — this must be explicitly justified."

## Layer 3 — CI/CD Safety Bypass

Scan for weakening of CI/CD safety checks:

- `--no-verify` added to git commands in scripts
- `--force` added to deployment scripts
- Test steps removed or marked `continue-on-error: true`
- Coverage thresholds lowered

Match = **WARN** — "CI safety check weakened — verify this is intentional."
