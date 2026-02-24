---
name: browser-pilot
description: Browser automation — open URLs, take screenshots, extract console/network errors, run Lighthouse audits, and fill forms.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L3
  model: sonnet
  group: media
---

# browser-pilot

## Purpose

Browser automation for testing and verification. Opens URLs, takes screenshots, extracts console errors and network failures, runs Lighthouse audits, and performs basic form interactions. Used for e2e testing, deploy verification, and visual regression.

## Triggers

- Called by L2 skills needing browser interaction

## Calls (outbound)

None — pure L3 utility using Playwright MCP tools.

## Called By (inbound)

- `test` (L2): e2e and visual testing
- `deploy` (L2): verify live deployment
- `debug` (L2): capture browser console errors
- `marketing` (L2): screenshot for assets
- `launch` (L1): verify live site after deployment

## Capabilities

```
NAVIGATE     — open URL, wait for load
SCREENSHOT   — full page, viewport, specific element
CONSOLE      — extract errors, warnings, logs
NETWORK      — capture failed requests, slow responses
LIGHTHOUSE   — performance, accessibility, SEO scores
INTERACT     — click buttons, fill forms, select options
COMPARE      — visual snapshot comparison (before/after)
```

## Workflow

1. Receive target URL and task description from calling skill (test / deploy / debug)
2. Launch Playwright browser session and navigate to the target URL
3. Execute navigation and interaction steps — click, fill, select as required by the task
4. Capture screenshots, console errors, network failures, and Lighthouse scores
5. Return browser report with evidence (screenshots, error logs, performance metrics)

## Output Format

```
## Browser Report: [URL]
- **Status**: [HTTP status]
- **Load Time**: [duration]

### Console Errors
- [error message with source]

### Screenshots
- [saved screenshot paths]

### Lighthouse (if run)
- Performance: [score]
- Accessibility: [score]
- SEO: [score]
```

## Cost Profile

~500-1500 tokens input, ~300-800 tokens output. Sonnet for interaction logic.
