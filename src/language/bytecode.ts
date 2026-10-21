import { callRust } from "./runtime";
import type { Binding, Program, SemanticInfo, Span, Type } from "./model";
export enum Op {
  PUSH_CONST,
  LOAD_LOCAL,
  STORE_LOCAL,
  LOAD_GLOBAL,
  STORE_GLOBAL,
  ADD,
  SUBTRACT,
  MULTIPLY,
  DIVIDE,
  MODULO,
  NEGATE,
  NOT,
  EQUAL,
  LESS_THAN,
  LESS_EQUAL,
  GREATER_THAN,
  GREATER_EQUAL,
  JUMP,
  JUMP_IF_FALSE,
  CALL,
  RETURN,
  PRINT,
  POP,
  HALT,
  DUP,
}
export type Value =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "void"; value: null };
export function primitiveValue(value: number | string | boolean): Value {
  if (typeof value === "number") return { type: "number", value };
  if (typeof value === "string") return { type: "string", value };
  return { type: "boolean", value };
}
export interface Instruction {
  op: Op;
  operand?: number | string;
  span: Span;
  nodeId: number;
}
export interface CompiledFunction {
  name: string;
  entry: number;
  params: number[];
  locals: number;
  returnType: Type;
}
export interface Bytecode {
  instructions: Instruction[];
  constants: Value[];
  functions: Record<string, CompiledFunction>;
  bindings: Binding[];
}
export const opcodeDescription: Record<Op, string> = {
  [Op.PUSH_CONST]: "Push a constant onto the operand stack.",
  [Op.LOAD_LOCAL]: "Push a local slot from the active frame.",
  [Op.STORE_LOCAL]: "Pop a value into a local slot.",
  [Op.LOAD_GLOBAL]: "Push a global slot.",
  [Op.STORE_GLOBAL]: "Pop a value into a global slot.",
  [Op.ADD]: "Pop two numbers, push their sum.",
  [Op.SUBTRACT]: "Pop right and left, push left minus right.",
  [Op.MULTIPLY]: "Pop two numbers, push their product.",
  [Op.DIVIDE]: "Divide left by right. Zero divisor is an error.",
  [Op.MODULO]: "Remainder of left / right. Zero divisor is an error.",
  [Op.NEGATE]: "Negate the top number.",
  [Op.NOT]: "Invert the top boolean.",
  [Op.EQUAL]: "Compare same-type primitive values.",
  [Op.LESS_THAN]: "Compare two numbers.",
  [Op.LESS_EQUAL]: "Compare two numbers.",
  [Op.GREATER_THAN]: "Compare two numbers.",
  [Op.GREATER_EQUAL]: "Compare two numbers.",
  [Op.JUMP]: "Set the instruction pointer to the operand.",
  [Op.JUMP_IF_FALSE]: "Pop a boolean. Jump if false.",
  [Op.CALL]: "Pop arguments and create a call frame.",
  [Op.RETURN]: "Restore the caller and push the return value.",
  [Op.PRINT]: "Pop a primitive, capture output, push void.",
  [Op.POP]: "Discard the top value.",
  [Op.HALT]: "Complete the program.",
  [Op.DUP]: "Duplicate the top value.",
};
export function compile(ast: Program, info: SemanticInfo): Bytecode {
  return callRust("compile", { ast, info });
}
