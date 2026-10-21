import { callRust, initializeEngine } from "../language/runtime";
import type { Compilation, Snapshot, StepMode } from "../language";
export type Request =
  | { version: number; command: "compile"; source: string }
  | {
      version: number;
      command: "run" | "pause" | "reset" | "step";
      mode?: StepMode;
      breakpoints?: number[];
    };
export type Response = {
  version: number;
  compilation?: Compilation;
  state?: Snapshot;
};
let version = 0,
  generation = 0,
  active = false,
  hasVM = false;
const initialized = initializeEngine();
function send(state?: Snapshot, compilation?: Compilation) {
  postMessage({ version, compilation, state } satisfies Response);
}
function tick(ticket: number) {
  if (!active || ticket !== generation) return;
  const state = callRust<Snapshot>("sessionTick");
  active = state.status === "running";
  send(state);
  if (active) setTimeout(() => tick(ticket), 0);
}
self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    await initialized;
    if (request.command === "compile") {
      version = request.version;
      active = false;
      generation++;
      const result = callRust<{ compilation: Compilation; state?: Snapshot }>(
        "sessionCompile",
        { source: request.source },
      );
      hasVM = !!result.state;
      send(result.state ?? undefined, result.compilation);
      return;
    }
    if (request.version !== version || !hasVM) return;
    if (request.command === "pause" || request.command === "reset") {
      active = false;
      generation++;
      send(
        callRust<Snapshot>(
          request.command === "pause" ? "sessionPause" : "sessionReset",
        ),
      );
      return;
    }
    const state = callRust<Snapshot>("sessionStart", {
      mode: request.command === "step" ? (request.mode ?? "instruction") : null,
      breakpoints: request.breakpoints ?? [],
    });
    active = state.status === "running";
    send(state);
    const ticket = ++generation;
    if (active) setTimeout(() => tick(ticket), 0);
  } catch (error) {
    active = false;
    generation++;
    version = request.version;
    send(undefined, {
      id: version,
      source: request.command === "compile" ? request.source : "",
      tokens: [],
      diagnostics: [
        {
          code: "I004",
          stage: "internal",
          severity: "error",
          message:
            error instanceof Error ? error.message : "Rust engine failed.",
          span: { start: 0, end: 0, line: 1, column: 1 },
        },
      ],
      timings: { lex: 0, parse: 0, analyze: 0, compile: 0, total: 0 },
    });
  }
};
