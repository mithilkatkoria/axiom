# Development log

## 19 October 2026

The implementation was produced with a Codex coding agent using the owner's supplied master specification. The agent inspected the existing repository, found unrelated applications and uncommitted work, and created an isolated axiom directory. It did not replace the surrounding Next.js application, publish, push or manufacture Git history. The CodeAgentSwarm activity check returned inactive, so no Swarm tasks were created.

The sandbox command launcher initially failed with Windows volume-credential errors before it could read files. Approved host execution provided a working route for reading the specification, writing the isolated project and running tools. Dependency versions and primary Vite/CodeMirror/Vitest documentation were checked. Node 24.11.1 was available.

Implementation proceeded through typed AST structures and spans, lexer, parser, semantic analysis, bytecode lowering, explicit stack VM, debugger APIs and worker execution. The initial engine suite passed 66 of 67 cases. The remaining test expected a source step to execute HALT even after reaching a different source line; it was corrected to assert the actual source-step boundary and then execute the final instruction. Strict TypeScript narrowing issues in VM guards were fixed. All 67 core cases then passed.

The interface added an Axiom-specific CodeMirror mode, breakpoint/diagnostic/execution decorations, real compiler inspectors, a custom SVG AST with a keyboard tree alternative, worker-backed runtime panels, a responsive studio, homepage demonstration, documentation and an explicit benchmark runner.

The first full type check, lint and production build passed. The initial JavaScript bundle was 685.41 kB (217.34 kB gzip), motivating lazy loading of the editor. Playwright first failed before browser launch because its matching Chromium version was absent; the matching runtime was installed. Subsequent browser runs exposed decorative tab numbers entering accessible names and blank breakpoint gutter lines lacking click targets. Those were fixed rather than skipped. The invalid-source test helper was also corrected to wait for compilation completion rather than waiting for an intentionally disabled Run button.

Actual mobile and tablet screenshots were inspected. The mobile homepage, tablet studio and paused mobile runtime showed working layouts and real frame/local values. Additional screenshots, production checks and final review outcomes are recorded in VERIFICATION.md as they complete.

## Authorship and owner follow-up

No human authorship, review, adoption or deployment is claimed on the owner's behalf. The owner should work through LEARNING_GUIDE.md and reproduce tests before presenting the algorithms independently. Future changes should record the problem, proposed semantics, tests and observed outcomes here. This log is a record of work performed, not an invented commit history.

## Final review and verification, 19 October 2026

The final review added seven engine regressions, tests for every executable public documentation snippet, production-only static-content checks, worker pause control, F9 breakpoint operation and a compact 375 x 667 phone layout. A static-host deep-link issue was caught with JavaScript disabled and corrected by emitting clean-URL aliases alongside directory indexes. Bare documentation paths now serve their own article content before React starts.

Screenshot inspection exposed an AST traversal mutation: reversing children in an inspector changed the shared AST body order. The view now reverses a copy and the traversal API returns a read-only array. A browser regression checks source order. Selecting an AST node also exposes its actual contained instruction mappings, including the many-to-one relationship between source and bytecode.

Stable screenshot assertions found the generic button hover rule overriding the primary action background while retaining dark text. The primary hover rule now preserves its accent surface, and a compact-phone CSS assertion covers that exact state. Representative screenshots wait for the real editor and compilation to be ready.

The final npm run verify passed 93 Vitest cases and 20 Chromium production-browser checks (48.3 seconds for the browser suite), strict type checking, ESLint 10.13.0 and the static production build. Browser console warnings/errors and uncaught page errors fail tests. Runtime dependency audit reported zero vulnerabilities. Twenty-five screenshots were retained and the documented representative states were actually inspected. Node benchmark output was recorded without inventing cross-language comparisons. Final main JS measured 292.71 kB (91.18 kB gzip), with CodeMirror in a separate lazy chunk.

A scoped read-only GitHub workflow was prepared, but no hosted CI run is claimed. No commit, push or deployment was performed. Preview processes were stopped/cleaned up. The owner can reproduce the result using README.md, TESTING.md and the final report.

## Publication and visual refinement, 21 October 2026

At the owner's request, the project was prepared as its own public repository and linked to Vercel. The interface adds self-hosted Instrument Sans and IBM Plex Mono, selectable executable homepage examples, a live compiler inspector, GitHub source links and a closing studio invitation. Share URLs now carry source in a fragment. Font notices, an MIT license, contributor guidance, a standalone CI workflow and a rewritten README accompany the release. Private owner specification and raw local command output remain outside the public tree.

Strict TypeScript, lint, 93 language tests and all 22 production Chromium tests pass. The new short-circuit browser test initially expected one line although the existing example prints two; its expectation was corrected after inspecting the actual program. Public smoke checks exposed a Vercel clean-URL rewrite mismatch. Rewriting the two application routes to the extensionless root fixed the hosted 404s. The complete public smoke then passed, including worker execution, mobile overflow, static documentation and production metadata. The README uses real screenshots.

Repository: https://github.com/mithilkatkoria/axiom. Production: https://axiom-hazel-three.vercel.app. Historical non-deployment statements above describe the original 19 October build, before publication was requested.

The first hosted GitHub Actions run also passed the full pipeline on Ubuntu and Node 24, including all 93 unit/integration cases and 22 browser checks. The Vercel repository connection was refreshed after the initial branch became available.
