# Auth & Cryptography Reference

> Loaded by `sentinel` when authentication, password hashing, encryption, or token management patterns detected.

---

## Password Hashing

### Recommended: Argon2id

```javascript
import { hash, verify } from '@node-rs/argon2';

// Hash — use these parameters minimum
const hashed = await hash(password, {
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
  outputLen: 32,        // 32 bytes
});

// Verify
const valid = await verify(hashed, password);
```

### Acceptable: bcrypt

```javascript
import bcrypt from 'bcrypt';

const ROUNDS = 12; // minimum 12, never below 10
const hashed = await bcrypt.hash(password, ROUNDS);
const valid = await bcrypt.compare(password, hashed);
```

### Severity Table

| Algorithm | Verdict | Action |
|-----------|---------|--------|
| Argon2id | PASS | Preferred |
| bcrypt (rounds ≥ 12) | PASS | Acceptable |
| bcrypt (rounds < 10) | WARN | Increase rounds |
| scrypt | WARN | Prefer Argon2id |
| SHA-256/SHA-512 + salt | BLOCK | Not a password hash |
| MD5 / SHA-1 | BLOCK | Broken, must replace |
| Plaintext | BLOCK | Critical vulnerability |

---

## JWT Best Practices

### Token Lifecycle

```javascript
// Access token: short-lived (15 min)
const accessToken = jwt.sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m', algorithm: 'HS256' }
);

// Refresh token: longer (7 days), stored in HttpOnly cookie
const refreshToken = jwt.sign(
  { sub: user.id, type: 'refresh' },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);

res.cookie('refresh_token', refreshToken, {
  httpOnly: true,     // No JavaScript access
  secure: true,       // HTTPS only
  sameSite: 'strict', // No cross-site
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh', // Only sent to refresh endpoint
});
```

### JWT BLOCK Patterns

| Pattern | Severity | Fix |
|---------|----------|-----|
| `algorithm: 'none'` | BLOCK | Always specify algorithm |
| No `expiresIn` | BLOCK | Tokens MUST expire |
| Secret < 32 chars | WARN | Use 256-bit minimum |
| JWT in localStorage | WARN | Use HttpOnly cookie for refresh |
| No audience/issuer validation | WARN | Add `aud` and `iss` claims |

---

## OAuth2 with PKCE

```javascript
// 1. Generate PKCE challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// 2. Authorization URL
const authUrl = new URL('https://provider.com/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));

// 3. Exchange code (callback) — include code_verifier
const tokenResponse = await fetch('https://provider.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier, // Proves we initiated the flow
  }),
});
```

---

## Encryption (Data at Rest)

### AES-256-GCM (Recommended)

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

function encrypt(plaintext) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store: iv + tag + ciphertext (all needed for decryption)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(encoded) {
  const buffer = Buffer.from(encoded, 'base64');
  const iv = buffer.subarray(0, 16);
  const tag = buffer.subarray(16, 32);
  const ciphertext = buffer.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### Crypto Rules

| Use Case | Algorithm | BLOCK If |
|----------|-----------|----------|
| Password storage | Argon2id / bcrypt | MD5, SHA-*, plaintext |
| Data encryption | AES-256-GCM | AES-ECB, DES, RC4 |
| Integrity check | SHA-256 | MD5, SHA-1 |
| Signatures | HMAC-SHA256 | Custom MAC |
| Random tokens | `crypto.randomBytes()` | `Math.random()` |
| Key derivation | scrypt / HKDF | Simple hash |

---

## Fail-Closed Principle

Errors MUST deny access, never grant it:

```javascript
// BAD: fail-open — error grants access
function authorize(user) {
  try {
    return checkPermission(user);
  } catch {
    return true; // BLOCK: error = access granted
  }
}

// GOOD: fail-closed — error denies access
function authorize(user) {
  try {
    return checkPermission(user);
  } catch {
    return false; // Error = denied
  }
}
```

**BLOCK pattern**: Any catch/except block that returns `true`, `next()`, or allows continuation on auth/permission check failure.
