# Feature: Enforcement Upgrade — Antigravity-Level IDE Compliance

## Overview
Upgrade Rune's skill system to enforce IDE-level overrides — AI assistants MUST use Rune skills for ALL tasks, not optionally. Inspired by Antigravity Kit's GEMINI.md enforcement patterns, but architecturally superior via distributed compiler injection + mesh-native design.

## Research Sources
- Antigravity Kit (5.9k stars) — GEMINI.md, intelligent-routing, behavioral-modes, orchestrator
- Claude Code Agent SDK — subagent isolation, frontmatter schema, worktree support
- Rune gap analysis — `docs/ANTIGRAVITY-GAP-ANALYSIS.md`

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | skill-router Enforcement | ✅ Done | plan-enforcement-upgrade-phase1.md | Request classifier, file ownership, self-check |
| 2 | brainstorm + cook Hardening | ✅ Done | plan-enforcement-upgrade-phase2.md | Dynamic questioning, clarification gate, phase transitions |
| 3 | Compiler Compliance Transform | ✅ Done | plan-enforcement-upgrade-phase3.md | Distributed enforcement preamble via compiler |

## Key Decisions
- **Distributed enforcement > centralized GEMINI.md** — inject compliance into every skill file via compiler, no single point of failure
- **5-type classifier, not 6** — CODE_CHANGE/QUESTION/DEBUG/REVIEW/EXPLORE (simpler than AG's 6-type)
- **File ownership as overlay on routing table** — NOT a separate system like AG
- **2-question lightweight gate** in cook (not AG's 3 mandatory questions) — deep elicitation stays in `rune:ba`
- **No app templates** — out of scope, scaffold skill handles this differently
- **No auto-preview** — not a Rune concern (dev server management is project-specific)
- **Routing proof line** — user-visible accountability in every code response

## What NOT to Do (Anti-Patterns from Antigravity)
1. Don't repeat checklist 3-4x in different files — compiler handles distribution
2. Don't force 3 mandatory questions for EVERY task — kills productivity on simple fixes
3. Don't create file-type ownership as a SEPARATE system — embed in skill-router
4. Don't over-classify request types (6+ categories = decision paralysis)
5. Don't make enforcement Claude-Code-only — must compile cross-platform

## Success Criteria
- [ ] Every skill file (when compiled) includes compliance preamble
- [ ] skill-router has request classifier + file ownership + self-check
- [ ] brainstorm has problem restatement requirement
- [ ] cook has clarification gate + phase transition protocol
- [ ] Compiler builds successfully for all platforms
- [ ] No existing tests/builds broken
