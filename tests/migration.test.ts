import { describe, expect, it } from "vitest";
import * as rust from "../src/language";
import * as reference from "./reference/language";
import { callRust } from "../src/language/runtime";
import { examples } from "../src/examples";
import { benchmarks } from "../src/benchmarks";
/** Spans in the original engine sometimes included extra token fields. Compare the documented span contract. */
function clean(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (key === "elapsedMs" || key === "timings" || key === "engine")
        return undefined;
      if (key === "span" || key === "scopeSpan") {
        const span = item as rust.Span;
        return {
          start: span.start,
          end: span.end,
          line: span.line,
          column: span.column,
        };
      }
      return item;
    }),
  );
}
function compilation(value: rust.Compilation | reference.Compilation) {
  const { tokens, ast, semantic, program, diagnostics } = value;
  return clean({ tokens, ast, semantic, program, diagnostics });
}
const cases = [
  ...examples.map((example) => [example.title, example.source]),
  ...benchmarks.map((input) => [input.name, input.source]),
  ["Unicode offsets", 'print("🦀");\nlet x:number=42;print(x);'],
  ["Numeric rendering", "print(-0);print(1e21);print(1e-7);print(0.1+0.2);"],
  [
    "Prototype-like function names",
    "fn constructor(n:number):number{return n+1;}let __proto__:number=2;print(constructor(__proto__));",
  ],
  [
    "Nested control flow",
    "let i:number=0;while(i<5){if(i%2==0){print(i);}else{print(-i);}i=i+1;}",
  ],
  [
    "Mutual recursion",
    "print(even(6));fn odd(n:number):boolean{if(n==0){return false;}return even(n-1);}fn even(n:number):boolean{if(n==0){return true;}return odd(n-1);}",
  ],
  ["Uninitialized global", "f();let x:number=1;fn f():void{print(x);}"],
  ["Escaped strings", 'print("line\\n\\t\\"\\\\\\0");'],
  ["Empty source", ""],
] as const;
describe("Rust/WebAssembly compatibility with the preserved original engine", () => {
  it("loads a real Rust WebAssembly engine", () => {
    expect(callRust("identity")).toMatchObject({
      language: "Rust",
      runtime: "WebAssembly",
      abi: 1,
    });
  });
  for (const [name, source] of cases) {
    it("preserves compilation and execution: " + name, () => {
      const actual = rust.build(source),
        before = reference.build(source);
      expect(compilation(actual)).toEqual(compilation(before));
      if (actual.program && before.program)
        expect(clean(rust.executeProgram(actual.program))).toEqual(
          clean(reference.executeProgram(before.program)),
        );
    });
  }
  for (const mode of ["instruction", "into", "over", "out"] as const) {
    it("preserves every debugger snapshot for " + mode, () => {
      const source =
        "fn f(n:number):number{\nif(n<=1){return 1;}\nreturn n*f(n-1);\n}\nprint(f(4));";
      const a = rust.createVM(rust.build(source).program!),
        b = reference.createVM(reference.build(source).program!);
      // Establish a recursive frame before testing source modes.
      for (let i = 0; i < 8; i++) {
        rust.executeStep(a);
        reference.executeStep(b);
      }
      for (let i = 0; i < 200; i++) {
        expect(clean(rust.debugStep(a, mode))).toEqual(
          clean(reference.debugStep(b, mode)),
        );
        if (["completed", "errored"].includes(a.status)) break;
      }
      expect(a.status).toBe("completed");
    });
  }
  it("preserves typed runtime faults for malformed bytecode", () => {
    const source = "print(2);";
    for (const op of [rust.Op.ADD, rust.Op.LOAD_GLOBAL, rust.Op.RETURN, 999]) {
      const a = rust.build(source).program!,
        b = reference.build(source).program!;
      a.instructions[0].op = op;
      b.instructions[0].op = op;
      expect(clean(rust.executeProgram(a))).toEqual(
        clean(reference.executeProgram(b)),
      );
    }
  });
  it("keeps UTF-16 output budgets for non-BMP strings", () => {
    const source = 'print("🦀");';
    const a = rust.build(source).program!,
      b = reference.build(source).program!;
    expect(clean(rust.executeProgram(a, { outputCharacters: 1 }))).toEqual(
      clean(reference.executeProgram(b, { outputCharacters: 1 })),
    );
  });
});
