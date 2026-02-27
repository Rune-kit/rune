---
name: skill-router
description: Meta-enforcement layer that routes every agent action through the correct skill. Prevents rationalization, enforces check-before-act discipline.
metadata:
  author: runedev
  version: "1.0.0"
  layer: L0
  model: haiku
  group: orchestrator
---

# skill-router

## Purpose

The missing enforcement layer for Rune. While individual skills have HARD-GATEs and constraints, nothing forces the agent to *check* for the right skill before acting. `skill-router` fixes this by intercepting every user request and routing it through the correct skill(s) before any code is written, any file is read, or any clarifying question is asked.

This is L0 — it sits above L1 orchestrators. It doesn't do work itself; it ensures the right skill does the work.

## Triggers

- **ALWAYS** — This skill is conceptually active on every user message
- Loaded via system prompt or plugin description, not invoked manually
- The agent MUST internalize this routing table and apply it before every response

## Calls (outbound connections)

- Any skill (L1-L3): routes to the correct skill based on intent detection

## Called By (inbound connections)

- None — this is the entry point. Nothing calls skill-router; it IS the first check.

## Workflow

### Step 0 — Check Routing Overrides (H3 Adaptive Routing)

Before standard routing, check if adaptive routing rules exist:

1. Use `Read` on `.rune/metrics/routing-overrides.json`
2. If the file exists and has active rules, scan each rule's `condition` against the current user intent
3. If a rule matches:
   - Apply the override action (e.g., "route to problem-solver before debug")
   - Log: "Adaptive routing: applying rule [id] — [action]"
4. If no file exists or no rules match, proceed to standard routing (Step 1)

**Override constraints**:
- Overrides MUST NOT bypass layer discipline (L3 cannot call L1)
- Overrides MUST NOT skip quality gates (sentinel, preflight, verification)
- Overrides MUST NOT route to non-existent skills
- If an override seems wrong, announce it and let user decide to keep or disable

### Step 0.5 — STOP before responding

Before generating ANY response (including clarifying questions), the agent MUST:

1. **Classify the user's intent** using the routing table below
2. **Identify which skill(s) match** — if even 1% chance a skill applies, invoke it
3. **Invoke the skill** via the Skill tool
4. **Follow the skill's instructions** — the skill dictates the workflow, not the agent

### Step 1 — Intent Classification (Progressive Disclosure)

Skills are organized into 3 tiers for discoverability. **Tier 1 skills handle 90% of user requests.**

#### Tier 1 — Primary Entry Points (User-Facing)

These 5 skills are the main interface. Most user intents route here first:

| User Intent | Route To | When |
|---|---|---|
| Build / implement / add feature / fix bug | `rune:cook` | Any code change request |
| Large multi-part task / parallel work | `rune:team` | 5+ files or 3+ modules |
| Deploy + launch + marketing | `rune:launch` | Ship to production |
| Legacy code / rescue / modernize | `rune:rescue` | Old/messy codebase |
| Check project health / full audit | `rune:audit` | Quality assessment |

**Default route**: If unclear, route to `rune:cook`. Cook handles 70% of all requests.

#### Tier 2 — Power User Skills (Direct Invocation)

For users who know exactly what they want:

| User Intent | Route To | Priority |
|---|---|---|
| Plan / design / architect | `rune:plan` | L2 — requires opus |
| Brainstorm / explore ideas | `rune:brainstorm` | L2 — before plan |
| Review code / check quality | `rune:review` | L2 |
| Write tests | `rune:test` | L2 — TDD |
| Refactor | `rune:surgeon` | L2 — incremental |
| Deploy (without marketing) | `rune:deploy` | L2 |
| Security concern | `rune:sentinel` | L2 — opus for critical |
| Performance issue | `rune:perf` | L2 |
| Database change | `rune:db` | L2 |
| Received code review / PR feedback | `rune:review-intake` | L2 |
| Create / edit a Rune skill | `rune:skill-forge` | L2 — requires opus |
| Incident / outage | `rune:incident` | L2 |
| UI/UX design | `rune:design` | L2 |
| Fix bug / debug only (no fix) | `rune:debug` → `rune:fix` | L2 chain |
| Marketing assets only | `rune:marketing` | L2 |

#### Tier 3 — Internal Skills (Called by Other Skills)

These are rarely invoked directly — they're called by Tier 1/2 skills:

| Skill | Called By | Purpose |
|---|---|---|
| `rune:scout` | cook, plan, team | Codebase scanning |
| `rune:fix` | debug, cook | Apply code changes |
| `rune:preflight` | cook | Quality gate |
| `rune:verification` | cook, fix | Run lint/test/build |
| `rune:hallucination-guard` | cook, fix | Verify imports |
| `rune:completion-gate` | cook | Validate claims |
| `rune:research` / `rune:docs-seeker` | any | Look up docs |
| `rune:session-bridge` | cook, team | Save context |
| "Done" / "ship it" / "xong" | — | `rune:verification` → commit |

#### Tier 4 — Domain Extension Packs (L4)

When user intent matches a domain-specific pattern or user explicitly invokes an L4 trigger command, route to the L4 pack. The agent reads the pack's PACK.md and follows the matching skill's workflow.

| User Intent / Domain Signal | Route To | Pack File |
|---|---|---|
| Frontend UI, design system, a11y, animation | `@rune/ui` | `extensions/ui/PACK.md` |
| API design, auth, middleware, rate limiting | `@rune/backend` | `extensions/backend/PACK.md` |
| Docker, CI/CD, monitoring, server setup | `@rune/devops` | `extensions/devops/PACK.md` |
| React Native, Flutter, mobile app, app store | `@rune/mobile` | `extensions/mobile/PACK.md` |
| OWASP, pentest, secrets, compliance | `@rune/security` | `extensions/security/PACK.md` |
| Trading, fintech, charts, market data | `@rune/trading` | `extensions/trading/PACK.md` |
| Multi-tenant, billing, SaaS subscription | `@rune/saas` | `extensions/saas/PACK.md` |
| Shopify, payments, cart, inventory | `@rune/ecommerce` | `extensions/ecommerce/PACK.md` |
| LLM, RAG, embeddings, fine-tuning | `@rune/ai-ml` | `extensions/ai-ml/PACK.md` |
| Three.js, WebGL, game loop, physics | `@rune/gamedev` | `extensions/gamedev/PACK.md` |
| Blog, CMS, MDX, i18n, SEO | `@rune/content` | `extensions/content/PACK.md` |
| Analytics, A/B testing, funnels, dashboards | `@rune/analytics` | `extensions/analytics/PACK.md` |

**L4 routing rules:**
1. If user explicitly invokes an L4 trigger (e.g., `/rune rag-patterns`), read the PACK.md and follow the skill workflow directly
2. If the intent also involves implementation, route to `cook` (L1) first — cook will detect L4 context in Phase 1.5
3. L4 packs supplement L1/L2 workflows — they are domain knowledge, not standalone orchestrators
4. L4 packs can call L3 utilities (scout, verification) but CANNOT call L1 or L2 skills
5. If the L4 pack file is not found on disk, skip silently and proceed with standard routing

### Step 2 — Compound Intent Resolution

Many requests combine intents. Route to the HIGHEST-PRIORITY skill first:

```
Priority: L1 > L2 > L3
Within same layer: process skills > implementation skills

Example: "Add auth and deploy it"
  → rune:cook (add auth) FIRST
  → rune:deploy SECOND (after cook completes)

Example: "Fix the login bug and add tests"
  → rune:debug (diagnose) FIRST
  → rune:fix (apply fix) SECOND
  → rune:test (add tests) THIRD

L4 integration: If cook is the primary route AND a domain pack matches,
cook handles orchestration while the L4 pack provides domain patterns.
Both are active — cook for workflow, L4 for domain knowledge.
```

### Step 3 — Anti-Rationalization Gate

The agent MUST NOT bypass routing with these excuses:

| Thought | Reality | Action |
|---|---|---|
| "This is too simple for a skill" | Simple tasks still benefit from structure | Route it |
| "I already know how to do this" | Skills have constraints you'll miss | Route it |
| "Let me just read the file first" | Skills tell you HOW to read | Route first |
| "I need more context before routing" | Route first, skill will gather context | Route it |
| "The user just wants a quick answer" | Quick answers can still be wrong | Check routing table |
| "No skill matches exactly" | Pick closest match, or use scout + plan | Route it |
| "I'll apply the skill patterns mentally" | Mental application misses constraints | Actually invoke it |
| "This is just a follow-up" | Follow-ups can change intent | Re-check routing |

### Step 4 — Execute

Once routed:
1. Announce: "Using `rune:<skill>` to [purpose]"
2. Invoke the skill via Skill tool
3. Follow the skill's workflow exactly
4. If the skill has a checklist/phases, track via TodoWrite

## Routing Exceptions

These DO NOT need skill routing:
- Pure conversational responses ("hello", "thanks")
- Answering questions about Rune itself (meta-questions)
- Single-line factual answers with no code impact
- Resuming an already-active skill workflow

## Output Format

```
## Routing Decision
- **Intent**: [classified user intent]
- **Skill**: rune:[skill-name]
- **Confidence**: HIGH | MEDIUM | LOW
- **Override**: [routing override applied, if any]
- **Reason**: [one-line justification for skill selection]
```

For multi-skill chains:
```
## Routing Chain
1. rune:[skill-1] — [purpose]
2. rune:[skill-2] — [purpose]
3. rune:[skill-3] — [purpose]
```

## Constraints

1. MUST check routing table before EVERY response that involves code, files, or technical decisions
2. MUST invoke skill via Skill tool — "mentally applying" a skill is NOT acceptable
3. MUST NOT write code without routing through at least one skill first
4. MUST NOT skip routing because "it's faster" — speed without correctness wastes more time
5. MUST re-route on intent change — if user shifts from "plan" to "implement", switch skills
6. MUST announce which skill is being used and why — transparency builds trust
7. MUST follow skill's internal workflow, not override it with own judgment

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Agent writes code without invoking any skill | CRITICAL | Constraint 3: code REQUIRES skill routing. No exceptions. |
| Agent "mentally applies" skill without invoking | HIGH | Constraint 2: must use Skill tool for full content |
| Routes to wrong skill, wastes a full workflow | MEDIUM | Step 2 compound resolution + re-route on mismatch |
| Over-routing trivial tasks (e.g., "what time is it") | LOW | Routing Exceptions section covers non-technical queries |
| Skill invocation adds latency to simple tasks | LOW | Acceptable trade-off: correctness > speed |

## Done When

- This skill is never "done" — it's a persistent routing layer
- Success = every agent response passes through routing check
- Failure = any code written without skill invocation

## Cost Profile

~0 tokens (routing logic is internalized from this document). Cost comes from the skills it routes to, not from skill-router itself. The routing table is loaded once and cached in context.
