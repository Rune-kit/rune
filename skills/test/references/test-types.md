# test — 4-layer test methodology

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Test Types — 4-Layer Methodology

Tests are organized in 4 layers. Each layer catches a different failure class. Higher layers are slower but catch integration issues lower layers miss.

| Layer | Type | What It Catches | Framework | Speed |
|-------|------|-----------------|-----------|-------|
| L1 | **Unit** | Logic bugs, boundary violations, pure function errors | jest/vitest/pytest/cargo test | Fast |
| L2 | **Integration** | API contract breaks, DB query errors, service interaction failures | supertest/httpx/reqwest | Medium |
| L3 | **True Backend** | Real tool/service output correctness (not just exit 0) | Same + real software invocation | Medium-Slow |
| L4 | **E2E / Subprocess** | Full workflow from user/agent perspective, installed app works | Playwright/Cypress/subprocess | Slow |

**Layer rules:**
- **L1 (Unit)**: Synthetic data, no external deps. Every function tested in isolation. Fast, deterministic, CI-friendly
- **L2 (Integration)**: Tests service boundaries — API endpoints, DB operations, message queues. May need test DB or mock server
- **L3 (True Backend)**: **Invokes the REAL tool/service** and verifies output programmatically. No graceful degradation — if the dependency isn't installed, tests FAIL (not skip). Verify: magic bytes, file size > 0, content structure. Print artifact paths for manual inspection
- **L4 (E2E/Subprocess)**: Tests the installed command/app via subprocess or browser automation. Full user workflow: input → process → output → verify

**"No graceful degradation" rule** (L3/L4): Hard dependencies MUST be installed. Tests MUST NOT skip or produce fake results when the dependency is missing. A silently skipping test is worse than a loudly failing test.

Additional modes:

| Type | When | Speed |
|------|------|-------|
| Regression | After bug fixes | Fast |
| Diff-aware | After implementation, large codebases (Phase 6.5) | Fast (targeted) |
