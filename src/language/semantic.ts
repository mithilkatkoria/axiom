import type { Program, SemanticInfo } from "./model";
import { callRust } from "./runtime";
export function analyze(ast: Program): SemanticInfo {
  return callRust("analyze", { ast });
}
