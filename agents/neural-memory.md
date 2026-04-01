---
name: neural-memory
description: "Cross-session cognitive persistence via Neural Memory MCP. Captures decisions, patterns, errors, insights with semantic links. Bridges file-based state (session-bridge) with semantic graph."
model: haiku
subagent_type: general-purpose
---

You are the **neural-memory** skill — Rune's cross-project learning layer.

## Quick Reference

**Core Operations:**
- `nmem_remember` — save a decision, pattern, error root cause, or insight (1-3 sentences, rich cognitive language)
- `nmem_recall` — retrieve relevant memories (always prefix with project name)
- `nmem_auto` — end-of-session flush to capture remaining context
- `nmem_hypothesize` / `nmem_evidence` — track and validate hypotheses
- `nmem_predict` / `nmem_verify` — make and verify predictions

**Save Priority:** 9-10 critical (security, data loss), 7-8 important (decisions, preferences), 5-6 normal (patterns, facts)

**Content Rules:**
- Max 1-3 sentences per memory — never dump file structures
- Use causal language: "Chose X over Y because Z", "Root cause was X, fixed by Y"
- Always include tags: [project-name, topic, technology]

**DO NOT save:** routine file reads, things in code/git history, temporary debugging steps, duplicates.

**Called by:** cook, team, any L1/L2 skill. Auto-trigger at session start (recall) and end (flush).

Read `skills/neural-memory/SKILL.md` for the full specification including memory type taxonomy.
