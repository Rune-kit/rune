# Cross-IDE Compatibility Analysis

Can Rune work outside Claude Code? This document provides an honest technical assessment.

> **Last updated**: 2026-03-04. IDE capabilities evolve rapidly — verify claims against current release notes.

## TL;DR

Rune's **knowledge** is portable (copy the markdown). Rune's **intelligence** requires runtime features that vary by IDE. Claude Code remains the only platform where 100% of Rune works, but the gap is narrowing as Cursor and Windsurf add plugin ecosystems.

## What's Portable

The majority of Rune's value lives in pure instructional markdown — no code, no APIs.

| Component | Portability | Notes |
|-----------|-------------|-------|
| 48 SKILL.md files | 100% | Pure instructions — any LLM can follow them |
| 12 PACK.md extension packs | 100% | Domain patterns and constraints, no code |
| 5-layer mesh architecture | 100% | Conceptual model, not API-dependent |
| Workflow designs (cook 8 phases, rescue 5 phases) | 100% | Process descriptions, not implementations |
| Routing decision trees | 100% | Markdown tables and if/then logic |
| HARD-GATE constraint format | 100% | XML tags that any LLM respects |

## What's Claude Code-Specific

A small but critical layer of infrastructure depends on Claude Code's runtime.

| Component | Why Specific | What It Does |
|-----------|-------------|--------------|
| `.claude-plugin/plugin.json` | Claude Code manifest format | Registers Rune as a plugin |
| `agents/*.md` wrappers | `subagent_type` is Claude Code API | Spawns specialized sub-agents with model selection |
| `hooks/*.js` (8 hooks) | Hook lifecycle (PreToolUse, PostToolUse, SessionStart) | H3 intelligence: metrics, context-watch, auto-format |
| `Skill` tool invocation | Claude Code built-in tool | Loads and executes SKILL.md files by name |
| MCP integration | MCP protocol | Neural Memory, context7, Playwright |
| `EnterWorktree` | Claude Code built-in tool | Parallel agent isolation via git worktrees |
| Task/Agent spawning | Claude Code's orchestration | Parallel quality gates, team decomposition |

## Per-IDE Assessment

### Cursor (v2.5+, Feb 2026)

Cursor has evolved significantly. v2.5 introduced a plugin marketplace with skills, subagents, hooks, and MCP support.

**What works:**
- MCP support (since v1.6, Sep 2025) — Neural Memory, context7 can connect
- Subagents (since v2.4) — parallel agent execution possible
- Hooks (since v2.5) — observe and control agent behavior
- Skills marketplace — can load domain-specific prompts
- `.cursorrules` can incorporate SKILL.md content

**What doesn't (as of writing):**
- Plugin manifest format differs — `.claude-plugin/plugin.json` won't load natively
- `subagent_type` API differs — Rune's agent wrappers need adaptation
- Per-agent model selection (haiku for scan, opus for architecture) — unclear if Cursor subagents support this
- Rune's `Skill` tool (load SKILL.md by name and execute as sub-task) — no direct equivalent; Cursor skills are discovered, not invoked programmatically by other skills
- Mesh routing (skill A calling skill B calling skill C) — Cursor skills are flat, not interconnected

**Verdict:** Cursor v2.5 closes much of the gap. Individual skills and some orchestration work (~55-65% of value). The mesh interconnections — where Rune's real differentiation lies — still don't port because Cursor's skill model is flat (marketplace discovery) rather than mesh (skills invoking skills).

**Porting effort:** Medium. Rewrite plugin manifest + agent wrappers. The 49 SKILL.md instructions transfer directly. Hook logic needs adaptation to Cursor's hook API. Mesh routing would need a custom orchestrator skill.

### Windsurf (Antigravity, Wave 13+)

Windsurf Wave 13 added parallel agents with git worktree isolation and DAG-based orchestration.

**What works:**
- "Cascade" multi-step agent follows cook-style phased workflows
- Parallel agents with worktree isolation (since Wave 13)
- Windsurf rules can incorporate domain patterns
- MCP support available

**What doesn't (as of writing):**
- No public plugin/extension API for third-party skill meshes
- Hook/event system not exposed for external metrics collection
- No documented way to dynamically load skills by name
- Skill-to-skill invocation (mesh routing) not supported

**Verdict:** Windsurf's parallel agent support is strong, but the lack of a plugin API means Rune can't be installed as a package. Individual skills work as rules (~45% of value). Orchestration partially works through Cascade's native multi-step flow.

### OpenClaw / Claude Code Forks

**What works:**
- If the fork maintains Claude Code's plugin system → **100% compatible**
- Same Skill tool, same agent spawning, same hooks = Rune works identically

**What doesn't:**
- If the fork strips the plugin system → falls back to individual skill level (~50%)
- If the fork changes the agent API → agent wrappers need rewriting

**Verdict:** Depends entirely on plugin API compatibility with Claude Code. Full forks = full compatibility.

### VS Code + Continue / Aider / Other

**What works:**
- SKILL.md files as reference documentation for any AI assistant
- Workflow designs as manual checklists
- PACK.md patterns as domain knowledge
- MCP support in some tools (Continue has MCP)

**What doesn't:**
- No automated multi-skill orchestration — human must manually invoke each skill's steps
- No parallel execution, no quality gates, no adaptive routing

**Verdict:** Reference material only (~20-25% of value).

### Other IDEs (Brief)

| IDE | Notes |
|-----|-------|
| **JetBrains (Junie)** | Agentic mode with context-aware agents. No plugin API for skill meshes. SKILL.md content works as prompts. ~25% of value. |
| **GitHub Copilot (agent mode)** | Multi-step coding tasks. No plugin/extension system for custom skills. ~20% of value. |
| **Zed** | MCP support, fast adoption. No agent orchestration layer yet. ~20% of value. |

## Why Rune Requires Claude Code

Five capabilities that Rune's mesh architecture depends on:

### 1. Agent Spawning with Model Selection
Rune's mesh spawns specialized sub-agents with different models. `team` launches 3 parallel `cook` instances on sonnet, while `plan` runs on opus. Per-agent model routing is critical for cost optimization (~$0.05-0.15/feature vs ~$0.60 all-opus).

### 2. Hook Lifecycle
H3 intelligence relies on hooks:
- `metrics-collector` (PreToolUse) → captures every skill invocation
- `context-watch` (PostToolUse) → monitors context window usage
- `post-session-reflect` (Stop) → flushes metrics to `.rune/metrics/`
Cursor v2.5 has hooks, but the API surface and lifecycle events may differ.

### 3. Skill Tool (Mesh Routing)
The `Skill` tool dynamically loads and executes SKILL.md files by name. This enables:
- `skill-router` dispatching to the correct skill
- `cook` invoking `scout`, `plan`, `test`, `fix` in sequence
- Any skill calling any other skill (170+ connections)
This is the core differentiator. Other IDEs have skills/rules, but they're flat — not interconnected. Rune's mesh needs skills that invoke other skills.

### 4. MCP Ecosystem
Rune integrates with MCP servers for:
- Cross-session memory (Neural Memory)
- Documentation lookup (context7)
- Browser automation (Playwright)
MCP is increasingly supported (Cursor, Windsurf, Zed, Continue), but integration depth varies. Rune's hook-driven memory flush (post-session-reflect → metrics) requires both MCP and hooks working together.

### 5. Worktree Isolation
`team` skill's parallel agents each get an isolated git worktree via `EnterWorktree`. Windsurf Wave 13 now also supports this, but Claude Code's implementation is tightly integrated with the agent spawning system.

## Portability Score by IDE

| IDE | Skills (instructions) | Mesh (orchestration) | Intelligence (H3) | Overall |
|-----|----------------------|---------------------|-------------------|---------|
| **Claude Code** | 100% | 100% | 100% | **100%** |
| **OpenClaw (full fork)** | 100% | 100% | 100% | **100%** |
| **Cursor 2.5+** | 90% | 30% | 20% | **~55%** |
| **Windsurf Wave 13+** | 80% | 25% | 10% | **~45%** |
| **JetBrains Junie** | 70% | 0% | 0% | **~25%** |
| **VS Code + AI** | 60% | 0% | 0% | **~20%** |

## The Honest Answer

The IDE landscape is evolving fast. Cursor v2.5's plugin marketplace and Windsurf's parallel agents have closed significant gaps since Rune was first built. The remaining differentiator is **mesh routing** — skills that invoke other skills, forming resilient interconnected workflows rather than flat prompt collections.

If you're on Cursor or Windsurf, you can use Rune's SKILL.md files as high-quality rules/prompts. You'll get the individual skill instructions (which are genuinely valuable) but not the orchestration (cook calling scout calling plan calling brainstorm).

The decision to build on Claude Code is architectural: Rune's 170+ mesh connections require a runtime where skills can programmatically invoke other skills. Today, Claude Code's `Skill` tool is the only mechanism that supports this. If Cursor or Windsurf add programmatic skill-to-skill invocation, porting becomes viable.

The knowledge is always free — copy the SKILL.md files.
