---
name: sentinel-env
description: "Environment-aware pre-flight check. Use when starting work in a new environment, switching machines, or when 'works on my machine' bugs surface. Validates OS, runtime versions, installed tools, port availability, env vars, and disk space BEFORE coding starts. Like sentinel but for the environment, not the code."
metadata:
  author: runedev
  version: "0.5.0"
  layer: L3
  model: haiku
  group: validation
  tools: "Bash, Read, Write, Glob, Grep"
---

# sentinel-env

## Purpose

Catch environment mismatches before they waste debugging time. Validates that the developer's machine has the right runtime versions, tools, ports, and configuration to run the project. Prevents the entire class of "works on my machine" failures that masquerade as code bugs.

This is the environment counterpart to `sentinel` (which checks code security) and `preflight` (which checks code quality). sentinel-env checks the MACHINE, not the code.

## Triggers

- Called by `cook` Phase 0.5 — before planning, after resume check (first run in a new project only)
- Called by `scaffold` — after project bootstrap, verify environment matches generated config
- Called by `onboard` — during project onboarding, verify developer can run the project
- `/rune env-check` — manual environment validation
- Auto-trigger: when `npm install`, `pip install`, or similar fails during cook

## Calls (outbound)

None — sentinel-env never calls another Rune skill and never modifies the developer's machine/environment (no install/update). In `--agents` mode it writes ONE Rune-owned advisory cache file, `.rune/runtimes.json` (a Rune state file, not the dev's environment — same category as the files `journal`/`session-bridge`/`council` write).

## Called By (inbound)

- `cook` (L1): Phase 0.5 — first run detection (no `.rune/` directory exists)
- `scaffold` (L1): post-bootstrap environment validation
- `onboard` (L2): developer onboarding verification
- User: `/rune env-check` direct invocation
- User: `/rune env-check --agents` — also run AI-Agent Fleet Detection (Step 6.6)

## Data Flow

### Feeds Into →

- `council` (L3): `.rune/runtimes.json` — when `--agents` mode ran during env pre-flight, it PRE-WARMS council's Step 1 DETECT cache (council reuses a same-session cache instead of re-probing the bridge). Schema + model-family map are OWNED by `skills/council/references/dispatch-protocol.md` §Detect — sentinel-env writes that exact shape, it does not define its own.

## Execution

### Step 1: Detect Project Type

Read project configuration files to determine what environment is needed:

1. Use `Glob` to check for project config files:
   - `package.json` → Node.js project
   - `pyproject.toml` / `setup.py` / `requirements.txt` → Python project
   - `Cargo.toml` → Rust project
   - `go.mod` → Go project
   - `Gemfile` → Ruby project
   - `docker-compose.yml` / `Dockerfile` → Docker project
   - `.nvmrc` / `.node-version` → specific Node version required
   - `.python-version` → specific Python version required

2. Read each detected config file to extract version constraints:
   - `package.json` → `engines.node`, `engines.npm`, dependency versions
   - `pyproject.toml` → `requires-python`, dependency versions
   - `Cargo.toml` → `rust-version`
   - `go.mod` → `go` directive version

3. Build an environment requirements checklist from the detected configs.

### Step 2: Runtime Version Check

For each detected runtime, verify the installed version matches constraints:

```bash
# Node.js
node --version    # Compare against package.json engines.node or .nvmrc
npm --version     # Compare against package.json engines.npm
# or pnpm/yarn/bun depending on lockfile present

# Python
python --version  # Compare against pyproject.toml requires-python
pip --version

# Rust
rustc --version   # Compare against Cargo.toml rust-version
cargo --version

# Go
go version        # Compare against go.mod go directive

# Docker
docker --version
docker compose version
```

**Version comparison logic:**
- If the constraint is `>=18.0.0` and installed is `20.11.1` → PASS
- If the constraint is `>=18.0.0` and installed is `16.20.2` → BLOCK (wrong major version)
- If the runtime is not installed at all → BLOCK
- If no version constraint exists in config → WARN (version unconstrained)

### Step 3: Required Tools Check

Detect and verify tools the project depends on:

1. **Package manager**: Check which lockfile exists and verify the matching tool is installed
   - `package-lock.json` → npm
   - `pnpm-lock.yaml` → pnpm
   - `yarn.lock` → yarn
   - `bun.lockb` → bun
   - `poetry.lock` → poetry
   - `uv.lock` → uv
   - Mismatched lockfile + installed tool → WARN (e.g., yarn.lock exists but only npm installed)

2. **Git**: `git --version` — required for all projects
3. **Docker**: Check only if `Dockerfile` or `docker-compose.yml` exists
4. **Database tools**: Check if `prisma`, `drizzle`, `alembic`, `django` migrations exist → verify DB client installed
5. **Build tools**: Check for `turbo.json` (turborepo), `nx.json` (Nx), `Makefile`, etc.

6. **Hard dependencies** — tools the project WRAPS (not just uses as dev dependency):
   Scan for evidence that the project wraps an external tool:
   - `Grep` for `shutil.which(`, `which `, `command -v ` → project looks up an executable at runtime
   - `Grep` for `subprocess.run(`, `child_process.exec(`, `Deno.Command(` → project invokes external CLI
   - `Read` README/docs for "requires X installed" or "depends on X"

   For each detected hard dependency, apply the **9-tier binary detection** below — checking only `which`/`where` is insufficient and produces the largest category of "works on my machine" false-negatives (user has binary installed but PATH is stale, or installed via a package manager that didn't register it, or installed as a desktop app with a bundled binary).

   **9-Tier Binary Detection** (stop at first hit):

   | Tier | Source | Catches |
   |------|--------|---------|
   | 1 | Explicit `--<tool>-bin <path>` flag | CI, automation, manual override |
   | 2 | Skill-specific env var `<SKILL>_<TOOL>_BIN` | Per-project pinning |
   | 3 | Tool-family env var `<TOOL>_APP_BIN` | Ecosystem conventions |
   | 4 | Generic tool env var `<TOOL>_BIN` | Legacy overrides |
   | 5 | Platform desktop-app bundle (macOS `.app/Contents/Resources`, Windows `%LOCALAPPDATA%\Programs`, Linux `/opt`) | Desktop app users (~40% of population) |
   | 6 | PATH lookup (`which`/`where.exe`) | Standard shell users |
   | 7 | Package manager global bin (`npm config get prefix`, `pnpm`, `pipx --list`, `cargo install --root`) | npm-global on Windows (PATH oversight) |
   | 8 | Platform common directories — Unix: `~/.local/bin`, `~/.npm-global/bin`, `~/.bun/bin`, `~/.cargo/bin`, `~/.deno/bin`, `~/.volta/bin`, `~/.asdf/shims`, `~/.proto/bin`, `/opt/homebrew/bin`, `/usr/local/bin`. Windows: `%APPDATA%\npm`, `%USERPROFILE%\.bun\bin`, `%USERPROFILE%\.cargo\bin`, `%USERPROFILE%\.deno\bin`, `%LOCALAPPDATA%\Microsoft\WindowsApps`, `%ProgramFiles%\nodejs` | Bun / Cargo / Deno / Volta / asdf / proto users + manual installers |
   | 9 | Platform release archive names (e.g., `codex-x86_64-unknown-linux-musl`, `<tool>-aarch64-apple-darwin`) | Release-tarball downloaders |

   **Verdict:**
   - Tool found via any tier → PASS (log which tier + version)
   - Tool resolves to DIFFERENT paths across tiers (e.g. a `~/.local/bin` copy AND a PATH copy, or two PATH entries) → **WARN [ENV-AMBIG]**: `'<tool>' resolves to N paths — the shell picks <selected>, but <other> also exists`. This is the "wrong binary runs" class of "works on my machine" (stale/shadowed installs, two Pythons, two npms). Don't stop at the first tier hit for the ambiguity check — after a PASS, cheaply confirm PATH (`where`/`which -a`) doesn't disagree with the winning tier. List all paths + versions so the developer can prune the shadow.
   - Tool NOT found → **BLOCK** with per-OS install guidance:
     ```
     [ENV-XXX] Required tool '<tool>' not found (9-tier lookup exhausted)
       → Debian/Ubuntu: sudo apt install <tool>
       → macOS: brew install <tool> (or desktop app: <URL>)
       → Windows: winget install <tool> (or choco install <tool>)
       → Any platform: npm install -g <package> (if Node tool)
       → Manual: <download URL>
       → Pin explicitly: export <TOOL>_BIN=/path/to/binary
     ```
   - This prevents the entire class of "it worked in CI but not locally" failures where `subprocess.run()` silently fails
   - Reference implementation: `scripts/codex_imagen_bridge.mjs` in `@rune-pro/media` ports this pattern

### Step 4: Port Availability Check

Detect which ports the project needs and check if they're available:

1. Parse port information from:
   - `package.json` scripts (look for `--port`, `-p`, `PORT=` patterns)
   - `.env` / `.env.example` (look for `PORT=`, `DATABASE_URL` with port)
   - `docker-compose.yml` (ports section)
   - Common defaults: 3000 (Next.js/React), 5173 (Vite), 8000 (Django/FastAPI), 5432 (PostgreSQL), 6379 (Redis)

2. Check each port:
   ```bash
   # Cross-platform port check
   # Windows: netstat -ano | findstr :PORT
   # Unix: lsof -i :PORT or ss -tlnp | grep :PORT
   ```

3. If port is in use → WARN with the process name using it

### Step 5: Environment Variables Check

Compare required env vars against actual configuration:

1. Read `.env.example` or `.env.template` if it exists
2. Read `.env` if it exists (DO NOT log values — only check key presence)
3. For each key in `.env.example`:
   - Present in `.env` → PASS
   - Missing from `.env` → WARN (with the key name, never the expected value)
4. Check for dangerous patterns:
   - `.env` committed to git (check `.gitignore`) → BLOCK (security risk)
   - Placeholder values still present (`your-api-key-here`, `changeme`, `xxx`) → WARN

### Step 6: Disk Space and System Resources

Quick system health check:

1. **Disk space**: Check available space on the project drive
   - < 1 GB → WARN
   - < 500 MB → BLOCK (npm install / docker build will fail)

2. **Platform-specific checks**:
   - **Windows**: Check for long path support (`git config core.longpaths` for node_modules)
   - **macOS**: Check Xcode CLI tools if native modules detected (`node-gyp` in dependencies)
   - **Linux**: Check file watcher limit if large project (`fs.inotify.max_user_watches`)

### Step 6.6: AI-Agent Fleet Detection (opt-in — `--agents` flag, or when called by `council`)

Skip this step unless `--agents` was passed or `council` requested it. It answers ONE question: *"how many distinct AI model families can this machine reach for a decorrelated council run?"* — and pre-warms council's cache so its first invocation skips a redundant probe.

**Schema and model-family map are OWNED by `skills/council/references/dispatch-protocol.md` §Detect. Do NOT redefine them here — read that file and write its exact shape.** This keeps a single source of truth; if that reference changes, this step follows it.

1. **Resolve the bridge**: look for `1devtool-agent` on PATH, then the per-user location for the current OS (`~/.1devtool/bin/1devtool-agent` POSIX, `%USERPROFILE%\.1devtool\bin\1devtool-agent.cmd` Windows). Resolve relative to the current user's home — never hardcode a specific user's path.
2. **Bridge found** → `1devtool-agent list --json`; for each `status: detected` entry map its id → `model_family` per the council reference table (claude→anthropic, codex→openai, gemini/agy→google, grok→xai, qwen→alibaba, wrapper CLIs cline/amp/opencode/aider→`unknown`). Reading `~/.1devtool/state/cli-registry.json` directly is an acceptable faster path (it is the pre-scanned manifest `list` returns).
3. **Bridge NOT found** → `detected: []`, `bridge_path: null`. This is normal, not an error. Optionally 9-tier detect raw AI-agent binaries for the human report only ("5 AI CLIs installed but no 1devtool bridge → council will run subagent-only"), but do NOT put unbridged binaries in `detected[]` — council can't dispatch to them.
4. **Write** `.rune/runtimes.json` in the council-owned schema (`checked_at` session marker, `bridge_path`, `detected[]`). Only bridge-reachable `status: detected` entries belong in `detected[]`.
5. **Count distinct CONFIRMED families** (exclude `unknown` wrappers) → report `MULTI_FAMILY-capable` (≥2) or `NO_DECORRELATION-only` (<2). **Honesty (inherit council's caveat): "confirmed" = the CLI is vendor-dedicated by product design, NOT that a given response was verified to come from that vendor's backend** (BYOK / base-URL / gateway override can collapse families invisibly). Report the count as advisory availability, never as a decorrelation guarantee — that call is council's at run time.

### Step 7: Report

Produce a structured environment report:

**Verdict logic:**
- Any BLOCK finding → **BLOCKED** (environment cannot run this project)
- Any WARN finding → **READY WITH WARNINGS** (can run but may hit issues)
- All checks pass → **READY** (environment is correctly configured)

For each finding, include a specific remediation command the developer can copy-paste.

## Output Format

```
## Environment Check: [project name]
- **Project type**: [Node.js / Python / Rust / Go / Multi]
- **Checks run**: [count]
- **Verdict**: READY | READY WITH WARNINGS | BLOCKED

### BLOCKED
- [ENV-001] Node.js 16.20.2 installed but >=18.0.0 required
  → Fix: `nvm install 18 && nvm use 18`

### WARNINGS
- [ENV-002] Port 3000 in use by process "node" (PID 12345)
  → Fix: `kill 12345` or change PORT in .env
- [ENV-003] Missing env var: DATABASE_URL (required by .env.example)
  → Fix: Copy from .env.example and fill in your database connection string

### PASSED
- [ENV-004] pnpm 9.1.0 ✓ (matches pnpm-lock.yaml)
- [ENV-005] Git 2.44.0 ✓
- [ENV-006] Docker 25.0.3 ✓
- [ENV-007] Disk space: 42 GB available ✓

### AI AGENTS (only when --agents / council mode ran)
- Bridge: 1devtool-agent ✓ (or: not found → council runs subagent-only)
- Reachable: codex (openai), grok (xai), gemini (google), agy (google) — 3 distinct confirmed families
- council capability: MULTI_FAMILY-capable (advisory — not a decorrelation guarantee; backend override can collapse families)
- Wrote .rune/runtimes.json (pre-warms council DETECT)
```

## Constraints

1. MUST NOT install, update, or modify anything on the developer's MACHINE/environment (no `apt install`, no version switches, no PATH edits). Writing the Rune-owned advisory cache `.rune/runtimes.json` in `--agents` mode is the ONE exception and is not a machine modification — it is Rune state, same as `journal`/`council` run files.
2. MUST NOT log environment variable VALUES — only check key presence (security)
3. MUST provide copy-paste remediation commands for every BLOCK and WARN finding
4. MUST handle cross-platform differences (Windows/macOS/Linux) gracefully
5. MUST complete in under 10 seconds — use parallel Bash calls where possible
6. MUST NOT block on WARN findings — only BLOCK findings prevent proceeding

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| False BLOCK on version — semver parsing error | HIGH | Use simple major.minor comparison, not full semver regex |
| Slowness on Windows — netstat/port checks are slower | MEDIUM | Timeout port checks at 3s, skip if slow |
| .env file contains secrets — accidentally logged | CRITICAL | NEVER read .env values, only check key existence via grep for key names |
| Platform detection wrong — WSL vs native Windows | MEDIUM | Check for WSL explicitly (`uname -r` contains "microsoft") |
| Over-checking — flagging optional tools as required | MEDIUM | Only check tools evidenced by config files, not speculative |
| Missing hard dependency — project wraps external CLI but tool not checked | HIGH | Step 3.6: scan for `shutil.which`, `subprocess.run`, `child_process.exec` → verify tool exists on PATH |
| Hard dep found but wrong version — tool exists but API changed | MEDIUM | Log version for manual review. Version compatibility is project-specific — don't guess |
| `--agents` writes `.rune/runtimes.json` with a schema that drifts from council's | HIGH | Schema + family map are OWNED by `skills/council/references/dispatch-protocol.md` §Detect — sentinel-env writes that shape, never its own; if the reference changes, this step follows it |
| Reporting an installed-but-unbridged AI CLI as council-reachable | HIGH | Step 6.6.3: only bridge-reachable `status: detected` entries go in `detected[]`; unbridged binaries are report-only text, never dispatchable state |
| Claiming a distinct-family count as a decorrelation guarantee | MEDIUM | Step 6.6.5: report as advisory availability only; "confirmed" ≠ backend-verified (BYOK/gateway override) — the real decorrelation call is council's at run time |

## Done When

- All detected project runtimes version-checked against constraints
- Package manager matches lockfile type
- Required ports checked for availability
- Environment variables compared against .env.example (keys only)
- Disk space verified adequate
- Structured report with READY / READY WITH WARNINGS / BLOCKED verdict
- Every BLOCK/WARN finding has a copy-paste remediation command
- In `--agents` mode only: `.rune/runtimes.json` written in council's canonical schema and a distinct-family count reported (advisory, not a decorrelation guarantee)

## Cost Profile

~500-1000 tokens input, ~500-1000 tokens output. Haiku model — this is fast, cheap, read-only scanning. Runs once per new project (or on manual invoke). Sub-10-second execution target.
