# skill-forge — Script contract

> Reference for `skills/skill-forge/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### The Three-Mode Contract

Every helper script supports three output modes:

| Mode | Stdout | Stderr | File Artifacts |
|------|--------|--------|----------------|
| default | One artifact path per line | Diagnostics + warnings | Artifacts in declared out-dir |
| `--json` | Structured JSON summary | Diagnostics (unchanged) | Artifacts (unchanged) |
| `--debug` | Default stdout (paths) | Verbose trace + diagnostics | Default + JSONL redacted trace at `<out-dir>/<slug>.jsonl` |

**Why**: default-mode stdout-as-paths is the Unix way. Downstream skills pipe directly without log-parsing. `--json` is opt-in for callers that need metadata.

#### Required Flags

Every helper script MUST accept at least these flags:

```
--help              Print usage + exit 0
--version           Print version + exit 0
--json              Structured JSON on stdout
--debug             Write JSONL redacted trace
--dry-run           Report plan, make no changes, exit 0
--smoke             Pre-flight check (validate deps, exit 0 if healthy)
--out-dir <path>    Override default artifact directory
```

And SHOULD accept when applicable:
```
--prompt-file <path>  Read long text input from file (avoids shell-quoting hell on Windows)
--confirm             Skip confirmation gate for expensive/destructive ops
--timeout-ms <n>      Operation timeout (with semantic exit codes below)
```

#### Semantic Exit Codes

Adopt the standard Rune exit-code vocabulary:

| Code | Meaning | Orchestrator Response |
|------|---------|-----------------------|
| `0` | Success | Accept + chain to next |
| `1` | Execution failed (retryable) | Log + retry with alternate config |
| `2` | Usage error (bug) | Abort — don't retry |
| `3` | Data-integrity error | Halt — don't retry |
| `4` | Timeout with partial results | **Accept partial + continue** |
| `124` | Timeout with zero results | Retry with longer timeout or alternate provider |

Codes `5-63` are skill-specific. Document every code used in `references/<skill>/exit-codes.md`.

**Why `4` vs `124` matters**: Standard Unix collapses "timeout-with-2-of-3-images" and "timeout-with-0-images" into `124`. They are fundamentally different outcomes. Split them.

#### Default Artifact Directory Resolution

Resolve `--out-dir` in this fallback order:

1. `--out-dir <path>` explicit flag
2. `<SKILL>_OUT_DIR` env var (skill-specific)
3. `OPENCLAW_OUTPUT_DIR` (OpenClaw platform convention)
4. `OPENCLAW_AGENT_DIR/artifacts/<skill>` (OpenClaw default)
5. `OPENCLAW_STATE_DIR/artifacts/<skill>` (OpenClaw state fallback)
6. `./.rune/<skill>/` (project-local default)

**Why**: OpenClaw is one of Rune's adapter targets. Scripts that honor this convention work across adapters without modification.

#### Sensitive-Data Redaction

`--debug` trace MUST redact sensitive fields before write:
- Regex: `/authorization|bearer|token|api[_-]?key|secret|cookie|session[_-]?id|chatgpt[_-]?account/i` (key names)
- Any value exceeding 500 chars truncates to `<first-500>...`
- Never log env var VALUES — only presence check

#### Contract Test

Before shipping a helper script, verify:

```bash
# Contract smoke test:
node scripts/<script>.mjs --help          # exit 0
node scripts/<script>.mjs --version       # exit 0, prints version only
node scripts/<script>.mjs --smoke         # exit 0 or 1, human-readable stderr
node scripts/<script>.mjs --dry-run ...   # exit 0, no side effects
node scripts/<script>.mjs ... --json      # stdout is parseable JSON
node scripts/<script>.mjs ... | head -1   # stdout default mode = path
```

> **HARD-GATE** — this gate stays in `SKILL.md` (always loaded) under the section of the same name; it applies here unchanged.

**Reference implementations**:
- `@rune-pro/media/scripts/codex_imagen_bridge.mjs` — full 9-tier binary detection + contract
- `@rune-pro/media/scripts/provider_probe.mjs` — `--smoke` convention exemplar
- `@rune-pro/media/scripts/image_optimizer.py` — Python contract implementation

**Reference docs**:
- `@rune-pro/media/references/image-generator/script-contract.md` (pack-level contract)
- `@rune-pro/media/references/image-generator/exit-codes.md` (exit-code vocabulary)
- `@rune-pro/media/references/image-generator/binary-detection.md` (9-tier lookup)
