import { diagnostic, origin, type Diagnostic, type Span } from "./model";
import { Op, primitiveValue, type Bytecode, type Value } from "./bytecode";
export type VMStatus =
  "ready" | "running" | "paused" | "completed" | "errored" | "terminated";
export interface Frame {
  name: string;
  returnPc: number;
  stackBase: number;
  locals: (Value | undefined)[];
}
export interface VMOptions {
  instructionBudget: number;
  callDepth: number;
  stackLimit: number;
  outputLimit: number;
  outputCharacters: number;
}
export interface TraceEvent {
  step: number;
  pc: number;
  opcode: string;
  line: number;
  depth: number;
}
export interface Snapshot {
  pc: number;
  stack: Value[];
  globals: (Value | undefined)[];
  frames: Frame[];
  output: string[];
  status: VMStatus;
  diagnostic?: Diagnostic;
  steps: number;
  maxStack: number;
  maxDepth: number;
  trace: TraceEvent[];
  elapsedMs: number;
}
export interface VM extends Snapshot {
  program: Bytecode;
  options: VMOptions;
  outputSize: number;
}
const defaults: VMOptions = {
  instructionBudget: 100_000,
  callDepth: 128,
  stackLimit: 8192,
  outputLimit: 1000,
  outputCharacters: 64_000,
};
export function createVM(
  program: Bytecode,
  options: Partial<VMOptions> = {},
): VM {
  return {
    program,
    options: { ...defaults, ...options },
    pc: 0,
    stack: [],
    globals: [],
    frames: [{ name: "<main>", returnPc: -1, stackBase: 0, locals: [] }],
    output: [],
    status: "ready",
    steps: 0,
    maxStack: 0,
    maxDepth: 1,
    trace: [],
    elapsedMs: 0,
    outputSize: 0,
  };
}
class RuntimeFault extends Error {
  constructor(
    public code: string,
    message: string,
    public budget = false,
  ) {
    super(message);
  }
}
export function executeStep(vm: VM): void {
  if (["completed", "errored", "terminated"].includes(vm.status)) return;
  const faultAddress = vm.pc;
  const ins = vm.program.instructions[vm.pc];
  const fail = (code: string, message: string, budget = false): never => {
    throw new RuntimeFault(code, message, budget);
  };
  const pop = (): Value => {
    const value = vm.stack.pop();
    return value ?? fail("R001", "Operand stack underflow.");
  };
  const number = (v: Value): number =>
    v.type === "number" && typeof v.value === "number"
      ? v.value
      : fail("R002", "Expected a number on the operand stack.");
  const boolean = (v: Value): boolean =>
    v.type === "boolean" && typeof v.value === "boolean"
      ? v.value
      : fail("R003", "Expected a boolean on the operand stack.");
  const push = (value: Value) => {
    if (vm.stack.length >= vm.options.stackLimit)
      fail("B003", "Operand stack limit reached.", true);
    vm.stack.push(value);
  };
  const jump = (target: number | string | undefined) => {
    if (
      typeof target !== "number" ||
      !Number.isInteger(target) ||
      !vm.program.instructions[target]
    )
      fail("R004", "Invalid jump target.");
    vm.pc = target as number;
  };
  try {
    if (vm.steps >= vm.options.instructionBudget)
      fail(
        "B001",
        `Instruction budget exhausted (${vm.options.instructionBudget.toLocaleString()} instructions). Check for an infinite loop.`,
        true,
      );
    if (!ins) fail("R005", "Instruction pointer is outside the program.");
    if (vm.status === "ready") vm.status = "paused";
    vm.trace.push({
      step: vm.steps + 1,
      pc: vm.pc,
      opcode: Op[ins.op],
      line: ins.span.line,
      depth: vm.frames.length,
    });
    if (vm.trace.length > 160) vm.trace.shift();
    vm.pc++;
    vm.steps++;
    const frame = vm.frames[vm.frames.length - 1];
    const slot = typeof ins.operand === "number" ? ins.operand : -1;
    switch (ins.op) {
      case Op.PUSH_CONST: {
        const c = vm.program.constants[slot];
        if (!c) fail("R006", "Invalid constant index.");
        push(c);
        break;
      }
      case Op.LOAD_LOCAL:
      case Op.LOAD_GLOBAL: {
        const value = (ins.op === Op.LOAD_LOCAL ? frame.locals : vm.globals)[
          slot
        ];
        push(
          value ??
            fail("R007", "Variable used before its initializer executed."),
        );
        break;
      }
      case Op.STORE_LOCAL:
      case Op.STORE_GLOBAL:
        if (slot < 0 || slot >= 4096) fail("R008", "Invalid variable slot.");
        (ins.op === Op.STORE_LOCAL ? frame.locals : vm.globals)[slot] = pop();
        break;
      case Op.ADD:
      case Op.SUBTRACT:
      case Op.MULTIPLY:
      case Op.DIVIDE:
      case Op.MODULO:
      case Op.LESS_THAN:
      case Op.LESS_EQUAL:
      case Op.GREATER_THAN:
      case Op.GREATER_EQUAL: {
        const right = number(pop()),
          left = number(pop());
        if ((ins.op === Op.DIVIDE || ins.op === Op.MODULO) && right === 0)
          fail("R009", "Division or modulo by zero.");
        let value: number | boolean;
        switch (ins.op) {
          case Op.ADD:
            value = left + right;
            break;
          case Op.SUBTRACT:
            value = left - right;
            break;
          case Op.MULTIPLY:
            value = left * right;
            break;
          case Op.DIVIDE:
            value = left / right;
            break;
          case Op.MODULO:
            value = left % right;
            break;
          case Op.LESS_THAN:
            value = left < right;
            break;
          case Op.LESS_EQUAL:
            value = left <= right;
            break;
          case Op.GREATER_THAN:
            value = left > right;
            break;
          default:
            value = left >= right;
        }
        if (typeof value === "number" && !Number.isFinite(value))
          fail("R010", "Arithmetic produced a non-finite number.");
        push(primitiveValue(value));
        break;
      }
      case Op.NEGATE:
        push({ type: "number", value: -number(pop()) });
        break;
      case Op.NOT:
        push({ type: "boolean", value: !boolean(pop()) });
        break;
      case Op.EQUAL: {
        const r = pop(),
          l = pop();
        if (l.type !== r.type || l.type === "void")
          fail("R011", "Equality requires compatible primitive values.");
        push({ type: "boolean", value: l.value === r.value });
        break;
      }
      case Op.JUMP:
        jump(ins.operand);
        break;
      case Op.JUMP_IF_FALSE:
        if (!boolean(pop())) jump(ins.operand);
        break;
      case Op.DUP: {
        const value = pop();
        push(value);
        push(value);
        break;
      }
      case Op.POP:
        pop();
        break;
      case Op.CALL: {
        const fn =
          (typeof ins.operand === "string"
            ? vm.program.functions[ins.operand]
            : undefined) ?? fail("R012", "Unknown function in bytecode.");
        if (!fn) fail("R012", "Unknown function in bytecode.");
        if (vm.frames.length >= vm.options.callDepth)
          fail(
            "B002",
            `Call depth limit reached (${vm.options.callDepth} frames).`,
            true,
          );
        const args = fn.params.map(() => pop()).reverse(),
          locals: (Value | undefined)[] = new Array(fn.locals);
        fn.params.forEach((s, i) => {
          locals[s] = args[i];
        });
        vm.frames.push({
          name: fn.name,
          returnPc: vm.pc,
          stackBase: vm.stack.length,
          locals,
        });
        jump(fn.entry);
        break;
      }
      case Op.RETURN: {
        if (vm.frames.length === 1)
          fail("R013", "Cannot return from the main program.");
        const value = pop(),
          completed = vm.frames.pop()!;
        vm.stack.length = completed.stackBase;
        vm.pc = completed.returnPc;
        push(value);
        break;
      }
      case Op.PRINT: {
        const value = pop();
        if (value.type === "void") fail("R014", "Cannot print void.");
        const text = String(value.value);
        if (
          vm.output.length >= vm.options.outputLimit ||
          vm.outputSize + text.length > vm.options.outputCharacters
        )
          fail(
            "B004",
            "Output limit reached. Reduce the number or length of printed values.",
            true,
          );
        vm.output.push(text);
        vm.outputSize += text.length;
        push({ type: "void", value: null });
        break;
      }
      case Op.HALT:
        vm.status = "completed";
        break;
      default:
        fail("R015", "Unknown opcode.");
    }
    vm.maxStack = Math.max(vm.maxStack, vm.stack.length);
    vm.maxDepth = Math.max(vm.maxDepth, vm.frames.length);
  } catch (error) {
    vm.status = "errored";
    vm.pc = faultAddress;
    const span: Span = ins?.span ?? origin;
    vm.diagnostic =
      error instanceof RuntimeFault
        ? diagnostic(
            error.budget ? "budget" : "runtime",
            error.code,
            error.message,
            span,
          )
        : diagnostic(
            "internal",
            "I002",
            error instanceof Error ? error.message : "Unexpected VM failure.",
            span,
          );
  }
}
export function snapshot(vm: VM): Snapshot {
  return {
    pc: vm.pc,
    stack: vm.stack.map((v) => ({ ...v })),
    globals: vm.globals.map((v) => (v ? { ...v } : undefined)),
    frames: vm.frames.map((f) => ({
      ...f,
      locals: f.locals.map((v) => (v ? { ...v } : undefined)),
    })),
    output: [...vm.output],
    status: vm.status,
    diagnostic: vm.diagnostic,
    steps: vm.steps,
    maxStack: vm.maxStack,
    maxDepth: vm.maxDepth,
    trace: [...vm.trace],
    elapsedMs: vm.elapsedMs,
  };
}
export function executeProgram(
  program: Bytecode,
  options: Partial<VMOptions> = {},
): Snapshot {
  const vm = createVM(program, options);
  const start = performance.now();
  vm.status = "running";
  while (vm.status === "running") executeStep(vm);
  vm.elapsedMs = performance.now() - start;
  return snapshot(vm);
}
export type StepMode = "instruction" | "into" | "over" | "out";
export interface StepAnchor {
  pc: number;
  line: number;
  depth: number;
}
export function stepFinished(
  vm: VM,
  mode: StepMode,
  anchor: StepAnchor,
): boolean {
  if (vm.status === "completed" || vm.status === "errored") return true;
  if (mode === "instruction") return true;
  if (mode === "out") return vm.frames.length < anchor.depth;
  const different =
    vm.program.instructions[vm.pc]?.span.line !== anchor.line ||
    vm.frames.length !== anchor.depth;
  return different && (mode === "into" || vm.frames.length <= anchor.depth);
}
export function debugStep(vm: VM, mode: StepMode): Snapshot {
  const anchor = {
    pc: vm.pc,
    line: vm.program.instructions[vm.pc]?.span.line ?? 1,
    depth: vm.frames.length,
  };
  do {
    executeStep(vm);
  } while (
    !stepFinished(vm, mode, anchor) &&
    !["terminated", "completed", "errored"].includes(vm.status)
  );
  if (vm.status === "ready" || vm.status === "running") vm.status = "paused";
  return snapshot(vm);
}
