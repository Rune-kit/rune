# Desktop App Security Reference

> Loaded by `sentinel` when Electron or Tauri project detected (package.json contains `electron`, `@tauri-apps/cli`, or `tauri.conf.json` exists).

---

## Electron Security

### Secure BrowserWindow Config

Every BrowserWindow MUST use:

```javascript
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,      // REQUIRED — separates preload from page
    nodeIntegration: false,       // REQUIRED — no Node in renderer
    sandbox: true,                // REQUIRED — OS-level sandbox
    webSecurity: true,            // REQUIRED — enforce same-origin
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
  }
});
```

**BLOCK if any of these are wrong:**
- `contextIsolation: false` — renderer can access Node APIs
- `nodeIntegration: true` — XSS = full system compromise
- `sandbox: false` — no OS isolation
- `webSecurity: false` — disables same-origin policy

### Preload Script (Minimal Surface)

Expose only specific functions, never blanket APIs:

```javascript
// preload.js — GOOD: minimal, typed API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  saveFile: (path, data) => ipcRenderer.invoke('fs:save', path, data),
  // NEVER expose: ipcRenderer.send, ipcRenderer.on, require, process
});
```

### IPC Validation

Validate BOTH sender identity and message content:

```javascript
// main.js — validate IPC
ipcMain.handle('fs:read', async (event, filePath) => {
  // 1. Verify sender
  if (event.senderFrame.url !== 'app://./index.html') {
    throw new Error('Unauthorized IPC sender');
  }

  // 2. Validate input
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ALLOWED_DIR)) {
    throw new Error('Path traversal blocked');
  }

  return fs.readFileSync(resolved, 'utf-8');
});
```

### Deep Link Validation

```javascript
// Validate protocol handler input
app.setAsDefaultProtocolClient('myapp');

app.on('open-url', (event, url) => {
  event.preventDefault();

  const parsed = new URL(url);
  const ALLOWED_HOSTS = ['app.example.com'];
  const ALLOWED_PROTOCOLS = ['myapp:'];

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return;
  if (parsed.host && !ALLOWED_HOSTS.includes(parsed.host)) return;
  if (url.length > 2048) return; // Length limit

  handleDeepLink(parsed);
});
```

### Electron Vulnerability Checklist

| Check | BLOCK if |
|-------|----------|
| `nodeIntegration` | `true` in any window |
| `contextIsolation` | `false` in any window |
| `sandbox` | `false` in any window |
| `webSecurity` | `false` |
| Preload exposes `ipcRenderer.send` | Direct IPC channel exposed |
| IPC handler missing sender check | No `event.senderFrame` validation |
| `shell.openExternal` unvalidated | User-controlled URLs passed directly |
| Auto-updater over HTTP | Not using HTTPS or missing signature check |
| `webview` tag without sandbox | Embedded content without isolation |
| Deep links unvalidated | No protocol/host allowlist |

---

## Tauri Security

### Command Security

```rust
// GOOD: Strict typing + validation
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| e.to_string())?;

    // Validate path is within allowed directory
    if !canonical.starts_with("/allowed/dir") {
        return Err("Access denied".into());
    }

    std::fs::read_to_string(canonical)
        .map_err(|e| e.to_string())
}
```

### Scope Configuration

```json
// tauri.conf.json — restrictive scopes
{
  "tauri": {
    "allowlist": {
      "fs": {
        "scope": ["$APPDATA/*", "$RESOURCE/*"],
        "readFile": true,
        "writeFile": true
      },
      "http": {
        "scope": ["https://api.example.com/*"]
      },
      "shell": {
        "open": true,
        "scope": []
      }
    }
  }
}
```

**BLOCK if:**
- `fs.scope: ["**"]` — unrestricted filesystem access
- `http.scope: ["https://**"]` — any HTTPS target
- `shell.scope` contains executable paths without validation

### Tauri Vulnerability Checklist

| Check | BLOCK if |
|-------|----------|
| `fs.scope` | Contains `**` or `/` (unrestricted) |
| `http.scope` | Broad wildcard allowing arbitrary hosts |
| `shell` commands | Unrestricted `execute` scope |
| CSP missing | No Content-Security-Policy in `tauri.conf.json` |
| `invoke()` handler | Missing input validation or type checking |

---

## Common Desktop Patterns

### Code Signing

Always sign releases — unsigned apps trigger OS warnings and can be tampered with:

- **Windows**: EV code signing certificate (hardware token)
- **macOS**: Developer ID certificate + notarization (`xcrun notarytool`)
- **Linux**: GPG signing for packages

### Secure Auto-Update

```
1. Check for update over HTTPS
2. Verify digital signature of update package
3. Verify SHA-256 checksum
4. Prompt user before installing (never silent)
5. Graceful fallback if update fails
```

### Credential Storage

```javascript
// Electron — use safeStorage (OS keychain)
const { safeStorage } = require('electron');

if (safeStorage.isEncryptionAvailable()) {
  const encrypted = safeStorage.encryptString(token);
  // Store encrypted buffer, never plaintext
}
```

**BLOCK**: Storing credentials in `localStorage`, plain files, or `electron-store` without encryption.
