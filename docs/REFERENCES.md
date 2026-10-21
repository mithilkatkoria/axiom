# Primary implementation references

- [Vite getting started](https://vite.dev/guide/): supported Node versions and development/build/preview workflow. Package versions were also checked against the npm registry; package-lock.json records the installed graph.
- [CodeMirror reference](https://codemirror.net/docs/ref/): EditorView, state effects/fields, gutters, StreamLanguage, custom token tables, highlighting and extensions. Axiom's parser and semantics are independent of editor highlighting.
- [CodeMirror configuration examples](https://codemirror.net/examples/config/): editor construction and extension configuration.
- [Vitest guide](https://vitest.dev/guide/): unit/integration test runner setup. Assertions in this repository reflect Axiom's own semantics.
- [GitHub setup-node](https://github.com/actions/setup-node): CI Node/runtime/cache configuration.
- [GitHub checkout releases](https://github.com/actions/checkout/releases): maintained checkout action behavior. The prepared workflow uses read-only permissions and does not retain Git credentials.

The language grammar, bytecode, VM semantics, learning explanations and benchmark hypotheses are project design work, not claims of a published formal proof or an external language standard. No third-party source is reproduced at length.
