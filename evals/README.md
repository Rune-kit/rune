# Skill Behavior Evals

Structural validation (`validate-skills.js`) proves a SKILL.md is well-formed.
It cannot prove the skill makes an agent **behave correctly**. These evals can.

Each case runs a **fresh headless agent** whose only instruction source is the
skill's SKILL.md, against a fixture repo with known traps, and asserts the
outcome — the same way the v2.21.0 dogfood run caught spec ambiguities that
1,565 structural tests could not.

## Layout

```
evals/
  <skill>/
    <case>/
      fixture/        ← a small repo the agent operates on
      expected.json   ← assertions
```

`expected.json` fields:

| Field | Meaning |
|-------|---------|
| `must` | markers that MUST appear in the agent transcript (verdicts, signals, task IDs) |
| `mustNot` | markers that MUST NOT appear (wrong signal, phantom tasks) |
| `fileUntouched` | relative path that must be byte-identical after the run (append-only / no-write contracts) |
| `appendsTo` | relative path where the skill is expected to append a section |

**Marker syntax**: plain string = exact substring; `re:<pattern>` = case-insensitive regex.
Agents PARAPHRASE prose findings — use `re:` with tolerant gaps (`re:dead.{0,3}interactive`)
for finding labels, exact strings only for machine tokens (signal names, `CV-1.1`, `UNWIRED-INTERACTIVE`).
For mustNot on prose, couple the phrase with its verdict in both orders
(`re:BLOCK.{0,80}dead.{0,3}interactive`) so "no dead interactives found" prose can't false-fail.
Failed cases preserve `_transcript.txt` in the temp fixture dir — always read it before
deciding whether the SKILL is wrong or your MARKER is wrong (first preflight run: skill
behaved perfectly, marker demanded the literal template string).

## Running

**Not part of `npm run ci`** — every case is a full agent run (tokens + minutes).
Requires the `claude` CLI on PATH.

```bash
npm run eval                       # all cases
npm run eval -- converge           # one skill
npm run eval -- converge/clean-pass  # one case
node scripts/run-evals.js --list   # list cases without running
```

Failed cases preserve their temp fixture dir for post-mortem (path printed).

## When to run

- After ANY edit to an evaled skill's SKILL.md (the skill text IS the implementation)
- Before a release that touches L3 verification-family skills
- When adding a case: seed it from a real failure, never from imagination —
  `converge/dead-button` is the v2.21.0 dogfood fixture, verbatim

## Current cases

| Case | Traps | Type |
|------|-------|------|
| `converge/dead-button` | P1 submit → route absent (plan claims done); declared-debt icon; unrequested export button; navigation anchor bait | detection |
| `converge/clean-pass` | Same repo fully wired — must emit clean, write nothing, not block on declared debt | clean + no-write |
| `verification/dead-button` | Same fixture through Level 3.5 — dead submit + handler-less button must FAIL, GET chain and anchor must pass | detection |
| `verification/svelte-wired` | Fully wired Svelte (`on:submit\|preventDefault`, `on:click`, prop-origin callback) — must NOT false-positive | **regression** (Phase-3 review BLOCK: React-only syntax) |
| `verification/vue-wired` | Fully wired Vue 3 (`@submit.prevent`, `@click`, `defineProps` callback) — must NOT false-positive | **regression** |
| `preflight/dead-button` | Dead interactive must fire AND survive Step 6 verdict aggregation as overall BLOCK | **regression** (Phase-3 review BLOCK: Step 6 downgraded to WARN) |
| `preflight/svelte-wired` | Wired Svelte diff — no dead-interactive BLOCK on framework syntax; WARNs allowed | **regression** |

## Adding cases for other skills

The runner is skill-agnostic: it reads `skills/<skill>/SKILL.md` from the eval
path. Next candidate: `completion-gate` (mandatory-trigger matrix — UI+data
diff / Key Entities / interaction keywords). Note its input includes agent
CLAIMS, not just a diff — the fixture needs a claims transcript file, which
needs runner design first (a `claims.md` the prompt injects).
