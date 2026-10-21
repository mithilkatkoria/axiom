export type Type = "number" | "string" | "boolean" | "void";
export type Primitive = number | string | boolean;
export interface Span {
  start: number;
  end: number;
  line: number;
  column: number;
}
export interface Diagnostic {
  code: string;
  stage:
    | "lexical"
    | "syntax"
    | "name"
    | "type"
    | "compile"
    | "runtime"
    | "budget"
    | "internal";
  severity: "error";
  message: string;
  span: Span;
  note?: string;
}
export interface Token extends Span {
  kind:
    | "keyword"
    | "identifier"
    | "number"
    | "string"
    | "operator"
    | "punctuation"
    | "eof";
  lexeme: string;
  literal?: Primitive;
}
interface Base {
  id: number;
  span: Span;
}
export type Expr =
  | (Base & { kind: "Literal"; value: Primitive })
  | (Base & { kind: "Identifier"; name: string })
  | (Base & { kind: "Unary"; operator: string; operand: Expr })
  | (Base & { kind: "Binary"; operator: string; left: Expr; right: Expr })
  | (Base & { kind: "Call"; name: string; args: Expr[] });
export interface Block extends Base {
  kind: "Block";
  body: Stmt[];
}
export interface Parameter extends Base {
  kind: "Parameter";
  name: string;
  type: Type;
}
export interface Fn extends Base {
  kind: "Function";
  name: string;
  params: Parameter[];
  returnType: Type;
  body: Block;
}
export type Stmt =
  | Block
  | Fn
  | (Base & { kind: "Variable"; name: string; type: Type; value: Expr })
  | (Base & { kind: "Assignment"; name: string; value: Expr })
  | (Base & {
      kind: "If";
      condition: Expr;
      then: Block;
      otherwise?: Block | Stmt;
    })
  | (Base & { kind: "While"; condition: Expr; body: Block })
  | (Base & { kind: "Return"; value?: Expr })
  | (Base & { kind: "Expression"; value: Expr });
export interface Program extends Base {
  kind: "Program";
  body: Stmt[];
}
export type Node = Program | Stmt | Expr | Parameter;
export interface Binding {
  id: number;
  name: string;
  type: Type;
  slot: number;
  global: boolean;
  scope: number;
  owner: string;
  span: Span;
  scopeSpan: Span;
}
export interface Signature {
  name: string;
  params: Type[];
  result: Type;
  node: Fn;
}
export interface SemanticInfo {
  bindings: Binding[];
  references: Record<number, number>;
  types: Record<number, Type>;
  functions: Record<string, Signature>;
  diagnostics: Diagnostic[];
}
export const origin: Span = { start: 0, end: 0, line: 1, column: 1 };
export function diagnostic(
  stage: Diagnostic["stage"],
  code: string,
  message: string,
  span: Span,
): Diagnostic {
  return { stage, code, message, span, severity: "error" };
}
export function children(node: Node): readonly Node[] {
  switch (node.kind) {
    case "Program":
    case "Block":
      return node.body;
    case "Function":
      return [...node.params, node.body];
    case "Variable":
    case "Assignment":
    case "Expression":
      return [node.value];
    case "If":
      return [
        node.condition,
        node.then,
        ...(node.otherwise ? [node.otherwise] : []),
      ];
    case "While":
      return [node.condition, node.body];
    case "Return":
      return node.value ? [node.value] : [];
    case "Unary":
      return [node.operand];
    case "Binary":
      return [node.left, node.right];
    case "Call":
      return node.args;
    default:
      return [];
  }
}
