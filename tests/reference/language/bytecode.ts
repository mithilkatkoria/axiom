import type {
  Binding,
  Expr,
  Program,
  SemanticInfo,
  Span,
  Stmt,
  Type,
} from "./model";
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
  if (info.diagnostics.length)
    throw new Error("Cannot compile a program with semantic diagnostics.");
  const program: Bytecode = {
    instructions: [],
    constants: [],
    functions: Object.create(null),
    bindings: info.bindings,
  };
  function emit(
    op: Op,
    node: { id: number; span: Span },
    operand?: number | string,
  ) {
    return (
      program.instructions.push({
        op,
        operand,
        span: node.span,
        nodeId: node.id,
      }) - 1
    );
  }
  function constant(value: Value, node: Expr | Stmt) {
    let index = program.constants.findIndex(
      (c) => c.type === value.type && c.value === value.value,
    );
    if (index < 0) index = program.constants.push(value) - 1;
    emit(Op.PUSH_CONST, node, index);
  }
  function binding(node: { id: number }) {
    return info.bindings[info.references[node.id]];
  }
  function expr(node: Expr): void {
    switch (node.kind) {
      case "Literal":
        constant(primitiveValue(node.value), node);
        break;
      case "Identifier": {
        const b = binding(node);
        emit(b.global ? Op.LOAD_GLOBAL : Op.LOAD_LOCAL, node, b.slot);
        break;
      }
      case "Unary":
        expr(node.operand);
        emit(node.operator === "!" ? Op.NOT : Op.NEGATE, node);
        break;
      case "Binary": {
        expr(node.left);
        if (node.operator === "&&" || node.operator === "||") {
          emit(Op.DUP, node);
          if (node.operator === "||") emit(Op.NOT, node);
          const jump = emit(Op.JUMP_IF_FALSE, node, 0);
          emit(Op.POP, node);
          expr(node.right);
          program.instructions[jump].operand = program.instructions.length;
          break;
        }
        expr(node.right);
        const ops: Record<string, Op> = {
          "+": Op.ADD,
          "-": Op.SUBTRACT,
          "*": Op.MULTIPLY,
          "/": Op.DIVIDE,
          "%": Op.MODULO,
          "==": Op.EQUAL,
          "!=": Op.EQUAL,
          "<": Op.LESS_THAN,
          "<=": Op.LESS_EQUAL,
          ">": Op.GREATER_THAN,
          ">=": Op.GREATER_EQUAL,
        };
        emit(ops[node.operator], node);
        if (node.operator === "!=") emit(Op.NOT, node);
        break;
      }
      case "Call":
        node.args.forEach(expr);
        emit(
          node.name === "print" ? Op.PRINT : Op.CALL,
          node,
          node.name === "print" ? undefined : node.name,
        );
        break;
    }
  }
  function stmt(node: Stmt): void {
    switch (node.kind) {
      case "Block":
        node.body.forEach(stmt);
        break;
      case "Function":
        break;
      case "Variable":
      case "Assignment": {
        expr(node.value);
        const b = binding(node);
        emit(b.global ? Op.STORE_GLOBAL : Op.STORE_LOCAL, node, b.slot);
        break;
      }
      case "Expression":
        expr(node.value);
        emit(Op.POP, node);
        break;
      case "If": {
        expr(node.condition);
        const jump = emit(Op.JUMP_IF_FALSE, node, 0);
        stmt(node.then);
        if (node.otherwise) {
          const end = emit(Op.JUMP, node, 0);
          program.instructions[jump].operand = program.instructions.length;
          stmt(node.otherwise);
          program.instructions[end].operand = program.instructions.length;
        } else program.instructions[jump].operand = program.instructions.length;
        break;
      }
      case "While": {
        const start = program.instructions.length;
        expr(node.condition);
        const exit = emit(Op.JUMP_IF_FALSE, node, 0);
        stmt(node.body);
        emit(Op.JUMP, node, start);
        program.instructions[exit].operand = program.instructions.length;
        break;
      }
      case "Return":
        if (node.value) expr(node.value);
        else constant({ type: "void", value: null }, node);
        emit(Op.RETURN, node);
        break;
    }
  }
  ast.body.forEach(stmt);
  emit(Op.HALT, ast);
  for (const node of ast.body)
    if (node.kind === "Function") {
      const locals = info.bindings.filter(
        (b) => !b.global && b.owner === node.name,
      );
      program.functions[node.name] = {
        name: node.name,
        entry: program.instructions.length,
        params: node.params.map((p) => binding(p).slot),
        locals: locals.length,
        returnType: node.returnType,
      };
      stmt(node.body);
      constant({ type: "void", value: null }, node);
      emit(Op.RETURN, node);
    }
  return program;
}
