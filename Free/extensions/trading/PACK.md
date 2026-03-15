---
name: "@rune/trading"
description: Fintech and trading patterns — real-time data, financial dashboards, technical indicators, WebSocket architecture, and experiment-driven strategy development.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$15"
  target: Fintech developers
---

# @rune/trading

## Purpose

Fintech applications demand precision that general-purpose patterns cannot guarantee. This pack groups five tightly-coupled concerns — safe money arithmetic, WebSocket reliability, financial chart rendering, streaming indicator computation, and experiment-driven strategy development — because a gap in any one layer breaks the entire trading surface. It solves the recurring problem of developers accidentally using JavaScript floats for currency, missing auto-reconnect logic, or computing indicators on stale snapshots. Activates automatically when trading or financial project signals are detected.

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

---

### trade-logic

Trading logic preservation and reasoning — entry/exit spec management, indicator parameter registry, strategy state tracking, and backtest result linkage. Prevents the #1 trading bot failure: AI sessions overwriting working logic without understanding it.

#### Workflow

**Step 1 — Load trading logic context**
Check if `logic-guardian` (L2) has a manifest loaded. If `.rune/logic-manifest.json` exists, read it and extract trading-specific components (ENTRY_LOGIC, EXIT_LOGIC, FILTER, INDICATOR). If no manifest exists, trigger `logic-guardian` Phase 3 to generate one with trading-aware scanning.

Trading-specific file patterns to scan:
- `**/scenarios/**`, `**/signals/**`, `**/strategies/**` — entry/exit logic
- `**/trailing/**`, `**/exit/**`, `**/stoploss/**` — exit engine components
- `**/indicators/**`, `**/core/indicators*` — technical indicator implementations
- `**/backtest/**`, `**/engine*` — backtesting mirrors of production logic
- `**/config/settings*`, `**/config/token*` — parameter source of truth

**Step 2 — Build trading logic spec**
For each trading component, extract a structured spec:

```
COMPONENT: RSI Entry Detector
TYPE: ENTRY_LOGIC
STATUS: ACTIVE (production)
LAYERS: [which layer in the trading pipeline this belongs to]

ENTRY CONDITIONS:
  1. TrendPass ticket exists with available fires
  2. RSI_MA crosses threshold (65 LONG / 35 SHORT)
  3. Previous RSI in entry zone (30-55 LONG / 45-70 SHORT)
  4. RSI crosses RSI_MA + 40% TF filter + EMA filter

PARAMETERS:
  - rsi_period: 7 (source: settings.py)
  - challenge_threshold_long: 65 (source: settings.py)
  - entry_zone_long: [30, 55] (source: settings.py)

DEPENDENCIES: trend_pass.tracker, core.indicators
MIRROR: backtest/engine.py (must stay in sync with production)
```

**Step 3 — Enforce production-backtest sync**
For trading bots, production logic and backtest logic MUST be mirrors. Scan for:
- Production file: `src/worker/production_worker.py` or equivalent
- Backtest file: `backtest/engine.py` or equivalent
- Compare entry/exit function signatures and conditional branches
- Flag any divergence: "Production uses condition X but backtest doesn't"

**Step 4 — Parameter registry**
Build a parameter registry linking every configurable threshold to its source:
- Single source of truth file (e.g., `settings.py`)
- Per-token overrides (e.g., `token_config.py`, `final_config.json`)
- Scan for hardcoded magic numbers in logic files that should be in config
- Flag: "Hardcoded value 65 in detect.py:L42 — should reference settings.CHALLENGE_THRESHOLD_LONG"

**Step 5 — Strategy state machine documentation**
If the trading logic uses a multi-step state machine (e.g., 3-step RSI entry):
- Document each state and its transition conditions
- Generate a state diagram in text format
- Save to manifest as `state_machine` field on the component

```
State Machine: RSI Entry
  [IDLE] --ticket_exists--> [STEP1_CHALLENGE]
  [STEP1_CHALLENGE] --rsi_ma_crosses_threshold--> [STEP2_ZONE_CHECK]
  [STEP2_ZONE_CHECK] --prev_rsi_in_zone--> [STEP3_ENTRY_POINT]
  [STEP3_ENTRY_POINT] --rsi_crosses_rsi_ma + filters--> [SIGNAL_EMITTED]
  [any_step] --ticket_expired--> [IDLE]
```

**Step 6 — Backtest result linkage**
Link logic components to their backtest performance:
- Scan `backtest/scan_results/` or equivalent for result files
- Associate each strategy variant with its performance metrics
- Record in manifest: "RSI Entry v5 with EMA Follow: $20,445 over 6mo backtest"
- Flag if logic was modified AFTER the latest backtest: "Logic changed since last backtest — results may be invalid"

#### Example

```python
# trade-logic generates this spec from code analysis:
# COMPONENT: EMA Follow Exit
# TYPE: EXIT_LOGIC
# STATUS: ACTIVE
# BUG_HISTORY: 2026-02-22 fixed wick detection (was using close, now uses candle_low/high)
#
# EXIT CONDITION:
#   if candle_wick crosses EMA120 -> exit position
#   (NOT candle_close — this was the V4 bug)
#
# PARAMETERS:
#   ema_period: 120 (source: settings.py)
#   use_wick: True (source: settings.py, changed from False in V4)
#
# MIRROR: backtest/exit_checker.py:check_ema_follow()
# BACKTEST: $22,481 (x2.0 adaptive variant, validated 2026-02-22)
```

---

### experiment-loop

Scientific method for trading strategy development — hypothesize → implement → backtest → analyze → refine. Prevents the #1 strategy development failure: changing parameters randomly without tracking what was tested, what worked, and why.

#### Workflow

**Step 1 — Define hypothesis**
Every strategy change starts as a falsifiable hypothesis:
```
HYPOTHESIS: [What you believe]
EVIDENCE: [Why you believe it — chart observation, backtest anomaly, market regime]
TEST: [How to verify — specific backtest config, date range, token set]
SUCCESS CRITERIA: [Measurable threshold — "win rate > 55% AND max drawdown < 15%"]
FAILURE CRITERIA: [When to reject — "win rate < 45% OR drawdown > 25%"]
```

Check `.rune/experiments/` for prior experiments on the same component. If a similar hypothesis was already tested and rejected, flag it: "This was tested in experiment #12 and rejected because [reason]. Proceed anyway?"

**Step 2 — Implement variant**
Create the strategy variant in an isolated branch or config:
- Use `Grep` to find the parameter or logic being changed
- Create a named variant (e.g., `rsi_entry_v6_longer_period`) — NEVER modify the production logic directly
- Document the exact change: "Changed RSI period from 7 to 14, challenge threshold from 65 to 60"
- If logic change (not just parameter): ensure backtest engine mirrors the change (production-backtest sync from `trade-logic`)

**Step 3 — Run backtest**
Execute backtest against the defined test conditions:
- Use `Bash` to run the backtest command with the variant config
- Capture results: total PnL, win rate, max drawdown, Sharpe ratio, number of trades
- Compare against the control (current production parameters)
- Record execution time and date range

**Step 4 — Analyze results**
Structured analysis against success/failure criteria:

```
EXPERIMENT #14: RSI Period 14 vs 7
STATUS: REJECTED ❌

RESULTS:
  | Metric        | Control (v5) | Variant (v6) | Δ       |
  |---------------|-------------|-------------|---------|
  | Total PnL     | $20,445     | $18,200     | -$2,245 |
  | Win Rate      | 58.3%       | 52.1%       | -6.2%   |
  | Max Drawdown  | 12.4%       | 14.8%       | +2.4%   |
  | Sharpe Ratio  | 1.42        | 1.18        | -0.24   |
  | Trade Count   | 156         | 89          | -67     |

CONCLUSION: Longer RSI period reduces signal frequency by 43% without
improving quality. Win rate dropped below 55% threshold. REJECTED.

INSIGHT: RSI 7 captures mean-reversion signals faster on 15m timeframe.
Longer periods may suit 4H+ timeframes (not tested — add to backlog).
```

**Step 5 — Record and route**
Save experiment to `.rune/experiments/<number>-<name>.md`:
- If **ACCEPTED**: update production parameters → run `trade-logic` to sync manifest → commit
- If **REJECTED**: record conclusion and insight → add derived hypotheses to backlog
- If **INCONCLUSIVE**: define additional test conditions or longer date range → re-run
- Link to the experiment from `trade-logic` manifest: "RSI Entry v5: validated by experiment #14"

Update experiment index `.rune/experiments/index.md`:
```
| # | Hypothesis | Component | Status | Key Metric | Date |
|---|-----------|-----------|--------|------------|------|
| 14 | RSI 14 > RSI 7 | rsi_entry | ❌ Rejected | WR 52% < 55% | 2025-03-15 |
| 13 | EMA 120 wick exit | ema_follow | ✅ Accepted | PnL +$2,036 | 2025-03-10 |
```

#### Example

```python
# Experiment runner pattern
from dataclasses import dataclass
from decimal import Decimal

@dataclass(frozen=True)
class ExperimentConfig:
    name: str
    hypothesis: str
    variant_params: dict[str, str | int | float]
    control_params: dict[str, str | int | float]
    date_range: tuple[str, str]
    tokens: list[str]
    success_criteria: dict[str, tuple[str, float]]  # metric: (operator, threshold)

@dataclass(frozen=True)
class ExperimentResult:
    config: ExperimentConfig
    control_metrics: dict[str, Decimal]
    variant_metrics: dict[str, Decimal]
    status: str  # 'accepted' | 'rejected' | 'inconclusive'
    conclusion: str
    insights: list[str]

def evaluate_experiment(result: ExperimentResult) -> str:
    """Evaluate variant against success criteria."""
    for metric, (op, threshold) in result.config.success_criteria.items():
        variant_val = result.variant_metrics.get(metric, Decimal('0'))
        if op == '>' and variant_val <= Decimal(str(threshold)):
            return 'rejected'
        if op == '<' and variant_val >= Decimal(str(threshold)):
            return 'rejected'
    return 'accepted'

# Usage:
# config = ExperimentConfig(
#     name="rsi_period_14",
#     hypothesis="RSI 14 captures better signals than RSI 7 on 15m",
#     variant_params={"rsi_period": 14, "challenge_threshold": 60},
#     control_params={"rsi_period": 7, "challenge_threshold": 65},
#     date_range=("2024-09-01", "2025-03-01"),
#     tokens=["BTCUSDT", "ETHUSDT", "SOLUSDT"],
#     success_criteria={"win_rate": (">", 0.55), "max_drawdown": ("<", 0.15)},
# )
```

### quant-analysis

Quantitative analysis patterns — portfolio metrics, risk calculations, statistical edge detection, Monte Carlo simulation, and position sizing models.

#### Workflow

**Step 1 — Define analysis scope**
Determine what the user needs: portfolio-level metrics (Sharpe, Sortino, max drawdown, VaR), strategy-level analysis (win rate, profit factor, expectancy, risk-of-ruin), or position sizing (Kelly criterion, fixed fractional, volatility-adjusted). Load trade history from data source (CSV, database query, API response).

**Step 2 — Calculate core metrics**
For portfolio analysis:
- **Sharpe Ratio**: (mean return - risk-free rate) / std(returns). Annualize with √252.
- **Sortino Ratio**: (mean return - risk-free rate) / downside_std. Only penalizes downside volatility.
- **Max Drawdown**: Largest peak-to-trough decline. Include recovery time.
- **Value at Risk (VaR)**: 95th/99th percentile loss using historical simulation or parametric method.
- **Calmar Ratio**: Annualized return / max drawdown. > 1.0 = good risk-adjusted return.

For strategy analysis:
- **Expectancy**: (win_rate × avg_win) - (loss_rate × avg_loss). Must be positive.
- **Profit Factor**: gross_profit / gross_loss. > 1.5 = viable, > 2.0 = strong.
- **Risk of Ruin**: probability of losing X% of capital given win rate and risk per trade.

**Step 3 — Monte Carlo simulation**
Run 10,000 random resamples of the trade sequence to estimate:
- Probability of reaching profit target within N trades
- Confidence interval for max drawdown (95th percentile)
- Optimal position size that maximizes geometric growth (Kelly fraction)

Emit results as structured data + visualization-ready format for `chart-components`.

**Step 4 — Position sizing recommendation**
Based on Monte Carlo results, recommend:
- **Conservative**: Half-Kelly (50% of optimal Kelly fraction)
- **Moderate**: Full Kelly
- **Aggressive**: 1.5x Kelly (with warning about increased ruin probability)

Save analysis to `.rune/trading/quant-analysis-<date>.md`.

#### Example

```typescript
import Decimal from 'decimal.js';

interface TradeResult {
  pnl: Decimal;
  entryPrice: Decimal;
  exitPrice: Decimal;
  size: Decimal;
  duration: number; // minutes
}

interface QuantMetrics {
  totalTrades: number;
  winRate: Decimal;
  profitFactor: Decimal;
  expectancy: Decimal;
  sharpeRatio: Decimal;
  sortinoRatio: Decimal;
  maxDrawdown: Decimal;
  maxDrawdownDuration: number;
  calmarRatio: Decimal;
  valueAtRisk95: Decimal;
  kellyFraction: Decimal;
  riskOfRuin: Decimal;
}

function calculateExpectancy(trades: TradeResult[]): Decimal {
  const wins = trades.filter(t => t.pnl.gt(0));
  const losses = trades.filter(t => t.pnl.lte(0));
  const winRate = new Decimal(wins.length).div(trades.length);
  const avgWin = wins.length > 0
    ? wins.reduce((sum, t) => sum.plus(t.pnl), new Decimal(0)).div(wins.length)
    : new Decimal(0);
  const avgLoss = losses.length > 0
    ? losses.reduce((sum, t) => sum.plus(t.pnl.abs()), new Decimal(0)).div(losses.length)
    : new Decimal(0);
  return winRate.mul(avgWin).minus(new Decimal(1).minus(winRate).mul(avgLoss));
}

function kellyFraction(winRate: Decimal, avgWinLossRatio: Decimal): Decimal {
  // Kelly: f* = (p * b - q) / b where p=winRate, q=1-p, b=avgWin/avgLoss
  const q = new Decimal(1).minus(winRate);
  return winRate.mul(avgWinLossRatio).minus(q).div(avgWinLossRatio);
}

// Monte Carlo: resample trades 10,000 times
function monteCarloDrawdown(trades: TradeResult[], simulations = 10000): Decimal {
  const drawdowns: Decimal[] = [];
  for (let i = 0; i < simulations; i++) {
    const shuffled = [...trades].sort(() => Math.random() - 0.5);
    let peak = new Decimal(0), maxDd = new Decimal(0), equity = new Decimal(0);
    for (const t of shuffled) {
      equity = equity.plus(t.pnl);
      if (equity.gt(peak)) peak = equity;
      const dd = peak.minus(equity).div(peak.gt(0) ? peak : new Decimal(1));
      if (dd.gt(maxDd)) maxDd = dd;
    }
    drawdowns.push(maxDd);
  }
  drawdowns.sort((a, b) => a.cmp(b));
  return drawdowns[Math.floor(simulations * 0.95)]; // 95th percentile
}
```

---

## Connections

```
Calls → @rune/ui (L4): chart component styling, color tokens, responsive layout
Called By ← cook (L1): when trading project detected
Called By ← launch (L1): pre-flight check for financial dashboards
Called By ← logic-guardian (L2): when project is classified as trading domain
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
