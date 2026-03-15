# ClaudeKit Competitive Analysis (Deep Research)

> Reference document. Not part of Rune's public docs.
> Date: 2026-02-27 | Updated: 2026-03-10 (deep research)

---

## What ClaudeKit Is

ClaudeKit ($99-149) sells pre-built skills, workflows, and agents for Claude Code.
Built by mrgoonie (18+ year CTO), battle-tested in real products, 4,000+ users across 109 countries.

- **Total**: 108+ skills, 95+ commands, 45 AI agents
- Engineer Kit: $99 — 70+ skills, 40+ workflows, 17 agents, 76 slash commands
- Marketing Kit: $99 — 8 MCP integrations, 32 agents, 68 skills, 119 commands, 5 workflows
- Bundle: $149 — both kits, lifetime access, 14-day money-back guarantee
- Payment: Stripe → private GitHub repo access
- Referral program: 20% recurring commission
- CLI: `bun add -g claudekit-cli` then `ck new --dir my-project --kit engineer`
- Also available as Claude Code Plugin Marketplace install

## Distribution Model

- Copies `.claude/` directory into each project (project-level, not global)
- Skills also available via Plugin Marketplace: `/plugin install ai-ml-tools@claudekit-skills`
- Requires `claude --dangerously-skip-permissions` for autonomous workflows
- Central config: `.claude/CLAUDE.md` controls all agent behaviors, skills, workflows
- Skills stored in `.claude/skills/` with auto-activation via codebase detection

## Repository Structure

```
.claude/
├── agents/          # 17 specialized agents (engineer) or 32 (marketing)
├── commands/        # 35+ workflow automation commands
├── skills/          # 40+ pre-built agent skills
├── workflows/       # Workflow coordination files
├── CLAUDE.md        # Central project context template
├── docs/            # Production documentation
└── plans/           # Implementation planning
```

---

## Engineer Kit — Complete Agent Roster (17)

### Development & Implementation
1. **planner** — Research, analyze, create implementation plans before coding
2. **fullstack-developer** — Full-stack implementation with strict file ownership + parallel execution
3. **researcher** — Parallel research & best practices discovery
4. **database-admin** — Schema design & migrations

### Quality & Testing
5. **tester** — Comprehensive test suite generation, coverage analysis
6. **code-reviewer** — Security audits, performance analysis, code quality
7. **code-simplifier** — Autonomous code refinement for clarity and maintainability
8. **debugger** — Root cause analysis, log investigation, issue diagnosis

### Design & Creative
9. **ui-ux-designer** — Screenshot to production UI + visual asset generation (Three.js, responsive)
10. **brainstormer** — Creative brainstorming, challenge assumptions, debate decisions
11. **copywriter** — Marketing copy & changelogs

### Documentation & Management
12. **docs-manager** — Technical documentation, API docs, architecture guides (auto-updating)
13. **project-manager** — Progress tracking, cross-agent coordination, status reports
14. **journal-writer** — Document failures and setbacks with brutal honesty
15. **git-manager** — Conventional commits, security scanning, token-optimized

### Integration & Research
16. **scout** — Codebase exploration & discovery
17. **scout-external** — External tools integration & discovery

### Agent Orchestration Patterns
- **Sequential**: planner → developer → tester → reviewer → git-manager
- **Parallel**: Independent agents work simultaneously, aggregate results
- **Hybrid**: Combines both for complex tasks
- Communication via shared files, handoff protocols, real-time progress tracking

---

## Marketing Kit — Complete Agent Roster (32)

### TOFU (Top of Funnel — Attraction) — 4 agents
- **attraction-specialist** — Keyword research, competitor content intelligence, landing page gen, programmatic SEO
- **seo-specialist** — Technical audits, content optimization, Search Console monitoring
- **lead-qualifier** — Lead scoring and intent detection
- **researcher** — Market intelligence and competitive trends

### MOFU (Middle of Funnel — Nurture) — 5 agents
- **email-wizard** — Sequence generation, dynamic personalization, send-time optimization, A/B testing
- **sale-enabler** — Sales collateral and pitch materials
- **funnel-architect** — Conversion optimization
- **content-creator** — Multi-format gen (blogs, videos, ad content), brand consistency, editorial calendars
- **continuity-specialist** — Customer retention and engagement

### BOFU (Bottom of Funnel — Convert) — 1 agent
- **upsell-maximizer** — Revenue expansion, product recommendations, revenue forecasting, feature adoption tracking

### Core Operations — 5 agents
- **campaign-manager** — Multi-channel coordination, budget optimization, performance tracking, launch workflows
- **copywriter** — High-converting copywriting
- **brainstormer** — Strategy and ideation
- **content-reviewer** — Quality control and brand voice consistency
- **campaign-debugger** — Performance issue diagnosis

### Community & Social — 2 agents
- **social-media-manager** — Multi-platform content management
- **community-manager** — Engagement and moderation

### Support & Infrastructure — 15 agents
- planner, project-manager, docs-manager, git-manager, journal-writer
- scout, scout-external, mcp-manager, analytics-analyst, tester
- (5 additional unnamed support agents)

### 8 MCP Integrations
1. **Google Analytics 4** — Analytics
2. **Google Search Console** — SEO monitoring
3. **Google Ads** — Ads management
4. **SendGrid** — Email campaigns
5. **Resend** — Email campaigns (alternative)
6. **Slack** — Team communication
7. **Discord** — Community management
8. **ReviewWeb** — Review aggregation

### 5 Marketing Workflows
1. **Marketing Workflow** — Research → Insights → Creative → Plan → Create → Edit → Publish → Measure
2. **Sales Workflow** — Lead gen → Qualification → Nurture → Close
3. **CRM Workflow** — Contact management + automation
4. **Video Production Workflow** — Script → Record → Edit → Publish
5. **Design Workflow** — Brief → Concept → Create → Review

---

## Complete Skills Catalog (from GitHub: mrgoonie/claudekit-skills)

### Authentication & Security
- **better-auth** — TypeScript auth framework (email/password, OAuth, 2FA, passkeys, multi-tenancy)

### AI & Machine Learning
- **ai-multimodal** — Google Gemini API (audio transcription, image analysis, video processing, doc extraction, image gen)
- **context-engineering** — AI agent optimization, degradation patterns, memory architectures
- **google-adk-python** — Google Agent Development Kit for multi-agent orchestration

### Backend Development
- **backend-development** — Node.js, Python, Go, Rust + NestJS, FastAPI, Django frameworks

### Frontend & Web
- **web-frameworks** — Next.js, Turborepo, RemixIcon
- **ui-styling** — shadcn/ui, Radix UI, Tailwind CSS, accessible components
- **frontend-design** — Production-grade interface creation
- **frontend-development** — React/TypeScript, Suspense, TanStack Router, MUI v7
- **threejs** — 3D web (WebGL/WebGPU, animations, shaders)
- **aesthetic** — Interface design principles (visual hierarchy, color theory, micro-interactions)

### Browser Automation & Testing
- **chrome-devtools** — Puppeteer CLI (automation, screenshots, performance analysis)
- **web-testing** — Playwright, Vitest, k6 (E2E, unit, integration, load, security, visual, accessibility)

### Cloud & DevOps
- **devops** — Cloudflare (Workers, R2, D1, KV, Pages, Durable Objects), Docker, GCP (Compute, GKE, Cloud Run)

### Databases
- **databases** — MongoDB (aggregation, Atlas) + PostgreSQL (schema, queries, optimization)

### Development Tools
- **claude-code** — Claude Code features (slash commands, hooks, plugins, MCP servers)
- **mcp-builder** — Build MCP servers (FastMCP Python / TypeScript)
- **mcp-management** — Manage MCP servers and tools
- **repomix** — Package repos into single AI-friendly files
- **media-processing** — FFmpeg + ImageMagick for multimedia

### Documentation & Research
- **docs-seeker** — Documentation discovery (llms.txt, GitHub analysis)

### Code Quality
- **code-review** — Feedback evaluation + completion verification
- **skill-creator** — Create reusable AI skills (SKILL.md < 100 lines, progressive disclosure)

### Debugging (4 sub-skills)
- **defense-in-depth** — Layer validation to prevent bugs structurally
- **root-cause-tracing** — Backward tracing through call stacks
- **systematic-debugging** — Four-phase debugging framework (reproduce → isolate → trace → fix)
- **verification-before-completion** — Command verification before success claims

### Document Processing (4 sub-skills)
- **docx** — Word document creation with tracked changes
- **pdf** — PDF extraction, creation, merging, form filling
- **pptx** — PowerPoint creation and editing
- **xlsx** — Spreadsheet building with formulas and financial modeling

### E-commerce
- **shopify** — Shopify apps, extensions, themes (GraphQL/REST)

### Payments
- **payment-integration** — SePay, Polar, Stripe, Paddle, Creem.io + webhook verification

### Problem-Solving (6 sub-skills)
- **collision-zone-thinking** — Combining unrelated concepts
- **inversion-exercise** — Testing opposite assumptions
- **meta-pattern-recognition** — Identifying universal principles
- **scale-game** — Testing at extreme scales
- **simplification-cascades** — Eliminating components via single insights
- **when-stuck** — Dispatching to appropriate techniques

### Advanced Reasoning
- **sequential-thinking** — Step-by-step reasoning with revision

### Visualization
- **mermaidjs-v11** — 24+ diagram types (flowcharts, sequence diagrams, etc.)

### Meta
- **mcp-manager** — Subagent for managing MCP context without bloat

**Total confirmed individual skills: ~40+ with sub-skills bringing count to ~55+**

---

## Complete Slash Commands

### Core Development
- `/ck:plan <description>` — Create implementation plan
- `/ck:plan --two` — Two-step implementation plan
- `/ck:cook <description>` — Implement new features
- `/ck:cook --auto <description>` — Autonomous feature implementation
- `/ck:bootstrap <idea>` — Bootstrap new project (interactive)
- `/ck:bootstrap --auto <idea>` — Fully autonomous project bootstrap
- `/ck:test` — Run test suite and report
- `/ck:debug` — Log analysis and root cause diagnosis
- `/ck:scout` — Code analysis agent
- `/ck:fix --quick <desc>` — Quick bug fix
- `/ck:fix <description>` — Auto-detect complexity bug fix
- `/ck:fix` (no args) — Auto-fetch logs or detect failing tests
- `/ck:fix <github-action-url>` — Fix CI/CD pipeline issues

### Documentation
- `/ck:docs init` — Initialize documentation and specs
- `/ck:docs update` — Update existing documentation
- `/ck:docs summarize` — Summarize documentation

### Git Operations
- `/ck:git cm` — Create commit with meaningful message
- `/ck:git cp` — Commit and push
- `/ck:git pr` — Create pull request

### Code Quality
- `/review:codebase` — Full codebase review (security, performance, standards)
- `/ck:brainstorm <description>` — Brainstorm technical approaches

### Integration
- `/integrate:polar` — Polar API integration
- `/integrate:sepay` — SePay payment integration
- `/integrate <service>` — Generic integration

### Marketing-Specific
- `/plan` — Campaign planning
- `/content/good` — Landing page generation
- `/content/cro` — CRO-optimized copy
- `/seo:audit` — SEO audit
- `/seo:keywords` — Keyword research and competitor analysis
- `/campaign:email` — Email campaigns via SendGrid/Resend

### Context Management
- `/clear` — Context window reset

**Total: 76+ engineer commands + 119 marketing commands = ~195 total**

---

## Key Workflow: /bootstrap (Detailed)

```
/bootstrap "build a REST API with auth"
→ Q&A: app type (REST/Web/Mobile/CLI), tech stack, DB, auth method
→ Phase 1: Researcher agents find best practices, libraries, security considerations
→ Phase 2: Planner agents create architecture, file structure, implementation steps, test strategy
→ Phase 3: Create project structure
→ Phase 4: Implement code (auth, CRUD, validation, rate limiting)
→ Phase 5: Generate tests (87% coverage target)
→ Phase 6: Generate docs (Swagger, README, architecture)
→ Total: 5-8 minutes, fully autonomous
```

Autonomous mode: `/bootstrap:auto [detailed description]` — skips Q&A, requires detailed input.

Output structure:
```
project/
├── .claude/         # Custom commands, agent definitions, workflows
├── src/             # Routes, models, middleware, utilities, entry point
├── tests/           # Unit, integration, E2E
└── docs/            # API docs, code standards, system architecture, codebase summary
```

---

## CCS (Claude Code Switch) — Multi-Account Tool

- **Purpose**: Switch between multiple Claude accounts + AI models instantly
- **Auth**: Browser-based OAuth (30 seconds, authenticate once)
- **Profiles**: Each profile has own todos, sessions, logs (true isolation)
- **Models**: Claude, Gemini 2.5 Pro, GPT-4o, o1, Antigravity via OpenRouter (300+ models)
- **Cost savings**: $500-1000/month claimed — GLM handles 70% of tasks at 80% lower cost
- **Dashboard**: React 19 real-time UI for profile management
- **Website**: ccs.kaitran.ca
- **Architecture**: v3.0 login-per-profile, CLIProxyAPI OAuth proxy

---

## Architecture Deep Dive

### Three Interconnected Systems
1. **Agents** — Specialized AI assistants with defined roles
2. **Commands/Skills** — Slash commands that invoke agents + knowledge modules
3. **Workflows** — Coordination patterns ensuring agents work cohesively

### Skill Mechanism
- Files in `.claude/skills/skill-name/SKILL.md` (< 100 lines, imperative form)
- Auto-activated via codebase detection (e.g., `next.config.js` → Next.js skill)
- Progressive disclosure: core SKILL.md + `/scripts/`, `/references/`, `/assets/`
- Distributable as ZIP packages

### Agent Communication
- Shared files for context passing (plans, code, test results)
- Handoff protocols between agents
- Real-time progress tracking visible to users
- Sequential, Parallel, or Hybrid orchestration

### Workflow Example: `/ck:cook "add auth with Better Auth"`
1. System detects Better Auth skill → injects context
2. Planner agent generates plan referencing skill patterns
3. Developer agent writes code following skill guidelines
4. Tester agent creates tests from skill examples
5. Results consolidated for user

---

## User Reviews & Testimonials

- "Worth the $30/month, big time!" (pricing discrepancy — possibly old pricing or subscription model)
- "It fixed all the CodeRabbit issues it found" — code review automation
- "The /plan and /cook features are very impressive"
- "Project alignment achieved within 1 session"
- "Completed a feature with just a single prompt"
- "Productivity doubled from 8 to 16 hours"
- Users praise stability improvements over raw Claude Code
- 4,000+ users across 109 countries

## Rune vs ClaudeKit

| Dimension | ClaudeKit | Rune |
|-----------|-----------|------|
| Install | Copy files per project | Global plugin |
| Pricing | $99-149 one-time | Free (MIT) |
| Automation | Fully autonomous (skip-permissions) | HARD-GATEs, user approves plan |
| Philosophy | Hands-off, AI does everything | Developer stays in the loop |
| Safety | Low (skips all permissions) | High (sentinel, gates, reviews) |
| Mesh | No documented skill connections | 160+ bidirectional connections |
| Cross-session | Not documented | .rune/ persistence |
| Security | Not documented | sentinel, sast, integrity-check |
| Skills count | 108+ skills, 95+ shortcuts, 45+ agents | 49 core + 12 L4 packs (free) + Pro packs (planned) |

## Key Takeaways

1. **Market validates demand** — people pay $99-149 for Claude Code productivity tools
2. **Autonomous execution sells** — "describe and get result" is the primary value prop
3. **No marketplace payment needed** — Stripe + private GitHub repo is the pattern
4. **Project-level > plugin-level for some use cases** — copying .claude/ gives full control
5. **`--dangerously-skip-permissions` is the enabler** — without it, autonomous workflows aren't possible
6. **Marketing Kit is unique** — no equivalent in Rune (and shouldn't be per VISION.md anti-goals)

## What Rune Should NOT Copy

- Skip-permissions approach — contradicts Rune's safety philosophy
- Per-project file copying — Rune's plugin model is cleaner
- Quantity-first approach (108+ skills) — Rune optimizes for connections, not count
- ~~Marketing/non-dev skills~~ — **REVISED**: Rune Pro will cover business departments as paid packs (separate repo)

## Competitive Positioning (Updated 2025-03-10)

### Numbers comparison

| Metric | ClaudeKit | Rune Free | Rune Free + Pro (planned) |
|--------|-----------|-----------|---------------------------|
| Skills | 108+ | 49 core | 49 + ~54 pro sub-skills |
| Shortcuts/Commands | 95+ | ~20 | ~65 (with pro workflows) |
| Agents | 45+ | 21 (L3 utilities) | ~30 |
| L4 Packs | N/A | 12 | 12 free + 9 pro |
| Price | $99-149 | FREE | $29-49/mo or $199 lifetime |
| Mesh connections | Not documented | 170+ | 200+ (pro adds cross-domain) |
| Platforms | Claude Code only | 5 platforms | 5 platforms |
| Safety | Skip-permissions | HARD-GATEs + sentinel | HARD-GATEs + sentinel |

### Rune's differentiation

1. **Free core with deep mesh** — ClaudeKit charges $99 for what Rune gives free
2. **Multi-platform** — ClaudeKit is Claude Code only. Rune works on Cursor, Windsurf, Antigravity
3. **Safety-first** — ClaudeKit requires `--dangerously-skip-permissions`. Rune uses HARD-GATEs
4. **Mesh architecture** — 170+ connections vs flat skill list. Skills compose, not just coexist
5. **Pro = business expansion** — ClaudeKit's Marketing Kit = $99 for 28 agents. Rune Pro = $29-49/mo for 9 packs across all departments

### Where ClaudeKit wins

1. **Autonomous execution** — `/bootstrap` generates full project in 5-8 min without user interaction
2. **Quantity perception** — "108+ skills" sounds bigger than "49 skills" even if Rune's are deeper
3. **Established market** — already has paying customers, proven demand
4. **CCS multi-account** — account switching between providers (unique feature)

## What Rune Could Learn (for other projects)

- Autonomous `/bootstrap` workflow — powerful for greenfield projects
- Interactive config before execution — better UX than "approve each phase"
- Agent Teams orchestration — similar to Rune's `team` but more hands-off
- One-command project generation — high perceived value
