import {
  build,
  createVM,
  executeStep,
  snapshot,
  stepFinished,
  type Compilation,
  type Snapshot,
  type StepAnchor,
  type StepMode,
  type VM,
} from "../language";
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
let vm: VM | undefined,
  version = 0,
  active = false,
  generation = 0;
let breakpoints = new Set<number>(),
  skipLine = -1;
const send = (compilation?: Compilation) =>
  postMessage({
    version,
    compilation,
    state: vm ? snapshot(vm) : undefined,
  } satisfies Response);
function start(mode?: StepMode) {
  if (!vm || ["completed", "errored", "terminated"].includes(vm.status)) return;
  const machine = vm;
  const ticket = ++generation;
  const anchor: StepAnchor = {
    pc: vm.pc,
    line: vm.program.instructions[vm.pc]?.span.line ?? 1,
    depth: vm.frames.length,
  };
  skipLine = vm.status === "ready" ? -1 : anchor.line;
  active = true;
  vm.status = "running";
  send();
  function tick() {
    if (!active || ticket !== generation) return;
    const begin = performance.now();
    for (let i = 0; i < 1500 && machine.status === "running"; i++) {
      const line = machine.program.instructions[machine.pc]?.span.line;
      if (line !== skipLine) skipLine = -1;
      if (
        !mode &&
        line !== undefined &&
        breakpoints.has(line) &&
        line !== skipLine
      ) {
        machine.status = "paused";
        break;
      }
      executeStep(machine);
      if (mode && stepFinished(machine, mode, anchor)) {
        if (machine.status === "running") machine.status = "paused";
        break;
      }
    }
    machine.elapsedMs += performance.now() - begin;
    if (machine.status === "running") setTimeout(tick, 0);
    else active = false;
    send();
  }
  setTimeout(tick, 0);
}
self.onmessage = (event: MessageEvent<Request>) => {
  const r = event.data;
  if (r.command === "compile") {
    version = r.version;
    active = false;
    generation++;
    const compilation = build(r.source);
    vm = compilation.program ? createVM(compilation.program) : undefined;
    send(compilation);
    return;
  }
  if (r.version !== version || !vm) return;
  if (r.command === "pause") {
    active = false;
    generation++;
    if (vm.status === "running") vm.status = "paused";
    send();
  }
  if (r.command === "reset") {
    active = false;
    generation++;
    vm = createVM(vm.program);
    send();
  }
  if (r.command === "run" || r.command === "step") {
    breakpoints = new Set(r.breakpoints ?? []);
    start(r.command === "step" ? (r.mode ?? "instruction") : undefined);
  }
};
