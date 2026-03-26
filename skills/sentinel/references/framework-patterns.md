# Framework-Specific Security Patterns

Reference for Step 4.5. Apply only when the relevant framework is detected in changed files.

## Django

Detect: `django` in `requirements.txt` or imports.

| Check | Severity |
|-------|----------|
| `DEBUG = True` in non-development settings file | BLOCK |
| Missing `permission_classes` on `ModelViewSet` | WARN |
| `SecurityMiddleware` / CSRF middleware removed from `MIDDLEWARE` list | BLOCK |

## React / Next.js

Detect: `.tsx` or `.jsx` files in changed set.

| Check | Severity |
|-------|----------|
| JWT stored in `localStorage` instead of `httpOnly` cookie | WARN |
| `dangerouslySetInnerHTML` without `DOMPurify.sanitize()` | BLOCK |

## Node.js / Express / Fastify

Detect: `express` or `fastify` in imports.

| Check | Severity |
|-------|----------|
| CORS set to `origin: '*'` on authenticated endpoints | WARN |
| Missing `helmet` middleware for HTTP security headers | WARN |

## Python

Detect: `.py` files in changed set.

| Check | Severity |
|-------|----------|
| `pickle.loads(user_input)` or `eval(user_expression)` | BLOCK |
| `yaml.load()` without `Loader` argument (uses unsafe loader) | WARN |

## Detection Notes

- Framework detection is file-based — scan imports and dependency manifests (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`) in the changed file set.
- Apply only the relevant framework sections — do not scan React patterns in a pure Python project.
- "The framework handles security" is NOT an acceptable reason to skip any check (see Constraints in SKILL.md).
