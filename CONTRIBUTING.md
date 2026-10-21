# Contributing to Axiom

Thanks for taking a look. Small, well explained changes are welcome. Open an issue before changing language semantics or the bytecode format so the tradeoffs can be discussed first.

## Local setup

Use Node 24 and run `npm ci`, then `npm run dev`. Run `npx playwright install chromium` once to install the browser used for end-to-end checks.

For engine changes, install Rust 1.98.1, rustfmt, Clippy and wasm32-unknown-unknown. Run `npm run engine:build` and commit the artifact and manifest with Rust sources. See [engine/README.md](engine/README.md) for Windows linker guidance.

Before opening a pull request, run `npm run verify`. It checks types, lint, compiler regressions, documentation examples, the production build, and browser behavior. It needs port 5178 to be free. Browser tests refresh the actual screenshots in `docs/screenshots/`; review any changed images.

## Where changes belong

- `engine/src/`: Rust compiler and VM. Keep it independent of React and browser APIs.
- `src/language/`: UI data contracts and WebAssembly adapters.
- `tests/reference/`: original engine. Do not modify it to mask migration regressions.
- `src/workers/`: execution lifecycle, resource limits and versioned messages.
- `src/studio/`: editor, inspectors and debugging controls.
- `src/content.ts`: public documentation shared by the site and prerenderer.
- `tests/`: semantic regressions, executable documentation and browser checks.

For a language change, include a regression demonstrating the behavior, update the language specification, and keep diagnostics tied to real source spans. For a visual change, check narrow screens, both themes, keyboard focus, and reduced motion. Every displayed compiler value must come from the current source or runtime snapshot.

Describe the user-visible result, the reason for the change, and the checks you ran in your pull request. State any remaining limitations plainly. Please avoid unrelated formatting changes, new dependencies without a clear need, and committing local environment files.
