import { describe, it, expect } from "vitest";
import {
  build,
  createVM,
  debugStep,
  executeProgram,
  executeStep,
  Op,
  snapshot,
  tokenize,
} from "../src/language";
import { examples } from "../src/examples";
function run(source: string) {
  const c = build(source);
  expect(c.diagnostics).toEqual([]);
  expect(c.program).toBeDefined();
  return executeProgram(c.program!);
}
describe("public examples", () => {
  for (const e of examples)
    it(e.title, () => {
      const c = build(e.source);
      if (e.error === "syntax" || e.error === "type") {
        expect(c.diagnostics.some((d) => d.stage === e.error)).toBe(true);
        expect(c.program).toBeUndefined();
      } else {
        expect(c.diagnostics).toEqual([]);
        const result = executeProgram(c.program!);
        if (e.error) expect(result.diagnostic?.stage).toBe(e.error);
        else {
          expect(result.status).toBe("completed");
          expect(result.output).toEqual(e.output);
        }
      }
    });
});
describe("lexer", () => {
  it("tracks offsets, comments and escapes", () => {
    const s = '// comment\nlet text: string = "a\\n\\t\\\"\\\\";';
    const r = tokenize(s);
    expect(r.diagnostics).toEqual([]);
    expect(r.tokens[0]).toMatchObject({ line: 2, column: 1, start: 11 });
    expect(r.tokens.find((t) => t.kind === "string")?.literal).toBe('a\n\t"\\');
    for (const t of r.tokens) expect(s.slice(t.start, t.end)).toBe(t.lexeme);
  });
  it.each([
    '"unterminated',
    "/* no end",
    "@",
    "1e+",
    '"bad\\x"',
    "1e999",
    '"a\nb"',
  ])("rejects malformed input %s", (s) =>
    expect(build(s).diagnostics.length).toBeGreaterThan(0),
  );
  it("supports exponents and block comments", () =>
    expect(run("/* yes */ print(1.5e2);").output).toEqual(["150"]));
});
describe("syntax and static semantics", () => {
  it("preserves precedence and associativity", () =>
    expect(
      run("print(10 - 3 - 2);print(20 / 2 * 3);print(1 + 2 < 4 && !false);")
        .output,
    ).toEqual(["5", "30", "true"]));
  it.each([
    ['let x: number = 1; x = "a";', "type"],
    ["print(x);", "name"],
    ["let a: number = 1;let a: number = 2;", "name"],
    ["if (1) {}", "type"],
    ['while ("yes") {}', "type"],
    ['print(1 == "1");', "type"],
    ['print(1 + "a");', "type"],
    ["print(!1);", "type"],
    ["let x: void = print(1);", "type"],
    ["let print: number = 2;", "name"],
    ["fn print(): void {}", "name"],
    ["fn f(): number {}", "type"],
    ["fn f(a: number): number {return a;}f();", "type"],
    ['fn f(a: number): number {return a;}f("a");', "type"],
    ["fn f(): number {return true;}", "type"],
    ["return 1;", "type"],
    ["fn f(): void {} print(f());", "type"],
    ["print();", "type"],
    ["fn f(): void {fn g(): void {}}", "type"],
    ["fn f(a: number, a: number): void {}", "name"],
    ["fn f(): void {} fn f(): void {}", "name"],
    ["let f: number=1; fn f():void {}", "name"],
    ["{let x: number=2;}print(x);", "name"],
    ["fn f(): number {if(true){return 1;}}", "type"],
    ["let x: number;", "syntax"],
    ["let x: number = ; let y: number = ;", "syntax"],
  ])("rejects %s", (s, stage) => {
    const c = build(s);
    expect(c.diagnostics.some((d) => d.stage === stage)).toBe(true);
    expect(c.program).toBeUndefined();
    expect(
      c.diagnostics.every((d) => d.span.line >= 1 && d.span.start >= 0),
    ).toBe(true);
  });
  it("supports forward calls and mutual recursion", () =>
    expect(
      run(
        "print(even(6));fn odd(n: number): boolean {if(n==0){return false;}return even(n-1);} fn even(n: number): boolean {if(n==0){return true;}return odd(n-1);}",
      ).output,
    ).toEqual(["true"]));
  it("handles void returns and discarded return values", () =>
    expect(
      run(
        "fn f(): void {print(1);return;}f();fn g():number{return 9;}g();print(2);",
      ).output,
    ).toEqual(["1", "2"]));
  it("handles nested local scope and assignment", () =>
    expect(
      run(
        "fn f(n: number): number {let x:number=n;{let x:number=9;print(x);}x=x+1;return x;}print(f(2));",
      ).output,
    ).toEqual(["9", "3"]));
  it("checks all if/else return paths", () =>
    expect(
      run(
        "fn f(n:number):number{if(n>0){return 1;}else{return 2;}}print(f(0));",
      ).output,
    ).toEqual(["2"]));
  it("bounds expression and source nesting", () => {
    expect(
      build("print(" + "(".repeat(140) + "1" + ")".repeat(140) + ");")
        .diagnostics[0].stage,
    ).toBe("syntax");
    expect(
      build("print(" + Array(200).fill("1").join("+") + ");").diagnostics[0]
        .code,
    ).toBe("C001");
    expect(build(" ".repeat(100001)).diagnostics[0].code).toBe("L000");
  });
});
describe("bytecode and VM", () => {
  it("uses jumps and valid source maps", () => {
    const c = build("let i:number=0;while(i<3){i=i+1;}print(i);");
    expect(c.program!.instructions.some((i) => i.op === Op.JUMP)).toBe(true);
    for (const i of c.program!.instructions) {
      expect(i.span.end).toBeLessThanOrEqual(c.source.length);
      if (i.op === Op.JUMP || i.op === Op.JUMP_IF_FALSE)
        expect(c.program!.instructions[Number(i.operand)]).toBeDefined();
    }
    expect(executeProgram(c.program!).output).toEqual(["3"]);
  });
  it.each(["print(1/0);", "print(1%0);", "print(1e308*1e308);"])(
    "catches arithmetic runtime fault %s",
    (s) => expect(run(s).diagnostic?.stage).toBe("runtime"),
  );
  it("short circuits nested expressions without stack leaks", () => {
    const r = run(
      "let i:number=0;while(i<20){print(false || true && true);i=i+1;}",
    );
    expect(r.output).toHaveLength(20);
    expect(r.stack).toEqual([]);
  });
  it("enforces instruction, output, depth, and stack limits", () => {
    const c = build("while(true){}").program!;
    expect(executeProgram(c, { instructionBudget: 10 }).steps).toBe(10);
    expect(
      executeProgram(build("fn f():void{f();}f();").program!, { callDepth: 8 })
        .diagnostic?.code,
    ).toBe("B002");
    expect(
      executeProgram(build("while(true){print(1);}").program!, {
        outputLimit: 3,
      }).output,
    ).toHaveLength(3);
    expect(
      executeProgram(build("print(1+2);").program!, { stackLimit: 1 })
        .diagnostic?.code,
    ).toBe("B003");
  });
  it("detects uninitialized globals in forward calls", () =>
    expect(
      run("f();let x:number=1;fn f():void{print(x);}").diagnostic?.code,
    ).toBe("R007"));
  it("bounds traces and snapshots independently", () => {
    const c = build("let i:number=0;while(i<100){i=i+1;}");
    const vm = createVM(c.program!);
    executeStep(vm);
    const s = snapshot(vm);
    s.stack.length = 0;
    expect(vm.stack).toHaveLength(1);
    while (!["completed", "errored"].includes(vm.status)) executeStep(vm);
    expect(vm.trace).toHaveLength(160);
    expect(vm.globals[0]?.value).toBe(100);
  });
});
describe("debugger", () => {
  it("steps real instructions and retains arguments", () => {
    const c = build(examples[0].source),
      vm = createVM(c.program!);
    expect(debugStep(vm, "instruction").pc).toBe(1);
    debugStep(vm, "instruction");
    expect(vm.frames).toHaveLength(2);
    expect(vm.frames[1].locals[0]?.value).toBe(5);
    expect(vm.program.instructions[vm.pc].span.line).toBe(3);
  });
  it("step over executes a call; step out restores caller", () => {
    const p = build(
      "fn f(n:number):number{\nreturn n+1;\n}\nprint(f(4));",
    ).program!;
    const vm = createVM(p);
    debugStep(vm, "over");
    expect(vm.frames).toHaveLength(1);
    expect(vm.output).toEqual(["5"]);
    debugStep(vm, "instruction");
    expect(vm.status).toBe("completed");
    const second = createVM(p);
    debugStep(second, "instruction");
    debugStep(second, "instruction");
    expect(second.frames.length).toBe(2);
    debugStep(second, "out");
    expect(second.frames.length).toBe(1);
    expect(second.stack[0]?.value).toBe(5);
  });
  it("reset creates clean state and terminated VM cannot step", () => {
    const p = build("print(1);").program!,
      vm = createVM(p);
    debugStep(vm, "instruction");
    vm.status = "terminated";
    const pc = vm.pc;
    executeStep(vm);
    expect(vm.pc).toBe(pc);
    expect(createVM(p).steps).toBe(0);
  });
});
