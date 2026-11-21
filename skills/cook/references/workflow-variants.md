# cook — Workflow variants

> Reference for `skills/cook/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Production Hotfix Protocol

When `hotfix` chain is active AND triggered from a live incident (not a dev-time fix), follow the full orchestrated chain — not just fix → verify → commit.

```
FULL HOTFIX CHAIN (when incident is active):

1. CONTAIN   → `rune:incident` (if not already running): triage + contain blast radius first
2. BRANCH    → create hotfix branch via worktree (isolate from main)
3. FIX       → `rune:fix` (minimal change only — no refactoring, no scope creep)
4. VERIFY    → `rune:verification` (full test suite on hotfix branch)
5. SENTINEL  → `rune:sentinel` (security check — fix may introduce new surface)
6. DEPLOY    → `rune:deploy` (deploy hotfix to production)
7. WATCHDOG  → `rune:watchdog` (confirm health check passes post-deploy)
8. POSTMORTEM → `rune:journal` + `rune:neural-memory` (capture root cause + fix pattern)

HARD-GATES:
- Do NOT skip CONTAIN if users are actively affected
- Do NOT skip SENTINEL on hotfix — rushed fixes frequently introduce new vulnerabilities
- Do NOT merge hotfix to main without VERIFY passing
- Do NOT skip POSTMORTEM — hotfix without learning = same incident next month
```

**Minimal hotfix chain (non-incident, dev-time):** Phase 4 → 6 → 7 (fix → verify → commit). User provides context, skip scout.

### Template Workflows (Pro/Business)

When `--template <name>` is provided, cook loads a pre-built workflow template instead of auto-detecting:

```
/rune cook --template product-discovery   → Pro: stakeholder interviews → problem framing → competitive → spec → validation
/rune cook --template product-launch      → Pro: spec lock → implement → quality gates → staged rollout → announcement
/rune cook --template product-iteration   → Pro: metrics review → feedback synthesis → re-prioritize → implement → measure
/rune cook --template data-exploration    → Pro: data profiling → hypotheses → statistical testing → visualization → report
/rune cook --template data-pipeline       → Pro: schema design → ETL → quality gates → deploy → monitoring
/rune cook --template sales-outreach-campaign → Pro: prospect research → messaging → sequence → A/B test → launch
/rune cook --template sales-deal-review   → Pro: account deep-dive → risk assessment → competitive strategy → action plan
/rune cook --template support-incident-response → Pro: triage → diagnose → fix → verify → postmortem → KB update
/rune cook --template support-kb-refresh  → Pro: audit → gap analysis → draft → review → publish
```

**Template resolution**: Templates are `.md` files in `extensions/pro-*/templates/` or `extensions/business-*/templates/`. Each template defines: phases, skill connections, mesh signals, and acceptance criteria. The compiler includes templates in pack output during build.

**When --template is used**:
1. Skip Phase 1.5 (auto-detection) — template pre-selects domain and pack
2. Skip Phase 1.7 (workflow matching) — template IS the workflow
3. Load template phases as the master plan (Phase 2 becomes "review template plan" not "create plan")
4. Execute each template phase in order, invoking declared skills
5. Emit template's declared signals on completion

**Chain selection**: If user invokes `/rune cook` without a chain type, auto-detect from the task description:
- Contains "bug", "fix", "broken", "error" → `bugfix`
- Contains "refactor", "clean", "restructure" → `refactor`
- Contains "security", "auth", "vulnerability", "CVE" → `security`
- Contains "urgent", "hotfix", "production" → `hotfix`
- Contains "quick", "just", "chỉ cần", "copy", "move", "rename", "bump" → `nano`
- Contains "graft", "port from", "copy from repo", "clone feature from" → **delegate to `rune:graft`** (not a cook chain — hand off entirely)
- Contains `--template` → load template workflow (see above)
- Default → `feature`
