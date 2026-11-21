# review — Falsification and anchor passes

> Reference for `skills/review/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Falsification Pass (run before writing the report)

**Falsify, not verify.** Do not ask "am I confident enough to report this?" — a model cannot calibrate its own confidence to a number, so that question filters nothing and quietly drops true findings. Ask the answerable question instead: **"did I read something that disproves this?"**

| | Condition | Action |
|---|---|---|
| **DROP** | The code you read contains **direct counter-evidence** against the finding's key claim — the null check exists three lines up, the `await` is there, the input is validated by the caller you opened | Discard it |
| **KEEP** | The finding depends on context **outside the diff** that you did read via tools — that context is evidence, not a disqualification | Report it |
| **KEEP** | You can neither verify nor disprove it | Report it, typed honestly (below) |

**"Unsure" is not grounds to drop.** Only counter-evidence is. A finding you could not confirm is still a finding — it is reported at the severity its claim type allows, not deleted to keep the report tidy.

Dropped findings are **discarded silently** — never listed as "considered and dismissed". A disproven finding is noise whether or not you label it as such.

**Type every surviving finding** with a claim type from `../completion-gate/references/claim-discipline.md`:

| Type | Means | Ceiling |
|------|-------|---------|
| `OBSERVED` | You read the code path this session and saw the defect | Any severity |
| `DERIVED` | Follows from what you read through a mechanism you can state in the finding | Any severity |
| `ASSUMED` | Requires an unverified premise (a caller you did not open, a runtime condition you cannot see) | **Never CRITICAL** — state the premise in the finding |

An `ASSUMED` finding capped below CRITICAL is the honest form of "this looks wrong but I could not confirm the call path". Promotion happens by reading the code, never by rephrasing the finding more confidently.

#### Anchor Pass (run per surviving finding)

Resolve every line number now, with a tool. Climb the ladder and stop at the first rung that hits:

1. `Grep` the exact `evidence` string in `path`. A hit → the finding is **anchored**; use the line number `Grep` returned.
2. No hit → retry once with whitespace normalised (collapse runs of spaces) and the first and last lines of the snippet dropped. A hit → anchored on the remaining core.
3. Still no hit → the finding is **`UNANCHORED`**.

**`UNANCHORED` handling** — advisory, never blocking:

- Downgrade severity by one level: CRITICAL → HIGH → MEDIUM → LOW. LOW stays LOW.
- Report as `path (unanchored)` in place of `path:line`, with the evidence snippet shown inline
- **Never silently drop it.** A failed anchor means the snippet does not match the file as you recorded it — usually a transcription slip, occasionally a file that moved while you read. Both deserve the reader's attention; neither is counter-evidence, so neither disproves the finding.

Anchoring resolves a finding; it does not filter one. Only the Falsification Pass drops findings — a survivor of that pass always reaches the report, anchored or not.

**Then, before reporting:**
- Consolidate similar issues: "8 functions missing error handling in src/services/" — not 8 separate findings
- Skip stylistic preferences unless they violate conventions found in `.eslintrc`, `CLAUDE.md`, or `CONTRIBUTING.md`
- Adapt to project type: a `console.log` in a CLI tool is fine; in a production API handler it is not

- Group findings by severity: CRITICAL → HIGH → MEDIUM → LOW
- Give every finding its `path:line` from the Anchor Pass — or `path (unanchored)` — plus the evidence block underneath
- Include a Positive Notes section (good patterns observed)
- Include a Verdict: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION
