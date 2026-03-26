# OWASP Patterns — Code Examples and Detection Details

Reference for Step 3 (OWASP Check). Contains concrete detection examples for each category.

## SQL Injection

Detect string concatenation or interpolation inside SQL query strings.
Severity: **BLOCK**

```python
# BAD — string interpolation in SQL → BLOCK
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
query = "SELECT * FROM users WHERE name = '" + name + "'"

# GOOD — parameterized query
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

Detection signals:
- f-string or `+` concatenation where the outer string contains `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WHERE`, `FROM`
- `.format()` or `%` formatting applied to SQL strings

## XSS (Cross-Site Scripting)

Detect `innerHTML =`, `dangerouslySetInnerHTML`, `document.write(` with non-static content.
Severity: **BLOCK**

```typescript
// BAD — renders raw user content → BLOCK
element.innerHTML = userComment;
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// GOOD — safe alternatives
element.textContent = userComment;
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

Detection signals:
- `innerHTML` assigned a variable (not a string literal)
- `dangerouslySetInnerHTML` without `DOMPurify.sanitize()` wrapping the value
- `document.write(` with any non-literal argument

## CSRF

Detect HTML `<form>` without CSRF token fields; `Set-Cookie` without `SameSite`.
Severity: **WARN**

Detection signals:
- `<form method="post">` or `<form method="POST">` without a hidden input containing `csrf`, `_token`, or `authenticity_token`
- `Set-Cookie:` header string without `SameSite=` attribute

## Missing Input Validation

Detect new route/API handlers passing `req.body` / `request.json()` directly to DB calls.
Severity: **WARN**

```typescript
// BAD — raw body to DB → WARN
app.post('/users', async (req, res) => { await db.users.create(req.body); });

// GOOD — validate at boundary
app.post('/users', async (req, res) => {
  const validated = CreateUserSchema.parse(req.body);
  await db.users.create(validated);
});
```

Detection signals:
- Route handler body where `req.body` / `request.json()` / `event.body` flows directly into a DB call (`.create(`, `.insert(`, `.save(`, `.update(`) with no intermediate validation call
