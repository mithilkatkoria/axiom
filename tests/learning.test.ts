import { describe, expect, it } from "vitest";
import {
  build,
  executeProgram,
  Op,
  createVM,
  executeStep,
  snapshot,
} from "../src/language";
import lessons from "../src/learning/lessons.json";
function run(source: string, options = {}) {
  const compilation = build(source);
  expect(compilation.diagnostics).toEqual([]);
  return executeProgram(compilation.program!, options);
}
describe("Axiom 1.1 text features", () => {
  it("joins strings and converts primitives without implicit coercion", () => {
    expect(
      run(
        'let n:number=12;print("Score: "+str(n));print(str(false));print(str("text"));print("a"+"b"+"c");',
      ).output,
    ).toEqual(["Score: 12", "false", "text", "abc"]);
    expect(build('print("Score: "+12);').diagnostics[0].code).toBe("T001");
  });
  it("counts Unicode scalar values and handles empty strings", () => {
    expect(
      run(
        'print(len("Axiom"));print(len("🦀"));print(len(""));print(len("é"));',
      ).output,
    ).toEqual(["5", "1", "0", "2"]);
  });
  it("preserves user-defined functions with helper-like names", () => {
    expect(
      run(
        "fn str(n:number):number{return n+1;}fn len(n:number):number{return n*2;}print(str(2));print(len(3));",
      ).output,
    ).toEqual(["3", "6"]);
  });
  it.each(["len();", "len(1);", 'len("x","y");', "str();", "str(print(1));"])(
    "rejects invalid helper use: %s",
    (source) => {
      expect(build(source).program).toBeUndefined();
      expect(build(source).diagnostics.length).toBeGreaterThan(0);
    },
  );
  it("bounds repeated text doubling before allocating an oversized result", () => {
    const result = run('let text:string="x";while(true){text=text+text;}');
    expect(result.diagnostic?.code).toBe("B005");
    expect(result.diagnostic?.note).toContain("doubling");
    expect(result.steps).toBeLessThan(1000);
    expect(
      run('print("ab"+"cd");', { stringCharacters: 3 }).diagnostic?.code,
    ).toBe("B005");
  });
  it("has source-mapped text opcodes and real debugger values", () => {
    const c = build('let text:string="a"+"b";print(len(text));print(str(3));');
    expect(c.program!.instructions.map((i) => i.op)).toEqual(
      expect.arrayContaining([Op.CONCAT, Op.LENGTH, Op.TO_STRING]),
    );
    const vm = createVM(c.program!);
    while (vm.pc < 3) executeStep(vm);
    expect(snapshot(vm).stack[0]).toEqual({ type: "string", value: "ab" });
    expect(c.program!.instructions[2].span.start).toBe(16);
  });
  it("returns actionable notes without replacing diagnostic codes or messages", () => {
    const d = build('let score:number="hello";').diagnostics[0];
    expect(d.code).toBe("T001");
    expect(d.message).toBe("Expected 'number', received 'string'.");
    expect(d.note).toContain("declared type");
  });
});
describe("every beginner lesson", () => {
  for (const lesson of lessons) {
    it(
      lesson.title +
        ": starter is valid and worked solution reaches the target",
      () => {
        expect(build(lesson.starter).diagnostics).toEqual([]);
        expect(run(lesson.solution).output).toEqual(lesson.expected);
      },
    );
  }
});
