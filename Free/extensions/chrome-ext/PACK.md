---
name: "@rune/chrome-ext"
description: Chrome extension development patterns — Manifest V3 scaffolding, service worker lifecycle, message passing, storage patterns, Chrome Web Store compliance, and built-in AI integration.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "free"
  target: Chrome extension developers
---

# @rune/chrome-ext

## Purpose

Chrome extension development has a steep cliff of Manifest V3 gotchas that no other AI coding pack addresses. Service workers terminate silently after 30 seconds of idle, taking all JS-variable state with them. Fifty-eight percent of Chrome Web Store rejections are preventable compliance errors. The new Chrome AI APIs (Gemini Nano, Chrome 138+) require hardware checks, graceful fallbacks, and port-based streaming — none of which are obvious from the docs. This pack groups six tightly-coupled concerns — MV3 scaffolding, message passing, storage, CWS preflight, store listing, and built-in AI — because a gap in any single layer produces a broken, rejected, or battery-draining extension. Activates automatically when `manifest.json` with `manifest_version: 3` or `chrome.*` API usage is detected.

## Triggers

- Auto-trigger: when `manifest.json` containing `"manifest_version": 3` is found in project root or `src/`
- Auto-trigger: when files matching `**/background.ts`, `**/service-worker.ts`, `**/content.ts`, `**/popup.ts` exist alongside a `manifest.json`
- Auto-trigger: when `chrome.*` API calls are found in project source files
- `/rune chrome-ext` — manual invocation
- Called by `cook` (L1) when Chrome extension project context is detected
- Called by `scaffold` (L1) when user requests a new browser extension project

## Skills Included

### mv3-scaffold

Manifest V3 project scaffolding — detect extension type, generate minimal-permission manifest, scaffold service worker with correct lifecycle patterns, scaffold content script, and generate build config. Prevents the #1 MV3 mistake: carrying MV2 mental models (background pages, remote scripts, setTimeout for keepalive) into an MV3 project.

#### Workflow

**Step 1 — Detect or clarify extension type**
Use `Read` on any existing `manifest.json` or project description to classify the extension type:
- **popup**: user-triggered UI (toolbar button → popup.html)
- **sidebar**: persistent panel (chrome.sidePanel API, Chrome 114+)
- **content-injector**: modifies host pages (content scripts + optional popup)
- **background-only**: no visible UI, reacts to events (alarms, network, tabs)
- **devtools**: extends Chrome DevTools panel

If undetectable from files, ask the user. Extension type determines which APIs, permissions, and scaffold components are generated.

**Step 2 — Generate minimal-permission manifest.json**
Emit `manifest.json` with only the permissions required for the detected type. Flag over-permissioning immediately — requesting `<all_urls>` when only `activeTab` is needed is the #1 CWS rejection cause.

Key MV3 manifest rules:
- `"manifest_version": 3` — mandatory, MV2 deprecated Jan 2023
- `"background"` uses `{ "service_worker": "background.js" }` — NOT `"scripts"` array
- `"action"` replaces `"browser_action"` and `"page_action"`
- No `"content_security_policy"` that relaxes `script-src` (blocks CWS review)
- No `"web_accessible_resources"` with `matches: ["<all_urls>"]` unless justified
- External URLs in `"host_permissions"` require justification in CWS dashboard

**Step 3 — Scaffold service worker (CRITICAL lifecycle patterns)**
Generate `background.ts` / `background.js` with the following non-negotiable patterns:

CRITICAL: service workers terminate after 30 seconds of idle. Every assumption that breaks because of this:
- JS variables reset on termination — use `chrome.storage.session` for ephemeral state
- `setTimeout` / `setInterval` — NOT reliable across terminations, use `chrome.alarms`
- Pending async operations mid-flight get killed — use alarm + storage to resume
- `fetch()` initiated in a response to a non-event call may not complete

All event listeners MUST be registered at the top level synchronously — NOT inside `async` functions, Promises, or conditionals. Chrome only registers listeners present during the initial synchronous execution of the service worker.

**Step 4 — Scaffold content script**
Generate `content.ts` with correct isolation model:
- Runs in an **isolated world** — own JS context, cannot access page's JS variables
- Has access to the DOM but NOT to `chrome.storage`, `chrome.tabs`, most `chrome.*` APIs (exceptions: `chrome.runtime`, `chrome.storage`, `chrome.i18n`)
- Must message the service worker for privileged operations
- Inject only when needed — prefer `"run_at": "document_idle"` over `"document_start"`

**Step 5 — Scaffold popup/sidebar UI**
For popup and sidebar types, generate `popup.html` + `popup.ts`:
- Popup HTML MUST NOT load remote scripts (`<script src="https://...">`) — blocked by CSP
- All scripts must be local and listed in `web_accessible_resources` if loaded from content scripts
- Popup closes when user clicks away — don't depend on popup state for background operations
- For sidebar: register `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`

**Step 6 — Generate build config**
Emit a build configuration based on detected tooling:
- If `vite` in `package.json` → emit `vite.config.ts` using `@crxjs/vite-plugin` (hot-reload for extension dev)
- Otherwise → emit vanilla TypeScript config with `tsc` + file copy script
- Include `web-ext` config for local loading and reload

#### Example

```json
// manifest.json — content-injector type, minimal permissions
{
  "manifest_version": 3,
  "name": "Page Summarizer",
  "version": "1.0.0",
  "description": "Summarize any page using built-in AI or an external API.",
  "permissions": ["activeTab", "storage", "sidePanel"],
  "host_permissions": [],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Summarize this page",
    "default_icon": { "128": "icons/icon128.png" }
  },
  "side_panel": {
    "default_path": "sidebar.html"
  },
  "icons": { "128": "icons/icon128.png" },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

```typescript
// background.ts — correct MV3 service worker patterns
// CRITICAL: all listeners registered synchronously at top level

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[SW] Extension installed');
  }
});

// Use chrome.alarms — NOT setTimeout (alarms survive service worker termination)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    // periodic work here — service worker woke up for this
  }
});

// Message handler — registered synchronously, NOT inside async function
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE_PAGE') {
    // Return true to keep the message channel open for async response
    handleSummarize(message.payload).then(sendResponse);
    return true;
  }
});

async function handleSummarize(payload: { text: string }): Promise<{ summary: string }> {
  // Service worker is alive for the duration of this message handler
  const summary = await callExternalApi(payload.text);
  return { summary };
}
```

```typescript
// content.ts — isolated world, limited chrome.* access
const selectedText = window.getSelection()?.toString() ?? '';

if (selectedText.length > 0) {
  // Content scripts can message service worker
  chrome.runtime.sendMessage(
    { type: 'SUMMARIZE_PAGE', payload: { text: selectedText } },
    (response: { summary: string }) => {
      if (chrome.runtime.lastError) {
        console.error('[Content] Message failed:', chrome.runtime.lastError.message);
        return;
      }
      displaySummary(response.summary);
    }
  );
}

function displaySummary(summary: string): void {
  const panel = document.createElement('div');
  panel.id = 'rune-summarizer-panel';
  panel.textContent = summary;
  document.body.appendChild(panel);
}
```

---

### ext-messaging

Typed message passing between popup, service worker, and content script — discriminated union message types, one-shot `sendMessage`, long-lived port connections for streaming, and Chrome 146+ error handling. Prevents the #2 MV3 failure: untyped `any` messages, missing `return true` for async handlers, and ports used for single messages.

#### Workflow

**Step 1 — Identify message flows**
Use `Grep` to find existing `chrome.runtime.sendMessage`, `chrome.tabs.sendMessage`, and `chrome.runtime.connect` calls. Map the full message topology:
- popup → service worker (sendMessage — one-shot)
- service worker → content script (chrome.tabs.sendMessage — requires tab ID)
- content script → service worker (sendMessage — one-shot)
- service worker → popup (port — only if popup is open)
- streaming AI responses → use Port (not sendMessage — ports survive multiple sends)

**Step 2 — Define TypeScript message types**
Create `src/types/messages.ts` with a discriminated union covering all message directions. Each message type has a `type` literal and a strongly-typed `payload`. Response types are paired per message type.

**Step 3 — Implement chrome.runtime.sendMessage patterns**
For one-shot request/response between extension contexts. Key rules:
- Listener must `return true` if the response is sent asynchronously (inside a Promise or async function)
- `chrome.runtime.lastError` MUST be checked in the callback — unhandled errors throw in MV3
- Content scripts cannot receive messages via `chrome.runtime.sendMessage` — use `chrome.tabs.sendMessage` from the service worker with the target tab's ID

**Step 4 — Implement chrome.tabs.sendMessage (service worker → content)**
Service worker must resolve the target tab ID before sending. Use `chrome.tabs.query({ active: true, currentWindow: true })` or receive the tab ID from the content script's original message (sender.tab.id).

**Step 5 — Implement port-based long-lived connections**
Use `chrome.runtime.connect` for streaming scenarios (AI token streaming, progress updates, live data feeds). Ports stay open until explicitly disconnected. Each side must handle `port.onDisconnect` to clean up.

**Step 6 — Add Chrome 146+ error handling**
Chrome 146 changed message listener error behavior: uncaught errors in listeners now reject the Promise returned by `sendMessage` on the sender side. Wrap all listener handlers in try/catch and send structured error responses.

#### Example

```typescript
// src/types/messages.ts — discriminated union message types
export type ExtensionMessage =
  | { type: 'SUMMARIZE_PAGE'; payload: { text: string; tabId: number } }
  | { type: 'GET_SETTINGS'; payload: Record<string, never> }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'OPEN_SIDEBAR'; payload: { tabId: number } };

export type ExtensionResponse<T extends ExtensionMessage> =
  T extends { type: 'SUMMARIZE_PAGE' } ? { summary: string; error?: string } :
  T extends { type: 'GET_SETTINGS' } ? { settings: Settings } :
  T extends { type: 'UPDATE_SETTINGS' } ? { ok: boolean } :
  T extends { type: 'OPEN_SIDEBAR' } ? { ok: boolean } :
  never;

export interface Settings {
  useBuiltinAI: boolean;
  externalApiKey: string;
  maxLength: number;
}
```

```typescript
// background.ts — typed message handler
import type { ExtensionMessage } from './types/messages';

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    // CRITICAL: return true to keep channel open for async response
    (async () => {
      try {
        switch (message.type) {
          case 'SUMMARIZE_PAGE': {
            const summary = await summarize(message.payload.text);
            sendResponse({ summary });
            break;
          }
          case 'GET_SETTINGS': {
            const result = await chrome.storage.sync.get('settings');
            sendResponse({ settings: result['settings'] as Settings });
            break;
          }
          default:
            sendResponse({ error: 'Unknown message type' });
        }
      } catch (err) {
        // Chrome 146+: send error response instead of letting it throw
        sendResponse({ error: String(err) });
      }
    })();
    return true; // MUST return true — async response
  }
);
```

```typescript
// Port-based streaming (service worker → sidebar/popup)
// background.ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return;

  port.onMessage.addListener(async (message: { text: string }) => {
    try {
      const session = await chrome.aiLanguageModel.create();
      const stream = session.promptStreaming(message.text);

      for await (const chunk of stream) {
        port.postMessage({ type: 'CHUNK', content: chunk });
      }
      port.postMessage({ type: 'DONE' });
      session.destroy();
    } catch (err) {
      port.postMessage({ type: 'ERROR', error: String(err) });
    }
  });

  port.onDisconnect.addListener(() => {
    // cleanup — sidebar/popup was closed
  });
});

// sidebar.ts — connect and stream
const port = chrome.runtime.connect({ name: 'ai-stream' });
port.postMessage({ text: selectedText });

port.onMessage.addListener((msg: { type: string; content?: string; error?: string }) => {
  if (msg.type === 'CHUNK') appendToOutput(msg.content ?? '');
  if (msg.type === 'DONE') finalizeOutput();
  if (msg.type === 'ERROR') showError(msg.error ?? 'Unknown error');
});

port.onDisconnect.addListener(() => {
  if (chrome.runtime.lastError) {
    console.error('[Sidebar] Port disconnected with error:', chrome.runtime.lastError.message);
  }
});
```

---

### ext-storage

Typed Chrome storage patterns — choose the right storage tier, define schema, implement typed helpers, handle schema migrations, and monitor quota. Prevents the #3 MV3 failure: storing state in service worker JS variables that reset on termination.

#### Workflow

**Step 1 — Choose storage type**
| Type | Capacity | Persistence | Sync | Use For |
|------|----------|-------------|------|---------|
| `chrome.storage.local` | 10 MB | Until uninstall | No | User data, large payloads, cached content |
| `chrome.storage.sync` | 100 KB / 8 KB per item | Cross-device | Yes | Settings, small preferences |
| `chrome.storage.session` | 10 MB | Until browser closes | No | Ephemeral state that service worker needs across terminations |
| `chrome.storage.managed` | Read-only | Admin-controlled | No | Enterprise policy |

CRITICAL: `chrome.storage.session` is the correct replacement for service worker JS variables. If you need state to survive a 30-second termination but clear on browser close, use session storage.

**Step 2 — Define TypeScript storage schema**
Create `src/types/storage.ts` with versioned schema interface. Include a `version` field for migration tracking.

**Step 3 — Implement typed get/set helpers**
Create `src/lib/storage.ts` with typed wrappers that preserve the schema type. Avoid `chrome.storage.*.get(null)` which returns `any` — always specify keys.

**Step 4 — Add migration logic**
On `chrome.runtime.onInstalled` with `reason === 'update'`, check stored schema version and run incremental migrations. Each migration transforms data from version N to N+1.

**Step 5 — Implement quota monitoring**
Chrome storage has hard limits that throw `QUOTA_BYTES_PER_ITEM` and `QUOTA_BYTES` errors on write. Wrap all writes with error handling and warn the user or prune old data when approaching 80% capacity.

#### Example

```typescript
// src/types/storage.ts — versioned storage schema
export const STORAGE_VERSION = 2;

export interface StorageSchema {
  version: number;
  settings: {
    useBuiltinAI: boolean;
    externalApiKey: string;
    maxLength: number;
    theme: 'light' | 'dark' | 'system';
  };
  cache: {
    lastSummary: string;
    lastUrl: string;
    timestamp: number;
  } | null;
}

export const STORAGE_DEFAULTS: StorageSchema = {
  version: STORAGE_VERSION,
  settings: {
    useBuiltinAI: true,
    externalApiKey: '',
    maxLength: 500,
    theme: 'system',
  },
  cache: null,
};
```

```typescript
// src/lib/storage.ts — typed get/set helpers with quota monitoring

import type { StorageSchema } from '../types/storage';
import { STORAGE_DEFAULTS, STORAGE_VERSION } from '../types/storage';

type StorageKey = keyof StorageSchema;

export async function storageGet<K extends StorageKey>(
  key: K
): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as StorageSchema[K]) ?? STORAGE_DEFAULTS[key];
}

export async function storageSet<K extends StorageKey>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('QUOTA_BYTES')) {
      console.warn('[Storage] Quota exceeded — clearing cache');
      await chrome.storage.local.remove('cache');
      // retry once after clearing cache
      await chrome.storage.local.set({ [key]: value });
    } else {
      throw err;
    }
  }
}

// Quota monitoring — warn at 80% capacity
export async function checkStorageQuota(): Promise<void> {
  const bytesUsed = await chrome.storage.local.getBytesInUse(null);
  const quota = chrome.storage.local.QUOTA_BYTES; // 10 MB = 10,485,760 bytes
  const pct = (bytesUsed / quota) * 100;
  if (pct > 80) {
    console.warn(`[Storage] ${pct.toFixed(1)}% of local storage used (${bytesUsed} / ${quota} bytes)`);
  }
}

// Migration runner — call on onInstalled with reason='update'
export async function runMigrations(): Promise<void> {
  const stored = await chrome.storage.local.get('version');
  const currentVersion = (stored['version'] as number | undefined) ?? 1;

  if (currentVersion < 2) {
    // v1 → v2: renamed 'apiKey' to 'externalApiKey'
    const legacy = await chrome.storage.local.get('settings');
    const legacySettings = legacy['settings'] as Record<string, unknown> | undefined;
    if (legacySettings?.['apiKey']) {
      await chrome.storage.local.set({
        settings: { ...legacySettings, externalApiKey: legacySettings['apiKey'], apiKey: undefined },
        version: 2,
      });
    }
  }

  await chrome.storage.local.set({ version: STORAGE_VERSION });
}
```

---

### cws-preflight

Chrome Web Store compliance audit — scan for over-permissioning, remote code execution, CSP violations, missing assets, and generate permission justification text. The highest-value skill in this pack: 58% of CWS rejections are preventable compliance errors caught here before submission.

**Top 5 CWS rejection reasons (2024 data):**
1. Over-permissioning — requesting permissions not demonstrably used in submitted code
2. Remote code execution — `eval()`, `Function()` constructor, CDN `<script>` tags, `import()` from external URLs
3. Misleading description — functionality not matching store listing claims
4. Missing or inaccessible privacy policy — required for any extension that handles user data
5. Branding violations — trademarked names (Google, Chrome, YouTube) in extension name or icon

**Triggers for manual review (3+ weeks instead of 24-72h):**
- Broad `host_permissions` with `<all_urls>` or `https://*/*`
- Sensitive permission combinations: `tabs` + `history` + `cookies`
- New developer account submitting extension with sensitive permissions
- Relaxed `content_security_policy` (`unsafe-eval`, `unsafe-inline`)
- First submission of a new extension (always manual)

#### Workflow

**Step 1 — Lint manifest for over-permissioning**
Use `Read` on `manifest.json`. For each declared permission, verify it is actually used in source code with `Grep`. Flag any permission declared but not found in `*.ts` / `*.js` source files. Severity: HIGH.

Common over-permissioning patterns to flag:
- `"tabs"` declared when only `activeTab` is needed (activeTab is granted on user click, requires no declaration)
- `"history"` declared without `chrome.history.*` usage
- `"bookmarks"` declared without `chrome.bookmarks.*` usage
- `"<all_urls>"` in `host_permissions` when specific domains suffice
- `"cookies"` declared without `chrome.cookies.*` usage

**Step 2 — Scan for remote code execution**
Use `Grep` to find patterns that trigger automatic CWS rejection:

```
pattern: "eval\s*\(" → remote code execution
pattern: "new Function\s*\(" → remote code execution
pattern: "<script[^>]+src=['\"]https?://" → remote script loading in HTML files
pattern: "import\s*\(['\"]https?://" → dynamic import from external URL
```

Flag each result as CRITICAL — these cause automatic rejection with no appeal path.

**Step 3 — Validate Content Security Policy**
Read the `content_security_policy.extension_pages` value from `manifest.json`. Flag any of:
- `'unsafe-eval'` in `script-src` — allows eval, triggers rejection
- `'unsafe-inline'` in `script-src` — allows inline scripts, triggers rejection
- External domains in `script-src` (anything not `'self'`) — remote code execution risk
- Missing CSP entirely — defaults to `script-src 'self'` which is fine, but document it

**Step 4 — Verify privacy policy**
Check if the extension collects user data (network requests to external servers, `chrome.storage` usage, content script reading page content). If yes:
- Privacy policy URL must be set in CWS Developer Dashboard
- Privacy policy must be publicly accessible (verify URL is live)
- Generate a minimal privacy policy template if none exists

**Step 5 — Check required assets**
Verify the following exist at declared paths in `manifest.json`:
- Icon at 128×128px (required for store listing)
- Screenshots: at least 1, dimensions 1280×800 or 640×400 (PNG or JPEG)
- Promotional tile: 440×280px (optional but strongly recommended)
- All declared icons (16, 32, 48, 128px) present at referenced paths

Use `Glob` to verify file existence. Use `Bash` to check image dimensions with `file` or `identify` if ImageMagick is available.

**Step 6 — Generate permission justification text**
For each declared permission, generate CWS-ready justification text. The CWS dashboard requires one justification per permission. Justifications must be specific — "We need this to work" is rejected.

**Step 7 — Produce preflight report**
Write `.rune/chrome-ext/preflight-report.md` with:
- PASS / WARN / FAIL per check
- Specific file + line for each issue
- Fix instructions
- Estimated review timeline (fast-track vs manual review triggers)
- Submission checklist

#### Example

```markdown
<!-- .rune/chrome-ext/preflight-report.md (generated by cws-preflight) -->

# CWS Preflight Report — Page Summarizer v1.0.0
Generated: 2026-03-12

## Summary
| Check | Status | Issues |
|-------|--------|--------|
| Permissions audit | ⚠️ WARN | 1 over-permission |
| Remote code execution | ✅ PASS | None found |
| Content Security Policy | ✅ PASS | Correct default |
| Privacy policy | ⚠️ WARN | URL not set in manifest |
| Required assets | ✅ PASS | All present |
| Permission justifications | ✅ READY | Generated below |

## Issues

### WARN: Over-permission — `"tabs"` not required
**File**: manifest.json line 7
**Detail**: `"tabs"` permission is declared but no `chrome.tabs.*` API calls found in source.
The extension uses `activeTab` (implicit on action click) — remove `"tabs"` from permissions array.
**Fix**: Remove `"tabs"` from `"permissions"` array.

### WARN: Privacy policy URL missing
**Detail**: Extension reads page content via content script (content.ts:L12 — `document.body.innerText`).
This constitutes user data handling and requires a privacy policy URL in the CWS Developer Dashboard.
**Fix**: Add privacy policy URL at publish time. Template: `.rune/chrome-ext/privacy-policy-template.md`

## Permission Justifications (paste into CWS dashboard)

### activeTab
"The extension reads the content of the current active tab when the user clicks the toolbar button
to initiate a summarization. No data is collected without explicit user action."

### storage
"The extension stores user settings (AI preference, API key, summary length) locally to persist
preferences between browser sessions. No data is synced externally."

### sidePanel
"The extension uses the Side Panel API to display AI-generated summaries in a persistent panel
without obscuring the page content."

## Estimated Review Timeline
- No sensitive permissions detected
- No broad host_permissions
- Timeline: **24–72 hours** (standard review)
- Recommendation: submit Tuesday–Thursday for fastest turnaround

## Submission Checklist
- [ ] Remove `"tabs"` from permissions array
- [ ] Add privacy policy URL to CWS Developer Dashboard
- [ ] Upload 1280×800 screenshot showing extension in use
- [ ] Write store description (min 132 chars for detailed description)
- [ ] Set category: Productivity
- [ ] Set language: English
- [ ] $5 one-time developer registration fee paid
```

---

### cws-publish

Chrome Web Store listing preparation and submission guide — store listing copy, screenshot descriptions, permission justifications, visibility settings, and timeline expectations. Produces a ready-to-paste store listing document.

#### Workflow

**Step 1 — Verify preflight passed**
Check for `.rune/chrome-ext/preflight-report.md`. If it does not exist or contains FAIL items, halt and direct user to run `cws-preflight` first. WARN items should be reviewed and resolved before submission.

**Step 2 — Prepare store listing copy**
Generate CWS listing text following Google's constraints:
- **Name**: max 45 characters. Must not include trademarked names (Google, Chrome, YouTube, Gmail). Cannot include "Extension" (Chrome adds it automatically).
- **Short description**: max 132 characters. First thing users see in search results — front-load the value proposition.
- **Detailed description**: no hard limit but 400–800 words is optimal. Structure: opening hook (1 sentence) → feature bullets (5-7) → how it works (2-3 sentences) → privacy statement (1-2 sentences).
- Avoid keyword stuffing — Google's policy considers it spam.

**Step 3 — Generate screenshot descriptions**
CWS screenshots need captions (optional but recommended). Generate 3-5 screenshot scenarios showing distinct use cases. Each screenshot should be 1280×800 or 640×400 pixels, PNG or JPEG, <2MB.

**Step 4 — Fill permission justifications**
Pull from `cws-preflight` output. Each permission needs a one-paragraph justification in plain English. Write from the user's perspective: "This permission allows the extension to..." not "We need this to...".

**Step 5 — Choose visibility and distribution**
| Visibility | Use Case |
|------------|----------|
| Public | Visible in CWS search — default for most extensions |
| Unlisted | Direct URL only — good for beta testing with known users |
| Private | Team-only — enterprise internal tools |

Select distribution regions (default: all). Consider unlisted for v1.0 while gathering initial feedback, then switch to public after first positive reviews.

**Step 6 — Generate submission guide with timeline**
Emit `.rune/chrome-ext/store-listing.md` with all copy ready to paste. Include submission steps and timeline expectations.

**Timeline expectations:**
- Simple extension, experienced developer account, no sensitive permissions: **24–72 hours**
- Sensitive permissions (`tabs`, `history`, `cookies`, `management`): **3–7 business days**
- Broad `host_permissions` or first submission: **up to 3 weeks** (manual review queue)
- Rejection: **10-day resubmission window** after fixing issues; same review time applies

**Submission tips:**
- Never submit on Friday — reviewers are less available Mon-Tue; submit Tue-Thu
- Use `optional_permissions` for non-critical features — reduces barrier to install and CWS scrutiny
- `optional_host_permissions` can be requested at runtime, reducing declared permissions
- Version bump required for each resubmission after rejection
- Include a test account in submission notes if extension requires authentication

#### Example

```markdown
<!-- .rune/chrome-ext/store-listing.md (generated by cws-publish) -->

# CWS Store Listing — Page Summarizer

## Name (max 45 chars)
Page Summarizer — AI-Powered Summaries
(38 chars ✅)

## Short Description (max 132 chars)
Summarize any webpage instantly with built-in Chrome AI. One click, no account required, no data sent externally.
(113 chars ✅)

## Detailed Description
Tired of spending 10 minutes reading a page to find out it wasn't worth your time?

**Page Summarizer** gives you the core ideas of any webpage in seconds — powered by Chrome's built-in Gemini Nano model, which runs entirely on your device.

**Features:**
- One-click summarization — click the toolbar button or select text to summarize a section
- Built-in AI — no API key required, no data leaves your device (requires Chrome 138+ with AI hardware support)
- External API fallback — configure your own OpenAI or Anthropic key for older hardware
- Summary length control — short (100 words), medium (300 words), or detailed (500 words)
- Side panel view — summaries appear in a non-intrusive panel alongside the page
- Dark mode support

**How it works:**
Click the toolbar button on any page. The extension reads the visible text and generates a summary using the on-device Gemini Nano model. If your hardware does not support built-in AI, the extension falls back to an external API of your choice (optional — extension still works without it in built-in AI mode).

**Privacy:**
No user data is collected, stored, or transmitted without your action. Summaries generated via the built-in AI model never leave your device. External API calls (if configured) are made directly to the API provider — not through any intermediary server.

## Screenshots (1280x800px)

1. **Main Use** — Extension sidebar showing a 3-paragraph summary of a news article beside the original page.
2. **Settings** — Settings panel showing AI model selector, API key field, and length preference.
3. **Text Selection** — Right-click context menu on selected text showing "Summarize selection" option.

## Category
Productivity

## Language
English

## Submission Notes (visible to reviewers, not users)
Test the extension on https://en.wikipedia.org/wiki/Artificial_intelligence — click the toolbar button to summarize. The extension requires Chrome 138+ for built-in AI. On older Chrome versions, configure an external API key in Settings to test the fallback path.
```

---

### ext-ai-integration

Chrome built-in AI and external API integration — detect AI type, check hardware requirements, implement Gemini Nano with graceful fallback, wire streaming responses via ports, handle rate limits, and test offline behavior. The differentiating skill for next-generation extensions.

**Chrome AI APIs (Chrome 138+ stable):**
| API | Namespace | Purpose |
|-----|-----------|---------|
| Prompt API | `chrome.aiLanguageModel` | General text generation, Q&A, classification |
| Summarizer | `chrome.aiSummarizer` | Condense long text |
| Writer | `chrome.aiWriter` | Generate new content from prompts |
| Rewriter | `chrome.aiRewriter` | Transform existing text (tone, length, format) |
| Translator | `chrome.aiTranslator` | Language translation |
| Language Detector | `chrome.aiLanguageDetector` | Detect text language |

**Hardware requirements for Gemini Nano:**
- Storage: 22 GB free disk space (model download)
- RAM: 4 GB VRAM (dedicated GPU) OR 16 GB system RAM (CPU inference)
- OS: macOS 13+, Windows 10/11 64-bit, ChromeOS (no Linux support)
- Cannot be checked programmatically — use capability API and handle `NotSupportedError`

**Manifest permission:**
```json
{ "permissions": ["aiLanguageModelParams"] }
```

#### Workflow

**Step 1 — Detect AI integration type**
Use `Read` on existing source and `manifest.json` to determine:
- Does `"aiLanguageModelParams"` appear in permissions? → Built-in Nano intended
- Does code reference `openai`, `anthropic`, `fetch` to an external AI endpoint? → External API
- Neither? → Need to design integration from scratch

Ask the user: "Do you want to use Chrome's built-in Gemini Nano (no API cost, runs on device, requires Chrome 138+ and compatible hardware), an external API (OpenAI/Anthropic, requires API key and network), or both with automatic fallback?"

**Step 2 — Check hardware capability for Nano**
`chrome.aiLanguageModel.capabilities()` returns `{ available: 'readily' | 'after-download' | 'no' }`. Map these:
- `'readily'` → model is downloaded, use immediately
- `'after-download'` → model needs download (~2GB), show progress UI and wait
- `'no'` → hardware not supported, fall through to fallback

This check MUST happen in the service worker (not content script — restricted APIs). Cache the result in `chrome.storage.session` to avoid repeated capability checks.

**Step 3 — Implement with graceful fallback chain**
Fallback chain: Gemini Nano → External API → Static response

Each tier is a distinct function with the same signature. The orchestrator tries each in order, catching `NotSupportedError`, network errors, and quota errors.

**Step 4 — Wire streaming responses via port messaging**
AI streaming MUST use ports — not `sendMessage`. `sendMessage` is one-shot: the response is sent once and the channel closes. Streaming requires a port to send multiple `CHUNK` messages followed by a `DONE` message.

See `ext-messaging` skill for port setup. Streaming pattern:
1. Sidebar/popup opens a port named `'ai-stream'`
2. Sends `{ text: inputText }` to start generation
3. Service worker receives, calls `session.promptStreaming()`
4. For each chunk in the async iterator, posts `{ type: 'CHUNK', content: chunk }` back on the port
5. On completion, posts `{ type: 'DONE' }` and calls `session.destroy()`

**Step 5 — Handle rate limits and quota**
Chrome built-in AI has per-session token limits. External APIs have rate limits and cost.
- Per session: call `session.destroy()` after each summary to free context window
- External API: implement exponential backoff on 429 responses (1s, 2s, 4s, cap 30s)
- User-facing: show token usage in settings panel if using external API

**Step 6 — Test offline behavior**
Extensions may run without network. Test:
- Built-in Nano: works offline (on-device model)
- External API: fails offline — catch `TypeError: Failed to fetch` and show "No network connection" message
- Storage: `chrome.storage.local` works offline
- Service worker: registers and responds to messages offline

#### Example

```typescript
// src/lib/ai.ts — AI integration with graceful fallback
import { storageGet } from './storage';

export interface AiSummaryResult {
  summary: string;
  source: 'builtin' | 'external' | 'error';
  error?: string;
}

// Check and cache Nano capability
export async function getNanoCapability(): Promise<'readily' | 'after-download' | 'no'> {
  // Check session cache first (avoid repeated API calls)
  const cached = await chrome.storage.session.get('nanoCapability');
  if (cached['nanoCapability']) return cached['nanoCapability'] as 'readily' | 'after-download' | 'no';

  const caps = await chrome.aiLanguageModel.capabilities();
  await chrome.storage.session.set({ nanoCapability: caps.available });
  return caps.available;
}

// Tier 1: Gemini Nano (built-in, on-device)
async function summarizeWithNano(text: string): Promise<string> {
  const capability = await getNanoCapability();

  if (capability === 'no') {
    throw new Error('NotSupportedError: Built-in AI not available on this device');
  }

  if (capability === 'after-download') {
    // Notify UI that model is downloading — caller can show progress
    // Download starts automatically when create() is called
    chrome.runtime.sendMessage({ type: 'AI_DOWNLOADING' });
  }

  const session = await chrome.aiLanguageModel.create({
    systemPrompt: 'You are a concise summarizer. Summarize the provided text in 3-5 sentences.',
  });

  try {
    const summary = await session.prompt(
      `Summarize this text:\n\n${text.slice(0, 4000)}` // context window limit
    );
    return summary;
  } finally {
    session.destroy(); // always destroy to free resources
  }
}

// Tier 2: External API (OpenAI-compatible)
async function summarizeWithExternalApi(text: string): Promise<string> {
  const settings = await storageGet('settings');
  if (!settings.externalApiKey) {
    throw new Error('No external API key configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.externalApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize the provided text in 3-5 sentences.' },
          { role: 'user', content: text.slice(0, 8000) },
        ],
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error('RateLimitError');
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message.content ?? '';
  } finally {
    clearTimeout(timeoutId);
  }
}

// Orchestrator — tries each tier in order
export async function summarize(text: string): Promise<AiSummaryResult> {
  const settings = await storageGet('settings');

  if (settings.useBuiltinAI) {
    try {
      const summary = await summarizeWithNano(text);
      return { summary, source: 'builtin' };
    } catch (err) {
      console.warn('[AI] Nano failed, falling back to external API:', err);
    }
  }

  if (settings.externalApiKey) {
    try {
      const summary = await summarizeWithExternalApi(text);
      return { summary, source: 'external' };
    } catch (err) {
      console.error('[AI] External API failed:', err);
      return {
        summary: '',
        source: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  return {
    summary: '',
    source: 'error',
    error: 'No AI source available. Enable built-in AI or configure an external API key in Settings.',
  };
}
```

```typescript
// Streaming with port (service worker side)
// background.ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return;

  let session: chrome.aiLanguageModel.LanguageModel | null = null;

  port.onMessage.addListener(async (message: { text: string }) => {
    try {
      const capability = await getNanoCapability();
      if (capability === 'no') throw new Error('NotSupportedError');

      session = await chrome.aiLanguageModel.create({
        systemPrompt: 'Summarize concisely.',
      });

      const stream = session.promptStreaming(
        `Summarize:\n\n${message.text.slice(0, 4000)}`
      );

      let previous = '';
      for await (const chunk of stream) {
        // Chrome's streaming returns cumulative text — extract the delta
        const delta = chunk.slice(previous.length);
        previous = chunk;
        port.postMessage({ type: 'CHUNK', content: delta });
      }

      port.postMessage({ type: 'DONE' });
    } catch (err) {
      port.postMessage({ type: 'ERROR', error: String(err) });
    } finally {
      session?.destroy();
      session = null;
    }
  });

  port.onDisconnect.addListener(() => {
    session?.destroy();
    session = null;
  });
});
```

---

## Connections

```
Calls → sentinel (L2): security audit on permissions, CSP, and storage patterns
Calls → verification (L3): validate TypeScript types, run extension build
Calls → git (L3): semantic commit after scaffold or publish prep
Called By ← cook (L1): when Chrome extension project context detected
Called By ← scaffold (L1): when user requests new browser extension project
Called By ← launch (L1): pre-flight check before CWS submission
Called By ← preflight (L2): runs cws-preflight as part of broader pre-deploy audit
```

## Tech Stack Support

| Build Tool | Plugin | Hot Reload | Notes |
|------------|--------|------------|-------|
| Vite 5 | @crxjs/vite-plugin | Yes | Best DX — recommended for MV3 |
| Webpack 5 | chrome-extension-webpack | Partial | Mature, more config overhead |
| Parcel 2 | @parcel/config-webextension | Yes | Zero-config option |
| Vanilla tsc | Manual copy scripts | No | Fine for simple extensions |

| API | Min Chrome Version | Notes |
|-----|-------------------|-------|
| chrome.sidePanel | 114 | Sidebar panel (replaces popup for persistent UI) |
| chrome.aiLanguageModel | 138 | Gemini Nano — built-in LLM |
| chrome.aiSummarizer | 138 | Specialized summarization API |
| chrome.offscreen | 109 | Background DOM/audio access workaround |
| chrome.storage.session | 102 | Session storage surviving SW termination |

## Constraints

1. MUST register ALL chrome.* event listeners synchronously at the top level of the service worker — listeners registered inside async functions, Promises, or setTimeout are silently ignored after the first service worker termination.
2. MUST NOT store any state in service worker JS variables that must survive beyond the current event — use `chrome.storage.session` for ephemeral state and `chrome.storage.local` for persistent state.
3. MUST NOT load scripts from external URLs — no CDN `<script>` tags in HTML files, no `import()` from external URLs — these trigger automatic CWS rejection with no appeal path.
4. MUST check `chrome.aiLanguageModel.capabilities()` before calling `create()` and implement graceful fallback — hardware requirements (22GB disk, 4GB VRAM or 16GB RAM) are not met on most user machines.
5. MUST use ports (not sendMessage) for streaming AI responses — sendMessage is one-shot and cannot carry multiple chunks.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Event listener registered inside `addEventListener('load', ...)` or async IIFE — silently ignored after SW termination | CRITICAL | Grep for `onMessage.addListener` not at module top level; scaffold always generates top-level listeners |
| `setTimeout` keepalive hack breaks on Chrome 119+ — Chrome patched the timeout extension trick | HIGH | Use `chrome.alarms` for periodic work; use `chrome.storage.session` for state; never rely on SW staying alive |
| `sendMessage` returns `undefined` when no listener responds — mistaken for success | HIGH | Check `chrome.runtime.lastError` in callback; use typed response interface that includes `error?: string` |
| Streaming AI returns cumulative text (not delta chunks) — UI duplicates content | HIGH | Slice previous from current: `const delta = chunk.slice(prev.length); prev = chunk` |
| `chrome.tabs.sendMessage` throws when content script not yet injected or tab is restricted | HIGH | Wrap in try/catch; check `sender.tab` exists; use `executeScript` to inject first if needed |
| Extension passes local testing but fails CWS review for `eval()` in bundled node_modules | CRITICAL | Run `grep -r "eval(" node_modules/` before submission; replace or patch offending dependency |

## Done When

- `manifest.json` has no declared permissions absent from source code (verified by Grep)
- Service worker registers all listeners synchronously at module top level — no listener inside async function
- `chrome.storage` is used for all state — no JS variables relied upon to survive termination
- No `eval()`, `Function()`, remote `<script>` tags, or external `import()` in any source or bundled file
- `cws-preflight` report shows no FAIL items and WARN items are reviewed
- `chrome.aiLanguageModel.capabilities()` is checked before use and graceful fallback is implemented
- Streaming AI uses port-based messaging and correctly extracts deltas from cumulative chunks
- Store listing copy is under character limits, permission justifications are written in plain English
- Extension loads in Chrome via `chrome://extensions → Load unpacked` without errors

## Cost Profile

~1,500–3,000 tokens per skill activation. `haiku` for file scans (Grep, Glob, manifest reading); `sonnet` for scaffold generation, storage schema, and message type definitions; `sonnet` for cws-preflight audit and store listing copy; `sonnet` for AI integration wiring. Full pack activation (all 6 skills) runs ~12,000–18,000 tokens end-to-end. `cws-preflight` is the heaviest single skill (~3,000 tokens) due to multi-pass scanning.
