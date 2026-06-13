# Observability & Instrumentation Reference

Code you cannot observe is code you cannot operate. Instrumentation is written **alongside** the feature, like tests — not bolted on after the first incident. A feature that ships without telemetry turns its first user-reported bug into archaeology instead of a query.

This reference is the shared instrumentation discipline. `deploy` gates on it before prod, `perf` uses it as the measurement basis, `debug` leaves it behind so the next investigation is fast.

---

## 1. Define "working" before instrumenting

Telemetry without a question is noise. Before adding anything, write 2-4 questions an on-call engineer will ask about this feature:

```
FEATURE: checkout payment retry
ON-CALL WILL ASK:
1. What fraction of payments succeed first-try vs after retry?
2. When a payment fails permanently, why? (provider error / timeout / validation?)
3. Is the payment provider slower than usual?
→ Every signal below must answer one of these.
```

If you cannot name the questions, you are not ready to instrument — you will log everything and learn nothing.

## 2. One signal per question

| Signal | Answers | Cost profile |
|---|---|---|
| **Structured log** | "What happened in this specific case?" | Per-event; grows with traffic |
| **Metric** | "How often / how fast, in aggregate?" | Fixed per series; cheap to query |
| **Trace** | "Where did time go across services?" | Per-request; usually sampled |

Rule of thumb: **metrics say *that* something is wrong, traces say *where*, logs say *why*.**

## 3. Structured logging

Log events, not prose. Every line is a JSON object with a stable event name and machine-readable fields:

```ts
// BAD: string interpolation — unqueryable, inconsistent
logger.info(`Payment ${id} failed for ${userId} after ${n} retries`);

// GOOD: stable event name + structured fields
logger.warn({ event: 'payment_failed', paymentId: id, provider: 'stripe', errorCode: err.code, attempt: n }, 'payment failed');
```

**Log levels — consistent meaning:**

| Level | Meaning | On-call action |
|---|---|---|
| `error` | Invariant broken; someone may need to act | Investigate |
| `warn` | Degraded but handled (retry succeeded, fallback used) | Watch trends |
| `info` | Significant business event (order placed, job finished) | None |
| `debug` | Diagnostic detail | Off in prod by default |

**Correlation IDs are mandatory.** Generate or accept a request ID at the system boundary; attach it to every log line, span, and outbound call. Without it you cannot reconstruct one request from interleaved logs:

```ts
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] ?? crypto.randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('x-request-id', req.id);
  next();
});
```

**Never log secrets, tokens, passwords, or full PII.** Telemetry pipelines are a classic data-leak path (hard rule, shared with `sentinel`). Allowlist fields; never log whole request bodies.

## 4. Metrics — RED and USE

- **Request-driven services** (endpoints, external deps): instrument **RED** — **R**ate (req/s), **E**rrors (failure rate), **D**uration (latency *histogram*).
- **Resources** (queues, pools, hosts): instrument **USE** — **U**tilization, **S**aturation, **E**rrors.

```ts
const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  labelNames: ['method', 'route', 'status_class'],   // '2xx', not '200'
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
```

**Cardinality is the failure mode.** Every unique label combination is a separate time series. Labels must come from small fixed sets (route template, status class, provider). Never use user IDs, raw URLs, request IDs, or error-message text as labels — that belongs in logs/traces.

```
OK as label:    route="/api/tasks/:id"  status_class="5xx"  provider="stripe"
NEVER a label:  user_id, email, request_id, full URL, error message text
```

**Averages never, percentiles always.** An average hides the 1% of users having a terrible time. Use histograms; read p50/p95/p99.

## 5. Distributed tracing

Use OpenTelemetry (vendor-neutral). Auto-instrumentation covers HTTP/gRPC/common DB clients with near-zero code:

```ts
// tracing.ts — imported before anything else
const sdk = new NodeSDK({ serviceName: 'checkout-service', instrumentations: [getNodeAutoInstrumentations()] });
sdk.start();
```

Add manual spans only around meaningful internal work (`applyDiscounts`, `chargeProvider`) with the attributes on-call filters by. Propagate context across every async boundary (HTTP headers, queue metadata) or the trace dies at the gap. Sample head-based at a low rate; keep 100% of errors if the backend supports tail sampling.

## 6. Alerting — symptoms, not causes

Alert on **what users feel**, not on internal causes:

```
SYMPTOM (page-worthy):        CAUSE (dashboard, not a page):
error rate > 1% for 5 min     CPU at 85%
p99 latency > 2s              one pod restarted
queue age > 10 min            disk at 70%
```

Cause-based alerts fire when nothing is wrong and miss failures you did not predict. Every alert must:

1. **Be actionable.** If the response is "ignore it, it self-heals" → delete it.
2. **Link to a runbook** — even three lines: what it means, first query to run, escalation path.
3. **Have a threshold + duration** justified by an SLO or historical data, not a guess.
4. **Use two severities only** — *page* (user-facing, act now) and *ticket* (degradation, act this week). A third tier trains people to ignore everything.

## 7. Verify the telemetry itself

Instrumentation is code; it can be wrong. Before calling it done, trigger the paths and look at the real output:

- Force an error in staging → find it by `requestId`, confirm fields are structured (not `[object Object]`).
- Send test traffic → metric series appear with expected labels and sane values.
- Follow one request end-to-end in the tracing UI → no broken spans.
- Fire each new alert once (lower the threshold temporarily) → it reaches the right channel and the runbook link works.

---

## Instrumentation Readiness Checklist (gate)

A feature is observable-ready when:

- [ ] On-call questions written down; each signal maps to one
- [ ] All logs structured (JSON), stable event names, correlation ID on every line
- [ ] No secrets/tokens/PII in any log line (spot-check actual output)
- [ ] RED metrics on every new endpoint + external dependency, bounded labels
- [ ] Latency is a histogram; p95/p99 queryable
- [ ] One request followable end-to-end without broken spans
- [ ] Every new alert is symptom-based, has a runbook link, was test-fired once
- [ ] An induced staging failure was located via telemetry alone, without reading source

## Cost note

Instrumentation has a bill. Retention, sampling, and cardinality defaults bleed money (see `deploy` → "Observability Cost in Deploys" and `perf` Step 8.6). Instrument for the on-call questions — not for completeness. Three queryable events beat three hundred prose lines.
