# cook — Analysis paralysis guard

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Analysis Paralysis Guard

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

### Observation/Effect Ratio Tracking

Track every tool call during Phase 4 (IMPLEMENT) as either **observation** (read-only) or **effect** (modifies state):

| Category | Tool Examples |
|----------|--------------|
| **Observation** | Read, Grep, Glob, Bash(grep/ls/cat/git log) |
| **Effect** | Write, Edit, Bash(npm/build/test/mkdir) |

**Detection rules** (check every 8 tool calls during Phase 4):

| Pattern | Threshold | Signal | Action |
|---------|-----------|--------|--------|
| **Observation chain** | 6+ consecutive observation tools with zero effects | Agent is stuck reading, not building | Inject: "OBSERVATION LOOP — 6 reads without writing. Act on what you know or report BLOCKED." |
| **Low effect ratio** | In last 10 calls, effects < 15% | Agent is in analysis mode, not implementation | Inject: "Effect ratio below 15%. Phase 4 is IMPLEMENT — write code, don't just read it." |
| **Diminishing returns** | Last 3 observations found <2 new relevant facts combined | Searching is no longer productive | Inject: "Diminishing returns — last 3 reads added nothing new. Synthesize and act." |
| **Repeating sequences** | A-B-A-B or A-B-C-A-B-C pattern across 6+ calls | Circular behavior | Inject: "REPEATING SEQUENCE detected. Break the cycle — try a different approach or report BLOCKED." |

**Important**: These are injected as advisor messages, not hard blocks. The agent can continue if it has good reason, but the message forces conscious acknowledgment of the pattern.

**Skip if**: Phase 1 (UNDERSTAND) — observation-heavy is expected during research. Only track during Phase 4+ where effects should dominate.

### Budget-Aware Phase Progression

Beyond the existing Exit Conditions (MAX_DEBUG_LOOPS, MAX_QUALITY_LOOPS, etc.), track **cumulative budget** across the entire cook session:

| Budget | Limit | What Happens at Limit |
|--------|-------|----------------------|
| **Phase 4 react budget** | 15 tool calls per task within Phase 4 | Force: move to next task or report partial completion |
| **Global replan budget** | 2 replans per session (Phase 4 Step 6) | Force: proceed with current plan or escalate to user |
| **Quality retry budget** | 3 total quality re-runs across 5a-5d | Force: ship with known issues documented, don't loop |
| **Total session tool calls** | 150 calls | Force: save state via session-bridge, compact or pause |

**Hard override rules**:
- If react budget exhausted for a task but task is IN_PROGRESS → force CONTINUE to next task (don't re-attempt)
- If replan budget exhausted but plan still failing → force escalation (don't attempt 3rd replan)
- If quality retry budget exhausted → emit concerns in Cook Report, proceed to commit with documented caveats

**Why**: Without hard budgets, agents get trapped in local optimization loops — retrying the same failing approach indefinitely. Budget constraints force escalation or acceptance of partial results, which is always better than an infinite loop.

### Hash-Based Tool Loop Detection

<MUST-READ path="references/loop-detection.md" trigger="when same tool+args+result appears to be repeating"/>

Mentally track tool call fingerprints. 3 identical calls → WARN. 5 identical calls → FORCE STOP. Only same-input-AND-same-output counts as a loop.
