# Testing

## Commands from the repository root

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
npm run benchmark
```

TypeScript strict mode checks source, workers, configuration and tests. ESLint uses typescript-eslint recommended rules and rejects explicit any. Vitest is configured to include `tests/**/*.test.ts`, keeping Playwright tests separate. Browser tests run one Chromium worker to avoid resource contention and retain failure traces.

## Language tests

`tests/language.test.ts` covers all fifteen public examples, lexer escapes/locations/comments/exponents and malformed input; arithmetic precedence and associativity; boolean short circuit; scopes, redeclarations, reserved names and unknown bindings; assignments and function signature/return errors; forward/mutual recursion; void values; jump validity/source maps; division/modulo by zero and overflow; instruction/output/call/operand limits; snapshots and bounded traces; real frames/arguments; instruction/over/out stepping; reset and termination.

`tests/benchmark.test.ts` validates seven additional complete programs while measuring their actual VM execution. Timing is not a pass/fail performance threshold.

## Browser tests

`tests/e2e/studio.spec.ts` exercises the homepage compiler, editable source, all inspectors, diagnostics/source selection, stale output invalidation, real debugger frames, source breakpoints and continue, infinite-loop safety, termination/reset, local persistence, theme switching, keyboard resizing, command menu, documentation examples, benchmark export and non-executing shared links.

The visual cases cover 375, 768, 1280 and 1440 px widths with a 1000 px viewport height. They capture home, studio, AST, paused debugger, light theme and error states and assert no horizontal page overflow or uncaught page errors. Screenshots are actual renders, not golden-image comparisons. A human/agent still needs to inspect them. See VERIFICATION.md for the inspected subset and corrections.

## Debug a failure

Read the diagnostic, error context and retained trace. Run one browser test with `npx playwright test -g "name"`. Inspect the current implementation before changing an assertion. Wait for compilation completion rather than assuming a fixed timeout. Invalid source must be tested through diagnostics; Run should stay disabled on compilation failure.

For a core regression, reduce the source to the smallest reproducing program and add a meaningful assertion at the stage responsible. Never mark a broken required behavior as skipped. The first build's source-step test incorrectly expected HALT to run after stepping to its new source location; the corrected test asserts the returned frame/value and then executes HALT explicitly.

## Production

`npm run build` type-checks, emits a Vite static bundle and prerenders the shared documentation articles. `npm run preview` serves dist. For a production smoke check, run the browser suite against preview on port 5178 after stopping the dev server. Verify documentation content is present with JavaScript disabled. Set VITE_SITE_URL in a separate build to test canonical/sitemap generation for your actual domain.

## Scope of evidence

Automated tests are selected examples and boundaries, not a formal correctness proof or exhaustive fuzz campaign. Only Chromium is configured by default. Cross-browser testing, full screen-reader testing and contrast auditing are further validation work. Timings are environment-specific. Do not describe test coverage as a percentage without running an instrumented coverage report.

## One-command production verification

After installing Chromium, close other processes using port 5178 and run `npm run verify`. The cross-platform Node script runs typecheck, lint, tests and build, then launches the production preview through Playwright with server reuse disabled. It fails if an existing development server could otherwise make the production result ambiguous.

## Continuous integration

The repository workflow at `.github/workflows/ci.yml` installs locked dependencies and Chromium, then runs `npm run verify` on Node 24. It has read-only contents permission. After a successful push to `main`, it requests a Vercel production deployment using the `VERCEL_DEPLOY_HOOK` Actions secret. Pull requests and manual verification runs do not publish. Forks without that secret still run all checks and skip deployment. The live workflow badge in README.md links to the actual hosted result.

The final default test:e2e command builds and serves production rather than reusing development. Close the dev server first. The expanded suite contains 22 checks, including JavaScript-free documentation, worker pause, a 375 x 667 layout, AST instruction associations, stable primary-hover contrast and source statement order. Every test asserts that browser warning/error output and uncaught exceptions are absent.

## Hosted release smoke check

Run `npm run smoke -- https://axiom-hazel-three.vercel.app` to check public routes, real compiler worker execution, shared source, mobile overflow, documentation without JavaScript, bundled fonts, canonical metadata and the sitemap. It also captures the README hero image. The smoke script accepts another origin for a preview or custom domain.
