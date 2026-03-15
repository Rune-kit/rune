# Mesh Rules

Cross-cutting behavioral rules for all Rune skills. These are non-negotiable.

## Layer Discipline

1. L3 utilities MUST NOT call L1 or L2 skills (except documented L3→L3 coordination)
2. L1 orchestrators MUST use TodoWrite to track phase progress
3. Only ONE L1 orchestrator active at a time (except `team` meta-orchestration)

## Quality Gates

4. Any skill finding a CRITICAL security issue MUST halt and report — never continue
5. Code-producing skills MUST run verification before declaring completion
6. No skill may declare "no issues found" without listing what was specifically checked

## Mesh Integrity

7. Max 3 parallel L2 sub-agents from any single skill
8. Max 5 parallel L3 sub-agents (haiku) from any single skill
9. Max chain depth: 8. If reached → escalate to L1 orchestrator
10. No self-calls. Max 2 visits to same skill per chain

## Agentic Security

11. Skills that load persisted state (.rune/ files) MUST verify integrity before use
12. Multi-agent outputs MUST be validated by integrity-check before merge
13. .rune/ files modified by external contributors MUST be flagged for review

## Rationalization Blockers

14. "This is too simple to need X" — every task follows its skill's gates. No exceptions.
15. "I already know the codebase" — knowledge claims require evidence (file reads, grep results)
16. "I'll do it after" — if the gate says BEFORE, it means BEFORE. Not after. Not later.
