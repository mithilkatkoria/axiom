# Axiom

### A programming language you can see executing.

[![Verify](https://github.com/mithilkatkoria/axiom/actions/workflows/ci.yml/badge.svg)](https://github.com/mithilkatkoria/axiom/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-ed785b.svg)](LICENSE)

Write a program. Explore its structure. Follow every instruction.

Axiom is a statically typed programming language and an interactive compiler studio. Follow your source through tokens, syntax trees, type checking, bytecode, and a stack virtual machine. Set a breakpoint inside a recursive call and inspect the actual values that make it work.

**[Open Axiom](https://axiom-hazel-three.vercel.app)** · [Explore the source](https://github.com/mithilkatkoria/axiom) · [Language guide](docs/LANGUAGE_SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Verification record](docs/VERIFICATION.md)

![Axiom homepage with an editable live compiler](docs/screenshots/home-hero.png)

## A small language. The whole journey.

```text
fn factorial(n: number): number {
    if (n <= 1) { return 1; }
    return n * factorial(n - 1);
}
print(factorial(5)); // 120
```

The program above is lexed, parsed, checked, compiled to numeric bytecode, and executed in Axiom's VM. Source is never evaluated as JavaScript. Every inspector reads the current compiler result or execution snapshot.

| Explore      | What you can inspect                                                        |
| ------------ | --------------------------------------------------------------------------- |
| Source       | Axiom-aware editing, diagnostics, completion, search and source navigation  |
| Structure    | Exact tokens, an interactive syntax graph and a keyboard-accessible tree    |
| Meaning      | Scoped bindings, expression types and static errors                         |
| Instructions | Constant pools, source mappings, jumps and short-circuit control flow       |
| Execution    | Operand stack, recursive call frames, local values and program output       |
| Debugging    | Breakpoints, pause, continue, instruction stepping and source into/over/out |

![Axiom studio showing the editor and real compiler inspectors](docs/screenshots/studio-1440.png)

## Run locally

Use **Node 24**. The lockfile is committed for reproducible installs.

```sh
git clone https://github.com/mithilkatkoria/axiom.git
cd axiom
npm ci
npm run dev
```

Open **http://127.0.0.1:5178**. Run the homepage example, or enter `/studio` for the debugger. Start with the fifteen included programs, then edit one to see how the compiler responds. Work is saved locally in your browser. Share links carry source in a URL fragment and never run it automatically.

## Under the surface

```text
source → lexer → parser → typed AST → semantic analysis → bytecode
                                                            ↓
                                     execution worker → stack VM
                                                            ↓
                                editor + inspectors + debugger
```

The compiler has no React or DOM dependency. Browser workers own compilation and execution, apply resource limits, and return versioned snapshots so edits cannot display obsolete results. The React interface turns that data into an explorable workspace.

```text
src/language/     Lexer, parser, semantic analysis, bytecode compiler, VM
src/workers/      Execution and benchmark worker protocols
src/studio/       Editor, inspectors, syntax graph and debugger views
src/content.ts    Shared documentation content
src/App.tsx       Routes and workspace coordination
tests/            Language, documentation, benchmark and browser checks
docs/             Specifications, design decisions and verification evidence
```

The interface includes dark and light themes, resizable panels, keyboard commands, responsive layouts, self-hosted Instrument Sans and IBM Plex Mono, and readable documentation even with JavaScript disabled.

## Check the work

```sh
npx playwright install chromium
npm run verify
```

The complete check runs strict TypeScript, ESLint, compiler regressions, executable documentation examples, a production build, and Chromium browser tests against a fresh preview server. Port 5178 must be free. On Linux CI, install browser dependencies with `npx playwright install --with-deps chromium`.

| Command             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `npm test`          | Compiler, VM, documentation and benchmark correctness |
| `npm run test:e2e`  | Build and check real browser interactions             |
| `npm run benchmark` | Validate outputs and measure seven compiler/VM inputs |
| `npm run build`     | Emit the production app and prerendered documentation |
| `npm run preview`   | Serve the production build locally                    |

Actual results, browser coverage, screenshots and remaining gaps are recorded in [the verification record](docs/VERIFICATION.md). Benchmark results are environment-specific. The experiments page runs two warm-ups and ten measured samples per input and exports the measured data with environment metadata.

## Deploy

Production: **https://axiom-hazel-three.vercel.app**. The Vercel project is connected to this repository. Pushes to `main` run the full GitHub verification pipeline, then trigger a production deployment through a securely stored Vercel Deploy Hook. Pull requests run verification.

This repository is configured for Vercel: framework **Vite**, build command **`npm run build`**, output **`dist`**, root directory **`.`**. `vercel.json` includes clean documentation URLs and deep links for the studio and experiments.

The prerenderer uses Vercel's production hostname for canonical URLs, social metadata and the sitemap. Set `VITE_SITE_URL=https://your-domain.example` to use a custom domain. No server, database or API key is required for the studio.

## Learn more

- [Language specification](docs/LANGUAGE_SPEC.md) and [learning guide](docs/LEARNING_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md), [bytecode reference](docs/BYTECODE.md) and [design decisions](docs/DESIGN_DECISIONS.md)
- [Experiments](docs/EXPERIMENTS.md), [testing](docs/TESTING.md) and [verification](docs/VERIFICATION.md)
- [Development log](docs/DEVELOPMENT_LOG.md) and [interview preparation](docs/INTERVIEW_PREPARATION.md)
- [Contributing](CONTRIBUTING.md) and [third-party notices](THIRD_PARTY_NOTICES.md)

## Deliberate boundaries

Axiom supports primitive values, mutable typed variables, lexical scopes, conditionals, loops and named recursive functions. It does not yet support arrays, objects, closures, first-class functions, imports or asynchronous programs. Numbers use finite IEEE 754 doubles. Strings do not concatenate. Return analysis is conservative.

Debugging is line-based and has no reverse execution. The graph shows at most 300 visible nodes, with the full AST available in the text tree. Resource limits bound browser work, but are not a formal safety proof. Chromium is the validated browser; broader browser and assistive technology audits remain future work.

Created by [Mithil Katkoria](https://github.com/mithilkatkoria), with coding-agent assistance documented in the development log. Contributions should preserve the link between what the interface shows and what the compiler actually does.

[MIT licensed](LICENSE). Bundled fonts retain their SIL Open Font License notices.
