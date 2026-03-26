# Project Contract

> Project-level invariants enforced by `rune:cook` and `rune:sentinel`.
> Violations are **hard gates** — skills refuse to proceed until resolved.
>
> Copy this template to `.rune/contract.md` in your project and customize.
> Run `rune onboard` to generate a starter contract automatically.

---

## security

- No `eval()`, `new Function()`, or dynamic code execution
- No hardcoded secrets — use environment variables or secret managers
- All user input must be validated (zod, joi, or equivalent)
- No raw SQL — use parameterized queries or ORM
- No `dangerouslySetInnerHTML` without sanitization (DOMPurify or equivalent)
- Authentication required on all non-public API endpoints

## data

- PII fields must use encryption helpers — never store plaintext
- Database migrations must include rollback scripts
- No `DELETE` or `DROP` without soft-delete or backup strategy
- Logging must not include sensitive data (passwords, tokens, PII)

## architecture

- No circular imports between modules
- API routes must not import from UI components
- Shared types live in a dedicated types/ or shared/ directory
- Maximum file size: 500 lines (components: 300 lines)
- No god objects — classes should have single responsibility

## testing

- New features require tests before merge
- Critical paths (auth, payments, data mutations) require integration tests
- Test files must not import production secrets or configs

## operations

- No `console.log` in production code — use structured logger
- Error responses must not leak stack traces or internal paths
- Health check endpoint required for deployed services

---

## How It Works

1. **cook** loads `.rune/contract.md` at Phase 0 before any code changes
2. **sentinel** validates staged changes against contract rules before commit
3. Violations produce a **BLOCK** finding — cook/sentinel refuse to proceed
4. Contract sections can be referenced by name: `contract.security`, `contract.data`, etc.

## Customization

- Remove sections that don't apply to your project
- Add project-specific rules under existing or new sections
- Keep rules concrete and testable — avoid vague guidelines
- Each rule should be a single, verifiable statement
