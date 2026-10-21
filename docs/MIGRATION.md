# Compiler and VM migration

The application keeps its existing language, editor, inspectors, debugger, examples, benchmarks, routes, themes, persistence, sharing and learning material. The execution implementation moves from TypeScript to Rust.

| Responsibility                                         | Current implementation                                         |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Lexing, parsing, typed AST                             | Rust in engine/src/                                            |
| Binding resolution, static typing, return analysis     | Rust                                                           |
| Bytecode lowering, constants, jumps, source maps       | Rust                                                           |
| VM, recursive frames, limits, stepping, breakpoints    | Rust                                                           |
| Live debugger session                                  | Rust inside each worker's Wasm instance                        |
| Worker scheduling, cancellation and versioned messages | TypeScript                                                     |
| React, CodeMirror, graph layout and display models     | TypeScript                                                     |
| Original implementation                                | Preserved under tests/reference/, used only by migration tests |

## Why Rust and WebAssembly

Rust suits the compiler's typed syntax and explicit runtime state. WebAssembly keeps execution in the browser, preserving local operation and static Vercel hosting without a backend. The JSON adapter lets the existing UI consume the same documented data shape. It adds a Wasm download, initialization and serialization costs; it is not a performance claim.

## Compatibility

The public tokenize, parse, analyze, compile, build, createVM, executeStep, snapshot, executeProgram, debugStep and stepFinished APIs remain available after engine initialization. The adapter delegates semantic operations to Rust. Existing tests, examples, snippets and benchmarks run through Wasm.

Source positions and output budgets continue to use UTF-16 units. Numbers remain finite f64 values with JavaScript-compatible primitive number rendering. The original 25 opcodes, resource defaults, diagnostic codes, explicit frames and line-based debugger semantics remain.

Native tests check Rust without a browser. Differential tests compare the original engine against Wasm on examples, benchmarks, Unicode locations, numeric formatting, malformed bytecode, runtime errors and instruction/source stepping. Browser tests load an actual Wasm response, inspect its binary signature and worker identity, then execute factorial. All existing browser checks remain.

## Build and deployment

Node-only users can run the committed Wasm artifact. Rust changes require npm run engine:build, followed by npm run verify. Integrity checks prevent stale artifacts from deploying. CI installs Rust 1.98.1, runs native tests and strict Rust lint, rebuilds Wasm, and runs the existing frontend pipeline before deployment. Vercel uses the committed checked artifact and retains the current domain and routes.

## Language percentages

Production compiler and VM logic are Rust. TypeScript remains in UI code, view models, adapters and tests. The original TypeScript implementation is deliberately preserved as a real reference, so repository percentages include it. Source is not hidden, misclassified or padded to meet a percentage target.
