# Data Flow Map — Skill-to-Skill Data Dependencies

Version: 1.0.0 | Since: v2.9.0

## Purpose

The mesh has three communication layers:
1. **Invocation** — skill A calls skill B (`cook` → `test`, `team` → `cook`)
2. **Signals** — event-driven notifications (`emit: phase.complete` → `listen: phase.complete`)
3. **Data flow** — structured data passes from skill A's output to skill B's input via `chain_metadata.exports`

This document maps layer 3: **what data flows where**. Use it to understand which skills produce data that other skills consume, and to diagnose broken chains.

## Reading the Map

```
producer_skill --[export_key]--> consumer_skill
```

Arrow means: consumer reads `export_key` from producer's `chain_metadata.exports`.

## Core Data Flows

### Debug → Fix Chain (diagnosis → remediation)
```
debug --[root_cause]--> fix
debug --[fix_recommendation]--> fix
debug --[severity]--> fix          # fix prioritizes by severity
```

### Fix → Test Chain (code change → verification)
```
fix --[fix_applied]--> test        # test scopes to changed files
fix --[verification]--> test       # test knows what already passed
fix --[commit_hash]--> review      # review scopes to commit diff
```

### Plan → Cook Chain (design → execution)
```
plan --[plan_file]--> cook         # cook reads plan to execute
plan --[phase_count]--> cook       # cook knows total phases
plan --[risk_areas]--> cook        # cook applies extra caution
plan --[plan_file]--> adversary    # adversary stress-tests the plan
```

### Cook → Review/Test Chain (implementation → quality)
```
cook --[test_results]--> review    # review knows test coverage
cook --[quality_gates]--> sentinel # sentinel deepens on WARN areas
cook --[commit_hash]--> review     # review scopes to commit
cook --[files_changed]--> test     # test adds coverage for changed files
```

### Review → Fix Chain (findings → remediation)
```
review --[findings]--> fix         # fix applies remediations
review --[verdict]--> fix          # fix prioritizes by verdict
review --[quality_score]--> cook   # cook decides if more review needed
```

### Test → Preflight Chain (results → completeness)
```
test --[test_results]--> preflight   # preflight checks edge cases (GREEN only)
test --[test_files]--> preflight     # preflight scopes review to test files
test --[test_results]--> fix         # fix implements to pass (RED → GREEN)
```

### Sentinel → Fix Chain (security → remediation)
```
sentinel --[findings]--> fix       # fix applies security patches
sentinel --[verdict]--> cook       # cook blocks on FAIL
```

## Data Flow Diagram (Full Mesh)

```
                    ┌──────────┐
                    │   plan   │
                    └────┬─────┘
                         │ plan_file, phase_count, risk_areas
                    ┌────▼─────┐     plan_file
                    │   cook   │◄─────────────────────┐
                    └────┬─────┘                      │
                         │ commit_hash, test_results  │
              ┌──────────┼──────────┐                 │
              ▼          ▼          ▼                  │
         ┌────────┐ ┌────────┐ ┌──────────┐     ┌─────────┐
         │ review │ │  test  │ │ sentinel │     │adversary│
         └────┬───┘ └────┬───┘ └────┬─────┘     └─────────┘
              │          │          │
              │ findings │ results  │ findings
              ▼          ▼          ▼
         ┌─────────────────────────────┐
         │            fix              │
         └──────────────┬──────────────┘
                        │ fix_applied, verification
                        ▼
                   ┌────────┐
                   │  test  │  (re-verify after fix)
                   └────────┘
```

### Debug Entry Point (Bug Workflow)
```
         error/symptom
              │
         ┌────▼─────┐
         │  debug   │
         └────┬─────┘
              │ root_cause, fix_recommendation
         ┌────▼─────┐
         │   fix    │
         └────┬─────┘
              │ fix_applied
         ┌────▼─────┐
         │   test   │
         └────┬─────┘
              │ test_results (GREEN)
         ┌────▼──────┐
         │ preflight │
         └───────────┘
```

## Flywheel Loops

Data flows are NOT linear — they form loops that improve quality over time:

### Quality Flywheel
```
cook → review → fix → test → preflight → cook (next feature)
  ▲                                          │
  └──────────────────────────────────────────┘
  Each iteration: review findings inform fix → fix informs test → test coverage grows
```

### Debug Flywheel
```
debug → fix → test → (if test fails) → debug (refined hypothesis)
  ▲                                        │
  └────────────────────────────────────────┘
  Each iteration: narrower root cause, more targeted fix
```

### Plan Flywheel
```
plan → adversary → plan (revised) → cook → review → retro → plan (next feature)
  ▲                                                            │
  └────────────────────────────────────────────────────────────┘
  Each iteration: retro insights feed better plans
```

## Export Key Registry

Complete list of export keys in the mesh, with producers and consumers:

| Export Key | Type | Produced By | Consumed By |
|------------|------|-------------|-------------|
| `root_cause` | `{ file, line, explanation }` | debug | fix |
| `fix_recommendation` | `string` | debug | fix |
| `severity` | `string` | debug | fix |
| `fix_applied` | `{ files, description }` | fix | test, review |
| `verification` | `{ lint, types, tests }` | fix, cook | test, review |
| `commit_hash` | `string` | cook, fix | review |
| `test_results` | `{ passed, failed, coverage }` | test, cook | review, preflight, fix |
| `test_files` | `string[]` | test | preflight |
| `findings` | `[{ severity, file, line, message }]` | review, sentinel, preflight | fix |
| `findings_count` | `{ critical, high, medium, low }` | review, sentinel | cook, fix |
| `verdict` | `string` | review, sentinel | cook, fix |
| `quality_score` | `number (0-100)` | review | cook |
| `quality_gates` | `{ preflight, sentinel, review }` | cook | sentinel, review |
| `plan_file` | `string (path)` | plan | cook, adversary |
| `phase_count` | `number` | plan, cook | cook |
| `risk_areas` | `string[]` | plan | cook |
| `concerns` | `string[]` | cook | review |
| `coverage_delta` | `{ before, after }` | test, cook | review |

## Maintaining This Map

When adding chain_metadata to a new skill:
1. Define exports in the skill's `## Chain Metadata` section
2. Add the skill's data flows to this map
3. Update the Export Key Registry table
4. Verify no circular data dependencies (invocation cycles are OK, data cycles are not)
