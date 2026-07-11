# Council Dispatch Protocol

Concrete mechanics for Step 1 (DETECT) and Step 3 (DISPATCH) of `council`'s Workflow. This reference exists because the safe-transport rules are shared with `adversary`'s oracle-mode cross-model escalation — read that file first; this one adds council-specific detection, family mapping, and N-voice timeout/fallback handling on top.

Base safety properties (do not duplicate — inherit): `../../adversary/references/cross-model-escalation.md` — explicit per-invocation authorization, read-only sandbox, stdin-not-inline-args, binary preflight, reconcile-as-data-not-verdict.

## §Detect

council's bridge is the `1devtool-agent` shim — a local CLI that fans a prompt out to whichever AI coding CLIs are actually installed (Claude, Codex, Gemini, Antigravity, Cline, Amp, OpenCode, Qwen, Grok, Aider) and returns the response. It ships as part of the user's local tooling, not as a Rune dependency — treat it as opportunistic and never assume it exists.

1. Try `1devtool-agent list --json` on PATH.
2. If not found on PATH, check the conventional per-user install location for the current OS (e.g. `~/.1devtool/bin/1devtool-agent` on POSIX, `%USERPROFILE%\.1devtool\bin\1devtool-agent.cmd` on Windows). Do not hardcode a specific user's path into the skill — resolve relative to the current user's home directory at run time.
3. Neither found → `runtime_report.detected = []`. This is the expected, common case. Proceed to subagent-only mode. Do not surface this as a warning or error to the user — it's a normal degradation, not a misconfiguration.
4. Found → run `list --json`, parse the returned CLI statuses (`detected` / `not-found` / version), map each `detected` entry's `--to=` id to its `model_family` per the table below, and cache:

```json
{
  "checked_at": "<session-scoped marker, not a wall-clock timestamp>",
  "bridge_path": "<resolved path>",
  "detected": [
    { "runtime": "codex", "status": "detected", "model_family": "openai", "version": "..." },
    { "runtime": "gemini", "status": "detected", "model_family": "google", "version": "..." }
  ]
}
```

to `.rune/runtimes.json` — this is the canonical schema; `skills/council/SKILL.md` Step 1.3 must match it field-for-field. Reuse this cache for the rest of the session — do not re-run `list` on every council invocation. Only entries with `status: "detected"` are eligible for allocation in Step 2.

### Model family map

`1devtool-agent run --to=<agent>` accepts: `claude | codex | gemini | agy | cline | amp | opencode | qwen | grok | aider`. Map to `model_family` for the decorrelation count:

| `--to=` value | `model_family` | Confidence |
|---|---|---|
| `claude` | `anthropic` | confirmed |
| `codex` | `openai` | confirmed |
| `gemini` | `google` | confirmed |
| `agy` (Antigravity) | `google` | confirmed (Gemini-based) |
| `grok` | `xai` | confirmed |
| `qwen` | `alibaba` | confirmed |
| `cline` / `amp` / `opencode` / `aider` | `unknown` | **wrapper CLI — backend model is user-configured and not reported by `list --json`** |

Wrapper CLIs (`cline`, `amp`, `opencode`, `aider`) route to whatever backend model the user configured for them — frequently Claude or GPT. Labeling one of these as a distinct family without confirmation is exactly the "decorrelation theater" the min-decorrelation gate exists to prevent. Default `model_family: "unknown"` for these and **exclude `unknown` from the distinct-family count** in council's Step 6 ARBITRATE, same as `is_fallback` voices. If a future version can read the wrapper's actual configured backend (e.g. from its config file), promote it to a confirmed family — until then, treat it as unconfirmed.

**"Confirmed" here means "this CLI is vendor-dedicated by product design," not "this specific invocation's response was verified to come from that vendor's model."** The distinction matters: any of the six "confirmed" rows above can, in principle, be redirected to a different backend by the user (BYOK / base-URL override / corporate LLM gateway) or, for IDE-style CLIs, a built-in model picker — and `1devtool-agent list --json` reports CLI identity, not the identity of the model that actually generated a given response. This table has no mechanism to detect that redirection; it is a real, currently-unclosed limitation (see `skills/council/SKILL.md` Sharp Edges), not something resolved by this table alone. Do not extend the `unknown` treatment to these six rows without confirmed evidence a specific one is commonly reconfigured — that would just move the same unverified-assumption problem, not fix it — but do not read "confirmed" here as cryptographically verified either.

## §Dispatch

For each external slot allocated in Step 2:

1. Write the fully self-contained voice prompt (question + mode + evidence requirements + inline artifact) to a temp file. Never inline it into a shell argument.
2. Invoke:

```bash
printf '%s' "$VOICE_PROMPT" | 1devtool-agent run --to=<agent> --prompt-stdin --timeout=<budget.per_voice_timeout_s> --json
```

   `--json` so the response comes back as a structured envelope council can parse into the Voice shape, rather than free text requiring re-parsing.
3. Per-call authorization: dispatching through `1devtool-agent` is council's normal operating mode (not a rare escalation like adversary's oracle-mode), so it does not require a fresh user confirmation on every single voice within one council run — but the FIRST time in a session that council is about to dispatch to any external CLI, confirm with the user that fanning this question out to their installed AI CLIs is expected. In non-interactive contexts (CI, `/loop`, scheduled runs) skip external dispatch entirely and run subagent-only — announce the skip in the output, do not silently downgrade.
4. Exit code 0 → parse the JSON envelope into a Voice (see main SKILL.md Step 4 GATE for validation). Non-zero exit or timeout → `is_fallback: true`, immediately dispatch a subagent for this slot instead (Step 3.2 in the main workflow). Do not retry the same external CLI a second time in the same run — one failure per slot is enough signal to fall back.
5. Record `latency_ms` from dispatch to response (or to timeout) regardless of outcome.

## Hard caps (inherited + council-specific)

- Per-voice prompt ≤ 4k chars for the inline artifact portion (same cap as oracle-mode bundles) — truncate with an explicit `... [truncated]` marker rather than silently cutting content.
- Max 5 voices per council run (contract's `n: 2..5`) — if a caller requests more, cap at 5 and note the cap in the output.
- `per_voice_timeout_s` comes from the caller's `PerspectiveRequest.budget`; council does not invent its own default beyond what the contract specifies for the mode.

## Checklist (dispatch-time)

- [ ] Bridge detection cached in `.rune/runtimes.json` for this session — not re-probed per voice
- [ ] Wrapper CLI family defaulted to `unknown` unless backend confirmed
- [ ] Prompt delivered via stdin from a temp file — never inline-interpolated
- [ ] First external dispatch this session confirmed with the user (not per-voice)
- [ ] Non-interactive context → external dispatch skipped entirely, announced, subagent-only
- [ ] Timeout or non-zero exit → immediate subagent fallback for that slot, no same-CLI retry
- [ ] `latency_ms` recorded for every voice, success or failure
