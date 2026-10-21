import { describe, it, expect } from "vitest";
import { build, executeProgram, Op, parse, tokenize } from "../src/language";
describe("final engineering review regressions", () => {
  it("pins runtime diagnostics to the faulting instruction", () => {
    const c = build("print(9 / 0);");
    const r = executeProgram(c.program!);
    expect(c.program!.instructions[r.pc].op).toBe(Op.DIVIDE);
    expect(r.diagnostic?.span).toEqual(c.program!.instructions[r.pc].span);
  });
  it("gives syntax nodes unique, reproducible identities", () => {
    const tokens = tokenize("print(2+3*4);").tokens;
    const a = parse(tokens).ast!,
      b = parse(tokens).ast!;
    expect(a).toEqual(b);
    const stmt = a.body[0];
    expect(stmt.kind).toBe("Expression");
    if (stmt.kind === "Expression" && stmt.value.kind === "Call") {
      const expr = stmt.value.args[0];
      expect(expr.kind).toBe("Binary");
      if (expr.kind === "Binary") {
        expect(expr.operator).toBe("+");
        expect(expr.right.kind).toBe("Binary");
        if (expr.right.kind === "Binary") expect(expr.right.operator).toBe("*");
      }
    }
  });
  it("keeps escaped EOF diagnostics inside source bounds", () => {
    const s = '"abc\\';
    const c = build(s);
    expect(c.diagnostics.length).toBeGreaterThan(0);
    expect(c.diagnostics.every((d) => d.span.end <= s.length)).toBe(true);
  });
  it("keeps deterministic arithmetic consistent with independently computed values", () => {
    let seed = 417;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    function generate(depth: number): { source: string; value: number } {
      if (depth === 0) {
        const value = (random() % 21) - 10;
        return { source: `(${value})`, value };
      }
      const a = generate(depth - 1),
        b = generate(depth - 1),
        op = random() % 3;
      return {
        source: `(${a.source}${["+", "-", "*"][op]}${b.source})`,
        value:
          op === 0
            ? a.value + b.value
            : op === 1
              ? a.value - b.value
              : a.value * b.value,
      };
    }
    for (let i = 0; i < 80; i++) {
      const e = generate(3),
        c = build(`print(${e.source});`);
      expect(c.diagnostics).toEqual([]);
      expect(executeProgram(c.program!).output).toEqual([String(e.value)]);
    }
  });
  it("validates both operands statically despite runtime short circuit", () =>
    expect(
      build("print(false && 3);").diagnostics.some((d) => d.stage === "type"),
    ).toBe(true));
  it("supports host-prototype-like names without host access", () => {
    const c = build(
      "fn constructor(n:number):number{return n+1;}let __proto__:number=2;print(constructor(__proto__));",
    );
    expect(c.diagnostics).toEqual([]);
    expect(executeProgram(c.program!).output).toEqual(["3"]);
  });
  it("captures nested calls and lexical assignment correctly", () => {
    const c = build(
      "fn add(a:number,b:number):number{return a+b;}let x:number=0;{x=add(add(1,2),3);}print(x);",
    );
    expect(c.diagnostics).toEqual([]);
    const r = executeProgram(c.program!);
    expect(r.output).toEqual(["6"]);
    expect(r.stack).toEqual([]);
  });
});
