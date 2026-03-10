# Rune Skill Expansion Plan — Closing the Gaps

Status: PLANNED | Created: 2025-03-10
Target: v2.1.0 — "The Missing Pieces"

## Goal

Expand Rune from 49 → 55 core skills by filling 6 competitive gaps identified from ClaudeKit analysis + enterprise AI agent research. Each new skill must integrate into the existing mesh — no orphan skills.

## New Skills Overview

| # | Skill | Layer | Model | Group | Solves |
|---|-------|-------|-------|-------|--------|
| 1 | `ba` (Business Analyst) | L2 | opus | creation | "User request vague → agent guesses → wrong result" |
| 2 | `scaffold` | L1 | sonnet | orchestrator | "Starting new project takes hours of boilerplate" |
| 3 | `docs` | L2 | sonnet | delivery | "Documentation always outdated, never auto-updated" |
| 4 | `git` | L3 | haiku | utility | "Commit messages inconsistent, PR descriptions weak" |
| 5 | `mcp-builder` | L2 | sonnet | creation | "Building MCP servers from scratch is hard" |
| 6 | `doc-processor` | L3 | sonnet | utility | "Can't generate/parse docx, pdf, xlsx, pptx" |

## Architecture Impact

### Updated Layer Counts (49 → 55)
```
L0: 1  (skill-router)              — unchanged
L1: 5  (cook, team, launch, rescue, scaffold)    — +1
L2: 26 (+ ba, docs, mcp-builder)   — +3
L3: 23 (+ git, doc-processor)      — +2
L4: 12 extension packs             — unchanged
```

### Mesh Connections (new wiring)

```
ba ──────► plan ──────► cook ──────► fix
│                        │            │
│          scaffold ─────┤            │
│          │  │  │       │            │
│          │  │  └► design             │
│          │  └──► test               │
│          └───► docs                 │
│                  │                  │
└──────────────────┘                  │
                                     │
git ◄──── cook Phase 7               │
git ◄──── scaffold Phase 7           │
git ◄──── team (parallel PRs)        │
                                     │
doc-processor ◄── docs               │
doc-processor ◄── marketing          │
doc-processor ◄── Rune Pro packs     │

mcp-builder ──► test (verify server)
mcp-builder ──► docs (generate docs)
mcp-builder ◄── cook (MCP task detected)
```

---

## Phase 1: `ba` — Business Analyst (HIGHEST PRIORITY)

### Why First

This is the ROOT CAUSE of "Claude làm nhiều nhưng không ra gì". Without deep requirement analysis:
- User says "build auth" → Claude codes immediately → misses edge cases → rework
- User says "integrate Telegram" → Claude tries obvious approach → fails → loops

BA forces DEEP UNDERSTANDING before any code. It's the skill that makes ALL other skills work better.

### Pipeline Position

```
BEFORE BA:  User request → plan → cook → (fails, rework, confusion)
AFTER BA:   User request → BA → plan → cook → (right first time)
```

### Skill Definition: `ba`

```yaml
name: ba
description: >
  Business Analyst agent. Deeply understands user requirements before any
  planning or coding begins. Asks probing questions, identifies hidden
  requirements, maps stakeholders, defines scope boundaries, and produces
  a structured Requirements Document that plan and cook consume.
layer: L2
model: opus
group: creation
```

### Triggers

- Called by `cook` Phase 1 when task is product-oriented (not a simple bug fix)
- Called by `scaffold` Phase 1 before any project generation
- `/rune ba <requirement>` — manual invocation
- Auto-trigger: when user description is > 50 words OR contains business terms (users, revenue, workflow, integration)

### Calls (outbound)

- `scout` (L2): scan existing codebase for context
- `research` (L3): look up similar products, APIs, integrations
- `plan` (L2): hand off Requirements Document for implementation planning
- `brainstorm` (L2): when multiple approaches exist for a requirement

### Called By (inbound)

- `cook` (L1): before Phase 2 PLAN, when task is non-trivial
- `scaffold` (L1): Phase 1, before any project generation
- `plan` (L2): when plan receives vague requirements
- User: `/rune ba` direct invocation

### Executable Steps

#### Step 1 — Intake & Classify

Read the user's request. Classify the requirement type:

| Type | Signal | Depth |
|------|--------|-------|
| Feature Request | "add X", "build Y", "I want Z" | Full BA cycle |
| Bug Fix | "broken", "error", "doesn't work" | Skip BA → direct to debug |
| Refactor | "clean up", "refactor", "restructure" | Light BA (scope only) |
| Integration | "connect X to Y", "integrate with Z" | Full BA + API research |
| Greenfield | "new project", "build from scratch" | Full BA + market context |

If Bug Fix → skip BA, route to cook/debug directly.
If Refactor → light version (Step 1 + Step 4 only).

#### Step 2 — Requirement Elicitation (the "5 Questions")

Ask exactly 5 probing questions, ONE AT A TIME (not all at once):

1. **WHO** — "Who is the end user? What's their technical level? What are they doing right before and after using this feature?"
2. **WHAT** — "What specific outcome do they need? What does 'done' look like from the user's perspective?"
3. **WHY** — "Why do they need this? What problem does this solve? What happens if we don't build it?"
4. **BOUNDARIES** — "What should this NOT do? What's explicitly out of scope?"
5. **CONSTRAINTS** — "Any technical constraints? (existing APIs, performance requirements, security needs, deadlines)"

<HARD-GATE>
Do NOT skip questions. Do NOT answer your own questions.
If user says "just build it" → respond with: "I'll build it better with 2 minutes of context. Question 1: [WHO]"
Each question must be asked separately, wait for answer before next.
Exception: if user provides a detailed spec/PRD → extract answers from it, confirm with user.
</HARD-GATE>

#### Step 3 — Hidden Requirement Discovery

After the 5 questions, analyze for requirements the user DIDN'T mention:

**Technical hidden requirements:**
- Authentication/authorization needed?
- Rate limiting needed?
- Data persistence needed? (what DB, what schema)
- Error handling strategy?
- Offline/fallback behavior?
- Mobile responsiveness?
- Accessibility requirements?
- Internationalization?

**Business hidden requirements:**
- What happens on failure? (graceful degradation)
- What data needs to be tracked? (analytics events)
- Who else is affected? (other teams, other systems)
- What are the edge cases? (empty state, max limits, concurrent access)
- Regulatory/compliance needs? (GDPR, PCI, HIPAA)

Present discovered hidden requirements to user: "I found N additional requirements you may not have considered: [list]. Which are relevant?"

#### Step 4 — Scope Definition

Based on all gathered information, produce:

**In-Scope** (explicitly included):
- [list of features/behaviors]

**Out-of-Scope** (explicitly excluded):
- [list of things we WON'T build]

**Assumptions** (things we're assuming without proof):
- [list — each assumption is a risk if wrong]

**Dependencies** (things that must exist before we can build):
- [list of APIs, services, libraries, access]

#### Step 5 — User Stories & Acceptance Criteria

For each in-scope feature, generate:

```
US-1: As a [persona], I want to [action] so that [benefit]
  AC-1.1: GIVEN [context] WHEN [action] THEN [result]
  AC-1.2: GIVEN [error case] WHEN [action] THEN [error handling]
  AC-1.3: GIVEN [edge case] WHEN [action] THEN [graceful behavior]
```

Rules:
- Primary user story first, then edge cases
- Every user story has at least 2 acceptance criteria (happy path + error)
- Acceptance criteria are TESTABLE — they become test cases in Phase 3

#### Step 6 — Non-Functional Requirements (NFRs)

Assess and document:

| NFR | Requirement | Measurement |
|-----|-------------|-------------|
| Performance | Page load < Xs, API response < Yms | Lighthouse, k6 |
| Security | Auth required, input validation, OWASP top 10 | sentinel scan |
| Scalability | Expected users, data volume | Load test target |
| Reliability | Uptime target, error budget | Monitoring threshold |
| Accessibility | WCAG 2.2 AA | Axe audit |

Only include NFRs relevant to this specific task. Don't generate generic checklist.

#### Step 7 — Requirements Document

Produce structured output and hand off to `plan`:

```markdown
# Requirements Document: [Feature Name]
Created: [date] | BA Session: [summary]

## Context
[Problem statement — 2-3 sentences]

## Stakeholders
- Primary user: [who]
- Affected systems: [what]

## User Stories
[from Step 5]

## Scope
### In Scope
[from Step 4]
### Out of Scope
[from Step 4]
### Assumptions
[from Step 4]

## Non-Functional Requirements
[from Step 6]

## Dependencies
[from Step 4]

## Risks
- [risk]: [mitigation]

## Next Step
→ Hand off to rune:plan for implementation planning
```

Save to `.rune/features/<feature-name>/requirements.md`

### Constraints

1. MUST ask 5 probing questions before producing requirements — no assumptions
2. MUST identify hidden requirements — the obvious ones are never the full picture
3. MUST define out-of-scope explicitly — prevents scope creep
4. MUST produce testable acceptance criteria — they become test cases
5. MUST NOT write code or plan implementation — BA produces WHAT, plan produces HOW
6. MUST ask ONE question at a time — don't overwhelm user

### Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Skipping questions because "requirements are obvious" | CRITICAL | HARD-GATE: 5 questions mandatory, even for "simple" tasks |
| Answering own questions instead of asking user | HIGH | Questions require USER input — BA doesn't guess |
| Producing implementation details (HOW) instead of requirements (WHAT) | HIGH | BA outputs requirements doc → plan outputs implementation |
| All-at-once question dump | MEDIUM | One question at a time, wait for answer |
| Missing hidden requirements (auth, error handling, edge cases) | HIGH | Step 3 checklist is mandatory scan |
| Requirements doc too verbose (>500 lines) | MEDIUM | Max 200 lines — concise, actionable, testable |

### Mesh Integration

- `cook` Phase 1 gains new sub-step: "If task is non-trivial → invoke `rune:ba` before Phase 2"
- `plan` Step 1 gains new input: "If requirements.md exists → read it, don't re-gather context"
- `scaffold` Phase 1 REQUIRES ba output before proceeding
- `brainstorm` can be called by ba when multiple approaches exist for a requirement

### Done When

- 5 probing questions asked and answered
- Hidden requirements discovered and confirmed with user
- Scope defined (in/out/assumptions/dependencies)
- User stories with testable acceptance criteria produced
- Requirements Document saved to `.rune/features/<name>/requirements.md`
- Handed off to `plan` for implementation planning

### Cost Profile

~3000-6000 tokens input, ~1500-3000 tokens output. Opus for deep requirement analysis — understanding WHAT to build is the most expensive mistake to get wrong.

---

## Phase 2: `scaffold` — Project Bootstrap (HIGHEST USER DEMAND)

### Why Second

"/bootstrap generates full project in 5-8 minutes" is ClaudeKit's #1 selling point. This is what makes users say "worth $99". Rune needs this.

### Skill Definition: `scaffold`

```yaml
name: scaffold
description: >
  Autonomous project bootstrapper. Generates complete project from a
  description — structure, code, tests, docs, config. Orchestrates
  ba → plan → design → fix → test → docs → git in one pipeline.
  The "0 to production-ready" skill.
layer: L1
model: sonnet
group: orchestrator
```

### Pipeline

```
User: "build a REST API with auth and payments"
  │
  ▼
Phase 1: BA — requirement elicitation (5 questions or detailed description)
  │
  ▼
Phase 2: RESEARCH — find best practices, starter templates, libraries
  │
  ▼
Phase 3: PLAN — architecture + file structure + implementation steps
  │
  ▼
Phase 4: DESIGN — if frontend: generate design system
  │
  ▼
Phase 5: IMPLEMENT — generate code (parallel agents for independent modules)
  │
  ▼
Phase 6: TEST — generate test suite (target 80%+ coverage)
  │
  ▼
Phase 7: DOCS — README, API docs, architecture doc
  │
  ▼
Phase 8: GIT — initial commit with semantic message
  │
  ▼
Phase 9: VERIFY — lint + types + tests + build all pass
  │
  Output: Complete project ready to develop on
```

### Modes

#### Interactive Mode (default)
```
/rune scaffold "REST API with auth"
→ BA asks 5 questions
→ Plan presented for approval
→ Design system presented (if frontend)
→ Implementation proceeds
→ User reviews at each phase gate
```

#### Express Mode
```
/rune scaffold express "REST API with auth, Node.js, PostgreSQL, JWT auth,
  Stripe payments, Docker, GitHub Actions CI"
→ BA extracts requirements from description (no questions)
→ Plan auto-approved (user gave enough detail)
→ Proceeds autonomously
→ User reviews only at end
```

### Project Templates (auto-detected from BA output)

| Template | Stack | What's generated |
|----------|-------|------------------|
| REST API | Node.js/Python + DB + Auth | Routes, models, middleware, migrations, Docker, CI |
| Web App (Full-stack) | Next.js/SvelteKit + DB | Pages, components, API routes, auth, DB setup |
| CLI Tool | Node.js/Python/Rust | Commands, args parsing, config, tests |
| Library/Package | TypeScript/Python | Src, tests, build config, npm/pypi publish setup |
| MCP Server | TypeScript/Python | Tools, resources, handlers, tests (calls mcp-builder) |
| Chrome Extension | React/Vanilla | Manifest, popup, content script, background, tests |
| Mobile App | React Native/Expo | Screens, navigation, auth, API client |

### Calls (outbound)

- `ba` (L2): Phase 1 — requirement elicitation
- `research` (L3): Phase 2 — best practices, starter templates
- `plan` (L2): Phase 3 — architecture and implementation plan
- `design` (L2): Phase 4 — design system (frontend projects only)
- `fix` (L2): Phase 5 — code generation
- `test` (L2): Phase 6 — test suite generation
- `docs` (L2): Phase 7 — documentation generation
- `git` (L3): Phase 8 — initial commit
- `verification` (L3): Phase 9 — lint + types + tests + build
- `sentinel` (L2): Phase 9 — security scan on generated code
- `team` (L1): Phase 5 — parallel implementation when 3+ independent modules

### Constraints

1. MUST run BA (Phase 1) before generating any code — even in Express mode, extract requirements
2. MUST generate tests — no project without test suite is "production-ready"
3. MUST generate docs — README at minimum, API docs if applicable
4. MUST pass verification — generated project must build and pass lint/types/tests
5. MUST NOT use `--dangerously-skip-permissions` — user approves at phase gates
6. MUST NOT generate hardcoded secrets — use .env.example with placeholder values
7. Express mode MUST still validate — auto-approve doesn't mean skip quality checks

### Output

```
## Scaffold Report: [Project Name]
- **Template**: [detected template]
- **Files Generated**: [count]
- **Test Coverage**: [percentage]
- **Phases**: BA → Research → Plan → Design? → Implement → Test → Docs → Git → Verify
- **Time**: [duration]

### Generated Structure
[file tree]

### What's Included
- [feature list with implementation details]

### What's NOT Included (Next Steps)
- [out-of-scope items from BA that user should build next]

### Commands
- `npm run dev` / `python manage.py runserver` — start development
- `npm test` / `pytest` — run tests
- `npm run build` / ... — production build
```

---

## Phase 3: `docs` — Documentation Manager

### Skill Definition

```yaml
name: docs
description: >
  Auto-generate and maintain project documentation. Creates README,
  API docs, architecture docs, changelogs, and keeps them in sync
  with code changes. The "docs are never outdated" skill.
layer: L2
model: sonnet
group: delivery
```

### Workflows

#### `/rune docs init` — First-time documentation generation
1. Scout codebase → extract features, API endpoints, components
2. Generate: README.md, ARCHITECTURE.md, API.md (if applicable)
3. Add doc generation to pre-commit hook suggestion

#### `/rune docs update` — Sync docs with code changes
1. Git diff since last docs update → identify changed modules
2. Re-scan changed files → update affected doc sections
3. Generate CHANGELOG entry from commits since last update

#### `/rune docs api` — API documentation
1. Scan route files (Express/FastAPI/NestJS/etc.)
2. Extract: endpoints, methods, params, request/response shapes
3. Generate OpenAPI/Swagger spec OR markdown API reference

#### `/rune docs changelog` — Auto-generate changelog
1. Read git log since last tag/release
2. Group commits by type (feat, fix, refactor, docs)
3. Generate CHANGELOG.md entry in Keep a Changelog format

### Calls (outbound)
- `scout` (L2): scan codebase for documentation targets
- `doc-processor` (L3): generate PDF/DOCX exports if requested
- `git` (L3): read commit history for changelog

### Called By (inbound)
- `scaffold` (L1): Phase 7 — generate initial docs
- `cook` (L1): post-Phase 7 — update docs after feature implementation
- `launch` (L1): pre-deploy — ensure docs are current
- User: `/rune docs` direct invocation

---

## Phase 4: `git` — Git Operations Specialist

### Skill Definition

```yaml
name: git
description: >
  Specialized git operations — semantic commits, PR descriptions,
  branch management, conflict resolution guidance. Replaces ad-hoc
  git commands in cook Phase 7 with a dedicated, convention-aware utility.
layer: L3
model: haiku
group: utility
```

### Sub-workflows

#### `git commit` — Semantic commit creation
- Analyze staged diff → generate conventional commit message
- Detect: feat/fix/refactor/test/docs/chore from diff content
- Format: `<type>(<scope>): <description>` + body if > 5 files changed
- Breaking change detection → add `!` suffix + BREAKING CHANGE footer

#### `git pr` — Pull request generation
- Analyze ALL commits on branch (not just latest)
- Generate: title (< 70 chars), summary (bullet points), test plan
- Include: files changed count, test results, breaking changes

#### `git branch` — Branch naming
- From task description → generate branch name: `feat/short-description`, `fix/issue-123`

#### `git changelog` — Changelog from commits
- Group by type, link to PRs/issues, format as Keep a Changelog

### Calls: None (pure L3 utility)
### Called By: cook (L1), scaffold (L1), team (L1), launch (L1), docs (L2)

---

## Phase 5: `mcp-builder` — MCP Server Builder

### Skill Definition

```yaml
name: mcp-builder
description: >
  Build Model Context Protocol servers from specifications. Generates
  tool definitions, resource handlers, and test suites for MCP servers
  in TypeScript or Python (FastMCP).
layer: L2
model: sonnet
group: creation
```

### Workflow

#### Step 1 — Spec Elicitation
- What tools should this MCP server expose?
- What resources does it manage?
- What external APIs does it connect to?
- TypeScript or Python (FastMCP)?

#### Step 2 — Generate Server
- Tool definitions with input schemas (Zod/Pydantic)
- Resource handlers with URI templates
- Error handling and validation
- Configuration via environment variables

#### Step 3 — Generate Tests
- Tool invocation tests with mock data
- Resource read tests
- Error case coverage
- Integration test template for real API

#### Step 4 — Generate Docs
- Tool catalog with input/output schemas
- Installation instructions
- Configuration reference
- Example usage in Claude Code / Cursor / other IDEs

### Calls (outbound)
- `ba` (L2): if user description is vague
- `research` (L3): look up target API documentation
- `test` (L2): generate test suite
- `docs` (L2): generate server documentation
- `verification` (L3): verify server builds and tests pass

### Called By (inbound)
- `cook` (L1): when MCP-related task detected
- `scaffold` (L1): MCP Server template
- User: `/rune mcp-builder` direct invocation

---

## Phase 6: `doc-processor` — Document Processing

### Skill Definition

```yaml
name: doc-processor
description: >
  Generate and parse office documents — PDF, DOCX, XLSX, PPTX.
  Creates reports, exports data, and processes uploaded documents.
  Pure utility — no business logic, just format handling.
layer: L3
model: sonnet
group: utility
```

### Capabilities

| Format | Generate | Parse | Libraries |
|--------|----------|-------|-----------|
| PDF | Yes | Yes (via Read tool) | jsPDF, Puppeteer HTML→PDF |
| DOCX | Yes | Yes | docx (npm), python-docx |
| XLSX | Yes | Yes | ExcelJS, openpyxl |
| PPTX | Yes | Yes | pptxgenjs, python-pptx |
| CSV | Yes | Yes | Built-in |

### Calls: None (pure L3 utility)
### Called By: docs (L2), marketing (L2), Rune Pro packs

---

## Implementation Timeline

| Phase | Skill | Priority | Depends On | Estimated Effort |
|-------|-------|----------|------------|------------------|
| **Phase 1** | `ba` | CRITICAL | Nothing | Write SKILL.md + wire into cook/plan |
| **Phase 2** | `scaffold` | HIGH | ba, docs, git | Write SKILL.md + 7 project templates |
| **Phase 3** | `docs` | HIGH | git | Write SKILL.md + 4 sub-workflows |
| **Phase 4** | `git` | MEDIUM | Nothing | Write SKILL.md + 4 sub-workflows |
| **Phase 5** | `mcp-builder` | MEDIUM | docs, test | Write SKILL.md + TS/Python templates |
| **Phase 6** | `doc-processor` | LOW | Nothing | Write SKILL.md + format reference |

### Dependency Graph

```
Phase 1: ba ────────────────────────┐
Phase 4: git ──────────┐            │
Phase 6: doc-processor ┤            │
                       ▼            ▼
Phase 3: docs ─────► Phase 2: scaffold
Phase 5: mcp-builder ──┘
```

**Critical path**: ba → scaffold (these two unlock the most value)
**Parallel work**: git + doc-processor can be built alongside ba

### Wiring Changes to Existing Skills

After all 6 new skills are built, update these existing skills:

| Existing Skill | Change |
|----------------|--------|
| `cook` | Phase 1: add ba invocation for non-trivial tasks. Phase 7: delegate to git skill |
| `plan` | Step 1: if requirements.md exists, read it instead of re-gathering |
| `team` | Add scaffold as orchestration target |
| `marketing` | Add doc-processor for PDF/PPTX export |
| `launch` | Add docs update as pre-deploy step |
| `skill-router` | Add routing rules for new skills |
| `onboard` | Detect if project was scaffolded → load scaffold report as context |

### Updated Competitive Numbers

| Metric | Before | After |
|--------|--------|-------|
| Core skills | 49 | 55 |
| L1 Orchestrators | 4 | 5 (+ scaffold) |
| L2 Workflow Hubs | 23 | 26 (+ ba, docs, mcp-builder) |
| L3 Utilities | 21 | 23 (+ git, doc-processor) |
| Mesh connections | 170+ | 200+ |
| Project bootstrap | ❌ | ✅ (scaffold) |
| BA/Requirements | ❌ | ✅ (ba) |
| Auto-docs | ❌ | ✅ (docs) |
| MCP development | ❌ | ✅ (mcp-builder) |

---

## Post-Expansion: Rune vs ClaudeKit (revised)

| Dimension | ClaudeKit | Rune v2.1.0 |
|-----------|-----------|-------------|
| Skills | 108+ (inflate count) | 55 core + 12 L4 (deeper, connected) |
| Bootstrap | /bootstrap (autonomous) | /rune scaffold (BA-powered, deeper) |
| BA/Requirements | ❌ (planner only) | ✅ (dedicated BA with 5-question elicitation) |
| Docs | docs-manager (basic) | docs (init, update, api, changelog) |
| Git | git-manager | git (semantic commits, PR gen, changelog) |
| MCP | mcp-builder (basic) | mcp-builder (TS + Python, full test suite) |
| Mesh | Flat list | 200+ connections |
| Price | $99-149 | FREE |
| Platforms | Claude Code only | 5 platforms |
| Safety | Skip-permissions | HARD-GATEs |

## Next After This

After v2.1.0 ships → Rune Pro (paid packs) becomes viable because:
1. Free Rune is now competitive on EVERY dimension with ClaudeKit
2. 55 free skills prove quality → users trust Rune Pro packs
3. scaffold + ba make Rune a "full lifecycle" tool → Pro extends to business lifecycle
