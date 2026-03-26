# Mid-Run Signal Detection — Two-Stage Intent Classification

When user sends a message DURING cook execution (mid-phase), classify intent before acting.
Source: goclaw (832★) — two-stage intent classification prevents expensive LLM calls for simple signals.

## Stage 1 — Keyword Fast-Path

No LLM reasoning needed. Applies when message is <60 chars.

| Pattern | Intent | Action |
|---------|--------|--------|
| "stop", "cancel", "dừng", "abort" | `Cancel` | Save progress → emit Cook Report with status BLOCKED → stop |
| "status", "tiến độ", "progress", "where are you" | `StatusQuery` | Reply with current phase + task + % estimate → resume |
| "wait", "pause", "đợi" | `Pause` | Create `.rune/.continue-here.md` → WIP commit → stop |
| "skip this", "bỏ qua", "next" | `Steer` | Skip current task → proceed to next task/phase |

## Stage 2 — Context Classification

Applies when NO keyword match AND message is >60 chars.

| Intent | Signal | Action |
|--------|--------|--------|
| `Steer` | Modifies scope but keeps goal ("actually use Redis instead of Memcached") | Update plan inline, note deviation in Cook Report |
| `NewTask` | Unrelated to current work ("also fix the login page") | Log to `.rune/backlog.md`, continue current task. Announce: "Noted for later — staying on current task." |
| `Clarification` | Answers a question cook asked, or provides missing context | Absorb into current phase context, resume |

## Priority Rule

Cancel and Pause are **safety signals** — they take absolute priority over all other classifications.
If ambiguous between Cancel and Steer → ask: "Did you mean stop, or change approach?"
Never queue user messages — process immediately.
