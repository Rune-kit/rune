---
name: "@rune/analytics"
description: Analytics patterns — tracking setup, A/B testing, funnel analysis, and dashboard design.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$12"
  target: Growth engineers
---

# @rune/analytics

## Purpose

Analytics implementations fail silently: tracking events that fire but never reach the dashboard because the event name has a typo, A/B tests that run for weeks without reaching statistical significance because the sample size was never calculated, funnel reports that show a 90% drop-off that's actually a tracking gap, and dashboards that load 500K rows client-side because the aggregation happens in the browser instead of the database. This pack covers the full analytics stack — instrumentation, experimentation, analysis, and visualization — with patterns that produce data you can actually trust and act on.

## Triggers

- Auto-trigger: when `gtag`, `posthog`, `mixpanel`, `plausible`, `analytics`, `experiment`, `feature-flag`, `launchdarkly` detected
- `/rune tracking-setup` — set up or audit analytics tracking
- `/rune ab-testing` — design and implement A/B experiments
- `/rune funnel-analysis` — build conversion funnel tracking
- `/rune dashboard-patterns` — build analytics dashboard
- Called by `cook` (L1) when analytics feature requested
- Called by `marketing` (L2) when measuring campaign performance

## Skills Included

### tracking-setup

Analytics tracking — Google Analytics 4, Plausible, PostHog, Mixpanel. Event taxonomy design, consent management, server-side tracking, UTM handling.

#### Workflow

**Step 1 — Detect tracking setup**
Use Grep to find analytics code: `gtag`, `posthog.capture`, `mixpanel.track`, `plausible`, `analytics.track`, `useAnalytics`. Read the tracking initialization and event calls to understand: analytics provider, event naming convention, consent flow, and client vs server-side tracking.

**Step 2 — Audit tracking quality**
Check for: inconsistent event naming (mix of `snake_case`, `camelCase`, `kebab-case`), missing consent management (GDPR violation), tracking scripts blocking page load (performance impact), no event taxonomy document (ad-hoc event names), UTM parameters not captured on landing, user identification happening before consent, and no server-side tracking fallback (ad blockers lose 30-40% of events).

**Step 3 — Emit tracking patterns**
Emit: typed event taxonomy with auto-complete, consent-aware analytics wrapper, server-side event proxy for ad-blocker resistance, UTM capture and persistence utility, and page view tracking with proper SPA handling.

#### Example

```typescript
// Type-safe analytics wrapper with consent management
type AnalyticsEvent =
  | { name: 'page_view'; properties: { path: string; referrer: string } }
  | { name: 'signup_started'; properties: { method: 'email' | 'google' | 'github' } }
  | { name: 'feature_used'; properties: { feature: string; plan: string } }
  | { name: 'checkout_started'; properties: { plan: string; billing: 'monthly' | 'annual' } }
  | { name: 'checkout_completed'; properties: { plan: string; revenue: number; currency: string } };

class Analytics {
  private consent: 'granted' | 'denied' | 'pending' = 'pending';
  private queue: AnalyticsEvent[] = [];

  updateConsent(status: 'granted' | 'denied') {
    this.consent = status;
    if (status === 'granted') {
      this.queue.forEach(e => this.send(e));
      this.queue = [];
    } else {
      this.queue = [];
    }
  }

  track<E extends AnalyticsEvent>(event: E) {
    if (this.consent === 'denied') return;
    if (this.consent === 'pending') { this.queue.push(event); return; }
    this.send(event);
  }

  private send(event: AnalyticsEvent) {
    // Client-side (may be blocked)
    window.gtag?.('event', event.name, event.properties);
    // Server-side fallback (ad-blocker resistant)
    navigator.sendBeacon('/api/analytics', JSON.stringify(event));
  }
}

// UTM capture — run on landing page
function captureUtm() {
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const utm: Record<string, string> = {};
  utmKeys.forEach(key => { if (params.has(key)) utm[key] = params.get(key)!; });
  if (Object.keys(utm).length) sessionStorage.setItem('utm', JSON.stringify(utm));
}
```

---

### ab-testing

A/B testing patterns — experiment design, statistical significance, feature flags (LaunchDarkly, Unleash), rollout strategies, result analysis.

#### Workflow

**Step 1 — Detect experiment setup**
Use Grep to find experiment code: `useFeatureFlag`, `useExperiment`, `LaunchDarkly`, `Unleash`, `GrowthBook`, `variant`, `experiment`. Read feature flag initialization and variant assignment to understand: flag provider, assignment method (random, user-based, percentage), and metric collection.

**Step 2 — Audit experiment validity**
Check for: no sample size calculation (experiment runs indefinitely), peeking at results before significance (inflated false positive rate), no control group definition, variant assignment not persisted across sessions (same user sees different variants), metrics not tracked per-variant (can't measure impact), and feature flags without cleanup (dead flags accumulate).

**Step 3 — Emit experiment patterns**
Emit: experiment setup with sample size calculator, persistent variant assignment (cookie/user-ID based), metric collection per variant, significance calculator, and feature flag lifecycle with cleanup reminder.

#### Example

```typescript
// A/B experiment with persistent assignment and significance check
import { z } from 'zod';

const ExperimentSchema = z.object({
  id: z.string(),
  variants: z.array(z.object({ id: z.string(), weight: z.number() })),
  metrics: z.array(z.string()),
});

// Persistent variant assignment (deterministic hash)
function assignVariant(userId: string, experimentId: string, variants: { id: string; weight: number }[]): string {
  const hash = cyrb53(`${userId}:${experimentId}`);
  const normalized = (hash % 10000) / 10000; // [0, 1)
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (normalized < cumulative) return variant.id;
  }
  return variants[variants.length - 1].id;
}

// Simple hash function (deterministic, fast)
function cyrb53(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Sample size calculator (two-proportion z-test)
function requiredSampleSize(baselineRate: number, mde: number, power = 0.8, alpha = 0.05): number {
  const zAlpha = 1.96; // alpha=0.05 two-tailed
  const zBeta = 0.842; // power=0.8
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + mde);
  const pooled = (p1 + p2) / 2;
  return Math.ceil(
    (2 * pooled * (1 - pooled) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(p2 - p1, 2),
  );
}
```

---

### funnel-analysis

Funnel analysis — conversion tracking, drop-off identification, cohort analysis, retention metrics, LTV calculation, attribution modeling.

#### Workflow

**Step 1 — Detect funnel tracking**
Use Grep to find funnel-related code: `funnel`, `conversion`, `step`, `checkout.*step`, `onboarding.*step`, `cohort`, `retention`. Read event tracking calls to understand: which user journey steps are tracked, how step completion is determined, and where drop-off data is collected.

**Step 2 — Audit funnel completeness**
Check for: missing steps in the funnel (gap between "add to cart" and "payment complete" — no "checkout started"), step events not including a session or flow ID (can't link steps to same journey), no timestamp on steps (can't measure time between steps), no segmentation on funnel data (can't compare mobile vs desktop conversion), and no drop-off alerting.

**Step 3 — Emit funnel patterns**
Emit: typed funnel step tracker with flow ID, funnel aggregation query (SQL), drop-off rate calculator, cohort retention matrix, and simple LTV estimation.

#### Example

```typescript
// Funnel step tracker with flow correlation
interface FunnelStep {
  funnelId: string;
  flowId: string;      // ties steps to same user journey
  step: string;
  stepIndex: number;
  userId: string;
  timestamp: number;
  metadata?: Record<string, string | number>;
}

const CHECKOUT_FUNNEL = ['cart_viewed', 'checkout_started', 'shipping_entered', 'payment_entered', 'order_completed'] as const;

function trackFunnelStep(step: typeof CHECKOUT_FUNNEL[number], flowId: string, meta?: Record<string, string | number>) {
  const event: FunnelStep = {
    funnelId: 'checkout',
    flowId,
    step,
    stepIndex: CHECKOUT_FUNNEL.indexOf(step),
    userId: getCurrentUserId(),
    timestamp: Date.now(),
    metadata: meta,
  };
  analytics.track({ name: 'funnel_step', properties: event });
}

// SQL — funnel drop-off analysis (PostgreSQL)
// SELECT step, COUNT(DISTINCT flow_id) as users,
//   LAG(COUNT(DISTINCT flow_id)) OVER (ORDER BY step_index) as prev_users,
//   ROUND(COUNT(DISTINCT flow_id)::numeric /
//     LAG(COUNT(DISTINCT flow_id)) OVER (ORDER BY step_index) * 100, 1) as conversion_pct
// FROM funnel_events
// WHERE funnel_id = 'checkout' AND timestamp > NOW() - INTERVAL '30 days'
// GROUP BY step, step_index ORDER BY step_index;

// Cohort retention matrix
async function cohortRetention(cohortField: string, periods: number) {
  return db.execute(sql`
    WITH cohorts AS (
      SELECT user_id, DATE_TRUNC('week', MIN(created_at)) AS cohort_week
      FROM events WHERE name = 'signup_completed'
      GROUP BY user_id
    ),
    activity AS (
      SELECT user_id, DATE_TRUNC('week', timestamp) AS active_week
      FROM events GROUP BY user_id, DATE_TRUNC('week', timestamp)
    )
    SELECT c.cohort_week, EXTRACT(WEEK FROM a.active_week - c.cohort_week) AS week_number,
      COUNT(DISTINCT a.user_id) AS active_users
    FROM cohorts c JOIN activity a ON c.user_id = a.user_id
    WHERE a.active_week >= c.cohort_week
    GROUP BY c.cohort_week, week_number ORDER BY c.cohort_week, week_number
  `);
}
```

---

### dashboard-patterns

Analytics dashboard design — KPI cards, time series charts, comparison views, drill-down navigation, export functionality, real-time counters.

#### Workflow

**Step 1 — Detect dashboard components**
Use Grep to find dashboard code: `Chart`, `recharts`, `chart.js`, `d3`, `tremor`, `KPI`, `metric`, `dashboard`. Read dashboard pages and data fetching to understand: charting library, data source (API, database, analytics provider), refresh strategy, and component structure.

**Step 2 — Audit dashboard performance**
Check for: all data fetched on page load (no lazy loading for off-screen charts), no time range selector (stuck on one period), raw data sent to client for aggregation (should aggregate server-side), no loading states (charts pop in), missing comparison period (no "vs last week"), no data export, and charts re-rendering on unrelated state changes.

**Step 3 — Emit dashboard patterns**
Emit: KPI card with comparison indicator, time series chart with range selector, server-side aggregation endpoint, lazy-loaded chart sections, and CSV export utility.

#### Example

```tsx
// Dashboard KPI card with comparison
interface KpiProps {
  label: string;
  value: number;
  previousValue: number;
  format: 'number' | 'currency' | 'percent';
}

function KpiCard({ label, value, previousValue, format }: KpiProps) {
  const change = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
  const formatted = format === 'currency'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    : format === 'percent'
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);

  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1">{formatted}</p>
      <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs previous period
      </p>
    </div>
  );
}

// Server-side aggregation endpoint — app/api/metrics/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '7d';
  const interval = range === '24h' ? 'hour' : range === '7d' ? 'day' : 'week';

  const metrics = await db.execute(sql`
    SELECT DATE_TRUNC(${interval}, timestamp) AS period,
      COUNT(*) AS page_views,
      COUNT(DISTINCT user_id) AS unique_visitors,
      COUNT(*) FILTER (WHERE name = 'signup_completed') AS signups
    FROM events
    WHERE timestamp > NOW() - ${range}::interval
    GROUP BY period ORDER BY period
  `);
  return Response.json(metrics);
}

// CSV export utility
function exportCsv(data: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

---

## Connections

```
Calls → @rune/ui (L4): dashboard components
Calls → @rune/backend (L4): tracking API setup
Called By ← marketing (L2): measuring campaign performance
Called By ← cook (L1): when analytics feature requested
```

## Tech Stack Support

| Area | Options | Notes |
|------|---------|-------|
| Analytics | GA4, Plausible, PostHog, Mixpanel | Plausible for privacy-first; PostHog for product analytics |
| Feature Flags | LaunchDarkly, Unleash, GrowthBook | GrowthBook open-source with built-in A/B |
| Charts | Recharts, Tremor, Chart.js, D3 | Tremor best for dashboards; D3 for custom visualizations |
| Database | PostgreSQL + aggregation views | Pre-aggregate for dashboard performance |

## Constraints

1. MUST use typed event taxonomy — ad-hoc event names create unmaintainable analytics that nobody trusts.
2. MUST implement consent management before any tracking — GDPR/CCPA compliance is non-negotiable.
3. MUST calculate sample size before starting A/B tests — running experiments without power analysis wastes time and produces meaningless results.
4. MUST aggregate data server-side for dashboards — sending raw events to the client causes slow loads and exposes user data.
5. MUST persist variant assignment per user — inconsistent assignment invalidates experiment results.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Peeking at A/B test results before reaching sample size (false positive) | HIGH | Lock results until sample size reached; show "not yet significant" warning |
| Event name typo means data goes to wrong metric (silent data loss) | HIGH | Typed event taxonomy with TypeScript union; no raw string event names |
| Ad blockers drop 30-40% of client-side tracking events | HIGH | Implement server-side tracking proxy (`/api/analytics`); use `sendBeacon` |
| Dashboard loads 500K raw events client-side (browser freezes) | HIGH | Pre-aggregate in SQL; paginate time series; lazy-load off-screen charts |
| Same user gets different A/B variant across sessions (polluted results) | MEDIUM | Hash user ID + experiment ID for deterministic assignment; persist in cookie |
| Funnel shows 0% conversion because step events use different flow IDs | MEDIUM | Generate flow ID at funnel entry; pass through all steps; validate correlation |

## Done When

- Event tracking fires with typed taxonomy and consent management
- A/B testing assigns persistent variants with sample size calculation
- Funnel analysis tracks correlated steps with drop-off rates
- Dashboard renders KPI cards with comparison, time series, and export
- Server-side tracking proxy handles ad-blocked clients
- Structured report emitted for each skill invoked

## Cost Profile

~8,000–14,000 tokens per full pack run (all 4 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for detection scans; escalate to sonnet for experiment design and dashboard patterns.
