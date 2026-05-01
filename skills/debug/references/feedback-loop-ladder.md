# Feedback Loop Ladder

**The loop is the skill.** A fast, deterministic, agent-runnable pass/fail signal converts debugging into a mechanical bisection problem. Without one, no amount of file-reading will save you.

> "The rate of feedback is your speed limit." Spend disproportionate effort on the loop itself — bisection, hypothesis testing, and instrumentation all just consume that signal.

## When to invest in a better loop

Run the ladder before Step 3 (Form Hypotheses) when ANY of these are true:

| Signal | Threshold |
|--------|-----------|
| Repro is "click around in browser, then check" | Always — slowest possible loop |
| Cycle 1 hypotheses ruled out, no faster signal exists | Required before cycle 2 |
| Reproduction is intermittent (flaky) | Required — non-deterministic loop wastes cycles |
| Bug spans 3+ components and you can't isolate where it fails | Build component-boundary instrumentation FIRST |
| Manual repro takes > 30 seconds | Auto-script it before forming hypotheses |

**Skip if:** repro is already a single command returning exit code 0/1 in < 5s. The loop is already optimal.

## The ladder (try in order — stop at first viable rung)

| # | Loop | Speed | Determinism | When |
|---|------|-------|-------------|------|
| 1 | **Failing test at the bug's seam** (unit, integration, e2e) | Fast | Hard pass/fail | Default — bug already has a test infrastructure |
| 2 | **curl / HTTP script** against running dev server | Fast | Snapshot-diffable | API or backend bugs |
| 3 | **CLI invocation with fixture input**, diff stdout vs known-good snapshot | Fast | Snapshot-diffable | CLI tools, parsers, formatters |
| 4 | **Headless browser script** (Playwright / `rune:browser-pilot`) — drives UI, asserts on DOM/console/network | Medium | Reliable | UI bugs, JS errors, network failures |
| 5 | **Replay a captured trace** — save real network request / payload / event log to disk; replay through code path in isolation | Fast | Deterministic | Bugs reproducible only with specific data |
| 6 | **Throwaway harness** — minimal subset of system (one service, mocked deps), exercise bug code path with single function call | Fast | Isolated | Bug deep inside framework or service stack |
| 7 | **Property / fuzz loop** — 1000 random inputs, look for failure mode | Slow | Probabilistic | "Sometimes wrong output", race conditions, edge cases |
| 8 | **Bisection harness** — automate "boot at state X, check, repeat" so `git bisect run` works | Medium | Hard pass/fail | Bug appeared between two known commits / dataset versions |
| 9 | **Differential loop** — same input through old vs new (or two configs), diff outputs | Medium | Diff-based | Regression vs reference implementation |
| 10 | **HITL bash script** — last resort. Drive the human with a structured script | Slow | Human-error-prone | All else fails — at least the loop has structure |

## What "good loop" looks like

- One command, one second to run, one bit of output (pass / fail)
- Deterministic — same input → same output, every time
- Captures the bug, not a proxy ("test passes when bug present" is a broken loop)
- Cleanup-safe — re-runnable without manual reset

## Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| "I'll just print and check the console" | Stateless, manual, slow — degrades to staring at logs |
| "Let me read the code one more time" | Reading is not a loop. Loop = pass/fail signal. |
| "It works on my machine, not in CI" | Build a loop in the CI environment FIRST |
| Skipping loop construction because "it's complicated" | The loop is the skill. Skipping it = guessing for the next 5 cycles |

## Integration with Step 0

Add Step 0 (before Reproduce) when invoked on a non-trivial bug:

```
0. Build feedback loop — pick the highest rung from the ladder that you can construct
   in < 10 minutes. Make it deterministic. Verify it currently FAILS (proves it's
   measuring the bug, not noise). Only then proceed to Step 1.
```

If loop construction takes > 10 minutes, that itself is the diagnosis: the bug surface is too large or the system is too coupled. Escalate via 3-Fix Rule (architecture is the problem, not the bug).
