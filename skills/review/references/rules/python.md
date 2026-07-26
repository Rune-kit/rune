# Python

Blocking here: exceptions that hide failure, blocking calls inside `async def`, untrusted input
reaching an interpreter or a shell, and resources never released. Type hints and naming are
non-blocking — report them once, at LOW, or not at all.

## Exception handling

- `except:` or `except BaseException:` — swallows `KeyboardInterrupt` and `SystemExit` too
- A handler that logs and continues where the caller then acts on state the failed block never set
- `raise NewError(...)` inside a handler without `from e` — the original traceback is lost
- `contextlib.suppress` or a bare `pass` handler over a block that performs a write

Do not report a broad `except Exception` at a genuine top-level boundary — a task runner, a request
middleware, a CLI entrypoint — where the handler logs with traceback and the process must survive.

## Async correctness

- A blocking call inside `async def`: `time.sleep`, `requests`, a sync DB driver, `open().read()`
  on a large file, or a CPU-bound loop
- A coroutine called without `await`, so it is created and discarded
- `asyncio.gather` over operations that must not partially apply
- Tasks created with `create_task` and never awaited or stored — they can be garbage collected mid-flight

Do not report a blocking call when it runs through `run_in_executor`, `asyncio.to_thread`, or an
equivalent offload — and do not report sync code in a project with no async entrypoints at all.

## Mutable state

- A mutable default argument: `def f(items=[])` / `={}` — shared across every call
- A module-level mutable used as a cache without a lock in a threaded or async server
- Mutating a list or dict while iterating it
- A dataclass field defaulting to a mutable without `field(default_factory=...)`

Do not report a module-level mutable that is written once at import and only read afterwards.

## Untrusted input

- SQL built by f-string, `%`, `.format`, or `+` instead of parameters
- `subprocess` with `shell=True` on any value derived from input
- `eval`, `exec`, `pickle.loads`, or `yaml.load` without `SafeLoader` on external data
- A path joined from user input without confining it to a base directory
- Secrets read from a literal in source rather than the environment or a secret store

Do not report a parameterized query whose only interpolation is a table or column name drawn from a
fixed allowlist visible in the same module.

## Resource lifecycle

- `open`, a socket, a DB connection, or a session acquired without a context manager or `finally`
- A lock acquired on a path that can raise before it is released
- A thread or process pool created per call rather than reused

Do not report a short-lived handle in a script or test where the interpreter exits immediately after.

## Typing and correctness

- `is` / `is not` comparing values rather than identity (`is "text"`, `is 0`)
- Equality against `None`, `True`, or `False` with `==` where identity is meant
- Missing type hints on a public function **only** if the project runs mypy or pyright
- Integer division or float equality where exactness matters (money, counters)

Do not report missing hints in a project with no type checker configured — that is a preference,
and reporting it as a defect is precisely the noise the blocking split exists to prevent.
