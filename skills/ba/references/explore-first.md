# Explore-First Gate

The explore-first rule: **never ask the user a question whose answer is in the codebase, the user's message, or the project metadata.** Every question burns user attention; an inferable question burns it for nothing.

This is enforced as a HARD-GATE at Step 2.0 of `ba`, before any of the 5 elicitation questions are emitted.

## The 4-item pre-check

For each question the agent intends to ask, walk through this checklist:

1. **Is the answer in `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `pom.xml`?**
   - Stack, framework, language version, dependencies, scripts → all live here.
2. **Is the answer in `README.md` or `CLAUDE.md` or `docs/`?**
   - Project description, target audience, conventions, deploy process.
3. **Is it inferable from file extensions, directory structure, or config files?**
   - `.tsx` files → React frontend. `Dockerfile` → containerized deploy. `.github/workflows/*` → CI exists.
4. **Has the user answered it earlier in this conversation?**
   - Read back through the conversation; cached answers are reusable.

If ANY of the 4 checks would yield the answer, the question is inferable. **Don't ask it.** Read the source, infer, and proceed.

## Tool-call evidence requirement (HARD-GATE)

For every question Q the agent emits, there MUST be prior tool-call evidence in the same session:

- At least 1 `Read`, `Glob`, or `Grep` related to Q's domain, OR
- An explicit declaration: *"Q cannot be answered from project artifacts because [specific reason]."*

Without one of these, Q is BLOCKED. The receiving validator (preflight, completion-gate) checks the tool-call log for evidence before allowing the question to count toward the 5-question budget.

This prevents lazy questioning. The gate is "tried to infer" — not "must succeed in inferring." If the file simply doesn't have the answer, that's fine; the attempt is the gate.

## Worked examples

### ❌ Wrong — skips inference

User: "I want to add a payment integration."

Agent: "What language and framework are you using?"

Failure: `package.json` (or equivalent) answers this. No grep needed.

### ✅ Right — infers first

User: "I want to add a payment integration."

Agent: *(reads `package.json` — sees `"react": "^18"`, `"next": "^14"`)*
Agent: "I see you're on Next.js 14 with React 18. For the payment integration, are you targeting Stripe, PayPal, or something else?"

The first question is now non-trivial — it's the question only the user can answer.

### ❌ Wrong — re-asks cached answer

Earlier in the session: User said "the deadline is end of Q2."

Agent (later): "What's the timeline for this?"

Failure: cached answer exists. Re-asking is redundant.

### ✅ Right — uses cached answer

Agent: "Given the Q2 deadline you mentioned, [follow-up question that builds on it]."

### ❌ Wrong — asks shape questions for inferable values

User: "Build me a CLI tool that..."

Agent: "Are you using TypeScript or JavaScript?"

Failure: check `tsconfig.json` and `package.json`'s `type: "module"`. Or check existing files' extensions.

### ✅ Right — narrow to genuine unknowns

Agent: *(checks tsconfig + sample file)*
Agent: "I see you're on TypeScript with strict mode. For the CLI tool, are you targeting Node 20+ or do we need to support older runtimes?"

## What questions ARE worth asking

Questions that survive the explore-first filter typically:

- **Reveal user intent** that's not in the code ("what's the success metric for this feature?")
- **Choose between credible alternatives** the code doesn't disambiguate ("auth: JWT vs session cookies?")
- **Set scope** that the user hasn't yet bounded ("should this also handle anonymous users?")
- **Capture domain expertise** the codebase doesn't encode ("when an Order is cancelled, do we refund automatically or wait for review?")

These are the high-leverage questions. Aim for 5 of them, not 5 of "what stack are you using?"

## Caching results

When explore-first finds an inferable answer, record it in the requirements doc as a cached fact:

```
**Inferred from package.json**: TypeScript 5.4, Next.js 14.2, React 18.3
**Inferred from .github/workflows/**: CI runs on PRs targeting main
**Inferred from CLAUDE.md**: Strict TypeScript, no `any`, semantic commits
```

Future BA sessions reuse these without re-running grep.

## When the rule relaxes

Two narrow exceptions:

1. **Stack/conventions are not yet in the repo** (greenfield, brand-new project) — explore-first finds nothing, so questions are necessary. Note "no project metadata available" in the question rationale.
2. **User explicitly asked a redundant question themselves** — sometimes the user wants confirmation. "Yes, you're on TypeScript — the `tsconfig.json` confirms it. Anything else to verify?"

Otherwise, the rule applies. Burn no user attention on questions agents can answer alone.
