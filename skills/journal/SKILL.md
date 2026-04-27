---
name: journal
description: Persistent state tracking and Architecture Decision Records across sessions. Use when recording a decision, ADR, or progress that must survive session boundaries. Manages progress state, module health, dependency graphs, and ADRs for any workflow.
metadata:
  author: runedev
  version: "0.4.0"
  layer: L3
  model: haiku
  group: state
  tools: "Read, Write, Edit, Glob, Grep"
  listen: graft.complete
---

# journal

## Purpose

Persistent state tracking and Architecture Decision Records across sessions. Journal manages the state files that allow any workflow to span multiple sessions without losing progress — rescue operations, feature development, deploy decisions, or audit findings. Separate from session-bridge which handles general context injection — journal writes durable, human-readable state that survives compaction.

## Triggers

- Called by any skill needing decision persistence or progress tracking
- Auto-trigger: after surgeon completes a module, after deploy, after audit phases

## Calls (outbound)

None — pure L3 state management utility.

## Called By (inbound)

- `surgeon` (L2): update progress after each surgery session
- `rescue` (L1): read state for rescue dashboard
- `autopsy` (L2): save initial health assessment
- `cook` (L1): record key architectural decisions made during feature development
- `deploy` (L2): record deploy decision, rollback plan, and post-deploy status
- `audit` (L2): save AUDIT-REPORT.md and record health trend entry
- `incident` (L2): record incident timeline and postmortem
- `skill-forge` (L2): record skill creation decisions and rationale
- `graft` (L2): auto-log graft operations — source URL, mode, challenge score, files changed
- `retro` (L2): record retrospective insights and decisions
- `improve-architecture` (L2): record an ADR when the user rejects a deepening candidate with a load-bearing reason

## Files Managed

```
.rune/RESCUE-STATE.md      — Human-readable rescue progress (loaded into context)
.rune/module-status.json   — Machine-readable module states
.rune/dependency-graph.mmd — Mermaid diagram, color-coded by health
.rune/adr/                 — Architecture Decision Records (one per decision)
.rune/risks/               — Risk Register entries (one per identified risk)
```

## Execution

### Step 1 — Load state

Use `Read` to load current rescue state:

```
Read: .rune/RESCUE-STATE.md
Read: .rune/module-status.json
```

If either file does not exist, initialize it with an empty template:

- `RESCUE-STATE.md`: create with header `# Rescue State\n\n**Started**: [date]\n**Phase**: 1\n`
- `module-status.json`: create with `{ "modules": [], "lastUpdated": "[iso-date]" }`

Parse `module-status.json` to extract current module states and health scores.

### Step 2 — Update progress

For each module that was completed during this session:

1. Locate the module entry in the parsed `module-status.json`
2. Update its fields:
   - `status`: set to `"complete"` (or `"in-progress"` / `"blocked"` as appropriate)
   - `healthScore`: set to the post-surgery score (0-100)
   - `completedAt`: set to current ISO timestamp
3. Mark the active module pointer in `RESCUE-STATE.md` — update the `**Current Module**` line to the next pending module

Use `Write` to save the updated `module-status.json`.

Use `Edit` to update the relevant lines in `RESCUE-STATE.md` (current phase, current module, counts of completed vs pending).

### Step 3 — Record decisions (gated by 3-criteria scoring)

For each architectural decision or trade-off made during this session (applies to any workflow — feature development, deploy, rescue, audit):

#### Step 3.0 — Score the decision

Compute three numeric scores (1–5 each) before opening any ADR file. See [references/adr-criteria.md](references/adr-criteria.md) for full rubric.

| Axis | What it measures |
|------|------------------|
| `reversibility` | 1 = next-sprint reversible; 5 = practically irreversible |
| `surprisingness` | 1 = obvious to any reader; 5 = future engineer would "fix" without context |
| `tradeoff_strength` | 1 = no real alternative; 5 = genuinely difficult choice |

```
score = reversibility + surprisingness + tradeoff_strength    # range 3–15
open_adr = (score >= 11) AND (each axis >= 3)
```

#### Step 3.1 — Counter-test (anti-fake)

Before writing the ADR, fill in **at least one rejected alternative + why**. If no credible alternative was actually considered, the decision wasn't a real tradeoff — re-classify as a **convention** (record in CLAUDE.md or comment, not in `.rune/adr/`) and skip ADR creation.

#### Step 3.2 — Open the ADR (if gate passed)

1. Generate filename including the score: `.rune/adr/ADR-[NNN]-[slug]-s[score].md` where NNN is sequential and `score` is the 3–15 sum (e.g., `ADR-007-postgres-write-model-s13.md`)
2. Use `Write` to create the ADR file with this format:

```markdown
# ADR-[NNN]: [Decision Title]

**Date**: [YYYY-MM-DD]
**Status**: Accepted
**Workflow**: [rescue | cook | deploy | audit | other]
**Scope**: [affected module, feature, or system area]
**Score**: reversibility=[1-5] / surprisingness=[1-5] / tradeoff_strength=[1-5] / total=[3-15]

## Context
[Why this decision was needed — what problem or trade-off prompted it]

## Decision
[What was decided — be specific, not "we chose X" but "we chose X over Y"]

## Rationale
[Why this approach over alternatives — cite specific constraints or evidence]

## Consequences
[Impact on files/modules/future work — include rollback path if relevant]

## Rejected Alternatives (counter-test — MUST have at least one)
[List what was considered but NOT chosen, and why. This prevents future sessions from re-visiting dead ends. If you cannot fill in this section, the decision wasn't a real tradeoff — DO NOT open this ADR.]
- **[Alternative A]**: Rejected because [specific reason — constraint, performance, complexity]
- **[Alternative B]**: Rejected because [specific reason]. May reconsider if [condition changes].
```

### Step 3.5 — Record risks

For each risk identified during the session (technical, schedule, dependency, security):

1. Generate a risk filename: `.rune/risks/RISK-[NNN]-[slug].md` where NNN is next sequential number
2. Use `Write` to create the risk file:

```markdown
# RISK-[NNN]: [Risk Title]

**Date Identified**: [YYYY-MM-DD]
**Identified By**: [workflow — cook | plan | deploy | audit | adversary]
**Severity**: Critical | High | Medium | Low
**Likelihood**: High | Medium | Low
**Status**: Open | Mitigated | Accepted | Closed

## Description
[What could go wrong — specific scenario, not vague "things might break"]

## Impact
[What happens if this risk materializes — quantify if possible]

## Mitigation
[Actions to reduce likelihood or impact]
- [ ] [Action 1 — owner, deadline]
- [ ] [Action 2]

## Trigger Conditions
[How to detect this risk is materializing — monitoring, alerts, symptoms]

## Contingency
[What to do if risk materializes despite mitigation — the Plan B]
```

3. **Risk classification matrix**:

| Likelihood \ Severity | Critical | High | Medium | Low |
|----------------------|----------|------|--------|-----|
| **High** | 🔴 Immediate action | 🔴 This sprint | 🟡 This quarter | ⚪ Backlog |
| **Medium** | 🔴 This sprint | 🟡 This quarter | ⚪ Backlog | ⚪ Accept |
| **Low** | 🟡 This quarter | ⚪ Backlog | ⚪ Accept | ⚪ Accept |

4. Risks marked 🔴 MUST have mitigation actions with deadlines. ⚪ Accept = documented acknowledgment, no action required.

### Step 4 — Update dependency graph

If any module dependencies changed during this session (new imports, removed dependencies, refactored interfaces):

Use `Read` on `.rune/dependency-graph.mmd` to load the current Mermaid diagram.

Use `Edit` to update the affected node entries:
- Change node color/style to reflect new health status (e.g., `style ModuleName fill:#00d084` for healthy, `fill:#ff6b6b` for broken)
- Add or remove edges as dependencies changed

Use `Write` to save the updated `.rune/dependency-graph.mmd`.

### Step 5 — Save state

Use `Write` to finalize any remaining state file changes not already saved in Steps 2-4.

Confirm all four managed files are consistent:
- `RESCUE-STATE.md` reflects current phase and module
- `module-status.json` has updated scores and timestamps
- ADR files exist for all decisions made
- `dependency-graph.mmd` reflects current module relationships

### Step 6 — Report

Emit the journal update summary to the calling skill.

## Output Format

```
## Journal Update
- **Phase**: [current rescue phase]
- **Module**: [current module]
- **Health**: [before] → [after]
- **ADRs Written**: [count]
- **Risks Logged**: [count] ([severity breakdown])
- **Files Updated**: [list of .rune/ files modified]
- **Next Module**: [next in queue, or "rescue complete"]
```

## Context Recovery (new session)

```
1. Read .rune/RESCUE-STATE.md   → full rescue history
2. Read .rune/module-status.json → module states and health scores
3. Read .rune/risks/             → open risks and their status
4. Read git log                  → latest changes since last session
5. Read CLAUDE.md               → project conventions
→ Result: Zero context loss across rescue sessions
```

## Constraints

1. MUST record decisions with rationale — not just "decided to use X"
2. MUST timestamp all entries
3. MUST NOT log sensitive data (secrets, tokens, credentials)
4. MUST work for any workflow — never require rescue-specific fields to be present

## Sharp Edges

Known failure modes for this skill. Check these before declaring done.

| Failure Mode | Severity | Mitigation |
|---|---|---|
| ADR written from memory instead of actual session events | HIGH | Only record decisions that were explicitly made in this session — don't reconstruct |
| RESCUE-STATE.md initialized without content when called from non-rescue workflows | MEDIUM | If caller is not rescue/surgeon, skip RESCUE-STATE.md initialization — use progress.md instead |
| Overwriting human-written ADR content on re-run | CRITICAL | MUST check if ADR-[NNN].md exists before writing — never overwrite, increment NNN |
| Empty ADR Rationale field ("decided to use X") | MEDIUM | Constraint 1 blocks this — re-prompt for rationale before writing |
| Opening an ADR for a decision that scores below threshold (sum < 11 or any axis < 3) | HIGH | Step 3.0 gate — if score fails, classify as "convention" and record in CLAUDE.md instead |
| Score inflation to reach threshold | MEDIUM | Step 3.1 counter-test — must name a credible rejected alternative; cannot be faked |
| ADR for a deferral ("we'll do X later") | MEDIUM | Deferrals are not decisions; route to backlog or `.out-of-scope/` (if rejection) |

## Done When

- All decisions from the session that pass the 3-criteria gate (sum >= 11, each axis >= 3, counter-test filled) recorded as ADR files
- Decisions failing the gate classified as conventions (logged in CLAUDE.md or code comment, NOT in `.rune/adr/`)
- All identified risks recorded as RISK files with severity, mitigation, and trigger conditions
- Progress state updated (module status, phase, or deploy event as appropriate)
- Dependency graph updated if module relationships changed
- Journal Update summary emitted to calling skill
- No existing ADR files overwritten

## Cost Profile

~200-500 tokens input, ~100-300 tokens output. Haiku. Pure file management.
