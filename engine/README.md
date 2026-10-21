# Rust engine

Axiom's lexer, parser, semantic analyzer, bytecode compiler, VM, runtime guards and debugger stopping rules live in this crate. It builds as a native Rust library for tests and as a browser WebAssembly module. React and TypeScript do not implement execution semantics.

## Build and test

From the repository root:

```sh
rustup target add wasm32-unknown-unknown
npm run engine:test
npm run engine:lint
npm run engine:build
npm run engine:check
```

CI uses Rust 1.98.1 with rustfmt, Clippy and the wasm32-unknown-unknown standard library. Native Rust tests require the platform linker. Windows needs Visual C++ Build Tools and the SDK. On Windows ARM with only x64 MSVC libraries, the helper uses the installed stable-x86_64-pc-windows-msvc Rust host; install that toolchain and its WebAssembly target if needed. AXIOM_RUST_TOOLCHAIN can select an installed host toolchain explicitly.

The committed pkg/axiom_engine.wasm lets Node-only users run the studio and lets Vercel build without installing Rust. pkg/manifest.json couples the Rust source and Cargo.lock digest to the binary digest. The production build rejects stale or modified artifacts. After changing Rust, rebuild and commit both sources and pkg files. CI checks the submitted artifact, runs native tests and Clippy, rebuilds Wasm, and runs the browser-facing regression suite.

## Modules

- model.rs: typed syntax enums, spans, bindings, bytecode records and tagged values.
- lexer.rs: scanning, escapes, comments, numbers, UTF-16 locations and limits.
- parser.rs: recursive-descent statements, precedence-climbing expressions and recovery.
- semantic.rs: signatures, lexical scopes, type checking and return analysis.
- bytecode.rs: constants, numeric instructions, source maps and jump patching.
- vm.rs: stack/frame execution, limits, snapshots, breakpoints and source stepping.
- lib.rs: staged compilation, timings and engine identity.
- bridge.rs: JSON ABI and a worker-local Rust session.
- tests.rs: native semantic, debugger, safety and transport regressions.

## Browser boundary

The module exports memory, axiom_alloc, axiom_dealloc, axiom_dispatch and axiom_output_len. Its only host import is env.now, supplied by performance.now. Axiom programs have no operation that calls a host function.

The small src/language/runtime.ts adapter loads the module, encodes a request as UTF-8 JSON, allocates input memory, dispatches it, copies the response into JavaScript values and releases the allocation in a finally block. The borrowed Rust output buffer is valid until the next request. The ABI contains no asynchronous calls or shared mutable memory. Requests above 32 MiB are rejected; the Wasm module has an 8 MiB stack reservation and a 256 MiB maximum linear memory. These complement language resource budgets and are not a formal safety proof.

The live VM remains inside Rust. TypeScript workers schedule Rust batches of at most 1,500 instructions and send snapshots to React. Pause and generation cancellation happen between batches. Stop terminates the worker and its Wasm instance. The compatibility API can serialize a whole VM for single-step tests; production does not round-trip the program on every instruction.

## Compatibility evidence

tests/reference/language retains the complete original TypeScript engine, used only as a differential test oracle. It is never imported by application code and is not a fallback. tests/migration.test.ts compares tokens, syntax, bindings, diagnostics, bytecode, outputs, trace events and debugger snapshots. Existing tests run through Wasm. Browser tests check the actual Wasm response, worker-reported Rust identity and program output.

Measurements must identify Rust/WebAssembly. The preserved original engine enables controlled future experiments, but no speedup is inferred from this migration.
