# Cost Optimization Reference

> Loaded by `perf` skill when cost analysis, cloud spending, or FinOps context is detected.
> Patterns: production-proven cost reduction strategies with dollar-impact estimates.

---

## Cost Priority Hierarchy

Optimize in this order — higher tiers save 10x more than lower:

```
1. Architecture choices     (10x impact — monolith vs micro, serverless vs containers)
2. Data transfer            (NAT Gateway, cross-region, CDN vs origin)
3. Compute right-sizing     (instance types, spot/reserved, autoscaling)
4. Database optimization    (query tuning, connection pooling, read replicas)
5. Caching layer            (Redis, CDN, in-memory — ROI depends on hit rate)
6. Storage tiering          (S3 lifecycle, cold storage, cleanup)
7. Bundle/asset size        (tree-shaking, image optimization, compression)
8. Observability costs      (log sampling, trace sampling, retention)
```

---

## Quick Wins Checklist

| Fix | Typical Savings | Effort |
|-----|----------------|--------|
| S3 Intelligent-Tiering on infrequent buckets | 40-70% storage | 5 min |
| Fix N+1 queries (Prisma `include`) | 10-100x query reduction | 30 min |
| WebP/AVIF images (Sharp pipeline) | 25-80% bandwidth | 1 hr |
| Add CDN for static assets | 50-90% origin traffic | 1 hr |
| NAT Gateway → VPC endpoints for AWS services | $30-100/mo per service | 30 min |
| Log sampling (10% INFO, 100% ERROR) | 50-80% observability bill | 30 min |
| Gzip/Brotli response compression | 70-90% transfer size | 15 min |
| Lambda memory right-sizing (power tuning) | 10-40% Lambda cost | 1 hr |

---

## Instance Right-Sizing

### AWS EC2 Strategy

| Strategy | Savings | Commitment |
|----------|---------|-----------|
| On-Demand | Baseline | None |
| Spot Instances | 60-90% | Can be interrupted |
| Reserved (1-yr) | ~40% | 1 year |
| Reserved (3-yr) | ~60% | 3 years |
| Savings Plans | ~30-40% | Flexible commitment |

### Kubernetes Right-Sizing

```yaml
# Set requests = actual P95 usage, limits = 2x requests
resources:
  requests:
    cpu: "250m"      # Based on actual P95 CPU usage
    memory: "256Mi"  # Based on actual P95 memory
  limits:
    cpu: "500m"
    memory: "512Mi"
```

Check actual usage: `kubectl top pods --sort-by=cpu`

---

## Data Transfer Cost Traps

### NAT Gateway Problem

NAT Gateway: **$0.045/GB + $0.045/hr** — one of the most expensive AWS surprises.

**Fix:** Replace with VPC endpoints for AWS services:
```
S3 Gateway Endpoint         → Free (gateway type)
DynamoDB Gateway Endpoint   → Free (gateway type)
SQS/SNS Interface Endpoint → $0.01/hr (still 4x cheaper than NAT)
```

### Cross-Region Transfer

- Same region, same AZ: **Free**
- Same region, different AZ: **$0.01/GB**
- Cross-region: **$0.02/GB**
- Internet egress: **$0.09/GB** (first 10TB)

**Rule:** Keep services in the same AZ when possible. Use CloudFront for global distribution.

---

## Serverless Optimization

### Lambda Memory Tuning

Lambda CPU scales linearly with memory. Sometimes MORE memory = CHEAPER (faster execution):

```
128MB, 3000ms  = 375,000 GB-ms = $0.00000625
512MB, 800ms   = 400,000 GB-ms = $0.00000667  (similar cost, 4x faster)
1024MB, 400ms  = 400,000 GB-ms = $0.00000667  (same cost, 7.5x faster)
```

Use [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning) to find optimal memory.

### Cold Start Reduction

| Technique | Impact |
|-----------|--------|
| Smaller deployment package | -100-500ms |
| Use Graviton (arm64) | -200ms + 20% cheaper |
| Provisioned concurrency | Eliminates cold starts |
| Lazy-load heavy SDKs | -200-1000ms |
| Use ESM instead of CJS | -100-300ms (Node.js) |

---

## Observability Cost Control

### Log Sampling

```typescript
// Sample 10% of INFO logs, keep 100% of errors
const shouldLog = (level: string): boolean => {
  if (level === 'error' || level === 'warn') return true;
  return Math.random() < 0.1; // 10% sampling
};
```

### Trace Sampling

```typescript
// 100% errors and slow requests, 10% normal
const shouldTrace = (duration: number, isError: boolean): boolean => {
  if (isError) return true;
  if (duration > 1000) return true; // Slow requests
  return Math.random() < 0.1;
};
```

### High-Cardinality Metrics — NEVER DO

```typescript
// BAD: Creates millions of unique time series
metrics.counter('requests', { userId: req.userId }); // ← kills Datadog bill

// GOOD: Low-cardinality labels only
metrics.counter('requests', { endpoint: '/api/users', method: 'GET', status: '200' });
```

### Retention Policies

| Data Type | Recommended Retention |
|-----------|----------------------|
| Raw logs | 7-14 days |
| Aggregated metrics | 90 days |
| Error logs | 30-90 days |
| Traces | 7 days |
| Audit logs | 1-7 years (compliance) |

---

## Managed vs Self-Hosted Decision Matrix

| Service | Self-Host When | Stay Managed When |
|---------|---------------|-------------------|
| Auth | >200K MAU ($4K+/mo managed) | <200K MAU or need compliance |
| Search | >500K records or >$500/mo | <500K records, need instant setup |
| Database | >$500/mo RDS bill | Need HA, backups, patching handled |
| Email | Almost never | Always (deliverability is hard) |
| Monitoring | >$1K/mo Datadog | Need APM + distributed tracing |

---

## Unit Economics Tracking

```typescript
// Track cost per unit to detect inefficiency trends
interface UnitEconomics {
  costPerRequest: number;   // Total infra / total requests
  costPerUser: number;      // Total infra / MAU
  costPerTransaction: number; // Total infra / transactions
}

// Alert if unit cost increases >20% month-over-month
function checkCostTrend(current: number, previous: number): void {
  const increase = (current - previous) / previous;
  if (increase > 0.2) {
    alert(`Unit cost increased ${(increase * 100).toFixed(0)}% — investigate`);
  }
}
```

---

## Cost Optimization Priority Matrix

| Effort | Low Savings (<$100/mo) | Med Savings ($100-500) | High Savings (>$500) |
|--------|----------------------|----------------------|---------------------|
| **Low** | Log retention | Image optimization | S3 tiering |
| **Medium** | Bundle analysis | Caching layer | Instance right-sizing |
| **High** | — | Query optimization | Architecture redesign |

**Rule:** Start top-right (high savings, low effort), work diagonally down-left.
