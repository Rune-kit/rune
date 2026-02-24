---
name: plan
description: Create structured implementation plans from requirements. Breaks tasks into phases, identifies dependencies, and makes architecture decisions. Uses opus for deep reasoning.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L2
  model: opus
  group: creation
---

# plan

## Purpose

Create structured implementation plans from requirements. Plan is the strategic brain of the Rune ecosystem — it breaks complex tasks into phased implementation steps, identifies dependencies and risks, and makes architecture decisions. Uses opus for deep reasoning quality. Bidirectionally connected with brainstorm for creative exploration.

## Triggers

- Called by `cook` when task scope > 1 file
- Called by `team` for high-level task decomposition
- `/rune plan <task>` — manual planning
- Auto-trigger: when user says "implement", "build", "create" with complex scope

## Calls (outbound)

- `scout` (L2): scan codebase for existing patterns, conventions, and structure
- `brainstorm` (L2): when multiple valid approaches exist and creative exploration needed
- `research` (L3): external knowledge lookup for unfamiliar technologies
- `sequential-thinking` (L3): complex architecture with many trade-offs

## Called By (inbound)

- `cook` (L1): Phase 2 PLAN — create implementation plan
- `team` (L1): high-level task decomposition into parallel workstreams
- `brainstorm` (L2): when idea is selected and needs structuring into actionable plan
- `rescue` (L1): plan refactoring strategy for legacy modules
- User: `/rune plan <task>` direct invocation

## Cross-Hub Connections

- `plan` ↔ `brainstorm` — bidirectional: plan asks brainstorm for creative options, brainstorm asks plan for structure

## Workflow

1. **Understand scope** — parse requirements, identify what needs to be built
2. **Scan codebase** — call scout to understand existing patterns, conventions, tech stack
3. **Evaluate approaches** — if multiple valid approaches, call brainstorm for exploration
4. **Research** — if unfamiliar tech, call research for external knowledge
5. **Architecture decision** — choose approach, document rationale
6. **Task breakdown** — split into ordered phases with dependencies
7. **Risk assessment** — identify potential blockers and mitigation strategies
8. **Output plan** — structured implementation plan ready for cook to execute

## Output Format

```
## Implementation Plan: [Task Name]

### Architecture Decision
- **Approach**: [chosen approach]
- **Rationale**: [why this approach]
- **Alternatives considered**: [other options and why rejected]

### Dependencies
- [dependency] — [status: available | needs setup]

### Phases
1. **Phase 1: [name]** — [description]
   - Files: [paths]
   - Tests: [test paths]
   - Estimated complexity: low | medium | high

2. **Phase 2: [name]** — [description]
   ...

### Risks
- [risk] — [mitigation]

### Success Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]
```

## Cost Profile

~3000-8000 tokens input, ~1000-3000 tokens output. Opus for architectural reasoning quality. Most expensive L2 skill but runs infrequently.
