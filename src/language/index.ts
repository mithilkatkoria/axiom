import {
  children,
  diagnostic,
  origin,
  type Diagnostic,
  type Program,
  type SemanticInfo,
  type Token,
} from "./model";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { analyze } from "./semantic";
import { compile, type Bytecode } from "./bytecode";
export * from "./model";
export * from "./lexer";
export * from "./parser";
export * from "./semantic";
export * from "./bytecode";
export * from "./vm";
export interface Compilation {
  id: number;
  source: string;
  tokens: Token[];
  ast?: Program;
  semantic?: SemanticInfo;
  program?: Bytecode;
  diagnostics: Diagnostic[];
  timings: {
    lex: number;
    parse: number;
    analyze: number;
    compile: number;
    total: number;
  };
}
let nextId = 0;
export function build(source: string): Compilation {
  const result: Compilation = {
    id: ++nextId,
    source,
    tokens: [],
    diagnostics: [],
    timings: { lex: 0, parse: 0, analyze: 0, compile: 0, total: 0 },
  };
  const start = performance.now();
  let t = start;
  try {
    const lexed = tokenize(source);
    result.tokens = lexed.tokens;
    result.diagnostics = lexed.diagnostics;
    result.timings.lex = performance.now() - t;
    if (result.diagnostics.length) return result;
    t = performance.now();
    const parsed = parse(result.tokens);
    result.ast = parsed.ast;
    result.diagnostics = parsed.diagnostics;
    result.timings.parse = performance.now() - t;
    if (result.diagnostics.length || !result.ast) return result;
    const pending = [{ node: result.ast as import("./model").Node, depth: 0 }];
    while (pending.length) {
      const { node, depth } = pending.pop()!;
      if (depth > 128) {
        result.diagnostics = [
          diagnostic(
            "compile",
            "C001",
            "Syntax tree depth exceeds 128. Split this expression into smaller statements.",
            node.span,
          ),
        ];
        return result;
      }
      for (const child of children(node))
        pending.push({ node: child, depth: depth + 1 });
    }
    t = performance.now();
    result.semantic = analyze(result.ast);
    result.diagnostics = result.semantic.diagnostics;
    result.timings.analyze = performance.now() - t;
    if (result.diagnostics.length) return result;
    t = performance.now();
    result.program = compile(result.ast, result.semantic);
    result.timings.compile = performance.now() - t;
  } catch (error) {
    result.diagnostics.push(
      diagnostic(
        "internal",
        "I001",
        error instanceof Error ? error.message : "Unexpected compiler failure.",
        origin,
      ),
    );
  } finally {
    result.timings.total = performance.now() - start;
  }
  return result;
}
