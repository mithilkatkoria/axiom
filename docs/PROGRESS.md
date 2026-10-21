# Implementation checklist

The owner-supplied build specification is retained privately in the original workspace. Final evidence and the limits of that evidence are recorded in VERIFICATION.md and FINAL_REPORT.md.

- [x] Preserve existing repository work in an isolated Vite project.
- [x] Lexer, exact spans, escapes, comments, token limits and structured diagnostics.
- [x] Recursive-descent/precedence parser and discriminated AST unions.
- [x] Lexical name resolution, explicit primitive types, typed functions and conservative return-path checking.
- [x] Numeric bytecode, constant pool, control-flow jumps, short circuit and source mappings.
- [x] Explicit stack VM, recursive frames, tagged values and bounded execution/output.
- [x] Worker protocol, cancellation, termination and version invalidation.
- [x] Instruction/source stepping, line breakpoints, pause/continue/stop/reset.
- [x] Axiom-specific CodeMirror editor with diagnostics, history, search, completions and execution highlighting.
- [x] Real token/type/AST/bytecode/runtime panels and AST-to-instruction associations.
- [x] Homepage, studio, language, learn, architecture and experiments pages.
- [x] Fifteen tested gallery examples, all public documentation snippets, and seven measured benchmark inputs.
- [x] Responsive layouts, both themes, resizable/collapsible panels, local persistence, share/download and commands.
- [x] Student learning guide, grammar, bytecode/API/architecture reference, 45 interview questions and honest development log.
- [x] Source formatting, current compatible ESLint 10 toolchain and locked dependencies.
- [x] 93 Vitest cases and 22 production Chromium acceptance checks pass.
- [x] Strict typecheck, lint, production build and runtime advisory audit pass.
- [x] Production docs without JavaScript, clean URLs, social PNG and direct-route behavior verified.
- [x] Twenty-five real screenshots; desktop/tablet/mobile, AST, debugger, errors and themes inspected.
- [x] Final review fixes covered by regression tests, including AST source order and hover contrast.
- [x] Vercel project linked and standalone GitHub verification workflow prepared.
- [x] Final report and verification record saved.

## Publication, 21 October 2026

The standalone repository is https://github.com/mithilkatkoria/axiom. Vercel is linked at https://axiom-hazel-three.vercel.app. The public release adds bundled fonts, selectable live examples, a real homepage inspector, source links, contributor guidance, licenses and automated checks.

The latest local checks pass 93 language tests and 22 production browser tests, strict type checking, lint and the build. Hosted smoke and CI results are recorded in VERIFICATION.md when completed. Historical build notes remain in DEVELOPMENT_LOG.md.

Run commands from the repository root. `npm run verify` needs port 5178 free. The language and debugger boundaries are documented in README.md and LANGUAGE_SPEC.md.
