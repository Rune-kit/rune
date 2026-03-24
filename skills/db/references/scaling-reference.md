# Database Scaling Reference

> Loaded by `db` skill when scaling, indexing, or performance optimization context is detected.
> Source patterns: production-proven PostgreSQL scaling strategies.

---

## Indexing Strategy

### Index Type Selection

| Type | Use Case | Example |
|------|----------|---------|
| **B-tree** (default) | Equality, range, sorting | `WHERE id = 1`, `ORDER BY date` |
| **GIN** | Arrays, JSONB, full-text search | `WHERE tags @> ARRAY['a']` |
| **GiST** | Geometric, spatial, nearest-neighbor | PostGIS, `ORDER BY location <->` |
| **BRIN** | Large tables with natural ordering | Time-series > 100GB |

### Compound Index Rules

Order columns: **equality → range → sort**

```sql
-- Query: WHERE customer_id = X AND status IN (...) AND created_at > Y ORDER BY id
CREATE INDEX idx_orders ON orders(customer_id, status, created_at, id);
```

### Partial Indexes (index what you query)

```sql
-- Only index active users (90% smaller, 90% faster writes)
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';

-- Only index pending orders
CREATE INDEX idx_pending_orders ON orders(customer_id) WHERE status = 'pending';
```

### Covering Indexes (avoid heap lookups)

```sql
-- Query only needs total and date — include them in index
CREATE INDEX idx_orders_covering ON orders(customer_id)
INCLUDE (total, created_at);

-- Index-only scan — no heap access needed
SELECT total, created_at FROM orders WHERE customer_id = 123;
```

### Index Anti-Patterns

- Indexing every column (slows writes, wastes storage)
- Indexing low-cardinality columns alone (status with 3 values → useless)
- Missing indexes on foreign keys (kills JOIN performance)
- Unused indexes (check `pg_stat_user_indexes` for `idx_scan = 0`)

---

## Query Optimization

### EXPLAIN ANALYZE — Always Profile

```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT * FROM orders WHERE customer_id = 123 AND created_at > NOW() - INTERVAL '30d';
```

**Red flags in output:**
- `Seq Scan` on large table → missing index
- `Filter` removes most rows → index should be more selective
- `Sort` with high cost → add index that matches ORDER BY
- `Nested Loop` with large outer table → consider hash/merge join

### pg_stat_statements — Find Problem Queries

```sql
-- Top 10 slowest queries by total time
SELECT query, calls, total_exec_time / 1000 AS total_sec,
       mean_exec_time AS avg_ms,
       100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS cache_pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;

-- N+1 detector: queries called many times with low individual cost
SELECT query, calls, mean_exec_time AS avg_ms
FROM pg_stat_statements
WHERE calls > 1000 AND mean_exec_time < 5
ORDER BY calls DESC LIMIT 10;
```

---

## N+1 Query Prevention

### Prisma

```typescript
// BAD: 1 + N queries
const users = await prisma.user.findMany();
for (const u of users) {
  u.posts = await prisma.post.findMany({ where: { authorId: u.id } });
}

// GOOD: 2 queries (parallel fetch)
const users = await prisma.user.findMany({ include: { posts: true } });

// GOOD: Single query (database JOIN)
const users = await prisma.user.findMany({
  relationLoadStrategy: 'join',
  include: { posts: { select: { id: true, title: true } } }
});
```

### Drizzle (no N+1 by design)

```typescript
const results = await db.select().from(users)
  .leftJoin(posts, eq(users.id, posts.userId));
```

### Detection

Enable query logging — look for **query count = 1 + N** where N = row count.

```typescript
// Prisma query logging
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
prisma.$on('query', (e) => {
  if (e.duration > 100) console.warn(`SLOW: ${e.duration}ms — ${e.query}`);
});
```

---

## Connection Pooling

### Sizing Formula

```
pool_size = (CPU cores × 2) + effective_spindle_count

4-core  → 9 connections
8-core  → 17 connections
16-core → 33 connections
```

### PgBouncer Configuration

```ini
[pgbouncer]
pool_mode = transaction          # Release after each transaction
default_pool_size = 25           # Per database/user pair
min_pool_size = 10               # Keep warm
reserve_pool_size = 5            # Overflow buffer
max_client_connections = 1000    # Total client limit
server_idle_timeout = 600        # Close idle server connections (10min)
query_wait_timeout = 120         # Max wait for available connection
```

**Warning signs:** Pool utilization > 80%, rising wait times, connection timeouts.

---

## Read Replicas

### When to Add

- Read:write ratio exceeds **10:1**
- Primary CPU consistently > 70% from read queries
- Analytics queries competing with transactional reads

### Routing Pattern

```typescript
const primaryPool = new Pool({ host: 'primary.db.com' });
const replicaPool = new Pool({ host: 'replica.db.com' });

async function query(sql: string, params: unknown[], opts?: { write?: boolean }) {
  const pool = opts?.write ? primaryPool : replicaPool;
  return pool.query(sql, params);
}
```

### Replication Lag

- Typical: 5-50ms for well-tuned async replication
- **Read-your-writes consistency**: After a write, read from primary for that user's session
- **Analytics queries**: Always safe on replicas (stale data acceptable)

---

## Partitioning

### When to Partition

- Table exceeds **100GB** or **100M+ rows**
- Queries always filter on a specific column (date, tenant)
- Need fast deletion of old data (`DROP` partition vs `DELETE`)

### Range Partitioning (time-series)

```sql
CREATE TABLE events (
  id BIGSERIAL, created_at TIMESTAMPTZ NOT NULL, data JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025_01 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Delete old data instantly
DROP TABLE events_2024_01; -- 0.01s vs DELETE minutes
```

### Hash Partitioning (even distribution)

```sql
CREATE TABLE orders (id BIGSERIAL, customer_id INT, data JSONB)
PARTITION BY HASH (customer_id);

CREATE TABLE orders_0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
```

**Rule:** Keep partition count under 500 — query planning overhead grows with partition count.

---

## Sharding Decision Matrix

### When to Shard (Last Resort)

| Strategy | Pros | Cons |
|----------|------|------|
| **Hash-based** | Even distribution | No range queries on shard key |
| **Range-based** | Range queries work | Hot shards if distribution skewed |
| **Tenant-based** | Strong isolation | Uneven if tenants vary in size |

### Before Sharding, Try These First

1. Add proper indexes
2. Fix N+1 queries
3. Add read replicas
4. Add caching layer
5. Partition large tables
6. Vertical scaling (bigger instance)
7. Archive old data
8. Optimize queries with EXPLAIN ANALYZE

---

## Denormalization Decision Matrix

| Scenario | Keep Normalized | Denormalize |
|----------|----------------|-------------|
| High write volume | Yes | No |
| High read volume, slow joins | No | Yes |
| Data consistency critical | Yes | No |
| Analytics / reporting | No | Yes (materialized views) |

### Materialized Views

```sql
CREATE MATERIALIZED VIEW order_stats AS
SELECT customer_id, COUNT(*) AS order_count, SUM(total) AS total_spent
FROM orders GROUP BY customer_id;

-- Refresh periodically (CONCURRENTLY allows reads during refresh)
REFRESH MATERIALIZED VIEW CONCURRENTLY order_stats;
CREATE UNIQUE INDEX ON order_stats(customer_id);
```

**Rule:** Start normalized. Denormalize specific queries only when EXPLAIN shows expensive joins that caching can't solve.
