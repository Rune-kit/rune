# test — Python async tests

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

#### Python Async Tests (pytest-asyncio)

When writing tests for async Python code:

1. **Verify setup before writing tests**:
   - Confirm `pytest-asyncio` is in project dependencies
   - Confirm `asyncio_mode` is set in `pyproject.toml` `[tool.pytest.ini_options]` (recommend `"auto"`)
   - If neither is configured, warn the caller and suggest setup before proceeding

2. **Writing async test functions**:
   - With `asyncio_mode = "auto"`: just write `async def test_something():` — no decorator needed
   - With `asyncio_mode = "strict"`: every async test needs `@pytest.mark.asyncio`
   - Without asyncio_mode set: always use `@pytest.mark.asyncio` decorator explicitly

3. **Async fixtures**:
   - Use `@pytest_asyncio.fixture` (NOT `@pytest.fixture`) for async setup/teardown
   - Scope rules: async fixtures default to `function` scope — use `scope="session"` carefully with async

4. **Common pitfalls**:
   - Tests that `pass` without `await` — they run but don't execute the async path
   - Missing `pytest-asyncio` makes `async def test_*` silently pass as empty coroutines
   - Mixing sync and async fixtures can cause event loop errors
