# skill-forge — Examples phase

> Reference for `skills/skill-forge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

### Phase 6.25 — EXAMPLES (output-format skills only)

Output-format skills (skills that produce visual or text artifacts a human will see) SHOULD ship a literal example of the output alongside SKILL.md. The example is a target the agent can copy from — not a description it must interpret.

**Applies to:**
- `design`, `asset-creator`, `slides`, `marketing`, `video-creator`, `doc-processor`
- Any pack skill whose primary output is a rendered artifact (HTML page, slide deck, social card, video script, report PDF)

**Does not apply to:**
- Process / orchestration skills (`cook`, `plan`, `review`) — their output is structural, not rendered
- Diagnostic skills (`debug`, `audit`, `perf`) — their output is findings, not artifacts

**Convention:**

```
skills/<name>/
├── SKILL.md
├── references/
│   └── ...
└── examples/
    ├── README.md           # short index: which example fits which scenario
    ├── <scenario-1>.html   # or .md / .json / .svg per skill domain
    ├── <scenario-2>.html
    └── ...
```

**Why a literal example beats a description:**
- An agent can copy structure, density, and rhythm from a real file. It cannot copy them from "make it modern."
- A reviewer can diff agent output against the example to spot drift.
- Examples are the test corpus for the skill — if a new style emerges, the example shows whether SKILL.md kept up.

**Quality bar:**
- Each example MUST render without error in the target environment (browser, Marp, Notion, etc.)
- Each example MUST use real-looking data, not lorem ipsum (mirrors design Step 2.9 Rule 5)
- Cover at least 2 scenarios per skill — minimum spread reveals which decisions are baked in vs which are scenario-driven

**Soft, not HARD-GATE:** Per Rune's no-discipline-heavy-grafts policy, don't enforce as a ship blocker. A new skill without examples ships fine; reviewers may suggest adding them. Existing output-format skills are encouraged (not required) to backfill examples on the next material edit.

**Inspiration:** Pattern adapted from `nexu-io/html-anything` (Apache-2.0), where every "surface skill" ships a hand-authored `example.html` so the agent has a copy target. They make it a ship blocker; we make it a strong recommendation.
