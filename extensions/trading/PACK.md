---
name: "@rune/trading"
description: Fintech and trading patterns — real-time data, financial dashboards, technical indicators, and WebSocket architecture.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$15"
  target: Fintech developers
---

# @rune/trading

## Purpose

Fintech applications demand precision that general-purpose patterns cannot guarantee. This pack groups four tightly-coupled concerns — safe money arithmetic, WebSocket reliability, financial chart rendering, and streaming indicator computation — because a gap in any one layer breaks the entire trading surface. It solves the recurring problem of developers accidentally using JavaScript floats for currency, missing auto-reconnect logic, or computing indicators on stale snapshots. Activates automatically when trading or financial project signals are detected.

## Triggers

- Auto-trigger: when `TradingView`, `Lightweight Charts`, `decimal.js`, `ccxt`, or `ws` detected in `package.json`
- Auto-trigger: when files matching `**/price*.ts`, `**/ticker*.ts`, `**/orderbook*.ts` exist in project
- `/rune trading` — manual invocation
- Called by `cook` (L1) when fintech or trading project context detected

## Skills Included

### fintech-patterns

Financial application patterns — safe money handling with Decimal/BigInt, transaction processing, audit trails, regulatory compliance, and PnL calculations. Prevents the #1 fintech bug: float arithmetic on money.

#### Workflow

**Step 1 — Detect money handling code**
Use `Grep` to scan for raw float arithmetic on price/amount/balance fields: `Grep pattern="(price|amount|balance|pnl)\s*[\+\-\*\/]" glob="**/*.ts"`. Flag any result not wrapped in Decimal or BigInt.

**Step 2 — Enforce Decimal/BigInt boundaries**
Use `Read` on each flagged file to identify entry points (API response parsing, user input). Replace raw number literals with `new Decimal(value)` at parse time. All arithmetic must flow through Decimal operations until final display.

**Step 3 — Implement audit trail and verify rounding**
Use `Bash` to run `tsc --noEmit` confirming no implicit `any` on financial fields. Add an immutable audit log entry on every mutation (create, fill, cancel). Verify rounding mode is `ROUND_HALF_EVEN` (banker's rounding) for all display formatting.

#### Example

```typescript
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

// NEVER: const fee = price * 0.001
// ALWAYS: Decimal arithmetic — exact, auditable
function calculateFee(price: string, quantity: string, feeRate: string): Decimal {
  return new Decimal(price)
    .times(new Decimal(quantity))
    .times(new Decimal(feeRate))
    .toDecimalPlaces(8);
}

function formatUSD(value: Decimal): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value.toNumber());
}
```

---

### realtime-data

Real-time data architecture — WebSocket lifecycle management, auto-reconnect with exponential backoff, event normalization, rate limiting, and TanStack Query cache invalidation.

#### Workflow

**Step 1 — WebSocket setup and event normalization**
Use `Read` on existing data-fetching files to understand current polling or REST patterns. Replace with a WebSocket client class that emits typed, normalized events regardless of upstream message format. Define a `NormalizedTick` interface at the boundary.

**Step 2 — Implement exponential backoff reconnect**
In the WebSocket class, add a reconnect handler: attempt 1 after 1 s, attempt 2 after 2 s, attempt 3 after 4 s, cap at 30 s. Use `Bash` to run unit tests covering disconnect and reconnect sequences. Track `reconnectAttempts` in state; reset to 0 on successful open.

**Step 3 — Wire to TanStack Query cache invalidation**
On each normalized event received, call `queryClient.setQueryData(['ticker', symbol], tick)` for optimistic updates or `queryClient.invalidateQueries(['orderbook', symbol])` for full refresh. Use `Grep` to confirm no stale `setInterval` polling remains alongside the new WebSocket feed.

#### Example

```typescript
class TradingWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_DELAY_MS = 30_000;

  connect(url: string, onTick: (tick: NormalizedTick) => void): void {
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      const raw = JSON.parse(event.data as string);
      onTick(this.normalize(raw));
    };

    this.ws.onclose = () => {
      const delay = Math.min(
        1000 * 2 ** this.reconnectAttempts,
        this.MAX_DELAY_MS,
      );
      this.reconnectAttempts += 1;
      setTimeout(() => this.connect(url, onTick), delay);
    };

    this.ws.onopen = () => { this.reconnectAttempts = 0; };
  }

  private normalize(raw: unknown): NormalizedTick {
    // map exchange-specific shape to shared interface
    const r = raw as Record<string, unknown>;
    return { symbol: String(r['s']), price: String(r['p']), ts: Date.now() };
  }
}
```

---

### chart-components

Financial chart patterns — candlestick, line, and area charts using TradingView Lightweight Charts. Real-time update handlers, zoom, crosshair sync, indicator overlays, and responsive layout with reduced-motion support.

#### Workflow

**Step 1 — Detect chart library and configure chart instance**
Use `Grep` to check for `lightweight-charts` or `@tradingview/charting_library` in `package.json`. Initialize with `createChart(container, { autoSize: true, layout: { background: { color: '#0c1419' } } })`. Create a `CandlestickSeries` with green/red up/down colors matching the project palette.

**Step 2 — Real-time update handler**
Subscribe to the normalized WebSocket feed from `realtime-data`. On each tick, call `series.update({ time, open, high, low, close, volume })`. Batch rapid updates with `requestAnimationFrame` to avoid layout thrashing. Use `Read` to verify the container element is stable (not re-mounting on every render).

**Step 3 — Responsive layout and reduced-motion**
Use `Bash` to run `window.matchMedia('(prefers-reduced-motion: reduce)')` check at init time. When true, disable chart animations (`animation: { duration: 0 }`). Add `ResizeObserver` on the container and call `chart.applyOptions({ width, height })` on size change.

#### Example

```typescript
import { createChart, CandlestickSeries } from 'lightweight-charts';

function initCandlestickChart(container: HTMLElement): CandlestickSeries {
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  const chart = createChart(container, {
    autoSize: true,
    layout: { background: { color: '#0c1419' }, textColor: '#a0aeb8' },
    grid: { vertLines: { color: '#2a3f52' }, horzLines: { color: '#2a3f52' } },
    crosshair: { mode: 1 },
    animation: { duration: reducedMotion ? 0 : 300 },
  });

  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#00d084',
    downColor: '#ff6b6b',
    borderVisible: false,
    wickUpColor: '#00d084',
    wickDownColor: '#ff6b6b',
  });

  new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }))
    .observe(container);

  return series;
}
```

---

### indicator-library

Technical indicator implementations — SMA, EMA, RSI, MACD, Bollinger Bands, VWAP. Streaming calculation patterns that update incrementally on each new tick rather than recomputing the full history.

#### Workflow

**Step 1 — Select indicators and initialize state**
Use `Read` on the product spec or existing chart config to identify required indicators. For each, allocate a rolling window buffer sized to the longest period (e.g., 200 for SMA-200). Initialize with historical OHLCV data fetched via REST before the WebSocket feed opens.

**Step 2 — Streaming incremental calculation**
On each new tick from `realtime-data`, push the close price into the rolling buffer and evict the oldest value. Recompute only the current indicator value — not the full series. For RSI, maintain running average gains/losses using Wilder smoothing. Use `Bash` to run unit tests comparing streaming output against a reference batch computation.

**Step 3 — Overlay on chart component**
Create a `LineSeries` on the chart instance from `chart-components` for each indicator. On each streaming update, call `indicatorSeries.update({ time, value })`. Use `Grep` to confirm indicator series are cleaned up (`chart.removeSeries(s)`) when the symbol or timeframe changes to prevent memory leaks.

#### Example

```typescript
class StreamingSMA {
  private readonly window: number[] = [];

  constructor(private readonly period: number) {}

  update(price: number): number | null {
    this.window.push(price);
    if (this.window.length > this.period) {
      this.window.shift();
    }
    if (this.window.length < this.period) return null;
    const sum = this.window.reduce((acc, v) => acc + v, 0);
    return sum / this.period;
  }
}

class StreamingEMA {
  private ema: number | null = null;
  private readonly k: number;

  constructor(private readonly period: number) {
    this.k = 2 / (period + 1);
  }

  update(price: number): number | null {
    this.ema = this.ema === null
      ? price
      : price * this.k + this.ema * (1 - this.k);
    return this.ema;
  }
}
```

## Connections

```
Calls → @rune/ui (L4): chart component styling, color tokens, responsive layout
Called By ← cook (L1): when trading project detected
Called By ← launch (L1): pre-flight check for financial dashboards
```

## Tech Stack Support

| Framework | Library | Notes |
|-----------|---------|-------|
| React 19 / Vite | Lightweight Charts 5.x | Preferred for custom dashboards |
| React 19 / Next.js | TradingView Charting Library | For advanced trading terminals |
| Any | Decimal.js 10.x | Required for all money arithmetic |
| Any | ws / native WebSocket | Auto-reconnect via `realtime-data` skill |
| React 19 | TanStack Query v5 | WebSocket → cache invalidation bridge |
| Any | date-fns-tz | Timezone-safe candle timestamp handling |

## Constraints

1. MUST use `Decimal` (decimal.js) or `BigInt` for ALL money calculations — NEVER JavaScript `number` floats on price, quantity, fee, or PnL fields.
2. MUST implement WebSocket auto-reconnect with exponential backoff — silent reconnect failures will silently stale the UI with no error signal.
3. MUST handle `prefers-reduced-motion` for all chart animations — financial dashboards are used in low-stimulation accessibility contexts.
4. MUST NOT store financial data (positions, balances, order history) in `localStorage` — use secure in-memory state management with explicit session boundaries.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Float arithmetic on price (`0.1 + 0.2 !== 0.3`) silently corrupts PnL | HIGH | Enforce Decimal.js at parse boundary; lint rule banning `*`, `+`, `-` on raw number price fields |
| WebSocket silently stops receiving after network blip with no reconnect | HIGH | Always attach `onclose` handler; test disconnect/reconnect in CI with a mock server |
| Chart series not removed on symbol change causes memory leak and ghost lines | HIGH | Track series refs; call `chart.removeSeries(s)` in cleanup / `useEffect` return |
| Indicator computed on float prices accumulates rounding drift over 1000+ ticks | MEDIUM | Feed Decimal-converted `toNumber()` only at the indicator boundary; document precision loss |
| `localStorage` used for auth token or balance cache exposes data to XSS | HIGH | Use `httpOnly` cookies or in-memory store; audit with `Grep pattern="localStorage" glob="**/*.ts"` |
| Candlestick timestamps in local timezone cause gaps on DST transitions | MEDIUM | Normalize all timestamps to UTC unix seconds at the WebSocket boundary |

## Done When

- All price/quantity/fee fields are wrapped in `Decimal` with no raw float arithmetic reachable by Grep
- WebSocket reconnects automatically after 5-second disconnect in manual or automated test
- Chart renders candlesticks and at least one indicator overlay without layout shift on resize
- Streaming indicator values match reference batch output within floating-point display tolerance
- `prefers-reduced-motion` disables chart animations (verified via browser devtools emulation)
- No `localStorage` usage for financial data (confirmed by Grep audit)

## Cost Profile

~2 000–4 000 tokens per skill activation. `sonnet` default for code generation; `haiku` for Grep/file-scan steps; `opus` if regulatory compliance or security audit context is detected. Full pack activation (all four skills) runs ~10 000–14 000 tokens end-to-end.
