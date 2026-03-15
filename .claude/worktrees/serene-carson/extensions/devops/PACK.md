---
name: "@rune/devops"
description: DevOps patterns — Docker, CI/CD pipelines, monitoring setup, server configuration, and SSL/domain management.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: "$12"
  target: DevOps engineers
---

# @rune/devops

## Purpose

Infrastructure work done without patterns leads to snowflake configs: Dockerfiles that rebuild entire node_modules on every code change, CI pipelines that run 40 minutes because nothing is cached, servers with no monitoring until the first outage, and SSL certificates that expire silently. This pack provides battle-tested patterns for containerization, continuous delivery, production observability, and server hardening — each skill detects what you have, audits it against best practices, and emits the fixed config.

## Triggers

- Auto-trigger: when `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `.gitlab-ci.yml`, `nginx.conf`, `Caddyfile` detected in project
- `/rune docker` — audit and optimize container configuration
- `/rune ci-cd` — audit and optimize CI/CD pipeline
- `/rune monitoring` — set up or audit production monitoring
- `/rune server-setup` — audit server configuration
- `/rune ssl-domain` — manage SSL certificates and domain config
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

## Connections

```
Calls → verification (L3): validate configs syntax and test infrastructure changes
Calls → sentinel (L2): security audit on server and container configuration
Called By ← deploy (L2): deployment infrastructure setup
Called By ← launch (L1): production environment preparation
Called By ← cook (L1): when DevOps task detected
```

## Tech Stack Support

| Platform | Container | CI/CD | Reverse Proxy |
|----------|-----------|-------|---------------|
| AWS (EC2/ECS/Lambda) | Docker | GitHub Actions | Nginx / ALB |
| GCP (Cloud Run/GKE) | Docker | Cloud Build / GitHub Actions | Caddy / Cloud LB |
| Vercel | Serverless | Built-in | Built-in |
| DigitalOcean (Droplet/App Platform) | Docker | GitHub Actions | Nginx / Caddy |
| VPS (any) | Docker | GitHub Actions (self-hosted) | Nginx / Caddy |

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
- All emitted configs tested with syntax validation commands
- Structured report emitted for each skill invoked

## Cost Profile

~10,000–18,000 tokens per full pack run (all 5 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for config detection scans; escalate to sonnet for config generation and security audit.
