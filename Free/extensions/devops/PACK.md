---
name: "@rune/devops"
description: DevOps patterns — Docker, CI/CD pipelines, monitoring setup, server configuration, SSL/domain management, edge/serverless deployment, and infrastructure-as-code.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$12"
  target: DevOps engineers
---

# @rune/devops

## Purpose

Infrastructure work done without patterns leads to snowflake configs: Dockerfiles that rebuild entire node_modules on every code change, CI pipelines that run 40 minutes because nothing is cached, servers with no monitoring until the first outage, SSL certificates that expire silently, serverless functions that leak state across requests, and infrastructure provisioned by hand that can't be reproduced. This pack provides battle-tested patterns for containerization, continuous delivery, production observability, server hardening, edge/serverless deployment, and infrastructure-as-code — each skill detects what you have, audits it against best practices, and emits the fixed config.

## Triggers

- Auto-trigger: when `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `.gitlab-ci.yml`, `nginx.conf`, `Caddyfile` detected in project
- `/rune docker` — audit and optimize container configuration
- `/rune ci-cd` — audit and optimize CI/CD pipeline
- `/rune monitoring` — set up or audit production monitoring
- `/rune server-setup` — audit server configuration
- `/rune ssl-domain` — manage SSL certificates and domain config
- `/rune edge-serverless` — audit and configure edge/serverless deployment
- `/rune infra-as-code` — audit and structure Terraform/Pulumi/CDK infrastructure
- Called by `deploy` (L2) when deployment infrastructure needs setup
- Called by `launch` (L1) when preparing production environment

## Skills Included

### docker

Dockerfile and docker-compose patterns — multi-stage builds, layer optimization, security hardening, development vs production configs.

#### Workflow

**Step 1 — Detect container configuration**
Use Glob to find `Dockerfile*`, `docker-compose*.yml`, `.dockerignore`. Read each file to understand: base images used, build stages, exposed ports, volume mounts, environment variables, and health checks.

**Step 2 — Audit against best practices**
Check for: non-multi-stage builds (large images), `npm install` without `--omit=dev` in production stage, missing `.dockerignore` (bloated context), running as root (security risk), `latest` tag on base images (non-reproducible), missing `HEALTHCHECK`, `COPY . .` before dependency install (cache invalidation). Flag each with severity and fix.

**Step 3 — Emit optimized Dockerfile**
Rewrite or patch the Dockerfile: multi-stage build (deps → build → production), distroless or Alpine final image, non-root user, pinned base image versions, proper layer ordering, health check, and `.dockerignore` covering `node_modules`, `.git`, `*.md`.

#### Example

```dockerfile
# BEFORE: single stage, root user, no cache optimization
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]

# AFTER: multi-stage, non-root, optimized layers
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

---

### ci-cd

CI/CD pipeline configuration — GitHub Actions, GitLab CI, build matrices, test parallelization, deployment gates, semantic release.

#### Workflow

**Step 1 — Detect existing pipeline**
Use Glob to find `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`. Read each config to understand: triggers, jobs, caching strategy, test execution, deployment steps, and secrets usage.

**Step 2 — Audit pipeline efficiency**
Check for: no dependency caching (slow installs every run), sequential jobs that could parallelize, missing test matrix for multiple Node/Python versions, no deployment gates (staging → production), secrets referenced without environment protection, missing artifact upload for build outputs. Flag with estimated time savings.

**Step 3 — Emit optimized pipeline**
Rewrite or patch the pipeline: dependency caching (npm/pnpm/pip cache), parallel job graph (lint + typecheck + test), build matrix for LTS versions, deployment gates with manual approval for production, status checks required before merge, artifact persistence for deploy stage.

#### Example

```yaml
# GitHub Actions — optimized Node.js pipeline
name: CI/CD
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        check: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run ${{ matrix.check }}

  build:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: echo "Deploy to staging..."

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # requires manual approval
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: echo "Deploy to production..."
```

---

### monitoring

Production monitoring setup — Prometheus, Grafana, alerting rules, SLO/SLI definitions, log aggregation, distributed tracing.

#### Workflow

**Step 1 — Detect monitoring stack**
Use Grep to find monitoring libraries (`prom-client`, `opentelemetry`, `winston`, `pino`, `morgan`, `dd-trace`, `@sentry/node`). Check for existing Prometheus config, Grafana dashboards, or alerting rules. Read the main server file for existing metrics/logging middleware.

**Step 2 — Audit observability gaps**
Check the four pillars: metrics (RED metrics — Rate, Errors, Duration), logs (structured JSON, correlation IDs), traces (distributed tracing spans), alerts (SLO-based alerting, not just threshold). Flag missing pillars with priority: metrics and alerts first, structured logs second, tracing third.

**Step 3 — Emit monitoring configuration**
Based on detected stack, emit: Prometheus metrics middleware (HTTP request duration histogram, error counter, active connections gauge), structured logger configuration (JSON, request ID, log levels), Grafana dashboard JSON, and Prometheus alerting rules for SLO (99.9% availability = error budget of 43 min/month).

#### Example

```typescript
// Prometheus metrics middleware (prom-client)
import { Counter, Histogram, Gauge, register } from 'prom-client';

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

const httpErrors = new Counter({
  name: 'http_errors_total',
  help: 'Total HTTP errors',
  labelNames: ['method', 'route', 'status'],
});

const metricsMiddleware = (req, res, next) => {
  const end = httpDuration.startTimer({ method: req.method, route: req.route?.path || req.path });
  res.on('finish', () => {
    end({ status: res.statusCode });
    if (res.statusCode >= 400) httpErrors.inc({ method: req.method, route: req.route?.path, status: res.statusCode });
  });
  next();
};

// GET /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

### server-setup

Server configuration — Nginx/Caddy reverse proxy, systemd services, firewall rules, SSH hardening, automatic updates.

#### Workflow

**Step 1 — Detect server environment**
Check for `nginx.conf`, `Caddyfile`, `*.service` (systemd), `ufw` or `iptables` rules, `sshd_config` presence. Identify the reverse proxy, process manager, and OS-level security configuration.

**Step 2 — Audit server hardening**
Check for: SSH password auth enabled (should be key-only), root SSH login enabled (should be disabled), no firewall rules (should allow only 22, 80, 443), no rate limiting on Nginx, missing security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`), process running as root.

**Step 3 — Emit hardened configuration**
Emit the corrected configs: Nginx with security headers, rate limiting, and gzip; systemd service with `User=`, `Restart=`, and resource limits; SSH hardening (`PermitRootLogin no`, `PasswordAuthentication no`); firewall rules allowing only necessary ports.

#### Example

```nginx
# Nginx reverse proxy — hardened
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-Id $request_id;
    }

    location / {
        root /var/www/app/dist;
        try_files $uri $uri/ /index.html;
        gzip on;
        gzip_types text/plain text/css application/json application/javascript;
    }
}
```

---

### ssl-domain

SSL certificate management and domain configuration — Let's Encrypt automation, DNS records, CDN setup, redirect rules.

#### Workflow

**Step 1 — Detect current SSL/domain setup**
Check for existing certificates (`/etc/letsencrypt/`, Cloudflare config), DNS provider configuration, CDN integration (Cloudflare, AWS CloudFront), and redirect rules. Read Nginx/Caddy config for SSL settings.

**Step 2 — Audit SSL configuration**
Check for: expired or soon-to-expire certificates, TLS version below 1.2, weak cipher suites, missing HSTS header, no auto-renewal configured, mixed content (HTTP resources on HTTPS page), missing www-to-apex redirect (or vice versa).

**Step 3 — Emit SSL automation**
Emit: certbot installation and auto-renewal cron, DNS record recommendations (A, CNAME, CAA), Cloudflare/CDN integration if applicable, redirect rules for www normalization, and SSL test verification command.

#### Example

```bash
# Let's Encrypt automation with auto-renewal
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d example.com -d www.example.com --non-interactive --agree-tos -m admin@example.com

# Verify auto-renewal
sudo certbot renew --dry-run

# DNS records (for provider dashboard)
# A     example.com       → 203.0.113.1
# CNAME www.example.com   → example.com
# CAA   example.com       → 0 issue "letsencrypt.org"

# Test SSL configuration
curl -sI https://example.com | grep -i strict-transport
# Expected: strict-transport-security: max-age=63072000; includeSubDomains
```

---

### chaos-testing

Resilience testing — inject controlled failures to verify system behavior under degraded conditions. Validates circuit breakers, retry logic, graceful degradation, and recovery procedures.

#### Workflow

**Step 1 — Map failure points**
Scan the codebase for: external API calls (HTTP clients, SDK calls), database connections, message queues, cache layers, file system operations, and third-party services. For each dependency, identify: timeout configuration, retry logic, circuit breaker presence, fallback behavior. Build a dependency map with failure modes.

**Step 2 — Design chaos experiments**
For each critical dependency, define experiments:
- **Latency injection**: Add 2-5s delay to responses — does the UI show loading state? Do timeouts fire correctly?
- **Error injection**: Return 500/503 from dependency — does the circuit breaker open? Does fallback activate?
- **Partition**: Dependency becomes unreachable — does the system degrade gracefully or crash?
- **Data corruption**: Invalid response format — does validation catch it?

Each experiment has: hypothesis ("If Redis is down, the app serves stale cache for 5 minutes"), blast radius (which users/features affected), rollback procedure (how to stop the experiment).

**Step 3 — Generate test harnesses**
Emit test files that simulate each failure mode:
- Mock-based chaos for unit/integration tests (intercept HTTP, inject errors)
- Environment-variable-driven chaos for staging (feature flags to enable failure injection)
- Health check validation (verify `/health` endpoint reports degraded state, not crash)

Save experiment plan to `.rune/chaos/<date>-experiment.md`.

#### Example

```typescript
// Chaos test: Redis connection failure
describe('Chaos: Redis unavailable', () => {
  beforeEach(() => {
    // Simulate Redis connection refused
    jest.spyOn(redisClient, 'get').mockRejectedValue(
      new Error('ECONNREFUSED 127.0.0.1:6379')
    );
  });

  it('falls back to database when cache is down', async () => {
    const result = await getUserProfile('user-123');
    expect(result).toBeDefined(); // still works
    expect(dbClient.query).toHaveBeenCalled(); // used DB fallback
  });

  it('reports degraded health status', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.cache).toBe('degraded');
    expect(health.body.overall).toBe('degraded'); // not 'down'
  });

  it('circuit breaker opens after 5 failures', async () => {
    for (let i = 0; i < 5; i++) await getUserProfile(`user-${i}`);
    // 6th call should not even attempt Redis
    await getUserProfile('user-6');
    expect(redisClient.get).toHaveBeenCalledTimes(5); // not 6
  });
});
```

---

### kubernetes

Kubernetes resource patterns — Deployments, Services, ConfigMaps, resource limits, health probes, HPA, network policies, and RBAC.

#### Workflow

**Step 1 — Detect Kubernetes configuration**
Use Glob to find `k8s/`, `kubernetes/`, `manifests/`, `helm/`, `kustomize/`, or any `.yaml` files with `apiVersion: apps/v1`. Read existing manifests to understand: workload types, resource limits, probe configuration, service exposure, and secret management.

**Step 2 — Audit against production readiness**
Check for: missing resource requests/limits (noisy neighbor risk), no readiness/liveness probes (unhealthy pods receive traffic), `latest` image tag (non-reproducible), missing PodDisruptionBudget (risky rolling updates), no NetworkPolicy (unrestricted pod-to-pod traffic), secrets in plain ConfigMap (should use Secrets or external vault), no HPA (can't auto-scale), privileged containers.

**Step 3 — Emit production-ready manifests**
Generate or patch manifests: Deployment with resource limits, probes, and anti-affinity; Service with proper selector; HPA with CPU/memory targets; NetworkPolicy restricting ingress; PDB for safe rollouts; Kustomize overlays for dev/staging/prod environments.

#### Example

```yaml
# Production-ready Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  labels:
    app: api-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
        - name: api
          image: registry.example.com/api:v1.4.2  # pinned tag
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: api-server
                topologyKey: kubernetes.io/hostname
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api-server
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

### edge-serverless

Edge and serverless deployment patterns — Cloudflare Workers, Vercel Edge Functions, AWS Lambda, Deno Deploy. Covers runtime constraints, cold starts, streaming, state management, binding patterns, and common anti-patterns that cause production failures in serverless environments.

#### Workflow

**Step 1 — Detect serverless platform**
Read `package.json`, `wrangler.toml`/`wrangler.jsonc`, `vercel.json`, `netlify.toml`, `serverless.yml`, `sam-template.yaml`, `deno.json`. Identify: platform (Cloudflare/Vercel/AWS/Deno), runtime (Node.js/Deno/Bun), entry points, bindings/integrations, and environment configuration.

**Step 2 — Audit against serverless anti-patterns**
Check for patterns that work in traditional servers but fail in serverless:

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| `await response.text()` on unbounded data | Memory limit (128MB Workers, 1024MB Lambda) — OOM on large responses | Stream responses: pipe readable to writable without buffering |
| Module-level mutable variables | Serverless instances are shared across requests — cross-request data leaks | Use request-scoped variables or platform state primitives (KV, DurableObjects) |
| Floating promises (no await, no waitUntil) | Promise runs after response sent — errors swallowed, work may be killed | Every Promise must be `await`ed, `return`ed, or passed to `ctx.waitUntil()` |
| `Math.random()` for security tokens | Not cryptographically secure — predictable in serverless edge environments | Use `crypto.randomUUID()` or `crypto.getRandomValues()` |
| Direct database connections | Serverless creates a new connection per invocation — exhausts connection pool | Use connection pooling proxy (Hyperdrive, PgBouncer, Neon serverless driver) |
| `setTimeout`/`setInterval` for background work | Execution stops after response — timers are killed | Use platform queues (Cloudflare Queues, SQS) or `waitUntil` for fire-and-forget |
| Large `node_modules` bundled | Cold start penalty — 50ms per 1MB on Lambda, Workers have 10MB limit | Tree-shake, use ESM, consider edge-native alternatives to heavy packages |
| REST API calls to own platform services | Unnecessary network hop from inside the platform | Use in-process bindings (KV, R2, D1) not HTTP endpoints |

**Step 3 — Platform decision tree**
When deploying a new project, select the right platform:

```
What are you deploying?
├─ Static site + API routes → Vercel / Cloudflare Pages
├─ API-only (REST/GraphQL) → Cloudflare Workers / AWS Lambda
├─ Real-time (WebSocket) → Cloudflare Durable Objects / Fly.io
├─ Background jobs/queues → AWS SQS+Lambda / Cloudflare Queues
├─ Full-stack SSR → Vercel (Next.js) / Cloudflare Pages (any framework)
├─ Scheduled tasks (cron) → Cloudflare Cron Triggers / AWS EventBridge
├─ AI inference at edge → Cloudflare Workers AI / Vercel AI SDK
└─ Container workloads → Fly.io / Railway / Cloud Run
```

```
Where to store data?
├─ Key-value (sessions, config, cache) → Cloudflare KV / Vercel KV / DynamoDB
├─ Relational SQL → Cloudflare D1 / Neon / PlanetScale / Turso
├─ Object/file storage → Cloudflare R2 / S3 / Vercel Blob
├─ Vector embeddings → Cloudflare Vectorize / Pinecone / Turbopuffer
├─ Message queue → Cloudflare Queues / SQS / Upstash QStash
└─ Strongly consistent per-entity → Durable Objects / DynamoDB
```

**Step 4 — Emit deployment configuration**
Based on detected platform, emit production-ready config:

```toml
# wrangler.jsonc — Cloudflare Workers production config
{
  "name": "api-production",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "kv_namespaces": [
    { "binding": "CACHE", "id": "abc123" }
  ],
  "d1_databases": [
    { "binding": "DB", "database_name": "prod-db", "database_id": "def456" }
  ]
}
```

```json
// vercel.json — Vercel Edge Functions config
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge",
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=60, stale-while-revalidate=300" }
      ]
    }
  ]
}
```

**Step 5 — Streaming and response patterns**
Emit correct streaming patterns for the detected platform:

```typescript
// Cloudflare Workers — streaming response (never buffer large data)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const data = await env.R2_BUCKET.get('large-file.csv');
    if (!data) return new Response('Not found', { status: 404 });

    // CORRECT: stream the body directly — no buffering
    return new Response(data.body, {
      headers: { 'Content-Type': 'text/csv' },
    });
  },
};

// WRONG: buffering entire response in memory
// const text = await data.text(); // OOM on large files
// return new Response(text);
```

```typescript
// Vercel Edge Function — streaming AI response
import { OpenAI } from 'openai';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const openai = new OpenAI();

  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  // Stream chunks as they arrive — no buffering
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(`data: ${text}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| Cold start exceeds timeout on first request | Pre-warm with scheduled pings; minimize bundle size; use edge runtime where possible |
| Connection pool exhaustion from serverless fan-out | Use connection pooling proxy (Hyperdrive, PgBouncer); limit concurrency |
| `ctx` destructuring loses `this` binding in Workers | Never destructure `ctx` — always call `ctx.waitUntil()` directly |
| Environment variable vs binding confusion | Workers use `env.SECRET` (binding), not `process.env.SECRET` — detect platform and emit correct pattern |

---

### infra-as-code

Infrastructure-as-Code patterns — Terraform, Pulumi, and CDK for managing cloud infrastructure declaratively. Covers state management, module organization, secret handling, drift detection, and CI/CD integration for infrastructure changes.

#### Workflow

**Step 1 — Detect IaC tooling**
Use Glob to find `*.tf`, `terraform/`, `pulumi/`, `Pulumi.yaml`, `cdk.json`, `cdktf.json`, `*.tfvars`. Read configs to understand: provider (AWS/GCP/Cloudflare/Vercel), state backend (S3, Terraform Cloud, Pulumi Cloud), module structure, and variable management.

**Step 2 — Audit IaC best practices**
Check for:

| Issue | Detection | Severity |
|---|---|---|
| Local state (no remote backend) | `terraform.tfstate` in repo, no `backend` block | CRITICAL — state lost on disk failure, no locking |
| Secrets in `.tfvars` committed to git | Grep `.tfvars` for passwords, tokens, keys | CRITICAL — credential exposure |
| No state locking | S3 backend without DynamoDB table, or no locking config | HIGH — concurrent applies corrupt state |
| Hardcoded values instead of variables | Resource blocks with literal strings for env-specific values | MEDIUM — can't reuse across environments |
| Missing `lifecycle` blocks | Resources without `prevent_destroy` on critical infra (databases, storage) | HIGH — accidental deletion |
| No module structure | All resources in single `main.tf` | MEDIUM — unmaintainable at scale |
| No output definitions | Missing `output` blocks for cross-module references | LOW — harder to compose modules |

**Step 3 — Emit structured IaC project**
Generate or restructure into a modular layout:

```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf          # dev-specific overrides
│   │   ├── terraform.tfvars  # dev variables (no secrets!)
│   │   └── backend.tf       # dev state backend
│   ├── staging/
│   └── production/
├── modules/
│   ├── networking/           # VPC, subnets, security groups
│   ├── compute/              # EC2, ECS, Lambda, Workers
│   ├── database/             # RDS, D1, PlanetScale
│   └── monitoring/           # CloudWatch, alerts, dashboards
├── variables.tf              # shared variable definitions
├── outputs.tf                # exported values
└── versions.tf               # provider version constraints
```

**Step 4 — CI/CD for infrastructure**
Emit GitHub Actions workflow for safe infrastructure changes:

```yaml
# .github/workflows/infrastructure.yml
name: Infrastructure
on:
  pull_request:
    paths: ['infrastructure/**']
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
        working-directory: infrastructure/environments/production
      - run: terraform plan -out=tfplan -no-color
        working-directory: infrastructure/environments/production
      - uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: infrastructure/environments/production/tfplan

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production  # requires manual approval
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: actions/download-artifact@v4
        with: { name: tfplan }
      - run: terraform init && terraform apply tfplan
        working-directory: infrastructure/environments/production
```

#### Example — Terraform Module

```hcl
# modules/compute/workers/main.tf
# Cloudflare Workers deployment via Terraform

variable "name" {
  type        = string
  description = "Worker script name"
}

variable "account_id" {
  type      = string
  sensitive = true
}

variable "script_path" {
  type        = string
  description = "Path to compiled Worker script"
}

variable "kv_namespaces" {
  type    = map(string)
  default = {}
}

resource "cloudflare_workers_script" "worker" {
  account_id = var.account_id
  name       = var.name
  content    = file(var.script_path)
  module     = true

  dynamic "kv_namespace_binding" {
    for_each = var.kv_namespaces
    content {
      name         = kv_namespace_binding.key
      namespace_id = kv_namespace_binding.value
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_workers_route" "route" {
  zone_id     = var.zone_id
  pattern     = "${var.domain}/*"
  script_name = cloudflare_workers_script.worker.name
}

output "script_id" {
  value = cloudflare_workers_script.worker.id
}
```

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| `terraform destroy` on production without confirmation | Always use `lifecycle { prevent_destroy = true }` on databases, storage, DNS |
| State file contains secrets in plaintext | Use encrypted S3 backend or Terraform Cloud; never commit state to git |
| Module version unpinned — breaking change on next init | Pin module versions: `source = "hashicorp/consul/aws"` with `version = "~> 0.12"` |
| Drift between actual infra and state | Run `terraform plan` in CI on schedule (daily) to detect drift early |

---

## Connections

```
Calls → verification (L3): validate configs syntax and test infrastructure changes
Calls → sentinel (L2): security audit on server and container configuration
Calls → sentinel-env (L3): edge-serverless validates runtime prerequisites before deployment
Called By ← deploy (L2): deployment infrastructure setup
Called By ← launch (L1): production environment preparation
Called By ← cook (L1): when DevOps task detected
Called By ← scaffold (L1): infra-as-code generates infrastructure alongside project bootstrap
edge-serverless → docker: containerized apps may deploy to serverless container platforms (Cloud Run, Fly.io)
infra-as-code → ci-cd: IaC changes flow through CI/CD with plan-and-apply pipeline
infra-as-code → monitoring: IaC provisions monitoring infrastructure (alerts, dashboards)
```

## Tech Stack Support

| Platform | Container | CI/CD | Reverse Proxy |
|----------|-----------|-------|---------------|
| AWS (EC2/ECS/Lambda) | Docker | GitHub Actions | Nginx / ALB |
| GCP (Cloud Run/GKE) | Docker | Cloud Build / GitHub Actions | Caddy / Cloud LB |
| Vercel | Serverless | Built-in | Built-in |
| DigitalOcean (Droplet/App Platform) | Docker | GitHub Actions | Nginx / Caddy |
| VPS (any) | Docker | GitHub Actions (self-hosted) | Nginx / Caddy |
| Cloudflare Workers | Wrangler | GitHub Actions / Wrangler deploy | Workers Routes |
| Deno Deploy | Deno runtime | deployctl / GitHub Actions | Built-in |
| Fly.io | Docker/Firecracker | flyctl / GitHub Actions | Fly Proxy |

## Constraints

1. MUST pin base image versions in Dockerfiles — never use `latest` tag in production.
2. MUST NOT include secrets in CI/CD config files — use encrypted secrets or environment variables.
3. MUST emit both development and production configs when containerizing — never use dev config in production.
4. MUST include rollback strategy for every deployment change — no one-way changes.
5. MUST test configuration changes in staging before production — emit staging config alongside production.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Docker multi-stage build references wrong stage name causing empty final image | HIGH | Validate `COPY --from=` stage names match defined stages; emit build test command |
| CI caching key uses lockfile that doesn't exist (e.g., `pnpm-lock.yaml` when using npm) | HIGH | Detect actual package manager from lockfile presence before emitting cache config |
| Monitoring metrics have high cardinality labels (user ID as label) causing Prometheus OOM | CRITICAL | Constrain label values to bounded sets (method, route, status) — never use IDs as labels |
| SSH hardening locks out user (key-only auth before key is added) | CRITICAL | Emit config change AND key setup in correct order; include rollback instructions |
| SSL certificate renewal fails silently after initial setup | HIGH | Emit renewal test command (`certbot renew --dry-run`) and cron verification |
| Nginx config syntax error takes down production proxy | HIGH | Always emit `nginx -t` test command before reload; suggest blue-green proxy config |

## Done When

- Dockerfile emits multi-stage, non-root, health-checked, layer-optimized build
- CI/CD pipeline has caching, parallelization, deployment gates, and status checks
- Monitoring covers RED metrics, structured logging, and SLO-based alerting
- Server hardened: key-only SSH, firewall, security headers, rate limiting
- SSL automated with renewal verification
- Edge/serverless config audited: no anti-patterns (floating promises, global state, unbounded buffering), correct platform bindings, streaming patterns applied
- IaC structured: remote state with locking, modular layout, environment separation, CI/CD pipeline for plan/apply, `prevent_destroy` on critical resources
- All emitted configs tested with syntax validation commands
- Structured report emitted for each skill invoked

## Cost Profile

~16,000–28,000 tokens per full pack run (all 9 skills). Individual skill: ~2,000–4,500 tokens. Sonnet default. Use haiku for config detection scans; escalate to sonnet for config generation and security audit.
