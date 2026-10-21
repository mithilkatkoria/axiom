import {
  initializeEngine,
  callRust,
  type EngineIdentity,
} from "../language/runtime";
import { benchmarks, type Measurement } from "../benchmarks";
import { build, executeProgram } from "../language";
self.onmessage = async () => {
  try {
    await initializeEngine();
    const engine = callRust<EngineIdentity>("identity");
    const measurements: Measurement[] = [];
    for (const input of benchmarks) {
      for (let i = 0; i < 2; i++) {
        const warm = build(input.source);
        if (warm.program) executeProgram(warm.program);
      }
      const compilationTimes: number[] = [],
        executionTimes: number[] = [];
      let last: ReturnType<typeof executeProgram> | undefined;
      for (let i = 0; i < 10; i++) {
        const c = build(input.source);
        if (!c.program) throw new Error(`Compilation failed: ${input.name}`);
        last = executeProgram(c.program);
        if (
          last.status !== "completed" ||
          JSON.stringify(last.output) !== JSON.stringify(input.expected)
        )
          throw new Error(`Validation failed: ${input.name}`);
        compilationTimes.push(c.timings.total);
        executionTimes.push(last.elapsedMs);
      }
      const median = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return (sorted[4] + sorted[5]) / 2;
      };
      measurements.push({
        name: input.name,
        compileMs: median(compilationTimes),
        executeMs: median(executionTimes),
        minMs: Math.min(...executionTimes),
        maxMs: Math.max(...executionTimes),
        steps: last!.steps,
        maxStack: last!.maxStack,
        maxDepth: last!.maxDepth,
        samples: 10,
      });
      postMessage({ measurements, engine, done: false });
    }
    postMessage({ measurements, done: true });
  } catch (error) {
    postMessage({
      error: error instanceof Error ? error.message : "Benchmark failed.",
      done: true,
    });
  }
};
