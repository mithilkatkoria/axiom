import type { Diagnostic } from "./model";
import type { Bytecode, Value } from "./bytecode";
import { callRust } from "./runtime";
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
export type StepMode = "instruction" | "into" | "over" | "out";
export interface StepAnchor {
  pc: number;
  line: number;
  depth: number;
}
export function createVM(
  program: Bytecode,
  options: Partial<VMOptions> = {},
): VM {
  return callRust("createVM", { program, options });
}
export function executeStep(vm: VM): void {
  Object.assign(vm, callRust<VM>("executeStep", { vm }));
}
export function snapshot(vm: VM): Snapshot {
  return callRust("snapshot", { vm });
}
export function executeProgram(
  program: Bytecode,
  options: Partial<VMOptions> = {},
): Snapshot {
  return callRust("executeProgram", { program, options });
}
export function stepFinished(
  vm: VM,
  mode: StepMode,
  anchor: StepAnchor,
): boolean {
  return callRust("stepFinished", { vm, mode, anchor });
}
export function debugStep(vm: VM, mode: StepMode): Snapshot {
  Object.assign(vm, callRust<VM>("debugStep", { vm, mode }));
  return snapshot(vm);
}
