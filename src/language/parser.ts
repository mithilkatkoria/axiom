import type { Diagnostic, Program, Token } from "./model";
import { callRust } from "./runtime";
export function parse(tokens: Token[]): {
  ast?: Program;
  diagnostics: Diagnostic[];
} {
  return callRust("parse", { tokens });
}
