---
name: "ext-ai-integration"
pack: "@rune/chrome-ext"
description: "Chrome built-in AI and external API integration — detect AI type, check hardware requirements, implement Gemini Nano with graceful fallback, wire streaming responses via ports, handle rate limits, and test offline behavior."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# ext-ai-integration

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
        model: 'gpt-6-luna',
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
