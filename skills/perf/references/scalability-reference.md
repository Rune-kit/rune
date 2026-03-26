# Scalability Reference

> Loaded by `perf` skill when scaling, load handling, or infrastructure optimization context is detected.
> Patterns: production-proven scalability strategies for Node.js/TypeScript applications.

---

## Bottleneck Identification Flow

Profile BEFORE optimizing. Follow this decision tree:

```
Is database the bottleneck (>50% of response time)?
├── YES → Index optimization, connection pooling, read replicas, query caching
│         See db/references/scaling-reference.md
└── NO
    Is external API the bottleneck?
    ├── YES → Circuit breaker, caching, parallel requests, queue background
    └── NO
        Is it CPU-bound?
        ├── YES → Worker threads, horizontal scaling, algorithm optimization
        └── NO
            Is it memory pressure?
            ├── YES → Leak detection, streaming, pagination, bounded caches
            └── NO → Measure again with better instrumentation
```

## Performance Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| p99 latency | <200ms | 200-500ms | >500ms |
| DB cache hit ratio | >95% | 90-95% | <90% |
| Connection pool utilization | <70% | 70-85% | >85% |
| CPU utilization | <60% | 60-80% | >80% |
| Memory utilization | <70% | 70-85% | >85% |
| Error rate | <0.1% | 0.1-1% | >1% |
| Queue depth | <100 | 100-1000 | >1000 |
| Queue wait time | <1s | 1-10s | >10s |

---

## API Scalability Patterns

### Cursor-Based Pagination

Offset pagination breaks at scale (`OFFSET 100000` = scan 100K rows). Use cursor-based:

```typescript
// Cursor-based — consistent performance at any depth
async function listOrders(cursor?: string, limit = 20) {
  const where = cursor ? { id: { gt: cursor } } : {};
  const items = await prisma.order.findMany({
    where,
    take: limit + 1, // Fetch one extra to detect hasMore
    orderBy: { id: 'asc' },
  });

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;

  return {
    data,
    cursor: data.at(-1)?.id ?? null,
    hasMore,
  };
}
```

### Rate Limiting (Tiered)

```typescript
const rateLimits = {
  free:       { requests: 100,  window: '15m' },
  pro:        { requests: 1000, window: '15m' },
  enterprise: { requests: 10000, window: '15m' },
};

// Response headers (always include)
// X-RateLimit-Limit: 1000
// X-RateLimit-Remaining: 847
// X-RateLimit-Reset: 1699234567
// Retry-After: 30  (only on 429)
```

### Circuit Breaker

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callExternalAPI, {
  timeout: 3000,          // Fail if function takes > 3s
  errorThresholdPercentage: 50,  // Open if 50% fail
  resetTimeout: 30000,    // Try again after 30s
  volumeThreshold: 10,    // Min calls before tripping
});

breaker.fallback(() => cachedResponse);
breaker.on('open', () => logger.warn('Circuit breaker OPEN'));
```

### Graceful Shutdown

```typescript
async function shutdown(signal: string) {
  logger.info(`${signal} received — starting graceful shutdown`);

  // 1. Stop accepting new connections
  server.close();

  // 2. Finish in-flight requests (with timeout)
  await Promise.race([
    finishInflightRequests(),
    new Promise(resolve => setTimeout(resolve, 30000)),
  ]);

  // 3. Close DB connections
  await prisma.$disconnect();
  await redis.quit();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

## Caching Strategies

### Strategy Selection

| Strategy | When to Use | Trade-off |
|----------|-------------|-----------|
| **Cache-aside** | Most common. App checks cache, falls back to DB | May serve stale data |
| **Write-through** | Cache updated on every write | Higher write latency |
| **Write-behind** | Cache updated async after write | Risk of data loss |
| **Read-through** | Cache auto-fetches on miss | Cache library dependency |

### TTL Guidelines

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Static config | 1 hour | Rarely changes |
| User profile | 5 min | Changes occasionally |
| Product catalog | 15 min | Balance freshness vs load |
| Session data | 30 min sliding | Security + UX |
| Rate limit counters | Match window | Exact timing matters |
| Search results | 60s | High-read, low-freshness need |

### Cache Invalidation Patterns

```typescript
// 1. TTL-based (simplest, eventual consistency)
await redis.setex(`user:${id}`, 300, JSON.stringify(user));

// 2. Explicit invalidation (strongest consistency)
await prisma.user.update({ where: { id }, data });
await redis.del(`user:${id}`);

// 3. Tag-based (invalidate groups)
await redis.sadd('tag:users', `user:${id}`, `user:${id}:posts`);
// On invalidate:
const keys = await redis.smembers('tag:users');
await redis.del(...keys);

// 4. Versioned keys (zero-downtime cache migration)
const version = 'v2';
await redis.setex(`user:${version}:${id}`, 300, data);
```

---

## Queue-Based Load Leveling

### When to Use Queues

- Request takes > 500ms to process
- External API with rate limits
- Spiky traffic patterns
- Fire-and-forget operations (email, webhooks, analytics)

### BullMQ Pattern

```typescript
import { Queue, Worker } from 'bullmq';

const emailQueue = new Queue('emails', { connection: redis });

// Producer — returns immediately
await emailQueue.add('welcome', { userId, email }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 1000,  // Keep last 1000 completed
  removeOnFail: 5000,      // Keep last 5000 failed
});

// Consumer — processes in background
const worker = new Worker('emails', async (job) => {
  await sendEmail(job.data.email, 'Welcome!');
}, {
  connection: redis,
  concurrency: 5,          // Process 5 emails in parallel
  limiter: { max: 10, duration: 1000 }, // Rate limit: 10/sec
});
```

---

## Concurrency Patterns

### Worker Threads (CPU-intensive)

```typescript
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

if (isMainThread) {
  const worker = new Worker(__filename, { workerData: { input } });
  worker.on('message', (result) => resolve(result));
  worker.on('error', reject);
} else {
  const result = heavyComputation(workerData.input);
  parentPort?.postMessage(result);
}
```

### Backpressure (prevent OOM)

```typescript
// Bounded queue — reject when full instead of consuming infinite memory
class BoundedQueue<T> {
  private queue: T[] = [];
  constructor(private maxSize: number) {}

  enqueue(item: T): boolean {
    if (this.queue.length >= this.maxSize) return false; // Apply backpressure
    this.queue.push(item);
    return true;
  }
}
```

### Semaphore (limit concurrent operations)

```typescript
class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) { this.current++; next(); }
  }
}

// Usage: limit to 10 concurrent DB connections
const sem = new Semaphore(10);
await sem.acquire();
try { await db.query(sql); }
finally { sem.release(); }
```

---

## Deployment Scalability

### Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # Slow scale-down prevents flapping
```

### CDN Cache-Control Headers

```
# Immutable assets (hashed filenames)
Cache-Control: public, max-age=31536000, immutable

# API responses (short cache + revalidation)
Cache-Control: public, max-age=60, stale-while-revalidate=30

# Private user data
Cache-Control: private, no-store

# HTML pages (revalidate every time)
Cache-Control: no-cache
```

### Zero-Downtime Database Migrations

3-phase safe migration pattern:

```
Phase 1: ADD new column (nullable) → deploy
Phase 2: Deploy code that writes to BOTH old + new columns → backfill
Phase 3: Drop old column → deploy

NEVER in one step:
- Rename column (breaks running code)
- Change type (data loss risk)
- Add NOT NULL without default (fails on existing rows)
```

---

## Load Testing

### k6 Quick Start

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 50 },   // Steady state
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],  // 99th percentile < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  const res = http.get('https://api.example.com/orders');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

### What to Measure

| Metric | Target | Why |
|--------|--------|-----|
| p50 latency | <100ms | Typical user experience |
| p99 latency | <500ms | Worst-case user experience |
| Throughput (RPS) | >baseline | Capacity headroom |
| Error rate | <0.1% | Reliability |
| CPU during load | <80% | Scaling headroom |
| Memory during load | <70% | Leak detection |

**Rule:** Always observe p99, not p50. Median latency hides tail latency that kills user experience.
