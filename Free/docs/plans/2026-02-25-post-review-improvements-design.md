# Post-Review Improvements Design

**Date**: 2026-02-25
**Trigger**: Agent-to-agent review by Bé Mi (OpenClaw) — [Notion link](https://www.notion.so/Review-Rune-Skill-Ecosystem-cho-Claude-Code-by-B-Mi-312f06b7d03c81fd8e02f728f8324088)
**Scope**: 3 improvements across security, orchestration, and extension quality

---

## 1. Agentic Security — New L3 `integrity-check` + sentinel upgrade

### Problem

sentinel covers traditional code security (OWASP, secrets, deps) but has 0% coverage for agentic threats: prompt injection in persisted state, memory poisoning via malicious PRs to `.rune/`, identity spoofing in multi-agent flows. session-bridge loads `.rune/` files without any verification.

### Design

#### New Skill: `integrity-check` (L3, haiku, group: validation)

Three capabilities:

**A. State File Integrity**
- Verify `.rune/*.md` files on load via session-bridge
- Checks: git-blame verification (unexpected author?), content pattern scan (zero-width Unicode U+200B-U+200F/U+FEFF, HTML comments with hidden instructions, base64 encoded payloads)
- Output: `CLEAN` | `SUSPICIOUS` + details

**B. Skill Output Validation**
- Verify cook reports from worktree agents before team merges them
- Scan patterns: `<SYSTEM>`, `<IMPORTANT>`, `ignore previous`, hidden Unicode, encoded payloads
- Output: `VERIFIED` | `TAINTED` + details

**C. Context Bus Sanitization**
- Validate context passed between layers for adversarial content
- Check: unexpected code execution patterns, path traversal, env var exfiltration attempts

**Mesh connections:**
```
integrity-check (L3)
  Called By ← sentinel (L2): agentic security phase (Step 4.7)
  Called By ← team (L1): verify cook reports before merge
  Called By ← session-bridge (L3): verify .rune/ files on load
    (L3→L3 exception, documented like hallucination-guard → research)
```

#### sentinel Upgrade: New Step 4.7 — Agentic Security Scan

Insert between Step 4.5 (Framework-Specific) and Step 5 (Report):

```
### Step 4.7 — Agentic Security Scan
Invoke `integrity-check` on:
- All .rune/ files in project
- Any skill output files being committed
- Memory/state files (decisions.md, conventions.md)

Patterns to detect:
- Prompt injection: zero-width chars (U+200B-U+200F, U+FEFF), hidden HTML comments
- Slopsquatting in decisions: package names with edit distance ≤ 2 from popular packages
- Identity spoofing: unexpected author in .rune/ git blame

integrity-check SUSPICIOUS = sentinel WARN
integrity-check TAINTED = sentinel BLOCK
```

#### session-bridge Upgrade: Load Mode Step 1.5

After checking `.rune/` existence, before loading files:

```
### Step 1.5 — Integrity verification
Invoke integrity-check on all .rune/*.md files.
If any file returns SUSPICIOUS:
  → Present warning to user with details
  → Ask whether to proceed with loading or skip suspicious file
If any file returns TAINTED:
  → BLOCK load
  → Report: ".rune/ integrity check failed — possible poisoning detected"
```

**Cost impact**: +~200-500 tokens when `.rune/` files exist. Haiku model. Negligible.

---

## 2. Team Conflict Resolution Enhancement

### Problem

team detects file conflicts AFTER merge (Phase 3) but doesn't prevent them. No dependency graph analysis for coupled modules. No rollback mechanism on merge failure. No scope violation detection during agent execution.

### Design: 4 additions to `team/SKILL.md`

#### A. Phase 1c — Dependency Graph Analysis

Enhance existing gate check:

```
GATE CHECK — enhanced:
  [ ] Each stream owns disjoint file sets (existing)
  [ ] No coupled modules across streams (NEW):
      → Use Grep to find import/require statements in owned files
      → If stream A files import from stream B files → flag as COUPLED
      → Coupled modules MUST be in same stream or sequential with depends_on
  [ ] Total streams ≤ 3 (existing)
```

#### B. Phase 2b.5 — Pre-merge Scope Verification

New step between 2b (launch dependent) and 2c (collect reports):

```
After each stream completes, BEFORE collecting final report:
  Bash: git diff --name-only main...[worktree-branch]
  → Compare actual modified files vs planned file ownership
  → If agent modified files OUTSIDE its scope → FLAG:
    "Stream [id] modified [file] not in its scope. Review before merge."
  → Present to user if scope violation detected
```

#### C. Phase 4a — Atomic Merge with Rollback

```
4a (enhanced):
  Bash: git tag pre-team-merge  (bookmark before any merge)

  For each stream in dependency order:
    Bash: git merge --no-ff [worktree-branch]
    If merge conflict:
      → Attempt auto-resolve using cook report guidance
      → If >3 conflicting files or ambiguous → STOP, ask user
      → If auto-resolve fails:
        Bash: git merge --abort
        Report: "Stream [id] merge failed."

  If Phase 5 verification fails:
    Bash: git reset --hard pre-team-merge
    Report: "Integration tests failed. All merges reverted."
```

#### D. New Sharp Edges

```
| Coupled modules across streams | HIGH | Dependency graph check in Phase 1c |
| Agent modified files outside scope | HIGH | Pre-merge scope verification in Phase 2b.5 |
| Merge failure with no rollback | HIGH | pre-team-merge tag + git reset on failure |
```

---

## 3. L4 Extension Template Enhancement

### Problem

L4 packs average 36 lines vs skill template 72 lines. 0 packs have: Triggers, Workflow steps, Sharp Edges, Done When, Cost Profile, Constraints. Extension template is 50% the depth of skill template.

### Design

#### Enhanced EXTENSION-TEMPLATE.md (~72 lines)

Add sections to match skill template depth:

```markdown
## Triggers (NEW)
## Workflow (NEW — per-skill executable steps)
## Constraints (NEW — MUST/MUST NOT rules)
## Sharp Edges (NEW — failure modes table)
## Done When (NEW — verifiable conditions)
## Cost Profile (NEW — token estimates)
```

#### Upgrade 3 flagship packs

1. **`@rune/ui`** — frontend, most popular domain
2. **`@rune/security`** — complement agentic security work
3. **`@rune/trading`** — showcase niche domain depth

Each pack upgrade includes:
- Triggers section with auto-detection rules
- Workflow with executable steps per skill (code examples)
- Sharp Edges (3-5 failure modes)
- Done When + Cost Profile
- At least 1 code example per skill

Remaining 9 packs: community contributes using new template as reference.

---

## Files Changed

| File | Action | Est. Lines |
|---|---|---|
| `skills/integrity-check/SKILL.md` | **Create** | ~180 |
| `skills/sentinel/SKILL.md` | Edit (+Step 4.7) | +30 |
| `skills/session-bridge/SKILL.md` | Edit (+Step 1.5) | +15 |
| `skills/team/SKILL.md` | Edit (4 enhancements) | +60 |
| `docs/EXTENSION-TEMPLATE.md` | Rewrite | ~72 |
| `extensions/ui/PACK.md` | Rewrite | ~120 |
| `extensions/security/PACK.md` | Rewrite | ~120 |
| `extensions/trading/PACK.md` | Rewrite | ~100 |
| `docs/ARCHITECTURE.md` | Edit (add integrity-check) | +5 |

**Total**: ~700 lines new/modified across 9 files.
