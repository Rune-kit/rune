---
name: browser-pilot
description: Playwright browser automation. Navigates URLs, takes screenshots, checks accessibility tree, interacts with UI elements, and reports findings.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L3
  model: sonnet
  group: media
---

# browser-pilot

## Purpose

Browser automation for testing and verification using MCP Playwright tools. Navigates to URLs, captures accessibility snapshots and screenshots, interacts with UI elements (click, type, fill form), and reports findings with visual evidence.

## Called By (inbound)

- `test` (L2): e2e and visual testing
- `deploy` (L2): verify live deployment
- `debug` (L2): capture browser console errors
- `marketing` (L2): screenshot for assets
- `launch` (L1): verify live site after deployment
- `perf` (L2): Lighthouse / Core Web Vitals measurement

## Calls (outbound)

None — pure L3 utility using Playwright MCP tools.

## Executable Instructions

### Step 1: Receive Task

Accept input from calling skill:
- `url` — target URL to open
- `task` — what to do: `screenshot` | `check_elements` | `fill_form` | `test_flow` | `console_errors`
- `interactions` — optional list of actions (click X, type Y into Z, etc.)

### Step 2: Navigate

Open the target URL using the Playwright MCP navigate tool:

```
mcp__plugin_playwright_playwright__browser_navigate({ url: "<url>" })
```

Wait for the page to load. If navigation fails (timeout or error), report UNREACHABLE and stop.

### Step 3: Snapshot

Capture the accessibility tree to understand page structure:

```
mcp__plugin_playwright_playwright__browser_snapshot()
```

Use the snapshot to:
- Identify interactive elements (buttons, inputs, links)
- Find specific elements referenced in the task
- Detect accessibility issues (missing labels, roles)

### Step 4: Interact

Based on the task, perform interactions using Playwright MCP tools:

- **Click**: `mcp__plugin_playwright_playwright__browser_click({ ref: "<ref>", element: "<description>" })`
- **Type**: `mcp__plugin_playwright_playwright__browser_type({ ref: "<ref>", text: "<value>" })`
- **Fill form**: `mcp__plugin_playwright_playwright__browser_fill_form({ fields: [...] })`
- **Navigate back**: `mcp__plugin_playwright_playwright__browser_navigate_back()`
- **Select option**: `mcp__plugin_playwright_playwright__browser_select_option({ ref: "<ref>", values: [...] })`

Limit: max 20 interactions per session. If the task requires more, stop and report partial results.

After each interaction, take a new snapshot to verify the result before proceeding.

### Step 5: Screenshot

Capture visual evidence:

```
mcp__plugin_playwright_playwright__browser_take_screenshot({ type: "png" })
```

For full-page capture (landing pages, long content):

```
mcp__plugin_playwright_playwright__browser_take_screenshot({ type: "png", fullPage: true })
```

Save with a descriptive filename if the `filename` param is supported.

### Step 6: Report

Compile findings into a structured report:

```
## Browser Report: [url]

- **Task**: [task description]
- **Status**: SUCCESS | PARTIAL | FAILED

### Page Info
- HTTP Status: [status]
- Load outcome: [loaded | timeout | error]

### Accessibility Findings
- [finding from snapshot — missing labels, broken roles, etc.]

### Interaction Log
- [action taken] → [result: success | element not found | error]

### Console Errors
- [error message — source]

### Screenshots
- [screenshot path or description]

### Summary
- [overall assessment — what works, what failed, any critical issues]
```

### Step 7: Close

Always close the browser when done:

```
mcp__plugin_playwright_playwright__browser_close()
```

This step is mandatory even if earlier steps fail. Use a try-finally pattern in your reasoning.

## Constraints

1. MUST close browser when done — Step 7 is non-optional even if earlier steps fail
2. MUST NOT exceed 20 interactions per session
3. MUST NOT store credentials or sensitive data in interaction logs
4. MUST take screenshot evidence before reporting visual findings

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Not closing browser when done (including on error) | CRITICAL | Constraint 1: Step 7 browser_close() is mandatory — treat as try-finally |
| Storing credentials or tokens in interaction logs | HIGH | Constraint 3: redact all sensitive values before logging |
| Exceeding 20 interactions without stopping and reporting partial | MEDIUM | Constraint 2: stop at 20, report what was tested and what remains |
| Reporting visual findings without screenshot evidence | MEDIUM | Constraint 4: screenshot before reporting — "looks broken" without screenshot is invalid |

## Done When

- URL navigated successfully (or UNREACHABLE reported)
- Page snapshot captured for accessibility context
- All requested interactions completed (or partial with reason if >20)
- Screenshot taken as visual evidence
- Console errors captured if task requested them
- Browser closed (Step 7 executed)
- Browser Report emitted with status, findings, and screenshot reference

## Cost Profile

~500-1500 tokens input, ~300-800 tokens output. Sonnet for interaction logic.
