# Trade Logic Matrix

> Complete skill-to-skill delegation map for Rune's 49-skill mesh.
> Generated from all SKILL.md `Calls` / `Called By` sections + ARCHITECTURE.md cross-hub mesh.

## Legend

| Symbol | Meaning |
|--------|---------|
| `->` | Calls (outbound) |
| `<-` | Called by (inbound) |
| `<>` | Bidirectional |
| `-` | No connection |
| `*` | Conditional (only in specific phases/contexts) |

---

## Matrix 1: L1 Orchestrators -> L2 Hubs

Which L2 hubs each L1 orchestrator delegates to.

| L2 Hub | cook | team | launch | rescue |
|--------|------|------|--------|--------|
| plan | -> | -> | - | -> |
| scout | -> | -> | - | - |
| brainstorm | -> | - | - | - |
| design | ->* | - | - | - |
| skill-forge | ->* | - | - | - |
| debug | -> | - | - | - |
| fix | -> | - | - | - |
| test | -> | - | -> | - |
| review | -> | - | - | -> |
| review-intake | ->* | - | - | - |
| sentinel | -> | - | - | - |
| preflight | -> | - | - | - |
| onboard | ->* | - | - | -> |
| db | ->* | - | - | - |
| perf | ->* | - | - | - |
| logic-guardian | ->* | -> | - | - |
| incident | - | - | -> | - |
| audit | ->* | - | -> | - |
| deploy | - | - | -> | - |
| marketing | - | - | -> | - |
| autopsy | - | - | - | -> |
| safeguard | - | - | - | -> |
| surgeon | - | - | - | -> |

**Notes:**
- `cook` touches 17/22 L2 hubs (broadest reach)
- `team` only calls plan + scout directly; delegates real work to cook/launch/rescue instances
- `launch` focuses on delivery chain: test -> audit -> deploy -> marketing -> incident
- `rescue` focuses on recovery chain: autopsy -> safeguard -> surgeon

### L1 -> L1 (Meta-Orchestration)

Only `team` can call other L1s:

| Target | team |
|--------|------|
| cook | -> (parallel instances) |
| launch | -> (deployment phase) |
| rescue | -> (legacy modules) |

---

## Matrix 2: L2 <-> L2 Cross-Hub Mesh

Skill-to-skill connections between L2 hubs. Read as ROW calls COLUMN.

### Creation Group

| | plan | scout | brainstorm | design | skill-forge |
|---|---|---|---|---|---|
| **plan** | - | -> | <> | - | <- |
| **scout** | - | - | - | - | - |
| **brainstorm** | <> | - | - | - | - |
| **design** | - | -> | - | - | - |
| **skill-forge** | -> | -> | - | - | - |

### Development Group

| | debug | fix | test | review | db |
|---|---|---|---|---|---|
| **debug** | - | -> | - | - | - |
| **fix** | <> | - | -> | -> | - |
| **test** | -> | - | - | - | - |
| **review** | - | -> | -> | - | - |
| **db** | - | - | - | - | - |

### Quality Group

| | sentinel | preflight | onboard | audit | perf | review-intake | logic-guardian |
|---|---|---|---|---|---|---|---|
| **sentinel** | - | - | - | - | - | - | - |
| **preflight** | -> | - | - | - | - | - | - |
| **onboard** | - | - | - | - | - | - | - |
| **audit** | -> | - | - | - | -> | - | - |
| **perf** | - | - | - | - | - | - | - |
| **review-intake** | -> | - | - | - | - | - | - |
| **logic-guardian** | - | - | - | - | - | - | - |

### Delivery Group

| | deploy | marketing | incident |
|---|---|---|---|
| **deploy** | - | - | -> |
| **marketing** | - | - | - |
| **incident** | - | - | - |

### Rescue Group

| | autopsy | safeguard | surgeon |
|---|---|---|---|
| **autopsy** | - | - | - |
| **safeguard** | - | - | <- |
| **surgeon** | - | -> | - |

### Cross-Group Connections

These connections span across L2 groups:

| From | To | Direction | Context |
|------|-----|-----------|---------|
| plan | scout | -> | Scan before planning |
| debug | scout | -> | Find related code |
| review | scout | -> | More context needed |
| review | sentinel | -> | Security patterns in diff |
| review | design | -> | UI anti-pattern detected |
| review | perf | -> | Performance patterns in diff |
| review | review-intake | -> | External feedback received |
| review | sast | -> | Security deep analysis |
| review-intake | fix | -> | Apply verified changes |
| review-intake | test | -> | Reviewer-found edge cases |
| review-intake | sentinel | -> | Reviewer flagged security |
| deploy | test | -> | Pre-deploy verification |
| deploy | db | -> | Migration safety check |
| deploy | perf | -> | Pre-deploy perf check |
| deploy | sentinel | -> | Security gate |
| audit | scout | -> | Discovery phase |
| audit | db | -> | Database health dimension |
| audit | autopsy | -> | Complexity/health phase |
| incident | autopsy | -> | Root cause after containment |
| incident | sentinel | -> | Security dimension check |
| perf | design | -> | Accessibility BLOCK |
| design | scout | -> | Detect platform/tokens |
| marketing | scout | -> | Analyze assets |
| onboard | autopsy | -> | Codebase health scan |
| surgeon | debug | -> | Diagnose before surgery |
| surgeon | fix | -> | Apply surgical changes |
| surgeon | test | -> | Verify after surgery |
| surgeon | review | -> | Self-review complex refactor |
| safeguard | test | -> | Create safety net tests |
| test | debug | -> | Unexpected failure triage |
| logic-guardian | scout | -> | Scan project for logic files |
| fix | logic-guardian | -> | Pre-edit gate on manifested files |
| surgeon | logic-guardian | -> | Pre-refactor on logic modules |
| review | logic-guardian | -> | Check if diff removes manifested logic |

---

## Matrix 3: L1/L2 -> L3 Utility Usage

Which L3 utilities each L1/L2 skill consumes. Read as: ROW uses COLUMN.

### Validation Utilities

| Caller | verification | hallucination-guard | completion-gate | constraint-check | sast | integrity-check |
|--------|---|---|---|---|---|---|
| **cook** (L1) | x | x | x | x | x* | - |
| **team** (L1) | - | - | x | x | - | x |
| **launch** (L1) | - | - | - | - | - | - |
| **rescue** (L1) | - | - | - | - | - | - |
| fix | x | x | - | - | - | - |
| test | x | - | - | - | - | - |
| deploy | x | - | - | - | - | - |
| sentinel | x | - | - | - | x | x |
| preflight | - | x | - | - | - | - |
| review | - | x | - | - | x | - |
| review-intake | - | x | - | - | - | - |
| db | x | x | - | - | - | - |
| perf | x | - | - | - | - | - |
| safeguard | x | - | - | - | - | - |
| skill-forge | x | x | - | - | - | - |
| audit | - | - | - | x | x | - |
| logic-guardian | x | x | - | - | - | - |

### Knowledge Utilities

| Caller | research | docs-seeker | trend-scout |
|--------|----------|-------------|-------------|
| plan | x | - | - |
| brainstorm | x | - | x |
| debug | - | x | - |
| fix | - | x | - |
| review | - | x | - |
| marketing | x | - | x |
| autopsy | x | - | x |

### Reasoning Utilities

| Caller | problem-solver | sequential-thinking |
|--------|----------------|---------------------|
| plan | - | x |
| brainstorm | x | x |
| debug | x | x |

### State Utilities

| Caller | journal | session-bridge | context-engine | worktree |
|--------|---------|----------------|----------------|----------|
| **cook** (L1) | x | x | - | x* |
| **team** (L1) | - | - | - | x |
| **rescue** (L1) | - | x | - | - |
| surgeon | x | - | - | - |
| autopsy | x | - | - | - |
| deploy | x | - | - | - |
| audit | x | - | - | - |
| incident | x | - | - | - |
| skill-forge | x | - | - | - |
| logic-guardian | x | x | - | - |

### Monitoring & Media Utilities

| Caller | watchdog | scope-guard | browser-pilot | asset-creator | video-creator | dependency-doctor |
|--------|----------|-------------|---------------|---------------|---------------|-------------------|
| **launch** (L1) | x | - | x | - | x | - |
| **rescue** (L1) | - | - | - | - | - | x |
| deploy | x | - | x | - | - | - |
| incident | x | - | - | - | - | - |
| test | - | - | x | - | - | - |
| debug | - | - | x | - | - | - |
| marketing | - | - | x | x | x | - |
| perf | - | - | x | - | - | - |
| design | - | - | - | x | - | - |
| audit | - | - | - | - | - | x |

---

## Matrix 4: L3 -> L3 Exceptions

Documented L3-to-L3 coordination (exceptions to "L3 calls nothing" rule):

| From | To | Reason |
|------|-----|--------|
| hallucination-guard | research | Verify package existence on npm/pypi |
| context-engine | session-bridge | Save state before context compaction |
| session-bridge | integrity-check | Verify .rune/ file integrity before loading |

---

## Connectivity Stats

### Most Connected Skills (Total In + Out)

| Rank | Skill | Layer | Outbound | Inbound | Total | Role |
|------|-------|-------|----------|---------|-------|------|
| 1 | cook | L1 | 22 | 2 | 24 | Universal orchestrator |
| 2 | scout | L2 | 0 | 18 | 18 | Universal scanner (read-only) |
| 3 | review | L2 | 11 | 5 | 16 | Quality hub |
| 4 | deploy | L2 | 10 | 2 | 12 | Delivery orchestrator |
| 5 | verification | L3 | 0 | 9 | 9 | Build/test runner |
| 6 | audit | L2 | 9 | 3 | 12 | Health assessor |
| 7 | journal | L3 | 0 | 8 | 8 | State recorder |
| 8 | sentinel | L2 | 4 | 5 | 9 | Security gate |
| 9 | fix | L2 | 7 | 5 | 12 | Code changer |
| 10 | logic-guardian | L2 | 5 | 5 | 10 | Logic preservation gate |
| 11 | surgeon | L2 | 7 | 1 | 8 | Refactoring specialist |

### Isolated Skills (0 outbound L2 connections)

| Skill | Layer | Note |
|-------|-------|------|
| scout | L2 | Pure scanner — only uses Glob/Grep/Read |
| db | L2 | Only calls L3 utilities |
| perf | L2 | Calls L3 + design (cross-group) |
| incident | L2 | Calls L3 + autopsy/sentinel |
| marketing | L2 | Calls L3 + scout |
| onboard | L2 | Calls scout + autopsy |

### Critical Chains

```
Feature:    cook -> plan -> scout -> (codebase)
                 -> test -> fix -> verification
                 -> review -> sentinel -> sast
                 -> preflight -> sentinel
                 -> completion-gate

Launch:     launch -> test -> verification
                   -> audit -> sentinel + autopsy + perf
                   -> deploy -> watchdog
                   -> marketing -> asset-creator

Rescue:     rescue -> autopsy -> scout -> (codebase)
                   -> safeguard -> test
                   -> surgeon -> fix -> verification

Incident:   incident -> watchdog -> (health check)
                     -> autopsy -> journal
                     -> sentinel -> sast

Debug-Fix:  debug <> fix -> test -> verification
                         -> review -> sentinel
```

---

## L4 Extension Pack Routing

L4 packs are activated contextually, not via direct skill calls. They supplement L1/L2 workflows.

| Pack | Activated By | Can Call (L3) |
|------|-------------|---------------|
| @rune/ui | cook (Phase 1.5), design | scout, verification, asset-creator |
| @rune/backend | cook (Phase 1.5) | scout, verification |
| @rune/devops | cook, deploy | scout, verification |
| @rune/mobile | cook (Phase 1.5) | scout, verification |
| @rune/security | cook, sentinel, review | scout, verification, sast |
| @rune/trading | cook (Phase 1.5) | scout, verification |
| @rune/saas | cook (Phase 1.5) | scout, verification |
| @rune/ecommerce | cook (Phase 1.5) | scout, verification |
| @rune/ai-ml | cook (Phase 1.5) | scout, verification |
| @rune/gamedev | cook (Phase 1.5) | scout, verification |
| @rune/content | cook (Phase 1.5) | scout, verification |
| @rune/analytics | cook (Phase 1.5) | scout, verification |

**L4 constraints:** Cannot call L1 or L2. Cannot call other L4 packs.
