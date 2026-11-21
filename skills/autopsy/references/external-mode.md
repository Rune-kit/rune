# autopsy — External repo mode (--external)

> Reference for `skills/autopsy/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## External Repo Mode (--external)

When invoked as `/rune autopsy --external <github-url>`, evaluate someone else's repo for dependency / fork / contribution decisions. Different use case from rescue mode: you cannot run their tests, cannot rely on local Read, and the decision frame is "should I trust this?" not "how do I rescue this?".

### When to use --external

- Evaluating a library before adding it as a dependency
- Deciding whether to fork an abandoned project
- Choosing between competing implementations (`autopsy --external A vs B`)
- Diligence on a candidate acquisition target
- Pre-graft assessment (cross-skill: feeds into `graft`)

### External Execution Steps

#### Step 1 — Repo Intelligence (no local clone needed)

Use `gh api` exclusively — do NOT `git clone`. Faster + cleaner.

```bash
URL="$1"  # e.g., github.com/anthropics/claude-code
OWNER_REPO=$(echo "$URL" | sed -E 's|https?://github.com/||; s|/$||')

# Core metadata
gh api "repos/${OWNER_REPO}" --jq '{
  name, full_name, description, language, license: .license.spdx_id,
  stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count,
  open_issues: .open_issues_count, default_branch,
  created: .created_at, updated: .updated_at, pushed: .pushed_at,
  archived, disabled, topics
}'

# Maintainer responsiveness (issue + PR close rates)
gh api "repos/${OWNER_REPO}/issues?state=closed&per_page=100" --jq '
  [.[] | select(.pull_request == null) | (.closed_at | fromdateiso8601) - (.created_at | fromdateiso8601)] | add / length / 86400'   # avg days-to-close

gh api "repos/${OWNER_REPO}/pulls?state=closed&per_page=100" --jq '
  [.[] | select(.merged_at != null) | (.merged_at | fromdateiso8601) - (.created_at | fromdateiso8601)] | add / length / 86400'   # avg PR merge time

# Release cadence (last 10 releases)
gh api "repos/${OWNER_REPO}/releases?per_page=10" --jq '[.[] | {tag: .tag_name, published: .published_at, prerelease}]'

# Security advisories
gh api "repos/${OWNER_REPO}/security-advisories" --jq 'length' 2>/dev/null || echo "0"

# Dependabot alerts (if accessible — usually not for external repos)
gh api "repos/${OWNER_REPO}/dependabot/alerts" --jq 'length' 2>/dev/null || echo "n/a"
```

#### Step 2 — Decision Rubric (not Health Scoring)

External evaluation uses a DIFFERENT rubric than internal rescue. Internal cares about complexity; external cares about TRUST.

Score 0-100 across five dimensions:

| Dimension | Weight | Scoring criteria |
|---|---|---|
| **Activity** | 25% | Last push < 30d = 100, < 90d = 80, < 1yr = 50, < 2yr = 20, > 2yr = 0 |
| **Maintainership** | 25% | Avg issue-close < 7d = 100, < 30d = 70, < 90d = 40, > 90d = 10. Contributor count: > 10 = bonus +15, 2-10 = no change, 1 = penalty -20 (bus factor) |
| **Adoption** | 15% | Stars × (production-use signal from dependents): > 10k = 100, > 1k = 70, > 100 = 40, < 100 = 10. Dependent-repo count (via `gh api repos/X/Y/network/dependents` if available) is the production-use proxy |
| **License** | 20% | Permissive (MIT/Apache/BSD) = 100. Weak copyleft (MPL/LGPL) = 80. Strong copyleft (GPL) = 40. None / proprietary = 0. Verify SPDX field; flag if `null` |
| **Security** | 15% | 0 open advisories + recent CVEs addressed = 100. 1-2 unaddressed = 50. > 3 OR critical unaddressed > 30 days = 0. Audit log: check for force-push to default branch, suspicious release commits |

Composite score with same risk tiers as internal mode (80+ healthy, 60-79 watch, 40-59 at-risk, 0-39 critical).

#### Step 3 — Architecture Extraction (without reading every file)

You can't Read every file in an external repo. Extract architecture via metadata:

- **Top-level structure** via `gh api repos/X/Y/contents/` (folder names = module boundaries)
- **Tech stack** via root manifest files: `package.json` (deps), `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`. Fetch with `gh api repos/X/Y/contents/package.json --jq .content | base64 -d`
- **Test infrastructure** via existence of `tests/`, `__tests__/`, `*_test.go`, etc. (use `gh api repos/X/Y/git/trees/HEAD?recursive=1 --jq '.tree[].path' | grep -E '_test|spec'`)
- **CI config** via `.github/workflows/`, `.gitlab-ci.yml`, etc. (presence = quality signal; recent green builds via `gh api repos/X/Y/actions/runs?status=success&per_page=5`)
- **Documentation depth** via README size + `docs/` folder existence
- **ADRs** via search: `gh api search/code -X GET --field q="repo:owner/repo path:docs filename:adr*"`

#### Step 4 — Comparative Mode (optional)

When called as `/rune autopsy --external A --external B`, produce side-by-side comparison:

```markdown
| Dimension       | Repo A        | Repo B        | Winner |
|-----------------|---------------|---------------|--------|
| Activity        | 95 (active)   | 30 (stale)    | A      |
| Maintainership  | 80            | 60            | A      |
| Adoption        | 70            | 90            | B      |
| License         | 100 (MIT)     | 40 (GPL)      | A      |
| Security        | 100 (clean)   | 85 (1 open)   | A      |
| **Composite**   | **89**        | **57**        | **A**  |

Recommendation: A — significantly healthier on 4/5 dimensions.
```

#### Step 5 — Output

Write `EXTERNAL-REPO-REPORT.md` at project root (or operator-specified path):

```markdown
# External Repo Evaluation: [owner/repo]
Generated: [date]
Decision: [DEPEND | FORK | CONTRIBUTE | AVOID]
Composite Score: [N]/100 ([tier])

## Quick Verdict
[1-2 sentence summary of why this score]

## Decision Rubric (5 dimensions)
[Table per Step 2]

## Activity Signal
- Last push: [date]
- Commits last 90 days: [N]
- Trend: [accelerating | stable | decelerating]

## Maintainership Signal
- Contributor count: [N] ([bus factor: critical/low/healthy])
- Avg issue close: [N] days
- Avg PR merge: [N] days
- Top contributor: [@user] ([N]% of commits — concentration risk if > 80%)

## Adoption Signal
- Stars: [N] · Forks: [N] · Watchers: [N]
- Dependent repos: [N]
- Notable users: [list if known via gh dependents API or readme mentions]

## License
- SPDX: [identifier]
- Compatibility: [compatible with our project's license | flag legal review]

## Security
- Open advisories: [N]
- Recent CVEs: [count + latest date]
- Audit log flags: [force-push events / suspicious releases / none]

## Architecture (extracted, not read)
- Tech stack: [languages + frameworks from manifest]
- Test infrastructure: [present | absent]
- CI status: [N recent green builds | failing | none configured]
- Documentation depth: [README size + docs/ folder presence]

## Confidence
[High | Medium | Low] — based on API data completeness; external mode confidence rarely exceeds Medium because we cannot run tests or read every file.

## Recommendation
[DEPEND | FORK | CONTRIBUTE | AVOID] with rationale grounded in the dimensions above. If FORK is recommended, link to the activity signal showing why (e.g., "last push > 1 year + 12 unaddressed PRs + critical bug filed").
```

### External Mode Constraints

1. MUST use `gh api` only — do NOT `git clone` (external mode is API-driven by design; clones add ~30 seconds + disk usage for no analytical gain)
2. MUST compute all 5 dimensions OR explicitly mark "insufficient data" for any that can't be measured (e.g., no advisories endpoint access)
3. MUST cap confidence at Medium for external evaluations — internal Read-based scoring is High; external API-only is Medium at best
4. MUST output decision verdict (DEPEND / FORK / CONTRIBUTE / AVOID) — not "needs more research"
5. MUST flag license compatibility if SPDX is `null`, GPL, or proprietary
6. MUST NOT skip Security dimension even if API returns empty — explicitly note "no advisories found" vs "advisories endpoint inaccessible"

### Graceful Degradation (External Mode)

- If `gh` CLI not authenticated: fall back to `curl` with `GITHUB_TOKEN` env var; document rate-limit risk (60 unauth / 5000 auth per hour)
- If repo is private + no auth: report partial — public-API-only signals; flag confidence as Low
- If repo is fork: trace upstream and offer "compare with upstream" sub-option
- If repo is archived: auto-flag — composite caps at 30 regardless of other dimensions; archived repos are AVOID by default unless operator overrides

### Hand-offs (External Mode)

External evaluation produces a verdict that flows to other skills:

- DEPEND → cross-skill: `dependency-doctor` for vulnerability scan integration
- FORK → cross-skill: `graft` to plan the fork + adapt
- CONTRIBUTE → cross-skill: `review-intake` (PR-style workflow for the contribution)
- AVOID → terminate; document rationale in `.rune/decisions/`
