# Rust

Blocking here: panics on reachable paths, blocking calls inside async, and `unsafe` without a stated
invariant. The compiler and Clippy already enforce most of what a reviewer might otherwise flag —
so an idiom finding has to earn its place, and usually does not.

## Panicking paths

- `unwrap` / `expect` on a `Result` or `Option` in library code or a request path
- Slice or array indexing where the index derives from input or a length not just checked
- Integer arithmetic that can overflow on a value from outside — release builds wrap silently
- Division or modulo by a value that can be zero
- `RefCell::borrow_mut` where another borrow can still be live — a runtime panic, not a compile error

Do not report `unwrap` in tests, in `build.rs`, or immediately after a check that proves the variant
— `if x.is_some()` then `x.unwrap()` is ugly, not a defect, and is at most LOW.

## Error handling

- `let _ = fallible();` — the error is discarded without a comment saying why
- `.ok()` used to drop an error the caller needed to see
- An error type erased to `String` or `Box<dyn Error>` where the caller must branch on the cause
- A `?` in a function whose error type loses context with no `map_err` or source chain

Do not report an erased error type in a binary's top-level `main` or a CLI handler, where the error
is about to be printed and the process is about to exit.

## Async correctness

- A blocking call inside `async fn`: `std::thread::sleep`, `std::fs`, a sync HTTP client, or a
  CPU-bound loop — it stalls the executor thread, not just this task
- A `std::sync::Mutex` guard held across an `.await`
- A future created and never awaited — it does nothing at all
- `block_on` called from inside an async context

Do not report a blocking call wrapped in `spawn_blocking` or an equivalent offload, and do not
report `std::sync::Mutex` when no guard crosses an await point.

## Ownership and lifetimes

- `Arc<Mutex<...>>` locked in inconsistent order across paths — a deadlock waiting on scheduling
- A lock guard held far longer than the data access requires, across I/O or a long computation
- `clone()` on a large structure inside a hot loop where a borrow would do

Do not report a `clone` that exists to satisfy the borrow checker at an ownership boundary, or one
on a cheap handle type such as `Arc` or `Rc` — that is the intended use.

## Unsafe

- An `unsafe` block with no comment stating the invariant that makes it sound
- `transmute` where a checked conversion exists
- A raw pointer dereferenced without a null and alignment argument in the same scope
- An `unsafe fn` made public without documenting the caller's obligations

Do not report `unsafe` in generated bindings or an FFI shim whose invariants are documented at the
module level — read the module doc before reporting.

## Resource and correctness

- A `Drop` implementation that can panic — panicking during unwind aborts the process
- A `Vec` grown in a loop with a known final size and no `with_capacity`
- Float equality on values that arrive from arithmetic rather than a literal

Do not report the missing `with_capacity` unless the loop is on a measured hot path — otherwise it
is a LOW-severity suggestion at best.
