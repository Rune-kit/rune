# Skill Depth Audit

> Living document. Updated each cycle when skills are enriched.
> Last audit: 2026-03-08 | Audited by: Claude Opus 4.6

## Depth Scale

| Score | Definition | Characteristics |
|-------|-----------|-----------------|
| **5** | Exemplary | Embedded frameworks, multiple mental models, edge cases explicit, anti-patterns enumerated, worked examples, error recovery deep |
| **4** | Comprehensive | Clear workflow, good error handling, frameworks present but <3 worked examples, all gates enforced |
| **3** | Solid | Single workflow flow, frameworks named but not demonstrated, happy path covered, gaps on edge cases |
| **2** | Thin | Instructions present but generic, minimal framework depth, no examples |
| **1** | Skeleton | Placeholder, just routing instructions |

## Context Cost Comparison

Understanding why skill depth matters — comparing execution with vs without skill knowledge:

| Scenario | Without Skill (Research Mode) | With Deep Skill (Inject Mode) |
|----------|-------------------------------|-------------------------------|
| **Debug a bug** | ~8-15 tool calls: grep → read → hypothesize → grep → read → test → fix → test | ~4-6 tool calls: hypothesis cycle (max 3), evidence-first, escalate at fix #3 |
| **Write tests** | Writes tests after code, misses edge cases, no coverage gate | TDD Iron Law: test first → red → green → refactor, anti-rationalization table blocks shortcuts |
| **Security review** | Generic OWASP checklist from training data, misses framework-specific patterns | Framework-specific regex patterns, config drift detection, 3-layer defense model |
| **Plan a feature** | Vague steps like "implement auth", no function signatures | Bite-sized phases, function signatures required, dependency ordering, risk per phase |
| **Refactor legacy** | Big bang rewrite attempt, breaks everything | Strangler Fig / Branch by Abstraction, 1 module/session, characterization tests first |

**Key insight**: A deep skill doesn't just tell Claude WHAT to do — it gives Claude the MENTAL MODEL of an expert. Research mode gives answers; skill mode gives judgment.

### Token Economics

| | Research Mode | Skill Inject Mode |
|--|---------------|-------------------|
| **Context cost** | 0 tokens upfront, but 2000-8000 tokens per research cycle (WebSearch, WebFetch, Read docs) | 150-400 tokens upfront (SKILL.md loaded), 0 research tokens |
| **Tool calls** | 8-20 per task (search, read, verify, retry) | 3-8 per task (direct execution) |
| **Accuracy** | Variable — depends on search quality, training data freshness | High — curated knowledge, verified patterns |
| **Speed** | Slow — research → synthesize → attempt → verify → retry | Fast — framework → execute → verify |
| **Consistency** | Low — different approach each session | High — same framework, same quality bar |

**Bottom line**: A 200-line SKILL.md (~300 tokens) saves 5000-15000 tokens of research per invocation. ROI is massive for frequently-used skills.

## Enrichment Sources Registry

External repos analyzed for knowledge extraction. Track what was extracted and where it went.

| Source | URL | Analyzed | Skills Extracted To |
|--------|-----|----------|---------------------|
| CloudAI-X/threejs-skills | github.com/CloudAI-X/threejs-skills | 2026-03-08 | (no extraction — domain-specific 3D skills, not applicable to core workflow skills) |
| mrgoonie/claudekit-skills | github.com/mrgoonie/claudekit-skills | 2026-03-08 | debug, fix, brainstorm, problem-solver, docs-seeker (5 skills enriched) |

## Enrichment Framework

### Extraction Process (per external source)

```
1. SCAN    — Read source skill, identify unique knowledge
2. FILTER  — Remove: verbose filler, obvious instructions, things Claude already knows
3. EXTRACT — Pull: frameworks, mental models, decision trees, anti-patterns, gotchas
4. MAP     — Match extracted knowledge → target Rune skill(s)
5. INJECT  — Add to Rune skill preserving: mesh contracts, progressive disclosure, context budget
6. VERIFY  — Skill still works in mesh, SKILL.md stays under ~350 lines
```

### What to Extract (High Value)

- **Decision trees**: "When X, choose Y because Z" — not just "do Y"
- **Anti-patterns with WHY**: "Don't do X because it causes Y in production"
- **Framework sequences**: Step 1 → Step 2 → Step 3 with clear entry/exit criteria
- **Gotchas**: Things that look right but break subtly
- **Domain heuristics**: Expert shortcuts that skip unnecessary work

### What NOT to Extract (Low Value / Harmful)

- Generic instructions Claude already knows ("use git", "write tests")
- Verbose explanations that inflate context without adding judgment
- Framework-specific API docs (use docs-seeker/context7 at runtime instead)
- Patterns that conflict with Rune's mesh delegation model

### Context Budget Rule

Each SKILL.md should stay **150-350 lines** (~200-500 tokens when loaded).
If enrichment pushes beyond 350 lines → use progressive disclosure:
- Core instructions: always loaded (~150 lines)
- Deep reference: in `references/` subfolder, loaded on demand

---

## L0 Router (1 skill)

| Skill | Lines | Depth | Has | Missing | Enrich From |
|-------|-------|-------|-----|---------|-------------|
| skill-router | — | 4 | Routing table, adaptive overrides, model selection | Decision examples for ambiguous routing | — |

## L1 Orchestrators (4 skills)

| Skill | Lines | Depth | Has | Missing | Enrich From |
|-------|-------|-------|-----|---------|-------------|
| **cook** | 504 | ⭐5 | 8-phase TDD, fast-mode detection, phase skip, re-plan, autonomous loop, HARD-GATEs | — (exemplary) | — |
| **team** | 397 | ⭐5 | Lite/full mode auto-detect, dependency ordering, merge conflict resolution, integrity check | — | — |
| **launch** | 330 | 4.5 | Artifact readiness, 5-phase pipeline, platform auto-detect, watchdog integration | Rollback strategy detail | — |
| **rescue** | 434 | 4.5 | Multi-session state, surgery queue, Strangler Fig/Branch by Abstraction, 3-fix escalation | Coupled module detection heuristics | — |

## L2 Workflow Hubs (23 skills)

| Skill | Lines | Depth | Has | Missing | Enrich From |
|-------|-------|-------|-----|---------|-------------|
| **plan** | 238 | ⭐5 | HARD-GATE vague steps, bite-sized decomposition, function signatures, risk assessment | — | — |
| **debug** | ~220 | ⭐5+ | 2-3 hypothesis cycle, evidence-first, backward tracing (5-step), multi-component instrumentation, red flags thinking patterns, 3-fix escalation | — (enriched 2026-03-08) | — |
| **test** | 271 | ⭐5 | RED/GREEN/REFACTOR, TDD Iron Law, anti-rationalization table (6 excuses), async fixtures | Language-specific test patterns beyond Python | CK: verification-before-completion |
| **review** | 354 | ⭐5 | Framework-specific checks (React/Node/Python/Go/Rust), AI UI detection, WCAG 2.2 | — | CK: code-review checklist |
| **skill-forge** | 317 | ⭐5 | Baseline test before writing, anti-rationalization, pressure scenarios | — | — |
| **scout** | 232 | 4.5 | ADOPT/EXTEND/COMPOSE/BUILD matrix, codebase map, convention detection | Read vs Grep prioritization heuristics | — |
| **brainstorm** | ~210 | 4.5 | 2-3 approaches, 7 frameworks (SCAMPER/First Principles/6 Hats/Crazy 8s + Collision-Zone/Inversion/Scale Game) | Worked examples | — |
| **fix** | ~200 | 4.5 | Evidence gate, 3-fix limit, YAGNI, immutability, post-fix hardening (4-layer defense-in-depth) | — (enriched 2026-03-08) | — |
| **sentinel** | 320 | 4 | Secret regex patterns, OWASP patterns, framework checks, config protection | CVE severity scoring algorithm | — |
| **preflight** | 231 | 4 | Spec compliance, logic review (null-deref/missing-await/off-by-one), regression risk | Impact estimation methodology | — |
| **design** | 420 | 4 | 10 product categories, typography/color tokens, platform overrides (iOS/Android), anti-patterns | More CSS implementation examples | TJS: dense example format |
| **db** | 256 | 4 | Breaking change detection, migration per ORM, index analysis, parameterization scan | Data migration strategies (not just schema) | — |
| **onboard** | 295 | 4 | CLAUDE.md template, .rune/ init, DEVELOPER-GUIDE.md, L4 pack suggestions | Merge algorithm for existing CLAUDE.md | — |
| **deploy** | 174 | 4 | Platform auto-detect (Vercel/Netlify/Fly/Docker), pre-deploy gates, watchdog setup | Rollback playbook | — |
| **perf** | 297 | 4 | N+1, sync-in-async, memory leaks, bundle bloat, Lighthouse gates, Core Web Vitals | More framework-specific perf patterns | — |
| **autopsy** | 200 | 4 | 6-dimension health scoring, git archaeology, hotspots, dead code detection | Worked example of health score calculation | — |
| **safeguard** | 188 | 4 | Characterization tests, boundary markers, config freeze, git tag rollback | Characterization test writing patterns | — |
| **surgeon** | 203 | 4 | Strangler Fig/Branch by Abstraction/Expand-Migrate-Contract/Extract & Simplify, blast radius | Pattern selection decision tree | — |
| **audit** | 466 | 3.5 | 8-phase structure, framework checks, health score table, mesh analytics | Worked examples, mesh analytics specifics | — |
| **incident** | 234 | 3.5 | P1/P2/P3 severity, containment strategies, watchdog verification, timeline | Containment strategy decision rules | — |
| **review-intake** | 222 | 3.5 | ABSORB/COMPREHEND/VERIFY/EVALUATE/RESPOND, trust levels, pushback framework | "Restate in own words" template | — |
| **logic-guardian** | 240 | 3.5 | Logic manifest schema, pre-edit gate, post-edit validation, co-change groups | Auto-detection of logic-heavy files | — |
| **marketing** | 178 | 3 | Scout integration, trend-scout context, asset generation, video planning | Copy templates (hero, CTA, testimonial) | — |

## L3 Utilities (21 skills)

| Skill | Lines | Depth | Has | Missing | Enrich From |
|-------|-------|-------|-----|---------|-------------|
| **problem-solver** | ~230 | ⭐5+ | 10 frameworks: 5 Whys, Fishbone, First Principles, SCAMPER, Impact Matrix + Collision-Zone, Inversion, Meta-Pattern, Simplification Cascades, Scale Game | — (enriched 2026-03-08) | — |
| **sequential-thinking** | 175 | ⭐5 | Dependency mapping, constraint resolution, ordered evaluation, running state | — | — |
| **hallucination-guard** | 204 | ⭐5 | Import extraction, registry check, edit distance for typosquatting, slopsquatting | — | — |
| **completion-gate** | 151 | ⭐5 | Claim extraction, evidence matching, verdict table, stale evidence detection | — | — |
| **constraint-check** | 165 | ⭐5 | HARD-GATE audit, temporal checks, violation classification | — | — |
| **integrity-check** | 169 | ⭐5 | Zero-width Unicode, HTML comments, base64, prompt injection patterns | — | — |
| **session-bridge** | 269 | ⭐5 | Save/Load dual mode, integrity verification, adversarial defense | — | — |
| **research** | 122 | 4 | Query→Search→DeepDive→Synthesize→Report, confidence scoring | Source authority weighting algorithm | — |
| **docs-seeker** | ~175 | 4.5 | Context7 MCP → llms.txt discovery (URL patterns, topic params) → WebSearch → repomix fallback, parallel agent distribution | — (enriched 2026-03-08) | — |
| **trend-scout** | 145 | 4 | Scope→Search→Competitor→Sentiment→Report, query patterns | — | — |
| **verification** | 201 | 4 | 5-language support, Evidence-Before-Claims HARD-GATE, TodoWrite integration | — | — |
| **sast** | 190 | 4 | 6-language tool commands, semgrep integration, severity normalization | — | — |
| **context-engine** | 176 | 4 | GREEN/YELLOW/ORANGE/RED thresholds, large-file adjustment | Worked example of compaction decision | — |
| **journal** | 185 | 4 | ADR template, RESCUE-STATE, module-status, dependency graph | Session lifecycle example | — |
| **worktree** | 140 | 4 | Git worktree lifecycle, rune/* branch naming, safety rules | — | — |
| **watchdog** | 166 | 4 | HTTP checks, response time analysis, error detection, smoke test | Baseline comparison methodology | — |
| **scope-guard** | 150 | 4 | Plan→Diff→Classify, IN_SCOPE/OUT_OF_SCOPE rules, test exception | — | — |
| **browser-pilot** | 165 | 4 | Playwright MCP, 20-interaction limit, try-finally cleanup | — | — |
| **asset-creator** | 157 | 4 | SVG/HTML/CSS output, dark/light variants, design token integration | — | — |
| **video-creator** | 201 | 4 | Script structure, storyboard, shot list, platform constraints | — | — |
| **dependency-doctor** | 235 | 4 | 6 package managers, health score formula, breaking change awareness | — | — |

## Enrichment Backlog

Priority ordered by: frequency of use × gap size × available source quality.

| # | Target Skill | Gap | Source | Expected Impact | Status |
|---|-------------|-----|--------|-----------------|--------|
| 1 | debug | Backward tracing, multi-component instrumentation, red flags | CK: root-cause-tracing, systematic-debugging | High — most used skill | ✅ Done 2026-03-08 |
| 2 | brainstorm | 3 breakthrough frameworks (Collision-Zone, Inversion, Scale Game) | CK: collision-zone-thinking, inversion-exercise, scale-game | High — ideation quality | ✅ Done 2026-03-08 |
| 3 | problem-solver | 5 additional reasoning frameworks | CK: all 5 problem-solving sub-skills | Medium — already depth 5 | ✅ Done 2026-03-08 |
| 4 | fix | Post-fix hardening (4-layer defense-in-depth) | CK: defense-in-depth | Medium — common confusion point | ✅ Done 2026-03-08 |
| 5 | docs-seeker | llms.txt discovery, repomix, parallel agents | CK: docs-seeker | Medium — modern docs pattern | ✅ Done 2026-03-08 |
| 6 | marketing | Copy templates (hero, features, CTA) | CK: aesthetic, general copywriting | Medium — currently most shallow L2 |
| 7 | surgeon | Pattern selection decision tree | CK: (none — Rune-original) | Medium — needs internal development |
| 8 | design | Dense CSS implementation examples | TJS: example density format | Low — already 420 lines |
| 9 | incident | Containment strategy decision rules | CK: (none) | Low — less frequent use |
| 10 | launch | Rollback playbook | CK: (none) | Low — less frequent use |

Legend: CK = claudekit-skills, TJS = threejs-skills

## Cycle Log

Track enrichment history per skill.

| Date | Skill | Source | What Added | Depth Before → After |
|------|-------|--------|------------|---------------------|
| 2026-03-08 | debug | CK: root-cause-tracing, systematic-debugging | Backward tracing technique (5-step), multi-component boundary instrumentation, red flags thinking patterns, 2 new constraints | ⭐5 → ⭐5+ |
| 2026-03-08 | fix | CK: defense-in-depth | Post-fix hardening step (4-layer validation: Entry→Business→Environment→Debug), 2 new sharp edges | 4 → 4.5 |
| 2026-03-08 | brainstorm | CK: collision-zone, inversion, scale-game | 3 breakthrough frameworks added to framework section + evaluation step | 4 → 4.5 |
| 2026-03-08 | problem-solver | CK: collision-zone, inversion, meta-pattern, simplification-cascades, scale-game | 5 new frameworks in selection table + Step 3 execution details + 3 new sharp edges | ⭐5 → ⭐5+ |
| 2026-03-08 | docs-seeker | CK: docs-seeker (llms.txt) | llms.txt discovery (context7 URL patterns, topic params), repomix fallback, parallel agent distribution, new sharp edge | 4 → 4.5 |
| 2026-03-08 | test | — | Assessed — already depth 5, CK verification-before-completion covered by completion-gate | ⭐5 (no change) |

---

*This document is the single source of truth for skill depth tracking across sessions.*
