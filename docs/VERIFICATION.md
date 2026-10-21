# Verification record

## Rust/WebAssembly migration, 21 October 2026

The complete local verification passes 18 native Rust tests, Rust formatting, Clippy with warnings denied, source/binary digest verification, a fresh Wasm build, strict TypeScript, ESLint, 130 Vitest checks and 23 production Chromium checks. The browser suite completed in 1.1 minutes. The original 93 engine/documentation/benchmark cases and all 22 previous browser checks remain. New tests compare detailed compiler/VM behavior with the preserved original engine and prove the production worker loads actual Rust/WebAssembly before executing factorial.

Rust 1.98.1 targets wasm32-unknown-unknown for the browser. Windows native tests use the installed x64 MSVC host toolchain. The browser module is 763,362 bytes (185.09 kB gzip). The production worker JS is 1.98 kB; the benchmark worker is 2.94 kB. These are build measurements, not speed claims. The main application, lazy editor, styles, routes and screenshots are preserved. Source language percentages include the original engine retained for meaningful compatibility tests.

The committed artifact is coupled to Rust sources and Cargo.lock with SHA-256 digests; the build rejects stale artifacts. CI rebuilds it before running acceptance tests. Only env.now is allowed as a Wasm host import. The worker retains live VM state in Rust and schedules bounded batches. No TypeScript execution fallback or external execution service is used.

Hosted migration outcomes are available from the latest GitHub workflow and the final deployment handoff. Earlier sections below remain dated historical evidence.

## Release checks, 21 October 2026

The publication build passes strict TypeScript, ESLint, 93 Vitest tests and all 22 production Chromium browser checks (1.4 minutes for the final browser run). The expanded browser suite verifies selectable homepage examples against real bytecode output and fragment share links that load without executing. Desktop and mobile homepage renders were inspected after the typography and live-inspector changes.

Vercel is linked to the standalone repository at https://github.com/mithilkatkoria/axiom. The public production origin is https://axiom-explorer.vercel.app. The first hosted smoke check found that cleanUrls requires an extensionless rewrite destination. The configuration was corrected before release. Canonical metadata was confirmed to use the actual production origin.

The hosted release smoke passed against the public origin: all six application routes and the social image returned HTTP 200; the homepage VM printed 120; a shared precedence program printed 14 only after Run; the compact studio had no page overflow; documentation remained readable without JavaScript; bundled fonts, canonical/Open Graph metadata and the sitemap passed. No browser console warning/error or uncaught error was observed. The first hosted [GitHub Actions run](https://github.com/mithilkatkoria/axiom/actions/runs/39632465341) passed the complete pipeline on Ubuntu with Node 24: 93 Vitest tests and 22 Chromium checks (22.0 seconds for browser checks), plus type checking, lint and build. The README badge links to the latest run.

## Original build checks, 19 October 2026

Verified locally on 19 October 2026. Environment: Windows arm64, Node 24.11.1, npm 11.14.0, Vite 8.3.4, Vitest 5.0.5 and Playwright 1.64.1 with Chromium 156 (revision 1248). This record distinguishes local evidence from unperformed hosted deployment and cross-browser checks.

## Commands and results

| Command                                 | Actual result                                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| npm run verify                          | Passed: strict TypeScript, ESLint, Vitest, production build and the full production Playwright suite.                |
| npm test                                | 93 tests passed across four files: language, review regressions, documentation snippets and benchmark inputs.        |
| Production Playwright suite             | 20 tests passed in 48.3 seconds. Every test fails on browser console warning/error or uncaught page error.           |
| npm run build                           | Passed. Static homepage and three documentation routes prerendered; clean-URL aliases and directory indexes emitted. |
| npm run benchmark                       | Seven inputs passed; actual Node measurements retained locally. Two warm-ups and ten samples per input.              |
| npm run lint after ESLint upgrade       | Passed with compatible ESLint 10.13.0.                                                                               |
| npm run typecheck after ESLint upgrade  | Passed.                                                                                                              |
| npm audit --omit=dev --audit-level=high | Found 0 vulnerabilities in the audited runtime dependency tree. This is an advisory check, not a security proof.     |

The full production suite uses a fresh preview process with server reuse disabled, so these results cannot accidentally refer to a running dev server. Preview processes owned by the test runner are cleaned up at the end. Additional screenshot capture checks wait for a loaded editor and stable controls.

## Behavior verified

All final acceptance programs execute through bytecode: addition prints 30; precedence prints 14 and 20; factorial prints 120; the loop prints 0 through 4; shadowing prints 20 and 10; short circuit prints false without dividing by zero. Type mismatches prevent execution. A recursive breakpoint pauses with real argument/local values and frames. Continue, instruction stepping, source over/out, pause, stop and reset operate on the worker VM. Infinite loops terminate at the instruction budget. Source edits clear obsolete compiler/runtime data. Shared URLs load without running.

Every executable public documentation snippet is tested. Benchmark outputs are checked before timing samples are retained. A deterministic arithmetic regression compares 80 generated expression trees against independently computed results without eval.

## Production and SEO

With JavaScript disabled, /language, /learn and /architecture return readable article headings, sections and route-specific Open Graph titles. The homepage also has prerendered text and navigation. The social PNG returns successfully. Vercel configuration includes studio and experiments rewrites plus clean URLs. Canonical URLs and sitemap generation require VITE_SITE_URL to be set to the owner's actual origin. No real production origin was supplied, so no public-domain canonical or hosted deployment is claimed.

## Bundle measurement

Vite's final application build reported:

| Asset                     |       Raw |      Gzip |
| ------------------------- | --------: | --------: |
| Main application JS       | 292.71 kB |  91.18 kB |
| Lazy CodeMirror editor JS | 395.59 kB | 127.53 kB |
| CSS                       |  45.61 kB |   9.39 kB |
| Execution worker          |  19.75 kB |       N/A |
| Benchmark worker          |  20.33 kB |       N/A |

These are build-reported sizes, not measured network throughput or startup performance. The first unsplit main JS asset was 685.41 kB (217.34 kB gzip). Documentation routes now avoid loading the editor chunk. The homepage loads it because its editable demo is real.

## Visual QA

Twenty-five actual screenshots are retained in screenshots/. Browser captures cover 375, 768, 1280 and 1440 px widths at 1000 px height, plus a compact 375 x 667 phone. Each width covers homepage, studio, AST, paused debugger, light theme and errors. Horizontal page overflow is asserted absent. The compact phone test asserts the terminal and status bar remain inside the viewport.

The agent visually inspected actual renders including homepage 375/1440, studio 375/768/1280/1440, AST 768/1440, paused debugger 375/1440, light theme 375/1440, diagnostics 375/1440, compact phone and the social PNG. Corrections included larger AST labels, useful initial collapsed subtrees, source-order preservation, compact-height layout, and a non-wrapping brand detail. Captures wait for editor readiness so a transient loading state is not used as the representative homepage screenshot.

## Review findings fixed

- Empty breakpoint gutter lines lacked click targets; renderEmptyElements and F9 provide pointer/keyboard operation.
- Decorative tab numbering entered accessible names; it is now aria-hidden.
- A CodeMirror token name was unrecognized; a typed custom token table resolves it.
- Navigation maps lacked React keys; anchors now carry stable keys.
- Runtime PC pointed beyond a failing instruction; it now retains the faulting address.
- An inspector traversal reversed the AST's shared body array. It now reverses a copy, and children exposes a read-only array. A browser regression checks function/variable/expression source order.
- Static docs existed but bare paths served the homepage in preview. Both clean-URL HTML aliases and directory indexes are now emitted and tested without JavaScript.
- Source selections now reveal actual contained instruction mappings instead of implying one-to-one correspondence.
- The initial client bundle was too broad; CodeMirror is lazy loaded.

## Limits of validation

Chromium was tested. Firefox, Safari, physical mobile devices, a full screen-reader/contrast audit, a hosted GitHub Actions run and a deployed Vercel instance were not tested. No coverage percentage or formal type-safety theorem is claimed. The original build used system fonts; the publication build bundles Instrument Sans and IBM Plex Mono with license notices. Source stepping and breakpoints are line-based; same-line loops may require instruction stepping. The graph is bounded to 300 visible nodes; the full tree remains available. Benchmark timings are environment-specific and include tracing/safety overhead.

- Final hover review: the generic button hover style could darken the primary surface while retaining dark text. A more specific primary-hover rule fixes it, and the compact-phone acceptance test asserts its actual background color.
