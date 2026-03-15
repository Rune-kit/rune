# VoltAgent/awesome-claude-code-subagents Analysis

> Reference document. Not part of Rune's public docs.
> Date: 2026-03-11 | Source: https://github.com/VoltAgent/awesome-claude-code-subagents

---

## Overview

- **Stars**: 13,285 | **Forks**: 1,453
- **Total agents**: 131 (.md files) across 10 categories
- **License**: MIT
- **Format**: Claude Code native subagent .md with YAML frontmatter
- **Distribution**: Plugin marketplace, manual install, installer script, meta agent-installer

## Agent File Structure

```yaml
---
name: kebab-case-name
description: "When to invoke this agent"
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet | opus | haiku | inherit
---

You are a senior [role] with expertise in [domains]...

When invoked:
1. Query context manager for [X]
2. Review [Y]
3. Analyze [Z]
4. Implement [W]

## Communication Protocol
### [Context] Assessment
JSON-formatted context request

## Development Workflow
### 1. Analysis Phase
### 2. Implementation Phase (with JSON progress tracking)
### 3. Excellence Phase (delivery notification)

Integration with other agents:
- Collaborate with X on Y
```

### Key Fields

| Field | Purpose | Values |
|-------|---------|--------|
| `name` | Agent identifier | kebab-case |
| `description` | Auto-invocation trigger | Natural language |
| `tools` | Permission scope | Comma-separated Claude Code tools |
| `model` | Model routing | opus, sonnet, haiku, inherit |

### Tool Assignment Philosophy

| Role Type | Tools | Mode |
|-----------|-------|------|
| Read-only (reviewers, auditors) | Read, Grep, Glob | Read-only |
| Research (analysts) | Read, Grep, Glob, WebFetch, WebSearch | Read-only |
| Code writers (developers) | Read, Write, Edit, Bash, Glob, Grep | Read-write |
| Documentation | Read, Write, Edit, Glob, Grep, WebFetch, WebSearch | Read-write |

### Model Distribution

| Model | Usage | ~% |
|-------|-------|-----|
| sonnet | Everyday coding, debugging, refactoring | 70% |
| opus | Deep reasoning, architecture, security, finance | 20% |
| haiku | Quick tasks, docs, search, dependency checks | 10% |

---

## Full Agent Inventory (131 agents)

### 01: Core Development (10)
api-designer, backend-developer, electron-pro, frontend-developer, fullstack-developer, graphql-architect, microservices-architect (opus), mobile-developer, ui-designer, websocket-engineer

### 02: Language Specialists (26)
angular-architect, cpp-pro, csharp-developer, django-developer, dotnet-core-expert, dotnet-framework-4.8-expert, elixir-expert, flutter-expert, golang-pro, java-architect (opus), javascript-pro, kotlin-specialist, laravel-specialist, nextjs-developer, php-pro, powershell-5.1-expert, powershell-7-expert, python-pro, rails-expert, react-specialist, rust-engineer, spring-boot-engineer, sql-pro, swift-expert, typescript-pro, vue-expert

### 03: Infrastructure (16)
azure-infra-engineer, cloud-architect (opus), database-administrator, deployment-engineer, devops-engineer, devops-incident-responder, docker-expert, incident-responder, kubernetes-specialist, network-engineer, platform-engineer, security-engineer (opus), sre-engineer, terraform-engineer, terragrunt-expert, windows-infra-admin

### 04: Quality & Security (14)
accessibility-tester, ad-security-reviewer (opus), architect-reviewer (opus), chaos-engineer, code-reviewer (opus), compliance-auditor (opus), debugger, error-detective, penetration-tester (opus), performance-engineer, powershell-security-hardening, qa-expert, security-auditor (opus), test-automator

### 05: Data & AI (12)
ai-engineer (opus), data-analyst, data-engineer, data-scientist, database-optimizer, llm-architect (opus), machine-learning-engineer, ml-engineer, mlops-engineer, nlp-engineer, postgres-pro, prompt-engineer

### 06: Developer Experience (13)
build-engineer (haiku), cli-developer, dependency-manager (haiku), documentation-engineer (haiku), dx-optimizer, git-workflow-manager, legacy-modernizer, mcp-developer, powershell-module-architect, powershell-ui-architect, refactoring-specialist, slack-expert, tooling-engineer

### 07: Specialized Domains (12)
api-documenter (haiku), blockchain-developer, embedded-systems, fintech-engineer (opus), game-developer, iot-engineer, m365-admin, mobile-app-developer, payment-integration, quant-analyst (opus), risk-manager, seo-specialist (haiku)

### 08: Business & Product (11)
business-analyst, content-marketer (haiku), customer-success-manager (haiku), legal-advisor, product-manager (haiku), project-manager (haiku), sales-engineer (haiku), scrum-master (haiku), technical-writer (haiku), ux-researcher, wordpress-master

### 09: Meta & Orchestration (10)
agent-installer (haiku), agent-organizer, context-manager, error-coordinator, it-ops-orchestrator, knowledge-synthesizer, multi-agent-coordinator (opus), performance-monitor, task-distributor, workflow-orchestrator

### 10: Research & Analysis (7)
competitive-analyst (haiku), data-researcher (haiku), market-researcher (haiku), research-analyst (haiku), scientific-literature-researcher (haiku), search-specialist (haiku), trend-analyst (haiku)

---

## Quality Assessment

### Strengths
- Clean, consistent template across all 131 agents
- Tool permission separation (read-only vs write)
- Model routing per agent (haiku/sonnet/opus/inherit)
- Good distribution UX (installer, catalog search)
- Broad domain coverage

### Weaknesses
- **No decision logic** — agents are topic outlines, not workflows
- **No inter-agent connections** — "Collaborate with X" is passive suggestion, not enforced
- **Zero personality** — all agents use identical template/voice
- **Duplicate agents** — ml-engineer vs machine-learning-engineer, mobile-developer vs mobile-app-developer
- **Fake example metrics** in templates (234K messages/min, $4.2M revenue)
- **No context management infrastructure** — relies on native Claude Code only
- **No escalation chains** — if agent fails, no fallback routing
- **Claude Code only** — no multi-platform

---

## Rune vs VoltAgent

| Dimension | VoltAgent (131) | Rune (55 + 72 in L4 = ~127) |
|-----------|----------------|------------------------------|
| Architecture | Flat catalog, 10 categories | 5-layer mesh, enforced delegation |
| Inter-agent connections | Passive suggestions | 200+ enforced + trade matrix |
| Routing | Per-agent model field | L0 skill-router + adaptive overrides |
| Decision logic | None (topic outlines) | Phase-aware, escalation chains, gates |
| Context management | Native Claude Code only | context-engine, session-bridge, worktree |
| Metrics | None | H3 metrics-collector, analytics |
| Language coverage | 26 language agents | 0 (language-agnostic by design) |
| Infrastructure depth | 16 agents | @rune/devops (6 skills) |
| Business coverage | 11 agents | ba + marketing + @rune-pro/product |
| Distribution | Plugin + installer | Plugin + 5-platform compiler |
| Multi-platform | Claude Code only | Claude Code, Cursor, Windsurf, Antigravity, Generic |
| Quality per agent | Shallow (checklists) | Deep (decision trees, escalations) |

---

## Gaps to Fill in Rune

### High Value (should adopt)

| What | From VoltAgent | Rune Action |
|------|---------------|-------------|
| Tool permission field | `tools:` in frontmatter | Add to SKILL.md format |
| Model inherit option | `model: inherit` | Add to skill-router |
| Agent catalog commands | /subagent-catalog:search/list | `/rune agents list/search` |
| Chaos/resilience testing | chaos-engineer | Add to @rune/devops |
| Quant finance | quant-analyst (opus) | Add to @rune/trading |
| Compliance auditing | compliance-auditor (opus) | @rune-pro/legal pack |

### Medium Value (consider)

| What | From VoltAgent | Rune Action |
|------|---------------|-------------|
| LLM architecture | llm-architect, prompt-engineer | Enrich @rune/ai-ml |
| Legal/contracts | legal-advisor | @rune-pro/legal pack |
| DX optimization | dx-optimizer | Could enhance onboard or audit |
| Self-installer | agent-installer meta-agent | Nice DX for community packs |

### Skip (not worth copying)

| What | Why Skip |
|------|----------|
| 26 language specialists | Claude knows languages natively — marginal value, major bloat |
| Duplicate agents | Quality issue — ml-engineer vs machine-learning-engineer |
| Shallow checklist format | Rune's gate-driven approach is fundamentally better |
| Fake progress metrics | Misleading, adds no real value |

---

## Subagent Benefits (confirmed by analysis)

1. **Context isolation** — each agent runs in own context window, main agent stays small
2. **Tool permissions** — read-only agents (scanner, reviewer) can't accidentally write files
3. **Model routing** — haiku for search ($0.001), sonnet for code ($0.01), opus for architecture ($0.05)
4. **Specialization** — focused instructions = better output than "do everything" agents
5. **Parallel execution** — independent agents can run simultaneously
6. **Token efficiency** — load 1 agent file (~50 lines) vs entire skill mesh (~15,000 lines)
