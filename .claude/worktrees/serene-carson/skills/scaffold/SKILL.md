---
name: scaffold
description: Autonomous project bootstrapper. Generates complete project from a description — structure, code, tests, docs, config. Orchestrates ba → plan → design → fix → test → docs → git in one pipeline. The "0 to production-ready" skill.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L1
  model: sonnet
  group: orchestrator
  tools: "Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch"
---

# scaffold

## Purpose

The "zero to production-ready" orchestrator. Takes a project description and autonomously generates a complete, working project — directory structure, code, tests, documentation, git setup, and verification. Orchestrates 8+ skills in sequence to produce output that builds, passes tests, and is ready for development.

<HARD-GATE>
Generated projects MUST build and pass tests. A scaffold that produces broken code is WORSE than no scaffold. Phase 9 (VERIFY) is mandatory — if verification fails, fix before presenting to user.
</HARD-GATE>

## Triggers

- `/rune scaffold <description>` — Interactive mode (asks questions)
- `/rune scaffold express <detailed-description>` — Express mode (autonomous)
- Called by `team` when task is greenfield project creation
- Auto-trigger: when user says "new project", "start from scratch", "bootstrap", "create a new [app/api/lib]"

## Calls (outbound)

- `ba` (L2): Phase 1 — requirement elicitation (always, even in Express mode)
- `research` (L3): Phase 2 — best practices, starter templates, library comparison
- `plan` (L2): Phase 3 — architecture and implementation plan
- `design` (L2): Phase 4 — design system (frontend projects only)
- `fix` (L2): Phase 5 — code generation (implements the plan)
- `team` (L1): Phase 5 — parallel implementation when 3+ independent modules
- `test` (L2): Phase 6 — test suite generation
- `docs` (L2): Phase 7 — README, API docs, architecture doc
- `git` (L3): Phase 8 — initial commit with semantic message
- `verification` (L3): Phase 9 — lint + types + tests + build
- `sentinel` (L2): Phase 9 — security scan on generated code

## Called By (inbound)

- User: `/rune scaffold` direct invocation
- `team` (L1): when decomposed task is a new project
- `cook` (L1): when task is classified as greenfield (rare — cook usually handles features, not projects)

## Modes

### Interactive Mode (default)

Full phase-gate workflow. User reviews and approves at each major phase:
1. BA asks 5 questions → user answers
2. Plan presented → user approves
3. Design system presented → user approves (if frontend)
4. Implementation proceeds
5. Results presented with full report

### Express Mode

Autonomous mode for detailed descriptions. User provides enough context upfront:
1. BA extracts requirements from description (no questions asked)
2. Plan auto-approved (user gave enough detail)
3. Implementation proceeds autonomously
4. User reviews only the final output

<HARD-GATE>
Express mode MUST still validate. Auto-approve doesn't mean skip quality checks.
BA still extracts requirements — it just doesn't ask questions.
Verification (Phase 9) is NEVER skipped in any mode.
</HARD-GATE>

## Project Templates

Auto-detected from BA output. Template selection informs Phase 3 (Plan) architecture decisions.

| Template | Stack | Key Generation Targets |
|----------|-------|----------------------|
| REST API | Node.js/Python + DB + Auth | Routes, models, middleware, migrations, Docker, CI |
| Web App (Full-stack) | Next.js/SvelteKit + DB | Pages, components, API routes, auth, DB setup |
| CLI Tool | Node.js/Python/Rust | Commands, arg parsing, config, tests |
| Library/Package | TypeScript/Python | Src, tests, build config, npm/pypi publish setup |
| MCP Server | TypeScript/Python | Tools, resources, handlers, tests (delegates to mcp-builder) |
| Chrome Extension | React/Vanilla | Manifest, popup, content script, background, tests |
| Mobile App | React Native/Expo | Screens, navigation, auth, API client |

## Executable Steps

### Phase 1 — BA (Requirement Elicitation)

Invoke `rune:ba` with the user's project description.

**Interactive Mode**: BA asks 5 questions, discovers hidden requirements, produces Requirements Document.

**Express Mode**: BA extracts requirements from the detailed description without asking questions. Still produces Requirements Document with scope, user stories, and acceptance criteria.

Output: `.rune/features/<project-name>/requirements.md`

Gate: In Interactive mode, user must approve requirements before proceeding.

### Phase 2 — RESEARCH (Best Practices & Templates)

Invoke `rune:research` to find:
- Best practices for the detected project type
- Recommended libraries (compare 2-3 options for each concern)
- Starter templates or skeleton projects to reference
- Common pitfalls for this stack

Do NOT clone templates blindly. Use them as REFERENCE for architecture decisions in Phase 3.

### Phase 3 — PLAN (Architecture & Implementation)

Invoke `rune:plan` with the Requirements Document from Phase 1 and research from Phase 2.

Plan must include:
- Directory structure (exact paths)
- File list with purpose of each file
- Implementation order (dependency-aware)
- Technology choices with rationale
- Test strategy (what to test, coverage target)

Gate: In Interactive mode, user must approve plan before proceeding.

### Phase 4 — DESIGN (Design System — Frontend Only)

If project has frontend (Web App, Mobile App, Chrome Extension):
- Invoke `rune:design` to generate design system
- Output: `.rune/design-system.md` with tokens, components, patterns

If backend-only or CLI → skip this phase.

### Phase 5 — IMPLEMENT (Code Generation)

Execute the plan from Phase 3. For each planned file:

1. Create directory structure first
2. Generate shared types/interfaces
3. Generate core modules (models, services, utilities)
4. Generate API layer (routes, controllers, handlers)
5. Generate UI layer (pages, components) if applicable
6. Generate configuration (env, docker, CI)

**Parallelization**: If plan has 3+ independent modules → invoke `rune:team` to implement in parallel using worktrees.

**Quality during generation**:
- Follow project conventions from research
- Include proper error handling
- Use environment variables for config (never hardcode)
- Add TypeScript strict types / Python type hints
- Follow file size limits (< 500 LOC per file)

### Phase 6 — TEST (Test Suite Generation)

Invoke `rune:test` to generate tests based on acceptance criteria from Phase 1:

- Unit tests for each module/function
- Integration tests for API endpoints
- E2E test template for critical flows
- Target: 80%+ coverage on generated code

Each acceptance criterion from BA → at least one test case.

### Phase 7 — DOCS (Documentation)

Invoke `rune:docs init` to generate:

- `README.md` — Quick Start, Features, Tech Stack, Commands
- `ARCHITECTURE.md` — if project has 10+ files
- `docs/API.md` — if project has API endpoints
- `.env.example` — all required environment variables with descriptions

### Phase 8 — GIT (Initial Commit)

Invoke `rune:git commit` to create initial commit:

- Stage all generated files (except .env, node_modules, __pycache__)
- Commit message: `feat: scaffold <project-name> with <template> template`
- Set up `.gitignore` appropriate for the stack

### Phase 9 — VERIFY (Quality Gate)

Invoke `rune:verification` to run ALL checks:

1. **Lint**: ESLint/Ruff/Clippy — zero errors
2. **Types**: tsc --noEmit / mypy — zero errors
3. **Tests**: npm test / pytest — all pass
4. **Build**: npm run build / python -m build — succeeds
5. **Security**: `rune:sentinel` quick scan — no critical issues

<HARD-GATE>
If ANY check fails → fix the issue (invoke rune:fix) and re-verify.
Do NOT present broken scaffold to user.
Max 3 fix-verify loops. If still failing after 3 → report failures to user with context.
</HARD-GATE>

## Output Format

```
## Scaffold Report: [Project Name]
- **Template**: [detected template]
- **Stack**: [framework, language, DB, etc.]
- **Files Generated**: [count]
- **Test Coverage**: [percentage]
- **Phases**: BA → Research → Plan → Design? → Implement → Test → Docs → Git → Verify
- **Verification**: ✅ All checks passed / ⚠️ [issues]

### Generated Structure
[file tree — max 30 lines, group similar files]

### What's Included
- [feature list with key implementation details]

### What's NOT Included (Next Steps)
- [out-of-scope items from BA — things user should build next]

### Commands
- `[start command]` — start development server
- `[test command]` — run tests
- `[build command]` — production build
- `[lint command]` — check code quality
```

## Error Recovery

| Phase | Failure | Recovery |
|-------|---------|----------|
| Phase 1 (BA) | User refuses to answer questions | Extract what you can, flag assumptions prominently |
| Phase 2 (Research) | No good references found | Use built-in knowledge, flag as "no external reference" |
| Phase 3 (Plan) | Plan too complex (10+ phases) | Split into MVP (Phase 1) + Future (Phase 2) |
| Phase 5 (Implement) | Code generation errors | Invoke fix → retry, max 3 attempts per file |
| Phase 6 (Test) | Tests fail on generated code | Fix code (not tests) → re-run, max 3 loops |
| Phase 9 (Verify) | Lint/type/build errors | Fix → re-verify, max 3 loops |
| Phase 9 (Verify) | Still failing after 3 loops | Report to user with specific failures |

## Constraints

1. MUST run BA (Phase 1) before generating any code — even in Express mode
2. MUST generate tests — no project without test suite is "production-ready"
3. MUST generate docs — README at minimum, API docs if applicable
4. MUST pass verification — generated project must build and pass lint/types/tests
5. MUST NOT use `--dangerously-skip-permissions` or `--no-verify` — quality gates are mandatory
6. MUST NOT generate hardcoded secrets — use .env.example with placeholder values
7. Express mode MUST still extract and validate requirements — auto-approve ≠ skip analysis
8. MUST generate .gitignore appropriate for the stack
9. MUST respect user's existing project if scaffolding into non-empty directory — warn and ask before overwriting
10. Generated files MUST be < 500 LOC each — split large files

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Generating code without BA → wrong features | CRITICAL | Constraint 1: BA is Phase 1, always runs |
| Scaffold passes locally but fails on fresh clone | HIGH | Phase 9 catches this — verify build from clean state |
| Overwriting existing files in non-empty directory | HIGH | Constraint 9: detect existing files, warn user |
| Express mode skipping quality checks | HIGH | HARD-GATE: Express mode still validates everything |
| Template mismatch (CLI template for web app) | MEDIUM | Template auto-detected from BA output, confirmed with user |
| Generated tests are trivial (only smoke tests) | MEDIUM | Phase 6: tests derived from acceptance criteria, not generic |
| Missing .gitignore → committing node_modules | MEDIUM | Constraint 8: generate stack-appropriate .gitignore |

## Done When

- Requirements gathered (BA complete, Requirements Document produced)
- Architecture planned (directory structure, tech choices, implementation order)
- Design system generated (if frontend project)
- All code generated (following plan, < 500 LOC per file)
- Test suite generated (80%+ coverage target, acceptance criteria covered)
- Documentation generated (README + ARCHITECTURE + API docs as applicable)
- Initial git commit created
- All verification checks passed (lint + types + tests + build + security)
- Scaffold Report presented to user

## Cost Profile

~10000-20000 tokens total (across all sub-skill invocations). Sonnet for orchestration — sub-skills use their own model selection (ba uses opus, git uses haiku, etc.). Most expensive L1 skill due to 9-phase pipeline, but runs rarely (project creation is infrequent).
