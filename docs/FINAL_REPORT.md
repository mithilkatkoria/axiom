# Axiom final engineering report

## Implemented

A standalone project in axiom/ preserves the surrounding repository's existing applications and uncommitted work. It contains the actual TypeScript language engine, character lexer, parser/AST, static analyzer, numeric bytecode compiler, stack VM and worker-backed debugger. Supported programs use explicit mutable primitive variables, arithmetic, comparisons, boolean short circuit, blocks, if/else, while, typed functions, forward calls, recursion, return, comments and print.

The React/Vite application includes the editable homepage demo, studio, source editor, source-linked tokens and diagnostics, AST graph and accessible tree, real type tables, disassembly, mapped instructions, live frames/variables/operand stack and bounded trace. Run, pause, continue, instruction/source stepping, breakpoints, stop and reset are implemented. Themes, resize/collapse controls, example loading, commands, sharing, downloads and local persistence work. Fifteen gallery examples and seven benchmark programs are included. Documentation/learning/architecture pages are prerendered, and real measurements can be exported. Brand SVGs, favicon, social PNG and deployment configuration are included.

## Validated

93 Vitest cases and 22 Chromium production-browser checks pass. Strict TypeScript, lint and production build pass. Browser console warnings/errors fail the suite. Static documentation is tested with JavaScript disabled. Runtime dependency audit reported zero advisories. See VERIFICATION.md for exact evidence, sizes, scope and unperformed checks. Historical Node benchmark measurements are retained locally; no cross-language performance claim is made.

## Architecture

src/language/model.ts defines typed syntax, spans and bindings. lexer.ts scans; parser.ts combines recursive descent with precedence climbing; semantic.ts resolves names/types and return paths; bytecode.ts lowers control flow into real instructions; vm.ts executes explicit stack/frame state. index.ts exposes the staged API. Workers compile/execute and communicate versioned snapshots. src/studio/ owns the editor and data views; React does not determine execution semantics.

## Visual QA

Actual screenshots cover 375, 768, 1280 and 1440 px widths, plus 375 x 667. Reviewed states include home, studio, AST, paused recursion, errors and both themes. Fixes addressed AST readability/source order, breakpoint targets, accessible tab names, short phone layouts and representative screenshot readiness. This was actual render inspection, not CSS-only review. See screenshots/ and VERIFICATION.md.

## Known limitations

No arrays, objects, first-class functions, closures, classes, imports, network/filesystem access or async execution. Numbers are finite IEEE 754 doubles, not arbitrary precision. Non-void return analysis is conservative. Early calls reading an uninitialized global fail dynamically. Source stepping/breakpoints are line-based; reverse execution is absent. The graph caps visible nodes at 300 and mapping previews at 200 instructions; full tree and paged bytecode views remain available. Only Chromium has been validated. Physical-device, screen-reader and cross-browser audits remain future verification work. The standalone GitHub repository and Vercel project are now linked. See VERIFICATION.md for dated hosted release results. Production metadata derives from the production hostname or an explicit VITE_SITE_URL override.

## Running Axiom

From a fresh checkout:

```sh
cd axiom
npm ci
npm run dev
```

Open http://127.0.0.1:5178. Run the initial factorial example to print 120. Click the gutter on line 3, or place the cursor there and press F9, to set a breakpoint. Inspect Runtime and step into recursion. Ctrl+K opens commands; Ctrl+Enter runs. Source and layout are stored only in the current browser.

For complete reproduction, close any process using port 5178, then:

```sh
npx playwright install chromium
npm run verify
```

The verification script performs all checks and starts/stops a production preview. Individual commands are documented in README.md and TESTING.md. Use npm run preview to serve an already built dist directory.

## Deploying Axiom

The standalone repository is https://github.com/mithilkatkoria/axiom. Production is https://axiom-explorer.vercel.app. Vercel uses the repository root, Vite, Node 24, `npm run build`, and `dist`. Clean URLs preserve static documentation and rewrite the studio and experiments to the application. `VITE_SITE_URL` can override the production hostname for a custom domain. No mandatory backend or API key is needed.

Run `npm run smoke -- https://axiom-explorer.vercel.app` to repeat the hosted acceptance check. GitHub Actions runs the complete verification pipeline for source changes.

## Understanding the project

Read LANGUAGE_SPEC.md, then LEARNING_GUIDE.md. Trace model.ts -> lexer.ts -> parser.ts -> semantic.ts -> bytecode.ts -> vm.ts, using the tests as executable examples. The important algorithms are character scanning, precedence climbing, scope-stack resolution, conservative return-path checking, jump patching, constant interning, explicit call-frame management and source/depth-based stepping. Then read execution.worker.ts and hooks.ts for scheduling/cancellation/versioning, followed by Editor.tsx, Inspector.tsx and AstExplorer.tsx. ARCHITECTURE.md and BYTECODE.md explain the contracts. INTERVIEW_PREPARATION.md contains 45 code-grounded questions.

## Five independent extension ideas

1. Add precise statement-boundary metadata and test same-line breakpoint/step behavior, replacing line-entry approximations.
2. Implement a bytecode serializer and independent verifier that checks operands, jump targets and stack-height consistency before execution.
3. Introduce constant folding and dead-code elimination, then compare optimized/unoptimized output and traces with differential tests.
4. Build an incremental Lezer editor grammar with language-aware hover/completion, keeping the existing compiler as the execution authority.
5. Implement a register VM with identical semantics and matched benchmark inputs; publish raw repeated measurements and explicitly account for tracing and transport overhead.
