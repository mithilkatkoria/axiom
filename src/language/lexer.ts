import type { Diagnostic, Token } from "./model";
import { callRust } from "./runtime";
export function tokenize(source: string): {
  tokens: Token[];
  diagnostics: Diagnostic[];
} {
  return callRust("tokenize", { source });
}
