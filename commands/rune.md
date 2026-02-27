---
description: "Rune skill ecosystem — interconnected workflows for the full project lifecycle. Use /rune <action> to invoke skills."
disable-model-invocation: true
---

# Rune — Less skills. Deeper connections.

Route to the appropriate Rune skill based on the action:

## Available Commands

### Orchestrators (L1)
- `/rune cook <task>` — Invoke the rune:cook skill for feature implementation
- `/rune team <task>` — Invoke the rune:team skill for parallel multi-agent work
- `/rune launch` — Invoke the rune:launch skill for deploy + marketing
- `/rune rescue` — Invoke the rune:rescue skill for legacy refactoring

### Workflow (L2) — Creation
- `/rune plan <task>` — Invoke the rune:plan skill to create implementation plan
- `/rune scout` — Invoke the rune:scout skill to scan codebase
- `/rune brainstorm <topic>` — Invoke the rune:brainstorm skill for creative ideation

### Workflow (L2) — Development
- `/rune debug <issue>` — Invoke the rune:debug skill for root cause analysis
- `/rune fix <issue>` — Invoke the rune:fix skill to apply code changes
- `/rune test` — Invoke the rune:test skill to write and run tests
- `/rune review` — Invoke the rune:review skill for code quality review

### Workflow (L2) — Quality
- `/rune sentinel` — Invoke the rune:sentinel skill for security scanning
- `/rune preflight` — Invoke the rune:preflight skill for pre-commit quality gate
- `/rune onboard` — Invoke the rune:onboard skill to generate project context

### Workflow (L2) — Delivery
- `/rune deploy` — Invoke the rune:deploy skill for deployment management
- `/rune marketing` — Invoke the rune:marketing skill for launch asset creation

### Workflow (L2) — Rescue
- `/rune autopsy` — Invoke the rune:autopsy skill for codebase health assessment
- `/rune safeguard` — Invoke the rune:safeguard skill to build safety nets for legacy code
- `/rune surgeon` — Invoke the rune:surgeon skill for incremental refactoring

### Utilities (L3) — Knowledge
- `/rune research <topic>` — Invoke the rune:research skill for web research
- `/rune docs-seeker <query>` — Invoke the rune:docs-seeker skill for documentation lookup
- `/rune trend-scout <topic>` — Invoke the rune:trend-scout skill for market intelligence

### Utilities (L3) — Reasoning
- `/rune problem-solver <problem>` — Invoke the rune:problem-solver skill for structured reasoning
- `/rune sequential-thinking <problem>` — Invoke the rune:sequential-thinking skill for multi-variable analysis

### Utilities (L3) — Validation
- `/rune verification` — Invoke the rune:verification skill to run lint, type-check, tests, build
- `/rune hallucination-guard` — Invoke the rune:hallucination-guard skill to verify imports and APIs

### Utilities (L3) — State
- `/rune context-engine` — Invoke the rune:context-engine skill for context window management
- `/rune journal` — Invoke the rune:journal skill for rescue state tracking
- `/rune session-bridge` — Invoke the rune:session-bridge skill for cross-session persistence

### Utilities (L3) — Monitoring
- `/rune watchdog` — Invoke the rune:watchdog skill for post-deploy monitoring
- `/rune scope-guard` — Invoke the rune:scope-guard skill for scope creep detection

### Utilities (L3) — Media
- `/rune browser-pilot <url>` — Invoke the rune:browser-pilot skill for Playwright automation
- `/rune asset-creator <brief>` — Invoke the rune:asset-creator skill for visual asset generation
- `/rune video-creator <brief>` — Invoke the rune:video-creator skill for video content planning

### Utilities (L3) — Deps
- `/rune dependency-doctor` — Invoke the rune:dependency-doctor skill for dependency management

### Intelligence (H3)
- `/rune metrics` — Show mesh analytics from .rune/metrics/ (runs audit Phase 8 only)
- `/rune pack list` — List installed L4 packs (core + community)
- `/rune pack install <git-url>` — Install a community L4 pack from Git
- `/rune pack remove <name>` — Remove a community L4 pack
- `/rune pack create <name>` — Scaffold a new L4 pack using skill-forge

### Extension Packs (L4)

L4 packs provide domain-specific patterns. When invoked, read the pack's PACK.md and follow the matching skill's workflow steps.

#### Frontend & UI (`extensions/ui/PACK.md`)
- `/rune design-system` — Design token generation and enforcement
- `/rune component-patterns` — Component architecture refactoring
- `/rune a11y-audit` — Accessibility audit (WCAG compliance)
- `/rune animation-patterns` — Motion design and animation patterns

#### Backend (`extensions/backend/PACK.md`)
- `/rune api-patterns` — REST/GraphQL API design and validation
- `/rune auth-patterns` — Authentication and authorization flows
- `/rune database-patterns` — Schema design, migrations, query optimization
- `/rune middleware-patterns` — Middleware pipeline and error handling

#### DevOps (`extensions/devops/PACK.md`)
- `/rune docker` — Dockerfile optimization, multi-stage builds, compose
- `/rune ci-cd` — CI/CD pipeline setup (GitHub Actions, GitLab CI)
- `/rune monitoring` — Observability, logging, alerting setup
- `/rune server-setup` — VPS/cloud server provisioning
- `/rune ssl-domain` — SSL certificates and domain configuration

#### Mobile (`extensions/mobile/PACK.md`)
- `/rune react-native` — React Native / Expo architecture and performance
- `/rune flutter` — Flutter state management and widget patterns
- `/rune app-store-prep` — App Store / Play Store submission preparation
- `/rune native-bridge` — Native module bridges (Turbo Modules, MethodChannel)

#### Security (`extensions/security/PACK.md`)
- `/rune owasp-audit` — OWASP Top 10 vulnerability audit
- `/rune pentest-patterns` — Penetration testing methodology
- `/rune secret-mgmt` — Secret management and rotation
- `/rune compliance` — Compliance framework guidance (SOC2, HIPAA, PCI)

#### Trading & Finance (`extensions/trading/PACK.md`)
- `/rune fintech-patterns` — Financial data validation, decimal arithmetic
- `/rune realtime-data` — WebSocket market data, order book management
- `/rune chart-components` — Trading chart integration (TradingView, Lightweight Charts)
- `/rune indicator-library` — Technical indicators (SMA, EMA, RSI, MACD)

#### SaaS (`extensions/saas/PACK.md`)
- `/rune multi-tenant` — Multi-tenancy architecture patterns
- `/rune billing-integration` — Stripe/Paddle billing integration
- `/rune subscription-flow` — Subscription lifecycle management
- `/rune onboarding-flow` — User onboarding flow design

#### E-commerce (`extensions/ecommerce/PACK.md`)
- `/rune shopify-dev` — Shopify theme/app development (Hydrogen, Liquid)
- `/rune payment-integration` — Payment flow (Stripe Payment Intents, 3DS)
- `/rune cart-system` — Shopping cart architecture
- `/rune inventory-mgmt` — Stock tracking with optimistic locking

#### AI/ML (`extensions/ai-ml/PACK.md`)
- `/rune llm-integration` — LLM API clients with retry and structured output
- `/rune rag-patterns` — RAG pipeline (chunking, embedding, retrieval, reranking)
- `/rune embedding-search` — Hybrid search (BM25 + vector)
- `/rune fine-tuning-guide` — Fine-tuning dataset prep, training, evaluation

#### Game Development (`extensions/gamedev/PACK.md`)
- `/rune threejs-patterns` — Three.js / React Three Fiber scene optimization
- `/rune webgl` — WebGL shader programming and buffer management
- `/rune game-loops` — Fixed timestep game loop with interpolation
- `/rune physics-engine` — Rapier.js physics integration
- `/rune asset-pipeline` — Game asset loading, compression, preloading

#### Content (`extensions/content/PACK.md`)
- `/rune blog-patterns` — Blog system (pagination, RSS, reading time)
- `/rune cms-integration` — Headless CMS setup (Sanity, Contentful, Strapi)
- `/rune mdx-authoring` — MDX pipeline with custom components
- `/rune i18n` — Internationalization (locale routing, translations)
- `/rune seo-patterns` — SEO audit (JSON-LD, sitemap, meta tags, OG)

#### Analytics (`extensions/analytics/PACK.md`)
- `/rune tracking-setup` — Analytics tracking with consent management
- `/rune ab-testing` — A/B experiment design and statistical significance
- `/rune funnel-analysis` — Conversion funnel tracking and drop-off analysis
- `/rune dashboard-patterns` — KPI dashboards with server-side aggregation

### Quick Actions
- `/rune status` — Show current project state from .rune/ files

## Usage

When the user runs `/rune <action>`, invoke the corresponding `rune:<action>` skill.
For L4 pack commands, read the specified PACK.md file and follow the matching skill's workflow.
If no action is provided, show this help menu.
