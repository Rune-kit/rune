# Output Modes

Rune has more than one opinion about how a response should be shaped, and they do not agree.
This file is the layer that holds them: the registry of modes, the shared activation
contract, and — the part that actually matters — the precedence rule for when two active
modes want opposite things.

## The registry

| Mode | Optimizes for | Reference | Default |
|------|---------------|-----------|---------|
| `caveman` | Token economy — strip filler, articles, pleasantries | `caveman-mode.md` | off; auto-on at ORANGE/RED context |
| `actionable` | Legibility — next action first, numbered steps, state restated | `actionable-mode.md` | off; user-invoked |
| (none) | Default runtime voice | — | on |

Modes stack. `caveman` + `actionable` together is a normal combination: terse *and*
action-first. They are not alternatives to each other, which is exactly why they need a
precedence rule.

## Precedence (the rule that resolves conflicts)

Applied top-down. A higher rule wins outright; it is never traded off against a lower one.

1. **Calibration outranks every style.** A style may compress prose. It may never move a
   claim into a stronger grammar than its evidence supports. If compressing "I am assuming
   the migration ran" into "the migration ran" saves four tokens, the four tokens lose.
   See `completion-gate` → `references/claim-discipline.md`.
2. **Evidence outranks brevity.** Reporting what was run and what it returned is not a
   "recap" and is not filler — `verification`, `preflight` and `completion-gate` exist on
   that evidence. A style may tighten how it is written, never whether it appears.
3. **A skill's `## Output Format` outranks every style.** Most skills define the sections
   their report must carry. A style shapes the prose *inside* those sections; it never
   drops a section, a finding, or an item from a ranked list. A review with twelve findings
   reports twelve.
4. **Safety outranks all shaping.** Destructive-action confirmations, security warnings and
   irreversible-step callouts revert to full prose for that response, in every mode. Both
   mode references already carry this exception; it is restated here because it is the one
   people cut first.
5. **Actionability outranks economy.** When `caveman` and `actionable` are both on, the
   numbered steps and the closing next-action survive; the prose around them is what gets
   compressed.

The general form: **shape is negotiable, substance is not.** Every rule above is one
instance of it. When a new mode is added, it inherits this list rather than restating it.

## Shared activation contract

Every mode follows the same lifecycle, so users learn it once:

| | Behaviour |
|---|---|
| Activate | Explicit user signal (`caveman`, `adhd mode`, `be brief`, `actionable`), or an automatic trigger the mode declares |
| Persist | Every response until explicitly released. **No drift back mid-session** — if unsure whether a mode is still on, it is |
| Release | `stop <mode>` or `normal mode`. Confirm in one line, then revert |
| Auto-release | Only where the mode declares one (e.g. `caveman` releases when context returns to GREEN) |
| Manual override | Always wins over an automatic trigger, in both directions |

State lives in the session, not on disk. A mode does not survive a new session unless the
user re-invokes it — deliberately, so a forgotten style never silently shapes a fresh
session's output.

## Adding a mode

A new mode earns a file here only if it changes *shape*, applies across every response, and
is orthogonal to the ones already listed. If it changes *what work happens* it is a
behavioural context (`contexts/*.md`), not an output mode. If it applies to one skill's
report it belongs in that skill's `## Output Format`, not here.
