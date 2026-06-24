# Reasoning Modes — 5 Lenses for Challenging a Plan

adversary's 5 **dimensions** (edge cases, security, scalability, error propagation,
integration) answer *what* to attack. These 5 **reasoning modes** answer *how* to
attack — the cognitive lens you bring to each dimension. They are orthogonal: any
dimension can be examined through any lens, and the right lens depends on the plan's
shape and the kind of weakness most likely to hide in it.

Default lens is **Red Team** (adversary's native mode). Escalate or switch when the
signals below fire. You do not need user input to pick a lens — infer it from the plan
and the dimension, state which lens you applied, and move on.

## The 5 Modes

| Mode | Core question | Best for | Output shape |
|------|---------------|----------|--------------|
| **Red Team** | "If someone wanted to break, exploit, or game this, how?" | Security, abuse, perverse incentives, business-logic loopholes | Adversary persona → attack vector → defense (the *persona framing*, distinct from oracle-mode's cross-model second-opinion dispatch and from Step 2's attack-surface inventory — Red Team supplies the WHO, Step 2 the WHERE) |
| **Pre-mortem** | "It's 6 months out and this failed. Why?" | Architecture, infra, migrations, anything with cascading failure | Specific failure narrative → consequence chain → early-warning sign → mitigation |
| **Evidence Audit** | "Does the evidence actually support this claim?" | Plans justified by benchmarks, "X is faster", capacity assumptions | Extracted claim → falsification criterion → evidence-quality verdict |
| **Dialectic** | "What's the strongest case for the opposite choice?" | Technology/architecture decisions, "we chose X over Y" | Steelmanned thesis → strongest antithesis → synthesis (a better plan) |
| **Socratic** | "What is this plan taking for granted?" | Vague scope, consensus-driven plans, unexamined "obviously" | Probing questions grouped by theme — surfaces hidden assumptions |

## Picking the lens (signal → mode)

| Signal in the plan | Switch to |
|--------------------|-----------|
| Auth / payment / user-data / multi-tenant / public input | **Red Team** |
| DB migration, service mesh, infra change, "at scale it will…" | **Pre-mortem** |
| "benchmarks show", "X is faster", "this saves N hours", capacity numbers | **Evidence Audit** |
| "we picked X over Y", framework/vendor choice, one-way-door decision | **Dialectic** |
| Vague terms ("scalable", "real-time", "robust"), "everyone agrees", thin spec | **Socratic** |

Domain defaults when no single signal dominates: Security → Red Team · Infra/Architecture
→ Pre-mortem · Data/Analytics → Evidence Audit · Business/strategy → Dialectic ·
Product/UX → Socratic.

## Steelman First (applies to every mode)

Before challenging, restate the plan's core thesis in its **strongest** form. An
adversary that attacks a weak paraphrase of the plan produces findings the author can
dismiss ("that's not what I meant"). Steelmanning earns the right to challenge.

1. **Strip weak framing** — reduce the plan to its core claim ("microservices" →
   "independent deploy + scale of components accelerates 4 teams on different release cycles").
2. **Supply the strongest evidence** the plan implied but didn't state.
3. **Name what's genuinely good** — this becomes the Strength Notes section.
4. Then attack *that* version. If your challenge only lands against a weaker reading,
   it isn't a finding.

Checklist: Have I made the position stronger, not weaker? Would the author recognize
this as their view (or better)? Am I attacking this version, not an easier one?

## Mode mechanics (just enough to apply)

**Red Team** — Build a *specific* adversary persona (role, motivation, capability,
access, constraints), not a generic "attacker". Specific personas → actionable vectors.
E-commerce → fraudster (coupon abuse, fake returns); SaaS → free-tier abuser
(multi-accounting, rate-limit evasion); API → scraper. Map each persona's vector to the
plan's entry points, rank by likelihood × impact, propose a concrete defense.

**Pre-mortem** — Assume failure as the starting point (bypasses optimism bias). A
narrative must be specific: a named trigger, a number/threshold, the chain of events,
who's affected, and the underlying wrong assumption. "It didn't scale" is not a
narrative; "at 50K concurrent users the connection pool exhausted, cascading timeouts
tripped the circuit breaker, rejecting all requests for 4 min at peak" is. Trace ≥2
orders of consequence. Identify the early-warning sign — the thing you'd see *before*
the failure.

**Evidence Audit** — Extract the plan's claims (causal / predictive / comparative /
quantitative — often implicit). For each, write the falsification criterion: what
observation would prove it false? Then judge evidence quality (pilot vs production,
sample representativeness, correlation vs causation) and surface competing explanations.
"Migrating to K8s cuts deploy time 60%" hides three claims: pilot is representative, K8s
is the *cause*, 60% persists at scale. Audit each.

**Dialectic** — Build the antithesis by asking "if a smart, informed person disagreed,
what's their best argument?" Sources: opposing trade-off, hidden cost, an alternative
that solves the same problem cheaper ("modular monolith gets 80% at 20% cost"),
precedent ("Company X reverted after 2 years"), an unserved stakeholder. Don't stop at
the clash — drive to **synthesis**: a revised plan incorporating the best of both. This
maps directly to adversary's HARDEN verdict.

**Socratic** — Ask, don't argue. Categories: definitional ("when you say 'scalable', 10x
or 1000x?"), evidential ("what data shows users want this?"), logical ("does caching
*necessarily* improve UX?"), perspective-shifting ("how would the on-call engineer see
this architecture?"), consequential ("what does this look like in 2 years?"). Each good
question creates an "I hadn't thought about that" — surfaced assumptions become findings.

## Sequencing (optional)

Some plans benefit from two lenses in order: Dialectic → Pre-mortem (decide the
approach, then stress its failure modes); Evidence Audit → Socratic (test the claims,
then probe what's still assumed); Red Team → Pre-mortem (find the exploit, then trace
its blast radius). Don't run more than two — adversary's job is a sharp report, not an
exhaustive philosophy seminar.
