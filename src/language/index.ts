import type { EngineIdentity } from "./runtime";
import type { Diagnostic, Program, SemanticInfo, Token } from "./model";
import type { Bytecode } from "./bytecode";
import { callRust } from "./runtime";
export * from "./model";
export * from "./lexer";
export * from "./parser";
export * from "./semantic";
export * from "./bytecode";
export * from "./vm";
export interface Compilation {
  engine?: EngineIdentity;
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
export function build(source: string): Compilation {
  return callRust("build", { source });
}
